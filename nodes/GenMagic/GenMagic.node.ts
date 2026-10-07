import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError, sleep } from 'n8n-workflow';

import { accountOperations } from './descriptions/AccountDescription';
import { audioFields, audioOperations } from './descriptions/AudioDescription';
import { imageFields, imageOperations } from './descriptions/ImageDescription';
import { modelFields, modelOperations } from './descriptions/ModelDescription';
import { textFields, textOperations } from './descriptions/TextDescription';
import { videoFields, videoOperations } from './descriptions/VideoDescription';
import {
	AUTO_MODEL,
	getImageModels,
	getMusicModels,
	getSpeechModels,
	getTextModels,
	getVideoModels,
} from './models';
import type { ModelParameter } from './descriptions/shared';
import { downloadFile, fileName, genMagicRequest, header, metering, mimeType } from './transport';

/** How often a video job is checked while the node waits for it. */
const VIDEO_POLL_MS = 8_000;
/** Reference images are sent inline, so they are capped like GenMagic's own studio caps them. */
const MAX_REFERENCE_BYTES = 10 * 1024 * 1024;

type Output = { json: IDataObject; file?: { data: Buffer; mimeType: string; stem: string } };

const DOCS =
	'https://genmagic.co/developers?utm_source=n8n&utm_medium=integration&utm_campaign=agent-platforms';

/**
 * The node's categories, docs links and search aliases. n8n's nodes panel finds a node by its
 * display name and these aliases only (never its description), and n8n builds the verified-node
 * listing that n8n Cloud searches before a node is installed from this description object alone.
 * A codex kept only in GenMagic.node.json reaches installed copies but leaves that listing with
 * no aliases, so a search for "video" or "tts" never showed GenMagic. GenMagic.node.json repeats
 * these values for tools that read codex files, and a test keeps the two identical.
 * Model names here are model families GenMagic's catalog runs today: drop one when it leaves.
 */
const GENMAGIC_CODEX: NonNullable<INodeTypeDescription['codex']> = {
	categories: ['AI', 'Marketing & Content'],
	// The subcategories n8n's own multimodal vendor nodes (OpenAI, Google Gemini, MiniMax) use.
	subcategories: { AI: ['Agents', 'Miscellaneous', 'Root Nodes'] },
	resources: {
		primaryDocumentation: [{ url: `${DOCS}#n8n` }],
		credentialDocumentation: [{ url: `${DOCS}#auth` }],
	},
	alias: [
		'image',
		'video',
		'audio',
		'speech',
		'tts',
		'voice',
		'music',
		'text to image',
		'text to video',
		'text to speech',
		'AI image generator',
		'image generation',
		'image editing',
		'AI video generator',
		'video generation',
		'logo',
		'LLM',
		'Veo',
		'Kling',
		'Seedance',
		'Hailuo',
		'Runway',
		'Nano Banana',
		'GPT Image',
		'FLUX',
		'Seedream',
		'Recraft',
		'Lyria',
	],
};

export class GenMagic implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'GenMagic',
		name: 'genMagic',
		icon: { light: 'file:genmagic.svg', dark: 'file:genmagic.dark.svg' },
		group: ['transform'],
		version: [1, 2],
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Generate images, video, music, speech and text with 450+ AI models through one GenMagic API key',
		codex: GENMAGIC_CODEX,
		defaults: {
			name: 'GenMagic',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'genMagicApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Account', value: 'account' },
					{ name: 'Audio', value: 'audio' },
					{ name: 'Image', value: 'image' },
					{ name: 'Model', value: 'model' },
					{ name: 'Text', value: 'text' },
					{ name: 'Video', value: 'video' },
				],
				default: 'image',
			},
			...accountOperations,
			...audioOperations,
			...audioFields,
			...imageOperations,
			...imageFields,
			...modelOperations,
			...modelFields,
			...textOperations,
			...textFields,
			...videoOperations,
			...videoFields,
		],
	};

	methods = {
		loadOptions: {
			getImageModels,
			getMusicModels,
			getSpeechModels,
			getTextModels,
			getVideoModels,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				let outputs: Output[];

				if (resource === 'image' && operation === 'generate') {
					outputs = await generateImage.call(this, i);
				} else if (resource === 'video' && operation === 'generate') {
					outputs = [await generateVideo.call(this, i)];
				} else if (resource === 'video' && operation === 'get') {
					outputs = [await getVideo.call(this, i)];
				} else if (resource === 'audio' && operation === 'generateSpeech') {
					outputs = [await generateAudio.call(this, i, 'speech')];
				} else if (resource === 'audio' && operation === 'generateMusic') {
					outputs = [await generateAudio.call(this, i, 'music')];
				} else if (resource === 'text' && operation === 'generate') {
					outputs = [await generateText.call(this, i)];
				} else if (resource === 'model' && operation === 'getAll') {
					outputs = await getModels.call(this, i);
				} else if (resource === 'model' && operation === 'get') {
					outputs = [await getModel.call(this, i)];
				} else if (resource === 'account' && operation === 'getBalance') {
					outputs = [await getBalance.call(this, i)];
				} else {
					throw new NodeOperationError(
						this.getNode(),
						`The operation "${operation}" is not supported for "${resource}"`,
						{ itemIndex: i },
					);
				}

				const binaryField = outputs.some((o) => o.file)
					? (this.getNodeParameter('binaryPropertyName', i, 'data') as string)
					: '';
				for (const output of outputs) {
					const item: INodeExecutionData = { json: output.json, pairedItem: { item: i } };
					if (output.file) {
						item.binary = {
							[binaryField]: await this.helpers.prepareBinaryData(
								output.file.data,
								fileName(output.file.stem, output.file.mimeType),
								output.file.mimeType,
							),
						};
					}
					returnData.push(item);
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				// Both constructors hand back an error that is already of their class unchanged,
				// so the messages built in transport.ts survive; anything else is a request fault.
				if (error instanceof NodeOperationError) {
					throw new NodeOperationError(this.getNode(), error, { itemIndex: i });
				}
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}

		return [returnData];
	}
}

