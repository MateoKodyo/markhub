import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ThemePreference, UserSettings } from '../../src/lib/tauri/types';
import { DEFAULT_USER_SETTINGS } from '../../src/lib/tauri/types';

// Mock the Tauri API surface — we never want a real `invoke` in vitest.
const settingsReadMock = vi.fn();
const settingsWriteMock = vi.fn().mockResolvedValue(undefined);

vi.mock('../../src/lib/tauri/api', () => ({
	settingsRead: () => settingsReadMock(),
	settingsWrite: (s: UserSettings) => settingsWriteMock(s)
}));

// Mock themeManager to verify the theme side-effect contract without
// pulling in the full theming logic (which has its own tests).
const themeInit = vi.fn();
const themeSetPreference = vi.fn();
let themePreferenceState: ThemePreference = {
	mode: 'system',
	lightTheme: 'markhub-light',
	darkTheme: 'markhub-dark'
};
vi.mock('../../src/lib/theming/manager.svelte', () => ({
	themeManager: {
		init: (p: ThemePreference) => {
			themePreferenceState = p;
			themeInit(p);
		},
		setPreference: (p: ThemePreference) => {
			themePreferenceState = p;
			themeSetPreference(p);
		},
		get preference() {
			return themePreferenceState;
		}
	}
}));

const v2Prefs = (mode: ThemePreference['mode'] = 'system'): ThemePreference => ({
	mode,
	lightTheme: 'markhub-light',
	darkTheme: 'markhub-dark'
});

