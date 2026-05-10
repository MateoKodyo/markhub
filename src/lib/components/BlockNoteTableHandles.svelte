<script lang="ts">
	/**
	 * Svelte UI for BlockNote's TableHandles plugin.
	 *
	 * The plugin owns the state and the drag/drop transaction. We render
	 * four affordances on top of the hovered cell:
	 *   - row handle (⋮⋮ horizontal) at the left of the cell, draggable
	 *     to reorder rows
	 *   - col handle (⋮⋮ vertical) at the top of the cell, draggable
	 *     to reorder columns
	 *   - add-row `+` at the bottom-right of the table, click to append
	 *     a new row below the hovered row
	 *   - add-col `+` at the right of the table, click to append a new
	 *     column to the right of the hovered column
	 *
	 * Drop indicator (`.bn-table-drop-cursor`) is rendered natively by
	 * the plugin during a drag — confirmed by reading the plugin source
	 * in `@blocknote/core/dist/extensions-CkLT--Nc.js:1334`. We do NOT
	 * draw it ourselves.
	 *
	 * Column resize is native too: `prosemirror-tables` ships the
	 * `.column-resize-handle` affordance, styled by the BlockNote
	 * default style.css imported in `Editor.svelte`.
	 *
	 * Wrapper has onmouseenter/onmouseleave that ping `onFreezeChange`
	 * → host calls plugin's `freezeHandles()` / `unfreezeHandles()` so
	 * the affordances stay visible while the cursor moves onto them
	 * (same lesson as 2.5.c — our DOM lives outside the prosemirror
	 * surface, the plugin doesn't track our hover).
	 */
	import { GripHorizontal, GripVertical, Plus } from 'lucide-svelte';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	type BlockLike = any;

	export type TableHandlesState = {
		show: boolean;
		showAddOrRemoveRowsButton: boolean;
		showAddOrRemoveColumnsButton: boolean;
		referencePosCell: DOMRect | undefined;
		referencePosTable: DOMRect;
		block: BlockLike;
		colIndex: number | undefined;
		rowIndex: number | undefined;
		draggingState:
			| {
					draggedCellOrientation: 'row' | 'col';
					originalIndex: number;
					mousePos: number;
			  }
			| undefined;
		widgetContainer: HTMLElement | undefined;
	};

	let {
		tableState = null,
		onColDragStart = (_e: DragEvent) => {},
		onRowDragStart = (_e: DragEvent) => {},
		onDragEnd = () => {},
		onAddRow = (_side: 'above' | 'below') => {},
		onAddCol = (_side: 'left' | 'right') => {},
		onFreezeChange = (_open: boolean) => {}
	}: {
		tableState?: TableHandlesState | null;
		onColDragStart?: (e: DragEvent) => void;
		onRowDragStart?: (e: DragEvent) => void;
		onDragEnd?: () => void;
		onAddRow?: (side: 'above' | 'below') => void;
		onAddCol?: (side: 'left' | 'right') => void;
		onFreezeChange?: (open: boolean) => void;
	} = $props();

	const HANDLE_SIZE = 14;
	const HANDLE_GAP = 4;

	// Row handle: vertically centered on the cell, anchored to the left
	// of the cell with a small gap.
	const rowHandleTop = $derived(
		tableState?.referencePosCell
			? tableState.referencePosCell.top +
					tableState.referencePosCell.height / 2 -
					HANDLE_SIZE / 2
			: 0
	);
	const rowHandleLeft = $derived(
		tableState?.referencePosCell
			? tableState.referencePosCell.left - HANDLE_SIZE - HANDLE_GAP
			: 0
	);

	// Col handle: horizontally centered on the cell, anchored to the top
	// of the cell with a small gap.
	const colHandleTop = $derived(
		tableState?.referencePosCell
			? tableState.referencePosCell.top - HANDLE_SIZE - HANDLE_GAP
			: 0
	);
	const colHandleLeft = $derived(
		tableState?.referencePosCell
			? tableState.referencePosCell.left +
					tableState.referencePosCell.width / 2 -
					HANDLE_SIZE / 2
			: 0
	);

	// Add-row `+`: under the bottom edge of the whole table.
	const addRowTop = $derived(
		tableState?.referencePosTable
			? tableState.referencePosTable.bottom + HANDLE_GAP
			: 0
	);
	const addRowLeft = $derived(
		tableState?.referencePosTable
			? tableState.referencePosTable.left +
					tableState.referencePosTable.width / 2 -
					HANDLE_SIZE / 2
			: 0
	);

	// Add-col `+`: to the right of the table's right edge.
	const addColTop = $derived(
		tableState?.referencePosTable
			? tableState.referencePosTable.top +
					tableState.referencePosTable.height / 2 -
					HANDLE_SIZE / 2
			: 0
	);
	const addColLeft = $derived(
		tableState?.referencePosTable
			? tableState.referencePosTable.right + HANDLE_GAP
			: 0
	);

	function handleRowDragStart(e: DragEvent) {
		onRowDragStart(e);
	}

	function handleColDragStart(e: DragEvent) {
		onColDragStart(e);
	}

	function handleDragEnd() {
		onDragEnd();
	}

	function handleAddRowClick() {
		onAddRow('below');
	}

	function handleAddColClick() {
		onAddCol('right');
	}
