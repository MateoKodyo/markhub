/**
 * Theme store — wires the user's preference to the `<html data-theme>`
 * attribute that drives the CSS palette switch in app.css.
 *
 *   preference          effective theme on screen
 *   --------------------------------------------
 *   'dark'              dark
 *   'light'             light
 *   'system' (default)  whatever `prefers-color-scheme` says, with a live
 *                       listener so a macOS auto-switch is reflected
 *                       without restarting the app.
 *
 * The preference is persisted in `config.json -> settings.theme` (already
 * scaffolded in models.rs since session 1). This store is the single source
 * of truth at runtime; components read `themeStore.effective` and call
 * `setPreference(...)` to change it.
 */

import { vaultsStore } from './vaults.svelte';

export type ThemePreference = 'dark' | 'light' | 'system';
export type EffectiveTheme = 'dark' | 'light';

const PREF_VALUES: ReadonlySet<ThemePreference> = new Set(['dark', 'light', 'system']);

function safeMatchMedia(query: string): MediaQueryList | null {
	if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
		return null;
	}
	return window.matchMedia(query);
}

function resolveSystemTheme(): EffectiveTheme {
	const mq = safeMatchMedia('(prefers-color-scheme: dark)');
	// Default to dark if we can't detect (Markhub's identity is warm-dark first).
	return mq && !mq.matches ? 'light' : 'dark';
}

function applyToDom(effective: EffectiveTheme): void {
	if (typeof document === 'undefined') return;
	if (effective === 'light') {
		document.documentElement.setAttribute('data-theme', 'light');
	} else {
		document.documentElement.removeAttribute('data-theme');
	}
}

class ThemeStore {
	preference = $state<ThemePreference>('system');
	effective = $state<EffectiveTheme>('dark');

	#systemMql: MediaQueryList | null = null;
	#systemListener: ((e: MediaQueryListEvent) => void) | null = null;
	#initialized = false;

	/**
	 * Initialise from the user's saved preference (in vaultsStore.settings)
	 * and start listening to OS-level theme changes when in 'system' mode.
	 * Idempotent — safe to call multiple times.
	 */
	init(): void {
		if (this.#initialized) return;
		this.#initialized = true;

		// MQL must be in place BEFORE #applyPreference runs — the OS listener
		// is attached/detached based on whether matchMedia is available.
		this.#systemMql = safeMatchMedia('(prefers-color-scheme: dark)');

		const saved = vaultsStore.settings?.theme;
		const initial: ThemePreference = PREF_VALUES.has(saved as ThemePreference)
			? (saved as ThemePreference)
			: 'system';

		this.preference = initial;
		this.#applyPreference();
	}

	/**
	 * Set the user-visible preference, persist it, and apply.
	 * Persistence failure is logged but doesn't block the UI flip.
	 */
	async setPreference(pref: ThemePreference): Promise<void> {
		if (!PREF_VALUES.has(pref)) return;
		this.preference = pref;
		this.#applyPreference();
		try {
			await vaultsStore.setTheme(pref);
		} catch (e) {
			console.warn('[theme] failed to persist preference', e);
		}
	}

	/**
	 * Cycle dark → light → system → dark for a one-button toggle in the UI.
	 * Most users will only ever see dark/light, but power users can opt into
	 * system from the same control.
	 */
	async cycle(): Promise<void> {
		const next: ThemePreference =
			this.preference === 'dark' ? 'light' : this.preference === 'light' ? 'system' : 'dark';
		await this.setPreference(next);
	}

	#applyPreference(): void {
		const next: EffectiveTheme =
			this.preference === 'system' ? resolveSystemTheme() : this.preference;
		this.effective = next;
		applyToDom(next);
		this.#updateSystemListener();
	}

	#updateSystemListener(): void {
		if (!this.#systemMql) return;
		// Only listen while in 'system' mode — otherwise the user has explicitly
		// opted out of OS tracking.
		if (this.preference === 'system') {
			if (this.#systemListener) return;
			this.#systemListener = () => {
				const next = resolveSystemTheme();
				this.effective = next;
				applyToDom(next);
			};
			this.#systemMql.addEventListener('change', this.#systemListener);
		} else if (this.#systemListener) {
			this.#systemMql.removeEventListener('change', this.#systemListener);
			this.#systemListener = null;
		}
	}
}

export const themeStore = new ThemeStore();
