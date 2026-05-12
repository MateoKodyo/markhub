import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';

// Mock the Tauri API surface — settingsStore.set() schedules a debounced
// write that we don't want to actually hit `invoke`.
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
		behavior: { askBeforeClosingUnsaved: true }
	}),
	settingsWrite: vi.fn().mockResolvedValue(undefined)
}));

// Mock the runtime theme manager — we verify the bridge contract without
// pulling in matchMedia / vaultsStore. `vi.hoisted` puts the spy in the
// hoist scope of `vi.mock`, otherwise the factory closes over an
// uninitialized binding.
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

import SettingsAppearance from '../../src/lib/components/SettingsAppearance.svelte';
import { settingsStore } from '../../src/lib/stores/settings.svelte';

describe('SettingsAppearance', () => {
	beforeEach(() => {
		settingsStore.resetForTest();
		themeSetPreference.mockClear();
	});

	// ------ S4.1 — renders 3 theme cards + 4 font cards + 3 sliders ------
	it('renders all controls: 3 themes, 4 fonts, 3 sliders, 1 preview', () => {
		render(SettingsAppearance);
		expect(screen.getByTestId('appearance-theme-dark')).toBeInTheDocument();
		expect(screen.getByTestId('appearance-theme-light')).toBeInTheDocument();
		expect(screen.getByTestId('appearance-theme-system')).toBeInTheDocument();

		expect(screen.getByTestId('appearance-font-geist')).toBeInTheDocument();
		expect(screen.getByTestId('appearance-font-system')).toBeInTheDocument();
		expect(screen.getByTestId('appearance-font-serif')).toBeInTheDocument();
		expect(screen.getByTestId('appearance-font-mono')).toBeInTheDocument();

		expect(screen.getByTestId('appearance-slider-fontsize')).toBeInTheDocument();
		expect(screen.getByTestId('appearance-slider-lineheight')).toBeInTheDocument();
		expect(screen.getByTestId('appearance-slider-contentwidth')).toBeInTheDocument();

		expect(screen.getByTestId('appearance-preview')).toBeInTheDocument();
	});

	// ------ S4.2 — default active marks (system theme + geist font) ------
	it('marks the default theme (system) and font (geist) as active', () => {
		render(SettingsAppearance);
		expect(screen.getByTestId('appearance-theme-system').getAttribute('aria-pressed')).toBe(
			'true'
		);
		expect(screen.getByTestId('appearance-theme-dark').getAttribute('aria-pressed')).toBe(
			'false'
		);
		expect(screen.getByTestId('appearance-font-geist').getAttribute('aria-pressed')).toBe(
			'true'
		);
	});

	// ------ S4.3 — clicking a theme card calls themeStore.setPreference ------
	it('clicking a theme card updates the store and bridges to themeStore', async () => {
		render(SettingsAppearance);
		await fireEvent.click(screen.getByTestId('appearance-theme-dark'));
		expect(settingsStore.current.appearance.theme).toBe('dark');
		expect(themeSetPreference).toHaveBeenCalledWith('dark');
		expect(screen.getByTestId('appearance-theme-dark').getAttribute('aria-pressed')).toBe(
			'true'
		);
	});

	// ------ S4.4 — clicking a font card updates editorFont ------
	it('clicking a font card updates editorFont in the store', async () => {
		render(SettingsAppearance);
		await fireEvent.click(screen.getByTestId('appearance-font-serif'));
		expect(settingsStore.current.appearance.editorFont).toBe('serif');
		expect(screen.getByTestId('appearance-font-serif').getAttribute('aria-pressed')).toBe(
			'true'
		);
	});

	// ------ S4.5 — sliders update their fields ------
	it('moving the fontSize slider updates editorFontSize', async () => {
		render(SettingsAppearance);
		const slider = screen.getByTestId('appearance-slider-fontsize') as HTMLInputElement;
		await fireEvent.input(slider, { target: { value: '18' } });
		expect(settingsStore.current.appearance.editorFontSize).toBe(18);
	});

	it('moving the lineHeight slider updates editorLineHeight', async () => {
		render(SettingsAppearance);
		const slider = screen.getByTestId(
			'appearance-slider-lineheight'
		) as HTMLInputElement;
		await fireEvent.input(slider, { target: { value: '1.75' } });
		expect(settingsStore.current.appearance.editorLineHeight).toBe(1.75);
	});

	it('moving the contentWidth slider updates editorContentWidth', async () => {
		render(SettingsAppearance);
		const slider = screen.getByTestId(
			'appearance-slider-contentwidth'
		) as HTMLInputElement;
		await fireEvent.input(slider, { target: { value: '900' } });
		expect(settingsStore.current.appearance.editorContentWidth).toBe(900);
	});

	// ------ S4.6 — live preview reflects current settings ------
	it('the live preview reflects font size / line height / max-width', async () => {
		render(SettingsAppearance);
		const preview = screen.getByTestId('appearance-preview') as HTMLElement;

		// Defaults visible.
		expect(preview.style.fontSize).toBe('16px');
		expect(preview.style.maxWidth).toBe('720px');

		// Drag fontSize → 20 and verify the preview moves with it.
		await fireEvent.input(
			screen.getByTestId('appearance-slider-fontsize'),
			{ target: { value: '20' } }
		);
		expect(preview.style.fontSize).toBe('20px');
	});

	// ------ S4.7 — font card label is rendered in its own typeface ------
	it('each font card label inherits the option font-family (visual preview)', () => {
		render(SettingsAppearance);
		const serifCard = screen.getByTestId('appearance-font-serif') as HTMLElement;
		// The inline style is applied on the card itself; `inherit` on the
		// label means visually it's rendered in serif. Asserting on style
		// attribute is enough to lock the contract.
		expect(serifCard.style.fontFamily).toContain('Iowan');
	});

	// ------ S4.8 — current-value chips reflect store ------
	it('renders the current numeric value next to each slider', async () => {
		render(SettingsAppearance);
		const slider = screen.getByTestId(
			'appearance-slider-fontsize'
		) as HTMLInputElement;
		await fireEvent.input(slider, { target: { value: '19' } });
		// The chip is the only element rendering "19" near the fontsize control.
		expect(screen.getByText('19')).toBeInTheDocument();
	});
});