/** The chosen model, or undefined to let GenMagic pick. Version 1 nodes share one `model` parameter (see modelFields). */
function chosenModel(this: IExecuteFunctions, i: number, name: ModelParameter): string | undefined {
	const parameter = this.getNode().typeVersion >= 2 ? name : 'model';
	const model = String(this.getNodeParameter(parameter, i, AUTO_MODEL) ?? '').trim();
	return model && model !== AUTO_MODEL ? model : undefined;
}

function prompt(this: IExecuteFunctions, i: number, name: string, label: string): string {
	const value = String(this.getNodeParameter(name, i, '') ?? '').trim();
	if (!value)
		throw new NodeOperationError(this.getNode(), `${label} is required`, { itemIndex: i });
	return value;
}

function wantsFile(this: IExecuteFunctions, i: number): boolean {
	return this.getNodeParameter('downloadFile', i, true) as boolean;
}

/** A generated file as an output, or the URL alone with the reason it was not attached. */
async function withFile(
	this: IExecuteFunctions,
	json: IDataObject,
	url: string | undefined,
	stem: string,
	download: boolean,
): Promise<Output> {
	if (!download || !url) return { json };
	const file = await downloadFile.call(this, url);
	if ('error' in file) return { json: { ...json, file_error: `Not attached: ${file.error}` } };
	return { json, file: { ...file, stem } };
}

async function referenceImage(
	this: IExecuteFunctions,
	i: number,
	options: IDataObject,
): Promise<string | undefined> {
	const field = String(options.referenceImageField ?? '').trim();
	if (field) {
		const binary = this.helpers.assertBinaryData(i, field);
		if (!binary.mimeType?.startsWith('image/')) {
			throw new NodeOperationError(
				this.getNode(),
				`The reference image in field "${field}" is not an image (it is ${binary.mimeType || 'unknown'})`,
				{ itemIndex: i },
			);
		}
		const buffer = await this.helpers.getBinaryDataBuffer(i, field);
		if (buffer.length > MAX_REFERENCE_BYTES) {
			throw new NodeOperationError(this.getNode(), 'The reference image is larger than 10 MB', {
				itemIndex: i,
			});
		}
		return `data:${binary.mimeType};base64,${buffer.toString('base64')}`;
	}
	const url = String(options.referenceImageUrl ?? '').trim();
	return url || undefined;
}

