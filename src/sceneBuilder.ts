import { generateJsonWithRetry } from "./ollama";
import { buildSystemPrompt, buildUserPrompt } from "./prompts";
import { padFilename, slugifyEnglish } from "./utils";

export interface Scene {
	scene: number;
	title: string;
	image_filename: string;
	prompt: string;
	model: "nano_banana" | "imagen_3_5";
	narration_seconds: number;
	visual_description: string;
	reference_image: string | null;
}

export interface ScenePackage {
	chapter: number;
	title: string;
	scenes: Scene[];
}

export interface BuildOptions {
	ollamaUrl: string;
	model: string;
	imageModel: "nano_banana" | "imagen_3_5";
	chapter: number;
	title: string;
	targetScenes: string;
	narrationSeconds: number;
	manuscript: string;
	onChunk?: (chunkCount: number) => void;
}

export async function buildScenes(
	opts: BuildOptions
): Promise<{ data: ScenePackage; raw: string }> {
	const system = buildSystemPrompt({
		chapter: opts.chapter,
		title: opts.title,
		imageModel: opts.imageModel,
		narrationSeconds: opts.narrationSeconds,
		targetScenes: opts.targetScenes,
		manuscript: opts.manuscript,
	});
	const user = buildUserPrompt(opts.manuscript);

	const { parsed, raw } = await generateJsonWithRetry<Partial<ScenePackage>>({
		ollamaUrl: opts.ollamaUrl,
		model: opts.model,
		system,
		prompt: user,
		onChunk: opts.onChunk,
	});

	const repaired = repairPackage(parsed, opts);
	return { data: repaired, raw };
}

function repairPackage(parsed: Partial<ScenePackage>, opts: BuildOptions): ScenePackage {
	const scenes: unknown[] = Array.isArray(parsed.scenes) ? parsed.scenes : [];
	const repaired: Scene[] = scenes
		.filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
		.map((raw, idx) => repairScene(raw as Partial<Scene>, idx + 1, opts));

	return {
		chapter:
			typeof parsed.chapter === "number" && parsed.chapter > 0
				? parsed.chapter
				: opts.chapter,
		title:
			typeof parsed.title === "string" && parsed.title.trim().length > 0
				? parsed.title.trim()
				: opts.title,
		scenes: repaired,
	};
}

function repairScene(raw: Partial<Scene>, sceneNumber: number, opts: BuildOptions): Scene {
	const title =
		typeof raw.title === "string" && raw.title.trim().length > 0
			? raw.title.trim().slice(0, 40)
			: `씬 ${sceneNumber}`;

	const englishBase =
		typeof raw.image_filename === "string" && /^[a-z0-9_.-]+\.png$/i.test(raw.image_filename)
			? raw.image_filename.replace(/\.png$/i, "").replace(/^ch\d{2}_\d{2}_/, "")
			: (raw.prompt ? slugifyEnglish(raw.prompt.slice(0, 60)) : slugifyEnglish(title));

	const slug = slugifyEnglish(englishBase);
	const image_filename = padFilename(opts.chapter, sceneNumber, slug);

	const promptText =
		typeof raw.prompt === "string" && raw.prompt.trim().length > 0
			? raw.prompt.trim()
			: "Cinematic shot of an Obsidian-themed knowledge workspace, deep purple accent glow, documentary photography style";

	const narration =
		typeof raw.narration_seconds === "number" && raw.narration_seconds > 0
			? Math.min(Math.max(Math.round(raw.narration_seconds), 10), 60)
			: opts.narrationSeconds;

	const visual_description =
		typeof raw.visual_description === "string" ? raw.visual_description.trim() : "";

	return {
		scene: sceneNumber,
		title,
		image_filename,
		prompt: promptText,
		model: opts.imageModel,
		narration_seconds: narration,
		visual_description,
		reference_image: null,
	};
}
