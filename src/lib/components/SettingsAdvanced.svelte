<script lang="ts">
	/**
	 * Settings → Advanced section (STEP 6 of PLAN-SETTINGS).
	 *
	 * Three controls and one read-only display:
	 *   - Open config folder → reveals the on-disk config dir in Finder.
	 *   - Export settings    → native save dialog, then atomic JSON write.
	 *   - Import settings    → native open dialog, parse + validate, apply.
	 *   - App version        → "Markus vX.Y.Z" (compile-time, from Cargo).
	 *
	 * Status messages stay inline so the modal can confirm / surface
	 * errors without piping through a toast system we don't have yet.
	 */

	import { onMount } from 'svelte';
	import { open, save } from '@tauri-apps/plugin-dialog';
	import {
		appVersion,
		settingsConfigFolderReveal,
		settingsExport,
		settingsImport
	} from '$lib/tauri/api';
	import { settingsStore } from '$lib/stores/settings.svelte';

	let version = $state<string>('…');
	let status = $state<{ kind: 'success' | 'error'; message: string } | null>(null);
	let busy = $state(false);

	onMount(async () => {
		try {
			version = await appVersion();
		} catch (e) {
			version = '?';
			console.warn('[settings.advanced] app_version failed', e);
		}
	});

	function showStatus(kind: 'success' | 'error', message: string): void {
		status = { kind, message };
		// Auto-clear success notes after a few seconds so the panel doesn't
		// stay loud forever. Errors stay until the user retries.
		if (kind === 'success') {
			setTimeout(() => {
				if (status?.message === message) status = null;
			}, 4000);
		}
	}

	async function onOpenConfigFolder(): Promise<void> {
		try {
			await settingsConfigFolderReveal();
		} catch (e) {
			showStatus('error', `Impossible d'ouvrir le dossier : ${String(e)}`);
		}
	}

	async function onExport(): Promise<void> {
		if (busy) return;
		busy = true;
		try {
			const target = await save({
				title: 'Exporter les réglages Markus',
				defaultPath: 'markus-settings.json',
				filters: [{ name: 'JSON', extensions: ['json'] }]
			});
			if (!target) {
				busy = false;
				return;
			}
			await settingsExport(target, settingsStore.current);
			showStatus('success', 'Réglages exportés.');
		} catch (e) {
			showStatus('error', `Export impossible : ${String(e)}`);
		} finally {
			busy = false;
		}
	}

	async function onImport(): Promise<void> {
		if (busy) return;
		busy = true;
		try {
			const source = await open({
				title: 'Importer des réglages Markus',
				multiple: false,
				filters: [{ name: 'JSON', extensions: ['json'] }]
			});
			if (!source || Array.isArray(source)) {
				busy = false;
				return;
			}
			const imported = await settingsImport(source);
			settingsStore.set(imported);
			showStatus('success', 'Réglages importés et appliqués.');
		} catch (e) {
			showStatus('error', `Import impossible : ${String(e)}`);
		} finally {
			busy = false;
		}
	}
</script>

<div class="settings-section">
	<section class="settings-group" aria-labelledby="group-advanced-config">
		<h4 class="settings-group-label" id="group-advanced-config">Configuration</h4>

		<div class="settings-row">
			<div class="settings-row-info">
				<span class="settings-row-label">Dossier de configuration</span>
				<span class="settings-row-desc"
					>Ouvrir l'emplacement où Markus stocke ses fichiers de réglages et de
					vaults.</span
				>
			</div>
			<button
				type="button"
				class="settings-btn"
				onclick={onOpenConfigFolder}
				data-testid="advanced-open-config-folder"
			>
				Ouvrir
			</button>
		</div>
	</section>

	<section class="settings-group" aria-labelledby="group-advanced-backup">
		<h4 class="settings-group-label" id="group-advanced-backup">Sauvegarde</h4>

		<div class="settings-row">
			<div class="settings-row-info">
				<span class="settings-row-label">Exporter les réglages</span>
				<span class="settings-row-desc"
					>Sauvegarder vos réglages actuels dans un fichier JSON pour les
					transférer sur un autre poste.</span
				>
			</div>
			<button
				type="button"
				class="settings-btn"
				onclick={onExport}
				disabled={busy}
				data-testid="advanced-export"
			>
				Exporter…
			</button>
		</div>

		<div class="settings-row">
			<div class="settings-row-info">
				<span class="settings-row-label">Importer des réglages</span>
				<span class="settings-row-desc"
					>Remplacer les réglages actuels par ceux d'un fichier JSON existant.</span
				>
			</div>
			<button
				type="button"
				class="settings-btn"
				onclick={onImport}
				disabled={busy}
				data-testid="advanced-import"
			>
				Importer…
			</button>
		</div>

		{#if status}
			<p
				class="settings-status"
				class:is-error={status.kind === 'error'}
				role={status.kind === 'error' ? 'alert' : 'status'}
				data-testid="advanced-status"
			>
				{status.message}
			</p>
		{/if}
	</section>

	<section class="settings-group" aria-labelledby="group-advanced-about">
		<h4 class="settings-group-label" id="group-advanced-about">À propos</h4>

		<div class="settings-row">
			<div class="settings-row-info">
				<span class="settings-row-label">Version</span>
			</div>
			<span class="settings-version" data-testid="advanced-version"
				>Markus v{version}</span
			>
		</div>
	</section>
</div>

<style>
	.settings-btn {
		flex: 0 0 auto;
		padding: 6px 14px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-bg-raised);
		color: var(--color-text-primary);
		font-family: inherit;
		font-size: var(--text-ui);
		cursor: pointer;
		transition:
			background-color var(--duration-base, 160ms) var(--easing-standard, ease-out),
			border-color var(--duration-base, 160ms) var(--easing-standard, ease-out);
	}

	.settings-btn:hover:not(:disabled) {
		background: var(--color-surface-hover);
		border-color: var(--color-text-muted);
	}

	.settings-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.settings-version {
		flex: 0 0 auto;
		font-family: var(--font-mono);
		font-size: var(--text-caption);
		color: var(--color-text-muted);
	}

	.settings-status {
		margin: 8px 0 0;
		padding: 8px 12px;
		border-radius: var(--radius-sm);
		font-size: var(--text-caption);
		background: color-mix(in oklab, var(--color-accent) 8%, transparent);
		color: var(--color-text-body);
	}

	.settings-status.is-error {
		background: color-mix(in oklab, var(--color-status-error) 14%, transparent);
		color: var(--color-text-primary);
	}
</style>
