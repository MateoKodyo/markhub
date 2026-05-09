<script lang="ts">
	// Inline input that drops into the file tree at the insertion target.
	// Different from `InputDialog`: no backdrop, no modal — it's an in-flow input
	// that captures focus, validates on Enter, cancels on Escape or blur.

	let {
		placeholder = '',
		defaultValue = '',
		indentPx = 0,
		onSubmit = (_: string) => {},
		onCancel = () => {}
	}: {
		placeholder?: string;
		defaultValue?: string;
		/** Padding-left in px applied to the input row, mirrors tree depth. */
		indentPx?: number;
		onSubmit?: (value: string) => void | Promise<void>;
		onCancel?: () => void;
	} = $props();

	// svelte-ignore state_referenced_locally
	let value = $state(defaultValue);
	let inputEl: HTMLInputElement | null = $state(null);
	let busy = $state(false);

	// Auto-focus on mount.
	$effect(() => {
		if (inputEl) inputEl.focus();
	});

	async function submit() {
		const trimmed = value.trim();
		if (trimmed.length === 0 || busy) return;
		busy = true;
		try {
			await onSubmit(trimmed);
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
		{placeholder}
		onkeydown={onKeyDown}
		onblur={onBlur}
		spellcheck="false"
		autocapitalize="off"
		autocomplete="off"
	/>
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
</style>
