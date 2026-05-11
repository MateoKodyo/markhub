<script lang="ts">
	import { AlertCircle, Check, Loader, Lock, Monitor, Moon, Pencil, Save, Sun } from 'lucide-svelte';
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
		onCopyPath = () => {}
	}: {
		vault?: Vault | null;
		relativePath?: string | null;
		readonly?: boolean;
		content?: string;
		status?: SaveStatus;
		onCopyPath?: () => void;
	} = $props();

	let countMode = $state<'words' | 'characters'>('words');
	const stats = $derived(computeDocumentStats(content));

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

	const statusInfo = $derived.by<{ icon: typeof Loader | null; label: string }>(() => {
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
			<span class="pill" data-testid="vault-pill">
				<span class="dot" style="background: {vault.color}"></span>
				<span>{vault.name}</span>
			</span>
			{#if relativePath}
				<button
					type="button"
					class="pill pill-btn pill-mono"
					title="Copier le chemin absolu"
					onclick={onCopyPath}
					data-testid="path-copy-btn"
				>
					{relativePath}
				</button>
				{#if readonly}
					<span class="pill pill-badge" title="Vault en lecture seule" data-testid="ro-pill">
						<Lock size={10} />
						<span>RO</span>
					</span>
				{/if}
			{:else}
				<span class="pill pill-muted">Aucun fichier</span>
			{/if}
		{:else}
			<span class="pill pill-muted">Aucun vault</span>
		{/if}
	</div>

	<!-- CENTER — word / char count + reading time -->
	<div class="zone center">
		{#if relativePath}
			<button
				type="button"
				class="pill pill-btn"
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
			<span class="pill pill-muted">~{stats.readingMinutes} min</span>
		{/if}
	</div>

	<!-- RIGHT — theme, save status, mode toggle -->
	<div class="zone right">
		<button
			type="button"
			class="pill pill-btn pill-icon"
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
			<span class="pill pill-status" data-status={status} data-testid="save-pill">
				<StatusIcon size={11} />
				{#if statusInfo.label}
					<span>{statusInfo.label}</span>
				{/if}
			</span>
		{/if}
	</div>
</footer>

<style>
	.status-bar {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex-shrink: 0;
		min-height: 38px;
		padding: 6px var(--space-3);
		background: transparent;
		border-top: 1px solid var(--color-border-subtle);
		font-size: var(--text-caption);
		color: var(--color-text-secondary);
	}

	.zone {
		display: flex;
		align-items: center;
		gap: var(--pill-gap);
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
		min-width: 0;
		justify-content: flex-end;
	}

	/* === Pill base ===
	 * Compact button-like surface — used for static info AND interactive
	 * actions. Static pills get the `pill-muted` modifier (lower contrast,
	 * not clickable cursor). Buttons get `pill-btn` (hover feedback). */
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		min-height: var(--pill-height);
		padding: 0 var(--pill-padding-x);
		background: var(--pill-bg);
		border: 0;
		border-radius: var(--pill-radius);
		color: var(--pill-fg);
		font-family: var(--font-ui);
		font-size: inherit;
		line-height: 1;
		white-space: nowrap;
	}

	.pill-mono {
		font-family: var(--font-mono);
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		display: inline-block; /* allow ellipsis */
		line-height: var(--pill-height);
		padding: 0 var(--pill-padding-x);
	}

	.pill-muted {
		background: transparent;
		color: var(--color-text-muted);
		font-style: italic;
	}

	.pill-icon {
		padding: 0;
		width: var(--pill-height);
		justify-content: center;
	}

	.pill-btn {
		cursor: pointer;
		text-align: left;
	}

	.pill-btn:hover {
		background: var(--pill-bg-hover);
		color: var(--pill-fg-active);
	}

	.pill-btn:focus-visible {
		outline: 1px solid var(--color-accent);
		outline-offset: 1px;
	}

	.pill-badge {
		gap: 3px;
		padding: 0 6px;
		font-size: var(--text-label);
		letter-spacing: var(--tracking-label);
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.pill-status {
		gap: 4px;
	}

	.pill-status[data-status='error'] {
		color: var(--color-status-error);
	}

	.pill-status[data-status='saving'] :global(svg) {
		animation: status-bar-spin 1s linear infinite;
	}

	@keyframes status-bar-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
