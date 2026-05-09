<script lang="ts">
	export type EditorCommand =
		| 'bold'
		| 'italic'
		| 'code'
		| 'h1'
		| 'h2'
		| 'h3'
		| 'link';

	let {
		readonly = false,
		onCommand = (_: EditorCommand) => {}
	}: {
		readonly?: boolean;
		onCommand?: (cmd: EditorCommand) => void;
	} = $props();

	const buttons: Array<{ cmd: EditorCommand; label: string; ariaLabel: string }> = [
		{ cmd: 'bold', label: 'B', ariaLabel: 'Bold' },
		{ cmd: 'italic', label: 'I', ariaLabel: 'Italic' },
		{ cmd: 'code', label: '</>', ariaLabel: 'Code' },
		{ cmd: 'h1', label: 'H1', ariaLabel: 'H1' },
		{ cmd: 'h2', label: 'H2', ariaLabel: 'H2' },
		{ cmd: 'h3', label: 'H3', ariaLabel: 'H3' },
		{ cmd: 'link', label: '🔗', ariaLabel: 'Lien' }
	];
</script>

<div class="toolbar" role="toolbar" aria-label="Style">
	{#each buttons as b (b.cmd)}
		<button
			type="button"
			class="tb-btn"
			class:tb-italic={b.cmd === 'italic'}
			class:tb-bold={b.cmd === 'bold'}
			disabled={readonly}
			aria-label={b.ariaLabel}
			title={b.ariaLabel}
			onclick={() => onCommand(b.cmd)}
		>
			{b.label}
		</button>
	{/each}
</div>

<style>
	.toolbar {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: var(--space-1) var(--space-2);
		background: var(--color-surface-veil);
		border: 1px solid var(--color-border-subtle);
		border-radius: var(--radius-md);
	}

	.tb-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 28px;
		height: 26px;
		padding: 0 6px;
		border: 0;
		border-radius: var(--radius-xs);
		background: transparent;
		color: var(--color-text-body);
		font-family: var(--font-sans);
		font-size: var(--text-caption);
		cursor: pointer;
	}

	.tb-btn:hover:not(:disabled) {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}

	.tb-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.tb-bold {
		font-weight: var(--weight-medium);
	}

	.tb-italic {
		font-style: italic;
	}
</style>
