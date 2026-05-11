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
 * Theme is currently typed as `'dark' | 'light' | 'system'` (the legacy
 * theme model) — STEP 3 (Appearance section) will widen it to the 4 curated
 * themes when their CSS lands.
 */
export type ThemePreference = 'dark' | 'light' | 'system';

export type AppearanceSettings = {
	theme: ThemePreference;
	editorFont: string;
	editorFontSize: number;
	editorLineHeight: number;
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

export type BehaviorSettings = {
	askBeforeClosingUnsaved: boolean;
};

export type UserSettings = {
	version: 1;
	appearance: AppearanceSettings;
	editor: EditorSettings;
	source: SourceSettings;
	files: FilesSettings;
	behavior: BehaviorSettings;
};

export const DEFAULT_USER_SETTINGS: UserSettings = {
	version: 1,
	appearance: {
		theme: 'system',
		editorFont: 'Geist Sans',
		editorFontSize: 16,
		editorLineHeight: 1.6,
		editorContentWidth: 720
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
	behavior: {
		askBeforeClosingUnsaved: true
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
