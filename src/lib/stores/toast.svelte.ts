/**
 * Toast store — reactive list of transient notifications shown bottom-right
 * by `<ToastContainer />`. Each entry auto-dismisses after `duration` ms
 * unless the user manually closes it.
 *
 * API (consumed by feature handlers — see WORKPLAN.md chantier C2):
 *
 *     toast.success('Fichier sauvegardé');
 *     toast.error('Suppression échouée', { details: e.message });
 *     toast.info('Vault retiré');
 *     toast.warning('Conflit de nom', { duration: 5000 });
 *
 * Options:
 *   - `details?: string`     secondary line under the title
 *   - `duration?: number`    auto-dismiss ms (default 3000)
 *   - `dismissible?: boolean` show the × close button (default true)
 *
 * The store IDs each toast uniquely (monotonic counter) so the
 * container can `{#each ... (id)}` and animate stable rows.
 */

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export type ToastOptions = {
	details?: string;
	duration?: number;
	dismissible?: boolean;
};

export type Toast = {
	id: number;
	type: ToastType;
	message: string;
	details?: string;
	duration: number;
	dismissible: boolean;
};

const DEFAULT_DURATION_MS = 3000;

class ToastStore {
	toasts = $state<Toast[]>([]);
	#nextId = 1;
	#timers = new Map<number, ReturnType<typeof setTimeout>>();

	#add(type: ToastType, message: string, options: ToastOptions = {}): number {
		const id = this.#nextId++;
		const duration = options.duration ?? DEFAULT_DURATION_MS;
		const t: Toast = {
			id,
			type,
			message,
			details: options.details,
			duration,
			dismissible: options.dismissible !== false
		};
		this.toasts = [...this.toasts, t];
		if (duration > 0) {
			const timer = setTimeout(() => this.dismiss(id), duration);
			this.#timers.set(id, timer);
		}
		return id;
	}

	success(message: string, options?: ToastOptions): number {
		return this.#add('success', message, options);
	}

	info(message: string, options?: ToastOptions): number {
		return this.#add('info', message, options);
	}

	warning(message: string, options?: ToastOptions): number {
		return this.#add('warning', message, options);
	}

	error(message: string, options?: ToastOptions): number {
		return this.#add('error', message, options);
	}

	dismiss(id: number): void {
		const timer = this.#timers.get(id);
		if (timer) {
			clearTimeout(timer);
			this.#timers.delete(id);
		}
		this.toasts = this.toasts.filter((t) => t.id !== id);
	}

	/** Test-only: clear every toast and pending timer. */
	clearForTest(): void {
		for (const timer of this.#timers.values()) clearTimeout(timer);
		this.#timers.clear();
		this.toasts = [];
		this.#nextId = 1;
	}
}

export const toast = new ToastStore();
