import { describe, expect, it } from 'vitest';
import { lineToBlockIndex } from '../../src/lib/utils/markdown';

describe('lineToBlockIndex', () => {
	it('returns null for an empty document', () => {
		expect(lineToBlockIndex('', 1)).toBeNull();
	});

	it('returns null when the line number is out of range', () => {
		expect(lineToBlockIndex('# title', 0)).toBeNull();
		expect(lineToBlockIndex('# title', 10)).toBeNull();
	});

	it('maps a single-line heading to block index 0', () => {
		expect(lineToBlockIndex('# title', 1)).toBe(0);
	});

	it('counts a fresh block per non-empty line separated by blanks', () => {
		const doc = '# H1\n\n## H2\n\nparagraph';
		expect(lineToBlockIndex(doc, 1)).toBe(0); // # H1
		expect(lineToBlockIndex(doc, 3)).toBe(1); // ## H2
		expect(lineToBlockIndex(doc, 5)).toBe(2); // paragraph
	});

	it('empty lines map to the previous block', () => {
		const doc = '# H1\n\n## H2';
		expect(lineToBlockIndex(doc, 2)).toBe(0); // blank between H1 and H2 → H1
	});

	it('all lines inside a fenced code block belong to the same block', () => {
		const doc = '# H1\n\n```js\nconst x = 1;\nconst y = 2;\n```\n\n## After';
		expect(lineToBlockIndex(doc, 3)).toBe(1); // opening fence
		expect(lineToBlockIndex(doc, 4)).toBe(1); // inside
		expect(lineToBlockIndex(doc, 5)).toBe(1); // inside
		expect(lineToBlockIndex(doc, 6)).toBe(1); // closing fence
		expect(lineToBlockIndex(doc, 8)).toBe(2); // ## After
	});

	it('supports ~~~ fences the same way as backtick fences', () => {
		const doc = '~~~\ncode\n~~~\n\n# After';
		expect(lineToBlockIndex(doc, 1)).toBe(0);
		expect(lineToBlockIndex(doc, 2)).toBe(0);
		expect(lineToBlockIndex(doc, 3)).toBe(0);
		expect(lineToBlockIndex(doc, 5)).toBe(1);
	});

	it('skips frontmatter and aligns subsequent indices to the body', () => {
		const doc = '---\ntitle: Foo\n---\n\n# Body\nparagraph';
		expect(lineToBlockIndex(doc, 1)).toBeNull(); // frontmatter open
		expect(lineToBlockIndex(doc, 2)).toBeNull(); // inside frontmatter
		expect(lineToBlockIndex(doc, 5)).toBe(0); // first real block
		expect(lineToBlockIndex(doc, 6)).toBe(1); // second
	});

	it('handles two consecutive paragraphs (one block each)', () => {
		const doc = 'first paragraph\n\nsecond paragraph';
		expect(lineToBlockIndex(doc, 1)).toBe(0);
		expect(lineToBlockIndex(doc, 3)).toBe(1);
	});

	it('returns null for a leading blank line with no prior block', () => {
		expect(lineToBlockIndex('\n# title', 1)).toBeNull();
		expect(lineToBlockIndex('\n# title', 2)).toBe(0);
	});
});