async function generateImage(this: IExecuteFunctions, i: number): Promise<Output[]> {
	const options = this.getNodeParameter('options', i, {}) as IDataObject;
	const body: IDataObject = { prompt: prompt.call(this, i, 'prompt', 'A prompt') };
	const model = chosenModel.call(this, i, 'imageModel');
	if (model) body.model = model;
	if (options.size) body.size = options.size;
	if (options.type === 'logo') body.type = 'logo';
	if (typeof options.n === 'number' && options.n > 1) body.n = Math.min(Math.floor(options.n), 4);
	const image = await referenceImage.call(this, i, options);
	if (image) body.image = image;

	const { body: result, headers } = await genMagicRequest.call(
		this,
		'POST',
		'/api/v1/images/generations',
		{
			body,
			itemIndex: i,
		},
	);
	const data = (result as { data?: unknown } | null)?.data;
	const images = (Array.isArray(data) ? data : []) as Array<{ url?: string; b64_json?: string }>;
	if (images.length === 0) {
		throw new NodeApiError(this.getNode(), result as JsonObject, {
			message: 'GenMagic returned no image',
			itemIndex: i,
		});
	}

	const download = wantsFile.call(this, i);
	const cost = metering(headers);
	const outputs: Output[] = [];
	for (const [index, image] of images.entries()) {
		const url =
			image.url ?? (image.b64_json ? `data:image/png;base64,${image.b64_json}` : undefined);
		const json: IDataObject = {
			// A data URL is returned as the file, not repeated in the JSON.
			url: url && !url.startsWith('data:') ? url : null,
			model: model ?? AUTO_MODEL,
			index,
			...cost,
		};
		outputs.push(await withFile.call(this, json, url, `genmagic-image-${index + 1}`, download));
	}
	return outputs;
}

async function generateVideo(this: IExecuteFunctions, i: number): Promise<Output> {
	const options = this.getNodeParameter('options', i, {}) as IDataObject;
	const body: IDataObject = { prompt: prompt.call(this, i, 'prompt', 'A prompt') };
	const model = chosenModel.call(this, i, 'videoModel');
	if (model) body.model = model;
	if (options.aspect_ratio) body.aspect_ratio = options.aspect_ratio;
	if (typeof options.duration === 'number' && options.duration > 0)
		body.duration = Math.round(options.duration);
	if (typeof options.resolution === 'string' && options.resolution.trim()) {
		body.resolution = options.resolution.trim();
	}
	if (typeof options.generate_audio === 'boolean') body.generate_audio = options.generate_audio;

	const { body: created } = await genMagicRequest.call(this, 'POST', '/api/v1/videos', {
		body,
		timeout: 60_000,
		itemIndex: i,
	});
	const job = created as IDataObject;
	const id = typeof job.id === 'string' ? job.id : '';
	if (!id) {
		throw new NodeApiError(this.getNode(), job as JsonObject, {
			message: 'GenMagic did not return a video job ID',
			itemIndex: i,
		});
	}

	if (!(this.getNodeParameter('waitForCompletion', i, true) as boolean)) {
		return {
			json: { id, status: job.status ?? 'queued', model: job.model ?? model ?? AUTO_MODEL },
		};
	}

	const maxWaitMs = Math.max(10, this.getNodeParameter('maxWaitTime', i, 300) as number) * 1000;
	const deadline = Date.now() + maxWaitMs;
	let current: IDataObject = job;
	let headers: IDataObject = {};
	while (current.status !== 'completed' && current.status !== 'failed' && Date.now() < deadline) {
		await sleep(Math.min(VIDEO_POLL_MS, Math.max(0, deadline - Date.now())));
		({ body: current, headers } = (await genMagicRequest.call(
			this,
			'GET',
			`/api/v1/videos/${encodeURIComponent(id)}`,
			{
				timeout: 60_000,
				itemIndex: i,
			},
		)) as { body: IDataObject; headers: IDataObject });
	}

	if (current.status === 'failed') {
		throw new NodeOperationError(this.getNode(), 'The video could not be generated', {
			description: `${String(current.error ?? 'The render failed')}. Nothing was billed for it.`,
			itemIndex: i,
		});
	}
	if (current.status !== 'completed') {
		return {
			json: {
				id,
				status: current.status ?? 'processing',
				model: current.model ?? job.model ?? model ?? AUTO_MODEL,
				message: `Still rendering after ${Math.round(maxWaitMs / 1000)} seconds. Fetch it later with Video > Get and this ID; it is billed once, when it completes.`,
			},
		};
	}
	return await videoOutput.call(this, i, current, headers);
}

async function getVideo(this: IExecuteFunctions, i: number): Promise<Output> {
	const id = prompt.call(this, i, 'videoId', 'A video ID');
	const { body, headers } = await genMagicRequest.call(
		this,
		'GET',
		`/api/v1/videos/${encodeURIComponent(id)}`,
		{
			timeout: 60_000,
			itemIndex: i,
		},
	);
	const job = body as IDataObject;
	if (job.status !== 'completed') return { json: job };
	return await videoOutput.call(this, i, job, headers);
}

