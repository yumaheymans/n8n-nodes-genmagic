// Offline tests for the GenMagic node: a fake n8n execution context records every request
// the node makes and answers it like the GenMagic API would, so no credits are spent.
// Run with `npm test` (it builds first and tests the compiled dist/ that n8n loads).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { GenMagic } = require('../dist/nodes/GenMagic/GenMagic.node.js');
const { NodeApiError, NodeOperationError } = require('n8n-workflow');
const { version: PACKAGE_JSON_VERSION } = require('../package.json');

const MEDIA = 'https://tlwdqzfibvgektzgdfqa.supabase.co/storage/v1/object/public/generations/a.png';

/**
 * A fake IExecuteFunctions. `api` answers authenticated GenMagic calls, `publicApi` answers calls
 * made without the credential (the public model catalog), `media` answers downloads.
 */
function context({ params, api = [], publicApi = [], media = {}, continueOnFail = false, binary = {}, typeVersion = 1, credential = true }) {
	const calls = [];
	const publicCalls = [];
	const downloads = [];
	const queue = [...api];
	const publicQueue = [...publicApi];
	const ctx = {
		getInputData: () => [{ json: {}, binary }],
		getNode: () => ({ id: '1', name: 'GenMagic', type: 'n8n-nodes-genmagic.genMagic', typeVersion, position: [0, 0], parameters: {} }),
		getNodeParameter: (name, _i, fallback) => (name in params ? params[name] : fallback),
		async getCredentials(type) {
			assert.equal(type, 'genMagicApi');
			if (!credential) throw new Error('Node does not have any credentials set');
			return { apiKey: 'gm_live_test' };
		},
		continueOnFail: () => continueOnFail,
		helpers: {
			async httpRequestWithAuthentication(credentialType, options) {
				assert.equal(credentialType, 'genMagicApi');
				calls.push(options);
				const next = queue.shift();
				assert.ok(next, `unexpected request ${options.method} ${options.url}`);
				return { statusCode: 200, headers: {}, ...next };
			},
			async httpRequest(options) {
				if (options.url.startsWith('https://genmagic.co/api/')) {
					publicCalls.push(options);
					const next = publicQueue.shift();
					assert.ok(next, `unexpected keyless request ${options.method} ${options.url}`);
					return { statusCode: 200, headers: {}, ...next };
				}
				downloads.push(options.url);
				const file = media[options.url];
				return file
					? { statusCode: 200, headers: { 'content-type': file.type }, body: Buffer.from(file.data) }
					: { statusCode: 404, headers: {}, body: Buffer.from('') };
			},
			async prepareBinaryData(data, fileName, mimeType) {
				return { data: Buffer.from(data).toString('base64'), fileName, mimeType, fileSize: String(data.length) };
			},
			assertBinaryData(_i, field) {
				const b = binary[field];
				if (!b) throw new Error(`no binary field ${field}`);
				return b;
			},
			async getBinaryDataBuffer(_i, field) {
				return Buffer.from(binary[field].data, 'base64');
			},
		},
	};
	return { ctx, calls, publicCalls, downloads };
}

async function run(ctx) {
	const [items] = await new GenMagic().execute.call(ctx);
	return items;
}

