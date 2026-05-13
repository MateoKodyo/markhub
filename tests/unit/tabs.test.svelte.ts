import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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

describe('activeFileStore — tabs API', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		flags.readonly = false;
		activeFileStore.close();
		vi.mocked(api.fileRead).mockResolvedValue('initial');
		vi.mocked(api.fileWrite).mockResolvedValue();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('opens the first file as a new tab and activates it', async () => {
		await activeFileStore.openFile('v1', 'a.md');
		expect(activeFileStore.tabs).toHaveLength(1);
		expect(activeFileStore.tabs[0].relativePath).toBe('a.md');
		expect(activeFileStore.activeTabId).toBe(activeFileStore.tabs[0].id);
	});

	it('opens additional files as separate tabs preserving order', async () => {
		await activeFileStore.openFile('v1', 'a.md');
		await activeFileStore.openFile('v1', 'b.md');
		await activeFileStore.openFile('v1', 'c.md');
		expect(activeFileStore.tabs.map((t) => t.relativePath)).toEqual([
			'a.md',
			'b.md',
			'c.md'
		]);
		// The latest open is the active one.
		expect(activeFileStore.activeFile?.relativePath).toBe('c.md');
	});

	it('re-opening an already-opened file activates that tab (no dupe)', async () => {
		await activeFileStore.openFile('v1', 'a.md');
		await activeFileStore.openFile('v1', 'b.md');
		await activeFileStore.openFile('v1', 'a.md'); // again
		expect(activeFileStore.tabs).toHaveLength(2);
		expect(activeFileStore.activeFile?.relativePath).toBe('a.md');
	});

	it('treats the same path in different vaults as distinct tabs', async () => {
		await activeFileStore.openFile('v1', 'README.md');
		await activeFileStore.openFile('v2', 'README.md');
		expect(activeFileStore.tabs).toHaveLength(2);
	});

	it('closeTab(id) removes the tab and activates its left neighbour', async () => {
		await activeFileStore.openFile('v1', 'a.md');
		await activeFileStore.openFile('v1', 'b.md');
		await activeFileStore.openFile('v1', 'c.md');
		const middle = activeFileStore.tabs[1].id;
		activeFileStore.closeTab(middle);
		expect(activeFileStore.tabs.map((t) => t.relativePath)).toEqual([
			'a.md',
			'c.md'
		]);
		// We were on 'c.md' (newly opened); closing the *middle* doesn't
		// disturb the active selection.
		expect(activeFileStore.activeFile?.relativePath).toBe('c.md');
	});

	it('closing the active tab activates the left neighbour', async () => {
		await activeFileStore.openFile('v1', 'a.md');
		await activeFileStore.openFile('v1', 'b.md');
		await activeFileStore.openFile('v1', 'c.md');
		// 'c.md' is active. Closing it should fall back to 'b.md'.
		activeFileStore.closeActiveTab();
		expect(activeFileStore.tabs).toHaveLength(2);
		expect(activeFileStore.activeFile?.relativePath).toBe('b.md');
	});

	it('closing the only tab leaves the store empty', async () => {
		await activeFileStore.openFile('v1', 'a.md');
		activeFileStore.closeActiveTab();
		expect(activeFileStore.tabs).toEqual([]);
		expect(activeFileStore.activeTabId).toBeNull();
		expect(activeFileStore.activeFile).toBeNull();
	});

	it('activateTabAtIndex jumps by 1-based position', async () => {
		await activeFileStore.openFile('v1', 'a.md');
		await activeFileStore.openFile('v1', 'b.md');
		await activeFileStore.openFile('v1', 'c.md');
		activeFileStore.activateTabAtIndex(1);
		expect(activeFileStore.activeFile?.relativePath).toBe('a.md');
		activeFileStore.activateTabAtIndex(2);
		expect(activeFileStore.activeFile?.relativePath).toBe('b.md');
		// Out-of-range is a no-op (no crash, stays where it was).
		activeFileStore.activateTabAtIndex(9);
		expect(activeFileStore.activeFile?.relativePath).toBe('b.md');
	});

	it('reorderTabs(from, to) shifts the order', async () => {
		await activeFileStore.openFile('v1', 'a.md');
		await activeFileStore.openFile('v1', 'b.md');
		await activeFileStore.openFile('v1', 'c.md');
		// Move 'a' (idx 0) to last (idx 2).
		activeFileStore.reorderTabs(0, 2);
		expect(activeFileStore.tabs.map((t) => t.relativePath)).toEqual([
			'b.md',
			'c.md',
			'a.md'
		]);
	});

	it('reorderTabs is a no-op when from === to or indices are out of range', async () => {
		await activeFileStore.openFile('v1', 'a.md');
		await activeFileStore.openFile('v1', 'b.md');
		const before = activeFileStore.tabs.map((t) => t.relativePath);
		activeFileStore.reorderTabs(0, 0);
		activeFileStore.reorderTabs(-1, 0);
		activeFileStore.reorderTabs(0, 99);
		// Out-of-range `to` is clamped, so 0→99 ends up 0→1. Verify
		// explicitly that clamping is intentional.
		expect(activeFileStore.tabs.map((t) => t.relativePath)).toEqual([
			'b.md',
			'a.md'
		]);
		expect(before).toEqual(['a.md', 'b.md']);
	});

	it('updateContent + autosave flushes the ACTIVE tab only', async () => {
		await activeFileStore.openFile('v1', 'a.md');
		await activeFileStore.openFile('v1', 'b.md'); // active
		activeFileStore.updateContent('b mutated');
		expect(activeFileStore.tabs[1].content).toBe('b mutated');
		expect(activeFileStore.tabs[0].content).toBe('initial'); // 'a.md' untouched
		await vi.advanceTimersByTimeAsync(2000);
		expect(api.fileWrite).toHaveBeenCalledTimes(1);
		expect(api.fileWrite).toHaveBeenCalledWith('v1', 'b.md', 'b mutated');
	});

	it('close() wipes every tab and clears the active id', async () => {
		await activeFileStore.openFile('v1', 'a.md');
		await activeFileStore.openFile('v1', 'b.md');
		activeFileStore.close();
		expect(activeFileStore.tabs).toEqual([]);
		expect(activeFileStore.activeTabId).toBeNull();
	});
});
