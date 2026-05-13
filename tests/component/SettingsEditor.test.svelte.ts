import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';

vi.mock('../../src/lib/tauri/api', () => ({
	settingsRead: vi.fn().mockResolvedValue({
		version: 1,
		appearance: {
			theme: 'system',
			editorFont: 'geist',
			editorFontSize: 16,
			editorLineHeight: 1.6,
			editorContentWidth: 720
		},
		editor: { autosaveDelayMs: 1500, spellCheck: true },
		source: { monoFont: 'geist-mono' },
		files: { confirmDelete: true },
	}),
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

import SettingsEditor from '../../src/lib/components/SettingsEditor.svelte';
import { settingsStore } from '../../src/lib/stores/settings.svelte';

describe('SettingsEditor', () => {
	beforeEach(() => {
		settingsStore.resetForTest();
	});

	// ------ S5.1 — renders the two controls ------
	it('renders the autosave slider and the spellcheck toggle', () => {
		render(SettingsEditor);
		expect(screen.getByTestId('editor-slider-autosave')).toBeInTheDocument();
		expect(screen.getByTestId('editor-toggle-spellcheck')).toBeInTheDocument();
	});

	// ------ S5.2 — defaults match DEFAULT_USER_SETTINGS ------
	it('shows the default autosave value (1500 ms → "1.5 s") and spellcheck ON', () => {
		render(SettingsEditor);
		// "1.5 s" is the formatted chip
		expect(screen.getByText('1.5 s')).toBeInTheDocument();
		expect(
			screen.getByTestId('editor-toggle-spellcheck').getAttribute('aria-checked')
		).toBe('true');
	});

	// ------ S5.3 — moving autosave slider updates the store + label ------
	it('moving the autosave slider updates autosaveDelayMs and the label', async () => {
		render(SettingsEditor);
		const slider = screen.getByTestId('editor-slider-autosave') as HTMLInputElement;
		await fireEvent.input(slider, { target: { value: '500' } });
		expect(settingsStore.current.editor.autosaveDelayMs).toBe(500);
		expect(screen.getByText('500 ms')).toBeInTheDocument();
	});

	// ------ S5.4 — autosave label formats high values as seconds ------
	it('formats autosave label as "3 s" when value is exactly 3000', async () => {
		render(SettingsEditor);
		const slider = screen.getByTestId('editor-slider-autosave') as HTMLInputElement;
		await fireEvent.input(slider, { target: { value: '3000' } });
		expect(screen.getByText('3 s')).toBeInTheDocument();
	});

	// ------ S5.5 — toggling spellcheck flips the store ------
	it('clicking the spellcheck toggle flips the boolean', async () => {
		render(SettingsEditor);
		const toggle = screen.getByTestId('editor-toggle-spellcheck');
		expect(toggle.getAttribute('aria-checked')).toBe('true');

		await fireEvent.click(toggle);
		expect(settingsStore.current.editor.spellCheck).toBe(false);
		expect(toggle.getAttribute('aria-checked')).toBe('false');

		await fireEvent.click(toggle);
		expect(settingsStore.current.editor.spellCheck).toBe(true);
		expect(toggle.getAttribute('aria-checked')).toBe('true');
	});

	// ------ S5.6 — the slider min/max/step bound the autosave delay ------
	it('the autosave slider has min=500, max=5000, step=100', () => {
		render(SettingsEditor);
		const slider = screen.getByTestId('editor-slider-autosave') as HTMLInputElement;
		expect(slider.min).toBe('500');
		expect(slider.max).toBe('5000');
		expect(slider.step).toBe('100');
	});

	// ------ S5.7 — toggle has role="switch" with aria-labelledby ------
	it('the spellcheck toggle is an ARIA switch labelled by the row label', () => {
		render(SettingsEditor);
		const toggle = screen.getByTestId('editor-toggle-spellcheck');
		expect(toggle.getAttribute('role')).toBe('switch');
		expect(toggle.getAttribute('aria-labelledby')).toBe('spellcheck-label');
	});
});
