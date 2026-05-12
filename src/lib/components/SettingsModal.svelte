<script lang="ts">
	import {
		Code,
		Folder,
		MousePointer,
		Palette,
		Settings as SettingsIcon,
		Wrench,
		X
	} from 'lucide-svelte';
	import type { ComponentType, SvelteComponent } from 'svelte';
	import {
		SETTINGS_SECTIONS,
		settingsStore,
		type SettingsSection
	} from '$lib/stores/settings.svelte';
	import SettingsAppearance from './SettingsAppearance.svelte';

	type IconComponent = ComponentType<SvelteComponent>;

	/**
	 * Section metadata — label (FR) and icon (Lucide). Order in
	 * SETTINGS_SECTIONS is the visual order in the left rail.
	 */
	const SECTION_META: Record<SettingsSection, { label: string; icon: IconComponent }> = {
		appearance: { label: 'Apparence', icon: Palette as unknown as IconComponent },
		editor: { label: 'Éditeur', icon: SettingsIcon as unknown as IconComponent },
		source: { label: 'Mode source', icon: Code as unknown as IconComponent },
		files: { label: 'Fichiers', icon: Folder as unknown as IconComponent },
		behavior: { label: 'Comportement', icon: MousePointer as unknown as IconComponent },
		advanced: { label: 'Avancé', icon: Wrench as unknown as IconComponent }
	};

	let modalEl: HTMLDivElement | null = $state(null);

	// Auto-focus the modal panel when it opens so Escape works without a
	// preliminary click. The panel itself is `tabindex="-1"` (programmatic
	// focus only) — interactive elements inside take over once the user
	// starts tabbing.
	$effect(() => {
		if (settingsStore.isOpen && modalEl) {
			queueMicrotask(() => modalEl?.focus());
		}
	});

	function close(): void {
		settingsStore.close();
	}

	function select(section: SettingsSection): void {
		settingsStore.activeSection = section;
	}

	function onBackdrop(e: MouseEvent): void {
		if (e.target === e.currentTarget) close();
	}

	function onKeydown(e: KeyboardEvent): void {
		if (!settingsStore.isOpen) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			close();
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if settingsStore.isOpen}
	<div
		class="backdrop"
		role="presentation"
		onclick={onBackdrop}
		data-testid="settings-backdrop"
	>
		<div
			bind:this={modalEl}
			class="modal panel"
			role="dialog"
			aria-modal="true"
			aria-labelledby="settings-title"
			tabindex={-1}
			data-testid="settings-modal"
		>
			<header class="modal-header">
				<h2 id="settings-title">Paramètres</h2>
				<button
					type="button"
					class="close-btn"
					onclick={close}
					aria-label="Fermer les paramètres"
				>
					<X size={16} aria-hidden="true" focusable="false" />
				</button>
			</header>
			<div class="modal-body">
				<nav class="rail" aria-label="Sections des paramètres">
					{#each SETTINGS_SECTIONS as section (section)}
						{@const meta = SECTION_META[section]}
						{@const Icon = meta.icon}
						{@const isActive = settingsStore.activeSection === section}
						<button
							type="button"
							class="rail-item"
							class:active={isActive}
							aria-current={isActive ? 'true' : undefined}
							onclick={() => select(section)}
							data-testid={`settings-rail-${section}`}
						>
							<Icon size={16} aria-hidden="true" focusable="false" />
							<span>{meta.label}</span>
						</button>
					{/each}
				</nav>
				<section
					class="content"
					aria-labelledby="settings-section-heading"
					data-testid="settings-content"
				>
					<h3 id="settings-section-heading">
						{SECTION_META[settingsStore.activeSection].label}
					</h3>
					{#if settingsStore.activeSection === 'appearance'}
						<SettingsAppearance />
					{:else}
						<p class="placeholder">
							Les contrôles de cette section seront ajoutés à l'étape
							suivante.
						</p>
					{/if}
				</section>
			</div>
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: var(--color-backdrop);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 200;
		padding: var(--space-6);
	}

	.modal {
		display: flex;
		flex-direction: column;
		width: min(760px, 100%);
		height: min(600px, 100%);
		background: var(--color-bg-raised);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-xl);
		overflow: hidden;
	}

	.modal:focus-visible {
		outline: none;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-4) var(--space-5);
		border-bottom: 1px solid var(--color-border);
	}

	.modal-header h2 {
		font-size: var(--text-heading);
		letter-spacing: var(--tracking-heading);
		font-weight: 600;
		color: var(--color-text-primary);
	}

	.close-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		padding: 0;
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		color: var(--color-text-muted);
		cursor: pointer;
		transition:
			background var(--duration-base) var(--easing-standard),
			color var(--duration-base) var(--easing-standard),
			border-color var(--duration-base) var(--easing-standard);
	}

	.close-btn:hover {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}

	.close-btn:focus-visible {
		outline: none;
		border-color: var(--color-accent);
		box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-accent) 40%, transparent);
	}

	.modal-body {
		display: flex;
		flex: 1;
		min-height: 0; /* enables overflow within children */
	}

	.rail {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 0 0 200px;
		padding: var(--space-3) var(--space-2);
		border-right: 1px solid var(--color-border);
		background: var(--color-surface-veil);
		overflow-y: auto;
	}

	.rail-item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		padding: 8px var(--space-3);
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		color: var(--color-text-body);
		font-family: inherit;
		font-size: var(--text-ui);
		text-align: left;
		cursor: pointer;
		transition:
			background var(--duration-base) var(--easing-standard),
			color var(--duration-base) var(--easing-standard);
	}

	.rail-item:hover {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}

	.rail-item.active {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
		font-weight: 500;
	}

	.rail-item:focus-visible {
		outline: none;
		border-color: var(--color-accent);
		box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-accent) 40%, transparent);
	}

	.content {
		flex: 1;
		padding: var(--space-5) var(--space-6);
		overflow-y: auto;
	}

	.content h3 {
		font-size: var(--text-section);
		font-weight: 600;
		color: var(--color-text-primary);
		margin-bottom: var(--space-4);
	}

	.placeholder {
		color: var(--color-text-muted);
		font-size: var(--text-ui);
		line-height: var(--leading-relaxed, 1.5);
	}
</style>
