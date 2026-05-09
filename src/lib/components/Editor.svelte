<script lang="ts">
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

	function buildApi(crepeInstance: any): EditorApi {
		return {
			runCommand(cmd) {
				if (!crepeInstance) return;
				try {
					// Best-effort wiring against Milkdown's command registry.
					// Real commands land via the floating Crepe toolbar; this gives a
					// minimal entry point for the static EditorToolbar.
					const editor = crepeInstance.editor;
					if (!editor) return;
					// Defer actual command implementation — Phase 4 MVP relies on the
					// floating Crepe toolbar for WYSIWYG operations. The static toolbar
					// is wired via `onCommand` and can be expanded post-MVP.
					console.debug(`[Editor] runCommand stub: ${cmd}`);
					void editor;
				} catch (e) {
					console.warn('[Editor] runCommand failed', e);
				}
			}
		};
	}

	$effect(() => {
		// Only initialize Milkdown in preview mode and when we have a mounted container.
		if (mode !== 'preview' || !container) return;

		let cancelled = false;
		const root = container;
		let localCrepe: any = null;

		(async () => {
			const { Crepe } = await import('@milkdown/crepe');
			// Lazy CSS imports — co-located with the editor. Tokens are overridden in app.css.
			await Promise.all([
				import('@milkdown/crepe/theme/common/style.css'),
				import('@milkdown/crepe/theme/frame-dark.css')
			]).catch(() => {
				/* style imports may not exist in tests; ignore */
			});

			if (cancelled) return;
			localCrepe = new Crepe({ root, defaultValue: content });
			await localCrepe.create();
			if (cancelled) {
				localCrepe.destroy();
				return;
			}
			crepe = localCrepe;
			localCrepe.setReadonly?.(readonly);

			// Listen for content updates.
			localCrepe.on?.((listener: any) => {
				listener.markdownUpdated?.((_ctx: any, markdown: string) => {
					onChange(markdown);
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

	// Propagate readonly changes to a running Milkdown instance.
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
	<textarea
		class="source"
		value={content}
		oninput={onSourceInput}
		readonly={readonly}
		spellcheck="false"
		aria-label="Markdown source"
	></textarea>
{:else}
	<div bind:this={container} data-editor="milkdown" class="preview"></div>
{/if}

<style>
	.source {
		flex: 1;
		width: 100%;
		min-height: 100%;
		margin: 0;
		padding: var(--space-5) var(--space-6);
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
		overflow: auto;
		/* Override Crepe's default surface to match our warm-dark theme. */
		--crepe-color-background: transparent;
		--crepe-color-surface: var(--color-surface-veil);
		--crepe-color-on-surface: var(--color-text-primary);
		--crepe-color-on-surface-variant: var(--color-text-body);
		--crepe-color-outline: var(--color-border);
		--crepe-color-primary: var(--color-accent);
		--crepe-font-default: var(--font-sans);
		--crepe-font-code: var(--font-mono);
	}

	.preview :global(.milkdown) {
		max-width: 760px;
		margin: 0 auto;
		padding: var(--space-6) var(--space-7);
		font-family: var(--font-sans);
		font-size: 15px;
		line-height: 1.6;
		color: var(--color-text-primary);
	}

	.preview :global(.milkdown h1),
	.preview :global(.milkdown h2),
	.preview :global(.milkdown h3),
	.preview :global(.milkdown h4) {
		color: var(--color-text-primary);
		font-weight: var(--weight-medium);
		letter-spacing: var(--tracking-heading);
	}

	.preview :global(.milkdown code) {
		font-family: var(--font-mono);
		font-size: 0.92em;
		background: var(--color-surface-veil);
		padding: 1px 5px;
		border-radius: var(--radius-xs);
	}

	.preview :global(.milkdown a) {
		color: var(--color-accent);
		text-decoration: underline;
		text-underline-offset: 2px;
	}
</style>
