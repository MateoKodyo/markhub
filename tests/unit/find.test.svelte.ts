import { describe, it, expect, beforeEach, vi } from 'vitest';

const flags = vi.hoisted(() => ({ readonly: false }));

vi.mock('$lib/tauri/api', () => ({
	fileRead: vi.fn().mockResolvedValue('hello world hello universe HELLO'),
	fileWrite: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/lib/stores/vaults.svelte', () => ({
	vaultsStore: {
		get isActiveVaultReadonly() {
			return flags.readonly;
		},
		setLastOpenedFile: vi.fn().mockResolvedValue(undefined)
	}
}));

import { findStore, computeMatches } from '../../src/lib/stores/find.svelte';
import { activeFileStore } from '../../src/lib/stores/activeFile.svelte';

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
		activeFileStore.close();
	});

	it('starts closed with empty state', () => {
		expect(findStore.isOpen).toBe(false);
		expect(findStore.query).toBe('');
		expect(findStore.matches).toEqual([]);
		expect(findStore.activeIndex).toBe(-1);
	});

	it('open() flips visibility and computes matches against active tab', async () => {
		await activeFileStore.openFile('v1', 'note.md');
		findStore.open();
		expect(findStore.isOpen).toBe(true);
		// Initial query empty → no matches yet.
		expect(findStore.matches).toEqual([]);
	});

	it('setQuery computes matches and lands the cursor on the first one', async () => {
		await activeFileStore.openFile('v1', 'note.md');
		findStore.open();
		findStore.setQuery('hello');
		expect(findStore.matches).toEqual([0, 12, 27]);
		expect(findStore.activeIndex).toBe(0);
	});

	it('next() cycles through matches and wraps at the end', async () => {
		await activeFileStore.openFile('v1', 'note.md');
		findStore.open();
		findStore.setQuery('hello');
		expect(findStore.activeIndex).toBe(0);
		findStore.next();
		expect(findStore.activeIndex).toBe(1);
		findStore.next();
		expect(findStore.activeIndex).toBe(2);
		findStore.next();
		expect(findStore.activeIndex).toBe(0); // wrapped
	});

	it('previous() cycles backwards and wraps at the start', async () => {
		await activeFileStore.openFile('v1', 'note.md');
		findStore.open();
		findStore.setQuery('hello');
		findStore.previous();
		expect(findStore.activeIndex).toBe(2); // wrapped from 0 to last
		findStore.previous();
		expect(findStore.activeIndex).toBe(1);
	});

	it('close() resets the query + matches + active index', async () => {
		await activeFileStore.openFile('v1', 'note.md');
		findStore.open();
		findStore.setQuery('hello');
		findStore.close();
		expect(findStore.isOpen).toBe(false);
		expect(findStore.query).toBe('');
		expect(findStore.matches).toEqual([]);
		expect(findStore.activeIndex).toBe(-1);
	});

	it('next/previous are no-ops with zero matches', async () => {
		await activeFileStore.openFile('v1', 'note.md');
		findStore.open();
		findStore.setQuery('xyz');
		expect(findStore.matches).toEqual([]);
		expect(() => findStore.next()).not.toThrow();
		expect(() => findStore.previous()).not.toThrow();
		expect(findStore.activeIndex).toBe(-1);
	});

	it('refresh() picks up content changes from the active tab', async () => {
		await activeFileStore.openFile('v1', 'note.md');
		findStore.open();
		findStore.setQuery('hello');
		expect(findStore.matches.length).toBe(3);
		// Simulate the user editing the active tab — drop two of the
		// three hellos.
		activeFileStore.updateContent('one hello two');
		findStore.refresh();
		expect(findStore.matches).toEqual([4]);
		expect(findStore.activeIndex).toBe(0);
	});
});
