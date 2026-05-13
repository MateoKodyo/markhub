/**
 * Palette store — owns the open/close state and the currently active
 * mode for the command palette so the catalogue can drive it (and so
 * other surfaces can read its state without going through +page).
 *
 * Each `open(mode)` resets query + selection + itemCount so a fresh
 * session starts from a known baseline regardless of which mode it
 * comes from. `close()` flips `open` off; the parent's transitions
 * handle the fade/scale out.
 */

export type PaletteMode = 'command' | 'file' | 'search';

class PaletteStore {
	isOpen = $state(false);
	mode = $state<PaletteMode>('command');
	query = $state('');
	selectedIndex = $state(0);
	itemCount = $state(0);

	open(mode: PaletteMode): void {
		this.mode = mode;
		this.query = '';
		this.selectedIndex = 0;
		this.itemCount = 0;
		this.isOpen = true;
	}

	close(): void {
		this.isOpen = false;
	}
}

export const paletteStore = new PaletteStore();
