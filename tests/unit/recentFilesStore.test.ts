import { beforeEach, describe, expect, it } from 'vitest';
import { recentFilesStore } from '../../src/lib/stores/recentFiles.svelte';

/**
 * MRU of {vaultId, relativePath} entries used by File mode to surface
 * recently-opened files first when the palette is opened with no query.
 * Persisted under `markus.files.recent.v1`. Cap 20. Dedupe by composite
 * `vaultId::relativePath` key.
 */

const LS_KEY = 'markus.files.recent.v1';

const F = (vaultId: string, relativePath: string) => ({ vaultId, relativePath });

describe('recentFilesStore', () => {
	beforeEach(() => {
		localStorage.clear();
		recentFilesStore.hydrate();
	});

	it('starts empty', () => {
		expect(recentFilesStore.getRecent()).toEqual([]);
	});

	it('record() prepends a file', () => {
		recentFilesStore.record(F('v1', 'a.md'));
		expect(recentFilesStore.getRecent()).toEqual([F('v1', 'a.md')]);
	});

	it('record() places most recent first', () => {
		recentFilesStore.record(F('v1', 'a.md'));
		recentFilesStore.record(F('v1', 'b.md'));
		recentFilesStore.record(F('v2', 'c.md'));
		expect(recentFilesStore.getRecent()).toEqual([
			F('v2', 'c.md'),
			F('v1', 'b.md'),
			F('v1', 'a.md')
		]);
	});

	it('dedupes on the (vaultId, relativePath) composite key', () => {
		recentFilesStore.record(F('v1', 'a.md'));
		recentFilesStore.record(F('v1', 'b.md'));
		recentFilesStore.record(F('v1', 'a.md'));
		expect(recentFilesStore.getRecent()).toEqual([
			F('v1', 'a.md'),
			F('v1', 'b.md')
		]);
	});

	it('treats the same path in different vaults as distinct entries', () => {
		recentFilesStore.record(F('v1', 'README.md'));
		recentFilesStore.record(F('v2', 'README.md'));
		expect(recentFilesStore.getRecent()).toHaveLength(2);
	});

	it('caps the list at 20 entries', () => {
		for (let i = 0; i < 25; i++) recentFilesStore.record(F('v', `f${i}.md`));
		expect(recentFilesStore.getRecent()).toHaveLength(20);
		expect(recentFilesStore.getRecent()[0]).toEqual(F('v', 'f24.md'));
	});

	it('persists across hydrate()', () => {
		recentFilesStore.record(F('v', 'a.md'));
		recentFilesStore.record(F('v', 'b.md'));
		expect(localStorage.getItem(LS_KEY)).toBeTruthy();
		recentFilesStore.hydrate();
		expect(recentFilesStore.getRecent()).toEqual([
			F('v', 'b.md'),
			F('v', 'a.md')
		]);
	});

	it('hydrate() drops malformed entries silently', () => {
		localStorage.setItem(LS_KEY, JSON.stringify('not-an-array'));
		recentFilesStore.hydrate();
		expect(recentFilesStore.getRecent()).toEqual([]);

		localStorage.setItem(LS_KEY, JSON.stringify([{ vaultId: 'v' }]));
		recentFilesStore.hydrate();
		expect(recentFilesStore.getRecent()).toEqual([]);
	});

	it('clear() empties memory and storage', () => {
		recentFilesStore.record(F('v', 'a.md'));
		recentFilesStore.clear();
		expect(recentFilesStore.getRecent()).toEqual([]);
		expect(localStorage.getItem(LS_KEY)).toBeNull();
	});
});
