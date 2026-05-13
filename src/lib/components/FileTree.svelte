<script lang="ts">
	import {
		ChevronDown,
		ChevronRight,
		FileText,
		Folder,
		FolderOpen
	} from 'lucide-svelte';
	import { collectAncestors } from '$lib/utils/tree';
	import InlineInput from './InlineInput.svelte';
	import type { FileEntry } from '$lib/tauri/types';

	export type TreeContext =
		| { kind: 'file'; entry: FileEntry }
		| { kind: 'directory'; entry: FileEntry }
		| { kind: 'root' };

	export type CreatingAt = {
		mode: 'file' | 'folder';
		/** '' = root, otherwise a directory's relativePath. */
		parentPath: string;
	};

	let {
		root = null,
		filter = '',
		expanded = new Set<string>(),
		selectedPath = null,
		creatingAt = null,
		renamingPath = null,
		readonly = false,
		onFileClick = () => {},
		onToggle = () => {},
		onContextMenu = () => {},
		onSelectionChange = () => {},
		onCreateSubmit = () => {},
		onCreateCancel = () => {},
		onStartRename = () => {},
		onRenameSubmit = () => {},
		onRenameCancel = () => {},
		onMoveFile = () => {}
	}: {
		root?: FileEntry | null;
		filter?: string;
		/** Persisted expanded folder paths (controlled by parent / store). */
		expanded?: Set<string>;
		/** Currently selected entry (used for create-context + visual highlight). */
		selectedPath?: string | null;
		/** When non-null, an inline input is rendered at the matching parent. */
		creatingAt?: CreatingAt | null;
		/** When set, the entry at this relativePath shows an inline rename input. */
		renamingPath?: string | null;
		/** Disables drag-drop (and write items in the menus, externally). */
		readonly?: boolean;
		onFileClick?: (relativePath: string) => void;
		onToggle?: (relativePath: string) => void;
		onContextMenu?: (ctx: TreeContext, x: number, y: number) => void;
		onSelectionChange?: (entry: FileEntry | null) => void;
		onCreateSubmit?: (value: string) => void | Promise<void>;
		onCreateCancel?: () => void;
		/** Triggered by F2 / double-click on an entry's row. */
		onStartRename?: (entry: FileEntry) => void;
		onRenameSubmit?: (value: string) => void | Promise<void>;
		onRenameCancel?: () => void;
		/**
		 * Drag-drop a file into a folder (or to the vault root with `''`).
		 * Sidebar wires this to file_rename. Source is always a .md file path.
		 */
		onMoveFile?: (sourcePath: string, targetParentPath: string) => void | Promise<void>;
	} = $props();

	const DRAG_MIME = 'application/x-markhub-path';
	let dragOverPath = $state<string | null>(null);
	let dragSourcePath = $state<string | null>(null);

	function handleDragStart(e: DragEvent, entry: FileEntry) {
		if (readonly) {
			e.preventDefault();
			return;
		}
		if (!e.dataTransfer) return;
		e.dataTransfer.setData(DRAG_MIME, entry.relativePath);
		e.dataTransfer.effectAllowed = 'move';
		dragSourcePath = entry.relativePath;
	}

	function handleDragEnd() {
		dragSourcePath = null;
		dragOverPath = null;
	}

	function handleDragOverFolder(e: DragEvent, entry: FileEntry) {
		if (readonly) return;
		// Only react to our own drags. The MIME existence check below avoids
		// hijacking foreign drags (image dropped from Finder, etc.).
		if (!e.dataTransfer?.types.includes(DRAG_MIME)) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
		dragOverPath = entry.relativePath;
	}

	function handleDragLeaveFolder(entry: FileEntry) {
		if (dragOverPath === entry.relativePath) dragOverPath = null;
	}

	async function handleDropOnFolder(e: DragEvent, target: FileEntry | null) {
		if (readonly) return;
		const sourcePath = e.dataTransfer?.getData(DRAG_MIME);
		if (!sourcePath) return;
		e.preventDefault();
		const targetParent = target ? target.relativePath : '';
		dragOverPath = null;
		dragSourcePath = null;
		// Don't re-emit if the source is already inside this directory.
		const currentParent = sourcePath.includes('/')
			? sourcePath.slice(0, sourcePath.lastIndexOf('/'))
			: '';
		if (currentParent === targetParent) return;
		// Anti-cycle: a folder cannot be dropped onto itself or onto one
		// of its own descendants (that would create a path loop).
		if (targetParent === sourcePath) return;
		if (targetParent.startsWith(sourcePath + '/')) return;
		await onMoveFile(sourcePath, targetParent);
	}

	function handleRootDragOver(e: DragEvent) {
		if (readonly) return;
		if (!e.dataTransfer?.types.includes(DRAG_MIME)) return;
		// Only mark as "root drop zone" if we're not over a folder row already.
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
	}

	// Filter the tree, keeping any directory whose name OR descendants match.
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
		if (filteredChildren.length > 0 || entry.name.toLowerCase().includes(ql)) {
			return { ...entry, children: filteredChildren };
		}
		if (entry.name === '' && entry.relativePath === '') {
			return { ...entry, children: [] };
		}
		return null;
	}

	const displayRoot = $derived(root ? filterTree(root, filter) : null);
	const isEmpty = $derived(
		!displayRoot || !displayRoot.children || displayRoot.children.length === 0
	);

	// When a filter is active, auto-expand all ancestors of any matching entry
	// so users can see WHERE the matches are. We compute this set on the fly,
	// without mutating the persisted `expanded` prop.
	const autoExpandedFromFilter = $derived.by(() => {
		const set = new Set<string>();
		if (!filter || !displayRoot) return set;
		const collectFromMatches = (entry: FileEntry) => {
			if (!entry.isDirectory) {
				for (const ancestor of collectAncestors(entry.relativePath)) set.add(ancestor);
				return;
			}
			// Directories that survived the filter — include them and recurse.
			if (entry.relativePath) {
				set.add(entry.relativePath);
				for (const ancestor of collectAncestors(entry.relativePath)) set.add(ancestor);
			}
			for (const child of entry.children ?? []) collectFromMatches(child);
		};
		for (const child of displayRoot.children ?? []) collectFromMatches(child);
		return set;
	});

	// Effective expansion = persisted ∪ auto. While the filter is active, the
	// auto set forces matching branches open without losing the user's intent
	// for when the filter clears.
	const effectiveExpanded = $derived.by(() => {
		if (!filter) return expanded;
		const merged = new Set(expanded);
		for (const p of autoExpandedFromFilter) merged.add(p);
		return merged;
	});

	function isExpanded(path: string): boolean {
		// Force-expand a directory hosting an inline-create input so the user
		// can see the new entry's pending name.
		if (creatingAt && creatingAt.parentPath === path) return true;
		return effectiveExpanded.has(path);
	}

	function inlinePlaceholder(): string {
		if (!creatingAt) return '';
		return creatingAt.mode === 'file' ? 'name.md' : 'folder';
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

	/**
	 * Finder-style: clicking in the empty area below the tree (or on the
	 * tree's own background gaps) clears the current selection. With no
	 * selection, the next "+ file" / "+ folder" / "Import" lands at the
	 * vault root instead of inside whatever folder was last clicked.
	 *
	 * The `target === currentTarget` guard makes sure the deselect only
	 * fires for clicks that landed DIRECTLY on the wrapper or the tree
	 * background — never bubbled up from a row's own click handler.
	 */
	function onEmptyAreaClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onSelectionChange(null);
		}
	}

	function selectEntry(entry: FileEntry) {
		onSelectionChange(entry);
	}

	function clickDirectory(entry: FileEntry) {
		selectEntry(entry);
		onToggle(entry.relativePath);
	}

	function clickFile(entry: FileEntry) {
		selectEntry(entry);
		onFileClick(entry.relativePath);
	}

	function onEntryDoubleClick(e: MouseEvent, entry: FileEntry) {
		e.preventDefault();
		e.stopPropagation();
		onStartRename(entry);
	}

	function onEntryKeyDown(e: KeyboardEvent, entry: FileEntry) {
		if (e.key === 'F2') {
			e.preventDefault();
			onStartRename(entry);
		}
	}

	/**
	 * For files, pre-select the part of the name BEFORE the last extension dot
	 * so the user can retype the name and keep `.md`. For dirs (and dotfiles),
	 * select all.
	 */
	function renameSelection(entry: FileEntry): [number, number] | null {
		if (entry.isDirectory) return null;
		const i = entry.name.lastIndexOf('.');
		if (i <= 0) return null;
		return [0, i];
	}
