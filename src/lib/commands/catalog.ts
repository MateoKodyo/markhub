/**
 * Catalog — the meaningful set of commands wired into the registry at app
 * boot. Replaces the STEP 1 `seedCommands` once Command mode is live.
 *
 * Commands fall into three implementation flavors:
 *   1. Direct store calls — themeManager.cycleMode(), settingsStore.open(), …
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

import {
	Bot,
	ClipboardCopy,
	Code2,
	Download,
	ExternalLink,
	FileInput,
	FilePlus,
	FileText,
	FolderPlus,
	Monitor,
	PanelLeft,
	PanelRight,
	Plus,
	Save,
	Search,
	Settings,
	Sparkles,
	X
} from 'lucide-svelte';
import { activeFileStore } from '$lib/stores/activeFile.svelte';
import { aiAwareStore } from '$lib/stores/aiAware.svelte';
import { findStore } from '$lib/stores/find.svelte';
import { paletteStore } from '$lib/stores/palette.svelte';
import { settingsStore } from '$lib/stores/settings.svelte';
import { themeManager } from '$lib/theming/manager.svelte';
import { toast } from '$lib/stores/toast.svelte';
import { uiStateStore } from '$lib/stores/uiState.svelte';
import { vaultsStore } from '$lib/stores/vaults.svelte';
import { vaultTreeStore } from '$lib/stores/vaultTree.svelte';
import * as api from '$lib/tauri/api';
import { defaultExportFilename, runExportWithToast } from '$lib/utils/export';
import { commandRegistry } from './registry.svelte';

/** Dispatch an event the Sidebar listens to. Centralised to keep the
 *  payload shape in one place; Sidebar's listener mirrors this contract. */
function dispatchSidebar(action: string): void {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new CustomEvent('palette:action', { detail: { action } }));
}

/** Copy the active file to the clipboard as an AI prompt — the content
 *  prefixed with a source-path header (and the AI-aware category when
 *  the file is recognized as one). PLAN-AI-READY STEP 6. */
async function copyFileAsPrompt(): Promise<void> {
	const active = activeFileStore.activeFile;
	if (!active) return;
	const info = aiAwareStore.getForFile(active.relativePath);
	const header = info
		? `# Source: ${active.relativePath}\n# Type: ${info.label}\n\n`
		: `# Source: ${active.relativePath}\n\n`;
	try {
		await navigator.clipboard.writeText(header + activeFileStore.content);
		toast.success('Copié comme prompt IA');
	} catch (e) {
		toast.error('Copie impossible', { details: String(e) });
	}
}

/** Toggle event for the editor preview/source switch — owned by +page. */
function dispatchEditorModeToggle(): void {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new CustomEvent('app:toggleEditorMode'));
}

