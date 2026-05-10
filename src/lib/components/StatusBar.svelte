<script lang="ts">
	import { AlertCircle, Check, Loader, Lock, Monitor, Moon, Pencil, Save, Sun } from 'lucide-svelte';
	import type { EditorMode } from './Editor.svelte';
	import type { Vault } from '$lib/tauri/types';
	import type { SaveStatus } from '$lib/stores/activeFile.svelte';
	import { computeDocumentStats } from '$lib/stores/documentStats.svelte';
	import { themeStore } from '$lib/stores/theme.svelte';

	let {
		vault = null,
		relativePath = null,
		readonly = false,
		content = '',
		status = 'idle' as SaveStatus,
		mode = 'preview' as EditorMode,
		onModeChange = (_: EditorMode) => {},
		onCopyPath = () => {}
	}: {
		vault?: Vault | null;
		relativePath?: string | null;
		readonly?: boolean;
		content?: string;
		status?: SaveStatus;
		mode?: EditorMode;
		onModeChange?: (m: EditorMode) => void;
		onCopyPath?: () => void;
	} = $props();

	// Toggle the central counter between "X mots" and "Y caractères".
	let countMode = $state<'words' | 'characters'>('words');
	const stats = $derived(computeDocumentStats(content));

	// Tooltip reflects the *preference* (so users see "Système — actuellement
	// clair" rather than just the rendered value).
	const themeTitle = $derived.by(() => {
		switch (themeStore.preference) {
			case 'dark':
				return 'Thème : sombre — cliquer pour clair';
			case 'light':
				return 'Thème : clair — cliquer pour système';
			case 'system':
				return `Thème : système (${themeStore.effective}) — cliquer pour sombre`;
			default:
				return 'Thème';
		}
	});

	const statusInfo = $derived.by<{
		icon: typeof Loader | null;
		label: string;
	}>(() => {
		switch (status) {
			case 'idle':
				return { icon: null, label: '' };
			case 'loading':
				return { icon: Loader, label: 'Chargement' };
			case 'modified':
				return { icon: Pencil, label: 'Modifié' };
			case 'saving':
				return { icon: Save, label: 'Sauvegarde…' };
			case 'saved':
				return { icon: Check, label: 'Sauvegardé' };
			case 'error':
				return { icon: AlertCircle, label: 'Erreur' };
			default:
				return { icon: null, label: '' };
		}
	});
</script>