describe('settingsStore', () => {
	let settingsStore: typeof import('../../src/lib/stores/settings.svelte').settingsStore;
	let mergeWithDefaults: typeof import('../../src/lib/stores/settings.svelte').mergeWithDefaults;

	beforeEach(async () => {
		vi.resetModules();
		settingsReadMock.mockReset();
		settingsWriteMock.mockReset().mockResolvedValue(undefined);
		themeInit.mockReset();
		themeSetPreference.mockReset();
		themePreferenceState = v2Prefs();
		const mod = await import('../../src/lib/stores/settings.svelte');
		settingsStore = mod.settingsStore;
		mergeWithDefaults = mod.mergeWithDefaults;
		settingsStore.resetForTest();
	});

	// ------ S2.1 — load() hydrates current from api.settingsRead ------
	it('load() reads settings.json and hydrates current', async () => {
		const persisted: UserSettings = {
			...DEFAULT_USER_SETTINGS,
			appearance: {
				...DEFAULT_USER_SETTINGS.appearance,
				themeMode: 'always-dark',
				editorFontSize: 18
			}
		};
		settingsReadMock.mockResolvedValue(persisted);

		await settingsStore.load();

		expect(settingsStore.current.appearance.themeMode).toBe('always-dark');
		expect(settingsStore.current.appearance.editorFontSize).toBe(18);
		expect(settingsReadMock).toHaveBeenCalledOnce();
	});

	// ------ S2.2 — load() falls back to defaults when read throws ------
	it('load() falls back to defaults when api.settingsRead rejects', async () => {
		settingsReadMock.mockRejectedValue(new Error('boom'));
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		await settingsStore.load();

		expect(settingsStore.current).toEqual(DEFAULT_USER_SETTINGS);
		warn.mockRestore();
	});

	// ------ S2.3 — load() is idempotent ------
	it('load() does not hit disk on the second call', async () => {
		settingsReadMock.mockResolvedValue(DEFAULT_USER_SETTINGS);
		await settingsStore.load();
		await settingsStore.load();
		expect(settingsReadMock).toHaveBeenCalledOnce();
	});

	// ------ S2.4 — set() updates current immediately ------
	it('set() updates current synchronously', async () => {
		settingsReadMock.mockResolvedValue(DEFAULT_USER_SETTINGS);
		await settingsStore.load();
		const next: UserSettings = {
			...DEFAULT_USER_SETTINGS,
			editor: { autosaveDelayMs: 3000, spellCheck: false }
		};
		settingsStore.set(next);
		expect(settingsStore.current).toEqual(next);
	});

	// ------ S2.5 — set() persists (after flush) ------
	it('set() schedules a debounced persist that lands on disk after flush', async () => {
		settingsReadMock.mockResolvedValue(DEFAULT_USER_SETTINGS);
		await settingsStore.load();
		const next: UserSettings = {
			...DEFAULT_USER_SETTINGS,
			editor: { autosaveDelayMs: 4000, spellCheck: true }
		};
		settingsStore.set(next);
		expect(settingsWriteMock).not.toHaveBeenCalled();
		await settingsStore.flushForTest();
		expect(settingsWriteMock).toHaveBeenCalledOnce();
		expect(settingsWriteMock).toHaveBeenCalledWith(next);
	});

	// ------ S2.6 — rapid set() calls collapse to a single persist ------
	it('rapid set() calls collapse to a single write (debounce)', async () => {
		settingsReadMock.mockResolvedValue(DEFAULT_USER_SETTINGS);
		await settingsStore.load();
		for (let i = 0; i < 10; i++) {
			settingsStore.set({
				...DEFAULT_USER_SETTINGS,
				appearance: { ...DEFAULT_USER_SETTINGS.appearance, editorFontSize: 14 + i }
			});
		}
		await settingsStore.flushForTest();
		expect(settingsWriteMock).toHaveBeenCalledOnce();
		const lastCall = settingsWriteMock.mock.calls.at(-1)?.[0] as UserSettings;
		expect(lastCall.appearance.editorFontSize).toBe(23);
	});

	// ------ S2.7 — setTheme() bridges to themeManager ------
	it('setTheme() updates current and bridges to themeManager.setPreference', async () => {
		settingsReadMock.mockResolvedValue(DEFAULT_USER_SETTINGS);
		await settingsStore.load();
		const nextPrefs = v2Prefs('always-light');
		settingsStore.setTheme(nextPrefs);
		expect(settingsStore.current.appearance.themeMode).toBe('always-light');
		expect(settingsStore.current.appearance.lightTheme).toBe('markhub-light');
		expect(settingsStore.current.appearance.darkTheme).toBe('markhub-dark');
		expect(themeSetPreference).toHaveBeenLastCalledWith(nextPrefs);
	});

	// ------ S2.8 — set() does NOT re-bridge theme when unchanged ------
	it('set() skips theme side-effect when theme trio is unchanged', async () => {
		settingsReadMock.mockResolvedValue(DEFAULT_USER_SETTINGS);
		await settingsStore.load();
		themeSetPreference.mockClear();
		settingsStore.set({
			...DEFAULT_USER_SETTINGS,
			editor: { autosaveDelayMs: 500, spellCheck: false }
		});
		expect(themeSetPreference).not.toHaveBeenCalled();
	});

	// ------ S2.9 — load() bridges theme into themeManager ------
	it('load() pushes the persisted theme into themeManager', async () => {
		settingsReadMock.mockResolvedValue({
			...DEFAULT_USER_SETTINGS,
			appearance: { ...DEFAULT_USER_SETTINGS.appearance, themeMode: 'always-dark' }
		});
		await settingsStore.load();
		expect(themeInit).toHaveBeenCalled();
		const lastInit = themeInit.mock.calls.at(-1)?.[0] as ThemePreference;
		expect(lastInit.mode).toBe('always-dark');
		expect(lastInit.lightTheme).toBe('markhub-light');
		expect(lastInit.darkTheme).toBe('markhub-dark');
	});

	// ------ S2.10 — mergeWithDefaults tolerates partial payloads ------
	it('mergeWithDefaults fills missing sections from defaults', () => {
		const partial = {
			version: 2 as const,
			appearance: {
				themeMode: 'always-dark' as const,
				lightTheme: 'markhub-light' as const,
				darkTheme: 'markhub-dark' as const,
				editorFont: 'geist',
				editorFontSize: 20,
				editorLineHeight: 1.6,
				editorContentWidth: 60,
				editorFloatingBarPosition: 'bottom' as const
			}
		};
		const merged = mergeWithDefaults(partial);
		expect(merged.version).toBe(2);
		expect(merged.appearance.themeMode).toBe('always-dark');
		expect(merged.appearance.editorFontSize).toBe(20);
		expect(merged.editor).toEqual(DEFAULT_USER_SETTINGS.editor);
		expect(merged.source).toEqual(DEFAULT_USER_SETTINGS.source);
		expect(merged.files).toEqual(DEFAULT_USER_SETTINGS.files);
		expect(merged.sidebar).toEqual(DEFAULT_USER_SETTINGS.sidebar);
	});

	// ------ S2.SB1 — sidebar section persists hideNonMarkdown ------
	it('set() persists sidebar.hideNonMarkdown across a flush', async () => {
		settingsReadMock.mockResolvedValue(DEFAULT_USER_SETTINGS);
		await settingsStore.load();
		expect(settingsStore.current.sidebar.hideNonMarkdown).toBe(false);

		settingsStore.set({
			...settingsStore.current,
			sidebar: { hideNonMarkdown: true }
		});
		expect(settingsStore.current.sidebar.hideNonMarkdown).toBe(true);

		await settingsStore.flushForTest();
		const written = settingsWriteMock.mock.calls.at(-1)?.[0] as UserSettings;
		expect(written.sidebar.hideNonMarkdown).toBe(true);
	});

	// ------ S2.SB2 — load() rehydrates sidebar.hideNonMarkdown=true ------
	it('load() rehydrates sidebar.hideNonMarkdown from disk', async () => {
		settingsReadMock.mockResolvedValue({
			...DEFAULT_USER_SETTINGS,
			sidebar: { hideNonMarkdown: true }
		});
		await settingsStore.load();
		expect(settingsStore.current.sidebar.hideNonMarkdown).toBe(true);
	});

	// ------ S2.SB3 — settings.json written without sidebar still loads ------
	it('mergeWithDefaults seeds sidebar defaults when missing on disk', () => {
		const partial = {
			version: 2 as const,
			appearance: DEFAULT_USER_SETTINGS.appearance,
			editor: DEFAULT_USER_SETTINGS.editor,
			source: DEFAULT_USER_SETTINGS.source,
			files: DEFAULT_USER_SETTINGS.files
			// no `sidebar` field — simulates a settings.json written before
			// the section existed.
		};
		const merged = mergeWithDefaults(partial as never);
		expect(merged.sidebar).toEqual(DEFAULT_USER_SETTINGS.sidebar);
	});

	// ============================================================
	// v1 → v2 migration tests (NEW in PLAN-THEMING STEP 1)
	// ============================================================

	// ------ S2.M1 — v1 'light' migrates to mode=system + markhub-light slot ------
	it('migrates v1 {theme:"light"} → v2 {mode:"system", lightTheme:"markhub-light"}', () => {
		const v1Payload = {
			version: 1 as const,
			appearance: {
				theme: 'light',
				editorFont: 'geist',
				editorFontSize: 16,
				editorLineHeight: 1.6,
				editorContentWidth: 60,
				editorFloatingBarPosition: 'bottom' as const
			}
		};
		// `mergeWithDefaults` accepts unknown legacy shapes — cast for the call.
		const merged = mergeWithDefaults(v1Payload as never);
		expect(merged.version).toBe(2);
		expect(merged.appearance.themeMode).toBe('system');
		expect(merged.appearance.lightTheme).toBe('markhub-light');
		expect(merged.appearance.darkTheme).toBe('markhub-dark');
		// The legacy field must not survive into v2.
		expect((merged.appearance as unknown as { theme?: string }).theme).toBeUndefined();
	});

	// ------ S2.M2 — v1 'dark' migrates identically (slots stay default) ------
	it('migrates v1 {theme:"dark"} → v2 with default slots', () => {
		const v1Payload = {
			version: 1 as const,
			appearance: {
				theme: 'dark',
				editorFont: 'geist',
				editorFontSize: 16,
				editorLineHeight: 1.6,
				editorContentWidth: 60,
				editorFloatingBarPosition: 'bottom' as const
			}
		};
		const merged = mergeWithDefaults(v1Payload as never);
		expect(merged.appearance.themeMode).toBe('system');
		expect(merged.appearance.lightTheme).toBe('markhub-light');
		expect(merged.appearance.darkTheme).toBe('markhub-dark');
	});

	// ------ S2.M3 — v1 'system' migrates to system ------
	it('migrates v1 {theme:"system"} → v2 {mode:"system"}', () => {
		const v1Payload = {
			version: 1 as const,
			appearance: {
				theme: 'system',
				editorFont: 'geist',
				editorFontSize: 16,
				editorLineHeight: 1.6,
				editorContentWidth: 60,
				editorFloatingBarPosition: 'bottom' as const
			}
		};
		const merged = mergeWithDefaults(v1Payload as never);
		expect(merged.appearance.themeMode).toBe('system');
	});

	// ------ S2.M4 — corrupt v1 (unknown theme string) falls back to defaults ------
	it('falls back to default theme prefs when v1 theme is unknown', () => {
		const v1Payload = {
			version: 1 as const,
			appearance: {
				theme: 'banana',
				editorFont: 'geist',
				editorFontSize: 16,
				editorLineHeight: 1.6,
				editorContentWidth: 60,
				editorFloatingBarPosition: 'bottom' as const
			}
		};
		const merged = mergeWithDefaults(v1Payload as never);
		expect(merged.appearance.themeMode).toBe('system');
		expect(merged.appearance.lightTheme).toBe('markhub-light');
		expect(merged.appearance.darkTheme).toBe('markhub-dark');
	});

	// ------ S2.M5 — v2 payload passes through untouched ------
	it('passes v2 payloads through without re-migrating', () => {
		const v2Payload: UserSettings = {
			...DEFAULT_USER_SETTINGS,
			appearance: {
				themeMode: 'always-dark',
				lightTheme: 'markhub-light',
				darkTheme: 'markhub-dark',
				editorFont: 'geist',
				editorFontSize: 17,
				editorLineHeight: 1.5,
				editorContentWidth: 70,
				editorFloatingBarPosition: 'bottom' as const
			}
		};
		const merged = mergeWithDefaults(v2Payload);
		expect(merged.version).toBe(2);
		expect(merged.appearance.themeMode).toBe('always-dark');
		expect(merged.appearance.editorFontSize).toBe(17);
	});

	// ------ S2.M6 — load() persists the migrated v2 payload back to disk ------
	it('load() of a v1 file schedules a v2 persist (migration on first read)', async () => {
		const v1OnDisk = {
			version: 1,
			appearance: {
				theme: 'light',
				editorFont: 'geist',
				editorFontSize: 16,
				editorLineHeight: 1.6,
				editorContentWidth: 60,
				editorFloatingBarPosition: 'bottom' as const
			},
			editor: { autosaveDelayMs: 1500, spellCheck: true },
			source: { monoFont: 'geist-mono' },
			files: { confirmDelete: true }
		};
		settingsReadMock.mockResolvedValue(v1OnDisk as never);
		await settingsStore.load();
		expect(settingsStore.current.version).toBe(2);
		expect(settingsStore.current.appearance.themeMode).toBe('system');
		// And the migration writes back to disk after the debounce.
		await settingsStore.flushForTest();
		expect(settingsWriteMock).toHaveBeenCalled();
		const written = settingsWriteMock.mock.calls.at(-1)?.[0] as UserSettings;
		expect(written.version).toBe(2);
		expect(
			(written.appearance as unknown as { theme?: string }).theme
		).toBeUndefined();
	});
});
