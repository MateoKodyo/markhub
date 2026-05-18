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
		},
		// The picker derives the active family from osPrefersDark when in
		// mode=system. The component test fixture pins this to "light" so
		// the default render lands on the light slot (markhub-light + Cocoa).
		get osPrefersDark() {
			return false;
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

	// ------ S4.1 — renders the picker (mode segments + active-family cards) + fonts + sliders ------
	it('renders all controls: mode segments, active-family theme cards, fonts, sliders, preview', () => {
		render(SettingsAppearance);
		// Mode selector — 3 radio segments
		expect(screen.getByTestId('theme-mode-system')).toBeInTheDocument();
		expect(screen.getByTestId('theme-mode-light')).toBeInTheDocument();
		expect(screen.getByTestId('theme-mode-dark')).toBeInTheDocument();
		// With osPrefersDark=false and mode=system the active family is light,
		// so only the light cards render.
		expect(screen.getByTestId('theme-card-markhub-light')).toBeInTheDocument();
		expect(screen.getByTestId('theme-card-cocoa')).toBeInTheDocument();
		expect(screen.queryByTestId('theme-card-markhub-dark')).not.toBeInTheDocument();
		expect(screen.queryByTestId('theme-card-forest')).not.toBeInTheDocument();

		expect(screen.getByTestId('appearance-font-geist')).toBeInTheDocument();
		expect(screen.getByTestId('appearance-font-system')).toBeInTheDocument();
		expect(screen.getByTestId('appearance-font-serif')).toBeInTheDocument();
		expect(screen.getByTestId('appearance-font-mono')).toBeInTheDocument();

		expect(screen.getByTestId('appearance-field-fontsize')).toBeInTheDocument();
		expect(screen.getByTestId('appearance-field-lineheight')).toBeInTheDocument();
		expect(screen.getByTestId('appearance-field-contentwidth')).toBeInTheDocument();

		expect(screen.getByTestId('appearance-preview')).toBeInTheDocument();
	});

	// ------ S4.2 — default active marks (system mode + light family active + geist font) ------
	it('marks the default mode (system), active light card, and font (geist)', () => {
		render(SettingsAppearance);
		expect(screen.getByTestId('theme-mode-system').getAttribute('aria-checked')).toBe(
			'true'
		);
		expect(screen.getByTestId('theme-mode-dark').getAttribute('aria-checked')).toBe('false');
		// The selected card for the active (light) family is markhub-light by default
		expect(screen.getByTestId('theme-card-markhub-light').getAttribute('aria-pressed')).toBe(
			'true'
		);
		expect(screen.getByTestId('theme-card-cocoa').getAttribute('aria-pressed')).toBe('false');
		expect(screen.getByTestId('appearance-font-geist').getAttribute('aria-checked')).toBe(
			'true'
		);
	});

	// ------ S4.3 — clicking a mode bridges to themeManager.setPreference ------
	it('clicking always-dark writes the mode and bridges to themeManager', async () => {
		render(SettingsAppearance);
		await fireEvent.click(screen.getByTestId('theme-mode-dark'));
		expect(settingsStore.current.appearance.themeMode).toBe('always-dark');
		expect(themeSetPreference).toHaveBeenCalled();
		const arg = themeSetPreference.mock.calls.at(-1)?.[0] as {
			mode: string;
			lightTheme: string;
			darkTheme: string;
		};
		expect(arg.mode).toBe('always-dark');
	});

	// ------ S4.3b — clicking a card writes to the matching family slot ------
	it('clicking the Cocoa card writes lightTheme=cocoa without touching the dark slot', async () => {
		render(SettingsAppearance);
		await fireEvent.click(screen.getByTestId('theme-card-cocoa'));
		expect(settingsStore.current.appearance.lightTheme).toBe('cocoa');
		expect(settingsStore.current.appearance.darkTheme).toBe('markhub-dark');
		expect(settingsStore.current.appearance.themeMode).toBe('system');
	});

	// ------ S4.4 — clicking a font card stages it in the draft (not the store) ------
	it('clicking a font card stages it in the draft (aria-checked) without writing to the store', async () => {
		render(SettingsAppearance);
		await fireEvent.click(screen.getByTestId('appearance-font-serif'));
		// Draft reflects the choice (aria-checked flips), but the stored
		// value stays at the default until Apply is clicked.
		expect(screen.getByTestId('appearance-font-serif').getAttribute('aria-checked')).toBe(
			'true'
		);
		expect(settingsStore.current.appearance.editorFont).toBe('geist');
	});

	// ------ S4.5 — typography fields only update the draft; Apply commits ------
	it('changing fields updates only the draft, Apply writes the batch to the store', async () => {
		render(SettingsAppearance);
		const fontField = screen.getByTestId('appearance-field-fontsize') as HTMLInputElement;
		const lineField = screen.getByTestId('appearance-field-lineheight') as HTMLInputElement;
		const widthField = screen.getByTestId('appearance-field-contentwidth') as HTMLInputElement;

		await fireEvent.input(fontField, { target: { value: '18' } });
		await fireEvent.input(lineField, { target: { value: '1.75' } });
		await fireEvent.input(widthField, { target: { value: '80' } });

		// Store is still on the defaults — no live writes.
		expect(settingsStore.current.appearance.editorFontSize).toBe(16);
		expect(settingsStore.current.appearance.editorLineHeight).toBe(1.6);
		expect(settingsStore.current.appearance.editorContentWidth).toBe(60);

		await fireEvent.click(screen.getByTestId('appearance-apply'));

		// Apply commits the whole draft atomically.
		expect(settingsStore.current.appearance.editorFontSize).toBe(18);
		expect(settingsStore.current.appearance.editorLineHeight).toBe(1.75);
		expect(settingsStore.current.appearance.editorContentWidth).toBe(80);
	});

	// ------ S4.5b — Apply is disabled until the draft diverges from stored ------
	it('Apply is disabled when draft === stored, enabled once a field changes', async () => {
		render(SettingsAppearance);
		const apply = screen.getByTestId('appearance-apply') as HTMLButtonElement;
		expect(apply.disabled).toBe(true);

		await fireEvent.input(
			screen.getByTestId('appearance-field-fontsize'),
			{ target: { value: '18' } }
		);
		expect(apply.disabled).toBe(false);

		// After committing, draft === stored again → disabled again.
		await fireEvent.click(apply);
		expect(apply.disabled).toBe(true);
	});

	// ------ S4.6 — modal preview reflects the draft (not the stored value) ------
	it('the in-modal preview reflects the draft so users can see the result before Apply', async () => {
		render(SettingsAppearance);
		const preview = screen.getByTestId('appearance-preview') as HTMLElement;

		// Defaults visible.
		expect(preview.style.fontSize).toBe('16px');
		expect(preview.style.maxWidth).toBe('60%');

		// Change the field — preview moves with the draft, store stays put.
		await fireEvent.input(
			screen.getByTestId('appearance-field-fontsize'),
			{ target: { value: '20' } }
		);
		expect(preview.style.fontSize).toBe('20px');
		expect(settingsStore.current.appearance.editorFontSize).toBe(16);
	});

	// ------ S4.7 — font card label is rendered in its own typeface ------
	it('each font card label inherits the option font-family (visual preview)', () => {
		render(SettingsAppearance);
		const serifCard = screen.getByTestId('appearance-font-serif') as HTMLElement;
		expect(serifCard.style.fontFamily).toContain('Iowan');
	});

	// ------ S4.8 — current value lives in the number field ------
	it('the number field reflects the current value', async () => {
		render(SettingsAppearance);
		const field = screen.getByTestId(
			'appearance-field-fontsize'
		) as HTMLInputElement;
		await fireEvent.input(field, { target: { value: '19' } });
		expect(field.value).toBe('19');
	});
});
