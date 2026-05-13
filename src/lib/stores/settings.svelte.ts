/**
 * Settings store — owner of the v2 user preferences (PLAN-SETTINGS + PLAN-THEMING).
 *
 * Persists to `settings.json` (separate file from `config.json`, by design:
 * see STEP 6 Export/Import) via the Tauri commands `settings_read` /
 * `settings_write`. Persistence is debounced 250ms so a slider drag doesn't
 * fire a write per frame.
 *
 * Theme model is the trio {themeMode, lightTheme, darkTheme} (PLAN-THEMING
 * §STEP 1). The runtime applicator is `themeManager`; this store is the
 * authoritative *preference* layer and bridges new values to the manager
 * on load() and set().
 *
 * v1 → v2 migration: `mergeWithDefaults` detects a legacy `appearance.theme`
 * scalar and rewrites it into the trio (mode='system' with default slots).
 * The migrated payload is persisted on the next debounced write, so a v1
 * settings.json is upgraded on first read.
 */

import * as api from '$lib/tauri/api';
import {
	DEFAULT_USER_SETTINGS,
	type AppearanceSettings,
	type LegacyThemePreference,
	type ThemePreference,
	type UserSettings
} from '$lib/tauri/types';
import { themeManager } from '$lib/theming/manager.svelte';

/** Persist debounce — collapses a slider drag's per-tick writes into one. */
export const PERSIST_DEBOUNCE_MS = 250;

/**
 * Section IDs used by the modal's left-rail navigation and by deep-link
 * commands ("Settings → Appearance", "Settings → Editor", etc.).
 */
export type SettingsSection =
	| 'appearance'
	| 'editor'
	| 'source'
	| 'files'
	| 'advanced';

export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
	'appearance',
	'editor',
	'source',
	'files',
	'advanced'
] as const;

/**
 * v1 appearance shape — used only inside the migration path. The legacy
 * `theme` field is the only difference vs. v2.
 */
type LegacyAppearance = Partial<AppearanceSettings> & {
	theme?: LegacyThemePreference | string;
};

const LEGACY_THEME_VALUES: ReadonlySet<string> = new Set(['dark', 'light', 'system']);

/**
 * Merge a freshly-loaded settings payload with defaults, section by section.
 * Also performs the v1 → v2 theme migration so a settings.json written
 * before PLAN-THEMING shipped is silently upgraded on first read.
 *
 * Rust always returns a complete struct, but a corrupt-but-parseable payload
 * missing a section would otherwise leave the store with `undefined` fields.
 * This is the second line of defense after the Rust-side fallback.
 */
export function mergeWithDefaults(partial: Partial<UserSettings>): UserSettings {
	const appearancePartial = (partial.appearance ?? {}) as LegacyAppearance;
	const appearance = migrateAppearance(appearancePartial);

	// Migrate legacy pixel-based editorContentWidth (pre-2026-05-14) →
	// percent. Any value > 100 is treated as a leftover px and reset to
	// the new default.
	if (appearance.editorContentWidth > 100) {
		appearance.editorContentWidth = DEFAULT_USER_SETTINGS.appearance.editorContentWidth;
	}

	return {
		version: 2,
		appearance,
		editor: { ...DEFAULT_USER_SETTINGS.editor, ...(partial.editor ?? {}) },
		source: { ...DEFAULT_USER_SETTINGS.source, ...(partial.source ?? {}) },
		files: { ...DEFAULT_USER_SETTINGS.files, ...(partial.files ?? {}) }
	};
}

function migrateAppearance(input: LegacyAppearance): AppearanceSettings {
	// Strip the legacy field — it must NOT survive into v2 on disk.
	const { theme: legacyTheme, ...rest } = input;
	const merged: AppearanceSettings = {
		...DEFAULT_USER_SETTINGS.appearance,
		...rest
	};

	// If v1 fields are absent in `rest` AND a recognised legacy theme value
	// is present, seed the new mode from it. Unknown legacy strings fall
	// through to defaults silently.
	const hasV2Mode = (input as Partial<AppearanceSettings>).themeMode !== undefined;
	if (!hasV2Mode && typeof legacyTheme === 'string' && LEGACY_THEME_VALUES.has(legacyTheme)) {
		// All three legacy values map to mode='system' with default slots —
		// the user's intent ('dark' / 'light') becomes which family is "the
		// current one" via the OS, not a hard lock. They can lock from the
		// picker afterwards if they want.
		merged.themeMode = 'system';
	}

	return merged;
}

/** Shallow equality on the theme trio — used to detect a real theme change. */
function samePreference(a: ThemePreference, b: ThemePreference): boolean {
	return a.mode === b.mode && a.lightTheme === b.lightTheme && a.darkTheme === b.darkTheme;
}

function asPreference(appearance: AppearanceSettings): ThemePreference {
	return {
		mode: appearance.themeMode,
		lightTheme: appearance.lightTheme,
		darkTheme: appearance.darkTheme
	};
}

class SettingsStore {
	current = $state<UserSettings>(structuredClone(DEFAULT_USER_SETTINGS));

	/** UI state for the modal — `true` when the panel is visible. */
	isOpen = $state(false);
	/** Currently active section in the modal's left-rail navigation. */
	activeSection = $state<SettingsSection>('appearance');

	#initialized = false;
	#persistTimer: ReturnType<typeof setTimeout> | null = null;
	#pending: UserSettings | null = null;

	get isInitialized(): boolean {
		return this.#initialized;
	}

	open(section: SettingsSection = 'appearance'): void {
		this.activeSection = section;
		this.isOpen = true;
	}

	close(): void {
		this.isOpen = false;
	}

	/**
	 * Hydrate from `settings.json` and apply theme side effects.
	 * Idempotent — safe to call multiple times; only the first call hits disk.
	 *
	 * A v1 file is silently migrated to v2 here; the migrated shape is
	 * scheduled for persist so a single read+write upgrades the file on disk.
	 */
	async load(): Promise<void> {
		if (this.#initialized) return;
		this.#initialized = true;
		let migrated = false;
		try {
			const loaded = await api.settingsRead();
			// Detect migration: the loaded payload had a legacy `theme` field.
			migrated =
				(loaded as { appearance?: { theme?: unknown } })?.appearance?.theme !==
				undefined;
			this.current = mergeWithDefaults(loaded);
		} catch (e) {
			console.warn('[settings] failed to load — using defaults', e);
			this.current = structuredClone(DEFAULT_USER_SETTINGS);
		}

		// Bridge the persisted theme preference into the runtime theme manager.
		themeManager.init(asPreference(this.current.appearance));

		// If we just migrated v1 → v2, write the cleaned shape back to disk so
		// the legacy `theme` scalar is gone for good.
		if (migrated) {
			this.#schedulePersist();
		}
	}

	/**
	 * Replace the full settings object. Persists debounced. Schedules theme
	 * side effect when the theme trio changed.
	 */
	set(next: UserSettings): void {
		const prevPref = asPreference(this.current.appearance);
		const nextPref = asPreference(next.appearance);
		this.current = next;
		this.#schedulePersist();
		if (!samePreference(prevPref, nextPref)) {
			themeManager.setPreference(nextPref);
		}
	}

	/** Convenience: change the theme without touching the rest of the object. */
	setTheme(pref: ThemePreference): void {
		this.set({
			...this.current,
			appearance: {
				...this.current.appearance,
				themeMode: pref.mode,
				lightTheme: pref.lightTheme,
				darkTheme: pref.darkTheme
			}
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
		this.isOpen = false;
		this.activeSection = 'appearance';
	}
}

export const settingsStore = new SettingsStore();
