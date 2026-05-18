/**
 * Dev-only debug shortcut — cycles through the 6 light themes for
 * smoke-testing palette work without opening the Settings picker.
 *
 * PLAN-LIGHT-THEMES §STEP 3. Trigger is Cmd+Shift+T (Ctrl+Shift+T on
 * non-mac). The cycle is fixed in palette order:
 *   markhub-light → terracotta → rose → amber → ink → plum → wrap.
 *
 * Behavior:
 *   - No persistence. Only writes `<html data-theme="...">`. Refresh
 *     resets to whatever the settings store says.
 *   - Skips the runtime theme manager entirely so it doesn't fight
 *     the user's actual preference.
 *   - Shows a 1.5s toast with the active theme name as feedback.
 *
 * Production safety:
 *   - The caller MUST gate registration with `if (import.meta.env.DEV)`
 *     so Vite strips this module from the production bundle. The
 *     install function intentionally has no internal guard — that
 *     would mask call-site mistakes that ship the shortcut anyway.
 */

import { toast } from '$lib/stores/toast.svelte';
import { getThemeMeta, type ThemeId } from '$lib/theming/catalog';

const CYCLE: readonly ThemeId[] = [
	'markhub-light',
	'terracotta',
	'rose',
	'amber',
	'ink',
	'plum'
] as const;

function nextThemeId(current: string | null): ThemeId {
	if (!current) return CYCLE[0];
	const idx = CYCLE.indexOf(current as ThemeId);
	// If the current attribute holds a dark theme (or anything outside the
	// light cycle), jumping to the first light theme is the right move —
	// it surfaces the cycle without an awkward "no-op" first press.
	if (idx < 0) return CYCLE[0];
	return CYCLE[(idx + 1) % CYCLE.length];
}

/**
 * Install the Cmd+Shift+T (Ctrl+Shift+T elsewhere) light-theme cycler.
 * Returns a teardown function for the caller to call on component
 * destroy. The handler stops propagation so it can't be swallowed by
 * a different shortcut binding the same combo.
 */
export function installThemeCycler(): () => void {
	function onKeydown(e: KeyboardEvent) {
		const cmd = e.metaKey || e.ctrlKey;
		if (!cmd || !e.shiftKey || e.altKey) return;
		// `key` is the printable character; uppercase on shift means "T".
		if (e.key !== 'T' && e.key !== 't') return;
		e.preventDefault();
		e.stopPropagation();

		const root = document.documentElement;
		const current = root.getAttribute('data-theme');
		const next = nextThemeId(current);
		root.setAttribute('data-theme', next);

		const meta = getThemeMeta(next);
		toast.info(`Thème : ${meta.name}`, { duration: 1500 });
	}

	window.addEventListener('keydown', onKeydown, { capture: true });
	return () => window.removeEventListener('keydown', onKeydown, { capture: true });
}
