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
		activeFileStore.activeFile = null;
		activeFileStore.content = '';
		activeFileStore.status = 'idle';
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
	it('openFile() goes loading → saved and loads the content', async () => {
		vi.mocked(api.fileRead).mockResolvedValue('hello world');

		const promise = activeFileStore.openFile('v1', 'note.md');
		// During the await, status should be 'loading'
		expect(activeFileStore.status).toBe('loading');
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
});