test('image: sends the prompt and options, returns the URL, cost and the file as binary', async () => {
	const { ctx, calls } = context({
		params: {
			resource: 'image',
			operation: 'generate',
			prompt: 'a red fox',
			model: 'auto',
			options: { size: '1792x1024', type: 'logo' },
			downloadFile: true,
			binaryPropertyName: 'picture',
		},
		api: [{ body: { created: 1, data: [{ url: MEDIA }] }, headers: { 'x-cost-cents': '0.216', 'x-credits-remaining': '14.5' } }],
		media: { [MEDIA]: { type: 'image/png', data: 'PNGDATA' } },
	});
	const items = await run(ctx);
	assert.equal(calls[0].method, 'POST');
	assert.equal(calls[0].url, 'https://genmagic.co/api/v1/images/generations');
	assert.deepEqual(calls[0].body, { prompt: 'a red fox', size: '1792x1024', type: 'logo' });
	assert.equal(calls[0].headers['X-GenMagic-Client'], `n8n-node/${PACKAGE_JSON_VERSION}`);
	assert.equal(items.length, 1);
	assert.deepEqual(items[0].json, { url: MEDIA, model: 'auto', index: 0, cost_usd: 0.00216, balance_usd: 0.145 });
	assert.equal(items[0].binary.picture.mimeType, 'image/png');
	assert.equal(items[0].binary.picture.fileName, 'genmagic-image-1.png');
	assert.deepEqual(items[0].pairedItem, { item: 0 });
});

test('image: several images become several items, a base64 image is decoded in place', async () => {
	const { ctx, calls, downloads } = context({
		params: { resource: 'image', operation: 'generate', prompt: 'x', model: 'recraft/recraft-v4.1-flash', options: { n: 2 } },
		api: [{ body: { data: [{ b64_json: Buffer.from('ONE').toString('base64') }, { url: MEDIA }] } }],
		media: { [MEDIA]: { type: 'image/webp', data: 'TWO' } },
	});
	const items = await run(ctx);
	assert.deepEqual(calls[0].body, { prompt: 'x', model: 'recraft/recraft-v4.1-flash', n: 2 });
	assert.equal(items.length, 2);
	assert.equal(items[0].json.url, null);
	assert.equal(Buffer.from(items[0].binary.data.data, 'base64').toString(), 'ONE');
	assert.equal(items[1].binary.data.fileName, 'genmagic-image-2.webp');
	assert.deepEqual(downloads, [MEDIA]);
});

test('image: a reference image from a binary field is sent inline as a data URL', async () => {
	const { ctx, calls } = context({
		params: { resource: 'image', operation: 'generate', prompt: 'make it blue', options: { referenceImageField: 'data' }, downloadFile: false },
		binary: { data: { mimeType: 'image/jpeg', data: Buffer.from('JPEG').toString('base64') } },
		api: [{ body: { data: [{ url: MEDIA }] } }],
	});
	const items = await run(ctx);
	assert.equal(calls[0].body.image, `data:image/jpeg;base64,${Buffer.from('JPEG').toString('base64')}`);
	assert.equal(items[0].binary, undefined);
});

