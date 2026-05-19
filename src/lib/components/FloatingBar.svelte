<script lang="ts">
	/**
	 * FloatingBar — Figma-style centered pill that sticks to the bottom of
	 * the editor area while a document is open. Bundles the most common
	 * doc-scoped actions (search, export, copy, view mode, outline) into
	 * one always-visible chrome surface.
	 *
	 * Mounting: lives inside `<div class="content-body">` in +page.svelte,
	 * positioned absolutely so it floats over the editor regardless of
	 * scroll. The parent controls visibility by mounting it only when a
	 * file is active.
	 *
	 * Design source: figma.com/design/HJoUa0vEBSev5Fljvpe9iv (node 245:275).
	 * Tokens follow the active theme — never hardcoded color literals.
	 */
	import {
		Code2,
		Copy,
		Download,
		Eye,
		List,
		Search,
		SquareSplitHorizontal
	} from 'lucide-svelte';
	import { findStore } from '$lib/stores/find.svelte';
	import { uiStateStore } from '$lib/stores/uiState.svelte';
	import type { EditorMode } from './Editor.svelte';
	import type { FloatingBarPosition } from '$lib/tauri/types';

	let {
		mode,
		onSetMode,
		onExport,
		onCopy,
		position = 'bottom'
	}: {
		mode: EditorMode;
		onSetMode: (next: EditorMode) => void;
		onExport: () => void;
		onCopy: () => void;
		position?: FloatingBarPosition;
	} = $props();

	const isVertical = $derived(position === 'right');

	function openFind(): void {
		findStore.open();
	}

	// Active segment position for the sliding indicator (0/1/2 across
	// preview / split / source). Split is never an active mode in code
	// today, but the indicator can still rest there if we ever wire it.
	const segIndex = $derived(
		mode === 'preview' ? 0 : mode === 'source' ? 2 : 1
	);
</script>

<div
	class="floating-bar"
	class:is-vertical={isVertical}
	data-testid="floating-bar"
	data-position={position}
