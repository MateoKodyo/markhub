import '@testing-library/jest-dom/vitest';

// Node 25+ ships a built-in `localStorage` global gated by an opaque
// `--localstorage-file` flag. Without that flag, the surface is partial
// (no `clear`, no `length`) AND it shadows jsdom's full implementation.
// Force a deterministic in-memory Storage so tests are isolated and the
// full contract is available.
class MemoryStorage {
	private store = new Map<string, string>();
	get length(): number {
		return this.store.size;
	}
	clear(): void {
		this.store.clear();
	}
	getItem(key: string): string | null {
		return this.store.has(key) ? (this.store.get(key) as string) : null;
	}
	key(index: number): string | null {
		return Array.from(this.store.keys())[index] ?? null;
	}
	removeItem(key: string): void {
		this.store.delete(key);
	}
	setItem(key: string, value: string): void {
		this.store.set(key, String(value));
	}
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).localStorage = new MemoryStorage();

// jsdom does not implement the Web Animations API, which Svelte 5's
// `transition:fade` / `transition:scale` directives depend on. Stub the
// minimum surface so transitions become instant no-ops in test runs.
if (typeof Element !== 'undefined' && !Element.prototype.animate) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	Element.prototype.animate = function (): any {
		const noop = () => {};
		return {
			cancel: noop,
			finish: noop,
			play: noop,
			pause: noop,
			reverse: noop,
			addEventListener: noop,
			removeEventListener: noop,
			dispatchEvent: () => false,
			finished: Promise.resolve(),
			ready: Promise.resolve(),
			playState: 'finished',
			currentTime: 0,
			startTime: null,
			playbackRate: 1,
			pending: false,
			effect: null,
			id: '',
			oncancel: null,
			onfinish: null,
			onremove: null,
			timeline: null,
			replaceState: 'active'
		};
	};
}