test('image: a file on another host is never downloaded; the URL is returned with the reason', async () => {
	const elsewhere = 'https://cdn.example.com/a.png';
	const { ctx, downloads } = context({
		params: { resource: 'image', operation: 'generate', prompt: 'x' },
		api: [{ body: { data: [{ url: elsewhere }] } }],
	});
	const items = await run(ctx);
	assert.deepEqual(downloads, []);
	assert.equal(items[0].json.url, elsewhere);
	assert.match(items[0].json.file_error, /only downloaded from GenMagic's own hosts/);
	assert.equal(items[0].binary, undefined);
});

test('video: waits for the render, then returns the clip, its cost and the file', async () => {
	const clip = 'https://genmagic.co/media/clip.mp4';
	const { ctx, calls } = context({
		params: {
			resource: 'video',
			operation: 'generate',
			prompt: 'waves at dusk',
			model: 'bytedance/seedance-1-5-pro',
			options: { aspect_ratio: '9:16', duration: 4, resolution: '480p', generate_audio: false },
			waitForCompletion: true,
			maxWaitTime: 60,
		},
		api: [
			{ statusCode: 202, body: { id: 'job_1', status: 'queued', model: 'bytedance/seedance-1-5-pro' } },
			{ body: { id: 'job_1', status: 'completed', model: 'bytedance/seedance-1-5-pro', url: clip, cost_cents: 9.224 }, headers: { 'x-cost-cents': '9.224', 'x-credits-remaining': '5.7' } },
		],
		media: { [clip]: { type: 'video/mp4', data: 'MP4' } },
	});
	const items = await run(ctx);
	assert.deepEqual(calls[0].body, { prompt: 'waves at dusk', model: 'bytedance/seedance-1-5-pro', aspect_ratio: '9:16', duration: 4, resolution: '480p', generate_audio: false });
	assert.equal(calls[1].method, 'GET');
	assert.equal(calls[1].url, 'https://genmagic.co/api/v1/videos/job_1');
	assert.deepEqual(items[0].json, { id: 'job_1', status: 'completed', model: 'bytedance/seedance-1-5-pro', url: clip, cost_usd: 0.09224, balance_usd: 0.057 });
	assert.equal(items[0].binary.data.fileName, 'genmagic-video-job_1.mp4');
});

test('video: without waiting it returns the job ID at once', async () => {
	const { ctx, calls } = context({
		params: { resource: 'video', operation: 'generate', prompt: 'x', waitForCompletion: false },
		api: [{ statusCode: 202, body: { id: 'job_2', status: 'queued', model: 'google/veo-3.1-lite' } }],
	});
	const items = await run(ctx);
	assert.equal(calls.length, 1);
	assert.deepEqual(items[0].json, { id: 'job_2', status: 'queued', model: 'google/veo-3.1-lite' });
});

test('video: a failed render is an error that says nothing was billed', async () => {
	const { ctx } = context({
		params: { resource: 'video', operation: 'generate', prompt: 'x', maxWaitTime: 60 },
		api: [{ body: { id: 'job_3', status: 'queued' } }, { body: { id: 'job_3', status: 'failed', error: 'Content policy' } }],
	});
	await assert.rejects(run(ctx), (error) => {
		assert.ok(error instanceof NodeOperationError);
		assert.equal(error.message, 'The video could not be generated');
		assert.match(error.description, /Content policy\. Nothing was billed/);
		return true;
	});
});

test('video: a clip still rendering at the time limit comes back as its job ID', async () => {
	const { ctx } = context({
		params: { resource: 'video', operation: 'generate', prompt: 'x', maxWaitTime: 10 },
		api: [
			{ body: { id: 'job_4', status: 'queued', model: 'm' } },
			{ body: { id: 'job_4', status: 'processing', model: 'm' } },
			{ body: { id: 'job_4', status: 'processing', model: 'm' } },
		],
	});
	const items = await run(ctx);
	assert.equal(items[0].json.id, 'job_4');
	assert.equal(items[0].json.status, 'processing');
	assert.match(items[0].json.message, /Still rendering after 10 seconds.*Video > Get/);
});

test('video get: returns a pending job as is', async () => {
	const { ctx, calls } = context({
		params: { resource: 'video', operation: 'get', videoId: 'job 5' },
		api: [{ body: { id: 'job 5', object: 'video.generation', status: 'processing', model: 'm' } }],
	});
	const items = await run(ctx);
	assert.equal(calls[0].url, 'https://genmagic.co/api/v1/videos/job%205');
	assert.equal(items[0].json.status, 'processing');
});

test('speech: returns the audio file, its hosted URL and the cost', async () => {
	const { ctx, calls } = context({
		params: { resource: 'audio', operation: 'generateSpeech', input: 'Hello there', model: 'openai/gpt-audio-mini', options: { voice: 'alloy' }, binaryPropertyName: 'audio' },
		api: [{ body: Buffer.from('MP3BYTES'), headers: { 'content-type': 'audio/mpeg', 'x-media-url': 'https://genmagic.co/m/s.mp3', 'x-cost-cents': '0.01' } }],
	});
	const items = await run(ctx);
	assert.equal(calls[0].url, 'https://genmagic.co/api/v1/audio/speech');
	assert.equal(calls[0].encoding, 'arraybuffer');
	assert.deepEqual(calls[0].body, { input: 'Hello there', voice: 'alloy', model: 'openai/gpt-audio-mini' });
	assert.deepEqual(items[0].json, { url: 'https://genmagic.co/m/s.mp3', model: 'openai/gpt-audio-mini', cost_usd: 0.0001 });
	assert.equal(items[0].binary.audio.fileName, 'genmagic-speech.mp3');
});

test('music: posts the prompt to the music endpoint', async () => {
	const { ctx, calls } = context({
		params: { resource: 'audio', operation: 'generateMusic', prompt: 'lo-fi piano' },
		api: [{ body: Buffer.from('MP3'), headers: { 'content-type': 'audio/mpeg' } }],
	});
	const items = await run(ctx);
	assert.equal(calls[0].url, 'https://genmagic.co/api/v1/audio/music');
	assert.deepEqual(calls[0].body, { prompt: 'lo-fi piano' });
	assert.equal(items[0].binary.data.fileName, 'genmagic-music.mp3');
});

test('text: sends the output type and instructions, returns the text and usage', async () => {
	const { ctx, calls } = context({
		params: { resource: 'text', operation: 'generate', prompt: 'Say hi', model: 'qwen/qwen3.8-27b:free', options: { type: 'writing', system: 'Be brief' } },
		api: [{ body: { model: 'qwen/qwen3.8-27b:free', type: 'writing', text: 'Hi!', usage: { input_tokens: 5, output_tokens: 2 } }, headers: { 'x-cost-cents': '0', 'x-credits-remaining': '14.9' } }],
	});
	const items = await run(ctx);
	assert.deepEqual(calls[0].body, { prompt: 'Say hi', model: 'qwen/qwen3.8-27b:free', type: 'writing', system: 'Be brief' });
	assert.deepEqual(items[0].json, { text: 'Hi!', model: 'qwen/qwen3.8-27b:free', type: 'writing', usage: { input_tokens: 5, output_tokens: 2 }, cost_usd: 0, balance_usd: 0.149 });
});

test('models: lists a category with a limit, and gets one model by its slash ID', async () => {
	const list = context({
		params: { resource: 'model', operation: 'getAll', category: 'video', returnAll: false, limit: 2, filters: { search: 'veo' } },
		api: [{ body: { object: 'list', data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] } }],
	});
	const items = await run(list.ctx);
	assert.deepEqual(list.calls[0].qs, { category: 'video', search: 'veo' });
	assert.deepEqual(items.map((i) => i.json.id), ['a', 'b']);

	const one = context({ params: { resource: 'model', operation: 'get', modelId: 'google/veo-3.1' }, api: [{ body: { id: 'google/veo-3.1' } }] });
	await run(one.ctx);
	assert.equal(one.calls[0].url, 'https://genmagic.co/api/v1/models/google/veo-3.1');
});

