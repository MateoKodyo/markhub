<script lang="ts">
	import { untrack } from 'svelte';
	import { joinFrontmatter, splitFrontmatter } from '$lib/utils/markdown';
	import BlockNoteSlashMenu, {
		type SlashMenuState
	} from './BlockNoteSlashMenu.svelte';
	import BlockNoteFormattingToolbar, {
		type ActiveStyles,
		type FormattingMark
	} from './BlockNoteFormattingToolbar.svelte';
	import BlockNoteSideMenu, {
		type SideMenuState,
		type TransformType
	} from './BlockNoteSideMenu.svelte';
	import BlockNoteTableHandles, {
		type TableHandlesState
	} from './BlockNoteTableHandles.svelte';
	import type { DefaultSuggestionItem } from '@blocknote/core';

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
	// We type the editor instance loosely: the dynamic import returns a
	// fully-generic class whose schema params would force a noisy chain of
	// type aliases here. The surface we actually call is small (mount,
	// onChange, getExtension, toggleStyles, createLink, isEditable), so a
	// soft `any` is acceptable for this single integration point.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let editorInstance: any = null;

	// Frontmatter is split out before feeding the body to BlockNote and
	// re-attached on every save. BlockNote never sees the YAML preamble.
	const split = $derived(splitFrontmatter(content));
	const frontmatter = $derived(split.frontmatter);
	const body = $derived(split.body);

	// Slash menu state piped from the SuggestionMenu plugin store.
	let slashState = $state<SlashMenuState | null>(null);
	let slashItems = $state<DefaultSuggestionItem[]>([]);

	// Formatting toolbar state — store is a Store<boolean>, anchor rect is
	// computed by us from window.getSelection().
	let formatVisible = $state(false);
	let formatRefPos = $state<DOMRect | null>(null);
	let formatActive = $state<ActiveStyles>({});
	let formatHasLink = $state(false);

	// Side menu state — payload from the plugin's TanStack store, exposed
	// when a block is hovered. `null` means the side menu must hide.
	let sideMenuState = $state<SideMenuState | null>(null);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let sideMenuExt: any = null;

	// Table handles state — payload from the tableHandles plugin store
	// when a table cell is hovered. The plugin renders drop indicators
	// natively; we only render the affordances (row/col drag handles +
	// add row/col buttons).
	let tableHandlesState = $state<TableHandlesState | null>(null);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let tableHandlesExt: any = null;

	function readSelectionRect(): DOMRect | null {
		const sel = typeof window !== 'undefined' ? window.getSelection() : null;
		if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
		const r = sel.getRangeAt(0).getBoundingClientRect();
		if (r.width === 0 && r.height === 0) return null;
		return r;
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function refreshFormatState(editor: any) {
		if (!formatVisible) {
			formatRefPos = null;
			formatActive = {};
			formatHasLink = false;
			return;
		}
		formatRefPos = readSelectionRect();
		try {
			const styles = editor.getActiveStyles?.() ?? {};
			formatActive = {
				bold: Boolean(styles.bold),
				italic: Boolean(styles.italic),
				strike: Boolean(styles.strike),
				code: Boolean(styles.code)
			};
		} catch {
			formatActive = {};
		}
		formatHasLink = Boolean(editor.getSelectedLinkUrl?.());
	}

	function buildApi(): EditorApi {
		return {
			runCommand(cmd) {
				// The header EditorToolbar is currently cosmetic (its buttons
				// were already a stub under Crepe). The new floating
				// FormattingToolbar over the selection is the real entry
				// point for marks.
				console.debug(`[Editor] runCommand stub: ${cmd}`);
			}
		};
	}

	$effect(() => {
		if (mode !== 'preview' || !container) return;

		let cancelled = false;
		const root = container;
		// Capture frontmatter + body via untrack so this effect ONLY re-runs
		// on mode/container changes — not on every keystroke. BlockNote owns
		// the body once mounted; the parent re-mounts via {#key} on file
		// switch.
		const initialFrontmatter = untrack(() => frontmatter) ?? '';
		const initialBody = untrack(() => body);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let localEditor: any = null;
		const unsubscribers: Array<() => void> = [];
		// `replaceBlocks` triggers onChange synchronously the first time we
		// load a document; we don't want that to bubble up as a user-edit.
		let suppressNextChange = true;

		(async () => {
			const [{ BlockNoteEditor, filterSuggestionItems, getDefaultSlashMenuItems }] =
				await Promise.all([
					import('@blocknote/core'),
					// Style sheet brings the default block layout, drag handle
					// drop indicator and inline UI primitives. Markhub-specific
					// polish is layered on top via :global rules below and will
					// be tightened in step 3.
					import('@blocknote/core/style.css').catch(() => null)
				]);
			if (cancelled) return;

			const editor = BlockNoteEditor.create();
			editor.mount(root);

			// Replace the empty default doc with the parsed body. Use the
			// suppress flag rather than a delayed subscribe: delays leak when
			// the user types fast right after mount.
			const blocks = editor.tryParseMarkdownToBlocks(initialBody);
			editor.replaceBlocks(editor.document, blocks);
			editor.isEditable = !readonly;

			if (cancelled) {
				editor.unmount?.();
				return;
			}
			localEditor = editor;
			editorInstance = editor;

			// Save flow.
			const offChange = editor.onChange(async () => {
				if (suppressNextChange) {
					suppressNextChange = false;
					return;
				}
				const md = await editor.blocksToMarkdownLossy();
				onChange(joinFrontmatter(initialFrontmatter, md));
			});
			if (typeof offChange === 'function') unsubscribers.push(offChange);

			// === Slash menu wiring (mirrors the dev route _blocknote-test) ===
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const sugExt = (editor as any).getExtension?.('suggestionMenu');
			if (sugExt?.store) {
				try {
					sugExt.addSuggestionMenu?.({ triggerCharacter: '/' });
				} catch {
					/* already registered — ignore */
				}
				const off = sugExt.store.subscribe((payload: { currentVal: unknown }) => {
					const s = payload.currentVal;
					if (!s || !(s as { show?: boolean }).show) {
						slashState = null;
						slashItems = [];
						return;
					}
					const next = s as SlashMenuState & { triggerCharacter: string };
					slashState = {
						show: next.show,
						referencePos: next.referencePos,
						query: next.query ?? '',
						triggerCharacter: next.triggerCharacter
					};
					slashItems = filterSuggestionItems(
						getDefaultSlashMenuItems(editor),
						slashState.query
					);
				});
				if (typeof off === 'function') unsubscribers.push(off);
			}

			// === Formatting toolbar wiring ===
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const ftExt = (editor as any).getExtension?.('formattingToolbar');
			if (ftExt?.store) {
				const off = ftExt.store.subscribe((payload: { currentVal: boolean }) => {
					formatVisible = Boolean(payload.currentVal);
					refreshFormatState(editor);
				});
				if (typeof off === 'function') unsubscribers.push(off);
			}
			const offSel = editor.onSelectionChange?.(() => {
				if (formatVisible) refreshFormatState(editor);
			});
			if (typeof offSel === 'function') unsubscribers.push(offSel);

			// === SideMenu wiring (drag handle + transform menu) ===
			// Store payload is `SideMenuState | undefined`. We only render
			// when `show` is true; the host calls blockDragStart /
			// blockDragEnd / freezeMenu / unfreezeMenu through the ext.
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const sideExt = (editor as any).getExtension?.('sideMenu');
			if (sideExt?.store) {
				sideMenuExt = sideExt;
				const off = sideExt.store.subscribe(
					(payload: { currentVal: unknown }) => {
						const s = payload.currentVal as SideMenuState | undefined;
						sideMenuState = s && s.show ? s : null;
					}
				);
				if (typeof off === 'function') unsubscribers.push(off);
			}

			// === TableHandles wiring (row/col drag + add row/col) ===
			// Plugin renders drop indicator (`bn-table-drop-cursor`)
			// natively; we only render the affordances.
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const thExt = (editor as any).getExtension?.('tableHandles');
			if (thExt?.store) {
				tableHandlesExt = thExt;
				const off = thExt.store.subscribe(
					(payload: { currentVal: unknown }) => {
						const s = payload.currentVal as TableHandlesState | undefined;
						tableHandlesState = s && s.show ? s : null;
					}
				);
				if (typeof off === 'function') unsubscribers.push(off);
			}

			onReady(buildApi());
		})();

		return () => {
			cancelled = true;
			for (const off of unsubscribers) {
				try {
					off();
				} catch {
					/* ignore */
				}
			}
			if (localEditor) {
				try {
					localEditor.unmount?.();
				} catch {
					/* ignore */
				}
				localEditor = null;
			}
			editorInstance = null;
			slashState = null;
			slashItems = [];
			formatVisible = false;
			formatRefPos = null;
			formatActive = {};
			formatHasLink = false;
			sideMenuState = null;
			sideMenuExt = null;
			tableHandlesState = null;
			tableHandlesExt = null;
			onReady(null);
		};
	});

	$effect(() => {
		if (editorInstance) {
			editorInstance.isEditable = !readonly;
		}
	});

	function onSourceInput(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		onChange(target.value);
	}

	function onSlashSelect(item: DefaultSuggestionItem) {
		item.onItemClick();
	}

	function onSlashClose() {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const ext = (editorInstance as any)?.getExtension?.('suggestionMenu');
		ext?.closeMenu?.();
		slashState = null;
	}

	function onFormatToggle(mark: FormattingMark) {
		if (!editorInstance) return;
		editorInstance.toggleStyles({ [mark]: true });
		refreshFormatState(editorInstance);
	}

	function onFormatLink() {
		if (!editorInstance) return;
		const current = editorInstance.getSelectedLinkUrl?.() ?? '';
		// Pragmatic step-4 UX: simple prompt(). The full inline link editor
		// is the LinkToolbar of step 2.5.e.
		// eslint-disable-next-line no-alert
		const url = window.prompt('Lien (URL)', current);
		if (url == null) return;
		const trimmed = url.trim();
		if (trimmed.length === 0) return;
		editorInstance.createLink(trimmed);
		refreshFormatState(editorInstance);
	}

	// ============================================================
	// Side menu handlers — bridge our Svelte component to the
	// BlockNote sideMenu plugin's imperative API.
	// ============================================================

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function onSideDragStart(e: DragEvent, block: any) {
		if (!sideMenuExt) return;
		// BlockNote's plugin reads {dataTransfer, clientY} and sets the
		// blocknote/html payload on the dataTransfer; the document-level
		// listeners then drive the DropCursor + reorder transaction.
		sideMenuExt.blockDragStart?.(
			{ dataTransfer: e.dataTransfer, clientY: e.clientY },
			block
		);
		sideMenuExt.freezeMenu?.();
	}

	function onSideDragEnd() {
		if (!sideMenuExt) return;
		sideMenuExt.blockDragEnd?.();
		sideMenuExt.unfreezeMenu?.();
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function onSideAddBlock(block: any) {
		if (!editorInstance) return;
		// Insert an empty paragraph immediately after the hovered block.
		editorInstance.insertBlocks?.([{ type: 'paragraph' }], block, 'after');
	}

	function onSideTransform(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		block: any,
		type: TransformType,
		props?: Record<string, unknown>
	) {
		if (!editorInstance) return;
		editorInstance.updateBlock?.(block, props ? { type, props } : { type });
	}

	function onSideMenuOpenChange(open: boolean) {
		if (!sideMenuExt) return;
		if (open) sideMenuExt.freezeMenu?.();
		else sideMenuExt.unfreezeMenu?.();
	}

	// ============================================================
	// Table handles handlers — bridge our Svelte component to the
	// BlockNote tableHandles plugin's imperative API.
	// ============================================================

	function onTableRowDragStart(e: DragEvent) {
		if (!tableHandlesExt) return;
		tableHandlesExt.rowDragStart?.({
			dataTransfer: e.dataTransfer,
			clientY: e.clientY
		});
		tableHandlesExt.freezeHandles?.();
	}

	function onTableColDragStart(e: DragEvent) {
		if (!tableHandlesExt) return;
		tableHandlesExt.colDragStart?.({
			dataTransfer: e.dataTransfer,
			clientX: e.clientX
		});
		tableHandlesExt.freezeHandles?.();
	}

	function onTableDragEnd() {
		if (!tableHandlesExt) return;
		tableHandlesExt.dragEnd?.();
		tableHandlesExt.unfreezeHandles?.();
	}

	function onTableAddRow(side: 'above' | 'below') {
		if (!tableHandlesExt || tableHandlesState?.rowIndex == null) return;
		tableHandlesExt.addRowOrColumn?.(tableHandlesState.rowIndex, {
			orientation: 'row',
			side
		});
	}

	function onTableAddCol(side: 'left' | 'right') {
		if (!tableHandlesExt || tableHandlesState?.colIndex == null) return;
		tableHandlesExt.addRowOrColumn?.(tableHandlesState.colIndex, {
			orientation: 'column',
			side
		});
	}

	function onTableFreezeChange(open: boolean) {
		if (!tableHandlesExt) return;
		if (open) tableHandlesExt.freezeHandles?.();
		else tableHandlesExt.unfreezeHandles?.();
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
			<div bind:this={container} data-editor="blocknote" class="preview"></div>
		</div>
	</div>
{/if}

<BlockNoteSlashMenu
	menuState={slashState}
	items={slashItems}
	onSelect={onSlashSelect}
	onClose={onSlashClose}
/>

<BlockNoteFormattingToolbar
	visible={formatVisible}
	referencePos={formatRefPos}
	activeStyles={formatActive}
	hasLink={formatHasLink}
	onToggle={onFormatToggle}
	onLink={onFormatLink}
/>

<BlockNoteSideMenu
	menuState={sideMenuState}
	onDragStart={onSideDragStart}
	onDragEnd={onSideDragEnd}
	onAddBlock={onSideAddBlock}
	onTransform={onSideTransform}
	onMenuOpenChange={onSideMenuOpenChange}
/>

<BlockNoteTableHandles
	tableState={tableHandlesState}
	onColDragStart={onTableColDragStart}
	onRowDragStart={onTableRowDragStart}
	onDragEnd={onTableDragEnd}
	onAddRow={onTableAddRow}
	onAddCol={onTableAddCol}
	onFreezeChange={onTableFreezeChange}
/>

<style>
	.canvas-scroll {
		flex: 1;
		min-height: 0;
		overflow: auto;
	}

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
		/* No `position: relative` here: BlockNote merges `editor.mount(...)`
		 * target's classes into the editor DOM, and the SideMenu plugin's
		 * drag-preview clone (`.bn-drag-preview { position: absolute }`)
		 * loses the specificity fight against this rule — leaving a
		 * 1280×410px invisible-but-in-flow element that pushes the status
		 * bar down on every drag. Diagnosed 2026-05-10 by probing
		 * document.body during dragstart. */
	}

	/* === Minimal BlockNote token mapping. Step 3 will reconcile fully ===
	 * The default @blocknote/core/style.css ships layout + drag affordances
	 * + drop indicator. We only override the tokens the design system cares
	 * about, plus the heading scale (BN defaults are too large for IDE
	 * density). */
	.preview :global(.bn-editor) {
		font-family: var(--font-sans);
		font-size: 15px;
		line-height: 1.6;
		color: var(--color-text-primary);
		background: transparent;
	}

	.preview :global(.bn-editor h1),
	.preview :global(.bn-editor h2),
	.preview :global(.bn-editor h3),
	.preview :global(.bn-editor h4),
	.preview :global(.bn-editor h5),
	.preview :global(.bn-editor h6) {
		color: var(--color-text-primary);
		font-family: var(--font-sans);
		font-style: normal;
		font-weight: var(--weight-medium);
		letter-spacing: var(--tracking-heading);
	}
	.preview :global(.bn-editor h1) {
		font-size: 26px;
		line-height: 1.25;
	}
	.preview :global(.bn-editor h2) {
		font-size: 21px;
		line-height: 1.3;
	}
	.preview :global(.bn-editor h3) {
		font-size: 18px;
		line-height: 1.35;
	}
	.preview :global(.bn-editor h4) {
		font-size: 16px;
		line-height: 1.4;
	}
	.preview :global(.bn-editor h5),
	.preview :global(.bn-editor h6) {
		font-size: 14px;
		line-height: 1.4;
		color: var(--color-text-body);
	}

	.preview :global(.bn-editor p),
	.preview :global(.bn-editor li) {
		font-family: var(--font-sans);
		font-size: 15px;
		line-height: 1.6;
		color: var(--color-text-body);
	}

	.preview :global(.bn-editor code) {
		font-family: var(--font-mono);
		font-size: 0.92em;
		background: var(--color-surface-veil);
		padding: 1px 5px;
		border-radius: var(--radius-xs);
		color: var(--color-text-primary);
	}

	.preview :global(.bn-editor pre) {
		font-family: var(--font-mono);
		background: var(--color-surface-veil);
		border: 1px solid var(--color-border-subtle);
		border-radius: var(--radius-md);
		padding: var(--space-3) var(--space-4);
		overflow-x: auto;
	}

	.preview :global(.bn-editor pre code) {
		background: transparent;
		padding: 0;
		font-size: 13px;
		line-height: 1.55;
	}

	.preview :global(.bn-editor a) {
		color: var(--color-accent);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.preview :global(.bn-editor blockquote) {
		margin: 0;
		padding: 0 var(--space-4);
		border-left: 3px solid var(--color-border-strong);
		color: var(--color-text-body);
	}
</style>
