<script lang="ts">
	import { FilePlus, FolderPlus, Plus, Search } from 'lucide-svelte';
	import VaultList from './VaultList.svelte';
	import FileTree, { type CreatingAt, type TreeContext } from './FileTree.svelte';
	import ContextMenu, { type MenuItem } from './ContextMenu.svelte';
	import InputDialog from './InputDialog.svelte';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import FolderPickerDialog from './FolderPickerDialog.svelte';
	import { vaultsStore } from '$lib/stores/vaults.svelte';
	import { activeFileStore } from '$lib/stores/activeFile.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import {
		vaultScan,
		fileCreate,
		fileDelete,
		fileRename,
		fileDuplicate,
		fileRevealInFinder,
		folderCreate,
		folderDelete
	} from '$lib/tauri/api';
	import { joinPath, getFileName, getParentPath, isMarkdownFile } from '$lib/utils/path';
	import {
		findInsertionTarget,
		pruneExpandedFolders
	} from '$lib/utils/tree';
	import type { FileEntry, Vault, VaultMode } from '$lib/tauri/types';

	let { collapsed = false }: { collapsed?: boolean } = $props();

	let fileFilter = $state('');
	let scanRoot = $state<FileEntry | null>(null);
	let scanError = $state<string | null>(null);
	let topLevelError = $state<string | null>(null);

	// Selection in the file tree (drives contextual creation + visual highlight).
	let selectedEntry = $state<FileEntry | null>(null);
	const selectedPath = $derived<string | null>(selectedEntry?.relativePath ?? null);

	// Inline-creation state — when set, FileTree renders an InlineInput at parentPath.
	let creatingAt = $state<CreatingAt | null>(null);

	// Inline-rename state — when set, the entry at this path renders inline.
	let renamingPath = $state<string | null>(null);

	// Context menu shared between file tree + vault list (items differ).
	let ctxOpen = $state(false);
	let ctxX = $state(0);
	let ctxY = $state(0);
	let ctxItems = $state<MenuItem[]>([]);

	// Modal for rename (vault + file). Inline input is for CREATION only.
	let inputOpen = $state(false);
	let inputTitle = $state('');
	let inputDefault = $state('');
	let inputPlaceholder = $state('');
	let inputSubmit = $state<(value: string) => Promise<void>>(async () => {});

	// Confirm dialog for delete (file + vault).
	let confirmOpen = $state(false);
	let confirmTitle = $state('');
	let confirmMessage = $state('');
	let confirmHandler = $state<() => Promise<void>>(async () => {});

	// Folder picker for "Déplacer vers…".
	let folderPickerOpen = $state(false);
	let folderPickerExclude = $state<string | null>(null);
	let folderPickerHandler = $state<(target: string) => Promise<void>>(async () => {});

	// Re-scan whenever the active vault changes; prune stale expanded paths after.
	$effect(() => {
		const id = vaultsStore.activeVaultId;
		if (!id) {
			scanRoot = null;
			selectedEntry = null;
			creatingAt = null;
			return;
		}
		scanError = null;
		void refreshScan(id);
	});

	async function refreshScan(vaultId?: string) {
		const id = vaultId ?? vaultsStore.activeVaultId;
		if (!id) return;
		try {
			const root = await vaultScan(id);
			scanRoot = root;
			// Drop expanded paths whose folder no longer exists on disk.
			const persisted = vaultsStore.vaultStates[id]?.expandedFolders ?? [];
			const pruned = pruneExpandedFolders(persisted, root);
			if (pruned.length !== persisted.length) {
				void vaultsStore.setExpandedFolders(id, pruned);
			}
		} catch (e) {
			scanError = String(e);
			scanRoot = null;
		}
	}

	const expandedSet = $derived.by(() => {
		const id = vaultsStore.activeVaultId;
		if (!id) return new Set<string>();
		return vaultsStore.expandedFoldersFor(id);
	});

	// ----- Add vault -----
	async function handleAddVault() {
		topLevelError = null;
		try {
			await vaultsStore.addVaultFromPicker();
		} catch (e) {
			topLevelError = `Ajout vault impossible : ${String(e)}`;
		}
	}

	function handleSelectVault(id: string) {
		vaultsStore.selectVault(id);
		selectedEntry = null;
	}

	async function handleOpenFile(relativePath: string) {
		const id = vaultsStore.activeVaultId;
		if (!id) return;
		// Respect the "ask before closing unsaved" setting: when the current
		// file is in the 'modified' state (autosave debounce hasn't fired yet),
		// flush it to disk before navigating away so the user never silently
		// loses an in-flight edit.
		if (
			settingsStore.current.behavior.askBeforeClosingUnsaved &&
			activeFileStore.status === 'modified'
		) {
			try {
				await activeFileStore.forceSave();
			} catch (e) {
				topLevelError = `Échec de la sauvegarde avant changement de fichier : ${String(e)}`;
				return;
			}
		}
		void activeFileStore.openFile(id, relativePath);
	}

	function handleToggleFolder(relativePath: string) {
		const id = vaultsStore.activeVaultId;
		if (!id) return;
		void vaultsStore.toggleFolderExpansion(id, relativePath);
	}

	// ----- File-tree creation flow -----
	function startCreate(mode: 'file' | 'folder', overrideParent?: string) {
		const id = vaultsStore.activeVaultId;
		if (!id || vaultsStore.isActiveVaultReadonly) return;
		const parentPath =
			overrideParent !== undefined
				? overrideParent
				: findInsertionTarget(
						selectedEntry
							? {
									relativePath: selectedEntry.relativePath,
									isDirectory: selectedEntry.isDirectory
								}
							: null
					);
		// Auto-expand the parent so the inline input is visible.
		if (parentPath !== '' && !expandedSet.has(parentPath)) {
			void vaultsStore.toggleFolderExpansion(id, parentPath);
		}
		creatingAt = { mode, parentPath };
	}

	function cancelCreate() {
		creatingAt = null;
	}

	async function commitCreate(rawName: string) {
		const id = vaultsStore.activeVaultId;
		if (!id || !creatingAt) return;
		const { mode, parentPath } = creatingAt;
		try {
			if (mode === 'file') {
				const name = isMarkdownFile(rawName) ? rawName : `${rawName}.md`;
				const rel = parentPath ? joinPath(parentPath, name) : name;
				await fileCreate(id, rel);
				await refreshScan();
				void activeFileStore.openFile(id, rel);
			} else {
				const rel = parentPath ? joinPath(parentPath, rawName) : rawName;
				await folderCreate(id, rel);
				await refreshScan();
			}
			creatingAt = null;
		} catch (e) {
			topLevelError = `Création impossible : ${String(e)}`;
			creatingAt = null;
		}
	}

	// ----- Vault context menu -----
	function openVaultContextMenu(vault: Vault, x: number, y: number) {
		ctxX = x;
		ctxY = y;
		const ro = vault.mode === 'readonly';
		ctxItems = [
			{
				label: 'Nouvelle note à la racine',
				disabled: ro,
				onClick: () => {
					vaultsStore.selectVault(vault.id);
					startCreate('file', '');
				}
			},
			{
				label: 'Nouveau dossier à la racine',
				disabled: ro,
				onClick: () => {
					vaultsStore.selectVault(vault.id);
					startCreate('folder', '');
				}
			},
			{ separator: true },
			{ label: 'Renommer le vault', onClick: () => promptRenameVault(vault) },
			{
				label: vault.mode === 'edit' ? 'Mode lecture seule' : 'Mode édition',
				onClick: () => toggleVaultMode(vault)
			},
			{ separator: true },
			{
				label: 'Révéler dans le Finder',
				onClick: () => revealVault(vault)
			},
			{
				label: 'Copier le chemin du vault',
				onClick: () => copyVaultPath(vault)
			},
			{ separator: true },
			{
				label: 'Retirer le vault',
				danger: true,
				onClick: () => confirmRemoveVault(vault)
			}
		];
		ctxOpen = true;
	}

	function promptRenameVault(vault: Vault) {
		inputTitle = `Renommer le vault « ${vault.name} »`;
		inputPlaceholder = vault.name;
		inputDefault = vault.name;
		inputSubmit = async (newName: string) => {
			if (newName === vault.name) {
				inputOpen = false;
				return;
			}
			await vaultsStore.updateVault(vault.id, { name: newName });
			inputOpen = false;
		};
		inputOpen = true;
	}

	async function toggleVaultMode(vault: Vault) {
		try {
			const newMode: VaultMode = vault.mode === 'edit' ? 'readonly' : 'edit';
			await vaultsStore.updateVault(vault.id, { mode: newMode });
		} catch (e) {
			topLevelError = `Changement de mode impossible : ${String(e)}`;
		}
	}

	function confirmRemoveVault(vault: Vault) {
		confirmTitle = `Supprimer le vault « ${vault.name} » ?`;
		confirmMessage =
			'Le vault sera retiré de Markhub. Les fichiers sur disque ne sont pas supprimés.';
		confirmHandler = async () => {
			const wasActive = vaultsStore.activeVaultId === vault.id;
			await vaultsStore.removeVault(vault.id);
			confirmOpen = false;
			if (
				wasActive &&
				activeFileStore.activeFile &&
				activeFileStore.activeFile.vaultId === vault.id
			) {
				activeFileStore.close();
				void vaultsStore.setLastOpenedFile(null);
			}
		};
		confirmOpen = true;
	}

	// ----- File tree context menu -----
	function openFileContextMenu(ctx: TreeContext, x: number, y: number) {
		if (vaultsStore.isActiveVaultReadonly) return;
		ctxX = x;
		ctxY = y;
		ctxItems = buildFileMenuItems(ctx);
		ctxOpen = true;
	}

	function buildFileMenuItems(ctx: TreeContext): MenuItem[] {
		const ro = vaultsStore.isActiveVaultReadonly;
		switch (ctx.kind) {
			case 'file': {
				const entry = ctx.entry;
				return [
					{ label: 'Ouvrir', onClick: () => handleOpenFile(entry.relativePath) },
					{ separator: true },
					{
						label: 'Renommer',
						disabled: ro,
						onClick: () => startRenameEntry(entry)
					},
					{
						label: 'Dupliquer',
						disabled: ro,
						onClick: () => handleDuplicateFile(entry)
					},
					{
						label: 'Déplacer vers…',
						disabled: ro,
						onClick: () => promptMoveFile(entry)
					},
					{ separator: true },
					{
						label: 'Copier le chemin (relatif)',
						onClick: () => copyEntryPath(entry, 'relative')
					},
					{
						label: 'Copier le chemin (absolu)',
						onClick: () => copyEntryPath(entry, 'absolute')
					},
					{
						label: 'Révéler dans le Finder',
						onClick: () => handleRevealInFinder(entry.relativePath)
					},
					{ separator: true },
					{
						label: 'Supprimer',
						danger: true,
						disabled: ro,
						onClick: () => confirmDeleteFile(entry)
					}
				];
			}
			case 'directory': {
				const entry = ctx.entry;
				return [
					{
						label: 'Nouvelle note ici',
						disabled: ro,
						onClick: () => startCreate('file', entry.relativePath)
					},
					{
						label: 'Nouveau dossier ici',
						disabled: ro,
						onClick: () => startCreate('folder', entry.relativePath)
					},
					{ separator: true },
					{
						label: 'Renommer',
						disabled: ro,
						onClick: () => startRenameEntry(entry)
					},
					{ separator: true },
					{
						label: 'Copier le chemin (relatif)',
						onClick: () => copyEntryPath(entry, 'relative')
					},
					{
						label: 'Copier le chemin (absolu)',
						onClick: () => copyEntryPath(entry, 'absolute')
					},
					{
						label: 'Révéler dans le Finder',
						onClick: () => handleRevealInFinder(entry.relativePath)
					},
					{ separator: true },
					{
						label: 'Supprimer',
						danger: true,
						disabled: ro,
						onClick: () => confirmDeleteEntry(entry)
					}
				];
			}
			case 'root':
				return [
					{
						label: 'Nouvelle note à la racine',
						disabled: ro,
						onClick: () => startCreate('file', '')
					},
					{
						label: 'Nouveau dossier à la racine',
						disabled: ro,
						onClick: () => startCreate('folder', '')
					}
				];
		}
	}

	// ----- Phase 5b helpers -----
	function countDescendants(entry: FileEntry): { files: number; folders: number } {
		let files = 0;
		let folders = 0;
		const walk = (e: FileEntry) => {
			for (const child of e.children ?? []) {
				if (child.isDirectory) {
					folders++;
					walk(child);
				} else {
					files++;
				}
			}
		};
		walk(entry);
		return { files, folders };
	}

	async function handleDuplicateFile(entry: FileEntry) {
		const id = vaultsStore.activeVaultId;
		if (!id) return;
		try {
			const newRel = await fileDuplicate(id, entry.relativePath);
			await refreshScan();
			void activeFileStore.openFile(id, newRel);
		} catch (e) {
			topLevelError = `Duplication impossible : ${String(e)}`;
		}
	}

	async function handleMoveFile(sourcePath: string, targetParentPath: string) {
		const id = vaultsStore.activeVaultId;
		if (!id || vaultsStore.isActiveVaultReadonly) return;
		const baseName = getFileName(sourcePath);
		const newRel = targetParentPath ? joinPath(targetParentPath, baseName) : baseName;
		if (newRel === sourcePath) return;
		try {
			await fileRename(id, sourcePath, newRel);
			await refreshScan();
			// Auto-expand the destination folder so the user sees the moved file.
			if (targetParentPath && !expandedSet.has(targetParentPath)) {
				void vaultsStore.toggleFolderExpansion(id, targetParentPath);
			}
			// If the moved file was the open one, follow it to its new path.
			if (
				activeFileStore.activeFile?.vaultId === id &&
				activeFileStore.activeFile?.relativePath === sourcePath
			) {
				void activeFileStore.openFile(id, newRel);
			}
		} catch (e) {
			topLevelError = `Déplacement impossible : ${String(e)}`;
		}
	}

	async function handleRevealInFinder(relativePath: string) {
		const id = vaultsStore.activeVaultId;
		if (!id) return;
		try {
			await fileRevealInFinder(id, relativePath);
		} catch (e) {
			topLevelError = `Impossible d'ouvrir le Finder : ${String(e)}`;
		}
	}

	async function copyEntryPath(entry: FileEntry, mode: 'relative' | 'absolute') {
		const vault = vaultsStore.activeVault;
		if (!vault) return;
		const value =
			mode === 'absolute'
				? joinPath(vault.path, entry.relativePath)
				: entry.relativePath;
		try {
			await navigator.clipboard.writeText(value);
		} catch (e) {
			topLevelError = `Copie impossible : ${String(e)}`;
		}
	}

	async function copyVaultPath(vault: Vault) {
		try {
			await navigator.clipboard.writeText(vault.path);
		} catch (e) {
			topLevelError = `Copie impossible : ${String(e)}`;
		}
	}

	async function revealVault(vault: Vault) {
		try {
			await fileRevealInFinder(vault.id, '');
		} catch (e) {
			topLevelError = `Impossible d'ouvrir le Finder : ${String(e)}`;
		}
	}

	function confirmDeleteEntry(entry: FileEntry) {
		if (!entry.isDirectory) {
			confirmDeleteFile(entry);
			return;
		}
		const counts = countDescendants(entry);
		const parts: string[] = [];
		if (counts.files > 0) parts.push(`${counts.files} fichier${counts.files > 1 ? 's' : ''}`);
		if (counts.folders > 0) {
			parts.push(`${counts.folders} sous-dossier${counts.folders > 1 ? 's' : ''}`);
		}
		const blast = parts.length > 0 ? ` et ${parts.join(' + ')}` : '';
		confirmTitle = `Supprimer le dossier ${entry.name} ?`;
		confirmMessage = `Le dossier "${entry.relativePath}"${blast} sera supprimé du disque. Cette action est irréversible.`;
		confirmHandler = async () => {
			const id = vaultsStore.activeVaultId;
			if (!id) throw new Error('Aucun vault actif');
			await folderDelete(id, entry.relativePath);
			confirmOpen = false;
			await refreshScan();
			// Close any open file that lived under this folder.
			const open = activeFileStore.activeFile;
			if (
				open &&
				open.vaultId === id &&
				(open.relativePath === entry.relativePath ||
					open.relativePath.startsWith(`${entry.relativePath}/`))
			) {
				activeFileStore.close();
				void vaultsStore.setLastOpenedFile(null);
			}
		};
		// "Confirm before permanent deletion" setting: when off, skip the
		// dialog and run the handler immediately.
		if (!settingsStore.current.files.confirmDelete) {
			void confirmHandler();
			return;
		}
		confirmOpen = true;
	}

	function startRenameEntry(entry: FileEntry) {
		if (vaultsStore.isActiveVaultReadonly) return;
		renamingPath = entry.relativePath;
	}

	function cancelRename() {
		renamingPath = null;
	}

	async function commitRename(rawValue: string) {
		const id = vaultsStore.activeVaultId;
		if (!id || !renamingPath || !scanRoot) return;
		const entry = findEntryByPath(scanRoot, renamingPath);
		if (!entry) {
			renamingPath = null;
			return;
		}
		if (rawValue === entry.name) {
			renamingPath = null;
			return;
		}
		// Auto-add .md for files; dirs and dotfiles keep what the user typed.
		const newName =
			entry.isDirectory || isMarkdownFile(rawValue) || rawValue.startsWith('.')
				? rawValue
				: `${rawValue}.md`;
		const parent = getParentPath(entry.relativePath);
		const newRel = parent ? joinPath(parent, newName) : newName;
		// Throws on conflict — InlineInput catches and surfaces inline.
		await fileRename(id, entry.relativePath, newRel);
		renamingPath = null;
		await refreshScan();
		if (
			activeFileStore.activeFile?.vaultId === id &&
			activeFileStore.activeFile?.relativePath === entry.relativePath
		) {
			void activeFileStore.openFile(id, newRel);
		}
	}

	function findEntryByPath(root: FileEntry, path: string): FileEntry | null {
		if (root.relativePath === path) return root;
		for (const child of root.children ?? []) {
			const found = findEntryByPath(child, path);
			if (found) return found;
		}
		return null;
	}

	function promptMoveFile(entry: FileEntry) {
		const currentParent = getParentPath(entry.relativePath);
		folderPickerExclude = currentParent || null;
		folderPickerHandler = async (target: string) => {
			const id = vaultsStore.activeVaultId;
			if (!id) throw new Error('Aucun vault actif');
			const baseName = getFileName(entry.relativePath);
			const newRel = target ? joinPath(target, baseName) : baseName;
			if (newRel === entry.relativePath) {
				folderPickerOpen = false;
				return;
			}
			await fileRename(id, entry.relativePath, newRel);
			folderPickerOpen = false;
			await refreshScan();
			if (
				activeFileStore.activeFile?.vaultId === id &&
				activeFileStore.activeFile?.relativePath === entry.relativePath
			) {
				void activeFileStore.openFile(id, newRel);
			}
		};
		folderPickerOpen = true;
	}

	function confirmDeleteFile(entry: FileEntry) {
		confirmTitle = `Supprimer ${entry.name}`;
		confirmMessage = `Le fichier "${entry.relativePath}" sera supprimé du disque. Cette action est irréversible.`;
		confirmHandler = async () => {
			const id = vaultsStore.activeVaultId;
			if (!id) throw new Error('Aucun vault actif');
			await fileDelete(id, entry.relativePath);
			confirmOpen = false;
			await refreshScan();
			if (
				activeFileStore.activeFile?.vaultId === id &&
				activeFileStore.activeFile?.relativePath === entry.relativePath
			) {
				activeFileStore.close();
				void vaultsStore.setLastOpenedFile(null);
			}
		};
		// "Confirm before permanent deletion" setting: when off, skip the
		// dialog and run the handler immediately.
		if (!settingsStore.current.files.confirmDelete) {
			void confirmHandler();
			return;
		}
		confirmOpen = true;
	}

	function closeContextMenu() {
		ctxOpen = false;
	}
