<script lang="ts">
	/**
	 * AiAwareChip — PLAN-AI-READY STEP 4.
	 *
	 * Compact accent-tinted pill shown in the editor header when the active
	 * file is recognized as AI-aware. Non-interactive — a visual cue only.
	 * Self-gating on the `highlightAiAware` appearance setting; the full
	 * category label surfaces as a native tooltip.
	 */
	import { Sparkles } from 'lucide-svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import type { AiAwareCategory, AiAwareInfo } from '$lib/ai-ready/detector';

	let { info }: { info: AiAwareInfo } = $props();

	/** Short forms for the header pill — the badge tooltip already carries
	 *  the full `info.label`. */
	const SHORT_LABELS: Record<AiAwareCategory, string> = {
		'claude-project': 'Claude project',
		'agents-md': 'Agents',
		'cursor-rules': 'Cursor rules',
		'copilot-instructions': 'Copilot',
		'aider-config': 'Aider',
		gemini: 'Gemini',
		codex: 'Codex',
		'frontmatter-audience': 'AI-targeted',
		'frontmatter-specific-agent': 'AI-targeted'
	};

	const shortLabel = $derived(
		info.category === 'frontmatter-specific-agent' && info.detail
			? `AI: ${info.detail}`
			: SHORT_LABELS[info.category]
	);
</script>

{#if settingsStore.current.appearance.highlightAiAware}
	<span class="ai-chip" title={info.label}>
		<Sparkles size={12} strokeWidth={2} aria-hidden="true" focusable="false" />
		<span>{shortLabel}</span>
	</span>
{/if}

<style>
	.ai-chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		flex-shrink: 0;
		padding: 2px var(--space-2);
		font-family: var(--font-ui);
		font-size: var(--text-xs);
		line-height: 1;
		white-space: nowrap;
		color: var(--color-text-primary);
		background: color-mix(in srgb, var(--color-accent) 12%, var(--color-bg-raised));
		border: 1px solid color-mix(in srgb, var(--color-accent) 24%, transparent);
		border-radius: var(--radius-md);
	}

	.ai-chip :global(svg) {
		flex-shrink: 0;
		color: var(--color-accent);
	}
</style>
