<script lang="ts">
	import { Check, Monitor, Moon, Sun } from 'lucide-svelte';
	import type { ComponentType, SvelteComponent } from 'svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import type { ThemePreference } from '$lib/tauri/types';

	type IconComponent = ComponentType<SvelteComponent>;

	type ThemeOption = {
		id: ThemePreference;
		label: string;
		icon: IconComponent;
	};

	const THEMES: readonly ThemeOption[] = [
		{ id: 'dark', label: 'Sombre', icon: Moon as unknown as IconComponent },
		{ id: 'light', label: 'Clair', icon: Sun as unknown as IconComponent },
		{ id: 'system', label: 'Système', icon: Monitor as unknown as IconComponent }
	];

	type FontOption = {
		id: string;
		label: string;
		family: string;
	};

	/**
	 * Editor font choices. System-only stacks — no webfonts to bundle.
	 * The selected `id` is what lands in `settings.json`; the `family` stack
	 * is resolved on the frontend (here + the editor consumer in STEP 4).
	 */
	const FONTS: readonly FontOption[] = [
		{
			id: 'geist',
			label: 'Geist Sans',
			family: "'Geist Variable', system-ui, -apple-system, 'Helvetica Neue', sans-serif"
		},
		{
			id: 'system',
			label: 'System UI',
			family: "-apple-system, system-ui, BlinkMacSystemFont, 'Segoe UI', sans-serif"
		},
		{
			id: 'serif',
			label: 'Serif',
			family: "'Iowan Old Style', 'Charter', 'Georgia', serif"
		},
		{
			id: 'mono',
			label: 'Mono',
			family: "'Geist Mono Variable', 'SF Mono', 'Monaco', 'Cascadia Code', monospace"
		}
	];

	function familyForId(id: string): string {
		return FONTS.find((f) => f.id === id)?.family ?? FONTS[0].family;
	}

	const current = $derived(settingsStore.current.appearance);

	function selectTheme(id: ThemePreference): void {
		settingsStore.setTheme(id);
	}

	function selectFont(id: string): void {
		const next = settingsStore.current;
		settingsStore.set({
			...next,
			appearance: { ...next.appearance, editorFont: id }
		});
	}

	function setFontSize(value: number): void {
		const next = settingsStore.current;
		settingsStore.set({
			...next,
			appearance: { ...next.appearance, editorFontSize: value }
		});
	}

	function setLineHeight(value: number): void {
		const next = settingsStore.current;
		settingsStore.set({
			...next,
			appearance: { ...next.appearance, editorLineHeight: value }
		});
	}

	function setContentWidth(value: number): void {
		const next = settingsStore.current;
		settingsStore.set({
			...next,
			appearance: { ...next.appearance, editorContentWidth: value }
		});
	}
</script>

