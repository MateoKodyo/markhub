<script lang="ts">
	import { settingsStore } from '$lib/stores/settings.svelte';

	const current = $derived(settingsStore.current.behavior);

	function setAskBeforeClosing(value: boolean): void {
		const next = settingsStore.current;
		settingsStore.set({
			...next,
			behavior: { ...next.behavior, askBeforeClosingUnsaved: value }
		});
	}
</script>

<div class="settings-section">
	<section class="settings-group" aria-labelledby="group-behavior-unsaved">
		<h4 class="settings-group-label" id="group-behavior-unsaved">Édition</h4>

		<div class="settings-row">
			<div class="settings-row-info">
				<span class="settings-row-label" id="ask-unsaved-label"
					>Demander avant de quitter un fichier modifié</span
				>
				<span class="settings-row-desc"
					>Forcer l'enregistrement avant d'ouvrir un autre fichier si le fichier
					courant n'a pas encore été sauvegardé automatiquement.</span
				>
			</div>
			<button
				type="button"
				class="settings-switch"
				role="switch"
				aria-checked={current.askBeforeClosingUnsaved}
				aria-labelledby="ask-unsaved-label"
				onclick={() =>
					setAskBeforeClosing(!current.askBeforeClosingUnsaved)}
				data-testid="behavior-toggle-ask-unsaved"
			>
				<span class="settings-switch-thumb"></span>
			</button>
		</div>
	</section>
</div>
