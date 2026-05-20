/**
 * One-shot localStorage key migration.
 *
 * If `newKey` has no value yet but `oldKey` does, copy the value across
 * and delete the old entry. Idempotent — once the value lives under
 * `newKey`, subsequent calls are no-ops.
 *
 * Introduced for the 2026-05-20 Markhub → Markus rename: every
 * `markhub.*` persistence key became `markus.*`. Call this once, at
 * module init, before the first read of `newKey`.
 */
export function migrateLsKey(oldKey: string, newKey: string): void {
	if (typeof localStorage === 'undefined') return;
	try {
		if (localStorage.getItem(newKey) !== null) return;
		const legacy = localStorage.getItem(oldKey);
		if (legacy === null) return;
		localStorage.setItem(newKey, legacy);
		localStorage.removeItem(oldKey);
	} catch {
		/* localStorage unavailable / quota — ignore, callers fall back to defaults */
	}
}
