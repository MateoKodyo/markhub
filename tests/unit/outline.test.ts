import { describe, expect, it } from 'vitest';
import { extractHeadings } from '../../src/lib/utils/markdown';

describe('extractHeadings', () => {
	it('returns an empty list for an empty document', () => {
		expect(extractHeadings('')).toEqual([]);
		expect(extractHeadings('plain prose with no headings')).toEqual([]);
	});

	it('picks up a simple H1 with its level + text + 1-based line + index', () => {
		expect(extractHeadings('# Hello')).toEqual([
			{ level: 1, text: 'Hello', line: 1, index: 0 }
		]);
	});

	it('captures every ATX level (1 through 6)', () => {
		const doc = '# one\n## two\n### three\n#### four\n##### five\n###### six';
		const out = extractHeadings(doc);
		expect(out.map((h) => h.level)).toEqual([1, 2, 3, 4, 5, 6]);
		expect(out.map((h) => h.text)).toEqual([
			'one',
			'two',
			'three',
			'four',
			'five',
			'six'
		]);
		// Line numbers should be 1-based and sequential.
		expect(out.map((h) => h.line)).toEqual([1, 2, 3, 4, 5, 6]);
		expect(out.map((h) => h.index)).toEqual([0, 1, 2, 3, 4, 5]);
	});

	it('ignores 7+ hash marks (max ATX depth is 6)', () => {
		expect(extractHeadings('####### too deep')).toEqual([]);
	});

	it('requires whitespace after the hashes (so `#nope` is plain text)', () => {
		expect(extractHeadings('#nope\n# yes')).toEqual([
			{ level: 1, text: 'yes', line: 2, index: 0 }
		]);
	});

	it('trims trailing # decorations and surrounding whitespace', () => {
		expect(extractHeadings('## Title ##')).toEqual([
			{ level: 2, text: 'Title', line: 1, index: 0 }
		]);
	});

	it('skips frontmatter and keeps line numbers aligned with the original content', () => {
		const doc = '---\ntitle: Foo\n---\n\n# Body heading\nbody text';
		expect(extractHeadings(doc)).toEqual([
			{ level: 1, text: 'Body heading', line: 5, index: 0 }
		]);
	});

	it('skips # lines inside fenced code blocks (```)', () => {
		const doc = '# Real\n\n```bash\n# inside fence — not a heading\n```\n\n## After';
		const out = extractHeadings(doc);
		expect(out.map((h) => h.text)).toEqual(['Real', 'After']);
	});

	it('skips # lines inside tilde fences (~~~)', () => {
		const doc = '~~~\n# inside tilde fence\n~~~\n\n# Real';
		expect(extractHeadings(doc).map((h) => h.text)).toEqual(['Real']);
	});

	it('drops heading lines with no text after the hashes', () => {
		// "# " (hash + space + nothing) doesn't match the `(.+?)` capture,
		// so the line is silently skipped — no heading record emitted.
		expect(extractHeadings('# ')).toEqual([]);
		expect(extractHeadings('###    ')).toEqual([]);
	});

	it('does not pick up setext-style underlined headings', () => {
		// Setext: "Title\n===" / "Sub\n---". Not part of our scope — BlockNote
		// doesn't emit them and source-mode users type ATX.
		expect(extractHeadings('Title\n===\n\nSub\n---')).toEqual([]);
	});
});
