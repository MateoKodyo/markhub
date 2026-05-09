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
