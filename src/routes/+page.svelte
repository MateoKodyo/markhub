<script lang="ts">
	import { onMount } from 'svelte';
	import { Lock, PanelLeft } from 'lucide-svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Editor, { type EditorMode } from '$lib/components/Editor.svelte';
	import StatusBar from '$lib/components/StatusBar.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import InputDialog from '$lib/components/InputDialog.svelte';
	import { vaultsStore } from '$lib/stores/vaults.svelte';
	import { activeFileStore } from '$lib/stores/activeFile.svelte';
	import { themeStore } from '$lib/stores/theme.svelte';
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

	onMount(async () => {
		try {
			await vaultsStore.load();
			// Theme has to init AFTER vaultsStore.load so it sees the persisted
			// `settings.theme`. Sets data-theme on <html> + listens to OS changes.
			themeStore.init();
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
</script>

<div class="app">
	<header class="window-chrome" data-tauri-drag-region>
		<button
			type="button"
			class="chrome-toggle"
			class:is-active={!sidebarCollapsed}
			onclick={() => (sidebarCollapsed = !sidebarCollapsed)}
			aria-label="Plier ou déplier la sidebar"
			aria-pressed={!sidebarCollapsed}
			title="Plier ou déplier la sidebar"
			data-tauri-drag-region="false"
		>
			<PanelLeft size={16} strokeWidth={1.5} />
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
							<Lock size={11} />
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