export function registerAppCommands(): void {
	// ----- File -----
	commandRegistry.register({
		id: 'file.new',
		label: 'New File',
		group: 'File',
		icon: FilePlus,
		when: () => vaultsStore.activeVaultId !== null,
		handler: () => dispatchSidebar('newFile')
	});

	commandRegistry.register({
		id: 'file.newFolder',
		label: 'New Folder',
		group: 'File',
		icon: FolderPlus,
		when: () => vaultsStore.activeVaultId !== null,
		handler: () => dispatchSidebar('newFolder')
	});

	commandRegistry.register({
		id: 'file.import',
		label: 'Import Files…',
		group: 'File',
		icon: FileInput,
		when: () => vaultsStore.activeVaultId !== null,
		handler: () => dispatchSidebar('importFile')
	});

	commandRegistry.register({
		id: 'file.save',
		label: 'Save File',
		group: 'File',
		icon: Save,
		shortcut: '⌘S',
		// Hidden from the palette: autosave covers the common case, and
		// users who really want to flush manually already have Cmd+S.
		// Keeping it in the registry so the keymap can resolve it.
		hidden: true,
		when: () => activeFileStore.activeFile !== null,
		handler: () => {
			void activeFileStore.forceSave();
		}
	});

	commandRegistry.register({
		id: 'file.reveal',
		label: 'Reveal in Finder',
		group: 'File',
		icon: ExternalLink,
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

	commandRegistry.register({
		id: 'file.export',
		label: 'Export File…',
		group: 'File',
		icon: Download,
		when: () => activeFileStore.activeFile !== null,
		handler: async () => {
			const af = activeFileStore.activeFile;
			if (!af) return;
			await runExportWithToast(
				activeFileStore.content,
				defaultExportFilename(af.relativePath)
			);
		}
	});

	// ----- Vault -----
	commandRegistry.register({
		id: 'vault.add',
		label: 'Add Vault…',
		group: 'Vault',
		icon: Plus,
		handler: async () => {
			try {
				await vaultsStore.addVaultFromPicker();
			} catch (e) {
				console.warn('[command] addVaultFromPicker failed', e);
			}
		}
	});

	// ----- View -----
	commandRegistry.register({
		id: 'view.toggleSidebar',
		label: 'Toggle Sidebar',
		group: 'View',
		icon: PanelLeft,
		handler: () => uiStateStore.toggleSidebar()
	});

	commandRegistry.register({
		id: 'view.toggleTheme',
		label: 'Toggle Theme',
		group: 'View',
		icon: Monitor,
		handler: () => {
			themeManager.cycleMode();
			settingsStore.setTheme(themeManager.preference);
		}
	});

	commandRegistry.register({
		id: 'view.toggleEditorMode',
		label: 'Toggle Preview / Source',
		group: 'View',
		icon: Code2,
		when: () => activeFileStore.activeFile !== null,
		handler: () => dispatchEditorModeToggle()
	});

	commandRegistry.register({
		id: 'view.toggleOutline',
		label: 'Toggle Outline',
		group: 'View',
		icon: PanelRight,
		shortcut: '⌘\\',
		handler: () => uiStateStore.toggleOutline()
	});

	// ----- Find in document (Cmd+F) -----
	commandRegistry.register({
		id: 'find.open',
		label: 'Find in Document',
		group: 'View',
		icon: Search,
		shortcut: '⌘F',
		when: () => activeFileStore.activeTabId !== null,
		handler: () => findStore.open()
	});
	commandRegistry.register({
		id: 'find.next',
		label: 'Next Match',
		group: 'View',
		shortcut: '⌘G',
		hidden: true,
		when: () => findStore.query.length > 0,
		handler: () => findStore.next()
	});
	commandRegistry.register({
		id: 'find.previous',
		label: 'Previous Match',
		group: 'View',
		shortcut: '⇧⌘G',
		hidden: true,
		when: () => findStore.query.length > 0,
		handler: () => findStore.previous()
	});

	// ----- AI-aware files (PLAN-AI-READY STEP 6) -----
	commandRegistry.register({
		id: 'ai.show-aware-files',
		label: 'Show AI-aware Files in Vault',
		group: 'AI',
		icon: Sparkles,
		when: () => vaultsStore.activeVaultId !== null,
		// Toggles the sidebar "Show AI files" filter (shared state).
		handler: () => {
			uiStateStore.aiFilesOnly = !uiStateStore.aiFilesOnly;
		}
	});
	commandRegistry.register({
		id: 'ai.copy-as-prompt',
		label: 'Copy File as AI Prompt',
		group: 'AI',
		icon: ClipboardCopy,
		when: () => activeFileStore.activeTabId !== null,
		handler: () => void copyFileAsPrompt()
	});
	commandRegistry.register({
		id: 'ai.open-claude-md',
		label: 'Open Project CLAUDE.md',
		group: 'AI',
		icon: Bot,
		when: () => vaultsStore.activeVaultId !== null,
		handler: () => dispatchSidebar('openClaudeMd')
	});

	// ----- Tabs -----
	commandRegistry.register({
		id: 'tab.close',
		label: 'Close Tab',
		group: 'Tabs',
		icon: X,
		shortcut: '⌘W',
		when: () => activeFileStore.activeTabId !== null,
		handler: () => activeFileStore.closeActiveTab()
	});
	// Cmd+1..9 → activate tab at that 1-based index. Registered as nine
	// hidden commands so the keymap can resolve each shortcut separately;
	// they don't clutter Cmd+K (Cmd+1 in a list would be noise).
	for (let i = 1; i <= 9; i++) {
		commandRegistry.register({
			id: `tab.goto.${i}`,
			label: `Go to Tab ${i}`,
			group: 'Tabs',
			shortcut: `⌘${i}`,
			hidden: true,
			when: () => activeFileStore.tabs.length >= i,
			handler: () => activeFileStore.activateTabAtIndex(i)
		});
	}

	// ----- Settings -----
	commandRegistry.register({
		id: 'settings.open',
		label: 'Open Settings',
		group: 'Settings',
		icon: Settings,
		shortcut: '⌘,',
		handler: () => settingsStore.open()
	});

	// Section-specific deep-links for the Settings modal. Each one opens
	// the modal already focused on the requested section — useful from
	// Cmd+K when the user knows which knob they need ("editor", "advanced").
	commandRegistry.register({
		id: 'settings.open.appearance',
		label: 'Settings: Appearance',
		group: 'Settings',
		icon: Settings,
		handler: () => settingsStore.open('appearance')
	});
	commandRegistry.register({
		id: 'settings.open.editor',
		label: 'Settings: Editor',
		group: 'Settings',
		icon: Settings,
		handler: () => settingsStore.open('editor')
	});
	commandRegistry.register({
		id: 'settings.open.source',
		label: 'Settings: Source Mode',
		group: 'Settings',
		icon: Settings,
		handler: () => settingsStore.open('source')
	});
	commandRegistry.register({
		id: 'settings.open.files',
		label: 'Settings: Files',
		group: 'Settings',
		icon: Settings,
		handler: () => settingsStore.open('files')
	});
	commandRegistry.register({
		id: 'settings.open.advanced',
		label: 'Settings: Advanced',
		group: 'Settings',
		icon: Settings,
		handler: () => settingsStore.open('advanced')
	});

	// ----- Palette modes (open the palette itself) -----
	commandRegistry.register({
		id: 'palette.open',
		label: 'Open Command Palette',
		group: 'View',
		shortcut: '⌘K',
		// Hidden — listing "Open Command Palette" inside the palette is
		// meta-circular. The keymap still resolves it via Cmd+K.
		hidden: true,
		handler: () => paletteStore.open('command')
	});

	commandRegistry.register({
		id: 'palette.openFile',
		label: 'Go to File…',
		group: 'View',
		icon: FileText,
		shortcut: '⌘P',
		handler: () => {
			// Fire-and-forget refresh so the palette opens immediately on the
			// last-known tree, then updates reactively as new entries arrive.
			void vaultTreeStore.refresh();
			paletteStore.open('file');
		}
	});

	commandRegistry.register({
		id: 'palette.openSearch',
		label: 'Search in Vault…',
		group: 'View',
		icon: Search,
		shortcut: '⌘⇧F',
		when: () => vaultsStore.activeVaultId !== null,
		handler: () => paletteStore.open('search')
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
	'$mod+Shift+f': 'palette.openSearch',
	'$mod+\\': 'view.toggleOutline',
	'$mod+f': 'find.open',
	'$mod+g': 'find.next',
	'$mod+Shift+g': 'find.previous',
	'$mod+,': 'settings.open',
	'$mod+w': 'tab.close',
	'$mod+1': 'tab.goto.1',
	'$mod+2': 'tab.goto.2',
	'$mod+3': 'tab.goto.3',
	'$mod+4': 'tab.goto.4',
	'$mod+5': 'tab.goto.5',
	'$mod+6': 'tab.goto.6',
	'$mod+7': 'tab.goto.7',
	'$mod+8': 'tab.goto.8',
	'$mod+9': 'tab.goto.9'
} as const;

/** Test-only / HMR helper: clear every catalog entry. */
export function unregisterAppCommands(): void {
	for (const id of [
		'file.new',
		'file.newFolder',
		'file.import',
		'file.save',
		'file.reveal',
		'file.export',
		'vault.add',
		'view.toggleSidebar',
		'view.toggleTheme',
		'view.toggleEditorMode',
		'view.toggleOutline',
		'find.open',
		'find.next',
		'find.previous',
		'tab.close',
		'tab.goto.1',
		'tab.goto.2',
		'tab.goto.3',
		'tab.goto.4',
		'tab.goto.5',
		'tab.goto.6',
		'tab.goto.7',
		'tab.goto.8',
		'tab.goto.9',
		'settings.open',
		'settings.open.appearance',
		'settings.open.editor',
		'settings.open.source',
		'settings.open.files',
		'settings.open.advanced',
		'palette.open',
		'palette.openFile',
		'palette.openSearch'
	]) {
		commandRegistry.unregister(id);
	}
}
