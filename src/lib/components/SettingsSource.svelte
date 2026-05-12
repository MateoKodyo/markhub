<script lang="ts">
	import { settingsStore } from '$lib/stores/settings.svelte';

	type MonoFontOption = {
		id: string;
		label: string;
		family: string;
	};

	/**
	 * Monospace font choices. Only Geist Mono is bundled with the app —
	 * the other two are common system installs. When a name isn't found,
	 * the stack falls through to the OS default mono (SF Mono / Monaco /
	 * Cascadia Code). No user-facing error, just a silent fallback.
	 */
	const MONO_FONTS: readonly MonoFontOption[] = [
		{
			id: 'geist-mono',
			label: 'Geist Mono',
			family:
				"'Geist Mono Variable', 'SF Mono', 'Monaco', 'Cascadia Code', monospace"
		},
		{
			id: 'jetbrains-mono',
			label: 'JetBrains Mono',
			family: "'JetBrains Mono', 'SF Mono', 'Monaco', 'Cascadia Code', monospace"
		},
		{
			id: 'fira-code',
			label: 'Fira Code',
			family: "'Fira Code', 'SF Mono', 'Monaco', 'Cascadia Code', monospace"
		}
	];

	function familyForId(id: string): string {
		return MONO_FONTS.find((f) => f.id === id)?.family ?? MONO_FONTS[0].family;
	}

	const current = $derived(settingsStore.current.source);

	function selectMono(id: string): void {
		const next = settingsStore.current;
		settingsStore.set({
			...next,
			source: { ...next.source, monoFont: id }
		});
	}
</script>

<div class="settings-section">
	<section class="settings-group" aria-labelledby="group-mono">
		<h4 class="settings-group-label" id="group-mono">Police monospace</h4>

		<div class="settings-row">
			<div class="settings-row-info">
				<span class="settings-row-label">Police pour le code et le mode source</span>
				<span class="settings-row-desc"
					>Appliquée au mode source, aux blocs de code et au code inline.</span
				>
			</div>
			<div
				class="settings-segmented font-segmented"
				role="radiogroup"
				aria-label="Sélectionner la police monospace"
			>
				{#each MONO_FONTS as font (font.id)}
					{@const isActive = current.monoFont === font.id}
					<button
						type="button"
						class="settings-segment"
						class:active={isActive}
						role="radio"
						aria-checked={isActive}
						onclick={() => selectMono(font.id)}
						style:font-family={font.family}
						data-testid={`source-mono-${font.id}`}
					>
						<span>{font.label}</span>
					</button>
				{/each}
			</div>
		</div>

		<div class="settings-row preview-row">
			<pre
				class="preview"
				style:font-family={familyForId(current.monoFont)}
				data-testid="source-preview"><code
					>// Aperçu — police monospace
const greet = (name) =&gt; `Hello, ` + name + `!`;
const items = [1, 2, 3].map(i =&gt; i * 2);</code
				></pre>
		</div>
	</section>
</div>

<style>
	:global(.font-segmented .settings-segment) {
		font-size: var(--text-ui);
		padding: 3px 11px;
	}

	.preview-row {
		grid-template-columns: 1fr;
		padding: var(--space-4) 0;
	}

	.preview {
		margin: 0;
		padding: var(--space-3) var(--space-4);
		background: var(--color-surface-veil);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		color: var(--color-text-body);
		font-size: 13px;
		line-height: 1.5;
		overflow-x: auto;
	}

	.preview code {
		font-family: inherit;
	}
</style>
