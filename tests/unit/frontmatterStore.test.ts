import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FrontmatterStore } from '../../src/lib/stores/frontmatter.svelte';

/**
 * Contract tests for the rune-based frontmatter store. We instantiate a
 * fresh `FrontmatterStore` per test rather than reaching for the singleton —
 * the singleton is exported for app code but its internal `$state` would
 * leak between tests, and re-instantiating is cheap.
 */
describe('FrontmatterStore', () => {
	let store: FrontmatterStore;

	beforeEach(() => {
		store = new FrontmatterStore();
	});

	it('exposes the documented initial state', () => {
		expect(store.data).toEqual({});
		expect(store.mode).toBe('read');
		expect(store.collapsed).toBe(false);
		expect(store.parseError).toBeNull();
		expect(store.dirty).toBe(false);
	});

	it('loadFromYaml() on valid input populates data and resets transient flags', () => {
		store.parseError = 'stale';
		store.mode = 'edit-raw';
		store.dirty = true;

		store.loadFromYaml('title: Hello\ncount: 3');

		expect(store.data).toEqual({ title: 'Hello', count: 3 });
		expect(store.parseError).toBeNull();
		expect(store.mode).toBe('read');
		expect(store.dirty).toBe(false);
	});

	it('loadFromYaml() on invalid input sets parseError and keeps previous data', () => {
		store.loadFromYaml('title: Hello');
		expect(store.data).toEqual({ title: 'Hello' });

		store.loadFromYaml('- bad\n  - sequence-at-root');
		expect(store.parseError).toBeTruthy();
		// Previous data must survive — the structured editor relies on this
		// when the user briefly types invalid YAML in raw mode.
		expect(store.data).toEqual({ title: 'Hello' });
	});

	it('loadFromYaml() with empty input yields an empty object and no error', () => {
		store.loadFromYaml('');
		expect(store.data).toEqual({});
		expect(store.parseError).toBeNull();
		expect(store.mode).toBe('read');
		expect(store.dirty).toBe(false);
	});

	it('setData() marks the store dirty and notifies serialized listeners', () => {
		const listener = vi.fn();
		store.onSerializedChange(listener);

		store.setData({ title: 'New' });

		expect(store.data).toEqual({ title: 'New' });
		expect(store.dirty).toBe(true);
		expect(listener).toHaveBeenCalledTimes(1);
		const yaml = listener.mock.calls[0][0];
		expect(typeof yaml).toBe('string');
		expect(yaml).toContain('title: New');
	});

	it('setMode() updates the mode without touching data, dirty, or parseError', () => {
		store.setData({ title: 'Hello' });
		const dataBefore = store.data;
		store.dirty = false; // simulate a save flushing the dirty flag

		store.setMode('edit-structured');
		expect(store.mode).toBe('edit-structured');
		expect(store.data).toBe(dataBefore);
		expect(store.dirty).toBe(false);
		expect(store.parseError).toBeNull();

		store.setMode('edit-raw');
		expect(store.mode).toBe('edit-raw');

		store.setMode('read');
		expect(store.mode).toBe('read');
	});

	it('setCollapsed() toggles the collapsed boolean', () => {
		expect(store.collapsed).toBe(false);
		store.setCollapsed(true);
		expect(store.collapsed).toBe(true);
		store.setCollapsed(false);
		expect(store.collapsed).toBe(false);
	});

	it('onSerializedChange() returns an unsubscribe that prevents further calls', () => {
		const listener = vi.fn();
		const unsubscribe = store.onSerializedChange(listener);

		store.setData({ a: 1 });
		expect(listener).toHaveBeenCalledTimes(1);

		unsubscribe();

		store.setData({ a: 2 });
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('onSerializedChange() supports multiple independent listeners', () => {
		const a = vi.fn();
		const b = vi.fn();
		store.onSerializedChange(a);
		store.onSerializedChange(b);

		store.setData({ key: 'value' });

		expect(a).toHaveBeenCalledTimes(1);
		expect(b).toHaveBeenCalledTimes(1);
	});
});
