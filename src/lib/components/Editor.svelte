<script lang="ts">
	import { untrack } from 'svelte';
	import { joinFrontmatter, splitFrontmatter } from '$lib/utils/markdown';
	import ContextMenu, { type MenuItem } from './ContextMenu.svelte';

	export type EditorMode = 'preview' | 'source';

	export type EditorApi = {
		runCommand: (cmd: import('./EditorToolbar.svelte').EditorCommand) => void;
	};

	let {
		content = '',
		readonly = false,
		mode = 'preview',
		onChange = (_: string) => {},
		onReady = (_: EditorApi | null) => {}
	}: {
		content?: string;
		readonly?: boolean;
		mode?: EditorMode;
		onChange?: (content: string) => void;
		onReady?: (api: EditorApi | null) => void;
	} = $props();

	let container: HTMLDivElement | null = $state(null);
	// We hold the full Crepe instance (typed as `any` for the dynamic import).
	// Crepe exposes `.editor` (the Milkdown editor with `.action(ctx => ...)`)
	// and `.destroy / .setReadonly / .on`.
	type CrepeInstance = {
		destroy: () => void;
		setReadonly: (b: boolean) => void;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		editor?: { action: (cb: (ctx: any) => unknown) => unknown };
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		on?: (cb: (l: any) => void) => void;
	};
	let crepe: CrepeInstance | null = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let crepeKit: any = null; // commands + schemas + ctx keys, captured at mount

	// === Phase 7: block menu + drag-reorder state ===
	// Position (before / after) of the block currently targeted by an open
	// menu or an ongoing drag. Stored once at click/dragstart so subsequent
	// document edits don't shift our reference.
	let blockMenuOpen = $state(false);
	let blockMenuX = $state(0);
	let blockMenuY = $state(0);
	let blockTargetStart = $state<number | null>(null);
	let blockTargetEnd = $state<number | null>(null);

	// Drag indicator: position where the block would land if released now.
	let dropIndicatorTop = $state<number | null>(null);
	let dragSourceStart: number | null = null;
	let dragSourceEnd: number | null = null;
	let dragSourceLevel: number = 0;

	// Split content into frontmatter (rendered separately) + body (fed to Milkdown).
	// Computed from the initial `content` prop only — Milkdown owns the body once
	// mounted; the frontmatter is preserved verbatim and reattached on save.
	const split = $derived(splitFrontmatter(content));
	const frontmatter = $derived(split.frontmatter);
	const body = $derived(split.body);

	function buildApi(crepeInstance: any): EditorApi {
		return {
			runCommand(cmd) {
				if (!crepeInstance) return;
				try {
					const editor = crepeInstance.editor;
					if (!editor) return;
					console.debug(`[Editor] runCommand stub: ${cmd}`);
					void editor;
				} catch (e) {
					console.warn('[Editor] runCommand failed', e);
				}
			}
		};
	}

	$effect(() => {
		if (mode !== 'preview' || !container) return;

		let cancelled = false;
		const root = container;
		let localCrepe: any = null;
		// Capture frontmatter + body via untrack so this effect ONLY re-runs on
		// mode/container changes — not on every keystroke. Otherwise Milkdown
		// gets destroyed + recreated on each char, killing the slash menu and
		// floating toolbar mid-interaction. Milkdown owns content state from
		// here; the parent re-mounts via {#key} on file change.
		const initialFrontmatter = untrack(() => frontmatter);
		const initialBody = untrack(() => body);

		(async () => {
			const [{ Crepe }, kit] = await Promise.all([
				import('@milkdown/crepe'),
				// Capture commands + schemas + ctx keys we need for the block menu.
				import('@milkdown/kit/preset/commonmark'),
				import('@milkdown/kit/preset/gfm').catch(() => null),
				import('@milkdown/crepe/theme/common/style.css').catch(() => null),
				import('@milkdown/crepe/theme/frame-dark.css').catch(() => null)
			]);
			const { editorViewCtx, commandsCtx } = await import('@milkdown/kit/core');
			crepeKit = { ...kit, editorViewCtx, commandsCtx };

			if (cancelled) return;
			localCrepe = new Crepe({ root, defaultValue: initialBody });
			await localCrepe.create();
			if (cancelled) {
				localCrepe.destroy();
				return;
			}
			crepe = localCrepe;
			localCrepe.setReadonly?.(readonly);

			localCrepe.on?.((listener: any) => {
				listener.markdownUpdated?.((_ctx: any, markdown: string) => {
					// Recombine frontmatter (unchanged) + body Milkdown emits.
					onChange(joinFrontmatter(initialFrontmatter, markdown));
				});
			});

			// Phase 7: hook the block-handle DOM after Crepe injects it.
			wireBlockHandle(root);

			onReady(buildApi(localCrepe));
		})();

		return () => {
			cancelled = true;
			if (localCrepe) {
				try {
					localCrepe.destroy();
				} catch {
					/* ignore */
				}
				localCrepe = null;
			}
			crepe = null;
			onReady(null);
		};
	});

	$effect(() => {
		if (crepe && typeof crepe.setReadonly === 'function') {
			crepe.setReadonly(readonly);
		}
	});

	function onSourceInput(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		onChange(target.value);
	}

	// ============================================================
	// Phase 7 — block menu + drag-reorder
	// ============================================================

	/**
	 * Crepe's BlockHandle is mounted async by Vue inside the editor root once
	 * the editor view is up. We poll briefly for the second `.operation-item`
	 * (the ⋮⋮ icon) and wire click + drag handlers. Crepe re-uses the same
	 * DOM node throughout the editor's lifetime, so a single wire-up is enough.
	 */
	function wireBlockHandle(root: HTMLElement): void {
		let attempts = 0;
		const tryWire = () => {
			const handles = root.querySelectorAll('.milkdown-block-handle .operation-item');
			const drag = handles[1] as HTMLElement | undefined;
			if (!drag) {
				if (attempts++ > 40) return;
				setTimeout(tryWire, 50);
				return;
			}
			// Pointer-based drag flow. We deliberately AVOID HTML5 native
			// drag-and-drop (`draggable=true` + dragstart/over/drop): it's
			// notoriously unreliable across browsers (custom MIMEs aren't in
			// dataTransfer.types in Chromium drop targets, headless drag
			// dispatch doesn't always fire the chain, etc). Pointer events
			// give us a deterministic mousedown→move→up sequence that we
			// drive ourselves.
			drag.addEventListener('click', onHandleClick);
			drag.addEventListener('pointerdown', onHandlePointerDown);
		};
		tryWire();
	}

	/**
	 * Resolve the ProseMirror block (top-level node) under the block-handle's
	 * current position. Strategy: probe `posAtCoords` slightly to the right of
	 * the handle (the handle sits in the LEFT gutter; the block content starts
	 * a few pixels to its right). We climb to depth 1 to land on the top-level
	 * block node, not on inline children.
	 */
	function resolveTargetBlock(handleEl: HTMLElement):
		| { start: number; end: number; level: number }
		| null {
		if (!crepe?.editor || !crepeKit) return null;
		const handleRect = handleEl.getBoundingClientRect();
		const probeX = handleRect.right + 30;
		const probeY = handleRect.top + handleRect.height / 2;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let resolved: { start: number; end: number; level: number } | null = null;
		crepe.editor.action((ctx: any) => {
			const view = ctx.get(crepeKit.editorViewCtx);
			const posInfo = view.posAtCoords({ left: probeX, top: probeY });
			if (!posInfo) return;
			const resolvedPos = view.state.doc.resolve(posInfo.pos);
			// Climb to depth 1 (top-level block under the doc).
			const depth = resolvedPos.depth >= 1 ? 1 : 0;
			const before = resolvedPos.before(Math.max(depth, 1));
			const after = resolvedPos.after(Math.max(depth, 1));
			resolved = { start: before, end: after, level: depth };
		});
		return resolved;
	}

	function onHandleClick(e: MouseEvent) {
		// Suppress the synthetic click that follows a drag: if the user
		// crossed the drag threshold during the pointer interaction, we
		// do NOT want to open the menu on top of the just-dropped block.
		if (clickSuppressed) {
			clickSuppressed = false;
			return;
		}
		const target = e.currentTarget as HTMLElement;
		const block = resolveTargetBlock(target);
		if (!block) return;
		blockTargetStart = block.start;
		blockTargetEnd = block.end;
		const rect = target.getBoundingClientRect();
		blockMenuX = rect.right + 4;
		blockMenuY = rect.top;
		blockMenuOpen = true;
	}

	// Set on pointerup-after-drag, consumed by the very next click event.
	let clickSuppressed = false;

	function closeBlockMenu() {
		blockMenuOpen = false;
		blockTargetStart = null;
		blockTargetEnd = null;
	}

	/**
	 * Apply a transform to the targeted block. Builds a tr that:
	 *   1. Moves the selection inside the target block (so setBlockType /
	 *      wrapIn act on it, not on whatever block currently has focus).
	 *   2. Calls the right schema-aware command.
	 * Re-uses Crepe's own commands when available (their wrappers already
	 * handle GFM specifics like task-list bookkeeping).
	 */
	function transformTargetBlock(kind: string) {
		if (blockTargetStart === null || !crepe?.editor || !crepeKit) {
			closeBlockMenu();
			return;
		}
		const start = blockTargetStart;
		closeBlockMenu();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		crepe.editor.action((ctx: any) => {
			const view = ctx.get(crepeKit.editorViewCtx);
			const { state, dispatch } = view;

			// Place the cursor inside the target block before running the
			// command — Crepe's setBlockType / wrapInBlockType act on the
			// current selection. Use the existing Selection class on the
			// running state to avoid a static `prosemirror-state` import.
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const SelectionClass: any = state.selection.constructor;
			const posStart = state.doc.resolve(start + 1);
			dispatch(state.tr.setSelection(SelectionClass.near(posStart)));

			// Now run the appropriate command via commandsCtx.
			const cmds = ctx.get(crepeKit.commandsCtx);
			const k = crepeKit;
			switch (kind) {
				case 'paragraph':
					cmds.call(k.setBlockTypeCommand.key, { nodeType: k.paragraphSchema.type(ctx) });
					break;
				case 'h1':
				case 'h2':
				case 'h3':
				case 'h4':
				case 'h5':
				case 'h6': {
					const level = Number(kind.slice(1));
					cmds.call(k.setBlockTypeCommand.key, {
						nodeType: k.headingSchema.type(ctx),
						attrs: { level }
					});
					break;
				}
				case 'bullet-list':
					cmds.call(k.wrapInBlockTypeCommand.key, {
						nodeType: k.bulletListSchema.type(ctx)
					});
					break;
				case 'ordered-list':
					cmds.call(k.wrapInBlockTypeCommand.key, {
						nodeType: k.orderedListSchema.type(ctx)
					});
					break;
				case 'quote':
					cmds.call(k.wrapInBlockTypeCommand.key, {
						nodeType: k.blockquoteSchema.type(ctx)
					});
					break;
				case 'code':
					cmds.call(k.setBlockTypeCommand.key, {
						nodeType: k.codeBlockSchema.type(ctx)
					});
					break;
				case 'divider':
					cmds.call(k.setBlockTypeCommand.key, { nodeType: k.hrSchema.type(ctx) });
					break;
			}
			view.focus();
		});
	}

	function duplicateTargetBlock() {
		if (blockTargetStart === null || blockTargetEnd === null || !crepe?.editor || !crepeKit) {
			closeBlockMenu();
			return;
		}
		const start = blockTargetStart;
		const end = blockTargetEnd;
		closeBlockMenu();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		crepe.editor.action((ctx: any) => {
			const view = ctx.get(crepeKit.editorViewCtx);
			const { state, dispatch } = view;
			const slice = state.doc.slice(start, end);
			const tr = state.tr.insert(end, slice.content);
			dispatch(tr);
			view.focus();
		});
	}

	function deleteTargetBlock() {
		if (blockTargetStart === null || blockTargetEnd === null || !crepe?.editor || !crepeKit) {
			closeBlockMenu();
			return;
		}
		const start = blockTargetStart;
		const end = blockTargetEnd;
		closeBlockMenu();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		crepe.editor.action((ctx: any) => {
			const view = ctx.get(crepeKit.editorViewCtx);
			const { state, dispatch } = view;
			const tr = state.tr.delete(start, end);
			dispatch(tr);
			view.focus();
		});
	}

	function buildBlockMenuItems(): MenuItem[] {
		return [
			{ header: 'Transformer en' },
			{ label: 'Texte', onClick: () => transformTargetBlock('paragraph') },
			{ label: 'Titre 1', onClick: () => transformTargetBlock('h1') },
			{ label: 'Titre 2', onClick: () => transformTargetBlock('h2') },
			{ label: 'Titre 3', onClick: () => transformTargetBlock('h3') },
			{ label: 'Liste à puces', onClick: () => transformTargetBlock('bullet-list') },
			{ label: 'Liste numérotée', onClick: () => transformTargetBlock('ordered-list') },
			{ label: 'Citation', onClick: () => transformTargetBlock('quote') },
			{ label: 'Bloc de code', onClick: () => transformTargetBlock('code') },
			{ label: 'Séparateur', onClick: () => transformTargetBlock('divider') },
			{ separator: true },
			{ label: 'Dupliquer', onClick: duplicateTargetBlock },
			{ label: 'Supprimer', danger: true, onClick: deleteTargetBlock }
		];
	}

	// ============================================================
	// Drag-and-drop reorder of blocks (pointer-event based, NOT HTML5
	// native drag-and-drop). The native API has too many cross-browser
	// pitfalls (custom MIMEs missing from dataTransfer.types, dragenter
	// requirement on Chromium, headless flakiness). Pointer events give
	// us a deterministic mousedown→move→up sequence we control.
	// ============================================================

	const DRAG_THRESHOLD_PX = 4;
	let pointerDownX = 0;
	let pointerDownY = 0;
	let isDragging = false;
	let pointerActive = false;

	function onHandlePointerDown(e: PointerEvent) {
		if (e.button !== 0) return;
		const target = e.currentTarget as HTMLElement;
		const block = resolveTargetBlock(target);
		if (!block) return;
		dragSourceStart = block.start;
		dragSourceEnd = block.end;
		dragSourceLevel = block.level;
		pointerDownX = e.clientX;
		pointerDownY = e.clientY;
		isDragging = false;
		pointerActive = true;
		// Capture the pointer so we keep getting move/up even when the
		// cursor wanders out of the small ⋮⋮ hit-area.
		try {
			target.setPointerCapture(e.pointerId);
		} catch {
			/* old browsers — fine, we still get window-level events */
		}
		window.addEventListener('pointermove', onWindowPointerMove);
		window.addEventListener('pointerup', onWindowPointerUp);
		window.addEventListener('pointercancel', onWindowPointerUp);
		// Don't preventDefault yet — let `click` fire if no drag follows.
	}

	function onWindowPointerMove(e: PointerEvent) {
		if (!pointerActive) return;
		if (!isDragging) {
			const dx = e.clientX - pointerDownX;
			const dy = e.clientY - pointerDownY;
			if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
			// Threshold crossed — commit to a drag.
			isDragging = true;
			document.body.style.cursor = 'grabbing';
			// Suppress the synthetic click that would otherwise follow the
			// pointer-up by adding a one-shot capture-phase listener on the
			// handle's click target.
		}
		updateDropIndicator(e.clientX, e.clientY);
	}

	function onWindowPointerUp(e: PointerEvent) {
		if (!pointerActive) return;
		pointerActive = false;
		window.removeEventListener('pointermove', onWindowPointerMove);
		window.removeEventListener('pointerup', onWindowPointerUp);
		window.removeEventListener('pointercancel', onWindowPointerUp);
		document.body.style.cursor = '';
		if (!isDragging) {
			// Pure click — onHandleClick will run. Reset state and bail.
			dragSourceStart = null;
			dragSourceEnd = null;
			dropIndicatorTop = null;
			return;
		}
		isDragging = false;
		clickSuppressed = true; // swallow the synthetic click that follows
		applyBlockReorder(e.clientX, e.clientY);
		dropIndicatorTop = null;
	}

	/**
	 * Recompute the drop-indicator Y position by snapping to the nearest
	 * block boundary under the cursor. Skips drawing when the cursor is
	 * over the source itself (no-op drop).
	 */
	function updateDropIndicator(clientX: number, clientY: number) {
		if (!crepe?.editor || !crepeKit || dragSourceStart === null || dragSourceEnd === null) return;
		const srcStart = dragSourceStart;
		const srcEnd = dragSourceEnd;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		crepe.editor.action((ctx: any) => {
			const view = ctx.get(crepeKit.editorViewCtx);
			const posInfo = view.posAtCoords({ left: clientX, top: clientY });
			if (!posInfo) {
				dropIndicatorTop = null;
				return;
			}
			const resolvedPos = view.state.doc.resolve(posInfo.pos);
			const depth = Math.max(resolvedPos.depth, 1);
			const before = resolvedPos.before(depth);
			const after = resolvedPos.after(depth);
			const startCoords = view.coordsAtPos(before);
			const endCoords = view.coordsAtPos(after);
			const mid = (startCoords.top + endCoords.bottom) / 2;
			const dropPos = clientY < mid ? before : after;
			// Hide indicator when hovering inside the source block itself.
			if (dropPos >= srcStart && dropPos <= srcEnd) {
				dropIndicatorTop = null;
				return;
			}
			const wrap = container?.getBoundingClientRect();
			if (!wrap) return;
			const snapY = clientY < mid ? startCoords.top : endCoords.bottom;
			dropIndicatorTop = snapY - wrap.top;
		});
	}

	function applyBlockReorder(clientX: number, clientY: number) {
		if (!crepe?.editor || !crepeKit || dragSourceStart === null || dragSourceEnd === null) {
			dragSourceStart = null;
			dragSourceEnd = null;
			return;
		}
		const srcStart = dragSourceStart;
		const srcEnd = dragSourceEnd;
		dragSourceStart = null;
		dragSourceEnd = null;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		crepe.editor.action((ctx: any) => {
			const view = ctx.get(crepeKit.editorViewCtx);
			const { state, dispatch } = view;
			const posInfo = view.posAtCoords({ left: clientX, top: clientY });
			if (!posInfo) return;
			const resolvedPos = state.doc.resolve(posInfo.pos);
			const depth = Math.max(resolvedPos.depth, 1);
			const before = resolvedPos.before(depth);
			const after = resolvedPos.after(depth);
			const startCoords = view.coordsAtPos(before);
			const endCoords = view.coordsAtPos(after);
			const mid = (startCoords.top + endCoords.bottom) / 2;
			let dropPos = clientY < mid ? before : after;
			if (dropPos >= srcStart && dropPos <= srcEnd) return;
			const slice = state.doc.slice(srcStart, srcEnd);
			let tr = state.tr.delete(srcStart, srcEnd);
			if (dropPos > srcEnd) dropPos -= srcEnd - srcStart;
			tr = tr.insert(dropPos, slice.content);
			dispatch(tr);
			view.focus();
		});
	}
