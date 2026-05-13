import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Hoisted so the mock factory closure can read the latest value reliably.
const flags = vi.hoisted(() => ({ readonly: false }));

vi.mock('$lib/tauri/api', () => ({
	fileRead: vi.fn(),
	fileWrite: vi.fn()
}));

vi.mock('../../src/lib/stores/vaults.svelte', () => ({
	vaultsStore: {
		get isActiveVaultReadonly() {
			return flags.readonly;
		},
		setLastOpenedFile: vi.fn().mockResolvedValue(undefined)
	}
}));

import * as api from '$lib/tauri/api';
import { activeFileStore } from '../../src/lib/stores/activeFile.svelte';

const DEBOUNCE_MS = 1500;

describe('activeFileStore', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		flags.readonly = false;
		// activeFile / content / status are now read-only derived views
		// over the tab list. Reset by closing every tab.
		activeFileStore.close();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	// ------ B4.1 — initial state ------
	it('starts in idle with no active file and empty content', () => {
		expect(activeFileStore.activeFile).toBeNull();
		expect(activeFileStore.content).toBe('');
		expect(activeFileStore.status).toBe('idle');
	});

	// ------ B4.2 — openFile transitions loading → saved ------
	it('openFile() lands the new tab as saved + active once fileRead resolves', async () => {
		vi.mocked(api.fileRead).mockResolvedValue('hello world');

		// With the tab-aware refactor, the new tab is inserted atomically
		// after fileRead resolves — no transient 'loading' status visible
		// on the store. The previous state stays put until the read returns.
		const promise = activeFileStore.openFile('v1', 'note.md');
		expect(activeFileStore.status).toBe('idle');
		expect(activeFileStore.activeFile).toBeNull();
		await promise;
		expect(activeFileStore.status).toBe('saved');
		expect(activeFileStore.content).toBe('hello world');
		expect(activeFileStore.activeFile).toEqual({ vaultId: 'v1', relativePath: 'note.md' });
		expect(api.fileRead).toHaveBeenCalledWith('v1', 'note.md');
	});

	// ------ B4.3 — updateContent flips to modified, schedules debounced save ------
	it('updateContent() flips status to modified and schedules a debounced save', async () => {
		vi.mocked(api.fileRead).mockResolvedValue('initial');
		vi.mocked(api.fileWrite).mockResolvedValue();
		await activeFileStore.openFile('v1', 'note.md');
		expect(activeFileStore.status).toBe('saved');

		activeFileStore.updateContent('mutated');
		expect(activeFileStore.status).toBe('modified');
		expect(activeFileStore.content).toBe('mutated');
		expect(api.fileWrite).not.toHaveBeenCalled();
	});

	// ------ B4.4 — after debounce, status saving → saved ------
	it('flushes the save after 1500ms of inactivity', async () => {
		vi.mocked(api.fileRead).mockResolvedValue('initial');
		vi.mocked(api.fileWrite).mockResolvedValue();
		await activeFileStore.openFile('v1', 'note.md');
		activeFileStore.updateContent('mutated');

		// Advance past the debounce delay.
		await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
		// Allow microtasks (the awaited fileWrite + state transitions) to flush.
		await Promise.resolve();

		expect(api.fileWrite).toHaveBeenCalledWith('v1', 'note.md', 'mutated');
		expect(activeFileStore.status).toBe('saved');
	});

	// ------ B4.5 — forceSave saves immediately, cancels the debounce ------
	it('forceSave() saves immediately and cancels any pending debounce', async () => {
		vi.mocked(api.fileRead).mockResolvedValue('initial');
		vi.mocked(api.fileWrite).mockResolvedValue();
		await activeFileStore.openFile('v1', 'note.md');
		activeFileStore.updateContent('mutated');

		await activeFileStore.forceSave();
		expect(api.fileWrite).toHaveBeenCalledTimes(1);
		expect(api.fileWrite).toHaveBeenCalledWith('v1', 'note.md', 'mutated');
		expect(activeFileStore.status).toBe('saved');

		// Advance debounce — pending timer should have been canceled.
		await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
		await Promise.resolve();
		expect(api.fileWrite).toHaveBeenCalledTimes(1);
	});

	// ------ B4.6 — readonly vault: updateContent never writes to disk ------
	it('updateContent() never schedules a write when the active vault is readonly', async () => {
		vi.mocked(api.fileRead).mockResolvedValue('readme');
		vi.mocked(api.fileWrite).mockResolvedValue();
		await activeFileStore.openFile('v2', 'readme.md');

		flags.readonly = true;
		activeFileStore.updateContent('attempted edit');

		// Even after the debounce, no write should have happened.
		await vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 2);
		await Promise.resolve();
		expect(api.fileWrite).not.toHaveBeenCalled();
	});

	// ------ B4.7 — atomic update: activeFile is NOT set during the read ------
	// Root cause of P0-2: setting activeFile before the read makes editorKey
	// flip and remount Editor with stale content. Atomic update guarantees that
	// activeFile and content move together, AFTER fileRead resolves.
	it('does not mutate activeFile or content until fileRead resolves', async () => {
		let resolveRead!: (value: string) => void;
		vi.mocked(api.fileRead).mockImplementationOnce(
			() => new Promise<string>((r) => (resolveRead = r))
		);

		const promise = activeFileStore.openFile('v1', 'lazy.md');
		// Yield once so the synchronous prelude of openFile runs.
		await Promise.resolve();

		// Atomic invariant: the new tab is not inserted until fileRead
		// resolves. The store stays in its prior state (no active tab).
		expect(activeFileStore.activeFile).toBeNull();
		expect(activeFileStore.content).toBe('');
		expect(activeFileStore.status).toBe('idle');

		resolveRead('lazy body');
		await promise;

		expect(activeFileStore.activeFile).toEqual({ vaultId: 'v1', relativePath: 'lazy.md' });
		expect(activeFileStore.content).toBe('lazy body');
		expect(activeFileStore.status).toBe('saved');
	});

	// ------ B4.8 — concurrent calls: only the LATEST wins ------
	// Even if A's read finishes after B's, the user clicked B last so B should
	// be on screen, not A. Without a requestId guard, A would clobber B.
	it('with two concurrent openFile calls, only the most recent takes effect', async () => {
		let resolveA!: (v: string) => void;
		let resolveB!: (v: string) => void;
		vi.mocked(api.fileRead)
			.mockImplementationOnce(() => new Promise<string>((r) => (resolveA = r)))
			.mockImplementationOnce(() => new Promise<string>((r) => (resolveB = r)));

		const callA = activeFileStore.openFile('v1', 'A.md');
		const callB = activeFileStore.openFile('v1', 'B.md');

		// B finishes first (the user-selected file).
		resolveB('B body');
		await callB;

		expect(activeFileStore.activeFile).toEqual({ vaultId: 'v1', relativePath: 'B.md' });
		expect(activeFileStore.content).toBe('B body');

		// A's late-arriving read MUST be discarded.
		resolveA('A body');
		await callA;

		expect(activeFileStore.activeFile).toEqual({ vaultId: 'v1', relativePath: 'B.md' });
		expect(activeFileStore.content).toBe('B body');
	});

	// ------ B4.9 — three rapid concurrent calls, out-of-order resolution ------
	it('with three rapid openFile calls resolving out of order, only the last call wins', async () => {
		let resolveA!: (v: string) => void;
		let resolveB!: (v: string) => void;
		let resolveC!: (v: string) => void;
		vi.mocked(api.fileRead)
			.mockImplementationOnce(() => new Promise<string>((r) => (resolveA = r)))
			.mockImplementationOnce(() => new Promise<string>((r) => (resolveB = r)))
			.mockImplementationOnce(() => new Promise<string>((r) => (resolveC = r)));

		const callA = activeFileStore.openFile('v1', 'A.md');
		const callB = activeFileStore.openFile('v1', 'B.md');
		const callC = activeFileStore.openFile('v1', 'C.md');

		// Reverse-ish resolution order: B, then C, then A (the laggard).
		resolveB('B body');
		await Promise.resolve();
		resolveC('C body');
		await Promise.resolve();
		resolveA('A body');
		await Promise.all([callA, callB, callC]);

		// The user clicked C last, so C must be the final state.
		expect(activeFileStore.activeFile).toEqual({ vaultId: 'v1', relativePath: 'C.md' });
		expect(activeFileStore.content).toBe('C body');
	});

	// ------ B4.10 — empty file (P0-3 auto-open after creation) ------
	// fileCreate produces a 0-byte file; fileRead returns "". The atomic update
	// must still kick in so the new file becomes the active one with empty body.
	it('opens an empty file with content="" (post-creation auto-open scenario)', async () => {
		vi.mocked(api.fileRead).mockResolvedValueOnce('');

		await activeFileStore.openFile('v1', 'newly-created.md');

		expect(activeFileStore.activeFile).toEqual({ vaultId: 'v1', relativePath: 'newly-created.md' });
		expect(activeFileStore.content).toBe('');
		expect(activeFileStore.status).toBe('saved');
	});

	// ------ B4.11 — error from fileRead is reported only if it's the latest call ------
	it('a stale failed openFile does not flip status to error if a newer one succeeded', async () => {
		let rejectA!: (e: unknown) => void;
		vi.mocked(api.fileRead)
			.mockImplementationOnce(() => new Promise<string>((_, rej) => (rejectA = rej)))
			.mockResolvedValueOnce('B body');

		const callA = activeFileStore.openFile('v1', 'A.md').catch(() => {});
		const callB = activeFileStore.openFile('v1', 'B.md');
		await callB;
		// Only AFTER B has settled, A errors out.
		rejectA(new Error('boom'));
		await callA;

		expect(activeFileStore.status).toBe('saved');
		expect(activeFileStore.activeFile).toEqual({ vaultId: 'v1', relativePath: 'B.md' });
	});
});
