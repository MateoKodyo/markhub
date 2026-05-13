/**
 * Mode-switching prefixes for the command palette — VS Code / Sublime
 * convention: a single leading character flips the palette into the
 * corresponding mode without closing it.
 *
 *   '>' → command mode
 *   '@' → file mode
 *   '#' → search mode (requires an active vault, otherwise no-op)
 *
 * If the user is *already* in the target mode, the prefix stays in the
 * query as a regular character — useful for matching files literally
 * named "@home.md" or commands containing ">".
 *
 * Pure function so it's testable without standing up the palette UI.
 */

export type Mode = 'command' | 'file' | 'search';

export function detectModeSwitch(
	currentMode: Mode,
	query: string,
	hasActiveVault: boolean
): { mode: Mode; query: string } | null {
	if (query.length === 0) return null;
	const first = query.charAt(0);
	if (first === '>' && currentMode !== 'command') {
		return { mode: 'command', query: query.slice(1) };
	}
	if (first === '@' && currentMode !== 'file') {
		return { mode: 'file', query: query.slice(1) };
	}
	if (first === '#' && currentMode !== 'search' && hasActiveVault) {
		return { mode: 'search', query: query.slice(1) };
	}
	return null;
}
