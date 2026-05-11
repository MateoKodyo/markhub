import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import BlockNoteTableHandles from '../../src/lib/components/BlockNoteTableHandles.svelte';

// C1 / Étape 2.5.d — Svelte UI for BlockNote's TableHandles plugin.
// Pure presentation: takes the plugin store payload (referencePosCell +
// referencePosTable + colIndex + rowIndex + show flags) and forwards
// HTML5 native drag events + add-row/col clicks to the host, which in
// turn calls colDragStart / rowDragStart / addRowOrColumn on the plugin.
// The drop indicator (`bn-table-drop-cursor`) is rendered natively by
// the plugin — we don't draw it ourselves.

const cell = (): DOMRect =>
	({
		top: 200,
		left: 300,
		bottom: 220,
		right: 380,
		width: 80,
		height: 20,
		x: 300,
		y: 200,
		toJSON() {
			return this;
		}
	}) as DOMRect;

const table = (): DOMRect =>
	({
		top: 180,
		left: 290,
		bottom: 280,
		right: 700,
		width: 410,
		height: 100,
		x: 290,
		y: 180,
		toJSON() {
			return this;
		}
	}) as DOMRect;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tableBlock = (): any => ({
	id: 'tbl-1',
	type: 'table',
	props: {},
	content: { type: 'tableContent', columnWidths: [], rows: [] }
});

function fullState(over: Record<string, unknown> = {}) {
	return {
		show: true,
		showAddOrRemoveRowsButton: true,
		showAddOrRemoveColumnsButton: true,
		referencePosCell: cell(),
		referencePosTable: table(),
		block: tableBlock(),
		colIndex: 1,
		rowIndex: 2,
		draggingState: undefined,
		widgetContainer: undefined,
		...over
	};
}

describe('BlockNoteTableHandles', () => {
	it('renders nothing when tableState is null', () => {
		render(BlockNoteTableHandles, { tableState: null });
		expect(screen.queryByTestId('bn-table-handles')).toBeNull();
	});

	it('renders nothing when show is false', () => {
		render(BlockNoteTableHandles, { tableState: fullState({ show: false }) });
		expect(screen.queryByTestId('bn-table-handles')).toBeNull();
	});

	it('renders both row and col drag handles when show is true', () => {
		render(BlockNoteTableHandles, { tableState: fullState() });
		const rowHandle = screen.getByTestId('bn-table-row-handle');
		const colHandle = screen.getByTestId('bn-table-col-handle');
		expect(rowHandle).toBeInTheDocument();
		expect(colHandle).toBeInTheDocument();
		// Both must be HTML5-native draggable.
		expect(rowHandle.getAttribute('draggable')).toBe('true');
		expect(colHandle.getAttribute('draggable')).toBe('true');
	});

	it('hides the add-row button when showAddOrRemoveRowsButton is false', () => {
		render(BlockNoteTableHandles, {
			tableState: fullState({ showAddOrRemoveRowsButton: false })
		});
		expect(screen.queryByTestId('bn-table-add-row')).toBeNull();
		// Add-col button should still be there.
		expect(screen.getByTestId('bn-table-add-col')).toBeInTheDocument();
	});

	it('hides the add-col button when showAddOrRemoveColumnsButton is false', () => {
		render(BlockNoteTableHandles, {
			tableState: fullState({ showAddOrRemoveColumnsButton: false })
		});
		expect(screen.queryByTestId('bn-table-add-col')).toBeNull();
		expect(screen.getByTestId('bn-table-add-row')).toBeInTheDocument();
	});

	it('forwards dragstart on row handle to onRowDragStart', async () => {
		const onRowDragStart = vi.fn();
		render(BlockNoteTableHandles, {
			tableState: fullState(),
			onRowDragStart
		});
		await fireEvent.dragStart(screen.getByTestId('bn-table-row-handle'));
		expect(onRowDragStart).toHaveBeenCalledTimes(1);
	});

	it('forwards dragstart on col handle to onColDragStart', async () => {
		const onColDragStart = vi.fn();
		render(BlockNoteTableHandles, {
			tableState: fullState(),
			onColDragStart
		});
		await fireEvent.dragStart(screen.getByTestId('bn-table-col-handle'));
		expect(onColDragStart).toHaveBeenCalledTimes(1);
	});

	it('forwards dragend on either handle to onDragEnd', async () => {
		const onDragEnd = vi.fn();
		render(BlockNoteTableHandles, {
			tableState: fullState(),
			onDragEnd
		});
		await fireEvent.dragEnd(screen.getByTestId('bn-table-row-handle'));
		await fireEvent.dragEnd(screen.getByTestId('bn-table-col-handle'));
		expect(onDragEnd).toHaveBeenCalledTimes(2);
	});

	it('calls onAddRow with "below" when the add-row + is clicked', async () => {
		const onAddRow = vi.fn();
		render(BlockNoteTableHandles, { tableState: fullState(), onAddRow });
		await fireEvent.click(screen.getByTestId('bn-table-add-row'));
		expect(onAddRow).toHaveBeenCalledWith('below');
	});

	it('calls onAddCol with "right" when the add-col + is clicked', async () => {
		const onAddCol = vi.fn();
		render(BlockNoteTableHandles, { tableState: fullState(), onAddCol });
		await fireEvent.click(screen.getByTestId('bn-table-add-col'));
		expect(onAddCol).toHaveBeenCalledWith('right');
	});

	it('notifies onFreezeChange when the handles area is hovered', async () => {
		const onFreezeChange = vi.fn();
		render(BlockNoteTableHandles, {
			tableState: fullState(),
			onFreezeChange
		});
		const root = screen.getByTestId('bn-table-handles');
		await fireEvent.mouseEnter(root);
		expect(onFreezeChange).toHaveBeenLastCalledWith(true);
		await fireEvent.mouseLeave(root);
		expect(onFreezeChange).toHaveBeenLastCalledWith(false);
	});
});
