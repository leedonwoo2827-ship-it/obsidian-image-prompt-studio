export const OBSIDIAN_VISUAL_STYLE = [
	"deep purple (#7C3AED) accent lighting",
	"volcanic obsidian glass textures",
	"interconnected glowing notes and a graph-view metaphor",
	"modern knowledge-management editorial mood",
	"clean typographic overlays when relevant",
].join(", ");

export const FEW_SHOT_SCENE = {
	scene: 1,
	title: "도입: 올인원 워크스페이스의 필요성",
	image_filename: "ch01_01_all_in_one_workspace.png",
	prompt:
		"Cinematic shot of a beautifully organized digital workspace, Obsidian interface glowing softly, shallow depth of field, natural desk lighting, deep purple accent glow, focus on structure and order, documentary photography style",
	model: "nano_banana",
	narration_seconds: 25,
	visual_description: "깔끔한 데스크 위 Obsidian 화면을 강조",
	reference_image: null,
};

export interface PromptTemplateVars {
	chapter: number;
	title: string;
	imageModel: "nano_banana" | "imagen_3_5";
	narrationSeconds: number;
	targetScenes: string;
	manuscript: string;
}

function sceneInstruction(targetScenes: string): string {
	if (targetScenes === "auto" || targetScenes === "") {
		return "원고 분량에 맞게 5개에서 10개 사이의 scene으로 분할하십시오.";
	}
	const n = parseInt(targetScenes, 10);
	if (!isNaN(n) && n > 0) {
		return `정확히 ${n}개의 scene으로 분할하십시오.`;
	}
	return "원고 분량에 맞게 5개에서 10개 사이의 scene으로 분할하십시오.";
}

export function buildSystemPrompt(vars: PromptTemplateVars): string {
	return [
		"You are an image-scene designer for Obsidian-themed educational content.",
		"Read the Korean manuscript provided and split it into a clear scene sequence for a video or image batch.",
		"",
		"Return ONE valid JSON object that matches this schema EXACTLY:",
		"{",
		'  "chapter": <integer>,',
		'  "title": <string>,',
		'  "scenes": [',
		"    {",
		'      "scene": <integer starting at 1>,',
		'      "title": <Korean scene title, up to 20 chars>,',
		'      "image_filename": "ch{CH:02d}_{SC:02d}_<english_lowercase_slug>.png",',
		'      "prompt": <ENGLISH image prompt, 40-120 words, cinematic camera + lighting + mood + style>,',
		`      "model": "${vars.imageModel}",`,
		'      "narration_seconds": <integer 15-35>,',
		'      "visual_description": <Korean one-sentence summary>,',
		'      "reference_image": null',
		"    }",
		"  ]",
		"}",
		"",
		`Fixed values: chapter = ${vars.chapter}, title = "${vars.title}".`,
		sceneInstruction(vars.targetScenes),
		`Default narration_seconds around ${vars.narrationSeconds}.`,
		"",
		"Style guidance for the English 'prompt' field — weave in where thematically fitting:",
		`  ${OBSIDIAN_VISUAL_STYLE}`,
		"",
		"Example of a single high-quality scene entry:",
		JSON.stringify(FEW_SHOT_SCENE, null, 2),
		"",
		"Hard rules:",
		"- The 'prompt' field MUST be English only.",
		"- 'title' and 'visual_description' stay Korean.",
		"- 'image_filename' slug is lowercase ASCII letters/digits/underscores only.",
		"- Never wrap JSON in markdown code fences.",
		"- Return the JSON object directly, nothing else.",
	].join("\n");
}

export function buildUserPrompt(manuscript: string): string {
	return `다음 원고를 scene 단위로 분할해 위 스키마의 JSON을 생성하세요:\n\n${manuscript}`;
}