>
	<!-- Search — full input with placeholder in horizontal mode (180×24),
	     collapses to a square icon button in vertical (the placeholder
	     text would be too wide for the right-edge column). -->
	{#if isVertical}
		<button
			type="button"
			class="icon-btn"
			onclick={openFind}
			data-testid="floating-bar-search"
			aria-label="Rechercher dans le document"
			title="Rechercher dans le document (⌘F)"
		>
			<Search size={14} aria-hidden="true" focusable="false" />
		</button>
	{:else}
		<button
			type="button"
			class="filter-row"
			onclick={openFind}
			data-testid="floating-bar-search"
			aria-label="Rechercher dans le document"
			title="Rechercher dans le document (⌘F)"
		>
			<Search size={12} aria-hidden="true" focusable="false" />
			<span class="filter-placeholder">Search in doc</span>
		</button>
	{/if}

	<!-- Export current doc as markdown. Duplicates the StatusBar action —
	     same handler, two surfaces. -->
	<button
		type="button"
		class="single-btn"
		onclick={onExport}
		data-testid="floating-bar-export"
		aria-label="Exporter le document en Markdown"
		title="Exporter en Markdown"
	>
		<Download size={12} aria-hidden="true" focusable="false" />
	</button>

	<!-- Copy doc body to clipboard. -->
	<button
		type="button"
		class="single-btn"
		onclick={onCopy}
		data-testid="floating-bar-copy"
		aria-label="Copier le contenu du document"
		title="Copier le document"
	>
		<Copy size={12} aria-hidden="true" focusable="false" />
	</button>

	<!-- View mode picker — 3 segments. Split is shown but disabled (the
	     side-by-side mode isn't implemented yet, surfaced visually so the
	     final layout is anticipated). The active background is a single
	     absolute-positioned `.seg-indicator` that slides between segments
	     on mode change (Apple-style segmented control), driven by the
	     `--seg-index` custom property. -->
	<div
		class="mode-picker"
		class:is-vertical={isVertical}
		role="radiogroup"
		aria-label="Mode d'affichage du document"
		style="--seg-index: {segIndex}"
	>
		<span class="seg-indicator" aria-hidden="true"></span>
		<button
			type="button"
			class="seg"
			class:active={mode === 'preview'}
			role="radio"
			aria-checked={mode === 'preview'}
			onclick={() => onSetMode('preview')}
			data-testid="floating-bar-mode-preview"
			aria-label="Mode rendu"
			title="Mode rendu"
		>
			<Eye size={14} aria-hidden="true" focusable="false" />
		</button>
		<button
			type="button"
			class="seg"
			role="radio"
			aria-checked="false"
			aria-disabled="true"
			disabled
			data-testid="floating-bar-mode-split"
			aria-label="Mode split (à venir)"
			title="Split view — à venir"
		>
			<SquareSplitHorizontal size={14} aria-hidden="true" focusable="false" />
		</button>
		<button
			type="button"
			class="seg"
			class:active={mode === 'source'}
			role="radio"
			aria-checked={mode === 'source'}
			onclick={() => onSetMode('source')}
			data-testid="floating-bar-mode-source"
			aria-label="Mode source markdown"
			title="Mode source Markdown"
		>
			<Code2 size={14} aria-hidden="true" focusable="false" />
		</button>
	</div>

	<!-- Outline panel toggle. -->
	<button
		type="button"
		class="single-btn"
		class:active={uiStateStore.outlineOpen}
		onclick={() => uiStateStore.toggleOutline()}
		data-testid="floating-bar-outline"
		aria-label="Afficher le plan du document"
		aria-pressed={uiStateStore.outlineOpen}
		title="Sommaire (⌘\)"
	>
		<List size={12} aria-hidden="true" focusable="false" />
	</button>
</div>

<style>
	/* Container — sticky bottom-centered pill (default) or right-edge
	   vertical icon (`.is-vertical`). Positioned absolutely so it floats
	   over the editor canvas without participating in scroll. The parent
	   `.content-body` provides the `position: relative` context. */
	.floating-bar {
		position: absolute;
		bottom: 24px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 10;

		display: flex;
		align-items: center;
		gap: 5px;
		height: 42px;
		padding: 6px 8px;

		background: var(--color-bg-raised);
		border: 1px solid var(--color-border);
		border-radius: 11px;
		box-shadow: var(--shadow-popover);

		font-family: var(--font-ui);
	}

	/* Vertical / right-edge mode — full set of actions stacked, stuck
	   to the right side, vertically centered. Same tokens (raised bg,
	   border, shadow), tighter geometry: 30px-wide column with the
	   search compacted to an icon (the input placeholder would be too
	   wide for the column). Download, copy, mode picker (rotated to a
	   3-segment vertical stack), and outline all retained — the user
	   keeps every horizontal-mode action, just laid out vertically. */
	.floating-bar.is-vertical {
		bottom: auto;
		left: auto;
		right: 16px;
		top: 50%;
		transform: translateY(-50%);

		flex-direction: column;
		height: auto;
		padding: 5px;
		gap: 4px;
	}

	/* Icon-only button used in vertical mode (and reusable for any
	   single-icon affordance the vertical bar grows later). Same look
	   as the horizontal mode's segment slot, square geometry. */
	.icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		padding: 0;

		background: transparent;
		border: none;
		border-radius: 7px;

		color: var(--color-text-secondary);
		cursor: pointer;
		transition:
			background var(--duration-base) var(--easing-standard),
			color var(--duration-base) var(--easing-standard);
	}

	.icon-btn:hover {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}

	.icon-btn:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-accent) 35%, transparent);
	}

	/* Search input — looks like an input, behaves like a button (opens
	   the find bar). 180×24 per Figma. */
	.filter-row {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		width: 180px;
		height: 24px;
		padding: 6px 12px;

		background: var(--color-surface-veil);
		border: 1px solid var(--color-border-subtle);
		border-radius: 6px;

		color: var(--color-text-secondary);
		font-family: inherit;
		font-size: 13px;
		text-align: left;
		cursor: text;
		transition:
			background var(--duration-base) var(--easing-standard),
			border-color var(--duration-base) var(--easing-standard);
	}

	.filter-row:hover {
		background: var(--color-surface-hover);
		border-color: var(--color-border);
	}

	.filter-row:focus-visible {
		outline: none;
		border-color: var(--color-accent);
		box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-accent) 35%, transparent);
	}

	.filter-placeholder {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Single icon button — download / copy / list. 30×24 outer, 20px inner
	   visual via the inner gradient. Active state for the outline list
	   uses the same accent-tinted pill as segment-active. */
	.single-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 24px;
		padding: 1px;

		background: var(--color-surface-veil);
		border: none;
		border-radius: 4px;

		color: var(--color-text-secondary);
		cursor: pointer;
		transition:
			background var(--duration-base) var(--easing-standard),
			color var(--duration-base) var(--easing-standard);
	}

	.single-btn:hover {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}

	.single-btn:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-accent) 35%, transparent);
	}

	.single-btn.active {
		background: var(--color-button-bg);
		color: var(--color-text-primary);
	}

	/* Mode picker — 3 segments laid out in 90×24 container. 1px outer
	   padding, 1px gap so inner segments are 20px tall and ~28.6px wide.
	   `position: relative` anchors the absolute `.seg-indicator`. */
	.mode-picker {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 1px;
		width: 90px;
		height: 24px;
		padding: 1px;

		background: var(--color-surface-veil);
		border-radius: 4px;
	}

	/* Sliding active-state indicator. Width = one segment slot (inner
	   width minus 2 gaps, divided by 3). Translates by (own width + gap)
	   per index step driven by `--seg-index` from the parent. */
	.seg-indicator {
		position: absolute;
		top: 1px;
		left: 1px;
		width: calc((100% - 4px) / 3);
		height: 20px;
		background: var(--color-button-bg);
		border-radius: 4px;
		pointer-events: none;
		transform: translateX(calc(var(--seg-index, 0) * (100% + 1px)));
		transition: transform 220ms cubic-bezier(0.4, 0, 0.2, 1);
	}

	.seg {
		/* Sit above the indicator so the icon stays visible during the
		   slide. Removed the per-segment .active background since the
		   indicator now paints that surface. */
		position: relative;
		z-index: 1;

		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: 1 0 0;
		min-width: 0;
		height: 20px;
		padding: 0;

		background: transparent;
		border: none;
		border-radius: 4px;

		color: var(--color-text-secondary);
		cursor: pointer;
		transition: color var(--duration-base) var(--easing-standard);
	}

	.seg:hover:not(:disabled):not(.active) {
		color: var(--color-text-primary);
	}

	.seg.active {
		color: var(--color-text-primary);
	}

	.seg:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.seg:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-accent) 35%, transparent);
	}

	/* Vertical mode picker — same 3 segments but stacked. Width becomes
	   30px (single-icon column), height becomes ~90px (3 × 28 + gaps).
	   The sliding indicator's transform flips from translateX to
	   translateY, with width/height swapped on the indicator itself. */
	.mode-picker.is-vertical {
		flex-direction: column;
		width: 30px;
		height: auto;
		padding: 1px;
	}

	.mode-picker.is-vertical .seg-indicator {
		width: calc(100% - 2px);
		height: calc((100% - 4px) / 3);
		transform: translateY(calc(var(--seg-index, 0) * (100% + 1px)));
	}

	.mode-picker.is-vertical .seg {
		width: 100%;
		height: 28px;
		flex: 0 0 28px;
	}
</style>
