/**
 * aiAwareStore — PLAN-AI-READY STEP 2.
 *
 * Reactive cache of AI-aware detection results for the *current vault*,
 * keyed by vault-relative file path. The cache is rebuilt wholesale on
 * every vault scan (vault switch, file create / rename / delete) and
 * patched per-file on save.
 *
 * Only AI-aware files get an entry — an absent key means "ordinary
 * file", which `getForFile` reports as `null`. Storing 500+ explicit
 * `null`s for a normal vault would bloat the map for no observable gain.
 *
 * Detection is deterministic and offline (see `ai-ready/detector.ts`):
 * no file content ever leaves the machine.
 */
import { SvelteMap } from 'svelte/reactivity';
import { detectAiAware, type AiAwareInfo } from '$lib/ai-ready/detector';
import { parseFrontmatter } from '$lib/frontmatter/parser';
import { splitFrontmatter } from '$lib/utils/markdown';
import type { FileEntry } from '$lib/tauri/types';

export type AiAwareEntry = { path: string; info: AiAwareInfo };

/** Parse a raw YAML frontmatter block into a record, or `null` on
 *  malformed YAML — a broken frontmatter is simply "not AI-aware". */
function frontmatterRecord(raw: string | null): Record<string, unknown> | null {
	if (raw == null) return null;
	const res = parseFrontmatter(raw);
	return res.ok ? res.data : null;
}

class AiAwareStore {
	// SvelteMap (not `$state(new Map())`) — `$state` does not make a Map's
	// contents reactive, so `.get()` reads in components would never re-run
	// when `.set()` / `.clear()` mutate it.
	#entries = new SvelteMap<string, AiAwareInfo>();

	/** Detection result for one file, or `null` for ordinary files. */
	getForFile(relativePath: string): AiAwareInfo | null {
		return this.#entries.get(relativePath) ?? null;
	}

	/** Every AI-aware file currently known, in insertion order. */
	getAllAiAware(): AiAwareEntry[] {
		return [...this.#entries.entries()].map(([path, info]) => ({ path, info }));
	}

	/** AI-aware files whose info satisfies `predicate`. */
	getMatching(predicate: (info: AiAwareInfo) => boolean): AiAwareEntry[] {
		return this.getAllAiAware().filter((e) => predicate(e.info));
	}

	set(relativePath: string, info: AiAwareInfo): void {
		this.#entries.set(relativePath, info);
	}

	delete(relativePath: string): void {
		this.#entries.delete(relativePath);
	}

	clear(): void {
		this.#entries.clear();
	}

	/**
	 * Rebuild the whole cache from a freshly scanned vault tree. Walks
	 * every file, runs the detector against its (Rust-extracted)
	 * frontmatter, and keeps only the AI-aware hits. Idempotent — called
	 * from both vault-scan paths (Sidebar tree, palette `vaultTreeStore`).
	 */
	syncFromTree(tree: FileEntry | null): void {
		this.#entries.clear();
		if (!tree) return;
		const walk = (entry: FileEntry) => {
			if (entry.isDirectory) {
				entry.children?.forEach(walk);
				return;
			}
			const fm = frontmatterRecord(entry.frontmatter ?? null);
			const info = detectAiAware(entry.name, entry.relativePath, fm);
			if (info) this.#entries.set(entry.relativePath, info);
		};
		walk(tree);
	}

	/**
	 * Re-detect a single file after its content was saved. A save mutates
	 * content without re-scanning the tree, so the frontmatter must be
	 * re-derived from the freshly saved `content`.
	 */
	updateForFile(relativePath: string, content: string): void {
		const filename = relativePath.split('/').pop() ?? relativePath;
		const fm = frontmatterRecord(splitFrontmatter(content).frontmatter);
		const info = detectAiAware(filename, relativePath, fm);
		if (info) this.#entries.set(relativePath, info);
		else this.#entries.delete(relativePath);
	}
}

export const aiAwareStore = new AiAwareStore();
