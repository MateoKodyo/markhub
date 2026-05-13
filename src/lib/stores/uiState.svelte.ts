/**
 * UI state — shared presentation state that more than one surface (page,
 * command palette, status bar) needs to read or mutate.
 *
 *   - `sidebarCollapsed` is session-only (no persistence yet).
 *   - `outlineOpen` IS persisted under `markhub.ui.outlineOpen.v1` so
 *     the panel state survives reloads. Default: closed.
 */

const LS_OUTLINE_KEY = 'markhub.ui.outlineOpen.v1';

function readOutlineInitial(): boolean {
	if (typeof localStorage === 'undefined') return false;
	return localStorage.getItem(LS_OUTLINE_KEY) === 'true';
}

class UiStateStore {
	sidebarCollapsed = $state(false);
	outlineOpen = $state<boolean>(readOutlineInitial());

	toggleSidebar(): void {
		this.sidebarCollapsed = !this.sidebarCollapsed;
	}

	toggleOutline(): void {
		this.outlineOpen = !this.outlineOpen;
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(LS_OUTLINE_KEY, this.outlineOpen ? 'true' : 'false');
		}
	}
}

export const uiStateStore = new UiStateStore();
