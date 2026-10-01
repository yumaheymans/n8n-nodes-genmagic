/**
 * The model dropdowns. Each lists GenMagic's live catalog for one kind of output
 * (GET /api/v1/models?category=...), newest first, with the price GenMagic itself
 * publishes for that model, so a new model appears here on its own. Reading the
 * catalog spends no credits.
 */
import type { IDataObject, ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';

import { genMagicRequest } from './transport';

/** The model value that lets GenMagic choose (the request then omits `model`). */
export const AUTO_MODEL = 'auto';

export interface CatalogModel extends IDataObject {
	id: string;
	name?: string;
	created?: number;
	category?: string;
	audio_kind?: string;
	capabilities?: IDataObject;
	pricing?: IDataObject;
}

type Category = 'text' | 'image' | 'audio' | 'video';

async function catalog(this: ILoadOptionsFunctions, category: Category): Promise<CatalogModel[]> {
	const { body } = await genMagicRequest.call(this, 'GET', '/api/v1/models', {
		qs: { category },
		timeout: 30_000,
	});
	const data = (body as { data?: unknown } | null)?.data;
	return (Array.isArray(data) ? data : []).filter(
		(m): m is CatalogModel =>
			typeof m === 'object' && m !== null && typeof (m as CatalogModel).id === 'string',
	);
}

function money(value: number): string {
	return value >= 1 ? value.toFixed(2) : String(Number(value.toPrecision(3)));
}

/** A short price for the dropdown, from the catalog's own pricing (never estimated here). */
export function priceLabel(model: CatalogModel): string | undefined {
	const pricing = model.pricing ?? {};
	const unit = pricing.unit;
	if (unit === 'token') {
		const prompt = pricing.prompt_usd_per_million;
		const completion = pricing.completion_usd_per_million;
		if (typeof prompt === 'number' && typeof completion === 'number') {
			return prompt === 0 && completion === 0
				? 'free'
				: `$${money(prompt)} in / $${money(completion)} out per 1M tokens`;
		}
		return undefined;
	}
	const usd = pricing.usd_per_unit;
	if (typeof usd === 'number' && typeof unit === 'string') return `$${money(usd)}/${unit}`;
	return undefined;
}

/** Whether a video model can make a clip from a text prompt (the only input this node sends). */
export function makesVideoFromPrompt(model: CatalogModel): boolean {
	return model.capabilities?.text_to_video !== false;
}

export function toOptions(models: CatalogModel[], autoDescription: string): INodePropertyOptions[] {
	const sorted = [...models].sort(
		(a, b) =>
			(b.created ?? 0) - (a.created ?? 0) ||
			String(a.name ?? a.id).localeCompare(String(b.name ?? b.id)),
	);
	return [
		{ name: 'Auto (GenMagic Picks the Model)', value: AUTO_MODEL, description: autoDescription },
		...sorted.map((m) => {
			const price = priceLabel(m);
			const name = String(m.name ?? m.id);
			return { name: price ? `${name} (${price})` : name, value: m.id, description: m.id };
		}),
	];
}

export async function getTextModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const models = await catalog.call(this, 'text');
	return toOptions(models, 'A capable, well-priced default for the output type');
}

export async function getImageModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const models = await catalog.call(this, 'image');
	return toOptions(models, 'The recommended image model');
}

export async function getVideoModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const models = (await catalog.call(this, 'video')).filter(makesVideoFromPrompt);
	return toOptions(models, 'The recommended text-to-video model');
}

export async function getSpeechModels(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const models = (await catalog.call(this, 'audio')).filter(
		(m) => m.audio_kind === undefined || m.audio_kind === 'speech',
	);
	return toOptions(models, 'The recommended text-to-speech model');
}

export async function getMusicModels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const models = (await catalog.call(this, 'audio')).filter(
		(m) => m.audio_kind === undefined || m.audio_kind === 'music',
	);
	return toOptions(models, 'The recommended music model');
}
