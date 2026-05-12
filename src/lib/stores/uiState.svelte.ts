/**
 * UI state — shared, non-persistent presentation state that more than one
 * surface (page, command palette, status bar) needs to read or mutate.
 *
 * Today: just `sidebarCollapsed`. Lifted out of `+page.svelte` so commands
 * (Cmd+K → "Toggle Sidebar") can reach it without prop-drilling.
 */

class UiStateStore {
	sidebarCollapsed = $state(false);

	toggleSidebar(): void {
		this.sidebarCollapsed = !this.sidebarCollapsed;
	}
}

export const uiStateStore = new UiStateStore();
