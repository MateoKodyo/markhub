<script lang="ts">
	import type { Vault } from '$lib/tauri/types';

	let {
		vaults = [],
		activeVaultId = null,
		onSelect = () => {},
		onContextMenu = () => {}
	}: {
		vaults?: Vault[];
		activeVaultId?: string | null;
		onSelect?: (id: string) => void;
		onContextMenu?: (vault: Vault, x: number, y: number) => void;
	} = $props();

	function handleContextMenu(e: MouseEvent, v: Vault) {
		e.preventDefault();
		e.stopPropagation();
		onContextMenu(v, e.clientX, e.clientY);
	}
</script>

<ul class="vault-list" role="list">
	{#each vaults as v (v.id)}
		<li
			data-testid="vault-item"
			class="vault-item"
			class:is-active={v.id === activeVaultId}
		>
			<button
				type="button"
				class="vault-row list-item"
				class:is-active={v.id === activeVaultId}
				onclick={() => onSelect(v.id)}
				oncontextmenu={(e) => handleContextMenu(e, v)}
			>
				<span
					data-testid="vault-color-dot"
					data-color={v.color}
					class="dot"
					style="background-color: {v.color}"
				></span>
				<span class="name">{v.name}</span>
				{#if v.mode === 'readonly'}
					<span class="lock" aria-label="Lecture seule" title="Lecture seule">🔒</span>
				{/if}
			</button>
		</li>
	{/each}
</ul>

<style>
	.vault-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.vault-item {
		list-style: none;
	}

	.vault-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		padding: 6px var(--space-3);
		min-height: 28px;
		border: 0;
		background: transparent;
		font-family: inherit;
		text-align: left;
		cursor: pointer;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
		display: inline-block;
	}

	.name {
		flex: 1;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-size: var(--text-ui);
	}

	.lock {
		color: var(--color-text-secondary);
		font-size: var(--text-caption);
		flex-shrink: 0;
	}
</style>
