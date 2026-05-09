<script lang="ts">
	import {
		Bold,
		Code,
		Heading1,
		Heading2,
		Heading3,
		Italic,
		Link
	} from 'lucide-svelte';

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

	// `icon` is a Lucide component; its type signature isn't compatible with
	// Svelte's `Component<...>` so we type it loosely. Render still works.
	const buttons: Array<{ cmd: EditorCommand; icon: typeof Bold; ariaLabel: string }> = [
		{ cmd: 'bold', icon: Bold, ariaLabel: 'Bold' },
		{ cmd: 'italic', icon: Italic, ariaLabel: 'Italic' },
		{ cmd: 'code', icon: Code, ariaLabel: 'Code' },
		{ cmd: 'h1', icon: Heading1, ariaLabel: 'H1' },
		{ cmd: 'h2', icon: Heading2, ariaLabel: 'H2' },
		{ cmd: 'h3', icon: Heading3, ariaLabel: 'H3' },
		{ cmd: 'link', icon: Link, ariaLabel: 'Lien' }
	];
</script>

<div class="toolbar" role="toolbar" aria-label="Style">
	{#each buttons as b (b.cmd)}
		{@const Icon = b.icon}
		<button
			type="button"
			class="tb-btn"
			disabled={readonly}
			aria-label={b.ariaLabel}
			title={b.ariaLabel}
			onclick={() => onCommand(b.cmd)}
		>
			<Icon size={14} />
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
		min-width: 26px;
		height: 26px;
		padding: 0 5px;
		border: 0;
		border-radius: var(--radius-xs);
		background: transparent;
		color: var(--color-text-body);
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
</style>
