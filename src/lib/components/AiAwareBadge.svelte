<script lang="ts">
	/**
	 * AiAwareBadge — PLAN-AI-READY STEP 3.
	 *
	 * A discreet 12×12 sparkle marking a file recognized as designed for
	 * human-AI collaboration. Self-gating: renders nothing when the
	 * `highlightAiAware` appearance setting is off. The recognized
	 * category surfaces as a native tooltip + `aria-label`.
	 */
	import { Sparkles } from 'lucide-svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import type { AiAwareInfo } from '$lib/ai-ready/detector';

	let { info }: { info: AiAwareInfo } = $props();
</script>

{#if settingsStore.current.appearance.highlightAiAware}
	<span class="ai-badge" role="img" title={info.label} aria-label={info.label}>
		<Sparkles size={12} strokeWidth={2} />
	</span>
{/if}

<style>
	.ai-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 12px;
		height: 12px;
		/* Accent at reduced presence — a hint, not a label (DESIGN-PRINCIPLES). */
		color: color-mix(in srgb, var(--color-accent) 70%, transparent);
	}
</style>
