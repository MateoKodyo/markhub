import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const flags = vi.hoisted(() => ({
	prefersDark: true
}));

vi.mock('../../src/lib/stores/vaults.svelte', () => ({
	vaultsStore: {
		settings: { autoSaveDelayMs: 1500, theme: 'system' },
		setTheme: vi.fn().mockResolvedValue(undefined)
	}
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

describe('themeStore', () => {
	let themeStore: typeof import('../../src/lib/stores/theme.svelte').themeStore;
	let vaultsStore: typeof import('../../src/lib/stores/vaults.svelte').vaultsStore;

	beforeEach(async () => {
		vi.resetModules();
		flags.prefersDark = true;
		matchMediaListeners.length = 0;
		installMatchMedia();
		document.documentElement.removeAttribute('data-theme');
		const themeMod = await import('../../src/lib/stores/theme.svelte');
		const vaultsMod = await import('../../src/lib/stores/vaults.svelte');
		themeStore = themeMod.themeStore;
		vaultsStore = vaultsMod.vaultsStore;
		vaultsStore.settings = { autoSaveDelayMs: 1500, theme: 'system' };
	});

	afterEach(() => {
		document.documentElement.removeAttribute('data-theme');
	});

	it('init() resolves system → dark and does NOT set data-theme attribute', () => {
		flags.prefersDark = true;
		themeStore.init();
		expect(themeStore.preference).toBe('system');
		expect(themeStore.effective).toBe('dark');
		expect(document.documentElement.getAttribute('data-theme')).toBeNull();
	});

	it('init() resolves system → light and sets data-theme="light"', () => {
		flags.prefersDark = false;
		themeStore.init();
		expect(themeStore.effective).toBe('light');
		expect(document.documentElement.getAttribute('data-theme')).toBe('light');
	});

	it('init() reads a persisted "light" preference', () => {
		vaultsStore.settings = { autoSaveDelayMs: 1500, theme: 'light' };
		themeStore.init();
		expect(themeStore.preference).toBe('light');
		expect(themeStore.effective).toBe('light');
		expect(document.documentElement.getAttribute('data-theme')).toBe('light');
	});

	it('setPreference("dark") persists and removes data-theme attribute', async () => {
		themeStore.init();
		await themeStore.setPreference('dark');
		expect(themeStore.effective).toBe('dark');
		expect(document.documentElement.getAttribute('data-theme')).toBeNull();
		expect(vaultsStore.setTheme).toHaveBeenCalledWith('dark');
	});

	it('setPreference("light") persists and sets data-theme="light"', async () => {
		themeStore.init();
		await themeStore.setPreference('light');
		expect(themeStore.effective).toBe('light');
		expect(document.documentElement.getAttribute('data-theme')).toBe('light');
		expect(vaultsStore.setTheme).toHaveBeenCalledWith('light');
	});

	it('cycle() goes dark → light → system → dark', async () => {
		await themeStore.setPreference('dark');
		await themeStore.cycle();
		expect(themeStore.preference).toBe('light');
		await themeStore.cycle();
		expect(themeStore.preference).toBe('system');
		await themeStore.cycle();
		expect(themeStore.preference).toBe('dark');
	});

	it('reacts to OS theme changes ONLY while preference is "system"', async () => {
		themeStore.init();
		expect(themeStore.preference).toBe('system');
		expect(matchMediaListeners.length).toBe(1);

		// Simulate OS flip to light.
		flags.prefersDark = false;
		matchMediaListeners[0]({ matches: false } as MediaQueryListEvent);
		expect(themeStore.effective).toBe('light');
		expect(document.documentElement.getAttribute('data-theme')).toBe('light');

		// Switching to explicit "dark" must detach the listener.
		await themeStore.setPreference('dark');
		expect(matchMediaListeners.length).toBe(0);
	});
});