test('account: returns the balance', async () => {
	const { ctx, calls } = context({
		params: { resource: 'account', operation: 'getBalance' },
		api: [{ body: { object: 'usage', balance_usd: 0.1498, spent_usd: 0.3502, generation_count: 10 } }],
	});
	const items = await run(ctx);
	assert.equal(calls[0].url, 'https://genmagic.co/api/v1/usage');
	assert.equal(items[0].json.balance_usd, 0.1498);
});

for (const [status, body, message, hint] of [
	[401, { error: { message: 'Invalid API key', code: 'invalid_api_key' } }, 'GenMagic rejected the API key', /genmagic\.co\/developers\?utm_source=n8n/],
	[402, { error: { message: 'Not enough credits', code: 'insufficient_credits' } }, 'Your GenMagic balance is too low for this generation', /genmagic\.co\/pricing/],
	[403, { error: { message: 'Verify first', code: 'email_verification_required' } }, 'Verify the email address of your GenMagic account first', /verify-email/],
	[429, { error: { message: 'Slow down', code: 'rate_limited' } }, 'GenMagic rate limit reached', /Wait a moment/],
	[400, { error: { message: 'FLUX Video Edit edits media you supply', code: 'model_not_supported' } }, 'GenMagic error: FLUX Video Edit edits media you supply', /model_not_supported/],
]) {
	test(`errors: HTTP ${status} becomes a clear NodeApiError`, async () => {
		const { ctx } = context({ params: { resource: 'text', operation: 'generate', prompt: 'x' }, api: [{ statusCode: status, body }] });
		await assert.rejects(run(ctx), (error) => {
			assert.ok(error instanceof NodeApiError);
			assert.equal(error.message, message);
			assert.match(error.description, hint);
			assert.equal(error.httpCode, String(status));
			return true;
		});
	});
}

