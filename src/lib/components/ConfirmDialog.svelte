<script lang="ts">
	let {
		open = false,
		title = '',
		message = '',
		confirmLabel = 'Confirmer',
		danger = false,
		onConfirm = () => {},
		onCancel = () => {}
	}: {
		open?: boolean;
		title?: string;
		message?: string;
		confirmLabel?: string;
		danger?: boolean;
		onConfirm?: () => void | Promise<void>;
		onCancel?: () => void;
	} = $props();

	let busy = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		if (open) {
			busy = false;
			error = null;
		}
	});

	async function confirm() {
		busy = true;
		error = null;
		try {
			await onConfirm();
		} catch (e) {
			error = String(e);
			busy = false;
		}
	}
</script>

{#if open}
	<div class="backdrop" role="dialog" aria-modal="true" aria-label={title}>
		<div class="dialog panel">
			<h2>{title}</h2>
			<p class="message">{message}</p>
			{#if error}
				<p class="error" role="alert">{error}</p>
			{/if}
			<div class="actions">
				<button type="button" class="button" onclick={onCancel} disabled={busy}>
					Annuler
				</button>
				<button
					type="button"
					class="button"
					class:button--primary={!danger}
					class:is-danger={danger}
					onclick={confirm}
					disabled={busy}
				>
					{busy ? '…' : confirmLabel}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 150;
	}

	.dialog {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		width: min(440px, 90vw);
		padding: var(--space-5);
		background: var(--color-bg-raised);
	}

	h2 {
		font-size: var(--text-heading);
		letter-spacing: var(--tracking-heading);
	}

	.message {
		font-size: var(--text-ui);
		color: var(--color-text-body);
	}

	.error {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		background: rgba(248, 113, 113, 0.08);
		border: 1px solid rgba(248, 113, 113, 0.25);
		border-radius: var(--radius-sm);
		color: var(--color-status-error);
		font-size: var(--text-caption);
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
	}

	.is-danger {
		background: var(--color-status-error);
		color: white;
		border-color: transparent;
	}

	.is-danger:hover:not(:disabled) {
		background: #f55a5a;
	}
</style>
