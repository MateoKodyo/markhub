<script lang="ts">
	import { Check, Monitor, Moon, Sun } from 'lucide-svelte';
	import type { ComponentType, SvelteComponent } from 'svelte';
	import {
		getThemesByFamily,
		type ThemeFamily,
		type ThemeId,
		type ThemeMeta
	} from '$lib/theming/catalog';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { themeManager } from '$lib/theming/manager.svelte';
	import type { FollowMode } from '$lib/tauri/types';

	type IconComponent = ComponentType<SvelteComponent>;

	type ModeOption = {
		id: FollowMode;
		testId: string;
		label: string;
		icon: IconComponent;
	};

	const MODES: readonly ModeOption[] = [
		{
			id: 'system',
			testId: 'system',
			label: 'Suivre le système',
			icon: Monitor as unknown as IconComponent
		},
		{
			id: 'always-light',
			testId: 'light',
			label: 'Toujours clair',
			icon: Sun as unknown as IconComponent
		},
		{
			id: 'always-dark',
			testId: 'dark',
			label: 'Toujours sombre',
			icon: Moon as unknown as IconComponent
		}
	];

	const current = $derived(settingsStore.current.appearance);

	// Active family — same logic as the runtime resolver, mirrored here so
	// the picker only shows themes from the family that's actually painting
	// the app right now.
	const activeFamily = $derived<ThemeFamily>(
		current.themeMode === 'always-light'
			? 'light'
			: current.themeMode === 'always-dark'
				? 'dark'
				: themeManager.osPrefersDark
					? 'dark'
					: 'light'
	);

	const familyThemes = $derived(getThemesByFamily(activeFamily));
	const selectedId = $derived<ThemeId>(
		activeFamily === 'light' ? current.lightTheme : current.darkTheme
	);

	function setMode(mode: FollowMode): void {
		settingsStore.setTheme({
			mode,
			lightTheme: current.lightTheme,
			darkTheme: current.darkTheme
		});
	}

	function selectTheme(meta: ThemeMeta): void {
		// Write to the slot matching the theme's family. The other slot is
		// preserved so the user's "other side" preference doesn't get lost.
		if (meta.family === 'light') {
			settingsStore.setTheme({
				mode: current.themeMode,
				lightTheme: meta.id,
				darkTheme: current.darkTheme
			});
		} else {
			settingsStore.setTheme({
				mode: current.themeMode,
				lightTheme: current.lightTheme,
				darkTheme: meta.id
			});
		}
	}
</script>

<!-- Mode selector — segmented control -->
<div class="settings-row">
	<div class="settings-row-info">
		<span class="settings-row-label">Mode</span>
		<span class="settings-row-desc">
			Suivre l'apparence du système, ou verrouiller sur clair / sombre.
		</span>
	</div>
	<div
		class="settings-segmented theme-mode-segmented"
		role="radiogroup"
		aria-label="Sélectionner le mode de thème"
	>
		{#each MODES as mode (mode.id)}
			{@const Icon = mode.icon}
			{@const isActive = current.themeMode === mode.id}
			<button
				type="button"
				class="settings-segment"
				class:active={isActive}
				role="radio"
				aria-checked={isActive}
				onclick={() => setMode(mode.id)}
				data-testid={`theme-mode-${mode.testId}`}
			>
				<Icon size={13} aria-hidden="true" focusable="false" />
				<span>{mode.label}</span>
			</button>
		{/each}
	</div>
</div>

<!-- Active family theme picker — single list, scoped to the family that's
     currently painting the app. Changing mode changes which list shows. -->
<div class="theme-slot">
	<div class="theme-slot-header">
		<span class="settings-row-label">
			{activeFamily === 'light' ? 'Thème clair actif' : 'Thème sombre actif'}
		</span>
		<span class="settings-row-desc">
			{#if current.themeMode === 'system'}
				Le système est actuellement en {activeFamily === 'light' ? 'clair' : 'sombre'} —
				ce thème est celui qui s'affiche. Bascule le mode pour configurer l'autre.
			{:else}
				Choisis le thème qui s'applique tant que tu restes dans ce mode.
			{/if}
		</span>
	</div>
	<div class="theme-grid" data-testid={`theme-slot-${activeFamily}`}>
		{#each familyThemes as meta (meta.id)}
			{@const isSelected = selectedId === meta.id}
			<button
				type="button"
				class="theme-card"
				class:selected={isSelected}
				data-theme={meta.id}
				aria-pressed={isSelected}
				onclick={() => selectTheme(meta)}
				data-testid={`theme-card-${meta.id}`}
			>
				<div class="theme-card-preview">
					<div class="preview-heading">Titre</div>
					<div class="preview-para">Une ligne courte pour l'aperçu.</div>
				</div>
				<div class="theme-card-footer">
					<span class="theme-card-name">{meta.name}</span>
					<span class="theme-card-accent">{meta.accentName}</span>
				</div>
				{#if isSelected}
					<span class="theme-card-check" aria-hidden="true">
						<Check size={12} />
					</span>
				{/if}
			</button>
		{/each}
	</div>
</div>

<style>
	.theme-mode-segmented {
		flex-wrap: wrap;
	}

	.theme-slot {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding-top: 16px;
	}

	.theme-slot-header {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.theme-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 12px;
	}

	.theme-card {
		position: relative;
		display: flex;
		flex-direction: column;
		padding: 0;
		text-align: left;
		background: var(--color-bg-raised);
		color: var(--color-text-primary);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
		cursor: pointer;
		transition:
			border-color var(--duration-base) var(--easing-standard),
			box-shadow var(--duration-base) var(--easing-standard),
			transform var(--duration-base) var(--easing-standard);
	}

	.theme-card:hover {
		border-color: var(--color-border-strong);
		box-shadow: var(--shadow-md);
	}

	.theme-card.selected {
		border-color: var(--color-accent);
		box-shadow: 0 0 0 1px var(--color-accent);
	}

	.theme-card:focus-visible {
		outline: 2px solid color-mix(in oklab, var(--color-accent) 40%, transparent);
		outline-offset: 1px;
	}

	.theme-card-preview {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 14px 16px 12px;
		background: var(--color-bg);
		border-bottom: 1px solid var(--color-border-subtle);
		min-height: 64px;
	}

	.preview-heading {
		font-family: var(--font-editor);
		font-size: 15px;
		font-weight: var(--weight-medium);
		color: var(--color-accent);
		letter-spacing: var(--tracking-heading);
	}

	.preview-para {
		font-family: var(--font-editor);
		font-size: 12px;
		line-height: 1.5;
		color: var(--color-text-body);
	}

	.theme-card-footer {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		padding: 8px 14px 10px;
		background: var(--color-bg-raised);
	}

	.theme-card-name {
		font-size: var(--text-ui);
		font-weight: var(--weight-medium);
		color: var(--color-text-primary);
	}

	.theme-card-accent {
		font-size: var(--text-caption);
		color: var(--color-text-secondary);
		letter-spacing: var(--tracking-caption);
	}

	.theme-card-check {
		position: absolute;
		top: 8px;
		right: 8px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		background: var(--color-accent);
		color: var(--color-accent-fg);
		border-radius: 9999px;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
	}
</style>
