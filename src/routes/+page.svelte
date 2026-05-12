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
	import { joinPath } from '$lib/utils/path';
	import * as api from '$lib/tauri/api';

	type PendingAction = 'create' | 'sample' | 'clone';

	let loadError = $state<string | null>(null);
	let editorMode = $state<EditorMode>('preview');
	let sidebarCollapsed = $state(false);

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
	 * Editor typography CSS bridge — mirrors `appearance.editorFont /
	 * editorFontSize / editorLineHeight / editorContentWidth` to global
	 * CSS variables that the editor consumes. Same one-effect-no-prop
	 * pattern as the mono font bridge: editor consumers just read the
	 * variable, no plumbing through props.
	 *
	 * `--font-editor` already exists in app.css (default: Geist stack)
	 * and is consumed by `.preview .bn-editor` and headings. The other
	 * three (`--editor-body-font-size`, `--editor-body-line-height`,
	 * `--content-max-width`) are read with fallbacks so the visual
	 * fixtures (which never hydrate settings) keep the legacy look.
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
		root.setProperty('--editor-body-font-size', `${a.editorFontSize}px`);
		root.setProperty('--editor-body-line-height', `${a.editorLineHeight}`);
		root.setProperty('--content-max-width', `${a.editorContentWidth}px`);
	});

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
			class:is-active={!sidebarCollapsed}
			onclick={() => (sidebarCollapsed = !sidebarCollapsed)}
			aria-label={sidebarCollapsed ? 'Déplier la sidebar' : 'Replier la sidebar'}
			aria-pressed={!sidebarCollapsed}
			title={sidebarCollapsed ? 'Déplier la sidebar' : 'Replier la sidebar'}
		>
			<PanelLeft size={16} strokeWidth={1.5} aria-hidden="true" focusable="false" />
		</button>
	</header>

	<div class="app-body">
		<Sidebar collapsed={sidebarCollapsed} />

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
</style>
