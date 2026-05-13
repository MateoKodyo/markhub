import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from '../../src/lib/stores/toast.svelte';

describe('toastStore', () => {
	beforeEach(() => {
		toast.clearForTest();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		toast.clearForTest();
	});

	it('starts empty', () => {
		expect(toast.toasts).toEqual([]);
	});

	it('success() adds a toast with type=success', () => {
		const id = toast.success('Saved');
		expect(toast.toasts).toHaveLength(1);
		expect(toast.toasts[0]).toMatchObject({
			id,
			type: 'success',
			message: 'Saved',
			dismissible: true
		});
	});

	it('exposes the same shape for info / warning / error', () => {
		toast.info('hi');
		toast.warning('careful');
		toast.error('boom');
		expect(toast.toasts.map((t) => t.type)).toEqual([
			'info',
			'warning',
			'error'
		]);
	});

	it('accepts a `details` secondary line', () => {
		toast.error('Suppression échouée', { details: 'ENOENT' });
		expect(toast.toasts[0].details).toBe('ENOENT');
	});

	it('auto-dismisses after the default 3s duration', () => {
		toast.success('Saved');
		expect(toast.toasts).toHaveLength(1);
		vi.advanceTimersByTime(2999);
		expect(toast.toasts).toHaveLength(1);
		vi.advanceTimersByTime(2);
		expect(toast.toasts).toHaveLength(0);
	});

	it('honors a custom duration override', () => {
		toast.warning('Conflit', { duration: 5000 });
		vi.advanceTimersByTime(3000);
		expect(toast.toasts).toHaveLength(1);
		vi.advanceTimersByTime(2001);
		expect(toast.toasts).toHaveLength(0);
	});

	it('duration=0 disables the auto-dismiss timer (sticky toast)', () => {
		toast.error('Persistent', { duration: 0 });
		vi.advanceTimersByTime(60_000);
		expect(toast.toasts).toHaveLength(1);
	});

	it('dismiss(id) removes the toast immediately and cancels its timer', () => {
		const id = toast.success('Saved');
		toast.dismiss(id);
		expect(toast.toasts).toHaveLength(0);
		// Advancing time past the original duration must not do anything.
		vi.advanceTimersByTime(5000);
		expect(toast.toasts).toHaveLength(0);
	});

	it('dismiss(unknown-id) is a no-op', () => {
		toast.success('Saved');
		expect(() => toast.dismiss(9999)).not.toThrow();
		expect(toast.toasts).toHaveLength(1);
	});

	it('stacks newer toasts at the END of the list (most recent last)', () => {
		toast.success('First');
		toast.info('Second');
		toast.warning('Third');
		expect(toast.toasts.map((t) => t.message)).toEqual([
			'First',
			'Second',
			'Third'
		]);
	});

	it('issues a unique monotonic id for each toast', () => {
		const a = toast.success('A');
		const b = toast.success('B');
		const c = toast.success('C');
		expect([a, b, c]).toEqual([1, 2, 3]);
	});

	it('dismissible defaults to true and can be disabled', () => {
		toast.success('default');
		toast.success('sticky', { dismissible: false });
		expect(toast.toasts[0].dismissible).toBe(true);
		expect(toast.toasts[1].dismissible).toBe(false);
	});
});
