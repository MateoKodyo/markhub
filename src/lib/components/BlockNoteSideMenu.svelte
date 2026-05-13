<script lang="ts">
	/**
	 * Svelte UI for BlockNote's SideMenu plugin.
	 *
	 * The plugin owns the menuState and the drag-and-drop logic; we only render
	 * the affordance (⋮⋮ + `+`) and forward HTML5 drag events. Pattern:
	 *   editor.getExtension('sideMenu').store.subscribe(({ currentVal }) =>
	 *     sideMenuState = currentVal?.show ? currentVal : null)
	 * The host then passes that menuState down here.
	 *
	 * The store payload is `SideMenuState | undefined` where
	 *   SideMenuState = UiElementPosition & { block: Block }
	 * — `referencePos` is a DOMRect of the hovered block, `show` toggles
	 * visibility, and `block` is the actual BN block (with .id, .type, …)
	 * we need for transforms / inserts / drag.
	 *
	 * The drag affordance is HTML5-native: ⋮⋮ has `draggable="true"` and
	 * the host calls `sideMenu.blockDragStart({ dataTransfer, clientY },
	 * block)` from onDragStart. BlockNote handles dragover, drop indicator
	 * (DropCursor plugin) and the actual reorder transaction by itself.
	 *
	 * Click on ⋮⋮ (without dragging) opens a transform sub-menu rendered
	 * by the existing ContextMenu component (auto-flip + max-height already
	 * handled). The host freezes the side-menu plugin while the sub-menu
	 * is open so the affordance doesn't disappear on hover.
	 */
	import { GripVertical, Plus } from 'lucide-svelte';
	import ContextMenu, { type MenuItem } from './ContextMenu.svelte';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	type BlockLike = any;

	export type SideMenuState = {
		show: boolean;
		referencePos: DOMRect;
		block: BlockLike;
	};

	export type TransformType =
		| 'paragraph'
		| 'heading'
		| 'bulletListItem'
		| 'numberedListItem'
		| 'checkListItem'
		| 'quote'
		| 'codeBlock';

	let {
		menuState = null,
		onDragStart = (_e: DragEvent, _b: BlockLike) => {},
		onDragEnd = () => {},
		onAddBlock = (_b: BlockLike) => {},
		onTransform = (
			_b: BlockLike,
			_t: TransformType,
			_p?: Record<string, unknown>
		) => {},
		onMenuOpenChange = (_open: boolean) => {}
	}: {
		menuState?: SideMenuState | null;
		onDragStart?: (e: DragEvent, b: BlockLike) => void;
		onDragEnd?: () => void;
		onAddBlock?: (b: BlockLike) => void;
		onTransform?: (
			b: BlockLike,
			t: TransformType,
			p?: Record<string, unknown>
		) => void;
		onMenuOpenChange?: (open: boolean) => void;
	} = $props();

	const MENU_WIDTH = 48; // rough — ⋮⋮ + + + padding
	const HANDLE_GAP = 4;

	// Position to the left of referencePos. Y stays aligned with the block.
	const top = $derived(menuState?.referencePos ? menuState.referencePos.top : 0);
	const left = $derived(
		menuState?.referencePos
			? Math.max(0, menuState.referencePos.left - MENU_WIDTH - HANDLE_GAP)
			: 0
	);

	let submenuOpen = $state(false);
	let submenuX = $state(0);
	let submenuY = $state(0);
	let handleEl: HTMLButtonElement | null = $state(null);

	function openSubmenu() {
		if (!handleEl) return;
		const rect = handleEl.getBoundingClientRect();
		submenuX = rect.right + 4;
		submenuY = rect.top;
		submenuOpen = true;
		onMenuOpenChange(true);
	}

	function closeSubmenu() {
		submenuOpen = false;
		onMenuOpenChange(false);
	}

	function handleClick() {
		if (!menuState) return;
		// HTML5 drag fires `dragstart` before `click`, and `click` is
		// suppressed for the dragged element when a drop actually
		// occurs. So a click that reaches us is genuinely a click, not
		// a drag tail — safe to open the sub-menu.
		openSubmenu();
	}

	function handleDragStart(e: DragEvent) {
		if (!menuState) return;
		onDragStart(e, menuState.block);
	}

	function handleDragEnd() {
		if (!menuState) return;
		onDragEnd();
	}

	function handleAddBlockClick() {
		if (!menuState) return;
		onAddBlock(menuState.block);
	}

	function transform(t: TransformType, p?: Record<string, unknown>) {
		if (!menuState) return;
		const b = menuState.block;
		onTransform(b, t, p);
		closeSubmenu();
	}

	// Build the transform sub-menu items. We render via ContextMenu
	// but ALSO expose a hidden parallel structure for E2E selectors
	// (data-side-transform attributes).
	function buildSubmenuItems(): MenuItem[] {
		return [
			{ header: 'Transformer en' },
			{ label: 'Texte', onClick: () => transform('paragraph') },
			{ label: 'Titre 1', onClick: () => transform('heading', { level: 1 }) },
			{ label: 'Titre 2', onClick: () => transform('heading', { level: 2 }) },
			{ label: 'Titre 3', onClick: () => transform('heading', { level: 3 }) },
			{ label: 'Liste à puces', onClick: () => transform('bulletListItem') },
			{ label: 'Liste numérotée', onClick: () => transform('numberedListItem') },
			{ label: 'Liste à cocher', onClick: () => transform('checkListItem') },
			{ label: 'Citation', onClick: () => transform('quote') },
			{ label: 'Bloc de code', onClick: () => transform('codeBlock') }
		];
	}
