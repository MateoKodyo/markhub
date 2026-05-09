import { describe, it, expect } from 'vitest';
import { extractTitle } from '../../src/lib/utils/markdown';

describe('markdown utils', () => {
	// ------ B2.1 — extractTitle returns first H1 ------
	it('returns the first H1 from the content', () => {
		const md = '# My great note\n\nSome paragraph.';
		expect(extractTitle(md, 'note.md')).toBe('My great note');
	});

	it('returns the first H1 even when other headings precede it visually', () => {
		const md = 'preamble line\n\n## Sub before\n\n# Real title\n\n## After';
		expect(extractTitle(md, 'fallback.md')).toBe('Real title');
	});

	// ------ B2.2 — fallback to filename ------
	it('falls back to the filename without extension if no H1 is present', () => {
		const md = 'just plain text, no headings';
		expect(extractTitle(md, 'untitled.md')).toBe('untitled');
	});

	it('falls back when content is empty', () => {
		expect(extractTitle('', 'fresh.md')).toBe('fresh');
	});

	it('does not match H2 or deeper headings as title', () => {
		const md = '## not a title\n\n### nope';
		expect(extractTitle(md, 'fallback.md')).toBe('fallback');
	});
});
