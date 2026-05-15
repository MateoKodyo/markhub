import { describe, expect, it } from 'vitest';
import {
	EMPTY_PARAGRAPH_MARKER,
	unwrapEmptyParagraphs,
	wrapEmptyParagraphs
} from '../../../src/lib/utils/blocknoteEmpty';

describe('wrapEmptyParagraphs', () => {
	it('injects the NBSP marker into paragraphs with empty content array', () => {
		const input = [{ type: 'paragraph', content: [] }];
		const out = wrapEmptyParagraphs(input);
		expect(out[0].content).toEqual([
			{ type: 'text', text: EMPTY_PARAGRAPH_MARKER, styles: {} }
		]);
	});

	it('injects the marker into paragraphs whose text nodes are all empty strings', () => {
		const input = [
			{
				type: 'paragraph',
				content: [
					{ type: 'text', text: '', styles: {} },
					{ type: 'text', text: '', styles: {} }
				]
			}
		];
		const out = wrapEmptyParagraphs(input);
		expect(out[0].content).toEqual([
			{ type: 'text', text: EMPTY_PARAGRAPH_MARKER, styles: {} }
		]);
	});

	it('does not touch paragraphs that contain real text', () => {
		const input = [
			{ type: 'paragraph', content: [{ type: 'text', text: 'hello', styles: {} }] }
		];
		const out = wrapEmptyParagraphs(input);
		expect(out[0].content).toEqual([{ type: 'text', text: 'hello', styles: {} }]);
	});

	it('does not touch non-paragraph blocks (heading, list item, code block)', () => {
		const input = [
			{ type: 'heading', content: [], props: { level: 2 } },
			{ type: 'bulletListItem', content: [] },
			{ type: 'codeBlock', content: [] }
		];
		const out = wrapEmptyParagraphs(input);
		// All preserved as-is — only paragraphs get the NBSP treatment.
		expect(out).toEqual(input);
	});

	it('does not mutate the input array (BlockNote document is live state)', () => {
		const input = [{ type: 'paragraph', content: [] }];
		const before = JSON.parse(JSON.stringify(input));
		wrapEmptyParagraphs(input);
		expect(input).toEqual(before);
	});

	it('preserves the order of consecutive empty paragraphs', () => {
		const input = [
			{ type: 'paragraph', content: [{ type: 'text', text: 'A', styles: {} }] },
			{ type: 'paragraph', content: [] },
			{ type: 'paragraph', content: [] },
			{ type: 'paragraph', content: [{ type: 'text', text: 'B', styles: {} }] }
		];
		const out = wrapEmptyParagraphs(input);
		expect(out).toHaveLength(4);
		expect(out[0].content).toEqual([{ type: 'text', text: 'A', styles: {} }]);
		expect(out[1].content).toEqual([
			{ type: 'text', text: EMPTY_PARAGRAPH_MARKER, styles: {} }
		]);
		expect(out[2].content).toEqual([
			{ type: 'text', text: EMPTY_PARAGRAPH_MARKER, styles: {} }
		]);
		expect(out[3].content).toEqual([{ type: 'text', text: 'B', styles: {} }]);
	});

	it('recurses into block children', () => {
		const input = [
			{
				type: 'bulletListItem',
				content: [{ type: 'text', text: 'item', styles: {} }],
				children: [{ type: 'paragraph', content: [] }]
			}
		];
		const out = wrapEmptyParagraphs(input);
		expect(out[0].children?.[0].content).toEqual([
			{ type: 'text', text: EMPTY_PARAGRAPH_MARKER, styles: {} }
		]);
	});
});

describe('unwrapEmptyParagraphs', () => {
	it('strips a marker-only paragraph back to empty content', () => {
		const input = [
			{
				type: 'paragraph',
				content: [{ type: 'text', text: EMPTY_PARAGRAPH_MARKER, styles: {} }]
			}
		];
		const out = unwrapEmptyParagraphs(input);
		expect(out[0].content).toEqual([]);
	});

	it('leaves paragraphs that contain real NBSP-then-text untouched', () => {
		// User might legitimately have an NBSP followed by text — don't
		// strip that, only the single-marker case.
		const input = [
			{
				type: 'paragraph',
				content: [
					{ type: 'text', text: EMPTY_PARAGRAPH_MARKER + 'hello', styles: {} }
				]
			}
		];
		const out = unwrapEmptyParagraphs(input);
		expect(out[0].content).toEqual([
			{ type: 'text', text: EMPTY_PARAGRAPH_MARKER + 'hello', styles: {} }
		]);
	});

	it('leaves paragraphs with styled NBSP untouched (user formatted it)', () => {
		const input = [
			{
				type: 'paragraph',
				content: [
					{ type: 'text', text: EMPTY_PARAGRAPH_MARKER, styles: { bold: true } }
				]
			}
		];
		const out = unwrapEmptyParagraphs(input);
		// Styled marker is not "ours" — preserve.
		expect(out[0].content).toEqual([
			{ type: 'text', text: EMPTY_PARAGRAPH_MARKER, styles: { bold: true } }
		]);
	});

	it('is idempotent — second call is a no-op', () => {
		const input = [
			{
				type: 'paragraph',
				content: [{ type: 'text', text: EMPTY_PARAGRAPH_MARKER, styles: {} }]
			}
		];
		const once = unwrapEmptyParagraphs(input);
		const twice = unwrapEmptyParagraphs(once);
		expect(twice[0].content).toEqual([]);
	});

	it('recurses into block children', () => {
		const input = [
			{
				type: 'bulletListItem',
				content: [{ type: 'text', text: 'item', styles: {} }],
				children: [
					{
						type: 'paragraph',
						content: [{ type: 'text', text: EMPTY_PARAGRAPH_MARKER, styles: {} }]
					}
				]
			}
		];
		const out = unwrapEmptyParagraphs(input);
		expect(out[0].children?.[0].content).toEqual([]);
	});
});

describe('round-trip stability', () => {
	it('wrap then unwrap recovers the original empty-paragraph shape', () => {
		const input = [
			{ type: 'paragraph', content: [{ type: 'text', text: 'A', styles: {} }] },
			{ type: 'paragraph', content: [] },
			{ type: 'paragraph', content: [{ type: 'text', text: 'B', styles: {} }] }
		];
		const wrapped = wrapEmptyParagraphs(input);
		const restored = unwrapEmptyParagraphs(wrapped);
		expect(restored).toEqual(input);
	});

	it('wrap of already-wrapped is stable (markers stay as markers)', () => {
		const input = [{ type: 'paragraph', content: [] }];
		const once = wrapEmptyParagraphs(input);
		const twice = wrapEmptyParagraphs(once);
		// First wrap injected the marker. Second pass sees a non-empty
		// paragraph (the marker), so it's left untouched.
		expect(twice).toEqual(once);
	});
});
