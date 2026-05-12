/**
 * Command registry — central index of every command surfaced by the app.
 *
 * Powers Cmd+K (command palette), feeds keyboard shortcuts via
 * `bindCommandKeymap`, and is the single place feature modules look up to
 * register a new command. Reactive on purpose: the palette UI re-renders
 * when commands appear/disappear.
 *
 * A command's `handler` is the only required side-effect; everything else
 * (icon, group, shortcut hint, visibility guard) is presentation/wiring.
 */

export interface Command {
	/** Unique identifier, dotted convention (e.g. "file.save"). */
	id: string;
	/** Primary text shown in the palette. */
	label: string;
	/** Secondary text (one-liner shown under the label). */
	description?: string;
	/** Grouping shown in the palette (e.g. "File", "View"). */
	group?: string;
	/** Lucide icon name (resolved at render time by the palette). */
	icon?: string;
	/** Display-only shortcut hint (e.g. "⌘S"). Binding lives in the keymap. */
	shortcut?: string;
	/** Effect to run when activated. May be async; return value ignored. */
	handler: () => void | Promise<void>;
	/** Optional visibility guard. False => the command is unavailable. */
	when?: () => boolean;
}

class CommandRegistry {
	/**
	 * Backing map. $state proxies Map mutations in Svelte 5, so `getAll()`
	 * and subscribers re-run when commands are registered or unregistered.
	 */
	#commands = $state(new Map<string, Command>());

	register(command: Command): void {
		this.#commands.set(command.id, command);
	}

	unregister(id: string): void {
		this.#commands.delete(id);
	}

	getById(id: string): Command | undefined {
		return this.#commands.get(id);
	}

	getAll(): Command[] {
		return Array.from(this.#commands.values());
	}

	getByGroup(group: string): Command[] {
		return this.getAll().filter((c) => c.group === group);
	}

	/** Test-only: clear all commands between tests. */
	resetForTest(): void {
		this.#commands.clear();
	}
}

export const commandRegistry = new CommandRegistry();
