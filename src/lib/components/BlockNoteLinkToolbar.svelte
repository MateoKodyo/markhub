<script lang="ts">
	/**
	 * Svelte UI for BlockNote's LinkToolbar plugin.
	 *
	 * Important difference from the other plugins (slash menu, formatting
	 * toolbar, side menu, table handles): the linkToolbar extension does
	 * NOT expose a `.store`. It's a query-only API — the host polls
	 * `editor.getExtension('linkToolbar').getLinkAtSelection()` on each
	 * `editor.onSelectionChange()` to detect whether the cursor is inside
	 * a link, and drives this component's `menuState` accordingly.
	 *
	 * The component is pure presentation: URL input + "Ouvrir" + "Supprimer"
	 * buttons, anchored just below the link's DOMRect. The host wires
	 * `onSave(url)` to `editor.editLink(url, text)` and `onDelete` to
	 * `editor.deleteLink()`. `onClose` just hides the toolbar locally.
	 *
	 * UX scope for 2.5.e (per plan): edit/open/delete an existing link.
	 * Creation of a new link continues to use `window.prompt()` in the
	 * BlockNoteFormattingToolbar's 🔗 button (Option A from the plan
	 * brief — minimal change, pragmatic).
	 */
	import { tick } from 'svelte';
	import { ExternalLink, Trash2 } from 'lucide-svelte';
	import { urlOpen } from '$lib/tauri/api';

	export type LinkToolbarState = {
		show: boolean;
		link: {
			href: string;
			text: string;
			position: DOMRect;
		};
	};

	let {
		menuState = null,
		onSave = (_url: string) => {},
		onDelete = () => {},
		onClose = () => {}
	}: {
		menuState?: LinkToolbarState | null;
		onSave?: (url: string) => void;
		onDelete?: () => void;
		onClose?: () => void;
	} = $props();

	let urlInput: HTMLInputElement | null = $state(null);
	// Mirror of menuState.link.href: lets the user type without us
	// fighting the input value. Reset every time a new link surfaces.
	let draftHref = $state('');
	let lastSeenHref = $state<string | null>(null);

	$effect(() => {
		const next = menuState?.link?.href ?? null;
		if (next !== lastSeenHref) {
			lastSeenHref = next;
			draftHref = next ?? '';
			// Focus the URL field when the toolbar appears.
			if (next && menuState?.show) {
				void tick().then(() => urlInput?.focus());
			}
		}
	});

	const top = $derived(menuState?.link?.position ? menuState.link.position.bottom + 4 : 0);
	const left = $derived(menuState?.link?.position ? menuState.link.position.left : 0);

	function commitSave(url: string) {
		const trimmed = url.trim();
		if (trimmed.length === 0) return;
		onSave(trimmed);
	}

	function handleUrlKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			commitSave(draftHref);
		} else if (e.key === 'Escape') {
			e.preventDefault();
			onClose();
		}
	}

	function handleOpenMouseDown(e: MouseEvent) {
		// Preserve editor focus / cursor position.
		e.preventDefault();
		const trimmed = draftHref.trim();
		if (trimmed.length === 0) return;
		void urlOpen(trimmed).catch((err) => {
			console.warn('[LinkToolbar] urlOpen failed', err);
		});
	}

	function handleDeleteMouseDown(e: MouseEvent) {
		e.preventDefault();
		onDelete();
	}
</script>

{#if menuState?.show}
	<div
		class="bn-link-toolbar"
		data-testid="bn-link-toolbar"
		role="toolbar"
		aria-label="Link toolbar"
		style="position: fixed; left: {left}px; top: {top}px;"
	>
		<input
			bind:this={urlInput}
			class="bn-link-input"
			type="url"
			aria-label="URL"
			placeholder="https://…"
			bind:value={draftHref}
			onkeydown={handleUrlKeydown}
		/>
		<button
			type="button"
			class="bn-link-btn"
			aria-label="Ouvrir le lien dans le navigateur"
			title="Ouvrir dans le navigateur"
			onmousedown={handleOpenMouseDown}
		>
			<ExternalLink size={14} />
		</button>
		<button
			type="button"
			class="bn-link-btn bn-link-danger"
			aria-label="Supprimer le lien"
			title="Supprimer"
			onmousedown={handleDeleteMouseDown}
		>
			<Trash2 size={14} />
		</button>
	</div>
{/if}

<style>
	.bn-link-toolbar {
		z-index: 80;
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-1) var(--space-2);
		background: var(--color-bg-raised);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-popover);
		font-family: var(--font-ui);
		color: var(--color-text-body);
	}

	.bn-link-input {
		min-width: 240px;
		height: 22px;
		padding: 0 var(--space-2);
		border: 1px solid var(--color-border-subtle);
		border-radius: var(--radius-xs);
		background: var(--color-bg);
		color: var(--color-text-primary);
		font-family: var(--font-mono);
		font-size: var(--text-caption);
		outline: none;
		transition:
			border-color var(--duration-base) var(--easing-standard),
			box-shadow var(--duration-base) var(--easing-standard);
	}

	.bn-link-input:focus-visible {
		border-color: var(--color-accent);
		box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-accent) 40%, transparent);
	}

	.bn-link-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 26px;
		height: 22px;
		padding: 0 5px;
		border: 0;
		border-radius: var(--radius-xs);
		background: transparent;
		color: var(--color-text-body);
		cursor: pointer;
		transition:
			background-color var(--duration-base) var(--easing-standard),
			color var(--duration-base) var(--easing-standard);
	}

	.bn-link-btn:hover {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}

	.bn-link-btn:focus-visible {
		outline: 2px solid color-mix(in oklab, var(--color-accent) 40%, transparent);
		outline-offset: 1px;
	}

	.bn-link-danger:hover {
		color: var(--color-status-error);
	}
</style>
