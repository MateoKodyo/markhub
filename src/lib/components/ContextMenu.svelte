<script lang="ts">
	export type MenuItem =
		| { separator: true }
		| { header: string }
		| {
				separator?: false;
				header?: undefined;
				label: string;
				onClick: () => void;
				danger?: boolean;
				disabled?: boolean;
		  };

	let {
		x = 0,
		y = 0,
		items = [],
		onClose = () => {}
	}: {
		x?: number;
		y?: number;
		items?: MenuItem[];
		onClose?: () => void;
	} = $props();

	function handleKey(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}

	function trigger(item: Extract<MenuItem, { label: string }>) {
		if (item.disabled) return;
		item.onClick();
		onClose();
	}
</script>

<svelte:window onkeydown={handleKey} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="ctx-backdrop"
	onclick={onClose}
	oncontextmenu={(e) => {
		e.preventDefault();
		onClose();
	}}
>
	<ul
		class="ctx-menu panel"
		role="menu"
		style="left: {x}px; top: {y}px"
		onclick={(e) => e.stopPropagation()}
	>
		{#each items as item, i (i)}
			{#if 'separator' in item && item.separator}
				<li role="separator" class="ctx-sep" aria-hidden="true"></li>
			{:else if 'header' in item}
				<li role="presentation" class="ctx-header">{item.header}</li>
			{:else}
				<li role="none">
					<button
						type="button"
						class="ctx-item"
						class:is-danger={item.danger}
						disabled={item.disabled}
						onclick={() => trigger(item)}
						role="menuitem"
					>
						{item.label}
					</button>
				</li>
			{/if}
		{/each}
	</ul>
</div>

<style>
	.ctx-backdrop {
		position: fixed;
		inset: 0;
		z-index: 200;
	}

	.ctx-menu {
		position: absolute;
		min-width: 180px;
		margin: 0;
		padding: var(--space-1);
		list-style: none;
		background: var(--color-bg-raised);
		border: 1px solid var(--color-border);
	}

	.ctx-item {
		display: flex;
		align-items: center;
		width: 100%;
		padding: 6px var(--space-3);
		border: 0;
		border-radius: var(--radius-xs);
		background: transparent;
		color: var(--color-text-body);
		font-family: inherit;
		font-size: var(--text-ui);
		text-align: left;
		cursor: pointer;
	}

	.ctx-item:hover:not(:disabled) {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}

	.ctx-item:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.ctx-item.is-danger {
		color: var(--color-status-error);
	}

	.ctx-sep {
		height: 1px;
		margin: var(--space-1) 0;
		background: var(--color-border-subtle);
	}

	.ctx-header {
		padding: 6px var(--space-3) 2px;
		font-size: var(--text-label);
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		color: var(--color-text-muted);
		font-weight: var(--weight-regular);
		pointer-events: none;
	}
</style>
