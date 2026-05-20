<script lang="ts">
	/**
	 * In-document find bar — Cmd+F. Floats over the editor near the top,
	 * carries an input + match counter + prev/next controls + close.
	 *
	 * Behavior:
	 *  - Auto-focus the input when the bar opens.
	 *  - Typing recomputes matches via `findStore.setQuery`.
	 *  - Enter / ⌘G → next match, Shift+Enter / Shift+⌘G → previous.
	 *  - Escape closes the bar AND restores the editor focus.
	 *  - The Editor itself reacts to `findStore.activeIndex` to apply
	 *    the visual cue (source-mode native selection).
	 */

	import { onMount } from 'svelte';
	import { ChevronUp, ChevronDown, X } from 'lucide-svelte';
	import { findStore } from '$lib/stores/find.svelte';

	let inputEl: HTMLInputElement | null = $state(null);

	onMount(() => {
		// Microtask so the {#if open} block has actually mounted the DOM.
		queueMicrotask(() => inputEl?.focus());
	});

	function onInput(e: Event): void {
		const next = (e.currentTarget as HTMLInputElement).value;
		findStore.setQuery(next);
	}

	function onKeydown(e: KeyboardEvent): void {
		if (e.key === 'Escape') {
			e.preventDefault();
			findStore.close();
			return;
		}
		if (e.key === 'Enter') {
			e.preventDefault();
			if (e.shiftKey) findStore.previous();
			else findStore.next();
			return;
		}
	}

	function counterText(): string {
		if (findStore.query.length === 0) return '';
		if (findStore.matchCount === 0) return 'Aucun résultat';
		return `${findStore.activeIndex + 1} / ${findStore.matchCount}`;
	}
</script>

<div class="find-bar" role="search" data-testid="find-bar">
	<input
		bind:this={inputEl}
		type="text"
		class="find-input"
		placeholder="Rechercher dans le document"
		value={findStore.query}
		autocomplete="off"
		autocorrect="off"
		autocapitalize="off"
		spellcheck="false"
		aria-label="Rechercher dans le document"
		data-testid="find-input"
		oninput={onInput}
		onkeydown={onKeydown}
	/>

	<span class="find-counter" data-testid="find-counter">{counterText()}</span>

	<button
		type="button"
		class="find-btn"
		aria-label="Résultat précédent"
		title="Précédent (⇧⏎)"
		onclick={() => findStore.previous()}
		disabled={findStore.matchCount === 0}
		data-testid="find-prev"
	>
		<ChevronUp size={14} strokeWidth={1.5} aria-hidden="true" focusable="false" />
	</button>
	<button
		type="button"
		class="find-btn"
		aria-label="Résultat suivant"
		title="Suivant (⏎)"
		onclick={() => findStore.next()}
		disabled={findStore.matchCount === 0}
		data-testid="find-next"
	>
		<ChevronDown size={14} strokeWidth={1.5} aria-hidden="true" focusable="false" />
	</button>
	<button
		type="button"
		class="find-btn"
		aria-label="Fermer la recherche"
		title="Fermer (⎋)"
		onclick={() => findStore.close()}
		data-testid="find-close"
	>
		<X size={14} strokeWidth={1.5} aria-hidden="true" focusable="false" />
	</button>
</div>

<style>
	.find-bar {
		position: absolute;
		top: 12px;
		right: 16px;
		z-index: 100;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 8px;
		background: var(--color-bg-raised);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md, 8px);
		box-shadow: var(--shadow-md, 0 6px 24px rgba(0, 0, 0, 0.18));
	}

	.find-input {
		width: 220px;
		padding: 2px 6px;
		border: 0;
		background: transparent;
		color: var(--color-text-primary);
		font-family: var(--font-ui);
		font-size: 13px;
		line-height: 1.3;
		outline: none;
	}

	.find-input::placeholder {
		color: var(--color-text-muted);
	}

	.find-counter {
		min-width: 56px;
		text-align: right;
		font-size: var(--text-caption);
		color: var(--color-text-muted);
		white-space: nowrap;
	}

	.find-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		padding: 0;
		border: 0;
		border-radius: var(--radius-sm, 4px);
		background: transparent;
		color: var(--color-text-secondary);
		cursor: pointer;
		transition:
			background-color var(--duration-base, 160ms) var(--easing-standard, ease-out),
			color var(--duration-base, 160ms) var(--easing-standard, ease-out);
	}

	.find-btn:hover:not(:disabled) {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
	}

	.find-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
