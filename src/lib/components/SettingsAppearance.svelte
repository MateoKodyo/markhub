<script lang="ts">
	import { Monitor, Moon, Sun } from 'lucide-svelte';
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
			label: 'Geist',
			family: "'Geist Variable', system-ui, -apple-system, 'Helvetica Neue', sans-serif"
		},
		{
			id: 'system',
			label: 'System',
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
	<!-- Theme group -->
	<section class="group" aria-labelledby="group-theme">
		<h4 class="group-label" id="group-theme">Thème</h4>

		<div class="row">
			<div class="row-info">
				<span class="row-label">Apparence générale</span>
				<span class="row-desc">Sombre, clair, ou suivre la préférence système.</span>
			</div>
			<div
				class="segmented"
				role="radiogroup"
				aria-label="Sélectionner le thème"
			>
				{#each THEMES as theme (theme.id)}
					{@const Icon = theme.icon}
					{@const isActive = current.theme === theme.id}
					<button
						type="button"
						class="segment"
						class:active={isActive}
						role="radio"
						aria-checked={isActive}
						onclick={() => selectTheme(theme.id)}
						data-testid={`appearance-theme-${theme.id}`}
					>
						<Icon size={13} aria-hidden="true" focusable="false" />
						<span>{theme.label}</span>
					</button>
				{/each}
			</div>
		</div>
	</section>

	<!-- Typography group -->
	<section class="group" aria-labelledby="group-typography">
		<h4 class="group-label" id="group-typography">Typographie</h4>

		<div class="row">
			<div class="row-info">
				<span class="row-label">Police de l'éditeur</span>
				<span class="row-desc"
					>Famille typographique appliquée au texte du document.</span
				>
			</div>
			<div
				class="segmented font-segmented"
				role="radiogroup"
				aria-label="Sélectionner la police"
			>
				{#each FONTS as font (font.id)}
					{@const isActive = current.editorFont === font.id}
					<button
						type="button"
						class="segment"
						class:active={isActive}
						role="radio"
						aria-checked={isActive}
						onclick={() => selectFont(font.id)}
						style:font-family={font.family}
						data-testid={`appearance-font-${font.id}`}
					>
						<span>{font.label}</span>
					</button>
				{/each}
			</div>
		</div>

		<div class="row">
			<div class="row-info">
				<label for="setting-fontsize" class="row-label">Taille de police</label>
				<span class="row-desc">Entre 14 et 20 pixels.</span>
			</div>
			<div class="slider-control">
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
				<span class="value">{current.editorFontSize}</span>
			</div>
		</div>

		<div class="row">
			<div class="row-info">
				<label for="setting-lineheight" class="row-label">Hauteur de ligne</label>
				<span class="row-desc">Espace vertical entre les lignes.</span>
			</div>
			<div class="slider-control">
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
				<span class="value">{current.editorLineHeight.toFixed(2)}</span>
			</div>
		</div>

		<div class="row">
			<div class="row-info">
				<label for="setting-contentwidth" class="row-label">Largeur de contenu</label>
				<span class="row-desc">Largeur maximale du texte (mesure).</span>
			</div>
			<div class="slider-control">
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
				<span class="value">{current.editorContentWidth} px</span>
			</div>
		</div>
	</section>

	<!-- Live preview group -->
	<section class="group" aria-labelledby="group-preview">
		<h4 class="group-label" id="group-preview">Aperçu</h4>
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
			mesure, et famille typographique. Glissez les curseurs pour voir l'effet
			immédiat sur ce paragraphe.
		</p>
	</section>
</div>

<style>
	/* ──────────────────────────────────────────────────────────────────
	 * Flat layout — no box-in-box. The modal's surface IS the canvas;
	 * the appearance section just rhythms rows on top of it.
	 * Warm-dark Warp aesthetic: thin hairline separators, generous
	 * vertical breathing, group labels in muted caption uppercase.
	 * ────────────────────────────────────────────────────────────────── */

	.appearance {
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}

	/* ─── Group ─── */
	.group {
		display: flex;
		flex-direction: column;
	}

	.group-label {
		font-size: var(--text-caption);
		font-weight: 500;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		margin: 0 0 var(--space-3);
	}

	/* ─── Row (flat, separated by hairline) ─── */
	.row {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-3) 0;
		min-height: 44px;
	}

	.row + .row {
		border-top: 1px solid var(--color-border-subtle);
	}

	.row-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.row-label {
		font-size: var(--text-ui);
		color: var(--color-text-primary);
		font-weight: 500;
		line-height: 1.3;
	}

	.row-desc {
		font-size: var(--text-caption);
		color: var(--color-text-muted);
		line-height: 1.4;
	}

	/* ─── Segmented control (theme + font picker) ─── */
	.segmented {
		display: inline-flex;
		gap: 1px;
		padding: 2px;
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
	}

	.segment {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 3px 9px;
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--radius-xs);
		color: var(--color-text-body);
		font-family: var(--font-ui);
		font-size: var(--text-caption);
		line-height: 1.2;
		cursor: pointer;
		transition:
			background var(--duration-base) var(--easing-standard),
			color var(--duration-base) var(--easing-standard);
	}

	.segment:hover {
		color: var(--color-text-primary);
		background: var(--color-surface-hover);
	}

	.segment.active {
		background: var(--color-bg-raised);
		color: var(--color-text-primary);
	}

	.segment:focus-visible {
		outline: none;
		border-color: var(--color-accent);
		box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-accent) 40%, transparent);
	}

	/* Font picker preserves its label-size but inherits its own
	   font-family for visual preview (set inline on each segment). */
	.font-segmented .segment {
		font-size: var(--text-ui);
		padding: 3px 11px;
	}

	/* ─── Slider control ─── */
	.slider-control {
		display: inline-flex;
		align-items: center;
		gap: var(--space-3);
	}

	.slider-control .value {
		font-family: var(--font-mono);
		font-size: var(--text-caption);
		color: var(--color-text-muted);
		min-width: 52px;
		text-align: right;
	}

	.slider-control input[type='range'] {
		width: 160px;
		margin: 0;
		-webkit-appearance: none;
		appearance: none;
		height: 3px;
		background: var(--color-border-strong);
		border-radius: var(--radius-pill);
		outline: none;
	}

	.slider-control input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 13px;
		height: 13px;
		border-radius: 50%;
		background: var(--color-accent);
		cursor: pointer;
		border: 2px solid var(--color-bg-raised);
		transition: transform var(--duration-base) var(--easing-standard);
	}

	.slider-control input[type='range']:hover::-webkit-slider-thumb {
		transform: scale(1.1);
	}

	.slider-control input[type='range']::-moz-range-thumb {
		width: 13px;
		height: 13px;
		border-radius: 50%;
		background: var(--color-accent);
		cursor: pointer;
		border: 2px solid var(--color-bg-raised);
	}

	.slider-control input[type='range']:focus-visible {
		box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-accent) 40%, transparent);
	}

	/* ─── Preview (no row container — sits directly under group label) ─── */
	.preview {
		margin: 0;
		color: var(--color-text-body);
		/* font-family / size / line-height / max-width set inline */
	}
</style>
