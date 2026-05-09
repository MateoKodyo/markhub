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

export type Settings = {
	autoSaveDelayMs: number;
	theme: string;
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
