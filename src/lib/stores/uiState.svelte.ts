/**
 * UI state — shared presentation state that more than one surface (page,
 * command palette, status bar) needs to read or mutate.
 *
 *   - `sidebarCollapsed` is session-only (no persistence yet).
 *   - `outlineOpen` IS persisted under `markus.ui.outlineOpen.v1` so
 *     the panel state survives reloads. Default: closed.
 *   - `sidebarWidth` / `outlineWidth` IS persisted (user dragged values
 *     under `markus.ui.sidebarWidth.v1` / `…outlineWidth.v1`).
 */

import { migrateLsKey } from '$lib/utils/migrateLsKey';

const LS_OUTLINE_KEY = 'markus.ui.outlineOpen.v1';
const LS_SIDEBAR_W_KEY = 'markus.ui.sidebarWidth.v1';
const LS_OUTLINE_W_KEY = 'markus.ui.outlineWidth.v1';
const LS_VAULTS_H_KEY = 'markus.ui.vaultsHeight.v1';

// Markhub → Markus rename (2026-05-20): pull the persisted UI state
// forward from the legacy `markhub.ui.*` keys before the first read.
migrateLsKey('markhub.ui.outlineOpen.v1', LS_OUTLINE_KEY);
migrateLsKey('markhub.ui.sidebarWidth.v1', LS_SIDEBAR_W_KEY);
migrateLsKey('markhub.ui.outlineWidth.v1', LS_OUTLINE_W_KEY);
migrateLsKey('markhub.ui.vaultsHeight.v1', LS_VAULTS_H_KEY);

const DEFAULT_SIDEBAR_WIDTH = 240;
const DEFAULT_OUTLINE_WIDTH = 260;
const DEFAULT_VAULTS_HEIGHT = 200;

export const SIDEBAR_MIN_WIDTH = 180;
export const SIDEBAR_MAX_WIDTH = 480;
export const OUTLINE_MIN_WIDTH = 200;
export const OUTLINE_MAX_WIDTH = 480;
export const VAULTS_MIN_HEIGHT = 80;
export const VAULTS_MAX_HEIGHT = 600;

function readOutlineInitial(): boolean {
	if (typeof localStorage === 'undefined') return false;
	return localStorage.getItem(LS_OUTLINE_KEY) === 'true';
}

function readWidth(key: string, defaultValue: number, min: number, max: number): number {
	if (typeof localStorage === 'undefined') return defaultValue;
	const raw = localStorage.getItem(key);
	if (!raw) return defaultValue;
	const n = parseInt(raw, 10);
	if (!Number.isFinite(n)) return defaultValue;
	return Math.max(min, Math.min(max, n));
}

class UiStateStore {
	sidebarCollapsed = $state(false);
	outlineOpen = $state<boolean>(readOutlineInitial());
	sidebarWidth = $state<number>(
		readWidth(LS_SIDEBAR_W_KEY, DEFAULT_SIDEBAR_WIDTH, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH)
	);
	outlineWidth = $state<number>(
		readWidth(LS_OUTLINE_W_KEY, DEFAULT_OUTLINE_WIDTH, OUTLINE_MIN_WIDTH, OUTLINE_MAX_WIDTH)
	);
	vaultsHeight = $state<number>(
		readWidth(LS_VAULTS_H_KEY, DEFAULT_VAULTS_HEIGHT, VAULTS_MIN_HEIGHT, VAULTS_MAX_HEIGHT)
	);

	toggleSidebar(): void {
		this.sidebarCollapsed = !this.sidebarCollapsed;
	}

	toggleOutline(): void {
		this.outlineOpen = !this.outlineOpen;
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(LS_OUTLINE_KEY, this.outlineOpen ? 'true' : 'false');
		}
	}

	setSidebarWidth(px: number): void {
		const clamped = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, px));
		this.sidebarWidth = clamped;
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(LS_SIDEBAR_W_KEY, String(clamped));
		}
	}

	setOutlineWidth(px: number): void {
		const clamped = Math.max(OUTLINE_MIN_WIDTH, Math.min(OUTLINE_MAX_WIDTH, px));
		this.outlineWidth = clamped;
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(LS_OUTLINE_W_KEY, String(clamped));
		}
	}

	setVaultsHeight(px: number): void {
		const clamped = Math.max(VAULTS_MIN_HEIGHT, Math.min(VAULTS_MAX_HEIGHT, px));
		this.vaultsHeight = clamped;
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(LS_VAULTS_H_KEY, String(clamped));
		}
	}
}

export const uiStateStore = new UiStateStore();
