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
