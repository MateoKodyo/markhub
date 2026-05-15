// Markdown extension detection. The vault scan now returns *all* files
// (not only markdown); the sidebar uses this to decide whether to mute or
// hide a file based on the visibility toggle.

import type { FileEntry } from '$lib/tauri/types';

export const MARKDOWN_EXTENSIONS = ['.md', '.markdown', '.mdx'] as const;

export function isMarkdownFile(path: string): boolean {
	const lower = path.toLowerCase();
	return MARKDOWN_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Return a copy of the tree with non-markdown files removed. Directories
 * are always preserved (empty folders included). Used by the sidebar when
 * the "hide non-markdown" toggle is ON.
 */
export function filterTreeToMarkdown(root: FileEntry): FileEntry {
	if (!root.children) return root;
	const filtered: FileEntry[] = [];
	for (const child of root.children) {
		if (child.isDirectory) {
			filtered.push(filterTreeToMarkdown(child));
		} else if (isMarkdownFile(child.name)) {
			filtered.push(child);
		}
	}
	return { ...root, children: filtered };
}
