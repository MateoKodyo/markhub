// Vault accent palette.
// design.md is monochromatic warm-grays — no accent palette defined. We need
// vault-distinguishing dots, so this is a deliberate, scoped extension:
// 6 muted Tailwind-400 shades that read well on the warm-dark canvas.
// See BACKLOG: a "custom color picker" lets users override per vault.

export const VAULT_PALETTE: readonly string[] = [
	'#A78BFA', // violet-400 — warm-leaning purple
	'#60A5FA', // blue-400 — matches accent family
	'#34D399', // emerald-400
	'#FBBF24', // amber-400 — warm
	'#F472B6', // pink-400 — warm
	'#22D3EE' // cyan-400 — slight cool counterweight
] as const;

/**
 * Pick the next color in the palette by rotating on the current vault count.
 * 0-indexed: `pickNextColor(0)` returns palette[0], `pickNextColor(7)` wraps.
 */
export function pickNextColor(currentVaultsCount: number): string {
	if (!Number.isFinite(currentVaultsCount) || currentVaultsCount < 0) {
		return VAULT_PALETTE[0];
	}
	return VAULT_PALETTE[currentVaultsCount % VAULT_PALETTE.length];
}
