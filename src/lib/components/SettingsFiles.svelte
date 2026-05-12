<script lang="ts">
	import { settingsStore } from '$lib/stores/settings.svelte';

	const current = $derived(settingsStore.current.files);

	function setConfirmDelete(value: boolean): void {
		const next = settingsStore.current;
		settingsStore.set({
			...next,
			files: { ...next.files, confirmDelete: value }
		});
	}
</script>

<div class="settings-section">
	<section class="settings-group" aria-labelledby="group-files-delete">
		<h4 class="settings-group-label" id="group-files-delete">Suppression</h4>

		<div class="settings-row">
			<div class="settings-row-info">
				<span class="settings-row-label" id="confirm-delete-label"
					>Confirmer avant suppression</span
				>
				<span class="settings-row-desc"
					>Afficher une boîte de dialogue avant de supprimer définitivement un
					fichier ou un dossier. Recommandé.</span
				>
			</div>
			<button
				type="button"
				class="settings-switch"
				role="switch"
				aria-checked={current.confirmDelete}
				aria-labelledby="confirm-delete-label"
				onclick={() => setConfirmDelete(!current.confirmDelete)}
				data-testid="files-toggle-confirm-delete"
			>
				<span class="settings-switch-thumb"></span>
			</button>
		</div>
	</section>
</div>
