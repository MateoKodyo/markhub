/**
 * Theme manager — resolves the active theme from the user's preference
 * (mode + light slot + dark slot) and the OS `prefers-color-scheme`,
 * applies it to `<html data-theme>`, and keeps everything in sync as
 * either changes.
 *
 *   mode                 effective theme
 *   ---------------------------------------------
 *   'system'             prefs.darkTheme  if OS prefers dark
 *                        prefs.lightTheme if OS prefers light
 *   'always-light'       prefs.lightTheme (OS ignored)
 *   'always-dark'        prefs.darkTheme  (OS ignored)
 *
 * The settings store owns persistence (PLAN-SETTINGS); this module owns the
 * runtime mapping from preference → DOM attribute. Components reactive on
 * the active theme can read `themeManager.effective` directly.
 */

import type { ThemeId, ThemePreference } from '$lib/tauri/types';

function safeMatchMedia(query: string): MediaQueryList | null {
	if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
		return null;
	}
	return window.matchMedia(query);
}

/** Pure resolution — given prefs and OS state, return the active theme id. */
export function resolveActiveTheme(
	prefs: ThemePreference,
	osPrefersDark: boolean
): ThemeId {
	switch (prefs.mode) {
		case 'always-light':
			return prefs.lightTheme;
		case 'always-dark':
			return prefs.darkTheme;
		case 'system':
			return osPrefersDark ? prefs.darkTheme : prefs.lightTheme;
	}
}

/** localStorage key used by the pre-hydration script in `app.html`. */
const THEME_CACHE_KEY = 'markhub.theme.cache';

/**
 * Write the theme id to `<html data-theme>` AND cache it in localStorage so
 * the next cold start (the inline `app.html` script) can re-apply it before
 * the first paint — no flash of the wrong theme.
 */
export function applyTheme(id: ThemeId): void {
	if (typeof document === 'undefined') return;
	document.documentElement.setAttribute('data-theme', id);
	try {
		localStorage.setItem(THEME_CACHE_KEY, id);
	} catch (e) {
		// localStorage may be unavailable in private browsing or restrictive
		// WebView configs — falling through is fine, just no anti-flash hint.
		void e;
	}
}

class ThemeManager {
	/** The user's preference trio — mirrored from settingsStore at init time. */
	preference = $state<ThemePreference>({
		mode: 'system',
		lightTheme: 'markhub-light',
		darkTheme: 'markhub-dark'
	});

	/** Live OS state — kept in sync via matchMedia even when mode=always-*. */
	osPrefersDark = $state<boolean>(true);

	/** The currently applied theme — derived from preference + osPrefersDark. */
	effective = $state<ThemeId>('markhub-dark');

	#mql: MediaQueryList | null = null;
	#listener: ((e: MediaQueryListEvent) => void) | null = null;
	#initialized = false;

	/**
	 * Wire the matchMedia listener and apply the resolved theme. Idempotent —
	 * a second call updates the preference but does NOT attach a duplicate
	 * listener. Safe to invoke from any settings hydration path.
	 */
	init(prefs: ThemePreference): void {
		this.preference = prefs;
		this.#mql ??= safeMatchMedia('(prefers-color-scheme: dark)');
		this.osPrefersDark = this.#mql?.matches ?? true;

		if (!this.#initialized) {
			this.#initialized = true;
			this.#attachListener();
		}
		this.#resolveAndApply();
	}

	/** Update the preference, re-resolve and re-apply. */
	setPreference(prefs: ThemePreference): void {
		this.preference = prefs;
		this.#resolveAndApply();
	}

	/**
	 * Cycle through the three modes for the StatusBar toggle button:
	 *   system → always-light → always-dark → system
	 * Slots are preserved. STEP 5 of PLAN-THEMING will refine this with a
	 * smarter behavior (cycle through themes when in 'Always' mode).
	 */
	cycleMode(): void {
		const order: ThemePreference['mode'][] = ['system', 'always-light', 'always-dark'];
		const idx = order.indexOf(this.preference.mode);
		const next = order[(idx + 1) % order.length];
		this.setPreference({ ...this.preference, mode: next });
	}

	#attachListener(): void {
		if (!this.#mql) return;
		this.#listener = (e: MediaQueryListEvent) => {
			this.osPrefersDark = e.matches;
			// Only re-resolve when the OS state actually drives the result —
			// in always-* modes we keep `osPrefersDark` in sync (for the picker
			// UI) but the effective theme is locked.
			if (this.preference.mode === 'system') {
				this.#resolveAndApply();
			}
		};
		this.#mql.addEventListener('change', this.#listener);
	}

	#resolveAndApply(): void {
		const next = resolveActiveTheme(this.preference, this.osPrefersDark);
		this.effective = next;
		applyTheme(next);
	}

	/** Test-only: detach the matchMedia listener and reset init flag. */
	teardownForTest(): void {
		if (this.#mql && this.#listener) {
			this.#mql.removeEventListener('change', this.#listener);
		}
		this.#mql = null;
		this.#listener = null;
		this.#initialized = false;
	}
}

export const themeManager = new ThemeManager();
