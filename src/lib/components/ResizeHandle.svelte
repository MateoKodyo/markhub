<script lang="ts">
	/**
	 * Resize handle for adjacent panels — horizontal (vertical bar)
	 * for side columns, vertical (horizontal bar) for stacked rows.
	 *
	 * Window-level pointer listeners (registered on pointerdown,
	 * removed on pointerup) instead of `setPointerCapture` — the
	 * capture path failed silently for the outline-panel handle on
	 * macOS Tauri, and window events are more robust anyway: moves
	 * arrive no matter where the cursor wanders.
	 *
	 * `direction`:
	 *   - 'right' — handle lives on the RIGHT edge of a left-side
	 *     panel (Sidebar). Drag right grows; drag left shrinks.
	 *   - 'left'  — handle lives on the LEFT edge of a right-side
	 *     panel (Outline). Drag left grows; drag right shrinks.
	 *   - 'down'  — horizontal bar between stacked rows. Drag down
	 *     grows the row above the handle.
	 *
	 * The caller passes the current size and an `onResize` callback.
	 * The handle doesn't own the state — it just emits.
	 */

	type Direction = 'left' | 'right' | 'down';

	type Props = {
		size: number;
		direction: Direction;
		onResize: (nextSize: number) => void;
		ariaLabel?: string;
	};

	let { size, direction, onResize, ariaLabel = 'Redimensionner' }: Props =
		$props();

	let dragging = $state(false);
	let startCoord = 0;
	let startSize = 0;

	const isHorizontalBar = $derived(direction === 'down');

	function onPointerDown(e: PointerEvent): void {
		e.preventDefault();
		dragging = true;
		startCoord = isHorizontalBar ? e.clientY : e.clientX;
		startSize = size;
		document.body.style.cursor = isHorizontalBar ? 'row-resize' : 'col-resize';
		document.body.style.userSelect = 'none';
		window.addEventListener('pointermove', onWindowMove);
		window.addEventListener('pointerup', onWindowUp);
		window.addEventListener('pointercancel', onWindowUp);
	}

	function onWindowMove(e: PointerEvent): void {
		if (!dragging) return;
		const current = isHorizontalBar ? e.clientY : e.clientX;
		const delta = current - startCoord;
		// 'right' and 'down' grow on positive delta; 'left' grows on negative.
		const signed = direction === 'left' ? -delta : delta;
		onResize(startSize + signed);
	}

	function onWindowUp(): void {
		if (!dragging) return;
		dragging = false;
		document.body.style.cursor = '';
		document.body.style.userSelect = '';
		window.removeEventListener('pointermove', onWindowMove);
		window.removeEventListener('pointerup', onWindowUp);
		window.removeEventListener('pointercancel', onWindowUp);
	}
</script>

<div
	class="resize-handle"
	class:is-horizontal={isHorizontalBar}
	class:is-dragging={dragging}
	role="separator"
	aria-orientation={isHorizontalBar ? 'horizontal' : 'vertical'}
	aria-label={ariaLabel}
	data-testid="resize-handle"
	onpointerdown={onPointerDown}
></div>

<style>
	.resize-handle {
		flex: 0 0 auto;
		width: 4px;
		background: transparent;
		cursor: col-resize;
		position: relative;
		transition: background-color var(--duration-base, 160ms) var(--easing-standard, ease-out);
		z-index: 5;
		/* `touch-action: none` keeps the pointer events from being
		   swallowed by browser-level pan / scroll handling. */
		touch-action: none;
	}

	.resize-handle.is-horizontal {
		width: auto;
		height: 4px;
		cursor: row-resize;
	}

	/* Wider hit zone — visible bar is 4px but the cursor captures
	   within 12px so it's easy to grab. */
	.resize-handle::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: -4px;
		right: -4px;
	}

	.resize-handle.is-horizontal::after {
		top: -4px;
		bottom: -4px;
		left: 0;
		right: 0;
	}

	.resize-handle:hover,
	.resize-handle.is-dragging {
		background: color-mix(in oklab, var(--color-accent) 60%, transparent);
	}
</style>
