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

/**
 * Return a copy of the tree keeping only files for which `isAiAware`
 * returns true. Unlike `filterTreeToMarkdown`, directories with no
 * matching descendant are pruned — the result is a focused view of just
 * the AI-aware files, not the whole folder skeleton. The root is always
 * kept (even when empty).
 */
export function filterTreeToAiAware(
	root: FileEntry,
	isAiAware: (relativePath: string) => boolean
): FileEntry {
	const walk = (entry: FileEntry): FileEntry | null => {
		if (!entry.isDirectory) {
			return isAiAware(entry.relativePath) ? entry : null;
		}
		const kept: FileEntry[] = [];
		for (const child of entry.children ?? []) {
			const fc = walk(child);
			if (fc) kept.push(fc);
		}
		// Prune an empty directory — but never the vault root.
		if (kept.length === 0 && entry.relativePath !== '') return null;
		return { ...entry, children: kept };
	};
	return walk(root) ?? { ...root, children: [] };
}
