import type { INodeProperties } from 'n8n-workflow';

import { modelFields } from './shared';

const show = { resource: ['text'], operation: ['generate'] };

export const textOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['text'] } },
		options: [
			{
				name: 'Generate',
				value: 'generate',
				description: 'Write text, code, an SVG or a web page with any text model',
				action: 'Generate text',
			},
		],
		default: 'generate',
	},
];

export const textFields: INodeProperties[] = [
	{
		displayName: 'Prompt',
		name: 'prompt',
		type: 'string',
		typeOptions: { rows: 4 },
		required: true,
		default: '',
		placeholder: 'e.g. Write three subject lines for our spring sale email',
		description: 'What to write or produce',
		displayOptions: { show },
	},
	...modelFields('textModel', show, 'getTextModels', 'text'),
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add option',
		default: {},
		displayOptions: { show },
		options: [
			{
				displayName: 'Instructions',
				name: 'system',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				description: 'Extra guidance for the model, such as a tone, a format or a persona',
			},
			{
				displayName: 'Output Type',
				name: 'type',
				type: 'options',
				options: [
					{ name: 'Code', value: 'code', description: 'Source code' },
					{ name: 'Plain Text', value: 'text', description: 'An answer in plain text' },
					{ name: 'SVG', value: 'svg', description: 'A scalable vector graphic' },
					{ name: 'Web Page', value: 'website', description: 'A complete HTML page' },
					{
						name: 'Writing',
						value: 'writing',
						description: 'Polished prose, such as an article or an email',
					},
				],
				default: 'text',
				description: 'The kind of output to produce',
			},
		],
	},
];
