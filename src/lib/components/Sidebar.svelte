<script lang="ts">
	import VaultList from './VaultList.svelte';
	import FileTree, { type TreeContext } from './FileTree.svelte';
	import ContextMenu, { type MenuItem } from './ContextMenu.svelte';
	import InputDialog from './InputDialog.svelte';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import { vaultsStore } from '$lib/stores/vaults.svelte';
	import { activeFileStore } from '$lib/stores/activeFile.svelte';
	import { vaultScan, fileCreate, fileDelete, fileRename } from '$lib/tauri/api';
	import { joinPath, getParentPath, isMarkdownFile } from '$lib/utils/path';
	import type { FileEntry, Vault } from '$lib/tauri/types';

	let fileFilter = $state('');
	let scanRoot = $state<FileEntry | null>(null);
	let scanError = $state<string | null>(null);
	let topLevelError = $state<string | null>(null);

	// Context menu state (shared between file tree + vault list — items differ).
	let ctxOpen = $state(false);
	let ctxX = $state(0);
	let ctxY = $state(0);
	let ctxItems = $state<MenuItem[]>([]);

	// Input dialog state (used for new file + rename file + rename vault).
	let inputOpen = $state(false);
	let inputTitle = $state('');
	let inputDefault = $state('');
	let inputPlaceholder = $state('');
	let inputSubmit = $state<(value: string) => Promise<void>>(async () => {});

	// Confirm dialog state.
	let confirmOpen = $state(false);
	let confirmTitle = $state('');
	let confirmMessage = $state('');
	let confirmHandler = $state<() => Promise<void>>(async () => {});

	// Re-scan whenever the active vault changes.
	$effect(() => {
		const id = vaultsStore.activeVaultId;
		if (!id) {
			scanRoot = null;
			return;
		}
		scanError = null;
		void refreshScan(id);
	});

	async function refreshScan(vaultId?: string) {
		const id = vaultId ?? vaultsStore.activeVaultId;
		if (!id) return;
		try {
			scanRoot = await vaultScan(id);
		} catch (e) {
			scanError = String(e);
			scanRoot = null;
		}
	}

	// ----- Add vault (Phase 5 redesigned flow) -----
	async function handleAddVault() {
		topLevelError = null;
		try {
			await vaultsStore.addVaultFromPicker();
			// addVaultFromPicker selects the new vault — scan triggers via $effect above.
		} catch (e) {
			topLevelError = `Ajout vault impossible : ${String(e)}`;
		}
	}

	function handleSelectVault(id: string) {
		vaultsStore.selectVault(id);
	}

	function handleOpenFile(relativePath: string) {
		const id = vaultsStore.activeVaultId;
		if (!id) return;
		void activeFileStore.openFile(id, relativePath);
	}

	// ----- Vault context menu -----
	function openVaultContextMenu(vault: Vault, x: number, y: number) {
		ctxX = x;
		ctxY = y;
		ctxItems = [
			{ label: 'Renommer', onClick: () => promptRenameVault(vault) },
			{
				label: vault.mode === 'edit' ? 'Mode lecture seule' : 'Mode édition',
				onClick: () => toggleVaultMode(vault)
			},
			{ label: 'Supprimer', danger: true, onClick: () => confirmRemoveVault(vault) }
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
			const newMode = vault.mode === 'edit' ? 'readonly' : 'edit';
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
			// If active file was in the removed vault, close it.
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
		switch (ctx.kind) {
			case 'file':
				return [
					{ label: 'Renommer', onClick: () => promptRenameFile(ctx.entry) },
					{ label: 'Supprimer', danger: true, onClick: () => confirmDeleteFile(ctx.entry) }
				];
			case 'directory':
				return [
					{ label: 'Nouveau fichier', onClick: () => promptNewFile(ctx.entry.relativePath) }
				];
			case 'root':
				return [{ label: 'Nouveau fichier', onClick: () => promptNewFile('') }];
		}
	}

	function promptNewFile(parentRel: string) {
		inputTitle = parentRel ? `Nouveau fichier dans ${parentRel}` : 'Nouveau fichier';
		inputPlaceholder = 'note.md';
		inputDefault = '';
		inputSubmit = async (raw: string) => {
			const id = vaultsStore.activeVaultId;
			if (!id) throw new Error('Aucun vault actif');
			const name = isMarkdownFile(raw) ? raw : `${raw}.md`;
			const rel = parentRel ? joinPath(parentRel, name) : name;
			await fileCreate(id, rel);
			inputOpen = false;
			await refreshScan();
			void activeFileStore.openFile(id, rel);
		};
		inputOpen = true;
	}

	function promptRenameFile(entry: FileEntry) {
		inputTitle = `Renommer ${entry.name}`;
		inputPlaceholder = entry.name;
		inputDefault = entry.name;
		inputSubmit = async (raw: string) => {
			const id = vaultsStore.activeVaultId;
			if (!id) throw new Error('Aucun vault actif');
			if (raw === entry.name) {
				inputOpen = false;
				return;
			}
			const newName = isMarkdownFile(raw) ? raw : `${raw}.md`;
			const parent = getParentPath(entry.relativePath);
			const newRel = parent ? joinPath(parent, newName) : newName;
			await fileRename(id, entry.relativePath, newRel);
			inputOpen = false;
			await refreshScan();
			if (
				activeFileStore.activeFile?.vaultId === id &&
				activeFileStore.activeFile?.relativePath === entry.relativePath
			) {
				void activeFileStore.openFile(id, newRel);
			}
		};
		inputOpen = true;
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
		confirmOpen = true;
	}

	function closeContextMenu() {
		ctxOpen = false;
	}
</script>

<aside class="sidebar">
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
		<button class="button add-vault-btn" onclick={handleAddVault}>
			+ Ajouter vault
		</button>
	</section>

	{#if vaultsStore.activeVault}
		<section class="sidebar-section files-section">
			<header class="section-header">
				<span class="label">Fichiers</span>
			</header>
			<input
				type="search"
				placeholder="Filtrer…"
				bind:value={fileFilter}
				class="filter-input"
			/>
			{#if scanError}
				<p class="scan-error">{scanError}</p>
			{:else}
				<FileTree
					root={scanRoot}
					filter={fileFilter}
					onFileClick={handleOpenFile}
					onContextMenu={openFileContextMenu}
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

<style>
	.sidebar {
		display: flex;
		flex-direction: column;
		width: 280px;
		flex-shrink: 0;
		border-right: 1px solid var(--color-border-subtle);
		overflow: hidden;
	}

	.top-error {
		margin: 0;
		padding: var(--space-3);
		background: rgba(248, 113, 113, 0.08);
		border-bottom: 1px solid rgba(248, 113, 113, 0.25);
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
		padding: 0 var(--space-2);
		min-height: 18px;
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
	}

	.filter-input {
		margin: 0 var(--space-2) var(--space-2);
		padding: 6px var(--space-3);
		background: var(--color-surface-veil);
		border: 1px solid var(--color-border-subtle);
		border-radius: var(--radius-sm);
		color: var(--color-text-primary);
		font-family: inherit;
		font-size: var(--text-ui);
	}

	.filter-input:focus {
		outline: none;
		border-color: var(--color-accent);
	}

	.scan-error {
		padding: var(--space-3);
		font-size: var(--text-caption);
		color: var(--color-status-error);
	}
</style>
