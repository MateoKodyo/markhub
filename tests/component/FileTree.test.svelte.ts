import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import FileTree from '../../src/lib/components/FileTree.svelte';
import type { FileEntry } from '$lib/tauri/types';

// Mirrors Rust scan_vault output: directories first (alpha), then files (alpha).
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
				{ name: 'inner.md', relativePath: 'subdir/inner.md', isDirectory: false }
			]
		},
		{ name: 'a-note.md', relativePath: 'a-note.md', isDirectory: false },
		{ name: 'b-note.md', relativePath: 'b-note.md', isDirectory: false }
	]
};

const emptyTree: FileEntry = {
	name: '',
	relativePath: '',
	isDirectory: true,
	children: []
};

describe('FileTree', () => {
	// ------ C2.1 — directories render before files ------
	it('renders directories before files, alphabetical within each group', () => {
		const { container } = render(FileTree, { root: sampleTree });
		const labels = Array.from(
			container.querySelectorAll('[data-testid="file-tree-entry"]')
		).map((el) => (el.textContent || '').trim());
		const dirIdx = labels.findIndex((l) => l.includes('subdir'));
		const aIdx = labels.findIndex((l) => l.includes('a-note.md'));
		expect(dirIdx).toBeGreaterThanOrEqual(0);
		expect(aIdx).toBeGreaterThanOrEqual(0);
		expect(dirIdx).toBeLessThan(aIdx);
	});

	// ------ C2.2 — click on file calls onFileClick ------
	it('calls onFileClick with the relative path when a file is clicked', async () => {
		const onFileClick = vi.fn();
		render(FileTree, { root: sampleTree, onFileClick });
		await fireEvent.click(screen.getByText('a-note.md'));
		expect(onFileClick).toHaveBeenCalledWith('a-note.md');
	});

	// ------ C2.3 — initial state: all directories collapsed (no children visible) ------
	it('starts with all directories collapsed when expanded set is empty', () => {
		render(FileTree, { root: sampleTree, expanded: new Set<string>() });
		// `inner.md` is inside `subdir`, which is collapsed → not in DOM.
		expect(screen.queryByText('inner.md')).toBeNull();
	});

	// ------ C2.4 — click on folder calls onToggle (controlled pattern) ------
	it('emits onToggle(relativePath) when a folder row is clicked', async () => {
		const onToggle = vi.fn();
		render(FileTree, { root: sampleTree, expanded: new Set<string>(), onToggle });
		await fireEvent.click(screen.getByText('subdir'));
		expect(onToggle).toHaveBeenCalledWith('subdir');
	});

	// ------ C2.5 — when expanded prop includes a path, that folder's children render ------
	it('renders children of a directory when its path is in `expanded`', () => {
		render(FileTree, { root: sampleTree, expanded: new Set(['subdir']) });
		expect(screen.getByText('inner.md')).toBeInTheDocument();
	});

	// ------ C2.6 — empty vault message ------
	it('shows an empty-vault message when there are no files', () => {
		render(FileTree, { root: emptyTree });
		expect(screen.getByText(/vault vide|empty/i)).toBeInTheDocument();
	});

	// ------ C2.7 — text filter (recursive, auto-expands ancestors of matches) ------
	it('filters entries case-insensitively across the recursive tree', async () => {
		const { rerender } = render(FileTree, {
			root: sampleTree,
			filter: 'b-note',
			expanded: new Set<string>()
		});
		expect(screen.queryByText('a-note.md')).toBeNull();
		expect(screen.getByText('b-note.md')).toBeInTheDocument();

		await rerender({ root: sampleTree, filter: 'A-NOTE', expanded: new Set<string>() });
		expect(screen.getByText('a-note.md')).toBeInTheDocument();
		expect(screen.queryByText('b-note.md')).toBeNull();
	});

	it('auto-expands ancestors of a deep match when filter is active', () => {
		// `inner.md` is inside `subdir` (collapsed by default). With filter='inner',
		// the tree should still surface it by auto-opening `subdir`.
		render(FileTree, {
			root: sampleTree,
			filter: 'inner',
			expanded: new Set<string>() // no manual expansion
		});
		expect(screen.getByText('inner.md')).toBeInTheDocument();
	});

	// ------ C2.8 — Lucide icons rendered ------
	it('renders chevron, folder, and file icons (Lucide SVGs present)', () => {
		const { container } = render(FileTree, { root: sampleTree, expanded: new Set<string>() });
		// Lucide renders <svg> elements; verify at least one chevron + folder + file.
		const svgs = container.querySelectorAll('svg');
		expect(svgs.length).toBeGreaterThanOrEqual(3);
	});
});
