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

Another paragraph for context.`
	};

	let fixture = $state<string>('headings');
	let content = $derived(FIXTURES[fixture] ?? FIXTURES.headings);
	let ready = $state(false);

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		const f = params.get('fixture');
		if (f && f in FIXTURES) fixture = f;
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
		<Editor {content} mode="preview" readonly={false} />
	{/if}
</div>

<style>
	.visual-host {
		display: flex;
		flex-direction: column;
		height: 100vh;
		width: 100vw;
		background: var(--color-bg-base);
	}
</style>
