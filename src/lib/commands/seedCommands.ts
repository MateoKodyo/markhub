/**
 * Seed commands — the minimal set registered at app startup to prove the
 * command system works end-to-end (STEP 1 of PLAN-COMMAND-SYSTEM).
 *
 * STEP 3 will widen this to the full command catalogue (file/vault/view/
 * settings/help) and split it per feature module. For now, three commands:
 *
 *   file.save           Cmd+S, manual flush of the active file
 *   view.toggleSidebar  toggles the file-tree sidebar
 *   view.toggleTheme    cycles dark → light → system → dark
 */

import { activeFileStore } from '$lib/stores/activeFile.svelte';
import { themeStore } from '$lib/stores/theme.svelte';
import { uiStateStore } from '$lib/stores/uiState.svelte';
import { commandRegistry } from './registry.svelte';

export function registerSeedCommands(): void {
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
}

/**
 * Default keymap — wired in the root layout. Only the save shortcut is
 * bound for STEP 1; the rest land in STEP 3 with the palette.
 */
export const SEED_KEYMAP = {
	'$mod+s': 'file.save'
} as const;
