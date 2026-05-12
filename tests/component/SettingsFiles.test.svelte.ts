import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';

vi.mock('../../src/lib/tauri/api', () => ({
	settingsRead: vi.fn().mockResolvedValue(null),
	settingsWrite: vi.fn().mockResolvedValue(undefined)
}));

const { themeSetPreference, themeInit } = vi.hoisted(() => ({
	themeSetPreference: vi.fn().mockResolvedValue(undefined),
	themeInit: vi.fn()
}));
vi.mock('../../src/lib/stores/theme.svelte', () => ({
	themeStore: {
		init: themeInit,
		setPreference: themeSetPreference,
		preference: 'system'
	}
}));

import SettingsFiles from '../../src/lib/components/SettingsFiles.svelte';
import { settingsStore } from '../../src/lib/stores/settings.svelte';

describe('SettingsFiles', () => {
	beforeEach(() => {
		settingsStore.resetForTest();
	});

	it('renders the confirm-delete toggle', () => {
		render(SettingsFiles);
		expect(screen.getByTestId('files-toggle-confirm-delete')).toBeInTheDocument();
	});

	it('defaults to ON', () => {
		render(SettingsFiles);
		expect(
			screen.getByTestId('files-toggle-confirm-delete').getAttribute('aria-checked')
		).toBe('true');
	});

	it('clicking the toggle flips the setting', async () => {
		render(SettingsFiles);
		const toggle = screen.getByTestId('files-toggle-confirm-delete');
		await fireEvent.click(toggle);
		expect(settingsStore.current.files.confirmDelete).toBe(false);
		expect(toggle.getAttribute('aria-checked')).toBe('false');
		await fireEvent.click(toggle);
		expect(settingsStore.current.files.confirmDelete).toBe(true);
		expect(toggle.getAttribute('aria-checked')).toBe('true');
	});

	it('toggle exposes role="switch" with a stable label binding', () => {
		render(SettingsFiles);
		const toggle = screen.getByTestId('files-toggle-confirm-delete');
		expect(toggle.getAttribute('role')).toBe('switch');
		expect(toggle.getAttribute('aria-labelledby')).toBe('confirm-delete-label');
	});
});
