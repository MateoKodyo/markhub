import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import FileTree from '../../src/lib/components/FileTree.svelte';
import type { FileEntry } from '$lib/tauri/types';

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
		// Use the visible rendered order.
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

	// ------ C2.3 — click on folder toggles expand/collapse ------
	it('toggles expand/collapse when a folder is clicked', async () => {
		const { container } = render(FileTree, { root: sampleTree });
		// inner.md should be visible only when subdir is expanded
		// Convention: subdir starts collapsed → inner.md not in DOM until click
		expect(screen.queryByText('inner.md')).toBeNull();

		const subdir = screen.getByText('subdir');
		await fireEvent.click(subdir);
		expect(screen.getByText('inner.md')).toBeInTheDocument();

		await fireEvent.click(subdir);
		expect(screen.queryByText('inner.md')).toBeNull();
	});

	// ------ C2.4 — empty vault message ------
	it('shows an empty-vault message when there are no files', () => {
		render(FileTree, { root: emptyTree });
		expect(screen.getByText(/vault vide|empty/i)).toBeInTheDocument();
	});

	// ------ C2.5 — text filter ------
	it('filters entries by text (case-insensitive substring match)', async () => {
		const { rerender } = render(FileTree, { root: sampleTree, filter: 'b-note' });
		expect(screen.queryByText('a-note.md')).toBeNull();
		expect(screen.getByText('b-note.md')).toBeInTheDocument();

		await rerender({ root: sampleTree, filter: 'A-NOTE' });
		expect(screen.getByText('a-note.md')).toBeInTheDocument();
		expect(screen.queryByText('b-note.md')).toBeNull();
	});
});
