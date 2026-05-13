<script lang="ts">
	import { untrack } from 'svelte';
	import {
		joinFrontmatter,
		lineToBlockIndex,
		splitFrontmatter
	} from '$lib/utils/markdown';
	import { parseFrontmatter, serializeFrontmatter } from '$lib/frontmatter/parser';
	import FrontmatterBlock from './FrontmatterBlock.svelte';
	import { urlOpen } from '$lib/tauri/api';
	import { findStore } from '$lib/stores/find.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	// CSS pulled in statically so Vite HMR reloads the stylesheets on every
	// edit. Previously these lived inside an `await Promise.all([...])` block
	// alongside the BlockNote JS import — Vite does not HMR the dynamic
	// `import('*.css')` pattern reliably, which is what made the appearance
	// settings appear "stuck" during STEP 3 → STEP 5 dev iterations.
	// (BlockNote core JS stays dynamic — it's heavy and only needed once the
	// editor mounts.)
	import '@blocknote/core/style.css';
	import '$lib/styles/editor-blocknote.css';
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
	import BlockNoteLinkToolbar, {
		type LinkToolbarState
	} from './BlockNoteLinkToolbar.svelte';
	import type { DefaultSuggestionItem } from '@blocknote/core';

	export type EditorMode = 'preview' | 'source';

	let {
		content = '',
		readonly = false,
		mode = 'preview',
		fileKey,
		onChange = (_: string) => {}
	}: {
		content?: string;
		readonly?: boolean;
		mode?: EditorMode;
		/** Stable identifier for the open file (e.g. `vaultId::relativePath`).
		 *  Threaded into `FrontmatterBlock` so its collapsed state persists
		 *  per file. Optional — tests render Editor without a file. */
		fileKey?: string;
		onChange?: (content: string) => void;
	} = $props();

	let container: HTMLDivElement | null = $state(null);
	let sourceTextarea: HTMLTextAreaElement | null = $state(null);

	/** Scroll the source-mode textarea so `lineNumber` lands at ~⅓ from
	 *  the top, focusing it and selecting the line. */
	function scrollToLineInSource(lineNumber: number): void {
		if (!sourceTextarea) return;
		const lines = content.split('\n');
		const clamped = Math.max(1, Math.min(lineNumber, lines.length));
		const before = lines.slice(0, clamped - 1).join('\n');
		const offset = before.length + (clamped > 1 ? 1 : 0);
		const lineLen = lines[clamped - 1]?.length ?? 0;
		sourceTextarea.focus();
		sourceTextarea.setSelectionRange(offset, offset + lineLen);
		const lh = parseFloat(getComputedStyle(sourceTextarea).lineHeight);
		const lineHeight = Number.isFinite(lh) ? lh : 20;
		sourceTextarea.scrollTop = Math.max(
			0,
			(clamped - 1) * lineHeight - sourceTextarea.clientHeight / 3
		);
	}

	/** Scroll a specific BlockNote block into view. BlockNote's
	 *  `setTextCursorPosition` triggers ProseMirror's own scrollIntoView
	 *  on the next transaction — that's the reliable path, more robust
	 *  than a manual DOM query (which has bitten us on data-id stamping
	 *  and on stale node refs during HMR). DOM lookup still happens but
	 *  only for the accent flash.
	 *
	 *  We re-query for the data-id AFTER a microtask so the post-cursor
	 *  reflow has settled — flashing the freshly-positioned node.
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function scrollToBlockInPreview(block: any): boolean {
		if (!editorInstance || !block) return false;
		try {
			editorInstance.focus?.();
			editorInstance.setTextCursorPosition?.(block, 'start');
		} catch {
			return false;
		}
		// Post-transaction flash. Use rAF + querySelector so we read the
		// DOM AFTER ProseMirror's scroll lands. Falls back silently if
		// the data-id isn't on the element (older BlockNote builds).
		if (container) {
			requestAnimationFrame(() => {
				const el = container?.querySelector(
					`[data-id="${block.id}"]`
				) as HTMLElement | null;
				if (el) flashElement(el);
			});
		}
		return true;
	}

	let flashTimer: ReturnType<typeof setTimeout> | null = null;
	function flashElement(el: HTMLElement): void {
		el.classList.add('is-search-flash');
		if (flashTimer) clearTimeout(flashTimer);
		flashTimer = setTimeout(() => {
			el.classList.remove('is-search-flash');
			flashTimer = null;
		}, 1600);
	}

	/** Find the Nth `heading` block in BlockNote's document and scroll
	 *  it into view. Used by Outline-panel clicks (which pass the heading
	 *  index, not a line number). */
	function scrollToNthHeadingInPreview(headingIndex: number): boolean {
		if (!editorInstance) return false;
		try {
			const doc = editorInstance.document;
			if (!Array.isArray(doc)) return false;
			let count = -1;
			for (const block of doc) {
				if (block?.type === 'heading') {
					count++;
					if (count === headingIndex) {
						return scrollToBlockInPreview(block);
					}
				}
			}
			return false;
		} catch {
			return false;
		}
	}

	/** Resolve a 1-based source line number to its BlockNote block via
	 *  the markdown heuristic, then scroll to it. Used by Cmd+Shift+F
	 *  search hits in preview mode (previously a no-op). */
	function scrollToLineInPreview(lineNumber: number): boolean {
		if (!editorInstance) return false;
		try {
			const doc = editorInstance.document;
			if (!Array.isArray(doc)) return false;
			const idx = lineToBlockIndex(content, lineNumber);
			if (idx === null || idx < 0 || idx >= doc.length) return false;
			return scrollToBlockInPreview(doc[idx]);
		} catch {
			return false;
		}
	}

	// Listen for jump-to-line events fired by Cmd+Shift+F search hits.
	// Source mode scrolls the textarea + selects the line natively.
	// Preview mode auto-switches to source and jumps there: the
	// BlockNote-internal scroll path is too unreliable to count on
	// (see BACKLOG). Source-mode jump is deterministic and the native
	// blue selection serves as the "match here" visual cue.
	$effect(() => {
		const onJump = (e: Event) => {
			const detail = (e as CustomEvent<{ lineNumber: number }>).detail;
			if (!detail) return;
			if (mode === 'source') {
				scrollToLineInSource(detail.lineNumber);
			} else {
				window.dispatchEvent(new CustomEvent('app:toggleEditorMode'));
				// Wait one tick for the source textarea to mount, then jump.
				setTimeout(() => scrollToLineInSource(detail.lineNumber), 50);
			}
		};
		window.addEventListener('editor:jumpToLine', onJump);
		return () => window.removeEventListener('editor:jumpToLine', onJump);
	});

	// Cmd+F find — react to the active match. Preview mode auto-switches
	// to source (BlockNote-internal scroll is unreliable, see BACKLOG).
	// Source mode focuses + selects + scrolls so the textarea's native
	// blue selection lands on the match.
	$effect(() => {
		if (!findStore.isOpen) return;
		const idx = findStore.activeIndex;
		if (idx < 0 || findStore.matches.length === 0) return;
		const offset = findStore.matches[idx];
		const queryLen = findStore.query.length;
		if (mode !== 'source') {
			window.dispatchEvent(new CustomEvent('app:toggleEditorMode'));
			return;
		}
		if (!sourceTextarea) return;
		const before = content.slice(0, offset);
		const linesBefore = before.split('\n').length;
		sourceTextarea.focus();
		sourceTextarea.setSelectionRange(offset, offset + queryLen);
		const lh = parseFloat(getComputedStyle(sourceTextarea).lineHeight);
		const lineHeight = Number.isFinite(lh) ? lh : 20;
		sourceTextarea.scrollTop = Math.max(
			0,
			(linesBefore - 1) * lineHeight - sourceTextarea.clientHeight / 3
		);
	});

	// When the user edits the content, the match offsets we stored go
	// stale — recompute on every content change while the bar is open.
	$effect(() => {
		// `content` is a prop; read it to track changes.
		const _ = content;
		if (findStore.isOpen) findStore.refresh();
	});

	// Outline-panel clicks dispatch `outline:jumpToHeading` with a line
	// number (markdown source) AND the heading's index in the doc. We
	// always route through source-mode `scrollToLineInSource` — the
	// BlockNote `editor.document` walk diverged from `extractHeadings`
	// in real docs, landing on the wrong block. Same trade-off as
	// Cmd+F / Cmd+Shift+F: auto-switch source for deterministic scroll.
	$effect(() => {
		const onJumpHeading = (e: Event) => {
			const detail = (e as CustomEvent<{ line: number; index: number }>).detail;
			if (!detail) return;
			if (mode === 'source') {
				scrollToLineInSource(detail.line);
				return;
			}
			window.dispatchEvent(new CustomEvent('app:toggleEditorMode'));
			// Wait one tick for the source textarea to mount.
			setTimeout(() => scrollToLineInSource(detail.line), 50);
		};
		window.addEventListener('outline:jumpToHeading', onJumpHeading);
		return () =>
			window.removeEventListener('outline:jumpToHeading', onJumpHeading);
	});
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

	// Parsed view of the frontmatter for the dedicated UI block. When the
	// file has no `---` preamble we render nothing; when it parses, we get
	// the data; when it doesn't, the error banner gets the raw YAML.
	const parsedFrontmatter = $derived.by<{
		data: Record<string, unknown> | null;
		error: string | null;
		raw: string;
	}>(() => {
		if (frontmatter === null) return { data: null, error: null, raw: '' };
		const result = parseFrontmatter(frontmatter);
		if (result.ok) return { data: result.data, error: null, raw: '' };
		return { data: null, error: result.error, raw: result.raw };
	});

	/** Handle a structured edit from FrontmatterBlock. Serialize the new
	 *  data, fetch the current body (from BlockNote if mounted, else from
	 *  the split-derived body), and emit the joined content upstream so
	 *  the autosave pipeline does the actual disk write. */
	async function onFrontmatterChange(
		next: Record<string, unknown>
	): Promise<void> {
		const empty = Object.keys(next).length === 0;
		// An empty object serializes to "{}\n" — we want to drop the
		// frontmatter block entirely instead, matching the "no frontmatter"
		// shape `splitFrontmatter` already understands.
		const newYaml = empty ? null : serializeFrontmatter(next).replace(/\n+$/, '');
		let currentBody = body;
		if (editorInstance) {
			try {
				currentBody = await editorInstance.blocksToMarkdownLossy();
			} catch {
				/* fall back to the split body */
			}
		}
		onChange(joinFrontmatter(newYaml, currentBody));
	}

	// Slash menu state piped from the SuggestionMenu plugin store.
	let slashState = $state<SlashMenuState | null>(null);
	let slashItems = $state<DefaultSuggestionItem[]>([]);

	// Formatting toolbar state — store is a Store<boolean>, anchor rect is
	// computed by us from window.getSelection().
	let formatVisible = $state(false);
	let formatRefPos = $state<DOMRect | null>(null);
	let formatActive = $state<ActiveStyles>({});
	let formatHasLink = $state(false);
	let formatCurrentHref = $state('');

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

	// Link toolbar state — unlike the other plugins, `linkToolbar` does
	// NOT expose a `.store`. We poll `getLinkAtSelection()` on every
	// onSelectionChange to detect whether the cursor is inside a link.
	let linkToolbarState = $state<LinkToolbarState | null>(null);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let linkToolbarExt: any = null;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function refreshLinkToolbarState(editor: any) {
		if (!linkToolbarExt) return;
		try {
			const data = linkToolbarExt.getLinkAtSelection?.();
			if (data && data.position) {
				linkToolbarState = {
					show: true,
					link: {
						href: data.mark?.attrs?.href ?? '',
						text: data.text ?? '',
						position: data.position as DOMRect
					}
				};
			} else {
				linkToolbarState = null;
			}
		} catch {
			linkToolbarState = null;
		}
		void editor;
	}

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
			formatCurrentHref = '';
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
		const href = editor.getSelectedLinkUrl?.() ?? '';
		formatHasLink = Boolean(href);
		formatCurrentHref = href || '';
	}

	$effect(() => {
		if (mode !== 'preview' || !container) return;

		let cancelled = false;
		const root = container;
		// Capture the body via untrack so this effect ONLY re-runs on
		// mode/container changes — not on every keystroke. BlockNote owns
		// the body once mounted; the parent re-mounts via {#key} on file
		// switch. (Frontmatter is read live at onChange time so the
		// FrontmatterBlock edit path stays correct.)
		const initialBody = untrack(() => body);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let localEditor: any = null;
		const unsubscribers: Array<() => void> = [];
		// `replaceBlocks` triggers onChange synchronously the first time we
		// load a document; we don't want that to bubble up as a user-edit.
		let suppressNextChange = true;

		(async () => {
			const { BlockNoteEditor, filterSuggestionItems, getDefaultSlashMenuItems } =
				await import('@blocknote/core');
			if (cancelled) return;

			// `setIdAttribute: true` stamps each block with `data-id="…"` in
			// the DOM. Without it, `scrollToBlockInPreview` can't query
			// the rendered node (BlockNote keeps the id internally only).
			// Needed by jump-to-line search hits, outline clicks, and the
			// post-jump accent flash.
			const editor = BlockNoteEditor.create({ setIdAttribute: true });
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

			// Initial spellcheck application — the top-level $effect will
			// react to user toggles, but it can't pick up the .ProseMirror
			// element until BlockNote has actually mounted, so we set it once
			// here at mount-complete time.
			applySpellcheck();

			// Save flow. We read `frontmatter` (the $derived) at callback-time
			// instead of using `initialFrontmatter` so that a user edit made
			// via FrontmatterBlock isn't clobbered by a subsequent body edit.
			// Reading a $derived inside a non-reactive callback returns the
			// latest value without subscribing.
			const offChange = editor.onChange(async () => {
				if (suppressNextChange) {
					suppressNextChange = false;
					return;
				}
				const md = await editor.blocksToMarkdownLossy();
				onChange(joinFrontmatter(frontmatter ?? '', md));
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
				refreshLinkToolbarState(editor);
			});
			if (typeof offSel === 'function') unsubscribers.push(offSel);

			// === LinkToolbar wiring (query-only, no store) ===
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const ltExt = (editor as any).getExtension?.('linkToolbar');
			if (ltExt) {
				linkToolbarExt = ltExt;
				// Initial poll in case the editor starts with cursor on a link.
				refreshLinkToolbarState(editor);
			}

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
			formatCurrentHref = '';
			sideMenuState = null;
			sideMenuExt = null;
			tableHandlesState = null;
			tableHandlesExt = null;
			linkToolbarState = null;
			linkToolbarExt = null;
		};
	});

	$effect(() => {
		if (editorInstance) {
			editorInstance.isEditable = !readonly;
		}
	});

	/**
	 * Apply the user's spellcheck preference to BlockNote's contenteditable.
	 * BlockNote sets the `spellcheck` attribute internally; we override it
	 * here based on settings. Called once at mount-complete and on every
	 * settings change via the $effect below.
	 */
	function applySpellcheck() {
		if (!container) return;
		const editable = container.querySelector('.ProseMirror');
		if (editable instanceof HTMLElement) {
			editable.setAttribute(
				'spellcheck',
				String(settingsStore.current.editor.spellCheck)
			);
		}
	}

	// Reactive bridge: re-apply spellcheck whenever the user toggles the
	// setting in the modal. Reading `settingsStore.current.editor.spellCheck`
	// inside the effect body is what makes Svelte track it.
	$effect(() => {
		settingsStore.current.editor.spellCheck;
		applySpellcheck();
	});

	// Editor body typography (font family / size / line-height) is set
	// globally via CSS variables on <html>, see the `$effect` in
	// +page.svelte. Whether BlockNote's internal cascade picks them up
	// reliably is tracked in BACKLOG.md — until that's resolved cleanly
	// via BlockNote's theming API, the editor body keeps the legacy
	// 15px / 1.6 / Geist defaults from `editor-blocknote.css`. The other
	// appearance settings (theme, mono font, content width) DO apply
	// live, plus all editor settings (autosave, spellcheck) and the
	// remaining sections.

	function onSourceInput(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		onChange(target.value);
	}

	function onSlashSelect(item: DefaultSuggestionItem) {
		// BlockNote's `insertOrUpdateBlockForSlashMenu` only swaps the
		// current block when its content is exactly "/". If the user
		// typed "/h2" before picking, the content is "/h2" and BlockNote
		// inserts a NEW block AFTER the current one — leaving "/h2"
		// behind. Clearing the query first removes the "/<query>" range,
		// which empties the block and lets the swap path run cleanly.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const ext = (editorInstance as any)?.getExtension?.('suggestionMenu');
		ext?.clearQuery?.();
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

	function onFormatLink(url: string) {
		if (!editorInstance) return;
		const trimmed = url.trim();
		if (trimmed.length === 0) return;
		editorInstance.createLink(trimmed);
		refreshFormatState(editorInstance);
	}

	function onFormatOpenLink() {
		const href = formatCurrentHref?.trim();
		if (!href) return;
		void urlOpen(href).catch((err) => {
			console.warn('[Editor] urlOpen failed', err);
		});
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

	// ============================================================
	// Link toolbar handlers — bridge our Svelte component to the
	// BlockNote linkToolbar plugin's query-only API.
	// ============================================================

	function onLinkSave(url: string) {
		if (!linkToolbarExt || !editorInstance) return;
		const current = linkToolbarExt.getLinkAtSelection?.();
		if (!current || !current.range) return;
		// `editLink(url, text, position?)` updates both. We pass the
		// current text to preserve it and the link's start position.
		try {
			editorInstance.editLink?.(url, current.text ?? '', current.range.from);
		} catch (e) {
			console.warn('[Editor] editLink failed', e);
		}
		linkToolbarState = null;
	}

	function onLinkDelete() {
		if (!linkToolbarExt || !editorInstance) return;
		const current = linkToolbarExt.getLinkAtSelection?.();
		try {
			editorInstance.deleteLink?.(current?.range?.from);
		} catch (e) {
			console.warn('[Editor] deleteLink failed', e);
		}
		linkToolbarState = null;
	}

	function onLinkClose() {
		linkToolbarState = null;
	}
</script>

{#if mode === 'source'}
	<div class="canvas-scroll">
		<div class="canvas">
			<textarea
				bind:this={sourceTextarea}
				class="source"
				value={content}
				oninput={onSourceInput}
				readonly={readonly}
				spellcheck={settingsStore.current.editor.spellCheck}
				aria-label="Markdown source"
			></textarea>
		</div>
	</div>
{:else}
	<div class="canvas-scroll">
		<div class="canvas">
			{#if parsedFrontmatter.data !== null || parsedFrontmatter.error !== null}
				<FrontmatterBlock
					data={parsedFrontmatter.data}
					parseError={parsedFrontmatter.error}
					raw={parsedFrontmatter.raw}
					{fileKey}
					onChange={onFrontmatterChange}
				/>
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
	currentHref={formatCurrentHref}
	onToggle={onFormatToggle}
	onLink={onFormatLink}
	onOpenLink={onFormatOpenLink}
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

<BlockNoteLinkToolbar
	menuState={linkToolbarState}
	onSave={onLinkSave}
	onDelete={onLinkDelete}
	onClose={onLinkClose}
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

	/* BlockNote polish lives in src/styles/editor-blocknote.css
	 * (imported dynamically alongside @blocknote/core/style.css in the
	 * mount effect above). Keeping it global rather than scoped avoids
	 * Svelte's :global() noise for every selector. */
</style>
