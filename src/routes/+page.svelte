<script lang="ts">
	import { onMount } from 'svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Editor, { type EditorApi, type EditorMode } from '$lib/components/Editor.svelte';
	import EditorToolbar from '$lib/components/EditorToolbar.svelte';
	import { vaultsStore } from '$lib/stores/vaults.svelte';
	import { activeFileStore } from '$lib/stores/activeFile.svelte';

	let loadError = $state<string | null>(null);
	let editorMode = $state<EditorMode>('preview');
	let editorApi = $state<EditorApi | null>(null);

	onMount(async () => {
		try {
			await vaultsStore.load();
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

	const statusLabel = $derived.by(() => {
		switch (activeFileStore.status) {
			case 'idle':
				return '';
			case 'loading':
				return 'Chargement…';
			case 'modified':
				return '✏️ Modifié';
			case 'saving':
				return '💾 Sauvegarde…';
			case 'saved':
				return '💾 Sauvegardé';
			case 'error':
				return '⚠️ Erreur';
			default:
				return '';
		}
	});

	function onContentChange(newContent: string) {
		activeFileStore.updateContent(newContent);
	}

	function onCommand(cmd: Parameters<NonNullable<EditorApi>['runCommand']>[0]) {
		editorApi?.runCommand(cmd);
	}

	// Re-key on file switch so Milkdown is fully reset.
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
							🔒 Lecture seule
						</span>
					{/if}
				</div>

				<div class="header-controls">
					{#if editorMode === 'preview'}
						<EditorToolbar readonly={vaultsStore.isActiveVaultReadonly} {onCommand} />
					{/if}

					<div
						class="mode-toggle"
						role="group"
						aria-label="Mode éditeur"
					>
						<button
							type="button"
							class="mode-btn"
							class:is-active={editorMode === 'preview'}
							onclick={() => (editorMode = 'preview')}
							aria-pressed={editorMode === 'preview'}
						>
							Preview
						</button>
						<button
							type="button"
							class="mode-btn"
							class:is-active={editorMode === 'source'}
							onclick={() => (editorMode = 'source')}
							aria-pressed={editorMode === 'source'}
						>
							Source
						</button>
					</div>

					<div class="status">{statusLabel}</div>
				</div>
			</header>

			<div class="content-body">
				{#key editorKey}
					<Editor
						content={activeFileStore.content}
						readonly={vaultsStore.isActiveVaultReadonly}
						mode={editorMode}
						onChange={onContentChange}
						onReady={(api) => (editorApi = api)}
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

	.mode-toggle {
		display: inline-flex;
		background: var(--color-surface-veil);
		border: 1px solid var(--color-border-subtle);
		border-radius: var(--radius-md);
		padding: 2px;
	}

	.mode-btn {
		padding: 4px 10px;
		border: 0;
		border-radius: var(--radius-xs);
		background: transparent;
		color: var(--color-text-secondary);
		font-family: inherit;
		font-size: var(--text-caption);
		cursor: pointer;
	}

	.mode-btn:hover {
		color: var(--color-text-primary);
	}

	.mode-btn.is-active {
		background: var(--color-surface-active);
		color: var(--color-text-primary);
	}

	.status {
		font-size: var(--text-caption);
		color: var(--color-text-secondary);
		font-family: var(--font-mono);
		min-width: 110px;
		text-align: right;
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
