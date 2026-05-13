<script lang="ts">
	/**
	 * Editor tab bar — sits between the content header (mode toggle) and
	 * the editor body. Reads the active file store directly so consumers
	 * don't have to thread tabs through props.
	 *
	 * Interactions:
	 *  - Click on a tab activates it.
	 *  - Click on the × button closes that tab (the store picks a sensible
	 *    neighbour to activate next).
	 *  - HTML5 drag-drop reorders tabs (no Tauri conflict — webview-only).
	 *  - Labels shrink with `text-overflow: ellipsis` when the row overflows;
	 *    a tooltip surfaces the full relative path on hover.
	 *
	 * Hidden when there is no open file at all — the user keeps the empty
	 * state for vault selection.
	 */

	import { X } from 'lucide-svelte';
	import { activeFileStore, type Tab } from '$lib/stores/activeFile.svelte';
	import { getFileName } from '$lib/utils/path';

	const DRAG_MIME = 'application/x-markhub-tab';
	let dragSourceId = $state<string | null>(null);
	let dragOverId = $state<string | null>(null);

	function onTabClick(id: string): void {
		activeFileStore.activateTab(id);
	}

	function onCloseClick(e: MouseEvent, id: string): void {
		// Don't trigger the row click (which would activate the tab we're
		// about to close).
		e.stopPropagation();
		activeFileStore.closeTab(id);
	}

	function onDragStart(e: DragEvent, id: string): void {
		if (!e.dataTransfer) return;
		e.dataTransfer.setData(DRAG_MIME, id);
		e.dataTransfer.effectAllowed = 'move';
		dragSourceId = id;
	}

	function onDragEnd(): void {
		dragSourceId = null;
		dragOverId = null;
	}

	function onDragOver(e: DragEvent, id: string): void {
		if (!e.dataTransfer?.types.includes(DRAG_MIME)) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
		dragOverId = id;
	}

	function onDragLeave(id: string): void {
		if (dragOverId === id) dragOverId = null;
	}

	function onDrop(e: DragEvent, targetId: string): void {
		const sourceId = e.dataTransfer?.getData(DRAG_MIME);
		if (!sourceId || sourceId === targetId) return;
		e.preventDefault();
		e.stopPropagation();
		const tabs = activeFileStore.tabs;
		const fromIdx = tabs.findIndex((t) => t.id === sourceId);
		const toIdx = tabs.findIndex((t) => t.id === targetId);
		if (fromIdx >= 0 && toIdx >= 0) {
			activeFileStore.reorderTabs(fromIdx, toIdx);
		}
		dragSourceId = null;
		dragOverId = null;
	}

	function labelFor(t: Tab): string {
		return getFileName(t.relativePath) || t.relativePath || 'untitled';
	}
</script>

{#if activeFileStore.tabs.length > 0}
	<div
		class="tab-bar"
		role="tablist"
		aria-label="Onglets ouverts"
		data-testid="tab-bar"
	>
		{#each activeFileStore.tabs as t (t.id)}
			{@const isActive = activeFileStore.activeTabId === t.id}
			<button
				type="button"
				role="tab"
				class="tab"
				class:is-active={isActive}
				class:is-drag-source={dragSourceId === t.id}
				class:is-drop-target={dragOverId === t.id && dragSourceId !== t.id}
				aria-selected={isActive}
				title={t.relativePath}
				data-testid="tab"
				data-tab-id={t.id}
				onclick={() => onTabClick(t.id)}
				draggable="true"
				ondragstart={(e) => onDragStart(e, t.id)}
				ondragend={onDragEnd}
				ondragover={(e) => onDragOver(e, t.id)}
				ondragleave={() => onDragLeave(t.id)}
				ondrop={(e) => onDrop(e, t.id)}
			>
				<span class="tab-label">{labelFor(t)}</span>
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- Keyboard close is wired globally via Cmd+W (closeActiveTab);
				     this surface is mouse-only. -->
				<span
					class="tab-close"
					role="button"
					tabindex="-1"
					aria-label="Fermer l'onglet"
					data-testid="tab-close"
					onclick={(e) => onCloseClick(e, t.id)}
				>
					<X size={11} strokeWidth={1.5} aria-hidden="true" focusable="false" />
				</span>
			</button>
		{/each}
	</div>
{/if}

<style>
	.tab-bar {
		display: flex;
		align-items: stretch;
		min-height: 30px;
		padding: 4px 8px 0;
		gap: 2px;
		background: var(--color-bg);
		border-bottom: 1px solid var(--color-border);
		overflow-x: auto;
		overflow-y: hidden;
		flex-shrink: 0;
		/* macOS scrollbar overlay style — invisible until hovered, doesn't
		   eat layout space. */
		scrollbar-width: thin;
	}

	.tab {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-width: 70px;
		max-width: 180px;
		flex: 1 1 auto;
		padding: 4px 8px 4px 12px;
		border: 0;
		border-radius: var(--radius-sm, 4px) var(--radius-sm, 4px) 0 0;
		background: transparent;
		color: var(--color-text-secondary);
		font-family: var(--font-ui);
		font-size: var(--text-ui);
		line-height: 1.2;
		cursor: pointer;
		text-align: left;
		min-width: 0;
		transition:
			background-color var(--duration-base, 160ms) var(--easing-standard, ease-out),
			color var(--duration-base, 160ms) var(--easing-standard, ease-out);
	}

	.tab:hover {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}

	.tab.is-active {
		background: var(--color-bg-raised);
		color: var(--color-text-primary);
	}

	.tab.is-drag-source {
		opacity: 0.45;
	}

	.tab.is-drop-target {
		box-shadow: inset 2px 0 0 0 var(--color-accent);
	}

	.tab-label {
		flex: 1 1 0;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		letter-spacing: -0.01em;
	}

	.tab-close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		flex: 0 0 auto;
		border-radius: var(--radius-sm, 4px);
		color: var(--color-text-muted);
		opacity: 0.6;
		transition:
			background-color var(--duration-base, 160ms) var(--easing-standard, ease-out),
			opacity var(--duration-base, 160ms) var(--easing-standard, ease-out);
	}

	.tab:hover .tab-close,
	.tab.is-active .tab-close {
		opacity: 1;
	}

	.tab-close:hover {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}
</style>