async function videoOutput(
	this: IExecuteFunctions,
	i: number,
	job: IDataObject,
	headers: IDataObject,
): Promise<Output> {
	const url = typeof job.url === 'string' ? job.url : undefined;
	const cents = typeof job.cost_cents === 'number' ? job.cost_cents : undefined;
	const json: IDataObject = {
		id: job.id,
		status: job.status,
		model: job.model,
		url: url ?? null,
		...(cents !== undefined ? { cost_usd: Math.round(cents * 10_000) / 1_000_000 } : {}),
		...metering(headers),
	};
	return await withFile.call(
		this,
		json,
		url,
		`genmagic-video-${String(job.id ?? 'clip')}`,
		wantsFile.call(this, i),
	);
}

async function generateAudio(
	this: IExecuteFunctions,
	i: number,
	kind: 'speech' | 'music',
): Promise<Output> {
	const model = chosenModel.call(this, i, kind === 'speech' ? 'speechModel' : 'musicModel');
	let body: IDataObject;
	if (kind === 'speech') {
		const options = this.getNodeParameter('options', i, {}) as IDataObject;
		body = { input: prompt.call(this, i, 'input', 'The text to speak') };
		if (typeof options.voice === 'string' && options.voice.trim())
			body.voice = options.voice.trim();
	} else {
		body = { prompt: prompt.call(this, i, 'prompt', 'A prompt') };
	}
	if (model) body.model = model;

	const { body: audio, headers } = await genMagicRequest.call(
		this,
		'POST',
		`/api/v1/audio/${kind}`,
		{
			body,
			expectFile: true,
			timeout: 300_000,
			itemIndex: i,
		},
	);
	const data = Buffer.from(audio as Buffer);
	if (data.length === 0) {
		throw new NodeApiError(this.getNode(), {} as JsonObject, {
			message: 'GenMagic returned no audio',
			itemIndex: i,
		});
	}
	const mime = mimeType(header(headers, 'content-type'), 'audio/mpeg');
	return {
		json: {
			url: header(headers, 'x-media-url') ?? null,
			model: model ?? AUTO_MODEL,
			...metering(headers),
		},
		file: { data, mimeType: mime, stem: `genmagic-${kind}` },
	};
}

async function generateText(this: IExecuteFunctions, i: number): Promise<Output> {
	const options = this.getNodeParameter('options', i, {}) as IDataObject;
	const body: IDataObject = { prompt: prompt.call(this, i, 'prompt', 'A prompt') };
	const model = chosenModel.call(this, i, 'textModel');
	if (model) body.model = model;
	if (typeof options.type === 'string' && options.type !== 'text') body.type = options.type;
	if (typeof options.system === 'string' && options.system.trim())
		body.system = options.system.trim();

	const { body: result, headers } = await genMagicRequest.call(this, 'POST', '/api/v1/text', {
		body,
		timeout: 300_000,
		itemIndex: i,
	});
	const text = result as IDataObject;
	return {
		json: {
			text: text.text ?? '',
			model: text.model ?? model ?? AUTO_MODEL,
			...(text.type ? { type: text.type } : {}),
			...(text.usage ? { usage: text.usage } : {}),
			...metering(headers),
		},
	};
}

async function getModels(this: IExecuteFunctions, i: number): Promise<Output[]> {
	const category = this.getNodeParameter('category', i, 'all') as string;
	const filters = this.getNodeParameter('filters', i, {}) as IDataObject;
	const qs: IDataObject = {};
	if (category !== 'all') qs.category = category;
	if (typeof filters.search === 'string' && filters.search.trim())
		qs.search = filters.search.trim();
	if (typeof filters.capability === 'string' && filters.capability)
		qs.capability = filters.capability;

	const { body } = await genMagicRequest.call(this, 'GET', '/api/v1/models', {
		qs,
		timeout: 30_000,
		itemIndex: i,
	});
	const data = (body as { data?: unknown } | null)?.data;
	let models = (Array.isArray(data) ? data : []) as IDataObject[];
	if (!(this.getNodeParameter('returnAll', i, false) as boolean)) {
		models = models.slice(0, this.getNodeParameter('limit', i, 50) as number);
	}
	return models.map((json) => ({ json }));
}

async function getBalance(this: IExecuteFunctions, i: number): Promise<Output> {
	const { body } = await genMagicRequest.call(this, 'GET', '/api/v1/usage', {
		timeout: 30_000,
		itemIndex: i,
	});
	return { json: body as IDataObject };
}

async function getModel(this: IExecuteFunctions, i: number): Promise<Output> {
	const id = prompt.call(this, i, 'modelId', 'A model ID');
	// Model IDs contain a slash (vendor/model), which the API reads as part of the path.
	const path = id.split('/').map(encodeURIComponent).join('/');
	const { body } = await genMagicRequest.call(this, 'GET', `/api/v1/models/${path}`, {
		timeout: 30_000,
		itemIndex: i,
	});
	return { json: body as IDataObject };
}
