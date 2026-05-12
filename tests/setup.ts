import '@testing-library/jest-dom/vitest';

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
