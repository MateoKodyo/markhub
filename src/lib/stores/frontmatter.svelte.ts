/**
 * Frontmatter store — reactive state for the per-file YAML frontmatter UI.
 *
 * The store keeps three pieces of state in lockstep:
 *   - `data`         the parsed YAML object (the source of truth the UI edits)
 *   - `mode`         which view is showing: read-only, structured editor, raw editor
 *   - `collapsed`    whether the frontmatter pane is folded away in the editor
 *   - `parseError`   non-null when the last `loadFromYaml` failed; the UI uses
 *                    this to switch to a raw-text fallback
 *   - `dirty`        true when `setData` has been called since the last load,
 *                    so the autosave layer knows the document needs writing
 *
 * The serializer hook (`onSerializedChange`) is how this store stays decoupled
 * from the file/tab store: callers register a listener, and every `setData`
 * fires it with the freshly-serialized YAML. STEP 1 stops here — Step 6 of
 * the plan will wire that listener to disk via the tab store.
 *
 * Persistence note: `collapsed` is *not* persisted in this step. Step 6 adds
 * a per-file preference for it; until then it defaults to `false` and lives
 * purely in memory.
 */
import {
	parseFrontmatter,
	serializeFrontmatter
} from '$lib/frontmatter/parser';

export type FrontmatterMode = 'read' | 'edit-structured' | 'edit-raw';

export type FrontmatterState = {
	data: Record<string, unknown>;
	mode: FrontmatterMode;
	collapsed: boolean;
	parseError: string | null;
	dirty: boolean;
};

type SerializedListener = (yaml: string) => void;

export class FrontmatterStore {
	data = $state<Record<string, unknown>>({});
	mode = $state<FrontmatterMode>('read');
	collapsed = $state<boolean>(false);
	parseError = $state<string | null>(null);
	dirty = $state<boolean>(false);

	#listeners = new Set<SerializedListener>();

	setMode(mode: FrontmatterMode): void {
		this.mode = mode;
	}

	setData(data: Record<string, unknown>): void {
		this.data = data;
		this.dirty = true;
		const serialized = serializeFrontmatter(data);
		// Iterating over a snapshot so a listener unsubscribing itself during
		// the call doesn't skip the next listener in the set.
		for (const cb of Array.from(this.#listeners)) {
			cb(serialized);
		}
	}

	setCollapsed(value: boolean): void {
		this.collapsed = value;
	}

	loadFromYaml(yaml: string): void {
		const result = parseFrontmatter(yaml);
		if (result.ok) {
			this.data = result.data;
			this.parseError = null;
			this.mode = 'read';
			this.dirty = false;
		} else {
			// Keep the previous `data` so the structured editor (if it was
			// open) doesn't lose its current values when the user types
			// something briefly invalid in raw mode.
			this.parseError = result.error;
		}
	}

	onSerializedChange(cb: SerializedListener): () => void {
		this.#listeners.add(cb);
		return () => {
			this.#listeners.delete(cb);
		};
	}

	/** Test-only: hard reset so each `it()` starts from the documented defaults. */
	resetForTest(): void {
		this.data = {};
		this.mode = 'read';
		this.collapsed = false;
		this.parseError = null;
		this.dirty = false;
		this.#listeners.clear();
	}
}

export const frontmatterStore = new FrontmatterStore();
