<script lang="ts">
	/**
	 * Svelte UI for BlockNote's SuggestionMenu plugin (slash menu).
	 *
	 * The plugin owns the state — we just render it. Pattern:
	 *   editor.extensions.suggestionMenu.store.subscribe(s => slashState = s)
	 * pumps the plugin store into a $state we read here. The plugin already
	 * tracks the trigger character ("/"), the live query, and the anchor
	 * DOMRect; we filter the items and call `item.onItemClick()` on selection,
	 * which dispatches the right ProseMirror transaction (block transform,
	 * insert, etc.).
	 *
	 * Closing is delegated to the plugin (Escape / blur / cursor moved away),
	 * but selection itself MUST fire `closeMenu` ourselves — the plugin
	 * doesn't know we picked one.
	 */
	import { tick } from 'svelte';
	import type { DefaultSuggestionItem } from '@blocknote/core';

	export type SlashMenuState = {
		show: boolean;
		referencePos: DOMRect;
		query: string;
		triggerCharacter?: string;
	};

	let {
		menuState = null,
		items = [],
		onSelect = (_: DefaultSuggestionItem) => {},
		onClose = () => {}
	}: {
		menuState?: SlashMenuState | null;
		items?: DefaultSuggestionItem[];
		onSelect?: (item: DefaultSuggestionItem) => void;
		onClose?: () => void;
	} = $props();

	let menuEl: HTMLDivElement | null = $state(null);
	let activeIndex = $state(0);

	// Reset highlight every time the visible items change (new query, etc.).
	let lastQueryKey = $state('');
	$effect(() => {
		const k = `${menuState?.show ? '1' : '0'}|${menuState?.query ?? ''}|${items.length}`;
		if (k !== lastQueryKey) {
			lastQueryKey = k;
			activeIndex = 0;
			void tick().then(() => scrollActiveIntoView());
		}
	});

	function scrollActiveIntoView() {
		if (!menuEl) return;
		const el = menuEl.querySelector<HTMLElement>(`[data-idx="${activeIndex}"]`);
		el?.scrollIntoView({ block: 'nearest' });
	}

	function pick(idx: number) {
		const item = items[idx];
		if (!item) return;
		onSelect(item);
		onClose();
	}

	// Keyboard navigation. We listen on the window so the editor focus is
	// preserved (the plugin's input chain sees the keystrokes too — Escape /
	// printable chars are still consumed by ProseMirror as expected).
	function onKey(e: KeyboardEvent) {
		if (!menuState?.show) return;
		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				activeIndex = (activeIndex + 1) % Math.max(items.length, 1);
				void tick().then(() => scrollActiveIntoView());
				break;
			case 'ArrowUp':
				e.preventDefault();
				activeIndex =
					(activeIndex - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1);
				void tick().then(() => scrollActiveIntoView());
				break;
			case 'Enter':
				e.preventDefault();
				pick(activeIndex);
				break;
			case 'Escape':
				e.preventDefault();
				onClose();
				break;
			default:
				break;
		}
	}

	const top = $derived(menuState?.referencePos ? menuState.referencePos.bottom + 4 : 0);
	const left = $derived(menuState?.referencePos ? menuState.referencePos.left : 0);
	const groups = $derived.by(() => {
		// Preserve order while bucketing by group label (DefaultSuggestionItem.group).
		const map = new Map<string, DefaultSuggestionItem[]>();
		for (const it of items) {
			const k = it.group ?? '';
			const arr = map.get(k) ?? [];
			arr.push(it);
			map.set(k, arr);
		}
		return Array.from(map.entries());
	});
</script>

<svelte:window on:keydown={onKey} />

{#if menuState?.show && items.length > 0}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={menuEl}
		class="bn-slash-menu"
		role="menu"
		style="left: {left}px; top: {top}px"
		data-testid="bn-slash-menu"
	>
		{#each groups as [groupLabel, groupItems] (groupLabel)}
			{#if groupLabel}
				<div class="bn-slash-group" role="presentation">{groupLabel}</div>
			{/if}
			{#each groupItems as item (item.title)}
				{@const idx = items.indexOf(item)}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<button
					type="button"
					class="bn-slash-item"
					class:is-active={idx === activeIndex}
					data-idx={idx}
					data-testid="bn-slash-item-{item.key}"
					onmousedown={(e) => {
						// Prevent the editor from blurring before our click runs.
						e.preventDefault();
						pick(idx);
					}}
					onmouseenter={() => (activeIndex = idx)}
					role="menuitem"
				>
					<span class="bn-slash-title">{item.title}</span>
					{#if item.subtext}
						<span class="bn-slash-subtitle">{item.subtext}</span>
					{/if}
					{#if item.badge}
						<span class="bn-slash-badge">{item.badge}</span>
					{/if}
				</button>
			{/each}
		{/each}
	</div>
{/if}

<style>
	/* Minimal step-2.5 styling: sober Markhub tokens, polish lands at step 3. */
	.bn-slash-menu {
		position: fixed;
		z-index: 80;
		min-width: 220px;
		max-height: 360px;
		overflow-y: auto;
		padding: var(--space-1);
		background: var(--color-bg-raised);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-popover);
		font-family: var(--font-ui);
		font-size: var(--text-ui);
		color: var(--color-text-body);
	}

	.bn-slash-group {
		padding: 6px var(--space-3) 2px;
		font-size: var(--text-label);
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		color: var(--color-text-muted);
	}

	.bn-slash-item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		padding: 6px var(--space-3);
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: left;
		border-radius: var(--radius-xs);
		cursor: pointer;
	}

	.bn-slash-item:hover,
	.bn-slash-item.is-active {
		background: var(--color-surface-active);
		color: var(--color-text-primary);
	}

	.bn-slash-title {
		flex: 1;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.bn-slash-subtitle {
		font-size: var(--text-caption);
		color: var(--color-text-muted);
	}

	.bn-slash-badge {
		font-size: var(--text-label);
		color: var(--color-text-muted);
		font-family: var(--font-mono);
	}
</style>
