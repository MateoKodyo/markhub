<script lang="ts">
	/**
	 * Single toast notification row — pure presentational. Lifecycle
	 * (timer, removal) lives in `toast.svelte.ts`; this component only
	 * renders the row and exposes a dismiss button that calls back.
	 */

	import {
		AlertCircle,
		AlertTriangle,
		Check,
		Info,
		X
	} from 'lucide-svelte';
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import type { Toast } from '$lib/stores/toast.svelte';

	type Props = {
		toast: Toast;
		onDismiss: (id: number) => void;
	};

	let { toast, onDismiss }: Props = $props();

	const IconByType = {
		success: Check,
		info: Info,
		warning: AlertTriangle,
		error: AlertCircle
	} as const;

	const Icon = $derived(IconByType[toast.type]);

	const role = $derived(toast.type === 'error' ? 'alert' : 'status');
</script>

<div
	class="toast toast-{toast.type}"
	{role}
	aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
	data-testid="toast"
	data-toast-type={toast.type}
	in:fly={{ x: 16, duration: 220, easing: cubicOut }}
	out:fade={{ duration: 150, easing: cubicOut }}
>
	<span class="toast-icon" aria-hidden="true">
		<Icon size={14} strokeWidth={2} focusable="false" />
	</span>
	<div class="toast-body">
		<span class="toast-message" data-testid="toast-message">{toast.message}</span>
		{#if toast.details}
			<span class="toast-details" data-testid="toast-details">{toast.details}</span>
		{/if}
	</div>
	{#if toast.dismissible}
		<button
			type="button"
			class="toast-close"
			aria-label="Fermer la notification"
			onclick={() => onDismiss(toast.id)}
			data-testid="toast-close"
		>
			<X size={12} strokeWidth={1.5} aria-hidden="true" focusable="false" />
		</button>
	{/if}
</div>

<style>
	.toast {
		display: grid;
		grid-template-columns: 18px 1fr auto;
		align-items: start;
		gap: 10px;
		min-width: 240px;
		max-width: 360px;
		padding: 10px 12px;
		background: var(--color-bg-raised);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-md, 0 6px 24px rgba(0, 0, 0, 0.18));
		font-size: var(--text-ui);
		color: var(--color-text-primary);
	}

	.toast-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		margin-top: 1px;
		flex: 0 0 auto;
	}

	.toast-success .toast-icon {
		color: var(--color-status-ok);
	}
	.toast-info .toast-icon {
		color: var(--color-accent);
	}
	.toast-warning .toast-icon {
		color: var(--color-status-warn);
	}
	.toast-error .toast-icon {
		color: var(--color-status-error);
	}

	.toast-body {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.toast-message {
		line-height: 1.35;
		word-break: break-word;
	}

	.toast-details {
		font-size: var(--text-caption);
		color: var(--color-text-muted);
		line-height: 1.4;
		word-break: break-word;
	}

	.toast-close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		padding: 0;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-text-muted);
		cursor: pointer;
		flex: 0 0 auto;
		transition:
			background-color var(--duration-base, 160ms) var(--easing-standard, ease-out),
			color var(--duration-base, 160ms) var(--easing-standard, ease-out);
	}

	.toast-close:hover {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}
</style>