test('errors: an error body on a file request is read from its bytes', async () => {
	const { ctx } = context({
		params: { resource: 'audio', operation: 'generateSpeech', input: 'x' },
		api: [{ statusCode: 402, body: Buffer.from(JSON.stringify({ error: { message: 'Not enough credits', code: 'insufficient_credits' } })) }],
	});
	await assert.rejects(run(ctx), /balance is too low/);
});

test('errors: with Continue On Fail the error becomes an item', async () => {
	const { ctx } = context({
		continueOnFail: true,
		params: { resource: 'text', operation: 'generate', prompt: 'x' },
		api: [{ statusCode: 401, body: { error: { message: 'Invalid API key' } } }],
	});
	const items = await run(ctx);
	assert.deepEqual(items, [{ json: { error: 'GenMagic rejected the API key' }, pairedItem: { item: 0 } }]);
});

const CATALOG = {
	body: {
		data: [
			{ id: 'old/t2v', name: 'Old', created: 1, pricing: { unit: 'second', usd_per_unit: 0.05 }, capabilities: { text_to_video: true } },
			{ id: 'bfl/edit', name: 'Edit', created: 3, pricing: { unit: 'second', usd_per_unit: 0.1 }, capabilities: { text_to_video: false } },
			{ id: 'new/t2v', name: 'New', created: 2, pricing: { unit: 'second', usd_per_unit: 0.023056 }, capabilities: {} },
		],
	},
};

test('model dropdowns: Auto first, newest first, prices from the catalog, edit-only video models left out', async () => {
	const { ctx, calls, publicCalls } = context({ params: {}, api: [CATALOG] });
	const options = await new GenMagic().methods.loadOptions.getVideoModels.call(ctx);
	assert.deepEqual(calls[0].qs, { category: 'video' });
	assert.equal(publicCalls.length, 0);
	assert.deepEqual(options.map((o) => o.value), ['auto', 'new/t2v', 'old/t2v']);
	assert.equal(options[1].name, 'New ($0.0231/second)');
});

test('model dropdowns: without a credential the catalog is read keyless', async () => {
	// n8n asks for a new node's options before it attaches the credential; GenMagic serves the
	// catalog publicly, so the list loads instead of "Error fetching options".
	const { ctx, calls, publicCalls } = context({ params: {}, credential: false, publicApi: [CATALOG] });
	const options = await new GenMagic().methods.loadOptions.getVideoModels.call(ctx);
	assert.equal(calls.length, 0);
	assert.equal(publicCalls[0].url, 'https://genmagic.co/api/v1/models');
	assert.deepEqual(publicCalls[0].qs, { category: 'video' });
	assert.equal(publicCalls[0].headers.Authorization, undefined);
	assert.equal(publicCalls[0].headers['X-GenMagic-Client'], `n8n-node/${PACKAGE_JSON_VERSION}`);
	assert.deepEqual(options.map((o) => o.value), ['auto', 'new/t2v', 'old/t2v']);
});

test('model dropdowns: a failed catalog read is a clear error', async () => {
	const { ctx } = context({ params: {}, credential: false, publicApi: [{ statusCode: 503, body: { error: { message: 'Catalog unavailable' } } }] });
	await assert.rejects(new GenMagic().methods.loadOptions.getImageModels.call(ctx), /GenMagic could not complete the request/);
});

