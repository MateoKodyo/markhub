/**
 * Keymap — binds keyboard shortcuts to command IDs, dispatching through
 * the registry at fire time (so registering or guarding a command after
 * the keymap is bound still works).
 *
 * Shortcut strings follow tinykeys syntax. Prefer `$mod` over `Control`
 * for cross-platform Cmd/Ctrl handling. Examples:
 *
 *   "$mod+s"          // Cmd-S on macOS, Ctrl-S elsewhere
 *   "$mod+Shift+f"    // global search
 *   "$mod+k"          // command palette
 *
 * Returns a cleanup function that unbinds every shortcut.
 */

import { tinykeys } from 'tinykeys';
import { commandRegistry } from './registry.svelte';

/** Map of shortcut string → command id resolved against the registry. */
export type CommandKeymap = Record<string, string>;

export function bindCommandKeymap(
	bindings: CommandKeymap,
	target: Window | HTMLElement = typeof window !== 'undefined'
		? window
		: (undefined as unknown as Window)
): () => void {
	const tinyMap: Record<string, (event: KeyboardEvent) => void> = {};

	for (const [shortcut, commandId] of Object.entries(bindings)) {
		tinyMap[shortcut] = (event) => {
			const cmd = commandRegistry.getById(commandId);
			if (!cmd) return;
			if (cmd.when && !cmd.when()) return;
			event.preventDefault();
			void cmd.handler();
		};
	}

	return tinykeys(target, tinyMap);
}
