import type { INodeProperties } from 'n8n-workflow';

import { fileFields, modelFields } from './shared';

const generate = { resource: ['video'], operation: ['generate'] };
const get = { resource: ['video'], operation: ['get'] };

export const videoOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['video'] } },
		options: [
			{
				name: 'Generate',
				value: 'generate',
				description: 'Generate a video clip from a prompt',
				action: 'Generate a video',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a video job by ID, with the clip once it is ready',
				action: 'Get a video',
			},
		],
		default: 'generate',
	},
];

export const videoFields: INodeProperties[] = [
	{
		displayName: 'Prompt',
		name: 'prompt',
		type: 'string',
		typeOptions: { rows: 4 },
		required: true,
		default: '',
		placeholder: 'e.g. A slow dolly shot through a neon-lit night market in the rain',
		description: 'What should happen in the clip',
		displayOptions: { show: generate },
	},
	...modelFields('videoModel', generate, 'getVideoModels', 'text-to-video'),
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add option',
		default: {},
		displayOptions: { show: generate },
		options: [
			{
				displayName: 'Aspect Ratio',
				name: 'aspect_ratio',
				type: 'options',
				options: [
					{ name: 'Landscape (16:9)', value: '16:9' },
					{ name: 'Portrait (9:16)', value: '9:16' },
					{ name: 'Square (1:1)', value: '1:1' },
				],
				default: '16:9',
				description: 'The shape of the clip',
			},
			{
				displayName: 'Duration (Seconds)',
				name: 'duration',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 5,
				description:
					"Clip length. Each model supports its own lengths (listed by Model > Get); leave this out to use the model's default.",
			},
			{
				displayName: 'Generate Audio',
				name: 'generate_audio',
				type: 'boolean',
				default: false,
				description:
					'Whether to add sound to the clip, on models that support it (this can double the price)',
			},
			{
				displayName: 'Resolution',
				name: 'resolution',
				type: 'string',
				default: '',
				placeholder: 'e.g. 720p',
				description: 'Output resolution, on models that offer several (listed by Model > Get)',
			},
		],
	},
	{
		displayName: 'Wait for Completion',
		name: 'waitForCompletion',
		type: 'boolean',
		default: true,
		description:
			'Whether to wait until the clip is rendered. Otherwise the node returns the job ID right away and Video > Get fetches the clip later.',
		displayOptions: { show: generate },
	},
	{
		displayName: 'Max Wait Time (Seconds)',
		name: 'maxWaitTime',
		type: 'number',
		typeOptions: { minValue: 10 },
		default: 300,
		description:
			'How long to wait for the clip. If it is still rendering by then, the node returns the job ID for Video > Get.',
		displayOptions: { show: { ...generate, waitForCompletion: [true] } },
	},
	{
		displayName: 'Video ID',
		name: 'videoId',
		type: 'string',
		required: true,
		default: '',
		description: 'The job ID returned by Video > Generate',
		displayOptions: { show: get },
	},
	...fileFields(generate, { optional: true, extraShow: { waitForCompletion: [true] } }),
	...fileFields(get, { optional: true }),
];
