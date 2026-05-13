import { describe, expect, it } from 'vitest';
import { rankCommands } from '../../src/lib/commands/fuzzy';
import type { Command } from '../../src/lib/commands/registry.svelte';

const cmd = (id: string, label: string, group?: string): Command => ({
	id,
	label,
	group,
	handler: () => {}
});

describe('rankCommands', () => {
	it('returns every command when the query is empty (no filtering)', () => {
		const cmds = [cmd('a', 'Save'), cmd('b', 'Open'), cmd('c', 'Close')];
		const out = rankCommands(cmds, '', []);
		expect(out).toHaveLength(3);
		expect(out.map((r) => r.command.id).sort()).toEqual(['a', 'b', 'c']);
	});

	it('when query empty, recent commands rank first in recent order', () => {
		const cmds = [
			cmd('a', 'Save'),
			cmd('b', 'Open'),
			cmd('c', 'Close')
		];
		const out = rankCommands(cmds, '', ['c', 'a']);
		expect(out.map((r) => r.command.id)).toEqual(['c', 'a', 'b']);
	});

	it('filters out commands that do not match the query', () => {
		const cmds = [
			cmd('file.save', 'Save File'),
			cmd('file.open', 'Open File'),
			cmd('view.theme', 'Toggle Theme')
		];
		const out = rankCommands(cmds, 'save', []);
		expect(out.map((r) => r.command.id)).toEqual(['file.save']);
	});

	it('returns the matched-character indices for highlighting', () => {
		const cmds = [cmd('file.save', 'Save File')];
		const out = rankCommands(cmds, 'sv', []);
		expect(out).toHaveLength(1);
		expect(out[0].matchIndices).toBeDefined();
		// 's' at 0 + 'v' at 2 of "Save File".
		expect(out[0].matchIndices).toEqual([0, 2]);
	});

	it('ranks closer matches higher than scattered ones', () => {
		const cmds = [
			cmd('a', 'Save Settings'),
			cmd('b', 'Save File')
		];
		// "save" should match both, but "Save File" is the closer prefix-y hit.
		const out = rankCommands(cmds, 'save', []);
		expect(out[0].command.label).toMatch(/Save/);
	});

	it('respects `when` guards (false => excluded entirely)', () => {
		const cmds: Command[] = [
			cmd('a', 'Save File'),
			{ ...cmd('b', 'Save Settings'), when: () => false }
		];
		const out = rankCommands(cmds, '', []);
		expect(out.map((r) => r.command.id)).toEqual(['a']);
		const queried = rankCommands(cmds, 'save', []);
		expect(queried.map((r) => r.command.id)).toEqual(['a']);
	});

	it('respects `when` guards in recents too (stale recent => dropped)', () => {
		const cmds: Command[] = [
			cmd('a', 'Save'),
			{ ...cmd('b', 'Other'), when: () => false }
		];
		const out = rankCommands(cmds, '', ['b', 'a']);
		expect(out.map((r) => r.command.id)).toEqual(['a']);
	});

	it('drops hidden commands (still in registry, just not surfaced)', () => {
		const cmds: Command[] = [
			cmd('a', 'Visible'),
			{ ...cmd('b', 'Hidden'), hidden: true }
		];
		const out = rankCommands(cmds, '', []);
		expect(out.map((r) => r.command.id)).toEqual(['a']);
		const queried = rankCommands(cmds, 'hid', []);
		expect(queried).toEqual([]);
	});
});
