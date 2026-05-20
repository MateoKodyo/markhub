<script lang="ts">
	import {
		ArrowRightLeft,
		ClipboardCopy,
		Copy,
		Download,
		ExternalLink,
		Eye,
		FileInput,
		FilePlus,
		Filter,
		FolderOpen,
		FolderPlus,
		Lock,
		Pencil,
		Plus,
		Trash2
	} from 'lucide-svelte';
	import { open as openFileDialog } from '@tauri-apps/plugin-dialog';
	import VaultList from './VaultList.svelte';
	import FileTree, { type CreatingAt, type TreeContext } from './FileTree.svelte';
	import ContextMenu, { type MenuItem } from './ContextMenu.svelte';
	import InputDialog from './InputDialog.svelte';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import FolderPickerDialog from './FolderPickerDialog.svelte';
	import AiContextPanel from './AiContextPanel.svelte';
	import Switch from './Switch.svelte';
	import ResizeHandle from './ResizeHandle.svelte';
	import { vaultsStore } from '$lib/stores/vaults.svelte';
	import { activeFileStore } from '$lib/stores/activeFile.svelte';
	import { aiAwareStore } from '$lib/stores/aiAware.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { uiStateStore } from '$lib/stores/uiState.svelte';
	import {
		vaultScan,
		fileCreate,
		fileDelete,
		fileImport,
		fileRead,
		fileRename,
		fileDuplicate,
		fileRevealInFinder,
		folderCreate,
		folderDelete
	} from '$lib/tauri/api';
	import { defaultExportFilename, runExportWithToast } from '$lib/utils/export';
	import { joinPath, getFileName, getParentPath } from '$lib/utils/path';
	import {
		isMarkdownFile,
		filterTreeToMarkdown,
		filterTreeToAiAware
	} from '$lib/utils/fileType';
	import { createClaudeMd, CLAUDE_MD_PATH } from '$lib/ai-ready/claudeMd';
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

	// Sidebar visibility toggle — persisted in settings.json under
	// `sidebar.hideNonMarkdown`. false (default) = all files visible
	// (non-md will be muted in Step 3); true = non-markdown files hidden.
	const hideNonMarkdown = $derived(settingsStore.current.sidebar.hideNonMarkdown);

	function toggleHideNonMarkdown() {
		settingsStore.set({
			...settingsStore.current,
			sidebar: {
				...settingsStore.current.sidebar,
				hideNonMarkdown: !settingsStore.current.sidebar.hideNonMarkdown
			}
		});
	}

	// "Show AI files" filter lives in uiStateStore — shared with the
	// `ai.show-aware-files` command (PLAN-AI-READY STEP 6).
	// Two independent, composable filters: markdown-only and AI-only.
	const displayScanRoot = $derived.by(() => {
		if (!scanRoot) return null;
		let tree = scanRoot;
		if (hideNonMarkdown) tree = filterTreeToMarkdown(tree);
		if (uiStateStore.aiFilesOnly) {
			tree = filterTreeToAiAware(
				tree,
				(path) => aiAwareStore.getForFile(path) !== null
			);
		}
		return tree;
	});

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
			aiAwareStore.clear();
			return;
		}
		scanError = null;
		void refreshScan(id);
	});

	// Bridge from the (STEP 2 debug) command palette to the existing
	// Sidebar-internal flows. STEP 3 will replace this with proper
	// command-registry handlers — until then, the palette dispatches a
	// `palette:action` event and we route it to the right local function.
	$effect(() => {
		const onPaletteAction = (e: Event) => {
			const detail = (e as CustomEvent<{ action?: string; paths?: string[] }>).detail;
			// `importPaths` is allowed even without a vault — the handler
			// itself surfaces the missing-vault error via toast.
			if (detail?.action === 'importPaths') {
				void handleImport(detail.paths ?? []);
				return;
			}
			if (!vaultsStore.activeVaultId) return;
			if (detail?.action === 'newFile') startCreate('file');
			else if (detail?.action === 'newFolder') startCreate('folder');
			else if (detail?.action === 'importFile') void handleImport();
			else if (detail?.action === 'openClaudeMd') void handleOpenOrCreateClaudeMd();
		};
		window.addEventListener('palette:action', onPaletteAction);
		return () => window.removeEventListener('palette:action', onPaletteAction);
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
		// Sidebar's scan is the authoritative file tree — it re-runs on
		// every mutation (create / rename / delete / import). Drive the
		// AI-aware cache off it so badges stay in sync (PLAN-AI-READY).
		aiAwareStore.syncFromTree(scanRoot);
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
			const v = await vaultsStore.addVaultFromPicker();
			if (v) toast.success('Vault ajouté', { details: v.name });
		} catch (e) {
			topLevelError = `Ajout vault impossible : ${String(e)}`;
			toast.error('Ajout vault impossible', { details: String(e) });
		}
	}

	function handleSelectVault(id: string) {
		vaultsStore.selectVault(id);
		selectedEntry = null;
	}

	async function handleOpenFile(relativePath: string) {
		const id = vaultsStore.activeVaultId;
		if (!id) return;
		// No flush guard here: `activeFile.openFile` itself flushes any
		// pending autosave before loading the new file (see store).
		void activeFileStore.openFile(id, relativePath);
	}

	function handleToggleFolder(relativePath: string) {
		const id = vaultsStore.activeVaultId;
		if (!id) return;
		void vaultsStore.toggleFolderExpansion(id, relativePath);
	}

	// AI Context panel — empty-state "Create CLAUDE.md" affordance.
	async function handleCreateClaudeMd() {
		const id = vaultsStore.activeVaultId;
		if (!id || vaultsStore.isActiveVaultReadonly) return;
		try {
			const rel = await createClaudeMd(id);
			await refreshScan();
			void activeFileStore.openFile(id, rel);
			toast.success('CLAUDE.md créé');
		} catch (e) {
			toast.error('Création CLAUDE.md impossible', { details: String(e) });
		}
	}

	// `ai.open-claude-md` command — open the vault-root CLAUDE.md, or
	// create it from the template when it doesn't exist yet.
	async function handleOpenOrCreateClaudeMd() {
		const id = vaultsStore.activeVaultId;
		if (!id) return;
		const exists =
			scanRoot?.children?.some(
				(c) => !c.isDirectory && c.relativePath === CLAUDE_MD_PATH
			) ?? false;
		if (exists) {
			void activeFileStore.openFile(id, CLAUDE_MD_PATH);
		} else {
			await handleCreateClaudeMd();
		}
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
				toast.success('Fichier créé', { details: name });
			} else {
				const rel = parentPath ? joinPath(parentPath, rawName) : rawName;
				await folderCreate(id, rel);
				await refreshScan();
				toast.success('Dossier créé', { details: rawName });
			}
			creatingAt = null;
		} catch (e) {
			topLevelError = `Création impossible : ${String(e)}`;
			toast.error('Création impossible', { details: String(e) });
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
				icon: FilePlus,
				disabled: ro,
				onClick: () => {
					vaultsStore.selectVault(vault.id);
					startCreate('file', '');
				}
			},
			{
				label: 'Nouveau dossier à la racine',
				icon: FolderPlus,
				disabled: ro,
				onClick: () => {
					vaultsStore.selectVault(vault.id);
					startCreate('folder', '');
				}
			},
			{ separator: true },
			{ label: 'Renommer le vault', icon: Pencil, onClick: () => promptRenameVault(vault) },
			{
				label: vault.mode === 'edit' ? 'Mode lecture seule' : 'Mode édition',
				icon: vault.mode === 'edit' ? Lock : Eye,
				onClick: () => toggleVaultMode(vault)
			},
			{ separator: true },
			{
				label: 'Révéler dans le Finder',
				icon: ExternalLink,
				onClick: () => revealVault(vault)
			},
			{
				label: 'Copier le chemin du vault',
				icon: ClipboardCopy,
				onClick: () => copyVaultPath(vault)
			},
			{ separator: true },
			{
				label: 'Retirer le vault',
				icon: Trash2,
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
			try {
				await vaultsStore.updateVault(vault.id, { name: newName });
				toast.success('Vault renommé', { details: newName });
			} catch (e) {
				toast.error('Renommage impossible', { details: String(e) });
				throw e;
			} finally {
				inputOpen = false;
			}
		};
		inputOpen = true;
	}

	async function toggleVaultMode(vault: Vault) {
		try {
			const newMode: VaultMode = vault.mode === 'edit' ? 'readonly' : 'edit';
			await vaultsStore.updateVault(vault.id, { mode: newMode });
			toast.info(
				newMode === 'readonly' ? 'Vault en lecture seule' : 'Vault en édition',
				{ details: vault.name }
			);
		} catch (e) {
			topLevelError = `Changement de mode impossible : ${String(e)}`;
			toast.error('Changement de mode impossible', { details: String(e) });
		}
	}

	function confirmRemoveVault(vault: Vault) {
		confirmTitle = `Supprimer le vault « ${vault.name} » ?`;
		confirmMessage =
			'Le vault sera retiré de Markus. Les fichiers sur disque ne sont pas supprimés.';
		confirmHandler = async () => {
			const wasActive = vaultsStore.activeVaultId === vault.id;
			try {
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
				toast.info('Vault retiré', { details: vault.name });
			} catch (e) {
				toast.error('Retrait du vault impossible', { details: String(e) });
				throw e;
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
					{ label: 'Ouvrir', icon: FolderOpen, onClick: () => handleOpenFile(entry.relativePath) },
					{ separator: true },
					{
						label: 'Renommer',
						icon: Pencil,
						disabled: ro,
						onClick: () => startRenameEntry(entry)
					},
					{
						label: 'Dupliquer',
						icon: Copy,
						disabled: ro,
						onClick: () => handleDuplicateFile(entry)
					},
					{
						label: 'Déplacer vers…',
						icon: ArrowRightLeft,
						disabled: ro,
						onClick: () => promptMoveFile(entry)
					},
					{ separator: true },
					{
						label: 'Copier le chemin (relatif)',
						icon: ClipboardCopy,
						onClick: () => copyEntryPath(entry, 'relative')
					},
					{
						label: 'Copier le chemin (absolu)',
						icon: ClipboardCopy,
						onClick: () => copyEntryPath(entry, 'absolute')
					},
					{
						label: 'Révéler dans le Finder',
						icon: ExternalLink,
						onClick: () => handleRevealInFinder(entry.relativePath)
					},
					{
						label: 'Exporter…',
						icon: Download,
						onClick: () => handleExportFile(entry)
					},
					{ separator: true },
					{
						label: 'Supprimer',
						icon: Trash2,
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
						icon: FilePlus,
						disabled: ro,
						onClick: () => startCreate('file', entry.relativePath)
					},
					{
						label: 'Nouveau dossier ici',
						icon: FolderPlus,
						disabled: ro,
						onClick: () => startCreate('folder', entry.relativePath)
					},
					{ separator: true },
					{
						label: 'Renommer',
						icon: Pencil,
						disabled: ro,
						onClick: () => startRenameEntry(entry)
					},
					{ separator: true },
					{
						label: 'Copier le chemin (relatif)',
						icon: ClipboardCopy,
						onClick: () => copyEntryPath(entry, 'relative')
					},
					{
						label: 'Copier le chemin (absolu)',
						icon: ClipboardCopy,
						onClick: () => copyEntryPath(entry, 'absolute')
					},
					{
						label: 'Révéler dans le Finder',
						icon: ExternalLink,
						onClick: () => handleRevealInFinder(entry.relativePath)
					},
					{ separator: true },
					{
						label: 'Supprimer',
						icon: Trash2,
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
						icon: FilePlus,
						disabled: ro,
						onClick: () => startCreate('file', '')
					},
					{
						label: 'Nouveau dossier à la racine',
						icon: FolderPlus,
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
			toast.success('Fichier dupliqué', { details: getFileName(newRel) });
		} catch (e) {
			topLevelError = `Duplication impossible : ${String(e)}`;
			toast.error('Duplication impossible', { details: String(e) });
		}
	}

	/**
	 * Import external markdown files into the active vault. The target
	 * parent is derived from the current selection (same rule as
	 * `startCreate`): selecting a folder puts the imports inside it,
	 * selecting a file puts them in that file's parent folder, no
	 * selection puts them at the vault root.
	 *
	 * `externalSources` lets a caller bypass the native dialog and feed
	 * absolute paths directly — used by the OS drag-drop bridge in
	 * +page.svelte. Non-markdown paths are filtered out silently.
	 */
	async function handleImport(externalSources?: string[]) {
		const id = vaultsStore.activeVaultId;
		if (!id || vaultsStore.isActiveVaultReadonly) {
			if (externalSources) {
				toast.error('Aucun vault actif', {
					details: 'Ouvre un vault avant de glisser des fichiers'
				});
			}
			return;
		}

		topLevelError = null;
		let sources: string[];
		if (externalSources) {
			sources = externalSources.filter(
				(p) => p.toLowerCase().endsWith('.md') || p.toLowerCase().endsWith('.markdown')
			);
			if (sources.length === 0) {
				toast.warning('Aucun fichier Markdown dans la sélection');
				return;
			}
			const ignored = externalSources.length - sources.length;
			if (ignored > 0) {
				toast.info(
					`${ignored} fichier${ignored > 1 ? 's' : ''} non-Markdown ignoré${ignored > 1 ? 's' : ''}`
				);
			}
		} else {
			let picked: string | string[] | null;
			try {
				picked = await openFileDialog({
					multiple: true,
					directory: false,
					filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
				});
			} catch (e) {
				topLevelError = `Sélection de fichiers impossible : ${String(e)}`;
				return;
			}
			if (!picked) return;
			sources = Array.isArray(picked) ? picked : [picked];
			if (sources.length === 0) return;
		}

		const targetParent = findInsertionTarget(
			selectedEntry
				? {
						relativePath: selectedEntry.relativePath,
						isDirectory: selectedEntry.isDirectory
					}
				: null
		);

		try {
			const imported = await fileImport(id, sources, targetParent);
			await refreshScan();
			// Auto-expand the target parent so the user sees the imported files.
			if (targetParent && !expandedSet.has(targetParent)) {
				void vaultsStore.toggleFolderExpansion(id, targetParent);
			}
			// Surface the first imported file as the new selection so the user
			// can immediately jump into it.
			if (imported.length > 0) {
				selectedEntry = { name: '', relativePath: imported[0], isDirectory: false };
			}
			const count = imported.length;
			toast.success(
				count === 1 ? 'Fichier importé' : `${count} fichiers importés`
			);
		} catch (e) {
			topLevelError = `Import impossible : ${String(e)}`;
			toast.error('Import impossible', { details: String(e) });
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
			// Auto-expand the destination folder so the user sees the moved item.
			if (targetParentPath && !expandedSet.has(targetParentPath)) {
				void vaultsStore.toggleFolderExpansion(id, targetParentPath);
			}
			// Follow the open file if it was the moved item OR a descendant
			// of the moved folder — otherwise the editor would silently keep
			// pointing at a stale path and re-save to the old location on
			// the next flush.
			const open = activeFileStore.activeFile;
			if (open && open.vaultId === id) {
				if (open.relativePath === sourcePath) {
					void activeFileStore.openFile(id, newRel);
				} else if (open.relativePath.startsWith(sourcePath + '/')) {
					const remainder = open.relativePath.slice(sourcePath.length + 1);
					const newOpenPath = joinPath(newRel, remainder);
					void activeFileStore.openFile(id, newOpenPath);
				}
			}
			const where = targetParentPath ? targetParentPath : 'la racine';
			toast.success('Déplacé', { details: `vers ${where}` });
		} catch (e) {
			topLevelError = `Déplacement impossible : ${String(e)}`;
			toast.error('Déplacement impossible', { details: String(e) });
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

	async function handleExportFile(entry: FileEntry) {
		const id = vaultsStore.activeVaultId;
		if (!id) return;
		// Sidebar export = export du fichier tel qu'il est sur disque (le
		// buffer courant n'est en général synchronisé qu'après le debounce
		// autosave ; et on peut exporter un fichier qui n'est pas ouvert).
		let content: string;
		try {
			content = await fileRead(id, entry.relativePath);
		} catch (e) {
			toast.error('Export impossible', { details: String(e) });
			return;
		}
		await runExportWithToast(content, defaultExportFilename(entry.relativePath));
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
			toast.success('Chemin copié', { details: value });
		} catch (e) {
			topLevelError = `Copie impossible : ${String(e)}`;
			toast.error('Copie impossible', { details: String(e) });
		}
	}

	async function copyVaultPath(vault: Vault) {
		try {
			await navigator.clipboard.writeText(vault.path);
			toast.success('Chemin copié', { details: vault.path });
		} catch (e) {
			topLevelError = `Copie impossible : ${String(e)}`;
			toast.error('Copie impossible', { details: String(e) });
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
			try {
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
				const summary =
					counts.files > 0 || counts.folders > 0
						? `${entry.name} (${parts.join(' + ')})`
						: entry.name;
				toast.success('Dossier supprimé', { details: summary });
			} catch (e) {
				toast.error('Suppression impossible', { details: String(e) });
				throw e;
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
		// Throws on conflict — InlineInput catches and surfaces inline,
		// so the toast here only celebrates the success path; failures
		// stay close to the input where the user sees them.
		await fileRename(id, entry.relativePath, newRel);
		renamingPath = null;
		await refreshScan();
		if (
			activeFileStore.activeFile?.vaultId === id &&
			activeFileStore.activeFile?.relativePath === entry.relativePath
		) {
			void activeFileStore.openFile(id, newRel);
		}
		toast.success(entry.isDirectory ? 'Dossier renommé' : 'Fichier renommé', {
			details: newName
		});
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
			try {
				await fileRename(id, entry.relativePath, newRel);
				folderPickerOpen = false;
				await refreshScan();
				if (
					activeFileStore.activeFile?.vaultId === id &&
					activeFileStore.activeFile?.relativePath === entry.relativePath
				) {
					void activeFileStore.openFile(id, newRel);
				}
				const where = target ? target : 'la racine';
				toast.success('Déplacé', { details: `vers ${where}` });
			} catch (e) {
				toast.error('Déplacement impossible', { details: String(e) });
				throw e;
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
			try {
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
				toast.success('Fichier supprimé', { details: entry.name });
			} catch (e) {
				toast.error('Suppression impossible', { details: String(e) });
				throw e;
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

<aside
	class="sidebar"
	class:is-collapsed={collapsed}
	inert={collapsed}
	data-sidebar-root
	style="--sidebar-w: {uiStateStore.sidebarWidth}px"
>
	{#if topLevelError}
		<p class="top-error" role="alert">{topLevelError}</p>
	{/if}

	<section
		class="sidebar-section vaults-section"
		style="height: {uiStateStore.vaultsHeight}px"
	>
		<header class="section-header files-header">
			<span class="label">Vaults</span>
			<div class="header-actions">
				<button
					type="button"
					class="icon-btn"
					onclick={handleAddVault}
					aria-label="Ajouter un vault"
					title="Ajouter un vault"
				>
					<Plus size={14} strokeWidth={1.5} aria-hidden="true" focusable="false" />
				</button>
			</div>
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
	</section>

	{#if vaultsStore.activeVault}
		<ResizeHandle
			size={uiStateStore.vaultsHeight}
			direction="down"
			ariaLabel="Redimensionner la liste des vaults"
			onResize={(h) => uiStateStore.setVaultsHeight(h)}
		/>
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
					<button
						type="button"
						class="icon-btn"
						title="Importer des fichiers Markdown"
						aria-label="Importer des fichiers Markdown"
						disabled={vaultsStore.isActiveVaultReadonly}
						onclick={() => handleImport()}
					>
						<FileInput size={14} />
					</button>
				</div>
			</header>

			<div class="filter-row">
				<span class="filter-icon">
					<Filter size={12} />
				</span>
				<input
					type="search"
					placeholder="Filtrer…"
					bind:value={fileFilter}
					class="filter-input"
				/>
			</div>

			<div class="files-filters">
				<Switch
					checked={!hideNonMarkdown}
					label="Show all files"
					onchange={() => toggleHideNonMarkdown()}
				/>
				<Switch
					checked={uiStateStore.aiFilesOnly}
					label="Show AI files"
					onchange={(v) => (uiStateStore.aiFilesOnly = v)}
				/>
			</div>

			<div class="files-scroll">
				{#if scanError}
					<p class="scan-error">{scanError}</p>
				{:else}
					<FileTree
						root={displayScanRoot}
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
			</div>
		</section>
		<AiContextPanel
			onOpenFile={handleOpenFile}
			onCreateClaudeMd={handleCreateClaudeMd}
		/>
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
		width: var(--sidebar-w, 280px);
		flex-shrink: 0;
		background: var(--color-bg-sidebar);
		border-right: 1px solid var(--color-border-subtle);
		overflow: hidden;
		transition:
			border-right-width var(--duration-base) var(--easing-standard);
	}

	/* Width transition kicks in ONLY for the collapse toggle. During a
	 * resize-handle drag, instant width changes feel right; a 160ms
	 * easing would lag and feel rubbery. */
	.sidebar.is-collapsed {
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
	}

	.vaults-section {
		flex: 0 0 auto;
		overflow: auto;
		min-height: 0;
		border-bottom: 1px solid var(--color-border-subtle);
	}

	/* The files section is a fixed frame: header, filter and switches stay
	   put while only `.files-scroll` (the tree) scrolls underneath. */
	.files-section {
		flex: 1 1 auto;
		min-height: 0;
		overflow: hidden;
		border-bottom: none;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-shrink: 0;
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

	.filter-row {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
		margin: 0 var(--space-2);
		padding: 6px var(--space-3);
		background: var(--color-surface-veil);
		border: 1px solid var(--color-border-subtle);
		border-radius: var(--radius-sm);
		transition:
			border-color var(--duration-base) var(--easing-standard),
			box-shadow var(--duration-base) var(--easing-standard);
	}

	/* Filter switches — sit below the filter box, fixed (don't scroll). */
	.files-filters {
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
		margin: 0 var(--space-2);
	}

	/* The only scrolling region of the files section — the tree. */
	.files-scroll {
		flex: 1 1 auto;
		min-height: 0;
		overflow: auto;
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