<footer class="status-bar" aria-label="Barre de statut">
	<!-- LEFT — vault, path, readonly badge -->
	<div class="zone left">
		{#if vault}
			<span class="vault-tag">
				<span class="dot" style="background: {vault.color}"></span>
				<span class="vault-name">{vault.name}</span>
			</span>
			{#if relativePath}
				<span class="sep">·</span>
				<button
					type="button"
					class="path-btn"
					title="Copier le chemin absolu"
					onclick={onCopyPath}
					data-testid="path-copy-btn"
				>
					{relativePath}
				</button>
				{#if readonly}
					<span class="badge-ro" title="Vault en lecture seule">
						<Lock size={10} />
						<span>RO</span>
					</span>
				{/if}
			{:else}
				<span class="sep">·</span>
				<span class="muted">Aucun fichier sélectionné</span>
			{/if}
		{:else}
			<span class="muted">Aucun vault</span>
		{/if}
	</div>

	<!-- CENTER — word / char count + reading time -->
	<div class="zone center">
		{#if relativePath}
			<button
				type="button"
				class="counter-btn"
				title="Cliquer pour basculer mots ↔ caractères"
				onclick={() => (countMode = countMode === 'words' ? 'characters' : 'words')}
				data-testid="counter-toggle"
			>
				{#if countMode === 'words'}
					{stats.words.toLocaleString('fr-FR')} mots
				{:else}
					{stats.characters.toLocaleString('fr-FR')} caractères
				{/if}
			</button>
			<span class="sep">·</span>
			<span class="reading">~{stats.readingMinutes} min</span>
		{/if}
	</div>

	<!-- RIGHT — save status, mode toggle, theme toggle -->
	<div class="zone right">
		<button
			type="button"
			class="theme-btn"
			title={themeTitle}
			aria-label={themeTitle}
			onclick={() => void themeStore.cycle()}
			data-testid="theme-toggle"
		>
			{#if themeStore.preference === 'light'}
				<Sun size={12} />
			{:else if themeStore.preference === 'dark'}
				<Moon size={12} />
			{:else}
				<Monitor size={12} />
			{/if}
		</button>

		{#if statusInfo.icon}
			{@const StatusIcon = statusInfo.icon}
			<span class="save-status" data-status={status}>
				<StatusIcon size={11} />
				{#if statusInfo.label}
					<span>{statusInfo.label}</span>
				{/if}
			</span>
		{/if}

		{#if relativePath}
			<div class="mode-toggle" role="group" aria-label="Mode éditeur">
				<button
					type="button"
					class="mode-btn"
					class:is-active={mode === 'preview'}
					onclick={() => onModeChange('preview')}
					aria-pressed={mode === 'preview'}
				>
					Preview
				</button>
				<button
					type="button"
					class="mode-btn"
					class:is-active={mode === 'source'}
					onclick={() => onModeChange('source')}
					aria-pressed={mode === 'source'}
				>
					Source
				</button>
			</div>
		{/if}
	</div>
</footer>

<style>
	.status-bar {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex-shrink: 0;
		min-height: 28px;
		padding: 0 var(--space-3);
		background: var(--color-bg-sidebar);
		border-top: 1px solid var(--color-border-subtle);
		font-size: var(--text-caption);
		color: var(--color-text-secondary);
		font-family: var(--font-mono);
	}

	.zone {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
	}

	.left {
		flex: 1;
		min-width: 0;
		overflow: hidden;
	}

	.center {
		flex-shrink: 0;
	}

	.right {
		flex: 1;
		justify-content: flex-end;
		min-width: 0;
	}

	.vault-tag {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
		font-family: var(--font-sans);
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.vault-name {
		color: var(--color-text-body);
	}

	.sep {
		color: var(--color-text-muted);
		flex-shrink: 0;
	}

	.muted {
		color: var(--color-text-muted);
		font-family: var(--font-sans);
	}

	.path-btn {
		min-width: 0;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--color-text-secondary);
		font-family: var(--font-mono);
		font-size: inherit;
		text-align: left;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		cursor: pointer;
	}

	.path-btn:hover {
		color: var(--color-text-primary);
	}

	.badge-ro {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		flex-shrink: 0;
		padding: 1px 5px;
		font-family: var(--font-sans);
		font-size: var(--text-label);
		letter-spacing: var(--tracking-label);
		color: var(--color-text-secondary);
		background: var(--color-surface-veil);
		border: 1px solid var(--color-border-subtle);
		border-radius: var(--radius-xs);
	}

	.counter-btn {
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--color-text-secondary);
		font-family: var(--font-mono);
		font-size: inherit;
		cursor: pointer;
	}

	.counter-btn:hover {
		color: var(--color-text-primary);
	}

	.reading {
		color: var(--color-text-muted);
	}

	.theme-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		padding: 0;
		border: 0;
		border-radius: var(--radius-xs);
		background: transparent;
		color: var(--color-text-secondary);
		cursor: pointer;
	}

	.theme-btn:hover {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}

	.save-status {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
	}

	.save-status[data-status='error'] {
		color: var(--color-status-error);
	}

	.save-status[data-status='saving'] :global(svg) {
		animation: status-bar-spin 1s linear infinite;
	}

	@keyframes status-bar-spin {
		to {
			transform: rotate(360deg);
		}
	}

	.mode-toggle {
		display: inline-flex;
		gap: 1px;
		background: var(--color-surface-veil);
		border: 1px solid var(--color-border-subtle);
		border-radius: var(--radius-xs);
		padding: 1px;
	}

	.mode-btn {
		padding: 1px 8px;
		border: 0;
		border-radius: 2px;
		background: transparent;
		color: var(--color-text-secondary);
		font-family: var(--font-sans);
		font-size: var(--text-label);
		cursor: pointer;
	}

	.mode-btn:hover {
		color: var(--color-text-primary);
	}

	.mode-btn.is-active {
		background: var(--color-surface-active);
		color: var(--color-text-primary);
	}
</style>