</script>

<aside class="sidebar" class:is-collapsed={collapsed} inert={collapsed}>
	{#if topLevelError}
		<p class="top-error" role="alert">{topLevelError}</p>
	{/if}

	<section class="sidebar-section vaults-section">
		<header class="section-header">
			<span class="label">Vaults</span>
		</header>
		{#if vaultsStore.vaults.length === 0}
			<p class="empty-vaults">Aucun vault. Ajoutez votre premier vault.</p>
		{:else}
			<VaultList
				vaults={vaultsStore.vaults}
				activeVaultId={vaultsStore.activeVaultId}
				onSelect={handleSelectVault}
				onContextMenu={openVaultContextMenu}
			/>
		{/if}
		<button class="button add-vault-btn" onclick={handleAddVault} aria-label="Ajouter un vault">
			<Plus size={14} />
			<span>Ajouter vault</span>
		</button>
	</section>

	{#if vaultsStore.activeVault}
		<section class="sidebar-section files-section">
			<header class="section-header files-header">
				<span class="label">Fichiers</span>
				<div class="header-actions">
					<button
						type="button"
						class="icon-btn"
						title="Nouveau fichier"
						aria-label="Nouveau fichier"
						disabled={vaultsStore.isActiveVaultReadonly}
						onclick={() => startCreate('file')}
					>
						<FilePlus size={14} />
					</button>
					<button
						type="button"
						class="icon-btn"
						title="Nouveau dossier"
						aria-label="Nouveau dossier"
						disabled={vaultsStore.isActiveVaultReadonly}
						onclick={() => startCreate('folder')}
					>
						<FolderPlus size={14} />
					</button>
				</div>
			</header>

			<div class="filter-row">
				<span class="filter-icon">
					<Search size={12} />
				</span>
				<input
					type="search"
					placeholder="Filtrer…"
					bind:value={fileFilter}
					class="filter-input"
				/>
			</div>

			{#if scanError}
				<p class="scan-error">{scanError}</p>
			{:else}
				<FileTree
					root={scanRoot}
					filter={fileFilter}
					expanded={expandedSet}
					selectedPath={selectedPath}
					{creatingAt}
					{renamingPath}
					readonly={vaultsStore.isActiveVaultReadonly}
					onFileClick={handleOpenFile}
					onToggle={handleToggleFolder}
					onContextMenu={openFileContextMenu}
					onSelectionChange={(entry) => (selectedEntry = entry)}
					onCreateSubmit={commitCreate}
					onCreateCancel={cancelCreate}
					onStartRename={startRenameEntry}
					onRenameSubmit={commitRename}
					onRenameCancel={cancelRename}
					onMoveFile={handleMoveFile}
				/>
			{/if}
		</section>
	{/if}
</aside>

{#if ctxOpen}
	<ContextMenu x={ctxX} y={ctxY} items={ctxItems} onClose={closeContextMenu} />
{/if}

<InputDialog
	open={inputOpen}
	title={inputTitle}
	placeholder={inputPlaceholder}
	defaultValue={inputDefault}
	onSubmit={inputSubmit}
	onCancel={() => (inputOpen = false)}
/>

<ConfirmDialog
	open={confirmOpen}
	title={confirmTitle}
	message={confirmMessage}
	confirmLabel="Supprimer"
	danger
	onConfirm={confirmHandler}
	onCancel={() => (confirmOpen = false)}
/>

<FolderPickerDialog
	open={folderPickerOpen}
	tree={scanRoot}
	excludePath={folderPickerExclude}
	onSubmit={folderPickerHandler}
	onCancel={() => (folderPickerOpen = false)}
/>

<style>
	.sidebar {
		display: flex;
		flex-direction: column;
		width: 280px;
		flex-shrink: 0;
		background: var(--color-bg-sidebar);
		border-right: 1px solid var(--color-border-subtle);
		overflow: hidden;
		transition:
			width var(--duration-base) var(--easing-standard),
			border-right-width var(--duration-base) var(--easing-standard);
	}

	.sidebar.is-collapsed {
		width: 0;
		border-right-width: 0;
	}

	.top-error {
		margin: 0;
		padding: var(--space-3);
		background: var(--color-danger-bg);
		border-bottom: 1px solid var(--color-danger-border);
		color: var(--color-status-error);
		font-size: var(--text-caption);
	}

	.sidebar-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-4) var(--space-3);
		border-bottom: 1px solid var(--color-border-subtle);
	}

	.files-section {
		flex: 1;
		min-height: 0;
		overflow: auto;
		border-bottom: none;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 var(--space-2);
		min-height: 18px;
	}

	.files-header {
		gap: var(--space-2);
	}

	.header-actions {
		display: inline-flex;
		gap: 2px;
	}

	.icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 22px;
		padding: 0;
		border: 0;
		border-radius: var(--radius-xs);
		background: transparent;
		color: var(--color-text-secondary);
		cursor: pointer;
	}

	.icon-btn:hover:not(:disabled) {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}

	.icon-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.empty-vaults {
		padding: var(--space-2) var(--space-3);
		font-size: var(--text-caption);
		color: var(--color-text-secondary);
		font-style: italic;
	}

	.add-vault-btn {
		justify-content: flex-start;
		margin-top: var(--space-1);
		gap: 6px;
	}

	.filter-row {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 0 var(--space-2) var(--space-2);
		padding: 6px var(--space-3);
		background: var(--color-surface-veil);
		border: 1px solid var(--color-border-subtle);
		border-radius: var(--radius-sm);
		transition:
			border-color var(--duration-base) var(--easing-standard),
			box-shadow var(--duration-base) var(--easing-standard);
	}

	.filter-row:focus-within {
		border-color: var(--color-accent);
		box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-accent) 40%, transparent);
	}

	.filter-icon {
		display: inline-flex;
		color: var(--color-text-secondary);
		flex-shrink: 0;
	}

	.filter-input {
		flex: 1;
		min-width: 0;
		padding: 0;
		background: transparent;
		border: 0;
		color: var(--color-text-primary);
		font-family: inherit;
		font-size: var(--text-ui);
		outline: none;
	}

	.scan-error {
		padding: var(--space-3);
		font-size: var(--text-caption);
		color: var(--color-status-error);
	}
</style>
