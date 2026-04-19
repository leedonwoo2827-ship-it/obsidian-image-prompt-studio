export type TaskStage =
	| "읽는 중"
	| "Ollama 호출 중"
	| "검증 중"
	| "저장 중"
	| "완료"
	| "실패";

export interface InProgressTask {
	id: string;
	fileName: string;
	stage: TaskStage;
	stageIndex: number;
	totalStages: number;
	startedAt: number;
	errorMessage?: string;
}

export interface HistoryItem {
	id: string;
	fileName: string;
	chapter: number;
	title: string;
	sceneCount: number;
	outputs: { md: string; json: string; txt: string };
	finishedAt: number;
	success: boolean;
	errorMessage?: string;
}

export interface StoreState {
	inProgress: InProgressTask[];
	history: HistoryItem[];
}

const MAX_HISTORY = 20;
const TOTAL_STAGES = 4;

type Listener = (state: StoreState) => void;

export class Store {
	private state: StoreState = { inProgress: [], history: [] };
	private listeners: Set<Listener> = new Set();

	getState(): StoreState {
		return this.state;
	}

	setHistory(items: HistoryItem[]): void {
		this.state.history = items.slice(0, MAX_HISTORY);
		this.emit();
	}

	startTask(fileName: string): string {
		const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
		this.state.inProgress.push({
			id,
			fileName,
			stage: "읽는 중",
			stageIndex: 1,
			totalStages: TOTAL_STAGES,
			startedAt: Date.now(),
		});
		this.emit();
		return id;
	}

	updateStage(id: string, stage: TaskStage, stageIndex: number): void {
		const task = this.state.inProgress.find((t) => t.id === id);
		if (!task) return;
		task.stage = stage;
		task.stageIndex = stageIndex;
		this.emit();
	}

	finishTask(item: HistoryItem): void {
		this.state.inProgress = this.state.inProgress.filter((t) => t.id !== item.id);
		this.state.history.unshift(item);
		if (this.state.history.length > MAX_HISTORY) {
			this.state.history.length = MAX_HISTORY;
		}
		this.emit();
	}

	failTask(id: string, errorMessage: string): void {
		const task = this.state.inProgress.find((t) => t.id === id);
		if (!task) return;
		const item: HistoryItem = {
			id,
			fileName: task.fileName,
			chapter: 0,
			title: task.fileName,
			sceneCount: 0,
			outputs: { md: "", json: "", txt: "" },
			finishedAt: Date.now(),
			success: false,
			errorMessage,
		};
		this.finishTask(item);
	}

	clearInProgress(): void {
		this.state.inProgress = [];
		this.emit();
	}

	subscribe(cb: Listener): () => void {
		this.listeners.add(cb);
		cb(this.state);
		return () => this.listeners.delete(cb);
	}

	private emit(): void {
		for (const cb of this.listeners) cb(this.state);
	}
}