</script>

<div
	class="tree-wrap"
	oncontextmenu={onRootContextMenu}
	onclick={onEmptyAreaClick}
	ondragover={handleRootDragOver}
	ondrop={(e) => handleDropOnFolder(e, null)}
	role="presentation"
>
	{#if isEmpty && !(creatingAt && creatingAt.parentPath === '')}
		<p class="empty">Vault vide — clic droit ou bouton « + » pour créer</p>
	{:else}
		<ul class="tree" role="tree">
			{#if creatingAt && creatingAt.parentPath === ''}
				<li class="entry inline-creating" data-testid="inline-create">
					<InlineInput
						indentPx={8}
						placeholder={inlinePlaceholder()}
						onSubmit={onCreateSubmit}
						onCancel={onCreateCancel}
					/>
				</li>
			{/if}
			{#each displayRoot?.children ?? [] as entry (entry.relativePath)}
				{@render entryNode(entry, 0)}
			{/each}
		</ul>
	{/if}
</div>

{#snippet entryNode(entry: FileEntry, depth: number)}
	{#if entry.isDirectory}
		{@const isOpen = isExpanded(entry.relativePath)}
		{@const isRenaming = renamingPath === entry.relativePath}
		{@const isDropTarget = dragOverPath === entry.relativePath}
		{@const isDragSource = dragSourcePath === entry.relativePath}
		<li
			data-testid="file-tree-entry"
			data-kind="directory"
			class="entry directory"
			class:is-expanded={isOpen}
			class:is-selected={selectedPath === entry.relativePath}
			class:is-drop-target={isDropTarget}
			class:is-drag-source={isDragSource}
		>
			{#if isRenaming}
				<div class="row inline-renaming" data-testid="inline-rename">
					<span class="chevron">
						{#if isOpen}
							<ChevronDown size={12} />
						{:else}
							<ChevronRight size={12} />
						{/if}
					</span>
					<span class="icon icon-folder">
						{#if isOpen}
							<FolderOpen size={14} />
						{:else}
							<Folder size={14} />
						{/if}
					</span>
					<InlineInput
						indentPx={0}
						defaultValue={entry.name}
						selectionRange={renameSelection(entry)}
						onSubmit={onRenameSubmit}
						onCancel={onRenameCancel}
					/>
				</div>
			{:else}
				<button
					type="button"
					class="row"
					style="padding-left: {8 + depth * 16}px"
					onclick={() => clickDirectory(entry)}
					ondblclick={(e) => onEntryDoubleClick(e, entry)}
					onkeydown={(e) => onEntryKeyDown(e, entry)}
					oncontextmenu={(e) => onEntryContextMenu(e, entry)}
					draggable={!readonly}
					ondragstart={(e) => handleDragStart(e, entry)}
					ondragend={handleDragEnd}
					ondragover={(e) => handleDragOverFolder(e, entry)}
					ondragleave={() => handleDragLeaveFolder(entry)}
					ondrop={(e) => handleDropOnFolder(e, entry)}
				>
					<span class="chevron">
						{#if isOpen}
							<ChevronDown size={12} />
						{:else}
							<ChevronRight size={12} />
						{/if}
					</span>
					<span class="icon icon-folder">
						{#if isOpen}
							<FolderOpen size={14} />
						{:else}
							<Folder size={14} />
						{/if}
					</span>
					<span class="name">{entry.name}</span>
				</button>
			{/if}
			{#if isOpen}
				<ul role="group">
					{#if creatingAt && creatingAt.parentPath === entry.relativePath}
						<li class="entry inline-creating" data-testid="inline-create">
							<InlineInput
								indentPx={8 + (depth + 1) * 16}
								placeholder={inlinePlaceholder()}
								onSubmit={onCreateSubmit}
								onCancel={onCreateCancel}
							/>
						</li>
					{/if}
					{#each entry.children ?? [] as child (child.relativePath)}
						{@render entryNode(child, depth + 1)}
					{/each}
				</ul>
			{/if}
		</li>
	{:else}
		{@const isRenaming = renamingPath === entry.relativePath}
		{@const isDragSource = dragSourcePath === entry.relativePath}
		<li
			data-testid="file-tree-entry"
			data-kind="file"
			class="entry file"
			class:is-selected={selectedPath === entry.relativePath}
			class:is-drag-source={isDragSource}
		>
			{#if isRenaming}
				<div class="row inline-renaming" data-testid="inline-rename">
					<span class="chevron chevron-empty" aria-hidden="true"></span>
					<span class="icon icon-file">
						<FileText size={14} />
					</span>
					<InlineInput
						indentPx={0}
						defaultValue={entry.name}
						selectionRange={renameSelection(entry)}
						onSubmit={onRenameSubmit}
						onCancel={onRenameCancel}
					/>
				</div>
			{:else}
				<button
					type="button"
					class="row"
					style="padding-left: {8 + depth * 16}px"
					onclick={() => clickFile(entry)}
					ondblclick={(e) => onEntryDoubleClick(e, entry)}
					onkeydown={(e) => onEntryKeyDown(e, entry)}
					oncontextmenu={(e) => onEntryContextMenu(e, entry)}
					draggable={!readonly}
					ondragstart={(e) => handleDragStart(e, entry)}
					ondragend={handleDragEnd}
				>
					<span class="chevron chevron-empty" aria-hidden="true"></span>
					<span class="icon icon-file">
						<FileText size={14} />
					</span>
					<span class="name">{entry.name}</span>
				</button>
			{/if}
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
		gap: 6px;
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
		transition:
			background-color var(--duration-base) var(--easing-standard),
			color var(--duration-base) var(--easing-standard);
	}

	.row:hover {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}

	.is-selected > .row {
		background: var(--color-surface-active);
		color: var(--color-text-primary);
	}

	/* Drag-drop visual feedback. Source dims to .5; drop target gets an
	 * accent-tinted background so the user can see where the file will land. */
	.is-drag-source > .row {
		opacity: 0.5;
	}

	.is-drop-target > .row {
		background: var(--color-selection);
		color: var(--color-text-primary);
	}

	.chevron {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 12px;
		color: var(--color-text-secondary);
		flex-shrink: 0;
	}

	.icon {
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
		color: var(--color-text-secondary);
	}

	.directory > .row > .icon-folder {
		color: var(--color-text-body);
	}

	.directory.is-expanded > .row > .icon-folder {
		color: var(--color-text-primary);
	}

	.directory > .row > .name {
		color: var(--color-text-primary);
	}

	.file > .row > .icon-file {
		color: var(--color-text-secondary);
	}

	.name {
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.inline-renaming {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px var(--space-3) 4px 8px;
	}

	.empty {
		padding: var(--space-3);
		font-size: var(--text-caption);
		color: var(--color-text-secondary);
		font-style: italic;
	}
</style>
