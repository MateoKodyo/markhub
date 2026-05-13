<script lang="ts">
	/**
	 * Bottom-right column of toasts, sitting above the status bar so a
	 * burst of save/delete notifications can never hide the save status.
	 *
	 * The container itself doesn't own any state — it just reads the
	 * toast store and routes click-to-dismiss back through it.
	 */

	import Toast from './Toast.svelte';
	import { toast } from '$lib/stores/toast.svelte';
</script>

<div
	class="toast-container"
	aria-label="Notifications"
	data-testid="toast-container"
>
	{#each toast.toasts as t (t.id)}
		<Toast toast={t} onDismiss={(id) => toast.dismiss(id)} />
	{/each}
</div>

<style>
	.toast-container {
		position: fixed;
		bottom: 40px; /* status bar (~28px) + 12px gap above it */
		right: 16px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		z-index: 250;
		/* The container itself is non-interactive; toasts inside re-enable
		   pointer events so click-to-dismiss works. Without this, a toast
		   stack would intercept clicks on the editor area below. */
		pointer-events: none;
	}

	.toast-container :global(.toast) {
		pointer-events: auto;
	}
</style>
