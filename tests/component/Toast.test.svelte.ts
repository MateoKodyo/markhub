import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import Toast from '../../src/lib/components/Toast.svelte';
import type { Toast as ToastType } from '../../src/lib/stores/toast.svelte';

const make = (overrides: Partial<ToastType> = {}): ToastType => ({
	id: 1,
	type: 'success',
	message: 'Saved',
	duration: 3000,
	dismissible: true,
	...overrides
});

describe('Toast', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders the message + a type stamp on the root element', () => {
		render(Toast, { toast: make(), onDismiss: vi.fn() });
		expect(screen.getByTestId('toast-message').textContent).toBe('Saved');
		expect(screen.getByTestId('toast').getAttribute('data-toast-type')).toBe(
			'success'
		);
	});

	it('renders the details line when provided', () => {
		render(Toast, {
			toast: make({ details: 'ENOENT' }),
			onDismiss: vi.fn()
		});
		expect(screen.getByTestId('toast-details').textContent).toBe('ENOENT');
	});

	it('omits the details line when not provided', () => {
		render(Toast, { toast: make(), onDismiss: vi.fn() });
		expect(screen.queryByTestId('toast-details')).toBeNull();
	});

	it('renders the close button when dismissible (default)', () => {
		render(Toast, { toast: make(), onDismiss: vi.fn() });
		expect(screen.getByTestId('toast-close')).toBeInTheDocument();
	});

	it('omits the close button when dismissible=false', () => {
		render(Toast, {
			toast: make({ dismissible: false }),
			onDismiss: vi.fn()
		});
		expect(screen.queryByTestId('toast-close')).toBeNull();
	});

	it('clicking close calls onDismiss with the toast id', async () => {
		const onDismiss = vi.fn();
		render(Toast, { toast: make({ id: 42 }), onDismiss });
		await fireEvent.click(screen.getByTestId('toast-close'));
		expect(onDismiss).toHaveBeenCalledWith(42);
	});

	it('uses role=alert for errors, role=status for the rest', () => {
		const { unmount } = render(Toast, {
			toast: make({ type: 'error' }),
			onDismiss: vi.fn()
		});
		expect(screen.getByTestId('toast').getAttribute('role')).toBe('alert');
		unmount();

		render(Toast, {
			toast: make({ type: 'success' }),
			onDismiss: vi.fn()
		});
		expect(screen.getByTestId('toast').getAttribute('role')).toBe('status');
	});

	it('stamps the type on data-toast-type for all four variants', () => {
		const types: ToastType['type'][] = ['success', 'info', 'warning', 'error'];
		for (const type of types) {
			const { unmount } = render(Toast, {
				toast: make({ type }),
				onDismiss: vi.fn()
			});
			expect(screen.getByTestId('toast').getAttribute('data-toast-type')).toBe(
				type
			);
			unmount();
		}
	});
});
