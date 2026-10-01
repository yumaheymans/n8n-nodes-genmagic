import type { INodeProperties } from 'n8n-workflow';

export const accountOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['account'] } },
		options: [
			{
				name: 'Get Balance',
				value: 'getBalance',
				description: 'Get the credit balance and total spend of the API key',
				action: 'Get the account balance',
			},
		],
		default: 'getBalance',
	},
];
