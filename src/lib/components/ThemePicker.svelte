<script lang="ts">
	import { Check, Monitor, Moon, Sun } from 'lucide-svelte';
	import type { ComponentType, SvelteComponent } from 'svelte';
	import { getThemesByFamily, type ThemeId } from '$lib/theming/catalog';
	import { settingsStore } from '$lib/stores/settings.svelte';
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
	const lightThemes = $derived(getThemesByFamily('light'));
	const darkThemes = $derived(getThemesByFamily('dark'));

	// Dim the slot that the current mode "locks away" — still selectable so
	// users can pre-configure both before swapping modes.
	const lightDimmed = $derived(current.themeMode === 'always-dark');
	const darkDimmed = $derived(current.themeMode === 'always-light');

	function setMode(mode: FollowMode): void {
		settingsStore.setTheme({
			mode,
			lightTheme: current.lightTheme,
			darkTheme: current.darkTheme
		});
	}

	function selectLight(id: ThemeId): void {
		settingsStore.setTheme({
			mode: current.themeMode,
			lightTheme: id,
			darkTheme: current.darkTheme
		});
	}

	function selectDark(id: ThemeId): void {
		settingsStore.setTheme({
			mode: current.themeMode,
			lightTheme: current.lightTheme,
			darkTheme: id
		});
	}
</script>

<!-- Mode selector — segmented control on top -->
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

<!-- Light slot -->
<div class="theme-slot" class:dimmed={lightDimmed}>
	<div class="theme-slot-header">
		<span class="settings-row-label">Thème clair</span>
		<span class="settings-row-desc"
			>Utilisé quand l'apparence active est claire.</span
		>
	</div>
	<div class="theme-grid" data-testid="theme-slot-light">
		{#each lightThemes as meta (meta.id)}
			{@const isSelected = current.lightTheme === meta.id}
			<button
				type="button"
				class="theme-card"
				class:selected={isSelected}
				data-theme={meta.id}
				aria-pressed={isSelected}
				onclick={() => selectLight(meta.id)}
				data-testid={`theme-card-${meta.id}`}
			>
				<div class="theme-card-preview">
					<div class="preview-heading">Titre</div>
					<div class="preview-para">
						Phrase avec <code class="preview-code">inline</code> et un
						<span class="preview-link">lien</span>.
					</div>
					<div class="preview-cursor" aria-hidden="true"></div>
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

<!-- Dark slot -->
<div class="theme-slot" class:dimmed={darkDimmed}>
	<div class="theme-slot-header">
		<span class="settings-row-label">Thème sombre</span>
		<span class="settings-row-desc"
			>Utilisé quand l'apparence active est sombre.</span
		>
	</div>
	<div class="theme-grid" data-testid="theme-slot-dark">
		{#each darkThemes as meta (meta.id)}
			{@const isSelected = current.darkTheme === meta.id}
			<button
				type="button"
				class="theme-card"
				class:selected={isSelected}
				data-theme={meta.id}
				aria-pressed={isSelected}
				onclick={() => selectDark(meta.id)}
				data-testid={`theme-card-${meta.id}`}
			>
				<div class="theme-card-preview">
					<div class="preview-heading">Titre</div>
					<div class="preview-para">
						Phrase avec <code class="preview-code">inline</code> et un
						<span class="preview-link">lien</span>.
					</div>
					<div class="preview-cursor" aria-hidden="true"></div>
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
		transition: opacity var(--duration-slow) var(--easing-standard);
	}

	.theme-slot.dimmed {
		opacity: 0.55;
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
		gap: 8px;
		padding: 14px 16px 12px;
		background: var(--color-bg);
		border-bottom: 1px solid var(--color-border-subtle);
		min-height: 92px;
	}

	.preview-heading {
		font-family: var(--font-editor);
		font-size: 15px;
		font-weight: var(--weight-medium);
		color: var(--color-text-primary);
		letter-spacing: var(--tracking-heading);
	}

	.preview-para {
		font-family: var(--font-editor);
		font-size: 12px;
		line-height: 1.5;
		color: var(--color-text-body);
	}

	.preview-code {
		padding: 1px 5px;
		background: var(--color-surface-active);
		border: 1px solid var(--color-border-subtle);
		border-radius: 3px;
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--color-text-primary);
	}

	.preview-link {
		color: var(--color-accent);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.preview-cursor {
		width: 2px;
		height: 12px;
		background: var(--color-accent);
		animation: theme-card-blink 1.1s steps(1) infinite;
	}

	@keyframes theme-card-blink {
		0%,
		49% {
			opacity: 1;
		}
		50%,
		100% {
			opacity: 0;
		}
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
