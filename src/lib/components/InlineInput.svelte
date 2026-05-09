<script lang="ts">
	// Inline input that drops into the file tree at the insertion target.
	// Different from `InputDialog`: no backdrop, no modal — it's an in-flow input
	// that captures focus, validates on Enter, cancels on Escape or blur.
	// Used for both creation (empty defaultValue) and rename (defaultValue =
	// existing name, with optional selectionRange to skip the extension).

	let {
		placeholder = '',
		defaultValue = '',
		indentPx = 0,
		/** [start, end] of the selection applied at focus. If null, select all. */
		selectionRange = null,
		errorMessage = null,
		onSubmit = (_: string) => {},
		onCancel = () => {}
	}: {
		placeholder?: string;
		defaultValue?: string;
		indentPx?: number;
		selectionRange?: [number, number] | null;
		/** Optional error from the parent (e.g. name conflict from server). */
		errorMessage?: string | null;
		onSubmit?: (value: string) => void | Promise<void>;
		onCancel?: () => void;
	} = $props();

	// svelte-ignore state_referenced_locally
	let value = $state(defaultValue);
	let inputEl: HTMLInputElement | null = $state(null);
	let busy = $state(false);
	let internalError = $state<string | null>(null);
	const displayError = $derived(internalError ?? errorMessage);

	// Auto-focus + selection on mount.
	$effect(() => {
		if (!inputEl) return;
		inputEl.focus();
		if (selectionRange) {
			const [start, end] = selectionRange;
			try {
				inputEl.setSelectionRange(start, end);
			} catch {
				inputEl.select();
			}
		} else {
			inputEl.select();
		}
	});

	async function submit() {
		const trimmed = value.trim();
		if (trimmed.length === 0 || busy) return;
		busy = true;
		internalError = null;
		try {
			await onSubmit(trimmed);
		} catch (e) {
			internalError = String(e);
		} finally {
			busy = false;
		}
	}

	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			void submit();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			onCancel();
		}
	}

	function onBlur() {
		// Blur cancels (matches VS Code behaviour for inline rename/new).
		// Defer slightly to let click-on-confirm dispatch first if any.
		if (!busy) onCancel();
	}
</script>

<div
	class="inline-input"
	role="presentation"
	style="padding-left: {indentPx}px"
>
	<input
		bind:this={inputEl}
		bind:value
		type="text"
		class="field"
		class:has-error={!!displayError}
		{placeholder}
		onkeydown={onKeyDown}
		onblur={onBlur}
		spellcheck="false"
		autocapitalize="off"
		autocomplete="off"
		aria-invalid={!!displayError}
	/>
	{#if displayError}
		<span class="error-msg" role="alert">{displayError}</span>
	{/if}
</div>

<style>
	.inline-input {
		display: flex;
		align-items: center;
		min-height: 26px;
		padding-right: var(--space-3);
	}

	.field {
		flex: 1;
		min-width: 0;
		padding: 4px 8px;
		background: var(--color-surface-veil);
		border: 1px solid var(--color-accent);
		border-radius: var(--radius-sm);
		color: var(--color-text-primary);
		font-family: inherit;
		font-size: var(--text-ui);
		outline: none;
	}

	.field.has-error {
		border-color: var(--color-status-error);
	}

	.error-msg {
		margin-left: var(--space-2);
		font-size: var(--text-label);
		color: var(--color-status-error);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
