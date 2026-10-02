import type { INodeProperties } from 'n8n-workflow';

import { fileFields, modelFields } from './shared';

const speech = { resource: ['audio'], operation: ['generateSpeech'] };
const music = { resource: ['audio'], operation: ['generateMusic'] };

export const audioOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['audio'] } },
		options: [
			{
				name: 'Generate Music',
				value: 'generateMusic',
				description: 'Generate an original music track from a description',
				action: 'Generate music',
			},
			{
				name: 'Generate Speech',
				value: 'generateSpeech',
				description: 'Turn text into spoken audio',
				action: 'Generate speech from text',
			},
		],
		default: 'generateSpeech',
	},
];

export const audioFields: INodeProperties[] = [
	{
		displayName: 'Text',
		name: 'input',
		type: 'string',
		typeOptions: { rows: 4 },
		required: true,
		default: '',
		description: 'The text to speak',
		displayOptions: { show: speech },
	},
	...modelFields('speechModel', speech, 'getSpeechModels', 'text-to-speech'),
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add option',
		default: {},
		displayOptions: { show: speech },
		options: [
			{
				displayName: 'Voice',
				name: 'voice',
				type: 'string',
				default: '',
				placeholder: 'e.g. alloy',
				description: 'The voice to use, on models that offer several (listed by Model > Get)',
			},
		],
	},
	...fileFields(speech, { optional: false }),
	{
		displayName: 'Prompt',
		name: 'prompt',
		type: 'string',
		typeOptions: { rows: 4 },
		required: true,
		default: '',
		placeholder: 'e.g. Upbeat lo-fi hip hop with warm piano and vinyl crackle, 85 BPM',
		description: 'Genre, mood, instruments and tempo of the track',
		displayOptions: { show: music },
	},
	...modelFields('musicModel', music, 'getMusicModels', 'music'),
	...fileFields(music, { optional: false }),
];
