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

	import type { Snippet } from 'svelte';
	import { FileText, X } from 'lucide-svelte';
	import { activeFileStore, type Tab } from '$lib/stores/activeFile.svelte';
	import { getFileName } from '$lib/utils/path';

	type Props = {
		/** Right-side slot rendered after the scrollable tab list — used
		 *  by +page.svelte to drop the mode toggle + outline button on the
		 *  same row as the tabs (no separate content-header). Snippet so
		 *  the slot stays independent of the tab content. */
		trailing?: Snippet;
	};

	let { trailing }: Props = $props();

	const DRAG_MIME = 'application/x-markus-tab';
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

{#if activeFileStore.tabs.length > 0 || trailing}
	<div class="tab-bar" data-testid="tab-bar">
		<div
			class="tab-bar-scroll"
			role="tablist"
			aria-label="Onglets ouverts"
			data-testid="tab-bar-scroll"
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
					<FileText
						size={12}
						strokeWidth={1.5}
						class="tab-icon"
						aria-hidden="true"
						focusable="false"
					/>
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
		{#if trailing}
			<div class="tab-bar-trailing" data-testid="tab-bar-trailing">
				{@render trailing()}
			</div>
		{/if}
	</div>
{/if}

<style>
	/* Tabs UX takes cues from Cursor + Warp:
	 *  - 32px row, low-contrast bg-sidebar surface for the bar itself
	 *    so the active tab can pop visually against it.
	 *  - Active tab fills with bg (editor canvas color) so the tab
	 *    "joins" the canvas below + carries a 2px accent top border
	 *    (Warp pattern) for unambiguous "this is current".
	 *  - Inactive tabs stay quiet (transparent + muted text); hover
	 *    bumps to a faint surface fill.
	 *  - Min-width 120px so the labels breathe; max 220px caps tabs
	 *    long enough to read full filenames without flooding the bar.
	 *  - Two-zone layout: scrollable list on the left, static trailing
	 *    block (mode toggle + outline button) on the right that lives
	 *    outside the overflow container — tabs can never bleed past. */
	.tab-bar {
		display: flex;
		align-items: stretch;
		min-height: 32px;
		background: var(--color-bg-sidebar);
		flex-shrink: 0;
		min-width: 0;
	}

	.tab-bar-scroll {
		display: flex;
		align-items: stretch;
		gap: 0;
		padding: 0 4px;
		flex: 1 1 0;
		min-width: 0;
		overflow-x: auto;
		overflow-y: hidden;
		/* Hide the scrollbar — chrome reads as noise on the clean strip.
		   Wheel + trackpad scroll still works. */
		scrollbar-width: none;
	}

	.tab-bar-scroll::-webkit-scrollbar {
		display: none;
	}

	.tab {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		min-width: 120px;
		max-width: 220px;
		flex: 0 0 auto;
		padding: 0 10px 0 12px;
		border: 0;
		border-radius: 4px 4px 0 0;
		background: transparent;
		color: var(--color-text-muted);
		font-family: var(--font-ui);
		font-size: 13px;
		line-height: 1;
		cursor: pointer;
		text-align: left;
		position: relative;
		transition:
			background-color var(--duration-base, 160ms) var(--easing-standard, ease-out),
			color var(--duration-base, 160ms) var(--easing-standard, ease-out);
	}

	/* Subtle vertical divider between adjacent tabs — drops on hover
	   neighbours and on the active tab itself for cleanliness. */
	.tab + .tab::before {
		content: '';
		position: absolute;
		left: 0;
		top: 8px;
		bottom: 8px;
		width: 1px;
		background: var(--color-border-subtle, var(--color-border));
		opacity: 0.5;
		pointer-events: none;
	}

	.tab:hover {
		background: color-mix(in oklab, var(--color-bg) 60%, transparent);
		color: var(--color-text-body);
	}

	.tab.is-active {
		background: var(--color-bg);
		color: var(--color-text-primary);
	}

	.tab.is-drag-source {
		opacity: 0.45;
	}

	.tab :global(.tab-icon) {
		flex: 0 0 auto;
		color: var(--color-text-muted);
		opacity: 0.7;
	}

	.tab.is-active :global(.tab-icon) {
		color: var(--color-text-primary);
		opacity: 1;
	}

	.tab.is-drop-target::before {
		content: '';
		position: absolute;
		top: 4px;
		bottom: 4px;
		left: 0;
		width: 2px;
		background: var(--color-accent);
		opacity: 1;
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
		width: 14px;
		height: 14px;
		flex: 0 0 auto;
		border-radius: var(--radius-sm, 4px);
		color: var(--color-text-muted);
		opacity: 0;
		transition:
			background-color var(--duration-base, 160ms) var(--easing-standard, ease-out),
			opacity var(--duration-base, 160ms) var(--easing-standard, ease-out);
	}

	.tab:hover .tab-close,
	.tab.is-active .tab-close {
		opacity: 0.7;
	}

	.tab-close:hover {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
		opacity: 1 !important;
	}

	.tab-bar-trailing {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2, 8px);
		padding: 0 6px;
		flex: 0 0 auto;
		background: var(--color-bg);
		position: relative;
	}

	/* 16px transparent → bg gradient leading edge so scrolled-out tabs
	   dissolve into the chrome instead of being chopped hard. The
	   trailing block lives OUTSIDE the scroll container now (two-zone
	   layout), so this fade overlays the right end of the scroll list. */
	.tab-bar-trailing::before {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: -16px;
		width: 16px;
		background: linear-gradient(to right, transparent, var(--color-bg));
		pointer-events: none;
	}
</style>
