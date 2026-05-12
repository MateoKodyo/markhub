<script lang="ts">
	import { onMount } from 'svelte';
	import { Lock, PanelLeft } from 'lucide-svelte';
	import { getCurrentWindow } from '@tauri-apps/api/window';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Editor, { type EditorMode } from '$lib/components/Editor.svelte';
	import StatusBar from '$lib/components/StatusBar.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import InputDialog from '$lib/components/InputDialog.svelte';
	import SettingsModal from '$lib/components/SettingsModal.svelte';
	import { vaultsStore } from '$lib/stores/vaults.svelte';
	import { activeFileStore } from '$lib/stores/activeFile.svelte';
	import { themeStore } from '$lib/stores/theme.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { uiStateStore } from '$lib/stores/uiState.svelte';
	import CommandPalette from '$lib/components/CommandPalette.svelte';
	import { commandRegistry } from '$lib/commands/registry.svelte';
	import { bindCommandKeymap } from '$lib/commands/keymap';
	import { joinPath } from '$lib/utils/path';
	import * as api from '$lib/tauri/api';

	type PendingAction = 'create' | 'sample' | 'clone';

	let loadError = $state<string | null>(null);
	let editorMode = $state<EditorMode>('preview');

	// EmptyState → pick directory → in-app modal flow.
	let pendingAction = $state<PendingAction | null>(null);
	let pendingParentDir = $state<string | null>(null);

	const promptConfig = $derived.by(() => {
		switch (pendingAction) {
			case 'create':
				return {
					title: 'Nouveau vault',
					placeholder: 'Nom du vault',
					defaultValue: '',
					submitLabel: 'Créer'
				};
			case 'sample':
				return {
					title: "Vault d'exemple",
					placeholder: 'Nom du vault',
					defaultValue: "Vault d'exemple",
					submitLabel: 'Créer'
				};
			case 'clone':
				return {
					title: 'Cloner un repo Git',
					placeholder: 'https://github.com/org/repo.git',
					defaultValue: '',
					submitLabel: 'Cloner'
				};
			default:
				return null;
		}
	});

	/**
	 * Mono-font CSS bridge — when the user picks a different monospace font
	 * in Settings → Mode source, we override the global `--font-mono` token
	 * so every code surface (source mode, code blocks, inline code) picks
	 * the new family without each consumer needing to know.
	 */
	const MONO_FAMILY_BY_ID: Record<string, string> = {
		'geist-mono':
			"'Geist Mono Variable', 'SF Mono', 'Monaco', 'Cascadia Code', monospace",
		'jetbrains-mono': "'JetBrains Mono', 'SF Mono', 'Monaco', 'Cascadia Code', monospace",
		'fira-code': "'Fira Code', 'SF Mono', 'Monaco', 'Cascadia Code', monospace"
	};

	$effect(() => {
		const id = settingsStore.current.source.monoFont;
		const family = MONO_FAMILY_BY_ID[id] ?? MONO_FAMILY_BY_ID['geist-mono'];
		document.documentElement.style.setProperty('--font-mono', family);
	});

	/**
	 * Editor typography CSS bridge — mirrors the appearance settings to
	 * global CSS variables that the editor consumes. Same one-effect-no-prop
	 * pattern as the mono font bridge.
	 *
	 * `--font-editor`        → consumed by editor-blocknote.css for the
	 *                          editor surface + heading scale (heading
	 *                          family changes live).
	 * `--content-max-width`  → consumed by Editor.svelte's `.canvas` for
	 *                          the writing measure (live).
	 *
	 * Body font-size + line-height are intentionally NOT wired here. The
	 * BlockNote cascade owns the body typography internally and overriding
	 * it cleanly needs BlockNote's theming API — tracked in BACKLOG.md.
	 */
	const EDITOR_FAMILY_BY_ID: Record<string, string> = {
		geist: "'Geist Variable', system-ui, -apple-system, 'Helvetica Neue', sans-serif",
		system: "-apple-system, system-ui, BlinkMacSystemFont, 'Segoe UI', sans-serif",
		serif: "'Iowan Old Style', 'Charter', 'Georgia', serif",
		mono: "'Geist Mono Variable', 'SF Mono', 'Monaco', 'Cascadia Code', monospace"
	};

	$effect(() => {
		const a = settingsStore.current.appearance;
		const root = document.documentElement.style;
		root.setProperty('--font-editor', EDITOR_FAMILY_BY_ID[a.editorFont] ?? EDITOR_FAMILY_BY_ID.geist);
		root.setProperty('--content-max-width', `${a.editorContentWidth}px`);
	});

	// --- STEP 2 smoke test wiring (TEMPORARY — replaced in STEP 3) ---------
	// A throwaway debug palette so Matheo can validate the shell's visuals
	// and keyboard behavior. STEP 3 swaps this for the real Command mode
	// (Cmd+K → registry-driven palette).
	let paletteOpen = $state(false);
	let paletteQuery = $state('');
	let paletteSelectedIndex = $state(0);

	// Each debug item dispatches either through the command registry
	// (commandId), or via a `palette:action` event that the Sidebar listens
	// to for file-tree operations. Vault-required items render disabled
	// when no vault is active; "comingSoon" rows are UI shells tracked in
	// BACKLOG.md.
	type DebugItem = {
		label: string;
		group: string;
		commandId?: string;
		paletteAction?: 'newFile' | 'newFolder' | 'importFile';
		requiresVault?: boolean;
		comingSoon?: boolean;
	};

	const PALETTE_DEBUG_ITEMS: DebugItem[] = [
		{
			label: 'New file',
			group: 'File',
			paletteAction: 'newFile',
			requiresVault: true
		},
		{
			label: 'New folder',
			group: 'File',
			paletteAction: 'newFolder',
			requiresVault: true
		},
		{
			label: 'Import file',
			group: 'File',
			paletteAction: 'importFile',
			requiresVault: true
		},
		{ label: 'Toggle theme', group: 'View', commandId: 'view.toggleTheme' },
		{ label: 'Toggle sidebar', group: 'View', commandId: 'view.toggleSidebar' },
		{ label: 'Open settings', group: 'Settings', commandId: 'settings.open' },
		{ label: 'Export as Markdown', group: 'Export', comingSoon: true },
		{ label: 'Export as PDF', group: 'Export', comingSoon: true }
	];

	// Resolve disabled state + badge text once per render. Reactive on
	// vaultsStore.activeVaultId so opening a vault re-enables the file ops
	// while the palette is closed.
	const paletteDebugResolved = $derived.by(() => {
		const hasVault = vaultsStore.activeVaultId != null;
		return PALETTE_DEBUG_ITEMS.map((item) => {
			const needsVault = !!item.requiresVault && !hasVault;
			const disabled = !!item.comingSoon || needsVault;
			const badge = item.comingSoon ? 'Soon' : needsVault ? 'Vault' : null;
			return { ...item, disabled, badge };
		});
	});

	const paletteDebugFiltered = $derived.by(() => {
		const q = paletteQuery.toLowerCase().trim();
		const items = paletteDebugResolved;
		if (!q) return items;
		return items.filter((it) => it.label.toLowerCase().includes(q));
	});

	$effect(() => {
		commandRegistry.register({
			id: 'palette.debug',
			label: 'Open Command Palette (debug)',
			group: 'View',
			handler: () => {
				paletteQuery = '';
				paletteSelectedIndex = 0;
				paletteOpen = true;
			}
		});
		// Smoke shim: a "Open Settings" command exists so Enter has a visible
		// effect; the real settings command lands in STEP 3's seed catalog.
		commandRegistry.register({
			id: 'settings.open',
			label: 'Open Settings',
			group: 'Settings',
			handler: () => settingsStore.open()
		});
		return bindCommandKeymap({ '$mod+k': 'palette.debug' });
	});

	// Shared activation path — Enter (from CommandPalette.onActivate) and
	// mouse click on a row both flow through here, so a future tweak to
	// what "activate" means stays in one place.
	function activatePaletteDebugItem(index: number): void {
		const item = paletteDebugFiltered[index];
		if (!item || item.disabled) return;
		paletteOpen = false;
		if (item.paletteAction) {
			window.dispatchEvent(
				new CustomEvent('palette:action', { detail: { action: item.paletteAction } })
			);
		} else if (item.commandId) {
			commandRegistry.getById(item.commandId)?.handler();
		}
	}
	// --- end STEP 2 smoke ---------------------------------------------------

	onMount(async () => {
		try {
			await vaultsStore.load();
			// Theme has to init AFTER vaultsStore.load so it sees the persisted
			// `settings.theme`. Sets data-theme on <html> + listens to OS changes.
			themeStore.init();
			// Hydrate the v1 user settings (PLAN-SETTINGS) from `settings.json`.
			// Internally bridges its `appearance.theme` to themeStore, so the
			// new preference (when present) wins over the legacy config.theme.
			await settingsStore.load();
			// Restore the last-opened vault (so the sidebar shows the right
			// files), but DO NOT auto-open the last file — the launch screen
			// is always the EmptyState. lastOpenedFile is preserved in the
			// config so a future "resume last session" command could opt in.
			const lof = vaultsStore.lastOpenedFile;
			if (lof && vaultsStore.vaults.some((v) => v.id === lof.vaultId)) {
				vaultsStore.selectVault(lof.vaultId);
			}
		} catch (e) {
			loadError = String(e);
		}
	});

	function onContentChange(newContent: string) {
		activeFileStore.updateContent(newContent);
	}

	async function onEmptyStateOpenVault() {
		try {
			await vaultsStore.addVaultFromPicker();
		} catch (e) {
			console.warn('[empty-state] addVaultFromPicker failed', e);
		}
	}

	async function startActionWithPicker(action: PendingAction) {
		try {
			const dir = await api.vaultPickDirectory();
			if (!dir) return;
			pendingParentDir = dir;
			pendingAction = action;
		} catch (e) {
			console.warn('[empty-state] directory picker failed', e);
		}
	}

	async function onPromptSubmit(value: string) {
		if (!pendingAction || !pendingParentDir) return;
		const action = pendingAction;
		const parent = pendingParentDir;
		if (action === 'create') {
			await vaultsStore.createVault(parent, value);
		} else if (action === 'sample') {
			await vaultsStore.createSampleVault(parent, value);
		} else if (action === 'clone') {
			await vaultsStore.cloneGitVault(parent, value);
		}
		pendingAction = null;
		pendingParentDir = null;
	}

	function cancelPrompt() {
		pendingAction = null;
		pendingParentDir = null;
	}

	function onEmptyStateOpenRecent(vaultId: string) {
		vaultsStore.selectVault(vaultId);
	}

	async function copyActiveFilePath() {
		const v = vaultsStore.activeVault;
		const f = activeFileStore.activeFile;
		if (!v || !f) return;
		try {
			await navigator.clipboard.writeText(joinPath(v.path, f.relativePath));
		} catch (e) {
			console.warn('[clipboard] copy failed', e);
		}
	}

	// Re-key on file switch so the BlockNote instance is fully reset.
	const editorKey = $derived(
		activeFileStore.activeFile
			? `${activeFileStore.activeFile.vaultId}:${activeFileStore.activeFile.relativePath}`
			: 'empty'
	);

	/**
	 * Window-dragging from the chrome strip. We wire `mousedown` manually
	 * (rather than relying solely on `data-tauri-drag-region`) because with
	 * `titleBarStyle: "Overlay"` on macOS, the Tauri 2 runtime auto-binding
	 * does not always intercept clicks on a 44px custom strip — the OS
	 * traffic-light gutter overlaps the WebView and the drag region handler
	 * silently no-ops. Calling `startDragging()` from a mousedown that
	 * originates anywhere in the strip *except* on a control is bulletproof.
	 */
	async function onChromeMouseDown(e: MouseEvent) {
		if (e.button !== 0) return;
		const target = e.target as HTMLElement | null;
		if (target?.closest('button, a, input, textarea, select')) return;
		try {
			await getCurrentWindow().startDragging();
		} catch (err) {
			console.warn('[window] startDragging failed', err);
		}
	}

	/**
	 * Global Cmd+, (macOS) / Ctrl+, (Win/Linux) opens the Settings modal.
	 * Mirrors the OS convention. PLAN-COMMAND-SYSTEM will later route this
	 * through the central registry (and add Cmd+K → "Open Settings"); for
	 * now the binding lives here so the modal is reachable from anywhere.
	 */
	function onGlobalKeydown(e: KeyboardEvent) {
		const isComma = e.key === ',';
		const isMeta = e.metaKey || e.ctrlKey;
		if (isComma && isMeta) {
			e.preventDefault();
			settingsStore.open();
		}
	}
