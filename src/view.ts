import { ItemView, WorkspaceLeaf, setIcon, Notice } from "obsidian";
import { BRANDING } from "./branding";
import type { Store, StoreState, InProgressTask, HistoryItem } from "./store";
import { formatClockHM } from "./utils";

export interface ViewActions {
	runActive: () => void;
	openPicker: () => void;
}

export class ImagePromptView extends ItemView {
	private store: Store;
	private actions: ViewActions;
	private unsubscribe: (() => void) | null = null;

	constructor(leaf: WorkspaceLeaf, store: Store, actions: ViewActions) {
		super(leaf);
		this.store = store;
		this.actions = actions;
	}

	getViewType(): string {
		return BRANDING.viewType;
	}

	getDisplayText(): string {
		return BRANDING.viewTitle;
	}

	getIcon(): string {
		return BRANDING.ribbonIcon;
	}

	async onOpen(): Promise<void> {
		this.unsubscribe = this.store.subscribe((state) => this.render(state));
	}

	async onClose(): Promise<void> {
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
		}
	}

	private render(state: StoreState): void {
		const root = this.containerEl.children[1] as HTMLElement;
		root.empty();
		root.addClass("ipo-root");

		const header = root.createDiv({ cls: "ipo-header" });
		const iconEl = header.createSpan({ cls: "ipo-header-icon" });
		setIcon(iconEl, BRANDING.ribbonIcon);
		header.createSpan({ cls: "ipo-header-title", text: BRANDING.viewTitle });

		this.renderActions(root);
		this.renderInProgress(root, state.inProgress);
		this.renderHistory(root, state.history);
	}

	private renderActions(root: HTMLElement): void {
		const bar = root.createDiv({ cls: "ipo-actions" });

		const primary = bar.createEl("button", {
			cls: "ipo-btn ipo-btn-primary",
			text: "현재 노트로 생성",
		});
		primary.addEventListener("click", () => this.actions.runActive());

		const secondary = bar.createEl("button", {
			cls: "ipo-btn",
			text: "파일 선택",
		});
		secondary.addEventListener("click", () => this.actions.openPicker());
	}

	private renderInProgress(root: HTMLElement, tasks: InProgressTask[]): void {
		const section = root.createDiv({ cls: "ipo-section" });
		section.createEl("h4", {
			cls: "ipo-section-title",
			text: `진행 중 (${tasks.length})`,
		});
		if (tasks.length === 0) {
			section.createDiv({ cls: "ipo-empty", text: "진행 중인 작업이 없습니다." });
			return;
		}
		for (const t of tasks) {
			const row = section.createDiv({ cls: "ipo-row ipo-in-progress" });
			row.createDiv({ cls: "ipo-row-title", text: t.fileName });
			const stageText =
				typeof t.chunkCount === "number" && t.chunkCount > 0
					? `[${t.stageIndex}/${t.totalStages}] ${t.stage}... · ${t.chunkCount} chunks`
					: `[${t.stageIndex}/${t.totalStages}] ${t.stage}...`;
			row.createDiv({ cls: "ipo-row-stage", text: stageText });
		}
	}

	private renderHistory(root: HTMLElement, items: HistoryItem[]): void {
		const section = root.createDiv({ cls: "ipo-section" });
		section.createEl("h4", {
			cls: "ipo-section-title",
			text: `최근 기록 (${items.length})`,
		});
		if (items.length === 0) {
			section.createDiv({ cls: "ipo-empty", text: "아직 생성된 기록이 없습니다." });
			return;
		}
		for (const h of items) {
			const row = section.createDiv({
				cls: `ipo-row ${h.success ? "ipo-success" : "ipo-failure"}`,
			});
			const top = row.createDiv({ cls: "ipo-row-top" });
			const icon = top.createSpan({ cls: "ipo-row-icon" });
			setIcon(icon, h.success ? "check-circle" : "x-circle");
			top.createSpan({
				cls: "ipo-row-title",
				text: `${h.title} — ${h.sceneCount} scenes · ${formatClockHM(new Date(h.finishedAt))}`,
			});

			if (h.success) {
				const links = row.createDiv({ cls: "ipo-row-links" });
				this.renderOpenLink(links, "MD", h.outputs.md);
				links.createSpan({ text: " · " });
				this.renderOpenLink(links, "JSON", h.outputs.json);
				links.createSpan({ text: " · " });
				this.renderOpenLink(links, "TXT", h.outputs.txt);
				links.createSpan({ text: " · " });
				const copy = links.createEl("a", {
					cls: "ipo-link",
					text: "JSON 경로 복사",
				});
				copy.addEventListener("click", (e) => {
					e.preventDefault();
					navigator.clipboard
						.writeText(h.outputs.json)
						.then(() => new Notice("JSON 경로를 복사했습니다."));
				});
			} else if (h.errorMessage) {
				row.createDiv({ cls: "ipo-error", text: h.errorMessage });
			}
		}
	}

	private renderOpenLink(parent: HTMLElement, label: string, path: string): void {
		const a = parent.createEl("a", { cls: "ipo-link", text: label });
		a.addEventListener("click", (e) => {
			e.preventDefault();
			this.app.workspace.openLinkText(path, "", true);
		});
	}
}
