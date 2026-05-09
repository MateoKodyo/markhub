<script lang="ts">
	import { onMount } from 'svelte';
	import Editor from '$lib/components/Editor.svelte';

	const FIXTURES: Record<string, string> = {
		headings: `# H1 heading example
## H2 heading example
### H3 heading example
#### H4 heading example
##### H5 heading example

A paragraph with **bold text** and *italic text* and \`inline code\` and a [link](https://example.com).

A second paragraph below to check spacing rhythm.`,

		frontmatter: `---
title: Sample document
tags: [demo, polish]
date: 2026-05-09
---

# Body title

The frontmatter above must render as a collapsed monospace \`<details>\` block, NOT in italic giant serif.

A paragraph below.`,

		slash: `# Type slash to open the menu

The slash menu opens at the caret when "/" is typed in an empty paragraph.`,

		toolbar: `# Floating toolbar

Select this whole sentence to summon the floating toolbar above the selection.

Another paragraph for context.`,

		'long-doc': Array.from({ length: 80 }, (_, i) => `## Section ${i + 1}\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.\n`).join('\n')
	};

	// Fake file-tree entries used by the `sidebar-overflow` fixture. We render
	// a static layout that mirrors the real Sidebar's flex chain (body → .app
	// → .sidebar → .files-section → tree) so the scroll test exercises the
	// same CSS paths as the real app.
	const FAKE_FILES = Array.from({ length: 60 }, (_, i) => ({
		name: `note-${String(i + 1).padStart(2, '0')}.md`
	}));

	let fixture = $state<string>('headings');
	let content = $derived(FIXTURES[fixture] ?? FIXTURES.headings);
	let ready = $state(false);

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		const f = params.get('fixture');
		if (f && (f in FIXTURES || f === 'sidebar-overflow' || f === 'editor-overflow')) {
			fixture = f;
		}
		ready = true;
	});
</script>

<svelte:head>
	<title>visual fixture: {fixture}</title>
	<style>
		/* Stabilize screenshots: kill blinking carets, smooth font rendering. */
		* {
			caret-color: transparent !important;
		}
		html,
		body {
			margin: 0;
			padding: 0;
			background: var(--color-bg-base, #0a0908);
			height: 100%;
			overflow: hidden;
		}
	</style>
</svelte:head>

<div class="visual-host" data-ready={ready}>
	{#if ready}
		{#if fixture === 'sidebar-overflow'}
			<!-- Mirrors the real Sidebar's CSS structure (flex root → .sidebar →
			     .vaults-section + .files-section). 60 fake entries push the tree
			     well past the viewport so the scroll behavior is observable. -->
			<div class="app-mirror">
				<aside class="sidebar-mirror">
					<section class="vaults-section-mirror">
						<span class="label">Vaults</span>
						<div class="vault-row">Notes perso</div>
						<div class="vault-row">Skills Claude</div>
					</section>
					<section class="files-section-mirror" data-testid="files-scroll">
						<header class="files-header">
							<span class="label">Fichiers</span>
						</header>
						<input class="filter" placeholder="Filtrer…" />
						<ul class="tree-mirror">
							{#each FAKE_FILES as f (f.name)}
								<li class="entry">{f.name}</li>
							{/each}
						</ul>
					</section>
				</aside>
				<main class="content-mirror">
					<header class="content-header-mirror">/path/to/long-doc.md</header>
					<div class="content-body-mirror" data-testid="editor-scroll">
						<Editor content={FIXTURES['long-doc']} mode="preview" readonly={false} />
					</div>
				</main>
			</div>
		{:else if fixture === 'editor-overflow'}
			<Editor content={FIXTURES['long-doc']} mode="preview" readonly={false} />
		{:else}
			<Editor {content} mode="preview" readonly={false} />
		{/if}
	{/if}
</div>

<style>
	.visual-host {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		width: 100vw;
		background: var(--color-bg-base);
	}

	/* === sidebar-overflow fixture mirror styles ===
	 * Match the real Sidebar/Editor flex structure so the scroll behaviour
	 * we test here is the same as in the real app. */
	.app-mirror {
		flex: 1;
		display: flex;
		min-height: 0;
	}

	.sidebar-mirror {
		display: flex;
		flex-direction: column;
		width: 280px;
		flex-shrink: 0;
		border-right: 1px solid var(--color-border-subtle);
		overflow: hidden;
	}

	.vaults-section-mirror {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-4) var(--space-3);
		border-bottom: 1px solid var(--color-border-subtle);
	}

	.files-section-mirror {
		flex: 1;
		min-height: 0;
		overflow: auto;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-4) var(--space-3);
	}

	.label {
		font-size: var(--text-label);
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		color: var(--color-text-secondary);
	}

	.vault-row,
	.entry {
		padding: 4px var(--space-3);
		font-size: var(--text-ui);
		color: var(--color-text-body);
	}

	.tree-mirror {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.filter {
		padding: 6px var(--space-3);
		background: var(--color-surface-veil);
		border: 1px solid var(--color-border-subtle);
		border-radius: var(--radius-sm);
		color: var(--color-text-primary);
		font-family: inherit;
		font-size: var(--text-ui);
	}

	.content-mirror {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		overflow: hidden;
	}

	.content-header-mirror {
		padding: var(--space-2) var(--space-4);
		border-bottom: 1px solid var(--color-border-subtle);
		font-family: var(--font-mono);
		font-size: var(--text-caption);
		color: var(--color-text-secondary);
		min-height: 44px;
		display: flex;
		align-items: center;
	}

	.content-body-mirror {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: hidden;
	}
</style>
