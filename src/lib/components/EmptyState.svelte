<script lang="ts">
	/**
	 * Cursor-style empty state — the launch screen when no file is open.
	 *
	 * Visual reference: Cursor's empty launcher. Tight, low-chroma cards on
	 * the canvas background, no borders, no descriptions under labels, one
	 * inverted-contrast primary CTA, recent projects as a clean row list
	 * (no dividers, hover-revealed background).
	 *
	 * Pure presentation: every action is a callback, the host owns the
	 * Tauri flow.
	 */
	import { BookOpen, Folder, FolderPlus, GitBranch } from 'lucide-svelte';
	import type { Vault } from '$lib/tauri/types';

	let {
		vaults = [],
		onOpenVault = () => {},
		onCreateVault = () => {},
		onCloneGit = () => {},
		onCreateSample = () => {},
		onOpenRecentVault = (_id: string) => {}
	}: {
		vaults?: Vault[];
		onOpenVault?: () => void;
		onCreateVault?: () => void;
		onCloneGit?: () => void;
		onCreateSample?: () => void;
		onOpenRecentVault?: (id: string) => void;
	} = $props();

	const RECENT_LIMIT = 5;
	let showAllRecent = $state(false);
	const visibleRecents = $derived(
		showAllRecent ? vaults : vaults.slice(0, RECENT_LIMIT)
	);
	const hasMoreRecents = $derived(vaults.length > RECENT_LIMIT);
</script>

<div class="empty-state" data-testid="empty-state">
	<div class="content">
		<header class="brand">
			<h1>Markhub</h1>
		</header>

		<div class="actions" role="group" aria-label="Démarrer">
			<button
				type="button"
				class="action-card"
				onclick={onOpenVault}
				data-testid="action-open"
			>
				<Folder size={18} />
				<span class="action-label">Ouvrir un vault</span>
			</button>
			<button
				type="button"
				class="action-card"
				onclick={onCreateVault}
				data-testid="action-create"
			>
				<FolderPlus size={18} />
				<span class="action-label">Créer un vault</span>
			</button>
			<button
				type="button"
				class="action-card"
				onclick={onCloneGit}
				data-testid="action-clone"
			>
				<GitBranch size={18} />
				<span class="action-label">Cloner depuis Git</span>
			</button>
			<button
				type="button"
				class="action-card"
				onclick={onCreateSample}
				data-testid="action-sample"
			>
				<BookOpen size={18} />
				<span class="action-label">Vault d'exemple</span>
			</button>
		</div>

		{#if vaults.length > 0}
			<section class="recent" data-testid="recent-vaults">
				<header class="recent-header">
					<span class="recent-label">Vaults récents</span>
					{#if hasMoreRecents && !showAllRecent}
						<button
							type="button"
							class="show-all"
							onclick={() => (showAllRecent = true)}
							data-testid="recent-show-all"
						>
							Voir tout ({vaults.length})
						</button>
					{/if}
				</header>
				<ul>
					{#each visibleRecents as v (v.id)}
						<li>
							<button
								type="button"
								class="recent-row"
								onclick={() => onOpenRecentVault(v.id)}
								data-testid="recent-row-{v.id}"
							>
								<span
									class="recent-dot"
									style="background: {v.color}"
									aria-hidden="true"
								></span>
								<span class="recent-name">{v.name}</span>
								<span class="recent-path">{v.path}</span>
							</button>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	</div>
</div>

<style>
	.empty-state {
		flex: 1;
		min-height: 0;
		overflow: auto;
		display: flex;
		justify-content: center;
		align-items: center;
		padding: var(--space-6);
	}

	.content {
		width: 100%;
		max-width: 640px;
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}

	.brand h1 {
		margin: 0;
		font-family: var(--font-ui);
		font-size: var(--text-2xl);
		font-weight: var(--weight-medium);
		letter-spacing: var(--tracking-display);
		color: var(--color-text-primary);
	}

	.actions {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--space-4);
	}

	.action-card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		background: var(--color-surface-veil);
		border: 0;
		border-radius: var(--radius-md);
		color: var(--color-text-body);
		text-align: left;
		cursor: pointer;
		font-family: var(--font-ui);
		transition:
			background-color var(--duration-base) var(--easing-standard),
			color var(--duration-base) var(--easing-standard);
	}

	.action-card:hover {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}

	.action-card:focus-visible {
		outline: 2px solid color-mix(in oklab, var(--color-accent) 40%, transparent);
		outline-offset: 2px;
	}

	.action-label {
		font-size: var(--text-base);
		font-weight: var(--weight-medium);
		color: inherit;
	}

	.recent {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.recent-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 var(--space-3);
		margin-bottom: var(--space-1);
	}

	.recent-label {
		font-family: var(--font-ui);
		font-size: var(--text-xs);
		font-weight: var(--weight-medium);
		text-transform: uppercase;
		letter-spacing: var(--tracking-label);
		color: var(--color-text-secondary);
	}

	.show-all {
		background: transparent;
		border: 0;
		padding: 0;
		font-family: var(--font-ui);
		font-size: var(--text-xs);
		color: var(--color-text-secondary);
		cursor: pointer;
		transition: color var(--duration-base) var(--easing-standard);
	}

	.show-all:hover {
		color: var(--color-text-primary);
	}

	.recent ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
	}

	.recent-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		width: 100%;
		padding: var(--space-2) var(--space-3);
		background: transparent;
		border: 0;
		border-radius: var(--radius-sm);
		color: var(--color-text-body);
		font-family: var(--font-ui);
		font-size: var(--text-sm);
		text-align: left;
		cursor: pointer;
		transition: background-color var(--duration-base) var(--easing-standard);
	}

	.recent-row:hover {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}

	.recent-row:focus-visible {
		outline: 2px solid color-mix(in oklab, var(--color-accent) 40%, transparent);
		outline-offset: -2px;
	}

	.recent-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.recent-name {
		flex-shrink: 0;
	}

	.recent-path {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: right;
		font-family: var(--font-mono);
		color: var(--color-text-muted);
	}
</style>