<div class="appearance">
	<!-- Theme cards -->
	<fieldset class="group">
		<legend>Thème</legend>
		<div class="cards">
			{#each THEMES as theme (theme.id)}
				{@const Icon = theme.icon}
				{@const isActive = current.theme === theme.id}
				<button
					type="button"
					class="theme-card"
					class:active={isActive}
					aria-pressed={isActive}
					onclick={() => selectTheme(theme.id)}
					data-testid={`appearance-theme-${theme.id}`}
				>
					<span class="theme-swatch" data-theme-preview={theme.id}>
						<Icon size={16} aria-hidden="true" focusable="false" />
					</span>
					<span class="card-label">{theme.label}</span>
					{#if isActive}
						<span class="card-check" aria-hidden="true">
							<Check size={12} focusable="false" />
						</span>
					{/if}
				</button>
			{/each}
		</div>
	</fieldset>

	<!-- Font cards (each rendered in its own typeface for visual preview) -->
	<fieldset class="group">
		<legend>Police de l'éditeur</legend>
		<div class="cards font-cards">
			{#each FONTS as font (font.id)}
				{@const isActive = current.editorFont === font.id}
				<button
					type="button"
					class="font-card"
					class:active={isActive}
					aria-pressed={isActive}
					onclick={() => selectFont(font.id)}
					style:font-family={font.family}
					data-testid={`appearance-font-${font.id}`}
				>
					<span class="card-label">{font.label}</span>
					{#if isActive}
						<span class="card-check" aria-hidden="true">
							<Check size={12} focusable="false" />
						</span>
					{/if}
				</button>
			{/each}
		</div>
	</fieldset>

	<!-- Live preview: a single paragraph that reacts to font/size/lineHeight/
	     contentWidth in real time so the three sliders below all hit the same
	     visible sample. -->
	<div class="preview-wrap">
		<span class="preview-label">Aperçu en temps réel</span>
		<p
			class="preview"
			style:font-family={familyForId(current.editorFont)}
			style:font-size="{current.editorFontSize}px"
			style:line-height={current.editorLineHeight}
			style:max-width="{current.editorContentWidth}px"
			data-testid="appearance-preview"
		>
			L'éditeur Markdown moderne pour développeurs. Aperçu en temps réel des
			réglages d'apparence — taille de police, hauteur de ligne, largeur de
			mesure, et famille typographique. Glissez les curseurs pour voir
			l'effet immédiat sur ce paragraphe.
		</p>
	</div>

	<!-- Sliders -->
	<div class="slider-row">
		<label for="setting-fontsize">Taille de police</label>
		<span class="value">{current.editorFontSize}</span>
		<input
			id="setting-fontsize"
			type="range"
			min="14"
			max="20"
			step="1"
			value={current.editorFontSize}
			oninput={(e) => setFontSize(+e.currentTarget.value)}
			data-testid="appearance-slider-fontsize"
		/>
	</div>

	<div class="slider-row">
		<label for="setting-lineheight">Hauteur de ligne</label>
		<span class="value">{current.editorLineHeight.toFixed(2)}</span>
		<input
			id="setting-lineheight"
			type="range"
			min="1.4"
			max="1.8"
			step="0.05"
			value={current.editorLineHeight}
			oninput={(e) => setLineHeight(+e.currentTarget.value)}
			data-testid="appearance-slider-lineheight"
		/>
	</div>

	<div class="slider-row">
		<label for="setting-contentwidth">Largeur de contenu</label>
		<span class="value">{current.editorContentWidth} px</span>
		<input
			id="setting-contentwidth"
			type="range"
			min="560"
			max="1200"
			step="20"
			value={current.editorContentWidth}
			oninput={(e) => setContentWidth(+e.currentTarget.value)}
			data-testid="appearance-slider-contentwidth"
		/>
	</div>
</div>

<style>
	.appearance {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
	}

	.group {
		border: none;
		padding: 0;
		margin: 0;
	}

	.group legend {
		font-size: var(--text-ui);
		font-weight: 500;
		color: var(--color-text-primary);
		padding: 0;
		margin-bottom: var(--space-3);
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
		gap: var(--space-2);
	}

	.font-cards {
		grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
	}

	.theme-card,
	.font-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-3);
		background: var(--color-surface-veil);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text-body);
		cursor: pointer;
		transition:
			background var(--duration-base) var(--easing-standard),
			border-color var(--duration-base) var(--easing-standard),
			color var(--duration-base) var(--easing-standard);
	}

	.card-label {
		font-size: var(--text-caption);
		font-family: var(--font-ui);
	}

	.font-card .card-label {
		/* The font-card preview swaps in the font's own family so each label
		   renders in its target typeface. The label text size is bumped to
		   --text-ui to keep the typographic differences readable. */
		font-family: inherit;
		font-size: var(--text-ui);
	}

	.theme-card:hover,
	.font-card:hover {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}

	.theme-card.active,
	.font-card.active {
		border-color: var(--color-accent);
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}

	.theme-card:focus-visible,
	.font-card:focus-visible {
		outline: none;
		border-color: var(--color-accent);
		box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-accent) 40%, transparent);
	}

	.theme-swatch {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 56px;
		height: 36px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border);
	}

	/* Theme preview swatches hardcode the actual theme bg colors so the
	   card is a faithful mini-preview regardless of the app's current theme. */
	.theme-swatch[data-theme-preview='dark'] {
		background: #0a0908;
		color: #e8e6e0;
	}

	.theme-swatch[data-theme-preview='light'] {
		background: #faf9f6;
		color: #1a1a17;
	}

	.theme-swatch[data-theme-preview='system'] {
		/* Diagonal split conveys "follow the OS preference". */
		background: linear-gradient(135deg, #0a0908 50%, #faf9f6 50%);
		color: var(--color-text-primary);
	}

	.card-check {
		position: absolute;
		top: 6px;
		right: 6px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--color-accent);
		color: var(--color-accent-fg);
	}

	.preview-wrap {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-4);
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.preview-label {
		font-size: var(--text-caption);
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.preview {
		margin: 0;
		color: var(--color-text-primary);
		/* font-family / size / line-height / max-width set inline */
	}

	.slider-row {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		gap: var(--space-2) var(--space-3);
	}

	.slider-row label {
		font-size: var(--text-ui);
		color: var(--color-text-primary);
	}

	.slider-row .value {
		font-family: var(--font-mono);
		font-size: var(--text-caption);
		color: var(--color-text-muted);
	}

	.slider-row input[type='range'] {
		grid-column: 1 / -1;
		width: 100%;
		margin: 0;
		-webkit-appearance: none;
		appearance: none;
		height: 4px;
		background: var(--color-border-subtle);
		border-radius: var(--radius-pill);
		outline: none;
	}

	.slider-row input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--color-accent);
		cursor: pointer;
		border: 2px solid var(--color-bg-raised);
	}

	.slider-row input[type='range']::-moz-range-thumb {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--color-accent);
		cursor: pointer;
		border: 2px solid var(--color-bg-raised);
	}

	.slider-row input[type='range']:focus-visible {
		box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-accent) 40%, transparent);
	}
</style>
