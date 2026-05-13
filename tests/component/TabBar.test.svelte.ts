import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';

const flags = vi.hoisted(() => ({ readonly: false }));

vi.mock('$lib/tauri/api', () => ({
	fileRead: vi.fn().mockResolvedValue('content'),
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

import TabBar from '../../src/lib/components/TabBar.svelte';
import { activeFileStore } from '../../src/lib/stores/activeFile.svelte';

describe('TabBar', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		activeFileStore.close();
	});

	it('renders nothing when there are no open tabs', () => {
		render(TabBar);
		expect(screen.queryByTestId('tab-bar')).toBeNull();
	});

	it('renders one tab per open file with its filename', async () => {
		await activeFileStore.openFile('v1', 'notes/alpha.md');
		await activeFileStore.openFile('v1', 'notes/beta.md');
		render(TabBar);
		const tabs = screen.getAllByTestId('tab');
		expect(tabs).toHaveLength(2);
		expect(tabs[0].textContent).toContain('alpha.md');
		expect(tabs[1].textContent).toContain('beta.md');
	});

	it('marks the active tab with `is-active` + aria-selected', async () => {
		await activeFileStore.openFile('v1', 'a.md');
		await activeFileStore.openFile('v1', 'b.md'); // b is now active
		render(TabBar);
		const tabs = screen.getAllByTestId('tab');
		expect(tabs[0].classList.contains('is-active')).toBe(false);
		expect(tabs[0].getAttribute('aria-selected')).toBe('false');
		expect(tabs[1].classList.contains('is-active')).toBe(true);
		expect(tabs[1].getAttribute('aria-selected')).toBe('true');
	});

	it('clicking a tab activates it', async () => {
		await activeFileStore.openFile('v1', 'a.md');
		await activeFileStore.openFile('v1', 'b.md');
		render(TabBar);
		const tabs = screen.getAllByTestId('tab');
		await fireEvent.click(tabs[0]);
		expect(activeFileStore.activeFile?.relativePath).toBe('a.md');
	});

	it('clicking the × on a tab closes that tab WITHOUT activating it', async () => {
		await activeFileStore.openFile('v1', 'a.md');
		await activeFileStore.openFile('v1', 'b.md');
		await activeFileStore.openFile('v1', 'c.md'); // c is active
		render(TabBar);
		// Close 'a' (the leftmost). 'c' should stay active.
		const closes = screen.getAllByTestId('tab-close');
		await fireEvent.click(closes[0]);
		expect(activeFileStore.tabs.map((t) => t.relativePath)).toEqual([
			'b.md',
			'c.md'
		]);
		expect(activeFileStore.activeFile?.relativePath).toBe('c.md');
	});

	it('exposes the full relative path as a tooltip', async () => {
		await activeFileStore.openFile('v1', 'notes/deep/file.md');
		render(TabBar);
		const tab = screen.getByTestId('tab');
		expect(tab.getAttribute('title')).toBe('notes/deep/file.md');
	});
});