</script>

<svelte:window onkeydown={onGlobalKeydown} />

<div class="app">
	<!-- The window-chrome strip is a drag region, not an interactive
	     control. There is no fitting ARIA role for "OS window drag" — the
	     interactive element inside (the toggle button) carries its own
	     semantics. Suppress the a11y lint here. -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<header
		class="window-chrome"
		data-tauri-drag-region
		onmousedown={onChromeMouseDown}
	>
		<button
			type="button"
			class="chrome-toggle"
			class:is-active={!uiStateStore.sidebarCollapsed}
			onclick={() => uiStateStore.toggleSidebar()}
			aria-label={uiStateStore.sidebarCollapsed ? 'Déplier la sidebar' : 'Replier la sidebar'}
			aria-pressed={!uiStateStore.sidebarCollapsed}
			title={uiStateStore.sidebarCollapsed ? 'Déplier la sidebar' : 'Replier la sidebar'}
		>
			<PanelLeft size={16} strokeWidth={1.5} aria-hidden="true" focusable="false" />
		</button>
	</header>

	<div class="app-body">
		<Sidebar collapsed={uiStateStore.sidebarCollapsed} />

		<main class="content">
		{#if loadError}
			<div class="placeholder">
				<span class="label">Erreur</span>
				<p>{loadError}</p>
			</div>
		{:else if activeFileStore.activeFile}
			<header class="content-header">
				<div class="breadcrumb">
					<span class="caption">{activeFileStore.activeFile.relativePath}</span>
					{#if vaultsStore.isActiveVaultReadonly}
						<span class="badge-readonly" aria-label="Lecture seule">
							<Lock size={11} aria-hidden="true" focusable="false" />
							<span>Lecture seule</span>
						</span>
					{/if}
				</div>

				<div class="header-controls">
					<div
						class="mode-toggle"
						role="group"
						aria-label="Mode éditeur"
						data-testid="mode-toggle"
					>
						<button
							type="button"
							class="seg-btn"
							class:is-active={editorMode === 'preview'}
							onclick={() => (editorMode = 'preview')}
							aria-pressed={editorMode === 'preview'}
						>
							Preview
						</button>
						<button
							type="button"
							class="seg-btn"
							class:is-active={editorMode === 'source'}
							onclick={() => (editorMode = 'source')}
							aria-pressed={editorMode === 'source'}
						>
							Source
						</button>
					</div>
				</div>
			</header>

			<div class="content-body">
				{#key editorKey}
					<Editor
						content={activeFileStore.content}
						readonly={vaultsStore.isActiveVaultReadonly}
						mode={editorMode}
						onChange={onContentChange}
					/>
				{/key}
			</div>
		{:else}
			<EmptyState
				vaults={vaultsStore.vaults}
				onOpenVault={onEmptyStateOpenVault}
				onCreateVault={() => startActionWithPicker('create')}
				onCloneGit={() => startActionWithPicker('clone')}
				onCreateSample={() => startActionWithPicker('sample')}
				onOpenRecentVault={onEmptyStateOpenRecent}
			/>
		{/if}

		<InputDialog
			open={pendingAction !== null && promptConfig !== null}
			title={promptConfig?.title ?? ''}
			placeholder={promptConfig?.placeholder ?? ''}
			defaultValue={promptConfig?.defaultValue ?? ''}
			submitLabel={promptConfig?.submitLabel ?? 'OK'}
			onSubmit={onPromptSubmit}
			onCancel={cancelPrompt}
		/>

		<!-- Status bar lives INSIDE <main.content> so it only spans the editor
		     area — the sidebar runs full-height to its left. Warp pattern. -->
		<StatusBar
			vault={vaultsStore.activeVault}
			relativePath={activeFileStore.activeFile?.relativePath ?? null}
			readonly={vaultsStore.isActiveVaultReadonly}
			content={activeFileStore.content}
			status={activeFileStore.status}
			onCopyPath={copyActiveFilePath}
		/>
		</main>
	</div>
</div>

<SettingsModal />

<!-- STEP 2 smoke palette — temporary, removed in STEP 3 -->
<CommandPalette
	open={paletteOpen}
	placeholder="Debug palette (STEP 2)"
	itemCount={paletteDebugFiltered.length}
	bind:query={paletteQuery}
	bind:selectedIndex={paletteSelectedIndex}
	onClose={() => (paletteOpen = false)}
	onActivate={activatePaletteDebugItem}
>
	<ul class="debug-palette-list" role="listbox">
		{#each paletteDebugFiltered as item, i (item.label)}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- Keyboard activation lives on the input (Enter dispatches via
				 CommandPalette.onActivate). This row is mouse-only. -->
			<li
				role="option"
				aria-selected={i === paletteSelectedIndex}
				aria-disabled={item.disabled ? 'true' : undefined}
				class="debug-palette-row"
				class:is-selected={i === paletteSelectedIndex}
				class:is-disabled={item.disabled}
				onmouseenter={() => {
					if (!item.disabled) paletteSelectedIndex = i;
				}}
				onclick={() => activatePaletteDebugItem(i)}
			>
				<span class="debug-palette-label">{item.label}</span>
				{#if item.badge}
					<span class="debug-palette-soon">{item.badge}</span>
				{:else}
					<span class="debug-palette-group">{item.group}</span>
				{/if}
			</li>
		{/each}
		{#if paletteDebugFiltered.length === 0}
			<li class="debug-palette-empty">No matches</li>
		{/if}
	</ul>
</CommandPalette>

<style>
	.app {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	/* Window chrome strip — sits at the top of the window above the
	 * sidebar/content body. With macOS `titleBarStyle: "Overlay"`, the
	 * traffic lights overlay the left at y~7px (center y~14px). The
	 * 24×24 toggle sits at padding-top 2px so its icon glyph center
	 * (y~14px) aligns visually with the lights' center. */
	.window-chrome {
		height: 44px;
		flex-shrink: 0;
		display: flex;
		align-items: flex-start;
		gap: var(--space-1);
		padding: 5px var(--space-3) 0 80px;
		background: var(--color-bg);
	}

	.chrome-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		padding: 0;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-text-secondary);
		cursor: pointer;
		transition:
			background-color var(--duration-base) var(--easing-standard),
			color var(--duration-base) var(--easing-standard);
	}

	.chrome-toggle:hover {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}

	/* Active state when the sidebar is open — only an icon color bump,
	 * no background fill. Keeps the button from reading as a discrete
	 * "block" against the chrome strip; the icon-only signal mirrors
	 * Mac toolbar conventions. */
	.chrome-toggle.is-active {
		color: var(--color-text-primary);
	}

	.chrome-toggle:focus-visible {
		outline: 2px solid color-mix(in oklab, var(--color-accent) 40%, transparent);
		outline-offset: 1px;
	}

	.app-body {
		flex: 1;
		display: flex;
		min-height: 0;
	}

	.content {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		overflow: hidden;
	}

	.content-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-4);
		border-bottom: 1px solid var(--color-border-subtle);
		min-height: 44px;
	}

	.breadcrumb {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-width: 0;
		overflow: hidden;
	}

	.breadcrumb .caption {
		font-family: var(--font-mono);
		font-size: var(--text-caption);
		color: var(--color-text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.badge-readonly {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		flex-shrink: 0;
		padding: 2px var(--space-2);
		font-size: var(--text-label);
		letter-spacing: var(--tracking-caption);
		color: var(--color-text-secondary);
		background: var(--color-surface-veil);
		border: 1px solid var(--color-border-subtle);
		border-radius: var(--radius-sm);
	}

	.header-controls {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex-shrink: 0;
	}

	/* === Preview / Source mode toggle ===
	 * Relocated from the status bar (PLAN-BLOCKNOTE step 4): sits at the
	 * top-right of the editor area, inside the existing content header.
	 * Reuses the pill tokens so the visual treatment stays consistent
	 * with the rest of Markhub's chrome. */
	.mode-toggle {
		display: inline-flex;
		align-items: center;
		gap: 1px;
		height: var(--pill-height);
		padding: 1px;
		background: var(--pill-bg);
		border-radius: var(--pill-radius);
	}

	.seg-btn {
		height: calc(var(--pill-height) - 4px);
		padding: 0 var(--space-2);
		border: 0;
		border-radius: calc(var(--pill-radius) - 2px);
		background: transparent;
		color: var(--color-text-secondary);
		/* `--font-ui` is the locked plan-aligned alias for the UI font
		 * (currently resolves to `--font-sans`; will diverge from
		 * `--font-editor` once PLAN-SETTINGS lands). Pipeline proof for
		 * PLAN-DESIGN-DEFAULTS step 1. */
		font-family: var(--font-ui);
		font-size: var(--text-label);
		line-height: 1;
		cursor: pointer;
		transition:
			background-color var(--duration-base) var(--easing-standard),
			color var(--duration-base) var(--easing-standard);
	}

	.seg-btn:hover {
		color: var(--color-text-primary);
	}

	.seg-btn.is-active {
		background: var(--color-bg-raised);
		color: var(--color-text-primary);
	}

	.seg-btn:focus-visible {
		outline: 2px solid color-mix(in oklab, var(--color-accent) 40%, transparent);
		outline-offset: 1px;
	}

	.content-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: hidden;
	}

	.placeholder {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-7);
		color: var(--color-text-secondary);
	}

	/* --- STEP 2 smoke palette rows (temporary, removed in STEP 3) --- */
	.debug-palette-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.debug-palette-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 14px;
		font-size: var(--text-ui);
		color: var(--color-text-body);
		cursor: pointer;
	}

	.debug-palette-row.is-selected {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}

	.debug-palette-label {
		letter-spacing: -0.01em;
	}

	.debug-palette-group {
		font-size: var(--text-caption);
		color: var(--color-text-muted);
	}

	.debug-palette-row.is-disabled .debug-palette-label {
		color: var(--color-text-muted);
	}

	.debug-palette-soon {
		padding: 2px 8px;
		border: 1px solid var(--color-border);
		border-radius: 9999px;
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-muted);
		background: var(--color-surface-veil);
	}

	.debug-palette-empty {
		padding: 24px 14px;
		text-align: center;
		color: var(--color-text-muted);
		font-size: var(--text-caption);
	}
</style>
