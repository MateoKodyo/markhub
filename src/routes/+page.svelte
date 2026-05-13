<script lang="ts">
	import { onMount } from 'svelte';
	import { Code2, Eye, Lock, PanelLeft, PanelRight } from 'lucide-svelte';
	import { getCurrentWindow } from '@tauri-apps/api/window';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Editor, { type EditorMode } from '$lib/components/Editor.svelte';
	import StatusBar from '$lib/components/StatusBar.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import OutlinePanel from '$lib/components/OutlinePanel.svelte';
	import TabBar from '$lib/components/TabBar.svelte';
	import InputDialog from '$lib/components/InputDialog.svelte';
	import SettingsModal from '$lib/components/SettingsModal.svelte';
	import { vaultsStore } from '$lib/stores/vaults.svelte';
	import { activeFileStore } from '$lib/stores/activeFile.svelte';
	import { themeStore } from '$lib/stores/theme.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { uiStateStore } from '$lib/stores/uiState.svelte';
	import { paletteStore } from '$lib/stores/palette.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { recentFilesStore } from '$lib/stores/recentFiles.svelte';
	import { vaultTreeStore } from '$lib/stores/vaultTree.svelte';
	import CommandPalette from '$lib/components/CommandPalette.svelte';
	import CommandMode from '$lib/components/palette/CommandMode.svelte';
	import FileMode from '$lib/components/palette/FileMode.svelte';
	import SearchMode from '$lib/components/palette/SearchMode.svelte';
	import type { SearchActivation } from '$lib/components/palette/types';
	import { detectModeSwitch } from '$lib/components/palette/modeSwitch';
	import { commandRegistry, type Command } from '$lib/commands/registry.svelte';
	import { recentCommandsStore } from '$lib/commands/recent.svelte';
	import { rankCommands } from '$lib/commands/fuzzy';
	import { rankFiles, type FilePaletteEntry } from '$lib/commands/fuzzyFiles';
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

	// --- Command palette wiring -------------------------------------------
	// Palette state lives in `paletteStore` so the catalog can drive it
	// (`palette.open`, `palette.openFile`) without reaching into +page.
	// Activation paths live here because they need to record into the
	// MRU stores and dispatch to the right handler (command vs. file).
	function activateCommand(cmd: Command): void {
		paletteStore.close();
		recentCommandsStore.record(cmd.id);
		void cmd.handler();
	}

	function activateFile(entry: FilePaletteEntry): void {
		paletteStore.close();
		recentFilesStore.record({
			vaultId: entry.vaultId,
			relativePath: entry.relativePath
		});
		void activeFileStore.openFile(entry.vaultId, entry.relativePath);
	}

	/** Click on a search hit: close, open the file, then dispatch a
	 *  jump-to-line event for the editor to consume. Source mode scrolls
	 *  the textarea to the row; preview mode (BlockNote) is a no-op for
	 *  now — line→block resolution is BACKLOG. */
	function activateSearch(target: SearchActivation): void {
		const vaultId = vaultsStore.activeVaultId;
		if (!vaultId) return;
		paletteStore.close();
		recentFilesStore.record({
			vaultId,
			relativePath: target.relativePath
		});
		void activeFileStore
			.openFile(vaultId, target.relativePath)
			.then(() => {
				window.dispatchEvent(
					new CustomEvent('editor:jumpToLine', {
						detail: { lineNumber: target.lineNumber }
					})
				);
			});
	}

	// Mirror each mode's ranking so keyboard Enter (which fires
	// CommandPalette.onActivate(index)) resolves to the same row the body
	// displays. Both shell + body use the same ranking inputs.
	const paletteRankedCommands = $derived(
		paletteStore.mode === 'command'
			? rankCommands(
					commandRegistry.getAll(),
					paletteStore.query,
					recentCommandsStore.getRecent()
				)
			: []
	);

	const paletteFileExclude = $derived.by(() => {
		const set = new Set<string>();
		const af = activeFileStore.activeFile;
		if (af) set.add(`${af.vaultId}::${af.relativePath}`);
		return set;
	});

	const paletteRankedFiles = $derived(
		paletteStore.mode === 'file'
			? rankFiles(
					vaultTreeStore.files,
					paletteStore.query,
					recentFilesStore.getRecent(),
					paletteFileExclude
				)
			: []
	);

	// Search mode exposes its flat list of (path, line) targets so the
	// shell's Enter can resolve to the right one without re-running the
	// search here. Empty until SearchMode mounts.
	let paletteSearchTargets = $state<SearchActivation[]>([]);

	function paletteActivateByIndex(index: number): void {
		if (paletteStore.mode === 'command') {
			const cmd = paletteRankedCommands[index]?.command;
			if (cmd) activateCommand(cmd);
		} else if (paletteStore.mode === 'file') {
			const entry = paletteRankedFiles[index]?.entry;
			if (entry) activateFile(entry);
		} else if (paletteStore.mode === 'search') {
			const target = paletteSearchTargets[index];
			if (target) activateSearch(target);
		}
	}

	// view.toggleEditorMode dispatches `app:toggleEditorMode`; listen and
	// flip editorMode here (preview ↔ source). Only flips when an active
	// file is open — the command guards itself via `when`.
	$effect(() => {
		const onToggle = () => {
			if (!activeFileStore.activeFile) return;
			editorMode = editorMode === 'preview' ? 'source' : 'preview';
		};
		window.addEventListener('app:toggleEditorMode', onToggle);
		return () => window.removeEventListener('app:toggleEditorMode', onToggle);
	});

	// Mode switching via input prefix — pure logic in `detectModeSwitch`,
	// effect just applies the result + handles side effects (refresh tree
	// on switch to file mode).
	$effect(() => {
		const q = paletteStore.query;
		if (!paletteStore.isOpen) return;
		const next = detectModeSwitch(
			paletteStore.mode,
			q,
			vaultsStore.activeVaultId !== null
		);
		if (!next) return;
		paletteStore.mode = next.mode;
		paletteStore.query = next.query;
		paletteStore.selectedIndex = 0;
		if (next.mode === 'file') void vaultTreeStore.refresh();
	});
	// --- end Command palette wiring ---------------------------------------

	// OS drag-drop bridge (Finder → sidebar) is currently disabled —
	// `dragDropEnabled: true` in tauri.conf.json broke in-app HTML5
	// drag-drop in the sidebar (Tauri intercepts OS events before the
	// webview sees them, which collaterally kills in-webview drag
	// events on macOS). The `handleImport(externalSources)` path on
	// the Sidebar side is left in place so a future pointer-events
	// refactor can re-enable Finder drops without redoing the wiring.
	// See BACKLOG.md for the trade-off + the path forward.

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
		const path = joinPath(v.path, f.relativePath);
		try {
			await navigator.clipboard.writeText(path);
			toast.success('Chemin copié', { details: path });
		} catch (e) {
			console.warn('[clipboard] copy failed', e);
			toast.error('Copie impossible', { details: String(e) });
		}
	}

	// Re-key on tab switch so the BlockNote instance is fully reset.
	// Tab id is unique per open even on the same (vault, path), so
	// closing and re-opening a tab also triggers a clean remount.
	const editorKey = $derived(
		activeFileStore.activeTabId ?? 'empty'
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

</script>

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
			<TabBar>
				{#snippet trailing()}
					{#if vaultsStore.isActiveVaultReadonly}
						<span class="badge-readonly" aria-label="Lecture seule">
							<Lock size={11} aria-hidden="true" focusable="false" />
							<span>Lecture seule</span>
						</span>
					{/if}
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
							aria-label="Mode preview"
							title="Preview"
						>
							<Eye size={14} strokeWidth={1.5} aria-hidden="true" focusable="false" />
						</button>
						<button
							type="button"
							class="seg-btn"
							class:is-active={editorMode === 'source'}
							onclick={() => (editorMode = 'source')}
							aria-pressed={editorMode === 'source'}
							aria-label="Mode source"
							title="Source"
						>
							<Code2 size={14} strokeWidth={1.5} aria-hidden="true" focusable="false" />
						</button>
					</div>
					<button
						type="button"
						class="icon-toggle"
						class:is-active={uiStateStore.outlineOpen}
						onclick={() => uiStateStore.toggleOutline()}
						aria-pressed={uiStateStore.outlineOpen}
						aria-label="Afficher le sommaire"
						title="Sommaire (⌘\\)"
						data-testid="outline-toggle"
					>
						<PanelRight
							size={14}
							strokeWidth={1.5}
							aria-hidden="true"
							focusable="false"
						/>
					</button>
				{/snippet}
			</TabBar>

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

		{#if uiStateStore.outlineOpen && activeFileStore.activeFile}
			<OutlinePanel />
		{/if}
	</div>
</div>

<SettingsModal />

<!-- Command palette — owned by paletteStore. Body swaps on mode:
	 'command' (Cmd+K) | 'file' (Cmd+P) | 'search' (Cmd+Shift+F, STEP 6). -->
<CommandPalette
	open={paletteStore.isOpen}
	mode={paletteStore.mode}
	placeholder={paletteStore.mode === 'file'
		? 'Go to file…   (>) command   (#) search'
		: paletteStore.mode === 'search'
			? 'Search across vault…   (>) command   (@) file'
			: 'Type a command…   (@) file   (#) search'}
	itemCount={paletteStore.itemCount}
	bind:query={paletteStore.query}
	bind:selectedIndex={paletteStore.selectedIndex}
	onClose={() => paletteStore.close()}
	onActivate={paletteActivateByIndex}
>
	{#if paletteStore.mode === 'command'}
		<CommandMode
			query={paletteStore.query}
			selectedIndex={paletteStore.selectedIndex}
			bind:itemCount={paletteStore.itemCount}
			onActivate={activateCommand}
		/>
	{:else if paletteStore.mode === 'file'}
		<FileMode
			query={paletteStore.query}
			selectedIndex={paletteStore.selectedIndex}
			bind:itemCount={paletteStore.itemCount}
			onActivate={activateFile}
		/>
	{:else if paletteStore.mode === 'search'}
		<SearchMode
			query={paletteStore.query}
			selectedIndex={paletteStore.selectedIndex}
			bind:itemCount={paletteStore.itemCount}
			bind:flatTargets={paletteSearchTargets}
			onActivate={activateSearch}
		/>
	{/if}
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
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: calc(var(--pill-height) - 4px);
		height: calc(var(--pill-height) - 4px);
		padding: 0;
		border: 0;
		border-radius: calc(var(--pill-radius) - 2px);
		background: transparent;
		color: var(--color-text-secondary);
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

	/* Outline toggle — standalone (no mutex). Same vertical size as the
	 * mode-toggle pill so the two groups line up; smaller padding so it
	 * reads as a single icon button rather than a segmented control. */
	.icon-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--pill-height);
		height: var(--pill-height);
		padding: 0;
		border: 0;
		border-radius: var(--pill-radius);
		background: transparent;
		color: var(--color-text-secondary);
		cursor: pointer;
		transition:
			background-color var(--duration-base) var(--easing-standard),
			color var(--duration-base) var(--easing-standard);
	}

	.icon-toggle:hover {
		background: var(--pill-bg);
		color: var(--color-text-primary);
	}

	.icon-toggle.is-active {
		background: var(--pill-bg);
		color: var(--color-text-primary);
	}

	.icon-toggle:focus-visible {
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

</style>
