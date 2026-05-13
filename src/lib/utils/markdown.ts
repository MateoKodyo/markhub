import { getFileNameWithoutExt } from './path';

/**
 * Return the first H1 (#) heading in `content`, trimmed.
 * Falls back to the filename without extension if no H1 is found.
 */
export function extractTitle(content: string, fallbackFileName: string): string {
	// Match `# something` at the start of a line. The `\s+` requirement after `#`
	// ensures `##`, `###` etc. are NOT matched.
	const match = content.match(/^#\s+(.+)$/m);
	if (match) return match[1].trim();
	return getFileNameWithoutExt(fallbackFileName);
}

/**
 * Split a markdown document's YAML frontmatter from its body.
 *
 * Frontmatter is detected only when the document starts with `---\n`,
 * followed by zero or more lines, then `---` on its own line. Anything else
 * (including a `---` mid-document, or a setext H2 like `Heading\n---`) is
 * NOT a frontmatter — body stays intact.
 *
 * Returns:
 * - `{ frontmatter: null, body: content }` when no frontmatter is present.
 * - `{ frontmatter, body }` where `frontmatter` is the YAML block content
 *   (without the `---` delimiters, may be empty string for `---\n---`).
 */
export function splitFrontmatter(
	content: string
): { frontmatter: string | null; body: string } {
	// Anchor at the very start, body starts after the closing `---\n` (or `---`
	// at EOF). Capture optional inner content (possibly empty).
	const match = content.match(/^---\n([\s\S]*?)\n?---(?:\n|$)/);
	if (!match) return { frontmatter: null, body: content };
	const frontmatter = match[1];
	let body = content.slice(match[0].length);
	// Standard frontmatter has a blank line right after the closing `---`.
	// Consume one leading newline so callers get a clean body that round-trips
	// through `joinFrontmatter` without accumulating blank lines.
	if (body.startsWith('\n')) body = body.slice(1);
	return { frontmatter, body };
}

/**
 * Inverse of splitFrontmatter — recombine a frontmatter block (or null) with
 * a body, preserving the standard `---\nYAML\n---\n\n` delimiter pattern.
 */
export function joinFrontmatter(frontmatter: string | null, body: string): string {
	if (frontmatter === null) return body;
	return `---\n${frontmatter}\n---\n\n${body}`;
}

/**
 * A heading extracted from a markdown document — used by the outline panel.
 *
 *   - `level`   ATX heading depth (1-6, matches `#` count).
 *   - `text`    The heading text, trimmed (no trailing #, no `#` prefix).
 *   - `line`    1-based line number in the ORIGINAL `content` (including
 *               frontmatter). So a caller that wants to jump in the source
 *               textarea can use `editor:jumpToLine` directly.
 *   - `index`   Zero-based position of this heading within the document's
 *               heading sequence. Useful for matching against BlockNote's
 *               flat document.filter(block => block.type === 'heading')
 *               when scrolling in preview mode.
 */
export type Heading = {
	level: 1 | 2 | 3 | 4 | 5 | 6;
	text: string;
	line: number;
	index: number;
};

/**
 * Pull every ATX heading from a markdown document. Skips frontmatter and
 * the inside of fenced code blocks (``` or ~~~), since `#` chars in code
 * are not real headings. setext-style headings (underlined with `===`
 * or `---`) are intentionally NOT supported — BlockNote doesn't emit them
 * and Markhub's source view encourages the explicit ATX form.
 */
export function extractHeadings(content: string): Heading[] {
	if (!content) return [];
	const lines = content.split('\n');
	const headings: Heading[] = [];

	// Detect and skip frontmatter at the very top. We walk the lines
	// manually (rather than slicing via splitFrontmatter) so the `line`
	// number on every Heading remains valid relative to the original
	// content — jump-to-line works without an offset correction.
	let i = 0;
	if (lines[0] === '---') {
		for (let j = 1; j < lines.length; j++) {
			if (lines[j] === '---') {
				i = j + 1;
				break;
			}
		}
	}

	let inFence = false;
	let fenceMarker = '';
	const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
	const FENCE_RE = /^\s*(```|~~~)/;

	for (; i < lines.length; i++) {
		const line = lines[i];
		const fence = line.match(FENCE_RE);
		if (fence) {
			if (!inFence) {
				inFence = true;
				fenceMarker = fence[1];
			} else if (line.includes(fenceMarker)) {
				inFence = false;
				fenceMarker = '';
			}
			continue;
		}
		if (inFence) continue;

		const m = line.match(HEADING_RE);
		if (!m) continue;
		const level = m[1].length as 1 | 2 | 3 | 4 | 5 | 6;
		const text = m[2].trim();
		if (!text) continue;
		headings.push({
			level,
			text,
			line: i + 1, // 1-based
			index: headings.length
		});
	}

	return headings;
}