// Version 2 gives every operation its own model parameter, so switching a node's resource can
// never carry one kind's model into another; version 1 keeps the one shared `model` parameter.
for (const [label, params, endpoint, modelParameter] of [
	['image', { resource: 'image', operation: 'generate', prompt: 'x', downloadFile: false }, '/api/v1/images/generations', 'imageModel'],
	['video', { resource: 'video', operation: 'generate', prompt: 'x', waitForCompletion: false }, '/api/v1/videos', 'videoModel'],
	['speech', { resource: 'audio', operation: 'generateSpeech', input: 'x', downloadFile: false }, '/api/v1/audio/speech', 'speechModel'],
	['music', { resource: 'audio', operation: 'generateMusic', prompt: 'x', downloadFile: false }, '/api/v1/audio/music', 'musicModel'],
	['text', { resource: 'text', operation: 'generate', prompt: 'x' }, '/api/v1/text', 'textModel'],
]) {
	test(`models per operation: a version 2 ${label} node reads ${modelParameter}, version 1 reads model`, async () => {
		const answer = label === 'speech' || label === 'music'
			? { body: Buffer.from('AUDIO'), headers: { 'content-type': 'audio/mpeg', 'x-media-url': MEDIA } }
			: { body: { id: 'job', status: 'queued', data: [{ url: MEDIA }], text: 'ok' } };
		const v2 = context({ typeVersion: 2, params: { ...params, model: 'stale/other-kind', [modelParameter]: 'chosen/model' }, api: [answer] });
		await run(v2.ctx);
		assert.equal(v2.calls[0].url, `https://genmagic.co${endpoint}`);
		assert.equal(v2.calls[0].body.model, 'chosen/model');

		const v1 = context({ typeVersion: 1, params: { ...params, model: 'saved/model', [modelParameter]: 'ignored/model' }, api: [answer] });
		await run(v1.ctx);
		assert.equal(v1.calls[0].body.model, 'saved/model');
	});
}

test('models per operation: every version 2 model parameter is distinct, and version 1 keeps model', () => {
	const props = new GenMagic().description.properties.filter((p) => p.displayName === 'Model Name or ID');
	const v2 = props.filter((p) => p.displayOptions.show['@version'].includes(2)).map((p) => p.name);
	const v1 = props.filter((p) => p.displayOptions.show['@version'].includes(1)).map((p) => p.name);
	assert.deepEqual([...v2].sort(), ['imageModel', 'musicModel', 'speechModel', 'textModel', 'videoModel']);
	assert.deepEqual(new Set(v1), new Set(['model']));
	assert.equal(v1.length, 5);
	assert.deepEqual(new GenMagic().description.version, [1, 2]);
});

test('codex: declared in the description, which is all n8n lists and searches, and equal to GenMagic.node.json', () => {
	const { codex } = new GenMagic().description;
	const { node, nodeVersion, codexVersion, ...fromFile } = require('../dist/nodes/GenMagic/GenMagic.node.json');
	assert.equal(node, 'n8n-nodes-genmagic.genMagic');
	assert.equal(nodeVersion, '1.0');
	assert.equal(codexVersion, '1.0');
	assert.deepEqual(fromFile, codex);
	// The nodes panel matches a search against the display name and these aliases only.
	for (const word of ['image', 'video', 'tts', 'music', 'text to speech']) {
		assert.ok(codex.alias.includes(word), `alias ${word}`);
	}
	assert.equal(new Set(codex.alias.map((a) => a.toLowerCase())).size, codex.alias.length, 'no duplicate aliases');
	assert.ok(codex.categories.includes('AI'));
	assert.ok(codex.resources.primaryDocumentation[0].url.startsWith('https://genmagic.co/developers'));
});
