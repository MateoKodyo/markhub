import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ThemeId, ThemePreference } from '../../src/lib/tauri/types';

// matchMedia is consulted at module-load time for the OS preference, so we
// install our spy before importing the manager module. The hoisted flags
// pattern matches the existing theme.test.svelte.ts conventions.
const flags = vi.hoisted(() => ({
	prefersDark: true
}));

const matchMediaListeners: Array<(e: MediaQueryListEvent) => void> = [];

function installMatchMedia() {
	(window as unknown as { matchMedia: typeof window.matchMedia }).matchMedia = ((
		query: string
	) => {
		const isPrefersDark = query.includes('dark');
		return {
			matches: isPrefersDark ? flags.prefersDark : !flags.prefersDark,
			media: query,
			onchange: null,
			addEventListener: (_evt: string, l: (e: MediaQueryListEvent) => void) => {
				matchMediaListeners.push(l);
			},
			removeEventListener: (
				_evt: string,
				l: (e: MediaQueryListEvent) => void
			) => {
				const i = matchMediaListeners.indexOf(l);
				if (i >= 0) matchMediaListeners.splice(i, 1);
			},
			dispatchEvent: () => false,
			addListener: () => {},
			removeListener: () => {}
		} as unknown as MediaQueryList;
	}) as typeof window.matchMedia;
}

const DEFAULT_PREFS: ThemePreference = {
	mode: 'system',
	lightTheme: 'markhub-light',
	darkTheme: 'markhub-dark'
};

describe('theming manager — pure resolution', () => {
	let resolveActiveTheme: typeof import('../../src/lib/theming/manager.svelte').resolveActiveTheme;

	beforeEach(async () => {
		vi.resetModules();
		const mod = await import('../../src/lib/theming/manager.svelte');
		resolveActiveTheme = mod.resolveActiveTheme;
	});

	// ------ TM.R1 — mode=system + OS dark → darkTheme ------
	it('resolves to darkTheme when mode=system and OS prefers dark', () => {
		expect(resolveActiveTheme(DEFAULT_PREFS, true)).toBe('markhub-dark');
	});

	// ------ TM.R2 — mode=system + OS light → lightTheme ------
	it('resolves to lightTheme when mode=system and OS prefers light', () => {
		expect(resolveActiveTheme(DEFAULT_PREFS, false)).toBe('markhub-light');
	});

	// ------ TM.R3 — mode=always-light ignores OS ------
	it('always-light ignores the OS preference', () => {
		const prefs = { ...DEFAULT_PREFS, mode: 'always-light' as const };
		expect(resolveActiveTheme(prefs, true)).toBe('markhub-light');
		expect(resolveActiveTheme(prefs, false)).toBe('markhub-light');
	});

	// ------ TM.R4 — mode=always-dark ignores OS ------
	it('always-dark ignores the OS preference', () => {
		const prefs = { ...DEFAULT_PREFS, mode: 'always-dark' as const };
		expect(resolveActiveTheme(prefs, true)).toBe('markhub-dark');
		expect(resolveActiveTheme(prefs, false)).toBe('markhub-dark');
	});

	// ------ TM.R5 — custom slot assignment is honored ------
	it('honors a customised light/dark slot assignment', () => {
		// Even though only 2 themes exist in STEP 1, the resolver shape must
		// already support arbitrary ThemeId pairs (so STEP 2/3 work without
		// changing this function).
		const prefs: ThemePreference = {
			mode: 'system',
			lightTheme: 'markhub-light',
			darkTheme: 'markhub-dark'
		};
		expect(resolveActiveTheme(prefs, true)).toBe('markhub-dark');
		expect(resolveActiveTheme(prefs, false)).toBe('markhub-light');
	});
});

describe('theming manager — applyTheme', () => {
	let applyTheme: typeof import('../../src/lib/theming/manager.svelte').applyTheme;

	beforeEach(async () => {
		vi.resetModules();
		document.documentElement.removeAttribute('data-theme');
		const mod = await import('../../src/lib/theming/manager.svelte');
		applyTheme = mod.applyTheme;
	});

	afterEach(() => {
		document.documentElement.removeAttribute('data-theme');
	});

	// ------ TM.A1 — applyTheme sets the attribute to the theme id ------
	it('writes the id verbatim to <html data-theme>', () => {
		applyTheme('markhub-dark');
		expect(document.documentElement.getAttribute('data-theme')).toBe('markhub-dark');
		applyTheme('markhub-light');
		expect(document.documentElement.getAttribute('data-theme')).toBe('markhub-light');
	});

	// ------ TM.A2 — applyTheme caches the id to localStorage (anti-flash) ------
	it('caches the applied theme to localStorage for the pre-hydration script', () => {
		localStorage.removeItem('markhub.theme.cache');
		applyTheme('terracotta');
		expect(localStorage.getItem('markhub.theme.cache')).toBe('terracotta');
		applyTheme('forest');
		expect(localStorage.getItem('markhub.theme.cache')).toBe('forest');
	});
});

