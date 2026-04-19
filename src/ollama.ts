import { requestUrl } from "obsidian";
import * as http from "http";

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
	onChunk?: (chunkCount: number) => void;
}

export async function generateJson<T = unknown>(
	opts: OllamaGenerateOptions
): Promise<{ parsed: T; raw: string }> {
	const body = JSON.stringify({
		model: opts.model,
		system: opts.system,
		prompt: opts.prompt,
		format: "json",
		stream: true,
		options: {
			temperature: opts.temperature ?? 0.7,
			num_ctx: opts.numCtx ?? 8192,
		},
	});

	const url = new URL(opts.ollamaUrl.replace(/\/$/, "") + "/api/generate");
	const raw = await streamHttpNdjson(url, body, opts.onChunk);

	try {
		return { parsed: JSON.parse(raw) as T, raw };
	} catch (e) {
		const err = new Error(`JSON 파싱 실패: ${(e as Error).message}`) as Error & { raw: string };
		err.raw = raw;
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

function streamHttpNdjson(
	url: URL,
	body: string,
	onChunk?: (chunkCount: number) => void
): Promise<string> {
	return new Promise((resolve, reject) => {
		const req = http.request(
			{
				hostname: url.hostname,
				port: url.port || "11434",
				path: url.pathname + url.search,
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Content-Length": Buffer.byteLength(body),
				},
			},
			(res) => {
				if (res.statusCode !== 200) {
					let errBody = "";
					res.on("data", (d) => {
						errBody += d.toString("utf-8");
					});
					res.on("end", () => reject(new Error(`Ollama HTTP ${res.statusCode}: ${errBody.slice(0, 200)}`)));
					return;
				}

				let buffer = "";
				let accumulated = "";
				let chunkCount = 0;
				let lastEmit = 0;

				res.setEncoding("utf-8");
				res.on("data", (data: string) => {
					buffer += data;
					const lines = buffer.split("\n");
					buffer = lines.pop() ?? "";
					for (const line of lines) {
						const trimmed = line.trim();
						if (!trimmed) continue;
						try {
							const obj = JSON.parse(trimmed) as {
								response?: string;
								done?: boolean;
								error?: string;
							};
							if (obj.error) {
								reject(new Error(`Ollama error: ${obj.error}`));
								return;
							}
							if (typeof obj.response === "string") {
								accumulated += obj.response;
								chunkCount++;
								const now = Date.now();
								if (onChunk && now - lastEmit > 120) {
									onChunk(chunkCount);
									lastEmit = now;
								}
							}
						} catch {
							// ignore malformed partial line
						}
					}
				});

				res.on("end", () => {
					if (buffer.trim()) {
						try {
							const obj = JSON.parse(buffer) as { response?: string };
							if (typeof obj.response === "string") accumulated += obj.response;
						} catch {
							// ignore
						}
					}
					if (onChunk) onChunk(chunkCount);
					resolve(accumulated);
				});

				res.on("error", (err) => reject(err));
			}
		);

		req.on("error", (err) => reject(err));
		req.setTimeout(600000, () => {
			req.destroy(new Error("Ollama 응답 시간 초과(10분)"));
		});
		req.write(body);
		req.end();
	});
}