</script>

{#if tableState?.show}
	<div
		class="bn-table-handles"
		data-testid="bn-table-handles"
		role="presentation"
		onmouseenter={() => onFreezeChange(true)}
		onmouseleave={() => onFreezeChange(false)}
	>
		{#if tableState.referencePosCell}
			<button
				type="button"
				class="bn-th-btn bn-th-row-handle"
				data-testid="bn-table-row-handle"
				aria-label="Drag row to reorder"
				title="Glisser pour réordonner la ligne"
				draggable="true"
				style="position: fixed; top: {rowHandleTop}px; left: {rowHandleLeft}px;"
				ondragstart={handleRowDragStart}
				ondragend={handleDragEnd}
			>
				<GripVertical size={12} />
			</button>
			<button
				type="button"
				class="bn-th-btn bn-th-col-handle"
				data-testid="bn-table-col-handle"
				aria-label="Drag column to reorder"
				title="Glisser pour réordonner la colonne"
				draggable="true"
				style="position: fixed; top: {colHandleTop}px; left: {colHandleLeft}px;"
				ondragstart={handleColDragStart}
				ondragend={handleDragEnd}
			>
				<GripHorizontal size={12} />
			</button>
		{/if}
		{#if tableState.showAddOrRemoveRowsButton}
			<button
				type="button"
				class="bn-th-btn bn-th-add-row"
				data-testid="bn-table-add-row"
				aria-label="Add row below"
				title="Ajouter une ligne en dessous"
				style="position: fixed; top: {addRowTop}px; left: {addRowLeft}px;"
				onclick={handleAddRowClick}
			>
				<Plus size={12} />
			</button>
		{/if}
		{#if tableState.showAddOrRemoveColumnsButton}
			<button
				type="button"
				class="bn-th-btn bn-th-add-col"
				data-testid="bn-table-add-col"
				aria-label="Add column to the right"
				title="Ajouter une colonne à droite"
				style="position: fixed; top: {addColTop}px; left: {addColLeft}px;"
				onclick={handleAddColClick}
			>
				<Plus size={12} />
			</button>
		{/if}
	</div>
{/if}

<style>
	.bn-table-handles {
		/* Purely a container — its children are position: fixed. Use
		 * `display: contents` so the wrapper has no box (and Playwright
		 * doesn't mark it as "hidden" because it would be 0×0), while
		 * still letting it own the mouseenter/mouseleave delegation for
		 * the freeze-on-hover behaviour. */
		display: contents;
	}

	.bn-th-btn {
		z-index: 75;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
		padding: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xs);
		background: var(--color-bg-raised);
		color: var(--color-text-muted);
		cursor: pointer;
		opacity: 0.5;
		transition: opacity 0.15s ease;
	}

	.bn-th-btn:hover {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
		opacity: 1;
	}

	.bn-th-row-handle,
	.bn-th-col-handle {
		cursor: grab;
	}

	.bn-th-row-handle:active,
	.bn-th-col-handle:active {
		cursor: grabbing;
	}
</style>
