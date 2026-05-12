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

import SettingsBehavior from '../../src/lib/components/SettingsBehavior.svelte';
import { settingsStore } from '../../src/lib/stores/settings.svelte';

describe('SettingsBehavior', () => {
	beforeEach(() => {
		settingsStore.resetForTest();
	});

	it('renders the ask-before-closing toggle', () => {
		render(SettingsBehavior);
		expect(screen.getByTestId('behavior-toggle-ask-unsaved')).toBeInTheDocument();
	});

	it('defaults to ON', () => {
		render(SettingsBehavior);
		expect(
			screen.getByTestId('behavior-toggle-ask-unsaved').getAttribute('aria-checked')
		).toBe('true');
	});

	it('clicking the toggle flips the setting', async () => {
		render(SettingsBehavior);
		const toggle = screen.getByTestId('behavior-toggle-ask-unsaved');
		await fireEvent.click(toggle);
		expect(settingsStore.current.behavior.askBeforeClosingUnsaved).toBe(false);
		await fireEvent.click(toggle);
		expect(settingsStore.current.behavior.askBeforeClosingUnsaved).toBe(true);
	});

	it('toggle exposes role="switch" with a stable label binding', () => {
		render(SettingsBehavior);
		const toggle = screen.getByTestId('behavior-toggle-ask-unsaved');
		expect(toggle.getAttribute('role')).toBe('switch');
		expect(toggle.getAttribute('aria-labelledby')).toBe('ask-unsaved-label');
	});
});
