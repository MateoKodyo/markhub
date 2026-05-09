<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { FileEntry } from '$lib/tauri/types';

	export type TreeContext =
		| { kind: 'file'; entry: FileEntry }
		| { kind: 'directory'; entry: FileEntry }
		| { kind: 'root' };

	let {
		root = null,
		filter = '',
		onFileClick = () => {},
		onContextMenu = () => {}
	}: {
		root?: FileEntry | null;
		filter?: string;
		onFileClick?: (relativePath: string) => void;
		onContextMenu?: (ctx: TreeContext, x: number, y: number) => void;
	} = $props();

	const expanded = new SvelteSet<string>();

	function toggle(rel: string) {
		if (expanded.has(rel)) expanded.delete(rel);
		else expanded.add(rel);
	}

	function onEntryContextMenu(e: MouseEvent, entry: FileEntry) {
		e.preventDefault();
		e.stopPropagation();
		onContextMenu(
			entry.isDirectory ? { kind: 'directory', entry } : { kind: 'file', entry },
			e.clientX,
			e.clientY
		);
	}

	function onRootContextMenu(e: MouseEvent) {
		e.preventDefault();
		onContextMenu({ kind: 'root' }, e.clientX, e.clientY);
	}

	// Apply filter to a tree, returning a pruned copy.
	function filterTree(entry: FileEntry, q: string): FileEntry | null {
		if (!q) return entry;
		const ql = q.toLowerCase();
		if (!entry.isDirectory) {
			return entry.name.toLowerCase().includes(ql) ? entry : null;
		}
		const filteredChildren: FileEntry[] = [];
		for (const child of entry.children ?? []) {
			const fc = filterTree(child, q);
			if (fc) filteredChildren.push(fc);
		}
		// Show a directory if any descendant matches OR the dir name itself matches.
		if (filteredChildren.length > 0 || entry.name.toLowerCase().includes(ql)) {
			return { ...entry, children: filteredChildren };
		}
		// For the synthetic root (empty name + empty relativePath), keep it but with empty children.
		if (entry.name === '' && entry.relativePath === '') {
			return { ...entry, children: [] };
		}
		return null;
	}

	const displayRoot = $derived(root ? filterTree(root, filter) : null);
	const isEmpty = $derived(
		!displayRoot || !displayRoot.children || displayRoot.children.length === 0
	);
</script>

<div class="tree-wrap" oncontextmenu={onRootContextMenu} role="presentation">
	{#if isEmpty}
		<p class="empty">Vault vide — clic droit pour créer un fichier</p>
	{:else}
		<ul class="tree" role="tree">
			{#each displayRoot?.children ?? [] as entry (entry.relativePath)}
				{@render entryNode(entry, 0)}
			{/each}
		</ul>
	{/if}
</div>

{#snippet entryNode(entry: FileEntry, depth: number)}
	{#if entry.isDirectory}
		<li
			data-testid="file-tree-entry"
			class="entry directory"
			class:is-expanded={expanded.has(entry.relativePath)}
		>
			<button
				type="button"
				class="row"
				style="padding-left: {8 + depth * 12}px"
				onclick={() => toggle(entry.relativePath)}
				oncontextmenu={(e) => onEntryContextMenu(e, entry)}
			>
				<span class="caret">{expanded.has(entry.relativePath) ? '▾' : '▸'}</span>
				<span class="name">{entry.name}</span>
			</button>
			{#if expanded.has(entry.relativePath)}
				<ul role="group">
					{#each entry.children ?? [] as child (child.relativePath)}
						{@render entryNode(child, depth + 1)}
					{/each}
				</ul>
			{/if}
		</li>
	{:else}
		<li data-testid="file-tree-entry" class="entry file">
			<button
				type="button"
				class="row"
				style="padding-left: {20 + depth * 12}px"
				onclick={() => onFileClick(entry.relativePath)}
				oncontextmenu={(e) => onEntryContextMenu(e, entry)}
			>
				<span class="name">{entry.name}</span>
			</button>
		</li>
	{/if}
{/snippet}

<style>
	.tree-wrap {
		min-height: 60px;
	}

	.tree {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.tree :global(ul) {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.entry {
		font-size: var(--text-ui);
	}

	.row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		min-height: 26px;
		padding: 4px var(--space-3) 4px 8px;
		border: 0;
		background: transparent;
		color: var(--color-text-body);
		font-family: inherit;
		font-size: inherit;
		text-align: left;
		cursor: pointer;
		border-radius: var(--radius-sm);
	}

	.row:hover {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}

	.caret {
		display: inline-block;
		width: 12px;
		font-size: 10px;
		color: var(--color-text-secondary);
		flex-shrink: 0;
	}

	.directory > .row > .name {
		color: var(--color-text-primary);
	}

	.name {
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.empty {
		padding: var(--space-3);
		font-size: var(--text-caption);
		color: var(--color-text-secondary);
		font-style: italic;
	}
</style>
