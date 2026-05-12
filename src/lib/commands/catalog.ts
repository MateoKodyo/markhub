/**
 * Catalog — the meaningful set of commands wired into the registry at app
 * boot. Replaces the STEP 1 `seedCommands` once Command mode is live.
 *
 * Commands fall into three implementation flavors:
 *   1. Direct store calls — themeStore.cycle(), settingsStore.open(), …
 *   2. Tauri command wrappers — api.fileRevealInFinder, …
 *   3. `palette:action` events — for actions that depend on Sidebar-local
 *      state (active vault, file-tree handlers). Sidebar.svelte listens
 *      and routes. This is a deliberate event bus, not a temporary shim:
 *      it keeps Sidebar's startCreate / handleImport private to the
 *      component while still being reachable from anywhere.
 *
 * Every command registers an `id`, a user-facing `label`, a `group`, an
 * optional `shortcut` (display-only hint — actual binding lives in
 * `keymap.ts`), and a `when` guard that hides it when the action does
 * not apply (no active vault, no open file, etc).
 */

import { activeFileStore } from '$lib/stores/activeFile.svelte';
import { paletteStore } from '$lib/stores/palette.svelte';
import { settingsStore } from '$lib/stores/settings.svelte';
import { themeStore } from '$lib/stores/theme.svelte';
import { uiStateStore } from '$lib/stores/uiState.svelte';
import { vaultsStore } from '$lib/stores/vaults.svelte';
import { vaultTreeStore } from '$lib/stores/vaultTree.svelte';
import * as api from '$lib/tauri/api';
import { commandRegistry } from './registry.svelte';

/** Dispatch an event the Sidebar listens to. Centralised to keep the
 *  payload shape in one place; Sidebar's listener mirrors this contract. */
function dispatchSidebar(action: string): void {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new CustomEvent('palette:action', { detail: { action } }));
}

/** Toggle event for the editor preview/source switch — owned by +page. */
function dispatchEditorModeToggle(): void {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new CustomEvent('app:toggleEditorMode'));
}

function cycleVault(direction: 1 | -1): void {
	const ids = vaultsStore.vaults.map((v) => v.id);
	if (ids.length < 2) return;
	const current = vaultsStore.activeVaultId;
	const idx = current ? ids.indexOf(current) : -1;
	const next = ids[(idx + direction + ids.length) % ids.length];
	vaultsStore.selectVault(next);
}

export function registerAppCommands(): void {
	// ----- File -----
	commandRegistry.register({
		id: 'file.new',
		label: 'New File',
		group: 'File',
		when: () => vaultsStore.activeVaultId !== null,
		handler: () => dispatchSidebar('newFile')
	});

	commandRegistry.register({
		id: 'file.newFolder',
		label: 'New Folder',
		group: 'File',
		when: () => vaultsStore.activeVaultId !== null,
		handler: () => dispatchSidebar('newFolder')
	});

	commandRegistry.register({
		id: 'file.import',
		label: 'Import Files…',
		group: 'File',
		when: () => vaultsStore.activeVaultId !== null,
		handler: () => dispatchSidebar('importFile')
	});

	commandRegistry.register({
		id: 'file.save',
		label: 'Save File',
		group: 'File',
		shortcut: '⌘S',
		when: () => activeFileStore.activeFile !== null,
		handler: () => {
			void activeFileStore.forceSave();
		}
	});

	commandRegistry.register({
		id: 'file.reveal',
		label: 'Reveal in Finder',
		group: 'File',
		when: () => activeFileStore.activeFile !== null,
		handler: async () => {
			const af = activeFileStore.activeFile;
			if (!af) return;
			try {
				await api.fileRevealInFinder(af.vaultId, af.relativePath);
			} catch (e) {
				console.warn('[command] reveal failed', e);
			}
		}
	});

	// ----- Vault -----
	commandRegistry.register({
		id: 'vault.add',
		label: 'Add Vault…',
		group: 'Vault',
		handler: async () => {
			try {
				await vaultsStore.addVaultFromPicker();
			} catch (e) {
				console.warn('[command] addVaultFromPicker failed', e);
			}
		}
	});

	commandRegistry.register({
		id: 'vault.next',
		label: 'Next Vault',
		group: 'Vault',
		when: () => vaultsStore.vaults.length > 1,
		handler: () => cycleVault(1)
	});

	commandRegistry.register({
		id: 'vault.previous',
		label: 'Previous Vault',
		group: 'Vault',
		when: () => vaultsStore.vaults.length > 1,
		handler: () => cycleVault(-1)
	});

	// ----- View -----
	commandRegistry.register({
		id: 'view.toggleSidebar',
		label: 'Toggle Sidebar',
		group: 'View',
		handler: () => uiStateStore.toggleSidebar()
	});

	commandRegistry.register({
		id: 'view.toggleTheme',
		label: 'Toggle Theme',
		group: 'View',
		handler: () => {
			void themeStore.cycle();
		}
	});

	commandRegistry.register({
		id: 'view.toggleEditorMode',
		label: 'Toggle Preview / Source',
		group: 'View',
		when: () => activeFileStore.activeFile !== null,
		handler: () => dispatchEditorModeToggle()
	});

	// ----- Settings -----
	commandRegistry.register({
		id: 'settings.open',
		label: 'Open Settings',
		group: 'Settings',
		shortcut: '⌘,',
		handler: () => settingsStore.open()
	});

	// ----- Palette modes (open the palette itself) -----
	commandRegistry.register({
		id: 'palette.open',
		label: 'Open Command Palette',
		group: 'View',
		shortcut: '⌘K',
		handler: () => paletteStore.open('command')
	});

	commandRegistry.register({
		id: 'palette.openFile',
		label: 'Go to File…',
		group: 'View',
		shortcut: '⌘P',
		handler: () => {
			// Fire-and-forget refresh so the palette opens immediately on the
			// last-known tree, then updates reactively as new entries arrive.
			void vaultTreeStore.refresh();
			paletteStore.open('file');
		}
	});
}

/**
 * Default keymap — wired in the root layout. `palette.open` is
 * registered by `+page.svelte` after the layout effect runs; tinykeys
 * resolves command IDs at fire time so the late registration is fine.
 */
export const APP_KEYMAP = {
	'$mod+s': 'file.save',
	'$mod+k': 'palette.open',
	'$mod+p': 'palette.openFile',
	'$mod+,': 'settings.open'
} as const;

/** Test-only / HMR helper: clear every catalog entry. */
export function unregisterAppCommands(): void {
	for (const id of [
		'file.new',
		'file.newFolder',
		'file.import',
		'file.save',
		'file.reveal',
		'vault.add',
		'vault.next',
		'vault.previous',
		'view.toggleSidebar',
		'view.toggleTheme',
		'view.toggleEditorMode',
		'settings.open',
		'palette.open',
		'palette.openFile'
	]) {
		commandRegistry.unregister(id);
	}
}
