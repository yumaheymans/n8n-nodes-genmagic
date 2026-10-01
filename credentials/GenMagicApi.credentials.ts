import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class GenMagicApi implements ICredentialType {
	name = 'genMagicApi';

	displayName = 'GenMagic API';

	icon: Icon = {
		light: 'file:../nodes/GenMagic/genmagic.svg',
		dark: 'file:../nodes/GenMagic/genmagic.dark.svg',
	};

	documentationUrl =
		'https://genmagic.co/developers?utm_source=n8n&utm_medium=integration&utm_campaign=agent-platforms';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description:
				'Your GenMagic API key. Create one for free at genmagic.co/developers; generations are billed to your GenMagic balance.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	// Reading the balance spends nothing, so it is a free way to check the key.
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://genmagic.co',
			url: '/api/v1/usage',
			method: 'GET',
		},
	};
}
