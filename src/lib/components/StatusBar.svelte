<script lang="ts">
	import {
		AlertCircle,
		Check,
		Copy,
		Loader,
		Lock,
		Monitor,
		Moon,
		Pencil,
		Save,
		Settings as SettingsIcon,
		Sun
	} from 'lucide-svelte';
	import type { Vault } from '$lib/tauri/types';
	import type { SaveStatus } from '$lib/stores/activeFile.svelte';
	import { computeDocumentStats } from '$lib/stores/documentStats.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { themeManager } from '$lib/theming/manager.svelte';

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

	let countMode = $state<'words' | 'characters' | 'tokens'>('words');
	const stats = $derived(computeDocumentStats(content));

	// Three-stage cycle: words → characters → tokens → words.
	function cycleCount(): void {
		countMode =
			countMode === 'words' ? 'characters' : countMode === 'characters' ? 'tokens' : 'words';
	}

	// Compact 1k+ formatting for the token pill so a 50 000-token doc
	// doesn't take the whole status bar. Below 1k stays exact.
	function formatTokens(n: number): string {
		if (n < 1000) return n.toLocaleString('fr-FR');
		const k = n / 1000;
		// One decimal for < 100k, drop it above.
		return k < 100
			? `${k.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`
			: `${Math.round(k).toLocaleString('fr-FR')}k`;
	}

	const themeTitle = $derived.by(() => {
		switch (themeManager.preference.mode) {
			case 'always-dark':
				return 'Thème : sombre — cliquer pour clair';
			case 'always-light':
				return 'Thème : clair — cliquer pour système';
			case 'system': {
				const family = themeManager.osPrefersDark ? 'sombre' : 'clair';
				return `Thème : système (${family}) — cliquer pour sombre`;
			}
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
				<span class="pill pill-mono pill-path" data-testid="path-pill">
					{relativePath}
				</span>
				<button
					type="button"
					class="pill pill-btn pill-icon pill-copy"
					title="Copier le chemin absolu"
					aria-label="Copier le chemin absolu"
					onclick={onCopyPath}
					data-testid="path-copy-btn"
				>
					<Copy size={11} aria-hidden="true" focusable="false" />
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
				title="Cliquer : mots → caractères → tokens (estimation)"
				onclick={cycleCount}
				data-testid="counter-toggle"
			>
				{#if countMode === 'words'}
					{stats.words.toLocaleString('fr-FR')} mots
				{:else if countMode === 'characters'}
					{stats.characters.toLocaleString('fr-FR')} caractères
				{:else}
					~{formatTokens(stats.tokens)} tokens
				{/if}
			</button>
			<span class="pill pill-muted">~{stats.readingMinutes} min</span>
		{/if}
	</div>

	<!-- RIGHT — save status (variable), then theme + settings always pinned
	     to the extreme right. The save pill grows/shrinks with status, but
	     never pushes the action icons inward. -->
	<div class="zone right">
		{#if relativePath}
			<label class="content-width-slider" title="Largeur du texte (% de la zone éditeur)">
				<input
					type="range"
					min="30"
					max="100"
					step="2"
					value={settingsStore.current.appearance.editorContentWidth}
					oninput={(e) =>
						settingsStore.set({
							...settingsStore.current,
							appearance: {
								...settingsStore.current.appearance,
								editorContentWidth: +(e.currentTarget as HTMLInputElement).value
							}
						})}
					aria-label="Largeur du contenu"
					data-testid="content-width-slider"
				/>
				<span class="content-width-value">
					{settingsStore.current.appearance.editorContentWidth}%
				</span>
			</label>
		{/if}

		{#if statusInfo.icon}
			{@const StatusIcon = statusInfo.icon}
			<span class="pill pill-status" data-status={status} data-testid="save-pill">
				<StatusIcon size={11} />
				{#if statusInfo.label}
					<span>{statusInfo.label}</span>
				{/if}
			</span>
		{/if}

		<button
			type="button"
			class="pill pill-btn pill-icon"
			title={themeTitle}
			aria-label={themeTitle}
			onclick={() => {
				themeManager.cycleMode();
				settingsStore.setTheme(themeManager.preference);
			}}
			data-testid="theme-toggle"
		>
			{#if themeManager.preference.mode === 'always-light'}
				<Sun size={12} aria-hidden="true" focusable="false" />
			{:else if themeManager.preference.mode === 'always-dark'}
				<Moon size={12} aria-hidden="true" focusable="false" />
			{:else}
				<Monitor size={12} aria-hidden="true" focusable="false" />
			{/if}
		</button>

		<button
			type="button"
			class="pill pill-btn pill-icon"
			title="Paramètres (⌘,)"
			aria-label="Ouvrir les paramètres"
			onclick={() => settingsStore.open()}
			data-testid="settings-toggle"
		>
			<SettingsIcon size={12} aria-hidden="true" focusable="false" />
		</button>
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

	/* Path pill: static display now — the copy action lives in the dedicated
	   icon button next to it. Cursor stays default so it doesn't suggest an
	   action. */
	.pill-path {
		cursor: default;
	}

	.pill-copy {
		color: var(--color-text-muted);
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

	/* Compact content-width slider in the right zone. The native range
	 * appearance is dropped for a tight horizontal track that matches
	 * the rest of the status-bar pills' height and color tokens. */
	.content-width-slider {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: var(--pill-height);
		padding: 0 8px;
		font-size: var(--text-caption);
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.content-width-slider input[type='range'] {
		appearance: none;
		-webkit-appearance: none;
		width: 80px;
		height: 2px;
		background: var(--color-border);
		border-radius: 2px;
		outline: none;
		cursor: pointer;
	}

	.content-width-slider input[type='range']::-webkit-slider-thumb {
		appearance: none;
		-webkit-appearance: none;
		width: 10px;
		height: 10px;
		background: var(--color-text-secondary);
		border-radius: 50%;
		cursor: pointer;
		transition: background-color var(--duration-base) var(--easing-standard);
	}

	.content-width-slider:hover input[type='range']::-webkit-slider-thumb {
		background: var(--color-accent);
	}

	.content-width-slider input[type='range']::-moz-range-thumb {
		width: 10px;
		height: 10px;
		background: var(--color-text-secondary);
		border: 0;
		border-radius: 50%;
		cursor: pointer;
	}

	.content-width-value {
		min-width: 28px;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.pill-btn {
		cursor: pointer;
		text-align: left;
		transition:
			background-color var(--duration-base) var(--easing-standard),
			color var(--duration-base) var(--easing-standard);
	}

	.pill-btn:hover {
		background: var(--pill-bg-hover);
		color: var(--pill-fg-active);
	}

	.pill-btn:focus-visible {
		outline: 2px solid color-mix(in oklab, var(--color-accent) 40%, transparent);
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
		gap: var(--space-1);
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
