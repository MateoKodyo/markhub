import { describe, it, expect, beforeEach } from 'vitest';
import { findStore, computeMatches } from '../../src/lib/stores/find.svelte';

describe('computeMatches', () => {
	it('returns empty on empty query', () => {
		expect(computeMatches('hello world', '')).toEqual([]);
	});

	it('returns empty when needle absent', () => {
		expect(computeMatches('hello world', 'xyz')).toEqual([]);
	});

	it('finds all non-overlapping matches', () => {
		expect(computeMatches('hello hello hello', 'hello')).toEqual([0, 6, 12]);
	});

	it('matches case-insensitively', () => {
		expect(computeMatches('Hello HELLO hello', 'hello')).toEqual([0, 6, 12]);
	});

	it('does NOT return overlapping matches ("aa" in "aaaa" → 2 hits)', () => {
		expect(computeMatches('aaaa', 'aa')).toEqual([0, 2]);
	});
});

describe('findStore', () => {
	beforeEach(() => {
		findStore.close();
	});

	it('starts closed with empty state', () => {
		expect(findStore.isOpen).toBe(false);
		expect(findStore.query).toBe('');
		expect(findStore.matchCount).toBe(0);
		expect(findStore.activeIndex).toBe(-1);
	});

	it('open() flips visibility and pulses the focus signal', () => {
		const before = findStore.focusSeq;
		findStore.open();
		expect(findStore.isOpen).toBe(true);
		expect(findStore.focusSeq).toBe(before + 1);
	});

	it('requestFocus() pulses the focus signal without opening', () => {
		const before = findStore.focusSeq;
		findStore.requestFocus();
		expect(findStore.focusSeq).toBe(before + 1);
		expect(findStore.isOpen).toBe(false);
	});

	it('setQuery() stores the query and drops the active match', () => {
		findStore.setQuery('hello');
		expect(findStore.query).toBe('hello');
		expect(findStore.activeIndex).toBe(-1);
	});

	it('reportMatches() lands the cursor on the first hit', () => {
		findStore.setQuery('hello');
		findStore.reportMatches(3);
		expect(findStore.matchCount).toBe(3);
		expect(findStore.activeIndex).toBe(0);
	});

	it('reportMatches(0) clears the active match', () => {
		findStore.setQuery('hello');
		findStore.reportMatches(3);
		findStore.reportMatches(0);
		expect(findStore.matchCount).toBe(0);
		expect(findStore.activeIndex).toBe(-1);
	});

	it('reportMatches() clamps an out-of-range active index', () => {
		findStore.setQuery('hello');
		findStore.reportMatches(5);
		findStore.next();
		findStore.next();
		expect(findStore.activeIndex).toBe(2);
		// The document shrank — only 2 matches left now.
		findStore.reportMatches(2);
		expect(findStore.activeIndex).toBe(0);
	});

	it('next() cycles through matches and wraps at the end', () => {
		findStore.setQuery('hello');
		findStore.reportMatches(3);
		expect(findStore.activeIndex).toBe(0);
		findStore.next();
		expect(findStore.activeIndex).toBe(1);
		findStore.next();
		expect(findStore.activeIndex).toBe(2);
		findStore.next();
		expect(findStore.activeIndex).toBe(0); // wrapped
	});

	it('previous() cycles backwards and wraps at the start', () => {
		findStore.setQuery('hello');
		findStore.reportMatches(3);
		findStore.previous();
		expect(findStore.activeIndex).toBe(2); // wrapped from 0 to last
		findStore.previous();
		expect(findStore.activeIndex).toBe(1);
	});

	it('next/previous are no-ops with zero matches', () => {
		findStore.setQuery('xyz');
		findStore.reportMatches(0);
		expect(() => findStore.next()).not.toThrow();
		expect(() => findStore.previous()).not.toThrow();
		expect(findStore.activeIndex).toBe(-1);
	});

	it('close() resets query, count and active index', () => {
		findStore.setQuery('hello');
		findStore.reportMatches(3);
		findStore.close();
		expect(findStore.isOpen).toBe(false);
		expect(findStore.query).toBe('');
		expect(findStore.matchCount).toBe(0);
		expect(findStore.activeIndex).toBe(-1);
	});
});
