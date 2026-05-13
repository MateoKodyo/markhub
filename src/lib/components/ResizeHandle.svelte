<script lang="ts">
	/**
	 * Vertical resize handle for side panels — drag horizontally to
	 * grow / shrink the adjacent column. Pure pointer events so it
	 * coexists with Tauri's `dragDropEnabled: false` regime (the
	 * sidebar HTML5 drags stay isolated; this handle never speaks
	 * the drag-and-drop language).
	 *
	 * The handle is a thin (4px) interactive strip with a wider
	 * (12px) `::after` hit zone so the cursor catches it without
	 * being a visual line. Highlights on hover/drag to confirm the
	 * grip target.
	 *
	 * `direction` controls which way `delta` is interpreted:
	 *   - 'left'  — handle lives on the LEFT edge of a right-side
	 *     panel (Outline). Drag right shrinks; drag left grows.
	 *   - 'right' — handle lives on the RIGHT edge of a left-side
	 *     panel (Sidebar). Drag right grows; drag left shrinks.
	 *
	 * The caller passes the current `width` and an `onResize`
	 * callback. The handle doesn't own the state — it just emits.
	 */

	type Direction = 'left' | 'right';

	type Props = {
		width: number;
		direction: Direction;
		onResize: (nextWidth: number) => void;
		ariaLabel?: string;
	};

	let { width, direction, onResize, ariaLabel = 'Redimensionner' }: Props =
		$props();

	let dragging = $state(false);
	let startX = 0;
	let startWidth = 0;

	function onPointerDown(e: PointerEvent): void {
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		dragging = true;
		startX = e.clientX;
		startWidth = width;
		// `document.body.style.cursor` lock so the cursor stays as the
		// resize affordance even when it leaves the handle's hit zone.
		document.body.style.cursor = 'col-resize';
		// Prevent text selection during the drag.
		document.body.style.userSelect = 'none';
	}

	function onPointerMove(e: PointerEvent): void {
		if (!dragging) return;
		const delta = e.clientX - startX;
		const signed = direction === 'right' ? delta : -delta;
		onResize(startWidth + signed);
	}

	function endDrag(e: PointerEvent): void {
		if (!dragging) return;
		dragging = false;
		(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
		document.body.style.cursor = '';
		document.body.style.userSelect = '';
	}
</script>

<div
	class="resize-handle"
	class:is-dragging={dragging}
	role="separator"
	aria-orientation="vertical"
	aria-label={ariaLabel}
	data-testid="resize-handle"
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={endDrag}
	onpointercancel={endDrag}
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
	}

	/* Wider hit zone — the visible handle is 4px but the cursor
	   captures within 12px so it's easy to grab. */
	.resize-handle::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: -4px;
		right: -4px;
	}

	.resize-handle:hover,
	.resize-handle.is-dragging {
		background: color-mix(in oklab, var(--color-accent) 60%, transparent);
	}
</style>
