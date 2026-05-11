/**
 * Settings store — owner of the v1 user preferences (PLAN-SETTINGS).
 *
 * Persists to `settings.json` (separate file from `config.json`, by design:
 * see STEP 6 Export/Import) via the Tauri commands `settings_read` /
 * `settings_write`. Persistence is debounced 250ms so a slider drag doesn't
 * fire a write per frame.
 *
 * The theme field is delegated to the existing `themeStore` (which manages
 * `<html data-theme>` and the live `prefers-color-scheme` listener). The
 * new store is the authoritative *preference* layer; `themeStore` remains
 * the runtime applicator. STEP 3 (Appearance section) will widen this to
 * the 4 curated themes.
 */

import * as api from '$lib/tauri/api';
import {
	DEFAULT_USER_SETTINGS,
	type ThemePreference,
	type UserSettings
} from '$lib/tauri/types';
import { themeStore } from './theme.svelte';

/** Persist debounce — collapses a slider drag's per-tick writes into one. */
export const PERSIST_DEBOUNCE_MS = 250;

/**
 * Merge a freshly-loaded settings payload with defaults, section by section.
 * Rust always returns a complete struct, but a (future) corrupt-but-parseable
 * payload missing a section would otherwise leave the store with `undefined`
 * fields. This is the second line of defense after the Rust-side fallback.
 */
export function mergeWithDefaults(partial: Partial<UserSettings>): UserSettings {
	return {
		version: 1,
		appearance: {
			...DEFAULT_USER_SETTINGS.appearance,
			...(partial.appearance ?? {})
		},
		editor: { ...DEFAULT_USER_SETTINGS.editor, ...(partial.editor ?? {}) },
		source: { ...DEFAULT_USER_SETTINGS.source, ...(partial.source ?? {}) },
		files: { ...DEFAULT_USER_SETTINGS.files, ...(partial.files ?? {}) },
		behavior: {
			...DEFAULT_USER_SETTINGS.behavior,
			...(partial.behavior ?? {})
		}
	};
}

class SettingsStore {
	current = $state<UserSettings>(structuredClone(DEFAULT_USER_SETTINGS));

	#initialized = false;
	#persistTimer: ReturnType<typeof setTimeout> | null = null;
	#pending: UserSettings | null = null;

	get isInitialized(): boolean {
		return this.#initialized;
	}

	/**
	 * Hydrate from `settings.json` and apply side effects (theme).
	 * Idempotent — safe to call multiple times; only the first call hits disk.
	 */
	async load(): Promise<void> {
		if (this.#initialized) return;
		this.#initialized = true;
		try {
			const loaded = await api.settingsRead();
			this.current = mergeWithDefaults(loaded);
		} catch (e) {
			console.warn('[settings] failed to load — using defaults', e);
			this.current = structuredClone(DEFAULT_USER_SETTINGS);
		}
		// Bridge the persisted theme preference into the runtime theme manager.
		// themeStore.init() handles its own idempotency.
		themeStore.init();
		if (this.current.appearance.theme !== themeStore.preference) {
			await themeStore.setPreference(this.current.appearance.theme);
		}
	}

	/**
	 * Replace the full settings object. Persists debounced. Schedules theme
	 * side effect when `appearance.theme` changed.
	 */
	set(next: UserSettings): void {
		const prevTheme = this.current.appearance.theme;
		this.current = next;
		this.#schedulePersist();
		if (next.appearance.theme !== prevTheme) {
			themeStore.setPreference(next.appearance.theme).catch((e) =>
				console.warn('[settings] failed to apply theme side-effect', e)
			);
		}
	}

	/** Convenience: change the theme without touching the rest of the object. */
	setTheme(theme: ThemePreference): void {
		this.set({
			...this.current,
			appearance: { ...this.current.appearance, theme }
		});
	}

	#schedulePersist(): void {
		this.#pending = this.current;
		if (this.#persistTimer) clearTimeout(this.#persistTimer);
		this.#persistTimer = setTimeout(() => {
			this.#persistTimer = null;
			const snapshot = this.#pending;
			this.#pending = null;
			if (!snapshot) return;
			api.settingsWrite(snapshot).catch((e) =>
				console.warn('[settings] failed to persist', e)
			);
		}, PERSIST_DEBOUNCE_MS);
	}

	/**
	 * Test-only: flush any pending persist immediately. Awaited so callers
	 * can assert on what landed on disk without sleeping past the debounce.
	 */
	async flushForTest(): Promise<void> {
		if (!this.#persistTimer) return;
		clearTimeout(this.#persistTimer);
		this.#persistTimer = null;
		const snapshot = this.#pending;
		this.#pending = null;
		if (snapshot) await api.settingsWrite(snapshot);
	}

	/** Test-only: reset internal state between tests. */
	resetForTest(): void {
		if (this.#persistTimer) {
			clearTimeout(this.#persistTimer);
			this.#persistTimer = null;
		}
		this.#pending = null;
		this.#initialized = false;
		this.current = structuredClone(DEFAULT_USER_SETTINGS);
	}
}

export const settingsStore = new SettingsStore();
