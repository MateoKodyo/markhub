// Pure utilities for manipulating the file tree state (expansion, flattening,
// pruning of stale paths). These functions never touch Tauri or stores — they
// operate on plain values so they're trivially testable in jsdom.

import type { FileEntry } from '$lib/tauri/types';

/**
 * Toggle a relativePath in an array of expanded folder paths.
 * Returns a new array; does not mutate the input.
 */
export function toggleExpanded(expanded: string[], path: string): string[] {
	const idx = expanded.indexOf(path);
	if (idx >= 0) {
		const next = expanded.slice();
		next.splice(idx, 1);
		return next;
	}
	return [...expanded, path];
}

/**
 * Collect all ancestor relativePaths of a given path.
 * `collectAncestors('a/b/c.md')` → `['a', 'a/b']`.
 * Used to auto-expand parents of search matches in the tree.
 */
export function collectAncestors(relativePath: string): string[] {
	if (!relativePath) return [];
	const parts = relativePath.split('/').filter(Boolean);
	if (parts.length <= 1) return [];
	const ancestors: string[] = [];
	for (let i = 1; i < parts.length; i++) {
		ancestors.push(parts.slice(0, i).join('/'));
	}
	return ancestors;
}

/**
 * Walk the tree and remove from `paths` any entry that no longer corresponds
 * to an existing directory. Used after a vault scan to keep `expandedFolders`
 * clean.
 */
export function pruneExpandedFolders(paths: string[], tree: FileEntry | null): string[] {
	if (!tree) return [];
	const knownDirs = collectKnownDirectories(tree);
	return paths.filter((p) => knownDirs.has(p));
}

function collectKnownDirectories(entry: FileEntry, acc: Set<string> = new Set()): Set<string> {
	if (!entry.isDirectory) return acc;
	if (entry.relativePath) acc.add(entry.relativePath);
	for (const child of entry.children ?? []) {
		collectKnownDirectories(child, acc);
	}
	return acc;
}

export type FlatTreeItem = {
	entry: FileEntry;
	depth: number;
};

/**
 * Flatten a tree into a list of `{ entry, depth }` items, in display order:
 *   - directories first (sort already done by Rust scan_vault),
 *   - children of an expanded directory follow immediately,
 *   - children of collapsed directories are skipped.
 *
 * The synthetic root entry (empty `name`/`relativePath`) is NOT included in
 * the output; only its children at depth 0 onward.
 */
export function flattenTree(root: FileEntry, expanded: Set<string>): FlatTreeItem[] {
	const out: FlatTreeItem[] = [];
	for (const child of root.children ?? []) {
		walkInto(child, 0, expanded, out);
	}
	return out;
}

function walkInto(
	entry: FileEntry,
	depth: number,
	expanded: Set<string>,
	out: FlatTreeItem[]
): void {
	out.push({ entry, depth });
	if (entry.isDirectory && expanded.has(entry.relativePath)) {
		for (const child of entry.children ?? []) {
			walkInto(child, depth + 1, expanded, out);
		}
	}
}

/**
 * Determine where a new file/folder should be inserted given the current
 * tree-selection. Returns the relativePath of the parent directory, or `''`
 * to mean "vault root".
 *
 *   - selection = null → root.
 *   - selection on a directory → that directory.
 *   - selection on a file → parent directory of the file.
 */
export function findInsertionTarget(
	selection: { relativePath: string; isDirectory: boolean } | null
): string {
	if (!selection) return '';
	if (selection.isDirectory) return selection.relativePath;
	const i = selection.relativePath.lastIndexOf('/');
	return i >= 0 ? selection.relativePath.substring(0, i) : '';
}

/**
 * Collect every directory (sorted by relativePath) in the tree, EXCLUDING the
 * synthetic root. Used by the "Move to…" folder picker.
 */
export function collectDirectories(root: FileEntry | null): FileEntry[] {
	if (!root) return [];
	const acc: FileEntry[] = [];
	const walk = (entry: FileEntry) => {
		if (entry.isDirectory && entry.relativePath !== '') {
			acc.push(entry);
		}
		for (const child of entry.children ?? []) walk(child);
	};
	walk(root);
	return acc.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}
