<script lang="ts">
	import { untrack } from 'svelte';
	import { joinFrontmatter, splitFrontmatter } from '$lib/utils/markdown';

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
	let crepe: { destroy: () => void; setReadonly: (b: boolean) => void } | null = null;

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
			const { Crepe } = await import('@milkdown/crepe');
			await Promise.all([
				import('@milkdown/crepe/theme/common/style.css'),
				import('@milkdown/crepe/theme/frame-dark.css')
			]).catch(() => {
				/* style imports may not exist in tests; ignore */
			});

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
			<div bind:this={container} data-editor="milkdown" class="preview"></div>
		</div>
	</div>
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
