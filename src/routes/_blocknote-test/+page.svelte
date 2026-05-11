<script lang="ts">
	import { onMount } from 'svelte';
	import { splitFrontmatter, joinFrontmatter } from '$lib/utils/markdown';
	import BlockNoteSlashMenu, {
		type SlashMenuState
	} from '$lib/components/BlockNoteSlashMenu.svelte';
	import BlockNoteFormattingToolbar, {
		type ActiveStyles,
		type FormattingMark
	} from '$lib/components/BlockNoteFormattingToolbar.svelte';
	import type { DefaultSuggestionItem } from '@blocknote/core';
	// Vite "?raw" loads the markdown file as a plain string at build time.
	import f1 from '../../../tests/fixtures/c1/01-frontmatter-headings-lists.md?raw';
	import f2 from '../../../tests/fixtures/c1/02-table-code-tasks.md?raw';
	import f3 from '../../../tests/fixtures/c1/03-links-emphases.md?raw';

	type FixtureRow = {
		id: string;
		label: string;
		source: string;
	};

	const fixtures: FixtureRow[] = [
		{ id: '01-frontmatter', label: '01 — frontmatter + headings + lists', source: f1 },
		{ id: '02-rich', label: '02 — table + code + tasks + quote', source: f2 },
		{ id: '03-inline', label: '03 — links + emphases + hr', source: f3 }
	];

	type Result = {
		fixture: FixtureRow;
		bodySource: string;       // body after frontmatter split (input to BN)
		bodyRoundtrip: string;    // body after BN export
		fullSource: string;       // original .md
		fullRoundtrip: string;    // re-joined frontmatter + bodyRoundtrip
		identical: boolean;
		bodyIdentical: boolean;
		diffSummary: string;
	};

	let editor1: HTMLDivElement | null = $state(null);
	let editor2: HTMLDivElement | null = $state(null);
	let editor3: HTMLDivElement | null = $state(null);
	let interactiveEditor: HTMLDivElement | null = $state(null);
	let results = $state<Result[]>([]);
	let smokeReady = $state(false);

	// Slash-menu state piped from BlockNote's suggestion plugin.
	let slashState = $state<SlashMenuState | null>(null);
	let slashItems = $state<DefaultSuggestionItem[]>([]);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let interactiveEditorInstance: any = null;

	// Formatting toolbar state — store is just Store<boolean> in BlockNote
	// core. The anchor rect is computed by us from the live selection.
	let formatVisible = $state(false);
	let formatRefPos = $state<DOMRect | null>(null);
	let formatActive = $state<ActiveStyles>({});
	let formatHasLink = $state(false);

	function readSelectionRect(): DOMRect | null {
		const sel = typeof window !== 'undefined' ? window.getSelection() : null;
		if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
		const r = sel.getRangeAt(0).getBoundingClientRect();
		// Some browsers return a zero-rect for a single empty range; bail out
		// so we don't anchor on (0,0).
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

	function buildDiffSummary(a: string, b: string): string {
		if (a === b) return '— identical —';
		const aLines = a.split('\n');
		const bLines = b.split('\n');
		const out: string[] = [];
		out.push(`source: ${aLines.length} lines / ${a.length} chars`);
		out.push(`export: ${bLines.length} lines / ${b.length} chars`);
		// Show the first ~3 diverging line pairs.
		const max = Math.max(aLines.length, bLines.length);
		let shown = 0;
		for (let i = 0; i < max && shown < 3; i++) {
			if (aLines[i] !== bLines[i]) {
				out.push(`L${i + 1}:`);
				out.push(`  − ${JSON.stringify(aLines[i] ?? '')}`);
				out.push(`  + ${JSON.stringify(bLines[i] ?? '')}`);
				shown++;
			}
		}
		if (shown === 3) out.push('…(more diffs above; see panels)');
		return out.join('\n');
	}

	async function runRoundtrip(): Promise<void> {
		const { BlockNoteEditor } = await import('@blocknote/core');
		// We rely on default style.css so the editor is at least visible during
		// the smoke pass. Step 3 will replace it with Markhub tokens.
		await import('@blocknote/core/style.css').catch(() => {
			/* fine if missing */
		});

		const computed: Result[] = [];
		const containers = [editor1, editor2, editor3];

		for (let i = 0; i < fixtures.length; i++) {
			const fx = fixtures[i];
			const container = containers[i];
			if (!container) continue;

			const split = splitFrontmatter(fx.source);
			const fm = split.frontmatter;
			const body = split.body;

			const editor = BlockNoteEditor.create();
			editor.mount(container);
			// Replace the default empty document with the parsed markdown body.
			const blocks = editor.tryParseMarkdownToBlocks(body);
			editor.replaceBlocks(editor.document, blocks);

			// Defer the export by a frame so the editor finalizes its document.
			await new Promise<void>((r) =>
				requestAnimationFrame(() => requestAnimationFrame(() => r()))
			);
			const bodyRoundtrip = await editor.blocksToMarkdownLossy();
			const fullRoundtrip = joinFrontmatter(fm, bodyRoundtrip);

			computed.push({
				fixture: fx,
				bodySource: body,
				bodyRoundtrip,
				fullSource: fx.source,
				fullRoundtrip,
				identical: fullRoundtrip === fx.source,
				bodyIdentical: bodyRoundtrip === body,
				diffSummary: buildDiffSummary(body, bodyRoundtrip)
			});
		}

		results = computed;
	}

	async function mountInteractive(): Promise<void> {
		if (!interactiveEditor) return;
		const { BlockNoteEditor, filterSuggestionItems, getDefaultSlashMenuItems } =
			await import('@blocknote/core');
		const editor = BlockNoteEditor.create();
		editor.mount(interactiveEditor);
		// Load the rich fixture so the smoke surface covers tables / code / tasks.
		const split = splitFrontmatter(f2);
		const blocks = editor.tryParseMarkdownToBlocks(split.body);
		editor.replaceBlocks(editor.document, blocks);
		interactiveEditorInstance = editor;

		// === Wire the SuggestionMenu plugin store into our Svelte UI ===
		// `editor.extensions` is a Map<string, ExtensionInstance>. The
		// suggestionMenu extension exposes:
		//   { key, store, addSuggestionMenu, removeSuggestionMenu, closeMenu,
		//     clearQuery, shown, openSuggestionMenu, prosemirrorPlugins }
		// `store` is a TanStack Store; its subscribe callback receives
		// `{ prevVal, currentVal }`, not the state directly.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const ext = (editor as any).getExtension?.('suggestionMenu');
		if (!ext) {
			console.warn('[blocknote-test] suggestionMenu extension not exposed');
			smokeReady = true;
			return;
		}
		// Default config already registers a "/" trigger; this is just safety.
		try {
			ext.addSuggestionMenu?.({ triggerCharacter: '/' });
		} catch {
			/* already registered — ignore */
		}

		ext.store.subscribe((payload: { currentVal: unknown }) => {
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
			const all = getDefaultSlashMenuItems(editor);
			slashItems = filterSuggestionItems(all, slashState.query);
		});

		// === Wire the FormattingToolbar plugin store into our Svelte UI ===
		// The store payload is just `currentVal: boolean` (visible / hidden).
		// We compute the anchor rect ourselves from window.getSelection().
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const ftExt = (editor as any).getExtension?.('formattingToolbar');
		if (ftExt?.store) {
			ftExt.store.subscribe((payload: { currentVal: boolean }) => {
				formatVisible = Boolean(payload.currentVal);
				refreshFormatState(editor);
			});
		}
		// Selection can move (arrow keys) without flipping the store; refresh
		// the anchor + active styles on every selection change while visible.
		editor.onSelectionChange?.(() => {
			if (formatVisible) refreshFormatState(editor);
		});

		smokeReady = true;
	}

	function onFormatToggle(mark: FormattingMark) {
		const editor = interactiveEditorInstance;
		if (!editor) return;
		editor.toggleStyles({ [mark]: true });
		// Refresh active flags so the buttons reflect the new state immediately.
		refreshFormatState(editor);
	}

	function onFormatLink() {
		const editor = interactiveEditorInstance;
		if (!editor) return;
		const current = editor.getSelectedLinkUrl?.() ?? '';
		// Pragmatic step-2.5.b UX: simple prompt(). The full inline link
		// editor is the LinkToolbar of step 2.5.e.
		// eslint-disable-next-line no-alert
		const url = window.prompt('Lien (URL)', current);
		if (url == null) return;
		const trimmed = url.trim();
		if (trimmed.length === 0) return;
		editor.createLink(trimmed);
		refreshFormatState(editor);
	}

	function onSlashSelect(item: DefaultSuggestionItem) {
		// The item itself owns the transformation logic.
		item.onItemClick();
	}

	function onSlashClose() {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const ext = (interactiveEditorInstance as any)?.extensions?.suggestionMenu;
		ext?.closeMenu?.();
		slashState = null;
	}

	onMount(async () => {
		await runRoundtrip();
		await mountInteractive();
	});
</script>

<svelte:head>
	<title>BlockNote round-trip probe</title>
	<style>
		body {
			margin: 0;
			padding: 16px;
			background: #0a0908;
			color: #faf9f6;
			font-family: 'Geist Variable', system-ui, sans-serif;
			font-size: 14px;
			line-height: 1.5;
		}
	</style>
</svelte:head>

<div class="probe">
	<h1>BlockNote round-trip probe — Chantier 1 / Étape 2</h1>
	<p>
		Each fixture is parsed via <code>tryParseMarkdownToBlocks</code>, mounted, then
		exported via <code>blocksToMarkdownLossy</code>. Frontmatter is split out before
		feeding the body to BlockNote (matches our existing strategy with Crepe).
	</p>

	<section class="results">
		<h2>Round-trip results</h2>
		{#each fixtures as fx, i (fx.id)}
			<article class="fixture" data-fixture-id={fx.id}>
				<header>
					<h3>{fx.label}</h3>
					{#if results[i]}
						<span
							class="badge"
							class:is-ok={results[i].bodyIdentical}
							class:is-diff={!results[i].bodyIdentical}
							data-testid="fixture-{fx.id}-status"
						>
							{results[i].bodyIdentical ? 'BODY OK' : 'BODY DIFFERS'}
						</span>
					{:else}
						<span class="badge is-pending">…</span>
					{/if}
				</header>

				<div class="grid">
					<div class="cell">
						<h4>source body</h4>
						<pre><code>{splitFrontmatter(fx.source).body}</code></pre>
					</div>
					<div class="cell">
						<h4>BlockNote (rendered)</h4>
						{#if i === 0}
							<div bind:this={editor1} class="bn-mount"></div>
						{:else if i === 1}
							<div bind:this={editor2} class="bn-mount"></div>
						{:else}
							<div bind:this={editor3} class="bn-mount"></div>
						{/if}
					</div>
					<div class="cell">
						<h4>round-trip body</h4>
						<pre data-testid="fixture-{fx.id}-output"><code
								>{results[i]?.bodyRoundtrip ?? '…'}</code
							></pre>
					</div>
				</div>

				{#if results[i]}
					<details class="diff" open={!results[i].bodyIdentical}>
						<summary>Diff summary</summary>
						<pre>{results[i].diffSummary}</pre>
					</details>
				{/if}
			</article>
		{/each}
	</section>

	<section class="smoke">
		<h2>Live smoke editor (fixture 02 loaded)</h2>
		<p>
			Use this panel to manually test: drag handle, slash menu, formatting toolbar,
			tables resize, code blocks, task lists, transform menu.
		</p>
		<div bind:this={interactiveEditor} class="bn-mount bn-interactive" data-ready={smokeReady}></div>
	</section>
</div>

<!-- Slash-menu UI (2.5.a): driven by the SuggestionMenu plugin store -->
<BlockNoteSlashMenu
	menuState={slashState}
	items={slashItems}
	onSelect={onSlashSelect}
	onClose={onSlashClose}
/>

<!-- Formatting toolbar UI (2.5.b): driven by the FormattingToolbar plugin store -->
<BlockNoteFormattingToolbar
	visible={formatVisible}
	referencePos={formatRefPos}
	activeStyles={formatActive}
	hasLink={formatHasLink}
	onToggle={onFormatToggle}
	onLink={onFormatLink}
/>

<style>
	.probe {
		max-width: 1280px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 32px;
	}

	h1 {
		font-size: 22px;
		font-weight: 500;
		margin: 0;
	}

	h2 {
		font-size: 18px;
		font-weight: 500;
		margin: 0 0 12px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		padding-bottom: 6px;
	}

	h3 {
		font-size: 15px;
		margin: 0;
	}

	h4 {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 1.2px;
		color: rgba(255, 255, 255, 0.6);
		margin: 0 0 4px;
	}

	.fixture {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 8px;
	}

	.fixture header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.badge {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 1.2px;
		padding: 2px 8px;
		border-radius: 4px;
		font-family: 'Geist Mono Variable', monospace;
	}
	.badge.is-ok {
		background: rgba(74, 222, 128, 0.15);
		color: #4ade80;
	}
	.badge.is-diff {
		background: rgba(248, 113, 113, 0.15);
		color: #f87171;
	}
	.badge.is-pending {
		background: rgba(255, 255, 255, 0.06);
		color: rgba(255, 255, 255, 0.5);
	}

	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 8px;
	}

	.cell {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}

	pre {
		margin: 0;
		padding: 8px;
		background: #060504;
		border: 1px solid rgba(255, 255, 255, 0.05);
		border-radius: 4px;
		font-family: 'Geist Mono Variable', monospace;
		font-size: 11.5px;
		line-height: 1.45;
		white-space: pre-wrap;
		word-break: break-word;
		max-height: 320px;
		overflow: auto;
	}

	.diff {
		font-size: 12px;
	}
	.diff pre {
		font-size: 11px;
		max-height: 220px;
	}

	.bn-mount {
		min-height: 320px;
		max-height: 320px;
		overflow: auto;
		padding: 6px;
		background: #060504;
		border: 1px solid rgba(255, 255, 255, 0.05);
		border-radius: 4px;
	}

	.bn-interactive {
		min-height: 460px;
		max-height: 600px;
	}
</style>
