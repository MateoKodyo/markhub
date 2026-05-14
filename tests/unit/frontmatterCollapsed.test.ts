import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Tauri API so the disk-write path doesn't hit `invoke()` (which
// would reject in vitest with no Tauri runtime). We capture every write to
// verify the debounce / migration behavior.
const writeMock = vi.fn().mockResolvedValue(undefined);
const readMock = vi.fn().mockResolvedValue({});
vi.mock('../../src/lib/tauri/api', () => ({
	frontmatterStateRead: () => readMock(),
	frontmatterStateWrite: (state: Record<string, boolean>) => writeMock(state)
}));

import {
	flushForTest,
	getCollapsed,
	init,
	resetForTest,
	setCollapsed
} from '../../src/lib/stores/frontmatterCollapsed.svelte';

describe('frontmatterCollapsed — per-file persistence', () => {
	beforeEach(() => {
		resetForTest();
		writeMock.mockClear();
		readMock.mockReset().mockResolvedValue({});
	});

	it('returns the default (collapsed=true) for an unknown fileKey', () => {
		expect(getCollapsed('vault-a::notes/x.md')).toBe(true);
	});

	it('persists a toggle and reads it back', () => {
		setCollapsed('vault-a::notes/x.md', false);
		expect(getCollapsed('vault-a::notes/x.md')).toBe(false);
	});

	it('keeps states independent across fileKeys', () => {
		setCollapsed('vault-a::a.md', false);
		setCollapsed('vault-b::b.md', true);
		expect(getCollapsed('vault-a::a.md')).toBe(false);
		expect(getCollapsed('vault-b::b.md')).toBe(true);
		expect(getCollapsed('vault-c::c.md')).toBe(true);
	});

	it('overwrites the value on a second toggle', () => {
		setCollapsed('k', false);
		setCollapsed('k', true);
		expect(getCollapsed('k')).toBe(true);
	});

	// ------ STEP 6 — disk persistence ------

	it('init() loads the persisted map from disk', async () => {
		readMock.mockResolvedValue({
			'vault-x::one.md': false,
			'vault-x::two.md': true
		});
		await init();
		expect(getCollapsed('vault-x::one.md')).toBe(false);
		expect(getCollapsed('vault-x::two.md')).toBe(true);
		expect(getCollapsed('vault-x::missing.md')).toBe(true);
	});

	it('setCollapsed schedules a debounced persist that lands after flush', async () => {
		await init();
		setCollapsed('vault-a::a.md', false);
		// No immediate write — the timer hasn't fired.
		expect(writeMock).not.toHaveBeenCalled();
		await flushForTest();
		expect(writeMock).toHaveBeenCalledTimes(1);
		expect(writeMock.mock.calls[0][0]).toEqual({ 'vault-a::a.md': false });
	});

	it('rapid setCollapsed calls collapse to a single write (debounce)', async () => {
		await init();
		for (let i = 0; i < 5; i++) {
			setCollapsed(`vault-a::file-${i}.md`, false);
		}
		await flushForTest();
		expect(writeMock).toHaveBeenCalledTimes(1);
		const lastPayload = writeMock.mock.calls.at(-1)?.[0] as Record<string, boolean>;
		expect(Object.keys(lastPayload)).toHaveLength(5);
	});

	it('init() migrates legacy localStorage data on first run and clears the key', async () => {
		localStorage.setItem(
			'markhub.frontmatter.collapsed.v1',
			JSON.stringify({ 'vault-old::doc.md': false })
		);
		readMock.mockResolvedValue({}); // disk is empty
		await init();
		expect(getCollapsed('vault-old::doc.md')).toBe(false);
		// Legacy key removed.
		expect(localStorage.getItem('markhub.frontmatter.collapsed.v1')).toBeNull();
		// Migration scheduled a persist; flush to verify it lands on disk.
		await flushForTest();
		expect(writeMock).toHaveBeenCalledWith({ 'vault-old::doc.md': false });
	});

	it('init() prefers disk over localStorage on key conflict', async () => {
		localStorage.setItem(
			'markhub.frontmatter.collapsed.v1',
			JSON.stringify({ 'k': true })
		);
		readMock.mockResolvedValue({ k: false });
		await init();
		expect(getCollapsed('k')).toBe(false);
	});

	it('init() is idempotent — second call resolves without re-reading', async () => {
		readMock.mockResolvedValue({ k: false });
		await init();
		await init();
		expect(readMock).toHaveBeenCalledTimes(1);
	});
});
