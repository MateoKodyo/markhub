// Orchestre l'export markdown : ouvre le save dialog système, appelle la
// commande Rust si l'utilisateur a confirmé. Le caller décide quoi exporter
// (buffer BlockNote courant OU contenu lu depuis disque).

import { save } from '@tauri-apps/plugin-dialog';
import { fileExport } from '$lib/tauri/api';
import { toast } from '$lib/stores/toast.svelte';

export type ExportResult =
	| { canceled: true }
	| { canceled: false; path: string };

/**
 * Dérive un nom de fichier par défaut pour le dialog à partir du chemin
 * relatif du fichier source. Si on n'a pas de source (export d'un buffer
 * non encore sauvé), on retombe sur `untitled.md`.
 */
export function defaultExportFilename(relativePath: string | null | undefined): string {
	if (!relativePath) return 'untitled.md';
	const lastSlash = relativePath.lastIndexOf('/');
	const base = lastSlash >= 0 ? relativePath.slice(lastSlash + 1) : relativePath;
	if (!base) return 'untitled.md';
	// Garde le `.md` s'il y est, sinon on l'ajoute (le filter le suggère
	// déjà mais on évite "foo" → "foo" sans extension à la sortie).
	if (/\.(md|markdown)$/i.test(base)) return base;
	return `${base}.md`;
}

/**
 * Ouvre le save dialog système, puis appelle `fileExport` si l'utilisateur
 * a confirmé. Retourne `{ canceled: true }` si l'utilisateur a annulé,
 * `{ canceled: false, path }` si l'export a abouti.
 *
 * Errors propagate to the caller — laisse le UI afficher un toast.
 */
export async function pickAndExportMarkdown(
	content: string,
	defaultFilename: string
): Promise<ExportResult> {
	const target = await save({
		title: 'Exporter en Markdown',
		defaultPath: defaultFilename,
		filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
	});
	if (!target) return { canceled: true };
	await fileExport(content, target);
	return { canceled: false, path: target };
}

/**
 * Wrapper qui orchestre dialog + export + feedback toast. Centralisé pour
 * que les 3 entrées UI (palette, status bar, sidebar context menu) aient
 * exactement le même comportement utilisateur. Un cancel reste silencieux.
 */
export async function runExportWithToast(
	content: string,
	defaultFilename: string
): Promise<void> {
	try {
		const result = await pickAndExportMarkdown(content, defaultFilename);
		if (!result.canceled) {
			toast.success('Fichier exporté', { details: result.path });
		}
	} catch (e) {
		toast.error('Export impossible', { details: String(e) });
	}
}
