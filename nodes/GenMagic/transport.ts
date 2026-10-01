/**
 * The one way this node talks to GenMagic's public REST API (https://genmagic.co/openapi.json).
 *
 * Every call authenticates with the user's GenMagic credential (a Bearer API key), names
 * this integration in the X-GenMagic-Client header so the key owner's usage through n8n
 * can be told apart from their other API use, and turns GenMagic's OpenAI-style error
 * body ({ error: { message, code } }) into one clear NodeApiError. Generations report
 * what they cost and what is left in the X-Cost-Cents and X-Credits-Remaining headers.
 */
import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IN8nHttpFullResponse,
	INode,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

export const BASE_URL = 'https://genmagic.co';

/** This package's version, sent as X-GenMagic-Client. Keep it in step with package.json. */
export const PACKAGE_VERSION = '0.1.0';

const UTM = 'utm_source=n8n&utm_medium=integration&utm_campaign=agent-platforms';
const KEYS_URL = `${BASE_URL}/developers?${UTM}`;
const PRICING_URL = `${BASE_URL}/pricing?${UTM}`;
const VERIFY_URL = `${BASE_URL}/verify-email`;

/** Hosts GenMagic serves generated files from. Files are downloaded only from these. */
const MEDIA_HOSTS = ['genmagic.co', 'tlwdqzfibvgektzgdfqa.supabase.co'];

type Context = IExecuteFunctions | ILoadOptionsFunctions;

export interface GenMagicResponse {
	body: unknown;
	headers: IDataObject;
}

export interface RequestOptions {
	body?: IDataObject;
	qs?: IDataObject;
	/** The response is a file (speech, music) rather than JSON. */
	expectFile?: boolean;
	/** Milliseconds. Generations can take a while, so the default is generous. */
	timeout?: number;
	itemIndex?: number;
}

export async function genMagicRequest(
	this: Context,
	method: IHttpRequestMethods,
	path: string,
	{ body, qs, expectFile = false, timeout = 180_000, itemIndex }: RequestOptions = {},
): Promise<GenMagicResponse> {
	const options: IHttpRequestOptions = {
		method,
		url: `${BASE_URL}${path}`,
		headers: {
			Accept: expectFile ? 'audio/*, application/json' : 'application/json',
			'X-GenMagic-Client': `n8n-node/${PACKAGE_VERSION}`,
		},
		qs,
		body,
		encoding: expectFile ? 'arraybuffer' : 'json',
		returnFullResponse: true,
		// Read GenMagic's own error body instead of n8n's generic HTTP error.
		ignoreHttpStatusErrors: true,
		timeout,
	};
	const response = (await this.helpers.httpRequestWithAuthentication.call(
		this,
		'genMagicApi',
		options,
	)) as IN8nHttpFullResponse;
	if (response.statusCode >= 400) {
		throw apiError(this.getNode(), response.statusCode, response.body, itemIndex);
	}
	return { body: response.body, headers: response.headers ?? {} };
}

/** GenMagic's error envelope, from a parsed JSON body or the raw bytes of a file request. */
function errorBody(body: unknown): { code: string; message: string } {
	let data: unknown = body;
	if (Buffer.isBuffer(data) || data instanceof ArrayBuffer) {
		const text = Buffer.from(data as Buffer).toString('utf8');
		try {
			data = JSON.parse(text);
		} catch {
			return { code: '', message: text.slice(0, 300) };
		}
	} else if (typeof data === 'string') {
		const text = data;
		try {
			data = JSON.parse(text);
		} catch {
			return { code: '', message: text.slice(0, 300) };
		}
	}
	const error = (data as { error?: unknown } | null)?.error;
	if (error && typeof error === 'object') {
		const { code, message } = error as { code?: unknown; message?: unknown };
		return {
			code: typeof code === 'string' ? code : '',
			message: typeof message === 'string' ? message : '',
		};
	}
	return { code: '', message: '' };
}