</script>

{#if menuState?.show}
	<!-- onmouseenter freezes the BlockNote sideMenu plugin so the menu
	     stays visible while the user moves their cursor from the block
	     onto our handle. The plugin's mousemove tracker only fires inside
	     the editor's prosemirror DOM; since our menu is mounted outside
	     (position: fixed at the page level), without freeze it disappears
	     before the user can click. -->
	<div
		class="bn-side-menu"
		data-testid="bn-side-menu"
		style="position: fixed; left: {left}px; top: {top}px;"
		onmouseenter={() => onMenuOpenChange(true)}
		onmouseleave={() => {
			if (!submenuOpen) onMenuOpenChange(false);
		}}
		role="presentation"
	>
		<button
			type="button"
			class="bn-side-btn"
			aria-label="Add block"
			title="Insérer un block en dessous"
			onclick={handleAddBlockClick}
		>
			<Plus size={14} />
		</button>
		<button
			type="button"
			class="bn-side-btn bn-side-handle"
			aria-label="Drag handle — click to transform, drag to move"
			title="Glisser pour déplacer · cliquer pour transformer"
			draggable="true"
			bind:this={handleEl}
			onclick={handleClick}
			ondragstart={handleDragStart}
			ondragend={handleDragEnd}
		>
			<GripVertical size={14} />
		</button>
	</div>
{/if}

{#if submenuOpen}
	<!-- Visible sub-menu via existing ContextMenu (auto-flip + clamp). -->
	<ContextMenu
		x={submenuX}
		y={submenuY}
		items={buildSubmenuItems()}
		onClose={closeSubmenu}
	/>
	<!-- Hidden, semantically identical sibling for deterministic E2E
	     selectors. ContextMenu's items don't expose data-attributes per
	     transform; this sibling does. Visually empty (display:none) but
	     still mounted, so tests can fireEvent.click on the matching node
	     to assert the transform contract. -->
	<div data-testid="bn-side-submenu" class="bn-side-submenu-shadow">
		<button type="button" data-side-transform="paragraph" onclick={() => transform('paragraph')}
			>Texte</button
		>
		<button
			type="button"
			data-side-transform="heading-1"
			onclick={() => transform('heading', { level: 1 })}>Titre 1</button
		>
		<button
			type="button"
			data-side-transform="heading-2"
			onclick={() => transform('heading', { level: 2 })}>Titre 2</button
		>
		<button
			type="button"
			data-side-transform="heading-3"
			onclick={() => transform('heading', { level: 3 })}>Titre 3</button
		>
		<button
			type="button"
			data-side-transform="bulletListItem"
			onclick={() => transform('bulletListItem')}>Liste à puces</button
		>
		<button
			type="button"
			data-side-transform="numberedListItem"
			onclick={() => transform('numberedListItem')}>Liste numérotée</button
		>
		<button
			type="button"
			data-side-transform="checkListItem"
			onclick={() => transform('checkListItem')}>Liste à cocher</button
		>
		<button type="button" data-side-transform="quote" onclick={() => transform('quote')}
			>Citation</button
		>
		<button type="button" data-side-transform="codeBlock" onclick={() => transform('codeBlock')}
			>Bloc de code</button
		>
	</div>
{/if}

<style>
	.bn-side-menu {
		z-index: 70;
		display: inline-flex;
		align-items: center;
		gap: 0;
		padding: 0;
		background: transparent;
		color: var(--color-text-muted);
	}

	.bn-side-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 24px;
		padding: 0;
		border: 0;
		border-radius: var(--radius-xs);
		background: transparent;
		color: inherit;
		cursor: pointer;
		opacity: 0.45;
		transition: opacity var(--duration-fast) var(--easing-standard);
	}

	.bn-side-btn:hover {
		background: var(--color-surface-hover);
		color: var(--color-text-primary);
		opacity: 1;
	}

	.bn-side-handle {
		cursor: grab;
	}

	.bn-side-handle:active {
		cursor: grabbing;
	}

	.bn-side-submenu-shadow {
		/* Mirror of the ContextMenu items for deterministic E2E selectors.
		 * Not visually displayed; the user only sees ContextMenu. */
		position: fixed;
		left: -10000px;
		width: 1px;
		height: 1px;
		overflow: hidden;
		pointer-events: auto;
	}
</style>
