import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type ImagePromptPlugin from "./main";
import { checkServer } from "./ollama";

export interface ImagePromptSettings {
	ollamaUrl: string;
	model: string;
	imageModel: "nano_banana" | "imagen_3_5";
	defaultChapter: number;
	outputFolder: string;
	targetScenes: string;
	narrationSeconds: number;
}

export const DEFAULT_SETTINGS: ImagePromptSettings = {
	ollamaUrl: "http://localhost:11434",
	model: "gemma4:e4b",
	imageModel: "nano_banana",
	defaultChapter: 1,
	outputFolder: "ImagePrompts",
	targetScenes: "auto",
	narrationSeconds: 25,
};

export class ImagePromptSettingTab extends PluginSettingTab {
	plugin: ImagePromptPlugin;

	constructor(app: App, plugin: ImagePromptPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "이미지 프롬프트 옵시디안 설정" });

		new Setting(containerEl)
			.setName("Ollama 서버 URL")
			.setDesc("기본값: http://localhost:11434")
			.addText((text) =>
				text
					.setPlaceholder("http://localhost:11434")
					.setValue(this.plugin.settings.ollamaUrl)
					.onChange(async (value) => {
						this.plugin.settings.ollamaUrl = value.trim() || DEFAULT_SETTINGS.ollamaUrl;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Ollama 모델")
			.setDesc("gemma4:e4b (권장) 또는 gemma4:e2b (경량)")
			.addDropdown((dd) =>
				dd
					.addOption("gemma4:e4b", "gemma4:e4b (권장)")
					.addOption("gemma4:e2b", "gemma4:e2b (경량)")
					.setValue(this.plugin.settings.model)
					.onChange(async (value) => {
						this.plugin.settings.model = value;
						await this.plugin.saveSettings();
					})
			)
			.addButton((btn) =>
				btn
					.setButtonText("Ollama 연결 테스트")
					.setCta()
					.onClick(async () => {
						btn.setDisabled(true);
						try {
							const models = await checkServer(this.plugin.settings.ollamaUrl);
							const has = models.some(
								(m) => m === this.plugin.settings.model || m.startsWith(this.plugin.settings.model + ":")
							);
							if (has) {
								new Notice(`✓ Ollama 연결 성공 · 모델 ${this.plugin.settings.model} 확인`);
							} else {
								new Notice(
									`⚠ Ollama는 연결됐지만 모델 '${this.plugin.settings.model}'이 없습니다. 'ollama pull ${this.plugin.settings.model}' 실행하세요.`,
									10000
								);
							}
						} catch (e) {
							new Notice(`❌ Ollama 연결 실패: ${(e as Error).message}`, 10000);
						} finally {
							btn.setDisabled(false);
						}
					})
			);

		new Setting(containerEl)
			.setName("FlowGenie 이미지 모델")
			.setDesc("생성되는 JSON의 각 scene에 기록되는 이미지 모델 키")
			.addDropdown((dd) =>
				dd
					.addOption("nano_banana", "nano_banana")
					.addOption("imagen_3_5", "imagen_3_5")
					.setValue(this.plugin.settings.imageModel)
					.onChange(async (value) => {
						this.plugin.settings.imageModel = value as "nano_banana" | "imagen_3_5";
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("기본 챕터 번호")
			.addText((text) =>
				text
					.setValue(String(this.plugin.settings.defaultChapter))
					.onChange(async (value) => {
						const n = parseInt(value, 10);
						if (!isNaN(n) && n > 0) {
							this.plugin.settings.defaultChapter = n;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("출력 폴더 (Vault 내 경로)")
			.setDesc("생성된 JSON/TXT/MD가 저장되는 Vault 내 상대경로")
			.addText((text) =>
				text
					.setPlaceholder("ImagePrompts")
					.setValue(this.plugin.settings.outputFolder)
					.onChange(async (value) => {
						this.plugin.settings.outputFolder = value.trim() || "ImagePrompts";
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("목표 씬 개수")
			.setDesc("'auto' 또는 숫자. auto는 원고 분량에 따라 5–10개 자동.")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.targetScenes)
					.onChange(async (value) => {
						this.plugin.settings.targetScenes = value.trim() || "auto";
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("씬당 나레이션 기본 초")
			.addText((text) =>
				text
					.setValue(String(this.plugin.settings.narrationSeconds))
					.onChange(async (value) => {
						const n = parseInt(value, 10);
						if (!isNaN(n) && n > 0) {
							this.plugin.settings.narrationSeconds = n;
							await this.plugin.saveSettings();
						}
					})
			);

		containerEl.createEl("h3", { text: "트러블슈팅" });
		const tips = containerEl.createEl("ul");
		tips.createEl("li", { text: "[T1] 연결 실패 → 작업표시줄 Ollama 재시작 / 보안 프로그램 예외 등록" });
		tips.createEl("li", { text: "[T2] 모델 없음 → cmd에서 'ollama pull gemma4:e4b'" });
		tips.createEl("li", { text: "[T3] JSON 파싱 실패 → 자동 재시도 1회. 여전히 실패시 출력폴더/_debug/ 확인" });
		tips.createEl("li", { text: "[T4] 한글 깨짐 → 원고를 UTF-8로 저장" });
		tips.createEl("li", { text: "[T5] 원고가 너무 김 → 목표 씬을 줄이거나 원고를 분할" });
	}
}
