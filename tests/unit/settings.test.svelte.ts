import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { UserSettings } from '../../src/lib/tauri/types';
import { DEFAULT_USER_SETTINGS } from '../../src/lib/tauri/types';

// Mock the Tauri API surface — we never want a real `invoke` in vitest.
const settingsReadMock = vi.fn();
const settingsWriteMock = vi.fn().mockResolvedValue(undefined);

vi.mock('../../src/lib/tauri/api', () => ({
	settingsRead: () => settingsReadMock(),
	settingsWrite: (s: UserSettings) => settingsWriteMock(s)
}));

// Mock themeStore to verify the theme side-effect contract without
// pulling in the full theme logic (which has its own tests).
const themeInit = vi.fn();
const themeSetPreference = vi.fn().mockResolvedValue(undefined);
let themeCurrentPreference = 'system';
vi.mock('../../src/lib/stores/theme.svelte', () => ({
	themeStore: {
		init: () => themeInit(),
		setPreference: (p: 'dark' | 'light' | 'system') => {
			themeCurrentPreference = p;
			return themeSetPreference(p);
		},
		get preference() {
			return themeCurrentPreference;
		}
	}
}));

describe('settingsStore', () => {
	let settingsStore: typeof import('../../src/lib/stores/settings.svelte').settingsStore;
	let mergeWithDefaults: typeof import('../../src/lib/stores/settings.svelte').mergeWithDefaults;

	beforeEach(async () => {
		vi.resetModules();
		settingsReadMock.mockReset();
		settingsWriteMock.mockReset().mockResolvedValue(undefined);
		themeInit.mockReset();
		themeSetPreference.mockReset().mockResolvedValue(undefined);
		themeCurrentPreference = 'system';
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
				theme: 'dark',
				editorFontSize: 18
			}
		};
		settingsReadMock.mockResolvedValue(persisted);

		await settingsStore.load();

		expect(settingsStore.current.appearance.theme).toBe('dark');
		expect(settingsStore.current.appearance.editorFontSize).toBe(18);
		expect(settingsReadMock).toHaveBeenCalledOnce();
	});

	// ------ S2.2 — load() falls back to defaults when read throws ------
	it('load() falls back to defaults when api.settingsRead rejects', async () => {
		settingsReadMock.mockRejectedValue(new Error('boom'));
		// Silence the console.warn from the store.
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
		// The single write that lands is the latest value (font size 23).
		const lastCall = settingsWriteMock.mock.calls.at(-1)?.[0] as UserSettings;
		expect(lastCall.appearance.editorFontSize).toBe(23);
	});

	// ------ S2.7 — setTheme() bridges to themeStore ------
	it('setTheme() updates current and bridges to themeStore.setPreference', async () => {
		settingsReadMock.mockResolvedValue(DEFAULT_USER_SETTINGS);
		await settingsStore.load();
		settingsStore.setTheme('light');
		expect(settingsStore.current.appearance.theme).toBe('light');
		expect(themeSetPreference).toHaveBeenLastCalledWith('light');
	});

	// ------ S2.8 — set() does NOT re-bridge theme when unchanged ------
	it('set() skips theme side-effect when appearance.theme is unchanged', async () => {
		settingsReadMock.mockResolvedValue(DEFAULT_USER_SETTINGS);
		await settingsStore.load();
		themeSetPreference.mockClear(); // forget the call made during load()
		settingsStore.set({
			...DEFAULT_USER_SETTINGS,
			editor: { autosaveDelayMs: 500, spellCheck: false }
		});
		expect(themeSetPreference).not.toHaveBeenCalled();
	});

	// ------ S2.9 — load() bridges theme into themeStore ------
	it('load() pushes the persisted theme into themeStore when different from current', async () => {
		settingsReadMock.mockResolvedValue({
			...DEFAULT_USER_SETTINGS,
			appearance: { ...DEFAULT_USER_SETTINGS.appearance, theme: 'dark' }
		});
		await settingsStore.load();
		expect(themeInit).toHaveBeenCalled();
		expect(themeSetPreference).toHaveBeenCalledWith('dark');
	});

	// ------ S2.10 — mergeWithDefaults tolerates partial payloads ------
	it('mergeWithDefaults fills missing sections from defaults', () => {
		const partial = {
			appearance: {
				theme: 'dark' as const,
				editorFont: 'Geist Sans',
				editorFontSize: 20,
				editorLineHeight: 1.6,
				editorContentWidth: 720
			}
		};
		const merged = mergeWithDefaults(partial);
		expect(merged.appearance.editorFontSize).toBe(20);
		expect(merged.editor).toEqual(DEFAULT_USER_SETTINGS.editor);
		expect(merged.source).toEqual(DEFAULT_USER_SETTINGS.source);
		expect(merged.files).toEqual(DEFAULT_USER_SETTINGS.files);
		expect(merged.behavior).toEqual(DEFAULT_USER_SETTINGS.behavior);
	});
});
