import { requestUrl } from "obsidian";

export async function checkServer(ollamaUrl: string): Promise<string[]> {
	const res = await requestUrl({
		url: `${ollamaUrl.replace(/\/$/, "")}/api/tags`,
		method: "GET",
		throw: false,
	});
	if (res.status !== 200) {
		throw new Error(`HTTP ${res.status}`);
	}
	const data = res.json as { models?: Array<{ name: string }> };
	return (data.models ?? []).map((m) => m.name);
}

export interface OllamaGenerateOptions {
	ollamaUrl: string;
	model: string;
	system: string;
	prompt: string;
	temperature?: number;
	numCtx?: number;
}

export async function generateJson<T = unknown>(
	opts: OllamaGenerateOptions
): Promise<{ parsed: T; raw: string }> {
	const body = {
		model: opts.model,
		system: opts.system,
		prompt: opts.prompt,
		format: "json",
		stream: false,
		options: {
			temperature: opts.temperature ?? 0.7,
			num_ctx: opts.numCtx ?? 8192,
		},
	};

	const res = await requestUrl({
		url: `${opts.ollamaUrl.replace(/\/$/, "")}/api/generate`,
		method: "POST",
		contentType: "application/json",
		body: JSON.stringify(body),
		throw: false,
	});

	if (res.status !== 200) {
		throw new Error(`Ollama HTTP ${res.status}: ${res.text.slice(0, 200)}`);
	}

	const payload = res.json as { response?: string };
	const raw = payload.response ?? "";
	try {
		return { parsed: JSON.parse(raw) as T, raw };
	} catch (e) {
		const err = new Error(`JSON 파싱 실패: ${(e as Error).message}`);
		(err as Error & { raw: string }).raw = raw;
		throw err;
	}
}

export async function generateJsonWithRetry<T = unknown>(
	opts: OllamaGenerateOptions
): Promise<{ parsed: T; raw: string }> {
	try {
		return await generateJson<T>(opts);
	} catch (e) {
		const err = e as Error & { raw?: string };
		if (!err.message.startsWith("JSON 파싱 실패")) throw e;
		return await generateJson<T>({ ...opts, temperature: 0.3 });
	}
}
