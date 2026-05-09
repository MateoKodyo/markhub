import { describe, it, expect } from 'vitest';
import {
	extractTitle,
	joinFrontmatter,
	splitFrontmatter
} from '../../src/lib/utils/markdown';

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

describe('frontmatter utils', () => {
	// ------ B6.1 — no frontmatter, content unchanged ------
	it('returns null frontmatter when content has no YAML block', () => {
		const result = splitFrontmatter('# Hello\n\nNo frontmatter here.');
		expect(result.frontmatter).toBeNull();
		expect(result.body).toBe('# Hello\n\nNo frontmatter here.');
	});

	// ------ B6.2 — standard frontmatter detected ------
	it('splits a standard 3-line frontmatter from the body', () => {
		const md = '---\ntitle: My note\ntags: [a, b]\n---\n\n# Body';
		const { frontmatter, body } = splitFrontmatter(md);
		expect(frontmatter).toBe('title: My note\ntags: [a, b]');
		expect(body).toBe('# Body');
	});

	// ------ B6.3 — empty frontmatter (delimiters with nothing between) ------
	it('detects an empty frontmatter (--- immediately followed by ---)', () => {
		const md = '---\n---\n\nbody';
		const { frontmatter, body } = splitFrontmatter(md);
		expect(frontmatter).toBe('');
		expect(body).toBe('body');
	});

	// ------ B6.4 — `---` not at start of file is NOT a frontmatter ------
	it('does NOT treat a mid-document `---` as a frontmatter', () => {
		const md = '# Title\n\n---\n\nseparator';
		const { frontmatter, body } = splitFrontmatter(md);
		expect(frontmatter).toBeNull();
		expect(body).toBe(md);
	});

	// ------ B6.5 — joinFrontmatter passthrough when null ------
	it('joinFrontmatter returns body untouched when frontmatter is null', () => {
		expect(joinFrontmatter(null, '# Body')).toBe('# Body');
	});

	// ------ B6.6 — joinFrontmatter rebuilds the block ------
	it('joinFrontmatter recombines into the standard `---\\nYAML\\n---\\n\\nbody` shape', () => {
		expect(joinFrontmatter('title: x', 'body')).toBe('---\ntitle: x\n---\n\nbody');
	});

	// ------ B6.7 — round-trip ------
	it('split → join is a faithful round-trip on standard frontmatter', () => {
		const original = '---\ntitle: Round\nlist:\n  - a\n  - b\n---\n\n# Body content\n';
		const { frontmatter, body } = splitFrontmatter(original);
		expect(joinFrontmatter(frontmatter, body)).toBe(original);
	});
});
