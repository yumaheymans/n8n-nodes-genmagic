import type { INodeProperties } from 'n8n-workflow';

import { AUTO_MODEL } from '../models';

const EXPRESSION_HINT =
	'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>';

/** The model dropdown for one resource/operation, listing GenMagic's live catalog. */
export function modelField(
	show: { resource: string[]; operation: string[] },
	loadOptionsMethod: string,
	what: string,
): INodeProperties {
	return {
		displayName: 'Model Name or ID',
		name: 'model',
		type: 'options',
		typeOptions: { loadOptionsMethod },
		default: AUTO_MODEL,
		description: `The ${what} model to use, with its GenMagic price. Auto lets GenMagic pick. ${EXPRESSION_HINT}.`,
		displayOptions: { show },
	};
}

/** Whether to add the generated file to the item as binary data, and where. */
export function fileFields(
	show: { resource: string[]; operation: string[] },
	{ optional, extraShow = {} }: { optional: boolean; extraShow?: Record<string, boolean[]> },
): INodeProperties[] {
	const fields: INodeProperties[] = [];
	if (optional) {
		fields.push({
			displayName: 'Download File',
			name: 'downloadFile',
			type: 'boolean',
			default: true,
			description:
				'Whether to add the generated file to the output as binary data, ready for nodes that upload or send files. Its URL is always returned.',
			displayOptions: { show: { ...show, ...extraShow } },
		});
	}
	fields.push({
		displayName: 'Put Output File in Field',
		name: 'binaryPropertyName',
		type: 'string',
		default: 'data',
		required: true,
		hint: 'The name of the output binary field to put the file in',
		displayOptions: {
			show: optional ? { ...show, ...extraShow, downloadFile: [true] } : { ...show, ...extraShow },
		},
	});
	return fields;
}
