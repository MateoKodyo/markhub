/**
 * Ambient declaration for tinykeys v3.
 *
 * tinykeys ships its types in `dist/tinykeys.d.ts` but doesn't surface them
 * through its package `exports` map — so with `moduleResolution: "bundler"`
 * TypeScript can't resolve them. Mirror the public surface we use here.
 *
 * Drop this shim when tinykeys exposes the `types` condition in its exports.
 */
declare module 'tinykeys' {
	export interface KeyBindingMap {
		[keybinding: string]: (event: KeyboardEvent) => void;
	}

	export interface KeyBindingOptions {
		event?: 'keydown' | 'keyup';
		capture?: boolean;
		timeout?: number;
	}

	export function tinykeys(
		target: Window | HTMLElement,
		keyBindingMap: KeyBindingMap,
		options?: KeyBindingOptions
	): () => void;
}
