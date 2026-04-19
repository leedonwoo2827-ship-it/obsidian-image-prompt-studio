import { App, normalizePath, TFile, TFolder } from "obsidian";
import type { ScenePackage } from "./sceneBuilder";

export interface ExportResult {
	md: string;
	json: string;
	txt: string;
}

export async function ensureFolder(app: App, folderPath: string): Promise<void> {
	const normalized = normalizePath(folderPath);
	const existing = app.vault.getAbstractFileByPath(normalized);
	if (existing instanceof TFolder) return;
	if (existing) return;
	await app.vault.createFolder(normalized);
}

export async function exportPackage(
	app: App,
	pkg: ScenePackage,
	baseName: string,
	outputFolder: string
): Promise<ExportResult> {
	const folder = normalizePath(outputFolder);
	await ensureFolder(app, folder);

	const mdPath = normalizePath(`${folder}/${baseName}.md`);
	const jsonPath = normalizePath(`${folder}/${baseName}.json`);
	const txtPath = normalizePath(`${folder}/${baseName}.txt`);

	const mdContent = renderMarkdown(pkg);
	const jsonContent = JSON.stringify(pkg, null, 2);
	const txtContent = pkg.scenes.map((s) => s.prompt).join("\n") + "\n";

	await writeOrUpdate(app, mdPath, mdContent);
	await writeOrUpdate(app, jsonPath, jsonContent);
	await writeOrUpdate(app, txtPath, txtContent);

	return { md: mdPath, json: jsonPath, txt: txtPath };
}

export async function writeDebug(
	app: App,
	outputFolder: string,
	baseName: string,
	raw: string
): Promise<string> {
	const debugFolder = normalizePath(`${outputFolder}/_debug`);
	await ensureFolder(app, debugFolder);
	const path = normalizePath(`${debugFolder}/${baseName}.raw.txt`);
	await writeOrUpdate(app, path, raw);
	return path;
}

async function writeOrUpdate(app: App, path: string, content: string): Promise<void> {
	const existing = app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFile) {
		await app.vault.modify(existing, content);
	} else {
		await app.vault.create(path, content);
	}
}

function renderMarkdown(pkg: ScenePackage): string {
	const header = [
		`# ${pkg.title}`,
		"",
		`- 챕터: ${pkg.chapter}`,
		`- 씬 개수: ${pkg.scenes.length}`,
		"",
		"## 씬 시퀀스",
		"",
	];
	const body = pkg.scenes.map((s) => {
		return [
			`### 씬 #${s.scene} — ${s.title}`,
			`- **파일명**: \`${s.image_filename}\``,
			`- **모델**: ${s.model}`,
			`- **나레이션**: ${s.narration_seconds}s`,
			`- **시각 설명**: ${s.visual_description || "-"}`,
			"",
			"**Image prompt (EN):**",
			"",
			s.prompt,
			"",
		].join("\n");
	});
	return header.concat(body).join("\n");
}
