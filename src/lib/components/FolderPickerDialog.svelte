<script lang="ts">
	import { Folder, FolderRoot } from 'lucide-svelte';
	import { collectDirectories } from '$lib/utils/tree';
	import type { FileEntry } from '$lib/tauri/types';

	let {
		open = false,
		title = 'Déplacer vers…',
		tree = null,
		excludePath = null,
		onSubmit = (_: string) => {},
		onCancel = () => {}
	}: {
		open?: boolean;
		title?: string;
		/** Vault scan tree (root with children). */
		tree?: FileEntry | null;
		/** Optional path to exclude from candidates (e.g. the file's current parent). */
		excludePath?: string | null;
		/** value = '' for vault root, otherwise a directory's relativePath. */
		onSubmit?: (targetPath: string) => void | Promise<void>;
		onCancel?: () => void;
	} = $props();

	const allDirs = $derived(collectDirectories(tree));
	const candidates = $derived(
		excludePath !== null && excludePath !== undefined
			? allDirs.filter((d) => d.relativePath !== excludePath)
			: allDirs
	);

	let busy = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		if (open) {
			busy = false;
			error = null;
		}
	});

	async function pick(target: string) {
		if (busy) return;
		busy = true;
		error = null;
		try {
			await onSubmit(target);
		} catch (e) {
			error = String(e);
			busy = false;
		}
	}
</script>

{#if open}
	<div class="backdrop" role="dialog" aria-modal="true" aria-label={title}>
		<div class="dialog panel">
			<h2>{title}</h2>
			<p class="hint">Choisis un emplacement de destination.</p>

			{#if error}
				<p class="error" role="alert">{error}</p>
			{/if}

			<ul class="folder-list" role="listbox">
				<li>
					<button
						type="button"
						class="folder-item is-root"
						disabled={busy}
						onclick={() => pick('')}
					>
						<FolderRoot size={14} />
						<span class="folder-name">(racine du vault)</span>
					</button>
				</li>
				{#each candidates as dir (dir.relativePath)}
					<li>
						<button
							type="button"
							class="folder-item"
							disabled={busy}
							onclick={() => pick(dir.relativePath)}
						>
							<Folder size={14} />
							<span class="folder-name">{dir.relativePath}</span>
						</button>
					</li>
				{/each}
			</ul>

			<div class="actions">
				<button type="button" class="button" onclick={onCancel} disabled={busy}>
					Annuler
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 150;
	}

	.dialog {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		width: min(480px, 90vw);
		max-height: 70vh;
		padding: var(--space-5);
		background: var(--color-bg-raised);
	}

	h2 {
		font-size: var(--text-heading);
		letter-spacing: var(--tracking-heading);
	}

	.hint {
		font-size: var(--text-caption);
		color: var(--color-text-secondary);
	}

	.error {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		background: rgba(248, 113, 113, 0.08);
		border: 1px solid rgba(248, 113, 113, 0.25);
		border-radius: var(--radius-sm);
		color: var(--color-status-error);
		font-size: var(--text-caption);
	}

	.folder-list {
		flex: 1;
		min-height: 0;
		overflow: auto;
		margin: 0;
		padding: 4px;
		list-style: none;
		background: var(--color-surface-veil);
		border: 1px solid var(--color-border-subtle);
		border-radius: var(--radius-sm);
	}

	.folder-item {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		min-height: 28px;
		padding: 4px var(--space-3);
		border: 0;
		border-radius: var(--radius-xs);
		background: transparent;
		color: var(--color-text-body);
		font-family: inherit;
		font-size: var(--text-ui);
		text-align: left;
		cursor: pointer;
	}

	.folder-item:hover:not(:disabled) {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}

	.folder-item.is-root {
		color: var(--color-text-secondary);
		font-style: italic;
	}

	.folder-name {
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-family: var(--font-mono);
		font-size: var(--text-caption);
	}

	.actions {
		display: flex;
		justify-content: flex-end;
	}
</style>
