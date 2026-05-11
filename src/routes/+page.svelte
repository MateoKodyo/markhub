<script lang="ts">
	import { onMount } from 'svelte';
	import { Lock } from 'lucide-svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Editor, { type EditorMode } from '$lib/components/Editor.svelte';
	import StatusBar from '$lib/components/StatusBar.svelte';
	import { vaultsStore } from '$lib/stores/vaults.svelte';
	import { activeFileStore } from '$lib/stores/activeFile.svelte';
	import { themeStore } from '$lib/stores/theme.svelte';
	import { joinPath } from '$lib/utils/path';

	let loadError = $state<string | null>(null);
	let editorMode = $state<EditorMode>('preview');

	onMount(async () => {
		try {
			await vaultsStore.load();
			// Theme has to init AFTER vaultsStore.load so it sees the persisted
			// `settings.theme`. Sets data-theme on <html> + listens to OS changes.
			themeStore.init();
			// Restore the last-opened file if any (and the vault still exists).
			const lof = vaultsStore.lastOpenedFile;
			if (lof && vaultsStore.vaults.some((v) => v.id === lof.vaultId)) {
				vaultsStore.selectVault(lof.vaultId);
				try {
					await activeFileStore.openFile(lof.vaultId, lof.relativePath);
				} catch (e) {
					// File may have been deleted/renamed since last session — clear it.
					console.warn('[startup] Could not restore last opened file', e);
					void vaultsStore.setLastOpenedFile(null);
				}
			}
		} catch (e) {
			loadError = String(e);
		}
	});

	function onContentChange(newContent: string) {
		activeFileStore.updateContent(newContent);
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
	<Sidebar />

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
			<div class="placeholder">
				<span class="label">Markhub</span>
				{#if vaultsStore.vaults.length === 0}
					<p>Ajoutez votre premier vault dans la sidebar.</p>
				{:else if !vaultsStore.activeVaultId}
					<p>Sélectionne un vault.</p>
				{:else}
					<p>Sélectionne un fichier.</p>
				{/if}
			</div>
		{/if}

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

<style>
	.app {
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
		gap: 4px;
		flex-shrink: 0;
		padding: 2px 8px;
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
	}

	.seg-btn:hover {
		color: var(--color-text-primary);
	}

	.seg-btn.is-active {
		background: var(--color-bg-raised);
		color: var(--color-text-primary);
	}

	.seg-btn:focus-visible {
		outline: 1px solid var(--color-accent);
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
