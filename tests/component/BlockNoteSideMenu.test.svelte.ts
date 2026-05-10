import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import BlockNoteSideMenu from '../../src/lib/components/BlockNoteSideMenu.svelte';

// C1 / Étape 2.5.c — Svelte UI for BlockNote's SideMenu plugin.
// The component is pure presentation: it takes the plugin store payload
// (block + referencePos + show) and 5 callbacks. HTML5 native drag is
// reported back via onDragStart/onDragEnd (the host calls the plugin's
// `blockDragStart`/`blockDragEnd`); transforms via onTransform.

const refPos = (): DOMRect =>
	({
		top: 200,
		left: 100,
		bottom: 220,
		right: 200,
		width: 8,
		height: 24,
		x: 100,
		y: 200,
		toJSON() {
			return this;
		}
	}) as DOMRect;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const block = (id = 'b1', type = 'paragraph'): any => ({
	id,
	type,
	props: {},
	content: [],
	children: []
});

describe('BlockNoteSideMenu', () => {
	it('renders nothing when state is null', () => {
		render(BlockNoteSideMenu, { menuState:null });
		expect(screen.queryByTestId('bn-side-menu')).toBeNull();
	});

	it('renders nothing when state.show is false', () => {
		render(BlockNoteSideMenu, {
			menuState: { block: block(), referencePos: refPos(), show: false }
		});
		expect(screen.queryByTestId('bn-side-menu')).toBeNull();
	});

	it('renders the + and ⋮⋮ buttons when state.show is true', () => {
		render(BlockNoteSideMenu, {
			menuState: { block: block(), referencePos: refPos(), show: true }
		});
		expect(screen.getByTestId('bn-side-menu')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /add block/i })).toBeInTheDocument();
		const handle = screen.getByRole('button', { name: /drag/i });
		expect(handle).toBeInTheDocument();
		expect(handle.getAttribute('draggable')).toBe('true');
	});

	it('positions the menu to the left of referencePos', () => {
		render(BlockNoteSideMenu, {
			menuState: { block: block(), referencePos: refPos(), show: true }
		});
		const menu = screen.getByTestId('bn-side-menu') as HTMLElement;
		expect(menu.style.position).toBe('fixed');
		expect(menu.style.top).toBe('200px');
		const leftPx = parseInt(menu.style.left, 10);
		expect(leftPx).toBeLessThan(100);
	});

	it('forwards dragstart on the handle to onDragStart with the block', async () => {
		const onDragStart = vi.fn();
		const b = block('b42', 'heading');
		render(BlockNoteSideMenu, {
			menuState: { block: b, referencePos: refPos(), show: true },
			onDragStart
		});
		await fireEvent.dragStart(screen.getByRole('button', { name: /drag/i }));
		expect(onDragStart).toHaveBeenCalledTimes(1);
		expect(onDragStart.mock.calls[0][1]).toBe(b);
	});

	it('forwards dragend to onDragEnd', async () => {
		const onDragEnd = vi.fn();
		render(BlockNoteSideMenu, {
			menuState: { block: block(), referencePos: refPos(), show: true },
			onDragEnd
		});
		await fireEvent.dragEnd(screen.getByRole('button', { name: /drag/i }));
		expect(onDragEnd).toHaveBeenCalledTimes(1);
	});

	it('calls onAddBlock with the current block when + is clicked', async () => {
		const onAddBlock = vi.fn();
		const b = block('b7');
		render(BlockNoteSideMenu, {
			menuState: { block: b, referencePos: refPos(), show: true },
			onAddBlock
		});
		await fireEvent.click(screen.getByRole('button', { name: /add block/i }));
		expect(onAddBlock).toHaveBeenCalledWith(b);
	});

	it('opens the transform sub-menu when ⋮⋮ is clicked (without drag)', async () => {
		const onMenuOpenChange = vi.fn();
		render(BlockNoteSideMenu, {
			menuState: { block: block(), referencePos: refPos(), show: true },
			onMenuOpenChange
		});
		// Sub-menu hidden initially.
		expect(screen.queryByTestId('bn-side-submenu')).toBeNull();

		await fireEvent.click(screen.getByRole('button', { name: /drag/i }));
		expect(screen.getByTestId('bn-side-submenu')).toBeInTheDocument();
		expect(onMenuOpenChange).toHaveBeenLastCalledWith(true);
	});

	it('renders the 8 transform items in the sub-menu', async () => {
		render(BlockNoteSideMenu, {
			menuState: { block: block(), referencePos: refPos(), show: true }
		});
		await fireEvent.click(screen.getByRole('button', { name: /drag/i }));
		const submenu = screen.getByTestId('bn-side-submenu');
		// Order from the brief: Texte / Titre 1 / Titre 2 / Titre 3 /
		// Liste à puces / Liste numérotée / Citation / Bloc de code.
		expect(submenu).toHaveTextContent(/texte/i);
		expect(submenu).toHaveTextContent(/titre 1/i);
		expect(submenu).toHaveTextContent(/titre 2/i);
		expect(submenu).toHaveTextContent(/titre 3/i);
		expect(submenu).toHaveTextContent(/liste à puces/i);
		expect(submenu).toHaveTextContent(/liste numérotée/i);
		expect(submenu).toHaveTextContent(/citation/i);
		expect(submenu).toHaveTextContent(/bloc de code/i);
	});

	it('calls onTransform with (block, type, props?) when each item is clicked', async () => {
		const onTransform = vi.fn();
		const b = block('bX');
		render(BlockNoteSideMenu, {
			menuState: { block: b, referencePos: refPos(), show: true },
			onTransform
		});
		await fireEvent.click(screen.getByRole('button', { name: /drag/i }));
		const submenu = screen.getByTestId('bn-side-submenu');
		// "Titre 2" → ('heading', { level: 2 }).
		const titre2 = submenu.querySelector(
			'[data-side-transform="heading-2"]'
		) as HTMLElement | null;
		expect(titre2).not.toBeNull();
		await fireEvent.click(titre2!);
		expect(onTransform).toHaveBeenCalledWith(b, 'heading', { level: 2 });
	});

	it('notifies onMenuOpenChange(false) when the sub-menu closes', async () => {
		const onMenuOpenChange = vi.fn();
		const onTransform = vi.fn();
		render(BlockNoteSideMenu, {
			menuState: { block: block(), referencePos: refPos(), show: true },
			onMenuOpenChange,
			onTransform
		});
		await fireEvent.click(screen.getByRole('button', { name: /drag/i }));
		expect(onMenuOpenChange).toHaveBeenLastCalledWith(true);

		// Click on "Texte" — sub-menu must close.
		const submenu = screen.getByTestId('bn-side-submenu');
		const texte = submenu.querySelector(
			'[data-side-transform="paragraph"]'
		) as HTMLElement | null;
		expect(texte).not.toBeNull();
		await fireEvent.click(texte!);
		expect(onTransform).toHaveBeenCalledWith(expect.anything(), 'paragraph', undefined);
		expect(onMenuOpenChange).toHaveBeenLastCalledWith(false);
	});
});
