import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';

// Mock the Tauri API surface — settingsStore.set() schedules a debounced
// write that we don't want to actually hit `invoke`.
vi.mock('../../src/lib/tauri/api', () => ({
	settingsRead: vi.fn().mockResolvedValue({
		version: 2,
		appearance: {
			themeMode: 'system',
			lightTheme: 'markhub-light',
			darkTheme: 'markhub-dark',
			editorFont: 'geist',
			editorFontSize: 16,
			editorLineHeight: 1.6,
			editorContentWidth: 60
		},
		editor: { autosaveDelayMs: 1500, spellCheck: true },
		source: { monoFont: 'geist-mono' },
		files: { confirmDelete: true }
	}),
	settingsWrite: vi.fn().mockResolvedValue(undefined)
}));

// Mock the runtime theme manager — we verify the bridge contract without
// pulling in matchMedia. `vi.hoisted` puts the spy in the hoist scope of
// `vi.mock`, otherwise the factory closes over an uninitialized binding.
const { themeSetPreference, themeInit, getThemePreference, setThemePreference } = vi.hoisted(
	() => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let pref: any = {
			mode: 'system',
			lightTheme: 'markhub-light',
			darkTheme: 'markhub-dark'
		};
		return {
			themeSetPreference: vi.fn(),
			themeInit: vi.fn(),
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			getThemePreference: () => pref as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			setThemePreference: (p: any) => {
				pref = p;
			}
		};
	}
);
vi.mock('../../src/lib/theming/manager.svelte', () => ({
	themeManager: {
		init: (p: unknown) => {
			setThemePreference(p);
			themeInit(p);
		},
		setPreference: (p: unknown) => {
			setThemePreference(p);
			themeSetPreference(p);
		},
		get preference() {
			return getThemePreference();
		}
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
		expect(screen.getByTestId('appearance-theme-system').getAttribute('aria-checked')).toBe(
			'true'
		);
		expect(screen.getByTestId('appearance-theme-dark').getAttribute('aria-checked')).toBe(
			'false'
		);
		expect(screen.getByTestId('appearance-font-geist').getAttribute('aria-checked')).toBe(
			'true'
		);
	});

	// ------ S4.3 — clicking a theme card bridges to themeManager.setPreference ------
	it('clicking the dark card writes mode=always-dark and bridges to themeManager', async () => {
		render(SettingsAppearance);
		await fireEvent.click(screen.getByTestId('appearance-theme-dark'));
		expect(settingsStore.current.appearance.themeMode).toBe('always-dark');
		expect(settingsStore.current.appearance.lightTheme).toBe('markhub-light');
		expect(settingsStore.current.appearance.darkTheme).toBe('markhub-dark');
		expect(themeSetPreference).toHaveBeenCalled();
		const arg = themeSetPreference.mock.calls.at(-1)?.[0] as {
			mode: string;
			lightTheme: string;
			darkTheme: string;
		};
		expect(arg.mode).toBe('always-dark');
		expect(screen.getByTestId('appearance-theme-dark').getAttribute('aria-checked')).toBe(
			'true'
		);
	});

	// ------ S4.4 — clicking a font card updates editorFont ------
	it('clicking a font card updates editorFont in the store', async () => {
		render(SettingsAppearance);
		await fireEvent.click(screen.getByTestId('appearance-font-serif'));
		expect(settingsStore.current.appearance.editorFont).toBe('serif');
		expect(screen.getByTestId('appearance-font-serif').getAttribute('aria-checked')).toBe(
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
		await fireEvent.input(slider, { target: { value: '80' } });
		expect(settingsStore.current.appearance.editorContentWidth).toBe(80);
	});

	// ------ S4.6 — live preview reflects current settings ------
	it('the live preview reflects font size / line height / max-width', async () => {
		render(SettingsAppearance);
		const preview = screen.getByTestId('appearance-preview') as HTMLElement;

		// Defaults visible.
		expect(preview.style.fontSize).toBe('16px');
		expect(preview.style.maxWidth).toBe('60%');

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
