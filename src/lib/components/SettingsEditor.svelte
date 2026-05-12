<script lang="ts">
	import { settingsStore } from '$lib/stores/settings.svelte';

	const current = $derived(settingsStore.current.editor);

	/**
	 * Format the autosave delay for the value chip. Below 1s we keep the
	 * "ms" suffix for precision; above 1s we collapse to a tidy decimal
	 * with the "s" suffix ("1.5 s", "3 s").
	 */
	const autosaveLabel = $derived.by(() => {
		const ms = current.autosaveDelayMs;
		if (ms >= 1000) {
			const seconds = ms / 1000;
			const formatted = seconds.toFixed(1).replace(/\.0$/, '');
			return `${formatted} s`;
		}
		return `${ms} ms`;
	});

	function setAutosave(value: number): void {
		const next = settingsStore.current;
		settingsStore.set({
			...next,
			editor: { ...next.editor, autosaveDelayMs: value }
		});
	}

	function setSpellCheck(value: boolean): void {
		const next = settingsStore.current;
		settingsStore.set({
			...next,
			editor: { ...next.editor, spellCheck: value }
		});
	}
</script>

<div class="settings-section">
	<!-- Autosave -->
	<section class="settings-group" aria-labelledby="group-autosave">
		<h4 class="settings-group-label" id="group-autosave">Sauvegarde</h4>

		<div class="settings-row">
			<div class="settings-row-info">
				<label for="setting-autosave" class="settings-row-label"
					>Délai d'enregistrement</label
				>
				<span class="settings-row-desc"
					>Temps d'inactivité avant l'enregistrement automatique du fichier
					ouvert.</span
				>
			</div>
			<div class="settings-slider">
				<input
					id="setting-autosave"
					type="range"
					min="500"
					max="5000"
					step="100"
					value={current.autosaveDelayMs}
					oninput={(e) => setAutosave(+e.currentTarget.value)}
					data-testid="editor-slider-autosave"
				/>
				<span class="value">{autosaveLabel}</span>
			</div>
		</div>
	</section>

	<!-- Input behaviour -->
	<section class="settings-group" aria-labelledby="group-input">
		<h4 class="settings-group-label" id="group-input">Saisie</h4>

		<div class="settings-row">
			<div class="settings-row-info">
				<span class="settings-row-label" id="spellcheck-label"
					>Correction orthographique</span
				>
				<span class="settings-row-desc"
					>Souligner les fautes d'orthographe dans l'éditeur.</span
				>
			</div>
			<button
				type="button"
				class="settings-switch"
				role="switch"
				aria-checked={current.spellCheck}
				aria-labelledby="spellcheck-label"
				onclick={() => setSpellCheck(!current.spellCheck)}
				data-testid="editor-toggle-spellcheck"
			>
				<span class="settings-switch-thumb"></span>
			</button>
		</div>
	</section>
</div>
