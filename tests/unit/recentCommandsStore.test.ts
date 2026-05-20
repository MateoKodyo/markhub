import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { recentCommandsStore } from '../../src/lib/commands/recent.svelte';

/**
 * The recent-commands store powers the "most recent at the top when the
 * input is empty" ranking in Command mode. It persists across reloads via
 * localStorage, caps at 10 entries, and dedupes on re-record so the same
 * command bubbling back up does not create duplicates.
 */

const LS_KEY = 'markus.commands.recent.v1';

describe('recentCommandsStore', () => {
	beforeEach(() => {
		localStorage.clear();
		recentCommandsStore.hydrate();
	});

	afterEach(() => {
		localStorage.clear();
	});

	it('starts empty when localStorage has nothing', () => {
		expect(recentCommandsStore.getRecent()).toEqual([]);
	});

	it('record() prepends a new id', () => {
		recentCommandsStore.record('view.toggleTheme');
		expect(recentCommandsStore.getRecent()).toEqual(['view.toggleTheme']);
	});

	it('record() places the most recent first', () => {
		recentCommandsStore.record('a');
		recentCommandsStore.record('b');
		recentCommandsStore.record('c');
		expect(recentCommandsStore.getRecent()).toEqual(['c', 'b', 'a']);
	});

	it('record() dedupes — re-recording an id moves it to the front', () => {
		recentCommandsStore.record('a');
		recentCommandsStore.record('b');
		recentCommandsStore.record('a');
		expect(recentCommandsStore.getRecent()).toEqual(['a', 'b']);
	});

	it('caps the list at 10 entries', () => {
		for (let i = 0; i < 15; i++) recentCommandsStore.record(`cmd.${i}`);
		const list = recentCommandsStore.getRecent();
		expect(list).toHaveLength(10);
		expect(list[0]).toBe('cmd.14');
		expect(list[9]).toBe('cmd.5');
	});

	it('persists to localStorage and is restored on hydrate()', () => {
		recentCommandsStore.record('a');
		recentCommandsStore.record('b');
		// Inspecting localStorage directly is the actual proof of persistence;
		// hydrate() re-reads its own backing so we can verify the round-trip
		// without needing to recreate the singleton instance.
		const raw = localStorage.getItem(LS_KEY);
		expect(raw).toBeTruthy();
		expect(JSON.parse(raw as string)).toEqual(['b', 'a']);
		recentCommandsStore.hydrate();
		expect(recentCommandsStore.getRecent()).toEqual(['b', 'a']);
	});

	it('clear() empties both memory and storage', () => {
		recentCommandsStore.record('a');
		recentCommandsStore.clear();
		expect(recentCommandsStore.getRecent()).toEqual([]);
		expect(localStorage.getItem(LS_KEY)).toBeNull();
	});

	it('hydrate() ignores malformed JSON in localStorage', () => {
		localStorage.setItem(LS_KEY, 'not-json{');
		recentCommandsStore.hydrate();
		expect(recentCommandsStore.getRecent()).toEqual([]);
	});

	it('hydrate() ignores non-array payloads in localStorage', () => {
		localStorage.setItem(LS_KEY, JSON.stringify({ not: 'array' }));
		recentCommandsStore.hydrate();
		expect(recentCommandsStore.getRecent()).toEqual([]);
	});
});
