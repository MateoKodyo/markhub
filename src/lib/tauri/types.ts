// Mirror of src-tauri/src/models.rs — kept in sync manually.
// Serde camelCase mapping is applied on the Rust side, so JS keys are camelCase.

export type VaultMode = 'edit' | 'readonly';

export type Vault = {
	id: string;
	name: string;
	path: string;
	mode: VaultMode;
	color: string;
};

export type FileEntry = {
	name: string;
	relativePath: string;
	isDirectory: boolean;
	children?: FileEntry[];
};

export type LastOpenedFile = {
	vaultId: string;
	relativePath: string;
};

/**
 * Legacy `config.json -> settings` block. Kept for backwards compatibility
 * with existing configs; the v1 user settings live in their own file
 * (see `UserSettings` below) and are the new source of truth going forward.
 */
export type Settings = {
	autoSaveDelayMs: number;
	theme: string;
};

/**
 * PLAN-SETTINGS v1 user preferences — persisted in `settings.json` next to
 * `config.json` in the Tauri app config directory. Keys are camelCase to
 * match Rust's `#[serde(rename_all = "camelCase")]` on `UserSettings` and
 * its nested structs (see `src-tauri/src/models.rs`).
 *
 * Theme model (v2, PLAN-THEMING STEP 1):
 *   - `themeMode`  — system follow, always light, or always dark
 *   - `lightTheme` — which catalog theme to use when light is active
 *   - `darkTheme`  — which catalog theme to use when dark is active
 *
 * The legacy `theme: 'dark'|'light'|'system'` field (v1) migrates to this
 * trio in `mergeWithDefaults` on first load; see PLAN-THEMING §STEP 1.
 */
export type FollowMode = 'system' | 'always-light' | 'always-dark';

/* `ThemeId` is the catalog's single source of truth — re-exported here so
 * the tauri-facing types stay in one place but the union itself is only
 * declared once. Adding a theme to catalog.ts now propagates automatically
 * to every consumer of this module (no parallel-list drift). */
export type { ThemeId } from '$lib/theming/catalog';
import type { ThemeId } from '$lib/theming/catalog';

export interface ThemePreference {
	mode: FollowMode;
	lightTheme: ThemeId;
	darkTheme: ThemeId;
}

/** v1 theme value — kept for the migration path only. Do not use in new code. */
export type LegacyThemePreference = 'dark' | 'light' | 'system';

export type AppearanceSettings = {
	themeMode: FollowMode;
	lightTheme: ThemeId;
	darkTheme: ThemeId;
	editorFont: string;
	editorFontSize: number;
	editorLineHeight: number;
	/** Percentage of the editor area width (30–100). Was originally
	 *  a px value before 2026-05-14; `mergeWithDefaults` migrates any
	 *  loaded value > 100 to the new default. */
	editorContentWidth: number;
};

export type EditorSettings = {
	autosaveDelayMs: number;
	spellCheck: boolean;
};

export type SourceSettings = {
	monoFont: string;
};

export type FilesSettings = {
	confirmDelete: boolean;
};

export type SidebarSettings = {
	/** When true, the sidebar file list hides non-markdown files entirely.
	 *  When false (default), all files are shown; non-markdown files render
	 *  muted (see PLAN-SIDEBAR-FILE-VISIBILITY). */
	hideNonMarkdown: boolean;
};

/* `BehaviorSettings` retired 2026-05-14 — its only field
 * (`askBeforeClosingUnsaved`) became redundant once `activeFile.openFile`
 * started flushing pending saves unconditionally. The Rust side still
 * carries the struct for forward-compat on existing settings.json
 * files; serde ignores extra fields silently so loaded files keep
 * working without it on the TS side. */

export type UserSettings = {
	version: 2;
	appearance: AppearanceSettings;
	editor: EditorSettings;
	source: SourceSettings;
	files: FilesSettings;
	sidebar: SidebarSettings;
};

export const DEFAULT_USER_SETTINGS: UserSettings = {
	version: 2,
	appearance: {
		themeMode: 'system',
		lightTheme: 'markhub-light',
		darkTheme: 'markhub-dark',
		// ID matching the picker in `SettingsAppearance.svelte`. The actual
		// font-family stack is resolved there from this ID.
		editorFont: 'geist',
		editorFontSize: 16,
		editorLineHeight: 1.6,
		editorContentWidth: 60
	},
	editor: {
		autosaveDelayMs: 1500,
		spellCheck: true
	},
	source: {
		monoFont: 'geist-mono'
	},
	files: {
		confirmDelete: true
	},
	sidebar: {
		hideNonMarkdown: false
	}
};

export type VaultState = {
	expandedFolders: string[];
};

export type Config = {
	version: number;
	vaults: Vault[];
	lastOpenedFile: LastOpenedFile | null;
	settings: Settings;
	vaultStates: Record<string, VaultState>;
};

/* ----- Search (Cmd+Shift+F) ----- */

export type SearchOptions = {
	caseSensitive: boolean;
	wholeWord: boolean;
	regex: boolean;
};

/** A single line match inside a file. `matchStart` / `matchEnd` are byte
 *  offsets within `lineContent` (UTF-8); the front-end converts to char
 *  offsets when it highlights the match span. */
export type SearchHit = {
	lineNumber: number;
	lineContent: string;
	matchStart: number;
	matchEnd: number;
};

/** All hits for a single file, grouped together. */
export type SearchMatch = {
	relativePath: string;
	hits: SearchHit[];
};

export const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
	caseSensitive: false,
	wholeWord: false,
	regex: false
};
