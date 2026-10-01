import type { INodeProperties } from 'n8n-workflow';

import { fileFields, modelField } from './shared';

const show = { resource: ['image'], operation: ['generate'] };

export const imageOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['image'] } },
		options: [
			{
				name: 'Generate',
				value: 'generate',
				description: 'Generate an image from a prompt, or edit a reference image',
				action: 'Generate an image',
			},
		],
		default: 'generate',
	},
];

export const imageFields: INodeProperties[] = [
	{
		displayName: 'Prompt',
		name: 'prompt',
		type: 'string',
		typeOptions: { rows: 4 },
		required: true,
		default: '',
		placeholder:
			'e.g. A product photo of a glass perfume bottle on wet black stone, soft rim light',
		description:
			'What the image should show, or the change to make when a reference image is given',
		displayOptions: { show },
	},
	modelField(show, 'getImageModels', 'image'),
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add option',
		default: {},
		displayOptions: { show },
		options: [
			{
				displayName: 'Image Type',
				name: 'type',
				type: 'options',
				options: [
					{ name: 'Image', value: 'image', description: 'A picture' },
					{ name: 'Logo', value: 'logo', description: 'A clean, simple brand mark' },
				],
				default: 'image',
				description: 'Whether to make a picture or steer the model toward a logo',
			},
			{
				displayName: 'Number of Images',
				name: 'n',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 4 },
				default: 1,
				description: 'How many images to generate (each is returned as its own item)',
			},
			{
				displayName: 'Reference Image (Binary Field)',
				name: 'referenceImageField',
				type: 'string',
				default: '',
				placeholder: 'e.g. data',
				description:
					'The input binary field holding an image to edit or restyle (PNG, JPEG or WebP, up to 10 MB)',
			},
			{
				displayName: 'Reference Image URL',
				name: 'referenceImageUrl',
				type: 'string',
				default: '',
				placeholder: 'e.g. https://example.com/photo.jpg',
				description: 'An https URL of an image to edit or restyle',
			},
			{
				displayName: 'Size',
				name: 'size',
				type: 'options',
				options: [
					{ name: 'Landscape (1792x1024)', value: '1792x1024' },
					{ name: 'Portrait (1024x1792)', value: '1024x1792' },
					{ name: 'Square (1024x1024)', value: '1024x1024' },
				],
				default: '1024x1024',
				description: 'The shape of the image',
			},
		],
	},
	...fileFields(show, { optional: true }),
];
