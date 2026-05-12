import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	commandRegistry,
	type Command
} from '../../src/lib/commands/registry.svelte';

const makeCommand = (overrides: Partial<Command> = {}): Command => ({
	id: 'test.noop',
	label: 'Test Command',
	handler: vi.fn(),
	...overrides
});

describe('commandRegistry', () => {
	beforeEach(() => {
		commandRegistry.resetForTest();
	});

	it('registers a command and exposes it via getById', () => {
		const cmd = makeCommand({
			id: 'view.toggleSidebar',
			label: 'Toggle Sidebar'
		});
		commandRegistry.register(cmd);
		expect(commandRegistry.getById('view.toggleSidebar')).toEqual(cmd);
	});

	it('returns undefined for an unknown id', () => {
		expect(commandRegistry.getById('not-a-command')).toBeUndefined();
	});

	it('lists every registered command via getAll', () => {
		const a = makeCommand({ id: 'a' });
		const b = makeCommand({ id: 'b' });
		commandRegistry.register(a);
		commandRegistry.register(b);
		const all = commandRegistry.getAll();
		expect(all).toHaveLength(2);
		expect(all.map((c) => c.id).sort()).toEqual(['a', 'b']);
	});

	it('groups commands by their group field', () => {
		commandRegistry.register(makeCommand({ id: 'file.save', group: 'File' }));
		commandRegistry.register(
			makeCommand({ id: 'file.delete', group: 'File' })
		);
		commandRegistry.register(makeCommand({ id: 'view.toggle', group: 'View' }));
		expect(
			commandRegistry
				.getByGroup('File')
				.map((c) => c.id)
				.sort()
		).toEqual(['file.delete', 'file.save']);
		expect(commandRegistry.getByGroup('View').map((c) => c.id)).toEqual([
			'view.toggle'
		]);
		expect(commandRegistry.getByGroup('Nope')).toEqual([]);
	});

	it('unregisters a command by id', () => {
		commandRegistry.register(makeCommand({ id: 'x' }));
		expect(commandRegistry.getById('x')).toBeDefined();
		commandRegistry.unregister('x');
		expect(commandRegistry.getById('x')).toBeUndefined();
	});

	it('unregister on an unknown id is a no-op', () => {
		expect(() => commandRegistry.unregister('nope')).not.toThrow();
	});

	it('re-registering the same id replaces the previous entry', () => {
		commandRegistry.register(makeCommand({ id: 'dup', label: 'First' }));
		commandRegistry.register(makeCommand({ id: 'dup', label: 'Second' }));
		expect(commandRegistry.getById('dup')?.label).toBe('Second');
		expect(commandRegistry.getAll()).toHaveLength(1);
	});

	it('register() snapshot is reactive: getAll reflects updates', () => {
		expect(commandRegistry.getAll()).toEqual([]);
		commandRegistry.register(makeCommand({ id: 'a' }));
		expect(commandRegistry.getAll().map((c) => c.id)).toEqual(['a']);
		commandRegistry.register(makeCommand({ id: 'b' }));
		expect(commandRegistry.getAll().map((c) => c.id).sort()).toEqual([
			'a',
			'b'
		]);
		commandRegistry.unregister('a');
		expect(commandRegistry.getAll().map((c) => c.id)).toEqual(['b']);
	});
});
