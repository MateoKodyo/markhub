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
	 * The selected `id` is what lands in `settings.json`; the `family`
	 * stack is resolved on the frontend (here + the editor consumer).
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

<div class="settings-section">
	<!-- Theme group -->
	<section class="settings-group" aria-labelledby="group-theme">
		<h4 class="settings-group-label" id="group-theme">Thème</h4>

		<div class="settings-row">
			<div class="settings-row-info">
				<span class="settings-row-label">Apparence générale</span>
				<span class="settings-row-desc"
					>Sombre, clair, ou suivre la préférence système.</span
				>
			</div>
			<div
				class="settings-segmented"
				role="radiogroup"
				aria-label="Sélectionner le thème"
			>
				{#each THEMES as theme (theme.id)}
					{@const Icon = theme.icon}
					{@const isActive = current.theme === theme.id}
					<button
						type="button"
						class="settings-segment"
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
	<section class="settings-group" aria-labelledby="group-typography">
		<h4 class="settings-group-label" id="group-typography">Typographie</h4>

		<div class="settings-row">
			<div class="settings-row-info">
				<span class="settings-row-label">Police de l'éditeur</span>
				<span class="settings-row-desc"
					>Famille typographique appliquée au texte du document.</span
				>
			</div>
			<div
				class="settings-segmented font-segmented"
				role="radiogroup"
				aria-label="Sélectionner la police"
			>
				{#each FONTS as font (font.id)}
					{@const isActive = current.editorFont === font.id}
					<button
						type="button"
						class="settings-segment"
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

		<div class="settings-row">
			<div class="settings-row-info">
				<label for="setting-fontsize" class="settings-row-label"
					>Taille de police</label
				>
				<span class="settings-row-desc">Entre 14 et 20 pixels.</span>
			</div>
			<div class="settings-slider">
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

		<div class="settings-row">
			<div class="settings-row-info">
				<label for="setting-lineheight" class="settings-row-label"
					>Hauteur de ligne</label
				>
				<span class="settings-row-desc">Espace vertical entre les lignes.</span>
			</div>
			<div class="settings-slider">
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

		<div class="settings-row">
			<div class="settings-row-info">
				<label for="setting-contentwidth" class="settings-row-label"
					>Largeur de contenu</label
				>
				<span class="settings-row-desc">Largeur maximale du texte (mesure).</span>
			</div>
			<div class="settings-slider">
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
	<section class="settings-group" aria-labelledby="group-preview">
		<h4 class="settings-group-label" id="group-preview">Aperçu</h4>
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
	/* Appearance-specific extras only — base layout is in
	   `$lib/styles/settings.css` (imported by SettingsModal). */

	/* Font picker bumps the segment label size to make typographic
	   differences readable. The font family is set inline per segment. */
	:global(.font-segmented .settings-segment) {
		font-size: var(--text-ui);
		padding: 3px 11px;
	}

	.preview {
		margin: 0;
		color: var(--color-text-body);
		/* font-family / size / line-height / max-width set inline */
	}
</style>
