import {
	App,
	Notice,
	Plugin,
	TFile,
	WorkspaceLeaf,
	FuzzySuggestModal,
} from "obsidian";
import { BRANDING } from "./branding";
import {
	DEFAULT_SETTINGS,
	ImagePromptSettings,
	ImagePromptSettingTab,
} from "./settings";
import { Store, HistoryItem } from "./store";
import { ImagePromptView } from "./view";
import { buildScenes } from "./sceneBuilder";
import { exportPackage, writeDebug } from "./exporter";
import { checkServer } from "./ollama";
import { estimateTokens, extractH1Title, formatTimestamp, slugifyEnglish } from "./utils";

export default class ImagePromptPlugin extends Plugin {
	settings: ImagePromptSettings = DEFAULT_SETTINGS;
	store: Store = new Store();

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerView(BRANDING.viewType, (leaf) => new ImagePromptView(leaf, this.store, {
			runActive: () => this.runActiveFile(),
			openPicker: () => this.openFilePicker(),
		}));

		this.addRibbonIcon(BRANDING.ribbonIcon, BRANDING.ribbonTooltip, async () => {
			await this.activateView();
		});

		this.addCommand({
			id: "open-sidebar",
			name: "사이드바 열기",
			callback: async () => {
				await this.activateView();
			},
		});

		this.addCommand({
			id: "generate-from-active-note",
			name: "이미지 프롬프트 생성 (현재 노트)",
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!file || file.extension !== "md") return false;
				if (!checking) {
					void this.runGeneration(file);
				}
				return true;
			},
		});

		this.addCommand({
			id: "generate-from-picked-note",
			name: "이미지 프롬프트 생성 (파일 선택)",
			callback: () => this.openFilePicker(),
		});

		this.addSettingTab(new ImagePromptSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => {
			void this.activateView();
		});
	}

	onunload(): void {
		this.store.clearInProgress();
	}

	async loadSettings(): Promise<void> {
		const data = (await this.loadData()) as
			| { settings?: Partial<ImagePromptSettings>; history?: HistoryItem[] }
			| null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data?.settings ?? {});
		if (Array.isArray(data?.history)) {
			this.store.setHistory(data!.history!);
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData({
			settings: this.settings,
			history: this.store.getState().history,
		});
	}

	async saveHistory(): Promise<void> {
		await this.saveSettings();
	}

	async activateView(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(BRANDING.viewType);
		if (existing.length > 0) {
			this.app.workspace.revealLeaf(existing[0]);
			return;
		}
		const leaf: WorkspaceLeaf | null = this.app.workspace.getRightLeaf(false);
		if (!leaf) return;
		await leaf.setViewState({ type: BRANDING.viewType, active: true });
		this.app.workspace.revealLeaf(leaf);
	}

	runActiveFile(): void {
		const file = this.app.workspace.getActiveFile();
		if (!file || file.extension !== "md") {
			new Notice("원고로 쓸 마크다운 노트를 먼저 여세요.");
			return;
		}
		void this.runGeneration(file);
	}

	openFilePicker(): void {
		new FilePickerModal(this.app, async (file) => {
			await this.runGeneration(file);
		}).open();
	}

	async runGeneration(file: TFile): Promise<void> {
		const taskId = this.store.startTask(file.basename);
		await this.activateView();

		try {
			const manuscript = await this.app.vault.read(file);
			if (!manuscript.trim()) {
				throw new Error("원고가 비어있습니다.");
			}

			if (estimateTokens(manuscript) > 7500) {
				new Notice(
					"⚠ 원고가 길어 8K context를 초과할 수 있습니다. 나뉘어 실행하거나 gemma4:e2b로 변경하세요.",
					8000
				);
			}

			this.store.updateStage(taskId, "Ollama 호출 중", 2);

			const models = await checkServer(this.settings.ollamaUrl).catch((e) => {
				throw new Error(`Ollama 연결 실패 [T1]: ${(e as Error).message}`);
			});
			const modelExists = models.some(
				(m) => m === this.settings.model || m.startsWith(this.settings.model + ":")
			);
			if (!modelExists) {
				throw new Error(
					`모델 '${this.settings.model}'이 Ollama에 없습니다 [T2]. 'ollama pull ${this.settings.model}' 실행하세요.`
				);
			}

			const title = extractH1Title(manuscript) ?? file.basename;

			const { data, raw } = await buildScenes({
				ollamaUrl: this.settings.ollamaUrl,
				model: this.settings.model,
				imageModel: this.settings.imageModel,
				chapter: this.settings.defaultChapter,
				title,
				targetScenes: this.settings.targetScenes,
				narrationSeconds: this.settings.narrationSeconds,
				manuscript,
				onChunk: (count) => this.store.updateChunkCount(taskId, count),
			}).catch(async (e) => {
				const err = e as Error & { raw?: string };
				if (err.raw) {
					await writeDebug(
						this.app,
						this.settings.outputFolder,
						`${formatTimestamp()}_${slugifyEnglish(file.basename)}`,
						err.raw
					);
				}
				throw new Error(`JSON 파싱 실패 [T3]: ${err.message}. _debug 폴더 확인.`);
			});

			this.store.updateStage(taskId, "검증 중", 3);

			if (!data.scenes || data.scenes.length === 0) {
				throw new Error("생성된 scene이 없습니다. 원고 내용을 확인하세요.");
			}

			this.store.updateStage(taskId, "저장 중", 4);

			const stamp = formatTimestamp();
			const slug = slugifyEnglish(file.basename) || "manuscript";
			const baseName = `${stamp}_${slug}`;

			const outputs = await exportPackage(
				this.app,
				data,
				baseName,
				this.settings.outputFolder
			);

			void raw;

			const item: HistoryItem = {
				id: taskId,
				fileName: file.basename,
				chapter: data.chapter,
				title: data.title,
				sceneCount: data.scenes.length,
				outputs,
				finishedAt: Date.now(),
				success: true,
			};
			this.store.finishTask(item);
			await this.saveHistory();
			new Notice(`✓ ${data.scenes.length} scene 생성 완료 → ${outputs.json}`);
		} catch (e) {
			const message = (e as Error).message;
			this.store.failTask(taskId, message);
			await this.saveHistory();
			new Notice(`❌ 생성 실패: ${message}`, 10000);
		}
	}
}

class FilePickerModal extends FuzzySuggestModal<TFile> {
	private onPick: (file: TFile) => void;

	constructor(app: App, onPick: (file: TFile) => void) {
		super(app);
		this.onPick = onPick;
		this.setPlaceholder("원고 파일을 선택하세요...");
	}

	getItems(): TFile[] {
		return this.app.vault.getMarkdownFiles();
	}

	getItemText(file: TFile): string {
		return file.path;
	}

	onChooseItem(file: TFile): void {
		this.onPick(file);
	}
}

