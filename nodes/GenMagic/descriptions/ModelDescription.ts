import type { INodeProperties } from 'n8n-workflow';

const getAll = { resource: ['model'], operation: ['getAll'] };
const get = { resource: ['model'], operation: ['get'] };

export const modelOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['model'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get one model with its capabilities and pricing',
				action: 'Get a model',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many models with their capabilities and pricing',
				action: 'Get many models',
			},
		],
		default: 'getAll',
	},
];

export const modelFields: INodeProperties[] = [
	{
		displayName: 'Model ID',
		name: 'modelId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. google/veo-3.1',
		description: 'The model ID, as listed by Model > Get Many',
		displayOptions: { show: get },
	},
	{
		displayName: 'Category',
		name: 'category',
		type: 'options',
		options: [
			{ name: 'All', value: 'all' },
			{ name: 'Audio', value: 'audio' },
			{ name: 'Image', value: 'image' },
			{ name: 'Text', value: 'text' },
			{ name: 'Video', value: 'video' },
		],
		default: 'all',
		description: 'The kind of output the models make',
		displayOptions: { show: getAll },
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show: getAll },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: { show: { ...getAll, returnAll: [false] } },
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: getAll },
		options: [
			{
				displayName: 'Capability',
				name: 'capability',
				type: 'options',
				options: [
					{ name: 'Reasoning', value: 'reasoning' },
					{ name: 'Structured Output', value: 'structured' },
					{ name: 'Tool Use', value: 'tools' },
					{ name: 'Vision', value: 'vision' },
				],
				default: 'vision',
				description: 'Only text models with this capability',
			},
			{
				displayName: 'Search',
				name: 'search',
				type: 'string',
				default: '',
				placeholder: 'e.g. veo',
				description: 'Only models whose ID or name contains this text',
			},
		],
	},
];
