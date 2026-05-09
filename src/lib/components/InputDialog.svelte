<script lang="ts">
	let {
		open = false,
		title = '',
		placeholder = '',
		defaultValue = '',
		submitLabel = 'OK',
		onSubmit = (_: string) => {},
		onCancel = () => {}
	}: {
		open?: boolean;
		title?: string;
		placeholder?: string;
		defaultValue?: string;
		submitLabel?: string;
		onSubmit?: (value: string) => void | Promise<void>;
		onCancel?: () => void;
	} = $props();

	let value = $state('');
	let busy = $state(false);
	let error = $state<string | null>(null);
	let inputEl: HTMLInputElement | null = $state(null);

	$effect(() => {
		if (open) {
			value = defaultValue;
			busy = false;
			error = null;
			// Focus on next tick.
			queueMicrotask(() => inputEl?.focus());
		}
	});

	const canSubmit = $derived(value.trim().length > 0 && !busy);

	async function submit(e?: SubmitEvent) {
		e?.preventDefault();
		if (!canSubmit) return;
		error = null;
		busy = true;
		try {
			await onSubmit(value.trim());
		} catch (err) {
			error = String(err);
			busy = false;
		}
	}
</script>

{#if open}
	<div class="backdrop" role="dialog" aria-modal="true" aria-label={title}>
		<form class="dialog panel" onsubmit={submit}>
			<h2>{title}</h2>
			<input
				bind:this={inputEl}
				bind:value={value}
				type="text"
				class="text-input"
				{placeholder}
			/>
			{#if error}
				<p class="error" role="alert">{error}</p>
			{/if}
			<div class="actions">
				<button type="button" class="button" onclick={onCancel} disabled={busy}>
					Annuler
				</button>
				<button
					type="submit"
					class="button button--primary"
					disabled={!canSubmit}
				>
					{busy ? '…' : submitLabel}
				</button>
			</div>
		</form>
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

	.text-input {
		padding: 8px var(--space-3);
		background: var(--color-surface-veil);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		color: var(--color-text-primary);
		font-family: inherit;
		font-size: var(--text-ui);
	}

	.text-input:focus {
		outline: none;
		border-color: var(--color-accent);
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
</style>
