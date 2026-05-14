import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks must be declared BEFORE the SUT import — vi.mock is hoisted.
vi.mock('@tauri-apps/plugin-dialog', () => ({
	save: vi.fn()
}));

vi.mock('$lib/tauri/api', () => ({
	fileExport: vi.fn()
}));

import { save } from '@tauri-apps/plugin-dialog';
import { fileExport } from '$lib/tauri/api';
import {
	defaultExportFilename,
	pickAndExportMarkdown
} from '../../src/lib/utils/export';

describe('defaultExportFilename', () => {
	it('falls back to untitled.md when no source path is given', () => {
		expect(defaultExportFilename(null)).toBe('untitled.md');
		expect(defaultExportFilename(undefined)).toBe('untitled.md');
		expect(defaultExportFilename('')).toBe('untitled.md');
	});

	it('keeps the basename when a .md file path is given', () => {
		expect(defaultExportFilename('notes/draft.md')).toBe('draft.md');
		expect(defaultExportFilename('top-level.md')).toBe('top-level.md');
	});

	it('keeps the basename when a .markdown file path is given', () => {
		expect(defaultExportFilename('a/b/note.markdown')).toBe('note.markdown');
	});

	it('appends .md when the source has no markdown extension', () => {
		expect(defaultExportFilename('weird/path/no-ext')).toBe('no-ext.md');
	});
});

describe('pickAndExportMarkdown', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns canceled when the user dismisses the dialog', async () => {
		vi.mocked(save).mockResolvedValueOnce(null);

		const result = await pickAndExportMarkdown('content', 'note.md');

		expect(result).toEqual({ canceled: true });
		expect(fileExport).not.toHaveBeenCalled();
	});

	it('forwards content and chosen path to fileExport when confirmed', async () => {
		vi.mocked(save).mockResolvedValueOnce('/Users/me/Desktop/note.md');
		vi.mocked(fileExport).mockResolvedValueOnce(undefined);

		const result = await pickAndExportMarkdown('# Hello\n', 'note.md');

		expect(save).toHaveBeenCalledWith({
			title: 'Exporter en Markdown',
			defaultPath: 'note.md',
			filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
		});
		expect(fileExport).toHaveBeenCalledWith('# Hello\n', '/Users/me/Desktop/note.md');
		expect(result).toEqual({
			canceled: false,
			path: '/Users/me/Desktop/note.md'
		});
	});

	it('propagates errors from fileExport (caller shows the toast)', async () => {
		vi.mocked(save).mockResolvedValueOnce('/tmp/out.md');
		vi.mocked(fileExport).mockRejectedValueOnce('disk full');

		await expect(pickAndExportMarkdown('x', 'note.md')).rejects.toBe('disk full');
	});
});
