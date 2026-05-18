<script lang="ts">
	import { settingsStore } from '$lib/stores/settings.svelte';
	import ThemePicker from './ThemePicker.svelte';

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

	// Typography goes through a draft → Apply flow (the editor only
	// re-renders on commit). Draft initializes from the store at mount;
	// `stored` is the live applied value used to compute `isDirty`.
	const initial = settingsStore.current.appearance;
	let draftFont = $state<string>(initial.editorFont);
	let draftFontSize = $state<number>(initial.editorFontSize);
	let draftLineHeight = $state<number>(initial.editorLineHeight);
	let draftContentWidth = $state<number>(initial.editorContentWidth);

	const stored = $derived(settingsStore.current.appearance);
	const isDirty = $derived(
		draftFont !== stored.editorFont ||
			draftFontSize !== stored.editorFontSize ||
			draftLineHeight !== stored.editorLineHeight ||
			draftContentWidth !== stored.editorContentWidth
	);

	function applyTypography(): void {
		const next = settingsStore.current;
		settingsStore.set({
			...next,
			appearance: {
				...next.appearance,
				editorFont: draftFont,
				editorFontSize: draftFontSize,
				editorLineHeight: draftLineHeight,
				editorContentWidth: draftContentWidth
			}
		});
	}
</script>

<div class="settings-section">
	<!-- Theme group — mode selector + 2-slot picker with mini previews -->
	<section class="settings-group" aria-labelledby="group-theme">
		<h4 class="settings-group-label" id="group-theme">Thème</h4>
		<ThemePicker />
	</section>

	<!-- Typography group -->
	<section class="settings-group" aria-labelledby="group-typography">
		<h4 class="settings-group-label" id="group-typography">Typographie</h4>

		<div class="settings-row">
			<div class="settings-row-info">
				<span class="settings-row-label">Police de l'éditeur</span>
				<span class="settings-row-desc"
					>Typographie appliquée au texte du document.</span
				>
			</div>
			<div
				class="settings-segmented font-segmented"
				role="radiogroup"
				aria-label="Sélectionner la police"
			>
				{#each FONTS as font (font.id)}
					{@const isActive = draftFont === font.id}
					<button
						type="button"
						class="settings-segment"
						class:active={isActive}
						role="radio"
						aria-checked={isActive}
						onclick={() => (draftFont = font.id)}
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
					>Taille de police (px)</label
				>
				<span class="settings-row-desc">Entre 14 et 20 pixels.</span>
			</div>
			<div class="settings-numfield">
				<input
					id="setting-fontsize"
					type="number"
					min="14"
					max="20"
					step="1"
					value={draftFontSize}
					oninput={(e) => (draftFontSize = +e.currentTarget.value)}
					data-testid="appearance-field-fontsize"
				/>
			</div>
		</div>

		<div class="settings-row">
			<div class="settings-row-info">
				<label for="setting-lineheight" class="settings-row-label"
					>Hauteur de ligne</label
				>
				<span class="settings-row-desc">Espace vertical entre les lignes.</span>
			</div>
			<div class="settings-numfield">
				<input
					id="setting-lineheight"
					type="number"
					min="1.4"
					max="1.8"
					step="0.05"
					value={draftLineHeight.toFixed(2)}
					oninput={(e) => (draftLineHeight = +e.currentTarget.value)}
					data-testid="appearance-field-lineheight"
				/>
			</div>
		</div>

		<div class="settings-row">
			<div class="settings-row-info">
				<label for="setting-contentwidth" class="settings-row-label"
					>Largeur de contenu (%)</label
				>
				<span class="settings-row-desc">Largeur maximale du texte (mesure).</span>
			</div>
			<div class="settings-numfield">
				<input
					id="setting-contentwidth"
					type="number"
					min="30"
					max="100"
					step="2"
					value={draftContentWidth}
					oninput={(e) => (draftContentWidth = +e.currentTarget.value)}
					data-testid="appearance-field-contentwidth"
				/>
			</div>
		</div>
	</section>

	<!-- Preview + Apply group — preview reflects the draft so users can see
	     the result before committing. The editor itself only updates when
	     Apply is clicked. -->
	<section class="settings-group" aria-labelledby="group-preview">
		<div class="preview-header">
			<h4 class="settings-group-label" id="group-preview">Aperçu</h4>
			<button
				type="button"
				class="apply-button"
				onclick={applyTypography}
				disabled={!isDirty}
				data-testid="appearance-apply"
			>
				Appliquer
			</button>
		</div>
		<p
			class="preview"
			style:font-family={familyForId(draftFont)}
			style:font-size="{draftFontSize}px"
			style:line-height={draftLineHeight}
			style:max-width="{draftContentWidth}%"
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

	/* Aperçu header — group title left, Apply button right. */
	.preview-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}

	/* Apply button — primary CTA, accent-tinted, disabled when draft
	   matches stored. Compact enough to sit inline with the group label. */
	.apply-button {
		padding: 5px 14px;
		background: var(--color-accent);
		color: var(--color-accent-fg);
		font-family: var(--font-ui);
		font-size: var(--text-ui);
		font-weight: var(--weight-medium);
		border: 1px solid var(--color-accent);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition:
			background var(--duration-base) var(--easing-standard),
			border-color var(--duration-base) var(--easing-standard),
			opacity var(--duration-base) var(--easing-standard);
	}

	.apply-button:hover:not(:disabled) {
		background: var(--color-accent-hover);
		border-color: var(--color-accent-hover);
	}

	.apply-button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.apply-button:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-accent) 40%, transparent);
	}

	/* Number-field cluster — used for fontsize / lineheight / contentwidth.
	   Fixed input width across all rows so they align vertically. The unit
	   lives in the row label (e.g. "Taille de police (px)"), not next to
	   the field. */
	.settings-numfield {
		display: inline-flex;
		align-items: center;
	}

	.settings-numfield input[type='number'] {
		width: 64px;
		padding: 4px 8px;
		background: var(--color-bg);
		color: var(--color-text-primary);
		font-family: var(--font-ui);
		font-size: var(--text-ui);
		font-variant-numeric: tabular-nums;
		text-align: right;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		outline: none;
		transition:
			border-color var(--duration-base) var(--easing-standard),
			box-shadow var(--duration-base) var(--easing-standard);
	}

	.settings-numfield input[type='number']:hover {
		border-color: var(--color-border-strong);
	}

	.settings-numfield input[type='number']:focus-visible {
		border-color: var(--color-accent);
		box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-accent) 35%, transparent);
	}

	/* Hide the native spinners — they steal width and look misaligned. */
	.settings-numfield input[type='number']::-webkit-inner-spin-button,
	.settings-numfield input[type='number']::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.settings-numfield input[type='number'] {
		-moz-appearance: textfield;
		appearance: textfield;
	}
</style>