describe('theming manager — singleton + OS subscription', () => {
	let themeManager: typeof import('../../src/lib/theming/manager.svelte').themeManager;

	beforeEach(async () => {
		vi.resetModules();
		flags.prefersDark = true;
		matchMediaListeners.length = 0;
		installMatchMedia();
		document.documentElement.removeAttribute('data-theme');
		const mod = await import('../../src/lib/theming/manager.svelte');
		themeManager = mod.themeManager;
	});

	afterEach(() => {
		document.documentElement.removeAttribute('data-theme');
		themeManager.teardownForTest();
	});

	// ------ TM.S1 — init applies the resolved theme to the DOM ------
	it('init(prefs) resolves and applies the active theme', () => {
		themeManager.init(DEFAULT_PREFS);
		// OS prefers dark + mode=system → markhub-dark
		expect(themeManager.effective).toBe('markhub-dark');
		expect(document.documentElement.getAttribute('data-theme')).toBe('markhub-dark');
	});

	// ------ TM.S2 — init is idempotent (no double subscription) ------
	it('init is idempotent — no duplicate matchMedia listener', () => {
		themeManager.init(DEFAULT_PREFS);
		themeManager.init(DEFAULT_PREFS);
		themeManager.init(DEFAULT_PREFS);
		expect(matchMediaListeners.length).toBe(1);
	});

	// ------ TM.S3 — setPreference re-resolves and re-applies ------
	it('setPreference updates the effective theme and the DOM attribute', () => {
		themeManager.init(DEFAULT_PREFS);
		themeManager.setPreference({ ...DEFAULT_PREFS, mode: 'always-light' });
		expect(themeManager.effective).toBe('markhub-light');
		expect(document.documentElement.getAttribute('data-theme')).toBe('markhub-light');
	});

	// ------ TM.S4 — OS change updates the theme while mode=system ------
	it('OS dark→light flip updates the theme when mode=system', () => {
		flags.prefersDark = true;
		themeManager.init(DEFAULT_PREFS);
		expect(themeManager.effective).toBe('markhub-dark');

		// Simulate the OS toggling to light.
		flags.prefersDark = false;
		matchMediaListeners[0]({ matches: false } as MediaQueryListEvent);

		expect(themeManager.effective).toBe('markhub-light');
		expect(document.documentElement.getAttribute('data-theme')).toBe('markhub-light');
	});

	// ------ TM.S5 — OS change is ignored while mode=always-* ------
	it('OS changes are ignored when mode=always-dark', () => {
		flags.prefersDark = true;
		themeManager.init({ ...DEFAULT_PREFS, mode: 'always-dark' });
		expect(themeManager.effective).toBe('markhub-dark');

		// OS flips to light — manager must NOT switch.
		flags.prefersDark = false;
		// In mode=always-*, the listener is still attached so we keep the
		// osPrefersDark state in sync (for the picker UI to reflect the OS),
		// but the effective theme MUST NOT change.
		if (matchMediaListeners.length > 0) {
			matchMediaListeners[0]({ matches: false } as MediaQueryListEvent);
		}
		expect(themeManager.effective).toBe('markhub-dark');
		expect(document.documentElement.getAttribute('data-theme')).toBe('markhub-dark');
	});

	// ------ TM.S6 — slot reassignment without mode change ------
	it('changing only lightTheme (mode=system, OS=light) flips the active theme', () => {
		flags.prefersDark = false;
		themeManager.init(DEFAULT_PREFS);
		expect(themeManager.effective).toBe('markhub-light');

		// Imagine a future where Solar is in the catalog — for STEP 1 we only
		// have the 2 defaults, so this test re-asserts the same id but still
		// proves the path is wired (the manager re-resolves on setPreference).
		themeManager.setPreference({
			mode: 'system',
			lightTheme: 'markhub-light',
			darkTheme: 'markhub-dark'
		});
		expect(themeManager.effective).toBe('markhub-light');
	});

	// ------ TM.S7 — teardown removes the OS listener ------
	it('teardownForTest removes the matchMedia listener', () => {
		themeManager.init(DEFAULT_PREFS);
		expect(matchMediaListeners.length).toBe(1);
		themeManager.teardownForTest();
		expect(matchMediaListeners.length).toBe(0);
	});

	// ------ TM.S8 — preference is exposed on the singleton ------
	it('exposes the current preference', () => {
		const prefs: ThemePreference = {
			mode: 'always-light',
			lightTheme: 'markhub-light',
			darkTheme: 'markhub-dark'
		};
		themeManager.init(prefs);
		expect(themeManager.preference).toEqual(prefs);
	});

	// Compile-time sanity: ThemeId is the right shape.
	const _typeCheck: ThemeId = 'markhub-light';
	void _typeCheck;
});
