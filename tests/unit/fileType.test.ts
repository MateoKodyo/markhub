import { describe, it, expect } from 'vitest';
import {
	MARKDOWN_EXTENSIONS,
	filterTreeToMarkdown,
	isMarkdownFile
} from '../../src/lib/utils/fileType';
import type { FileEntry } from '../../src/lib/tauri/types';

function dir(name: string, children: FileEntry[]): FileEntry {
	return {
		name,
		relativePath: name,
		isDirectory: true,
		children
	};
}
function file(name: string): FileEntry {
	return {
		name,
		relativePath: name,
		isDirectory: false
	};
}

describe('fileType utils', () => {
	it('exposes the three markdown extensions', () => {
		expect([...MARKDOWN_EXTENSIONS]).toEqual(['.md', '.markdown', '.mdx']);
	});

	// Recognized extensions
	it('recognizes .md', () => {
		expect(isMarkdownFile('foo.md')).toBe(true);
	});
	it('recognizes .markdown', () => {
		expect(isMarkdownFile('foo.markdown')).toBe(true);
	});
	it('recognizes .mdx', () => {
		expect(isMarkdownFile('foo.mdx')).toBe(true);
	});

	// Case-insensitive
	it('is case-insensitive on .md', () => {
		expect(isMarkdownFile('FOO.MD')).toBe(true);
	});
	it('is case-insensitive on .markdown', () => {
		expect(isMarkdownFile('Bar.Markdown')).toBe(true);
	});
	it('is case-insensitive on .mdx', () => {
		expect(isMarkdownFile('Bar.MDX')).toBe(true);
	});

	// Non-markdown
	it('rejects .txt', () => {
		expect(isMarkdownFile('foo.txt')).toBe(false);
	});
	it('rejects .json', () => {
		expect(isMarkdownFile('foo.json')).toBe(false);
	});
	it('rejects .py', () => {
		expect(isMarkdownFile('foo.py')).toBe(false);
	});
	it('rejects .rs', () => {
		expect(isMarkdownFile('foo.rs')).toBe(false);
	});
	it('rejects files without extension', () => {
		expect(isMarkdownFile('README')).toBe(false);
		expect(isMarkdownFile('Makefile')).toBe(false);
	});
	it('rejects dotfiles without recognized extension', () => {
		expect(isMarkdownFile('.env')).toBe(false);
		expect(isMarkdownFile('.gitignore')).toBe(false);
	});

	// Tricky cases — only the trailing extension matters.
	it('handles paths with slashes', () => {
		expect(isMarkdownFile('docs/sub/note.md')).toBe(true);
		expect(isMarkdownFile('docs/sub/script.py')).toBe(false);
	});
	it('does not match when .md appears mid-name', () => {
		expect(isMarkdownFile('foo.md.bak')).toBe(false);
	});
});

describe('filterTreeToMarkdown', () => {
	it('keeps only markdown files at the root', () => {
		const root: FileEntry = {
			name: '',
			relativePath: '',
			isDirectory: true,
			children: [file('a.md'), file('b.txt'), file('c.markdown'), file('d.png')]
		};
		const filtered = filterTreeToMarkdown(root);
		const names = filtered.children?.map((c) => c.name) ?? [];
		expect(names).toEqual(['a.md', 'c.markdown']);
	});

	it('preserves directories even when empty', () => {
		const root: FileEntry = {
			name: '',
			relativePath: '',
			isDirectory: true,
			children: [dir('emptyish', [file('only.txt'), file('also.json')]), file('top.md')]
		};
		const filtered = filterTreeToMarkdown(root);
		const childNames = filtered.children?.map((c) => c.name) ?? [];
		expect(childNames).toEqual(['emptyish', 'top.md']);
		const sub = filtered.children?.[0];
		expect(sub?.isDirectory).toBe(true);
		expect(sub?.children).toEqual([]);
	});

	it('recurses into nested directories', () => {
		const root: FileEntry = {
			name: '',
			relativePath: '',
			isDirectory: true,
			children: [
				dir('a', [
					file('keep.md'),
					file('drop.txt'),
					dir('b', [file('deep.mdx'), file('hidden.bin')])
				])
			]
		};
		const filtered = filterTreeToMarkdown(root);
		const a = filtered.children?.[0];
		expect(a?.children?.map((c) => c.name)).toEqual(['keep.md', 'b']);
		const b = a?.children?.find((c) => c.name === 'b');
		expect(b?.children?.map((c) => c.name)).toEqual(['deep.mdx']);
	});

	it('does not mutate the original tree', () => {
		const root: FileEntry = {
			name: '',
			relativePath: '',
			isDirectory: true,
			children: [file('a.md'), file('b.txt')]
		};
		const before = root.children!.length;
		filterTreeToMarkdown(root);
		expect(root.children?.length).toBe(before);
	});
});
