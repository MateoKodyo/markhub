<script lang="ts">
	/**
	 * OutlinePanel — sober TOC panel that lives to the right of the editor
	 * when `uiStateStore.outlineOpen`. Reads the active file's content
	 * directly, extracts ATX headings, and renders them as an indented
	 * scrollable list.
	 *
	 * Click on a heading row dispatches `outline:jumpToHeading` with the
	 * line number AND the zero-based heading index. Editor.svelte routes
	 * the event:
	 *   - source mode: scroll to `line` (same path as Cmd+Shift+F).
	 *   - preview mode: walk BlockNote's document, find the Nth `heading`
	 *     block, scroll it into view. Fallback to source-mode jump if the
	 *     block lookup fails.
	 */

	import { activeFileStore } from '$lib/stores/activeFile.svelte';
	import { extractHeadings } from '$lib/utils/markdown';
	import { X } from 'lucide-svelte';
	import { uiStateStore } from '$lib/stores/uiState.svelte';

	const headings = $derived(extractHeadings(activeFileStore.content));

	// Track which heading we've just jumped to, so the user gets a brief
	// visual confirmation that the click registered. Cleared by the next
	// click or after a short delay.
	let lastJumpedIndex = $state<number | null>(null);
	let clearTimer: ReturnType<typeof setTimeout> | null = null;

	function jumpTo(line: number, index: number): void {
		lastJumpedIndex = index;
		if (clearTimer) clearTimeout(clearTimer);
		clearTimer = setTimeout(() => {
			lastJumpedIndex = null;
		}, 1500);
		if (typeof window !== 'undefined') {
			window.dispatchEvent(
				new CustomEvent('outline:jumpToHeading', {
					detail: { line, index }
				})
			);
		}
	}
</script>

<aside class="outline-panel" aria-label="Sommaire du document" data-testid="outline-panel">
	<header class="outline-header">
		<span class="outline-title">Sommaire</span>
		<button
			type="button"
			class="outline-close"
			aria-label="Fermer le sommaire"
			title="Fermer le sommaire (⌘\)"
			onclick={() => uiStateStore.toggleOutline()}
		>
			<X size={14} strokeWidth={1.5} aria-hidden="true" focusable="false" />
		</button>
	</header>

	<div class="outline-body">
		{#if !activeFileStore.activeFile}
			<p class="outline-empty" data-testid="outline-empty">
				Aucun fichier ouvert
			</p>
		{:else if headings.length === 0}
			<p class="outline-empty" data-testid="outline-empty">
				Aucun heading dans ce fichier
			</p>
		{:else}
			<ol class="outline-list" data-testid="outline-list">
				{#each headings as h (h.line + ':' + h.text)}
					<li
						class="outline-item level-{h.level}"
						class:is-just-jumped={lastJumpedIndex === h.index}
					>
						<button
							type="button"
							class="outline-row"
							style="padding-left: {6 + (h.level - 1) * 12}px"
							onclick={() => jumpTo(h.line, h.index)}
							data-testid="outline-row"
							data-level={h.level}
						>
							<span class="outline-text">{h.text}</span>
						</button>
					</li>
				{/each}
			</ol>
		{/if}
	</div>
</aside>

<style>
	.outline-panel {
		flex: 0 0 260px;
		display: flex;
		flex-direction: column;
		min-height: 0;
		background: var(--color-bg);
		border-left: 1px solid var(--color-border);
		font-size: var(--text-ui);
		color: var(--color-text-body);
	}

	.outline-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		padding: 10px 12px 10px 14px;
		border-bottom: 1px solid var(--color-border-subtle, var(--color-border));
	}

	.outline-title {
		font-size: var(--text-caption);
		color: var(--color-text-muted);
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.outline-close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		padding: 0;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-text-muted);
		cursor: pointer;
		transition:
			background-color var(--duration-base, 160ms) var(--easing-standard, ease-out),
			color var(--duration-base, 160ms) var(--easing-standard, ease-out);
	}

	.outline-close:hover {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}

	.outline-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 6px 0 12px;
	}

	.outline-empty {
		padding: 20px 14px;
		text-align: center;
		font-size: var(--text-caption);
		color: var(--color-text-muted);
	}

	.outline-list {
		list-style: none;
		margin: 0;
		padding: 0;
		counter-reset: none;
	}

	.outline-item {
		position: relative;
	}

	.outline-row {
		display: block;
		width: 100%;
		padding: 4px 12px 4px 6px;
		background: transparent;
		border: 0;
		text-align: left;
		color: var(--color-text-body);
		font-family: inherit;
		font-size: 13px;
		line-height: 1.5;
		cursor: pointer;
		transition: background-color var(--duration-base, 160ms) var(--easing-standard, ease-out);
	}

	.outline-row:hover {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}

	/* Level 1 reads a touch stronger so the doc structure stands out. */
	.outline-item.level-1 .outline-row {
		color: var(--color-text-primary);
		font-weight: 500;
	}

	.outline-item.level-4 .outline-row,
	.outline-item.level-5 .outline-row,
	.outline-item.level-6 .outline-row {
		color: var(--color-text-muted);
		font-size: 12px;
	}

	.outline-text {
		display: block;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Visual confirmation right after a click — short accent stripe on
	   the left edge. Fades back into the hover state. */
	.outline-item.is-just-jumped .outline-row {
		background: color-mix(in oklab, var(--color-accent) 10%, transparent);
		box-shadow: inset 2px 0 0 0 var(--color-accent);
	}
</style>
