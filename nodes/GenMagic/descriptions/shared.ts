import type { INodeProperties } from 'n8n-workflow';

import { AUTO_MODEL } from '../models';

const EXPRESSION_HINT =
	'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>';

/** The name of one operation's model parameter (node version 2 and later). */
export type ModelParameter = 'imageModel' | 'videoModel' | 'speechModel' | 'musicModel' | 'textModel';

/**
 * The model dropdown for one resource/operation, listing GenMagic's live catalog.
 *
 * Node version 1 used ONE parameter, `model`, for every resource. n8n keeps a parameter's
 * value when only its displayOptions change and cannot check it against a dynamic list, so
 * switching a node from Image to Audio kept the image model as the speech model. From
 * version 2 each operation has its own parameter; version 1 keeps `model`, so a workflow
 * saved with 0.1.x runs exactly as before.
 */
export function modelFields(
	name: ModelParameter,
	show: { resource: string[]; operation: string[] },
	loadOptionsMethod: string,
	what: string,
): INodeProperties[] {
	const field = {
		displayName: 'Model Name or ID',
		type: 'options' as const,
		typeOptions: { loadOptionsMethod },
		default: AUTO_MODEL,
		description: `The ${what} model to use, with its GenMagic price. Auto lets GenMagic pick. ${EXPRESSION_HINT}.`,
	};
	return [
		{ ...field, name: 'model', displayOptions: { show: { ...show, '@version': [1] } } },
		{ ...field, name, displayOptions: { show: { ...show, '@version': [2] } } },
	];
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
