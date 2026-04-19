export function slugifyEnglish(input: string): string {
	const ascii = input
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^\x00-\x7f]/g, "")
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");
	return ascii.length > 0 ? ascii.slice(0, 40) : "scene";
}

export function extractH1Title(markdown: string): string | null {
	const lines = markdown.split(/\r?\n/);
	for (const line of lines) {
		const m = line.match(/^#\s+(.+)$/);
		if (m) return m[1].trim();
	}
	return null;
}

export function formatTimestamp(date: Date = new Date()): string {
	const yy = String(date.getFullYear()).slice(2);
	const mm = String(date.getMonth() + 1).padStart(2, "0");
	const dd = String(date.getDate()).padStart(2, "0");
	const hh = String(date.getHours()).padStart(2, "0");
	const mi = String(date.getMinutes()).padStart(2, "0");
	return `${yy}${mm}${dd}_${hh}${mi}`;
}

export function formatClockHM(date: Date = new Date()): string {
	return `${String(date.getHours()).padStart(2, "0")}:${String(
		date.getMinutes()
	).padStart(2, "0")}`;
}

export function estimateTokens(text: string): number {
	return Math.ceil(text.length / 2.5);
}

export function randomId(): string {
	return (
		Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
	);
}

export function padFilename(ch: number, sc: number, slug: string): string {
	const c = String(ch).padStart(2, "0");
	const s = String(sc).padStart(2, "0");
	return `ch${c}_${s}_${slug}.png`;
}
