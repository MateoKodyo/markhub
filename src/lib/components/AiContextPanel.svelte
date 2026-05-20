<script lang="ts">
	/**
	 * AiContextPanel — PLAN-AI-READY STEP 5.
	 *
	 * A collapsible sidebar section that surfaces every AI-aware file of
	 * the current vault in one place — making a project's AI context
	 * discoverable instead of scattered across the file tree.
	 *
	 * Collapsed by default; the expand state persists per vault. The panel
	 * stays visible even when the `highlightAiAware` setting is off (it's a
	 * deliberate navigation surface, not a passive hint).
	 */
	import {
		ChevronDown,
		ChevronRight,
		File,
		FilePlus,
		FileText,
		Sparkles
	} from 'lucide-svelte';
	import { aiAwareStore } from '$lib/stores/aiAware.svelte';
	import { vaultsStore } from '$lib/stores/vaults.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { uiStateStore } from '$lib/stores/uiState.svelte';
	import { getFileName } from '$lib/utils/path';
	import { isMarkdownFile } from '$lib/utils/fileType';

	let {
		onOpenFile,
		onCreateClaudeMd
	}: {
		onOpenFile: (relativePath: string) => void;
		onCreateClaudeMd: () => void | Promise<void>;
	} = $props();

	const entries = $derived(aiAwareStore.getAllAiAware());
	const vaultId = $derived(vaultsStore.activeVaultId);
	const expanded = $derived(vaultId ? uiStateStore.isAiContextExpanded(vaultId) : false);
	const badgesHidden = $derived(!settingsStore.current.appearance.highlightAiAware);

	function toggle(): void {
		if (vaultId) uiStateStore.toggleAiContext(vaultId);
	}
</script>

<section class="ai-context">
	<button
		type="button"
		class="ai-ctx-header"
		onclick={toggle}
		aria-expanded={expanded}
		data-testid="ai-context-toggle"
	>
		<span class="ai-ctx-chevron">
			{#if expanded}
				<ChevronDown size={12} aria-hidden="true" focusable="false" />
			{:else}
				<ChevronRight size={12} aria-hidden="true" focusable="false" />
			{/if}
		</span>
		<Sparkles size={12} aria-hidden="true" focusable="false" />
		<span class="ai-ctx-title">AI Context</span>
		{#if entries.length > 0}
			<span class="ai-ctx-count">{entries.length}</span>
		{/if}
	</button>

	{#if expanded}
		<div class="ai-ctx-body">
			{#if badgesHidden}
				<p class="ai-ctx-note">Les badges sont masqués dans tes réglages.</p>
			{/if}

			{#if entries.length === 0}
				<p class="ai-ctx-empty">Aucun fichier AI-aware dans ce vault.</p>
				{#if !vaultsStore.isActiveVaultReadonly}
					<button
						type="button"
						class="ai-ctx-create"
						onclick={onCreateClaudeMd}
						data-testid="ai-context-create-claude"
					>
						<FilePlus size={12} aria-hidden="true" focusable="false" />
						<span>Créer un CLAUDE.md</span>
					</button>
				{/if}
			{:else}
				<ul class="ai-ctx-list">
					{#each entries as entry (entry.path)}
						{@const name = getFileName(entry.path) || entry.path}
						<li>
							<button
								type="button"
								class="ai-ctx-item"
								onclick={() => onOpenFile(entry.path)}
								title={`${entry.info.label} — ${entry.path}`}
							>
								<span class="ai-ctx-item-icon">
									{#if isMarkdownFile(name)}
										<FileText size={14} aria-hidden="true" focusable="false" />
									{:else}
										<File size={14} aria-hidden="true" focusable="false" />
									{/if}
								</span>
								<span class="ai-ctx-item-name">{name}</span>
								<span class="ai-ctx-item-star">
									<Sparkles
										size={12}
										strokeWidth={2}
										aria-hidden="true"
										focusable="false"
									/>
								</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</section>

<style>
	.ai-context {
		flex-shrink: 0;
		border-top: 1px solid var(--color-border-subtle);
	}

	.ai-ctx-header {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		min-height: 30px;
		padding: 4px var(--space-3);
		border: 0;
		background: transparent;
		color: var(--color-text-secondary);
		font-family: var(--font-ui);
		font-size: var(--text-ui);
		text-align: left;
		cursor: pointer;
		transition: background-color var(--duration-base) var(--easing-standard);
	}

	.ai-ctx-header:hover {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}

	.ai-ctx-chevron {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 12px;
		flex-shrink: 0;
	}

	.ai-ctx-title {
		flex: 1;
		min-width: 0;
		letter-spacing: var(--tracking-caption);
	}

	.ai-ctx-count {
		flex-shrink: 0;
		min-width: 16px;
		padding: 1px 6px;
		font-size: var(--text-label);
		font-variant-numeric: tabular-nums;
		text-align: center;
		color: var(--color-text-secondary);
		background: var(--color-surface-veil);
		border-radius: var(--radius-xs);
	}

	.ai-ctx-body {
		display: flex;
		flex-direction: column;
		gap: 2px;
		max-height: 240px;
		overflow-y: auto;
		padding: 2px var(--space-2) var(--space-2);
	}

	.ai-ctx-note,
	.ai-ctx-empty {
		margin: 0;
		padding: 4px var(--space-2);
		font-size: var(--text-caption);
		color: var(--color-text-secondary);
		font-style: italic;
	}

	.ai-ctx-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.ai-ctx-item {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		min-height: 24px;
		padding: 3px var(--space-2);
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-text-body);
		font-family: var(--font-ui);
		font-size: var(--text-ui);
		text-align: left;
		cursor: pointer;
		transition: background-color var(--duration-base) var(--easing-standard);
	}

	.ai-ctx-item:hover {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}

	.ai-ctx-item-icon {
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
		color: var(--color-text-secondary);
	}

	.ai-ctx-item-name {
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	/* Trailing AI marker — same accent treatment as the sidebar tree badge. */
	.ai-ctx-item-star {
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
		color: color-mix(in srgb, var(--color-accent) 70%, transparent);
	}

	.ai-ctx-create {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		align-self: flex-start;
		margin: 2px var(--space-2) 0;
		padding: 4px var(--space-2);
		border: 1px solid var(--color-border-subtle);
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-text-secondary);
		font-family: var(--font-ui);
		font-size: var(--text-label);
		cursor: pointer;
		transition:
			background-color var(--duration-base) var(--easing-standard),
			color var(--duration-base) var(--easing-standard);
	}

	.ai-ctx-create:hover {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}
</style>