</script>

{#if mode === 'source'}
	<div class="canvas-scroll">
		<div class="canvas">
			<textarea
				class="source"
				value={content}
				oninput={onSourceInput}
				readonly={readonly}
				spellcheck="false"
				aria-label="Markdown source"
			></textarea>
		</div>
	</div>
{:else}
	<div class="canvas-scroll">
		<div class="canvas">
			{#if frontmatter !== null}
				<details class="frontmatter-block" data-frontmatter>
					<summary>Frontmatter</summary>
					<pre><code>{frontmatter}</code></pre>
				</details>
			{/if}
			<div bind:this={container} data-editor="milkdown" class="preview">
				{#if dropIndicatorTop !== null}
					<div
						class="block-drop-indicator"
						style="top: {dropIndicatorTop}px"
						aria-hidden="true"
					></div>
				{/if}
			</div>
		</div>
	</div>
{/if}

{#if blockMenuOpen}
	<ContextMenu
		x={blockMenuX}
		y={blockMenuY}
		items={buildBlockMenuItems()}
		onClose={closeBlockMenu}
	/>
{/if}

<style>
	/* Outer scroll wrapper — full editor area, scrolls vertically. */
	.canvas-scroll {
		flex: 1;
		min-height: 0;
		overflow: auto;
	}

	/* Inner canvas — centered, max-width capped, uniform horizontal padding. */
	.canvas {
		max-width: var(--content-max-width);
		margin: 0 auto;
		padding: var(--space-6) var(--content-padding-x);
		min-height: 100%;
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.source {
		flex: 1;
		width: 100%;
		min-height: 60vh;
		margin: 0;
		padding: 0;
		background: transparent;
		border: 0;
		color: var(--color-text-primary);
		font-family: var(--font-mono);
		font-size: var(--text-ui);
		line-height: 1.6;
		resize: none;
		outline: none;
		tab-size: 2;
	}

	.frontmatter-block {
		background: var(--color-surface-veil);
		border: 1px solid var(--color-border-subtle);
		border-radius: var(--radius-md);
		padding: 0;
		font-size: var(--text-caption);
	}

	.frontmatter-block > summary {
		padding: 6px var(--space-3);
		cursor: pointer;
		color: var(--color-text-secondary);
		font-family: var(--font-mono);
		list-style: revert;
	}

	.frontmatter-block[open] > summary {
		border-bottom: 1px solid var(--color-border-subtle);
	}

	.frontmatter-block pre {
		margin: 0;
		padding: var(--space-3);
		font-family: var(--font-mono);
		color: var(--color-text-body);
		white-space: pre-wrap;
		word-break: break-word;
		line-height: 1.45;
	}

	.preview {
		flex: 1;
		min-height: 0;
		position: relative; /* anchor for the drop indicator */
	}

	/* Drop indicator drawn while a block is being dragged for reorder.
	 * 2px accent line spanning the editor canvas, snapped to the nearest
	 * block boundary by JS (top is set inline). */
	.block-drop-indicator {
		position: absolute;
		left: 0;
		right: 0;
		height: 2px;
		background: var(--color-accent);
		border-radius: 1px;
		pointer-events: none;
		z-index: 5;
	}

	/* Crepe defines --crepe-* on its own .milkdown selector. We override at the
	   same specificity (or higher) on .preview .milkdown so our tokens win
	   without relying on the parent-cascade trick. */
	.preview :global(.milkdown) {
		--crepe-color-background: transparent;
		--crepe-color-surface: var(--color-surface-veil);
		--crepe-color-surface-low: var(--color-surface-veil);
		--crepe-color-on-surface: var(--color-text-primary);
		--crepe-color-on-surface-variant: var(--color-text-body);
		--crepe-color-outline: var(--color-border);
		--crepe-color-primary: var(--color-accent);
		--crepe-color-secondary: var(--color-border-strong);
		--crepe-color-hover: var(--color-surface-hover);
		--crepe-color-selected: var(--color-surface-active);
		--crepe-color-inline-code: var(--color-text-primary);
		--crepe-color-inline-area: var(--color-surface-veil);
		--crepe-font-default: var(--font-sans);
		--crepe-font-title: var(--font-sans); /* override 'Noto Serif' default */
		--crepe-font-code: var(--font-mono);

		max-width: none;
		width: 100%;
		margin: 0;
		padding: 0;
		font-family: var(--font-sans);
		font-size: 15px;
		line-height: 1.6;
		color: var(--color-text-primary);
	}

	/* IDE-density heading scale (Crepe defaults are 42/36/32/28/24/18 — too large). */
	.preview :global(.milkdown h1),
	.preview :global(.milkdown h2),
	.preview :global(.milkdown h3),
	.preview :global(.milkdown h4),
	.preview :global(.milkdown h5),
	.preview :global(.milkdown h6) {
		color: var(--color-text-primary);
		font-family: var(--font-sans);
		font-style: normal;
		font-weight: var(--weight-medium);
		letter-spacing: var(--tracking-heading);
	}

	.preview :global(.milkdown h1) {
		font-size: 26px;
		line-height: 1.25;
		margin-top: 0;
	}
	.preview :global(.milkdown h2) {
		font-size: 21px;
		line-height: 1.3;
	}
	.preview :global(.milkdown h3) {
		font-size: 18px;
		line-height: 1.35;
	}
	.preview :global(.milkdown h4) {
		font-size: 16px;
		line-height: 1.4;
	}
	.preview :global(.milkdown h5),
	.preview :global(.milkdown h6) {
		font-size: 14px;
		line-height: 1.4;
		color: var(--color-text-body);
	}

	.preview :global(.milkdown p),
	.preview :global(.milkdown li) {
		font-family: var(--font-sans);
		font-size: 15px;
		line-height: 1.6;
		color: var(--color-text-body);
	}

	.preview :global(.milkdown code) {
		font-family: var(--font-mono);
		font-size: 0.92em;
		background: var(--color-surface-veil);
		padding: 1px 5px;
		border-radius: var(--radius-xs);
		color: var(--color-text-primary);
	}

	.preview :global(.milkdown pre) {
		font-family: var(--font-mono);
		background: var(--color-surface-veil);
		border: 1px solid var(--color-border-subtle);
		border-radius: var(--radius-md);
		padding: var(--space-3) var(--space-4);
		overflow-x: auto;
	}

	.preview :global(.milkdown pre code) {
		background: transparent;
		padding: 0;
		font-size: 13px;
		line-height: 1.55;
	}

	.preview :global(.milkdown a) {
		color: var(--color-accent);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.preview :global(.milkdown blockquote) {
		margin: 0;
		padding: 0 var(--space-4);
		border-left: 3px solid var(--color-border-strong);
		color: var(--color-text-body);
	}
</style>
