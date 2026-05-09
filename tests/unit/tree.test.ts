import { describe, it, expect } from 'vitest';
import {
	collectAncestors,
	collectDirectories,
	findInsertionTarget,
	flattenTree,
	pruneExpandedFolders,
	toggleExpanded
} from '../../src/lib/utils/tree';
import type { FileEntry } from '$lib/tauri/types';

// Mirrors the Rust scan_vault output: directories first (alphabetical),
// then files (alphabetical).
const sampleTree: FileEntry = {
	name: '',
	relativePath: '',
	isDirectory: true,
	children: [
		{
			name: 'subdir',
			relativePath: 'subdir',
			isDirectory: true,
			children: [
				{
					name: 'deeper',
					relativePath: 'subdir/deeper',
					isDirectory: true,
					children: [
						{ name: 'note.md', relativePath: 'subdir/deeper/note.md', isDirectory: false }
					]
				},
				{ name: 'inner.md', relativePath: 'subdir/inner.md', isDirectory: false }
			]
		},
		{ name: 'top.md', relativePath: 'top.md', isDirectory: false }
	]
};

describe('tree utils', () => {
	// ------ B7.1 — toggleExpanded removes when present ------
	it('toggleExpanded removes a path that was already expanded', () => {
		expect(toggleExpanded(['a', 'b'], 'a')).toEqual(['b']);
	});

	// ------ B7.2 — toggleExpanded adds when absent ------
	it('toggleExpanded adds a path that was not expanded', () => {
		expect(toggleExpanded(['a'], 'b')).toEqual(['a', 'b']);
	});

	it('toggleExpanded does not mutate the input array', () => {
		const input = ['a', 'b'];
		const result = toggleExpanded(input, 'a');
		expect(input).toEqual(['a', 'b']);
		expect(result).not.toBe(input);
	});

	// ------ B7.3 — flattenTree returns dirs and files in display order ------
	it('flattenTree returns top-level entries when nothing is expanded', () => {
		const flat = flattenTree(sampleTree, new Set());
		expect(flat.map((i) => i.entry.relativePath)).toEqual(['subdir', 'top.md']);
		expect(flat.map((i) => i.depth)).toEqual([0, 0]);
	});

	// ------ B7.4 — flattenTree expands a directory's children ------
	it('flattenTree includes children of expanded directories', () => {
		const flat = flattenTree(sampleTree, new Set(['subdir']));
		expect(flat.map((i) => i.entry.relativePath)).toEqual([
			'subdir',
			'subdir/deeper',
			'subdir/inner.md',
			'top.md'
		]);
		// `subdir/deeper` is a directory but it's NOT in `expanded` → its child
		// `subdir/deeper/note.md` is hidden.
		expect(flat.find((i) => i.entry.relativePath === 'subdir/deeper/note.md')).toBeUndefined();
	});

	it('flattenTree depths reflect nesting', () => {
		const flat = flattenTree(sampleTree, new Set(['subdir', 'subdir/deeper']));
		const map = Object.fromEntries(flat.map((i) => [i.entry.relativePath, i.depth]));
		expect(map['subdir']).toBe(0);
		expect(map['subdir/deeper']).toBe(1);
		expect(map['subdir/deeper/note.md']).toBe(2);
	});

	// ------ B7.5 — findInsertionTarget logic ------
	it('findInsertionTarget returns "" for null selection (root)', () => {
		expect(findInsertionTarget(null)).toBe('');
	});

	it('findInsertionTarget returns the directory itself when a dir is selected', () => {
		expect(findInsertionTarget({ relativePath: 'a/b', isDirectory: true })).toBe('a/b');
	});

	it('findInsertionTarget returns the file parent when a file is selected', () => {
		expect(findInsertionTarget({ relativePath: 'a/b/c.md', isDirectory: false })).toBe('a/b');
		expect(findInsertionTarget({ relativePath: 'top.md', isDirectory: false })).toBe('');
	});

	// ------ B7.6 — pruneExpandedFolders ------
	it('pruneExpandedFolders keeps paths that still exist as directories', () => {
		const result = pruneExpandedFolders(
			['subdir', 'subdir/deeper', 'gone', 'subdir/inner.md'],
			sampleTree
		);
		expect(result).toEqual(['subdir', 'subdir/deeper']);
	});

	it('pruneExpandedFolders returns [] when tree is null', () => {
		expect(pruneExpandedFolders(['a', 'b'], null)).toEqual([]);
	});

	it('pruneExpandedFolders returns [] when no paths remain valid', () => {
		expect(pruneExpandedFolders(['ghost', 'gone'], sampleTree)).toEqual([]);
	});

	// ------ B7.7 — collectAncestors ------
	it('collectAncestors returns the parent chain of a relativePath', () => {
		expect(collectAncestors('a/b/c.md')).toEqual(['a', 'a/b']);
	});

	it('collectAncestors returns [] for top-level entries (no parent)', () => {
		expect(collectAncestors('top.md')).toEqual([]);
		expect(collectAncestors('')).toEqual([]);
	});

	// ------ B7.8 — collectDirectories ------
	it('collectDirectories returns all directories sorted, excluding root', () => {
		const dirs = collectDirectories(sampleTree);
		expect(dirs.map((d) => d.relativePath)).toEqual(['subdir', 'subdir/deeper']);
	});

	it('collectDirectories returns [] for null root', () => {
		expect(collectDirectories(null)).toEqual([]);
	});

	it('collectDirectories returns [] for an empty vault', () => {
		const empty = {
			name: '',
			relativePath: '',
			isDirectory: true,
			children: []
		};
		expect(collectDirectories(empty)).toEqual([]);
	});
});