export function apiError(
	node: INode,
	status: number,
	body: unknown,
	itemIndex?: number,
): NodeApiError {
	const { code, message: detail } = errorBody(body);
	const said = detail || `HTTP ${status}`;
	let message = `GenMagic error: ${said}`;
	let description = code ? `GenMagic error code: ${code}` : undefined;

	if (status === 401) {
		message = 'GenMagic rejected the API key';
		description = `${said}. Check the key in your GenMagic credential, or create a new one at ${KEYS_URL}`;
	} else if (code === 'email_verification_required') {
		message = 'Verify the email address of your GenMagic account first';
		description = `${said}. Open ${VERIFY_URL}, then run the node again.`;
	} else if (status === 402) {
		message = 'Your GenMagic balance is too low for this generation';
		description = `${said}. Add credits at ${PRICING_URL}`;
	} else if (status === 429) {
		message = 'GenMagic rate limit reached';
		description = `${said}. Wait a moment, then run the node again.`;
	} else if (status >= 500) {
		message = 'GenMagic could not complete the request';
		description = `${said}. Nothing is billed for a failed generation. Try again shortly.`;
	}

	return new NodeApiError(node, { code: code || String(status), message: said } as JsonObject, {
		message,
		description,
		httpCode: String(status),
		itemIndex,
	});
}

/** What a call cost and what is left, in US dollars, from GenMagic's metering headers. */
export function metering(headers: IDataObject): IDataObject {
	const usd = (name: string): number | undefined => {
		const raw = headers[name] ?? headers[name.toLowerCase()];
		const cents = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : NaN;
		return Number.isFinite(cents) ? Math.round(cents * 10_000) / 1_000_000 : undefined;
	};
	const out: IDataObject = {};
	const cost = usd('X-Cost-Cents');
	const balance = usd('X-Credits-Remaining');
	if (cost !== undefined) out.cost_usd = cost;
	if (balance !== undefined) out.balance_usd = balance;
	return out;
}

export function header(headers: IDataObject, name: string): string | undefined {
	const value = headers[name] ?? headers[name.toLowerCase()];
	return typeof value === 'string' && value ? value : undefined;
}

export function mimeType(contentType: string | undefined, fallback: string): string {
	const mime = (contentType ?? '').split(';')[0].trim().toLowerCase();
	return mime || fallback;
}

const EXTENSIONS: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/webp': 'webp',
	'image/gif': 'gif',
	'image/svg+xml': 'svg',
	'audio/mpeg': 'mp3',
	'audio/mp3': 'mp3',
	'audio/wav': 'wav',
	'audio/x-wav': 'wav',
	'audio/ogg': 'ogg',
	'audio/aac': 'aac',
	'audio/flac': 'flac',
	'video/mp4': 'mp4',
	'video/webm': 'webm',
	'video/quicktime': 'mov',
};

export function fileName(stem: string, mime: string): string {
	return `${stem}.${EXTENSIONS[mime] ?? 'bin'}`;
}

export interface DownloadedFile {
	data: Buffer;
	mimeType: string;
}

/**
 * The bytes of a generated file, or the reason they could not be fetched.
 *
 * A data URL is decoded in place. An https URL is downloaded only from GenMagic's own
 * media hosts, never from an arbitrary address a response might carry.
 */
export async function downloadFile(
	this: IExecuteFunctions,
	url: string,
): Promise<DownloadedFile | { error: string }> {
	if (url.startsWith('data:')) {
		const match = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(url);
		if (!match || !match[2]) return { error: 'the file is not a base64 data URL' };
		return {
			data: Buffer.from(match[3], 'base64'),
			mimeType: match[1] || 'application/octet-stream',
		};
	}

	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return { error: 'the file URL is not valid' };
	}
	if (parsed.protocol !== 'https:' || !MEDIA_HOSTS.includes(parsed.hostname)) {
		return { error: `files are only downloaded from GenMagic's own hosts, not ${parsed.hostname}` };
	}

	const response = (await this.helpers.httpRequest({
		method: 'GET',
		url,
		encoding: 'arraybuffer',
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
		timeout: 300_000,
	})) as IN8nHttpFullResponse;
	if (response.statusCode !== 200) {
		return { error: `downloading the file returned HTTP ${response.statusCode}` };
	}
	return {
		data: Buffer.from(response.body as Buffer),
		mimeType: mimeType(header(response.headers ?? {}, 'content-type'), 'application/octet-stream'),
	};
}
