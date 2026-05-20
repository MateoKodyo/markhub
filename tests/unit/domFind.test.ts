import { describe, it, expect } from 'vitest';
import { findRangesInElement } from '../../src/lib/utils/domFind';

function el(html: string): HTMLElement {
	const d = document.createElement('div');
	d.innerHTML = html;
	return d;
}

describe('findRangesInElement', () => {
	it('returns no ranges for an empty query', () => {
		expect(findRangesInElement(el('<p>hello</p>'), '')).toEqual([]);
	});

	it('finds every occurrence in a single text node', () => {
		const ranges = findRangesInElement(el('<p>la la la</p>'), 'la');
		expect(ranges.length).toBe(3);
	});

	it('matches case-insensitively', () => {
		const ranges = findRangesInElement(el('<p>Hello HELLO hello</p>'), 'hello');
		expect(ranges.length).toBe(3);
	});

	it('spans matches across separate text nodes', () => {
		const ranges = findRangesInElement(
			el('<p>one <strong>two</strong> two</p>'),
			'two'
		);
		expect(ranges.length).toBe(2);
	});

	it('a range covers exactly the matched text', () => {
		const ranges = findRangesInElement(el('<p>abc target xyz</p>'), 'target');
		expect(ranges[0].toString()).toBe('target');
	});

	it('does not return overlapping matches', () => {
		const ranges = findRangesInElement(el('<p>aaaa</p>'), 'aa');
		expect(ranges.length).toBe(2);
	});
});
