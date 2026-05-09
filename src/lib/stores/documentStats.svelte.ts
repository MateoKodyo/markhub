/**
 * Lightweight derived stats for the active document — fed to the status bar.
 * Pure helpers + a thin reactive wrapper. The store itself doesn't import
 * activeFileStore; the consumer passes the content string in. Keeps the
 * dependency graph one-directional (stats → consumer; not stats ↔ activeFile).
 */

const READING_WORDS_PER_MINUTE = 200;

/**
 * Strip basic markdown noise so the count reflects readable content, not
 * syntax. Conservative: we only remove heading hashes, list bullets, code
 * fences, and YAML frontmatter at the very top. Inline formatting (bold /
 * italic / links) leaves their visible text in place.
 */
export function stripMarkdownNoise(content: string): string {
	let s = content;
	// YAML frontmatter at the very top.
	if (s.startsWith('---\n')) {
		const end = s.indexOf('\n---', 4);
		if (end >= 0) s = s.slice(end + 4);
	}
	// Code fences (keep the inner code as words — it's still text content).
	s = s.replace(/```/g, '');
	// Heading hashes, blockquote markers, ordered/unordered list bullets,
	// task markers (`- [x]` / `- [ ]`). Task marker has to come BEFORE the
	// generic bullet alternation, otherwise `- [x]` gets eaten as a `-` bullet
	// and `[x]` survives as text.
	s = s.replace(/^[ \t]*([-*+] \[[ xX]\]|[#>*\-+]+|\d+\.)[ \t]+/gm, '');
	// Inline link `[text](url)` → keep `text` only.
	s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
	// Inline code backticks (keep the code text).
	s = s.replace(/`/g, '');
	// Bold / italic markers.
	s = s.replace(/(\*\*|__|\*|_)/g, '');
	return s;
}

export function countWords(content: string): number {
	const cleaned = stripMarkdownNoise(content).trim();
	if (!cleaned) return 0;
	// Split on whitespace; filter out empties.
	return cleaned.split(/\s+/).filter(Boolean).length;
}

export function countCharacters(content: string): number {
	// Raw character count (including markdown syntax) — what the user sees in
	// the source view. Don't strip; it's the on-disk truth.
	return content.length;
}

export function readingMinutes(words: number): number {
	if (words <= 0) return 0;
	return Math.max(1, Math.round(words / READING_WORDS_PER_MINUTE));
}

export type DocumentStats = {
	words: number;
	characters: number;
	readingMinutes: number;
};

export function computeDocumentStats(content: string): DocumentStats {
	const words = countWords(content);
	return {
		words,
		characters: countCharacters(content),
		readingMinutes: readingMinutes(words)
	};
}
