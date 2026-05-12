import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindCommandKeymap } from '../../src/lib/commands/keymap';
import { commandRegistry } from '../../src/lib/commands/registry.svelte';

const dispatchKey = (
	key: string,
	modifiers: Partial<KeyboardEventInit> = {}
) => {
	window.dispatchEvent(
		new KeyboardEvent('keydown', { key, bubbles: true, ...modifiers })
	);
};

describe('commandKeymap', () => {
	let cleanup: (() => void) | null = null;

	beforeEach(() => {
		commandRegistry.resetForTest();
	});

	afterEach(() => {
		cleanup?.();
		cleanup = null;
	});

	it('invokes the bound command handler when its shortcut is pressed', () => {
		const handler = vi.fn();
		commandRegistry.register({
			id: 'file.save',
			label: 'Save',
			handler
		});
		cleanup = bindCommandKeymap({ 'Control+s': 'file.save' });
		dispatchKey('s', { ctrlKey: true });
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it('binds multiple shortcuts to distinct commands', () => {
		const save = vi.fn();
		const toggle = vi.fn();
		commandRegistry.register({ id: 'file.save', label: 'Save', handler: save });
		commandRegistry.register({
			id: 'view.toggleSidebar',
			label: 'Toggle Sidebar',
			handler: toggle
		});
		cleanup = bindCommandKeymap({
			'Control+s': 'file.save',
			'Control+b': 'view.toggleSidebar'
		});
		dispatchKey('s', { ctrlKey: true });
		dispatchKey('b', { ctrlKey: true });
		expect(save).toHaveBeenCalledTimes(1);
		expect(toggle).toHaveBeenCalledTimes(1);
	});

	it('is a no-op when the referenced command id is not registered', () => {
		cleanup = bindCommandKeymap({ 'Control+s': 'missing.command' });
		expect(() => dispatchKey('s', { ctrlKey: true })).not.toThrow();
	});

	it('cleanup unbinds every shortcut', () => {
		const handler = vi.fn();
		commandRegistry.register({
			id: 'file.save',
			label: 'Save',
			handler
		});
		cleanup = bindCommandKeymap({ 'Control+s': 'file.save' });
		cleanup();
		cleanup = null;
		dispatchKey('s', { ctrlKey: true });
		expect(handler).not.toHaveBeenCalled();
	});

	it("respects a command's when guard (false => handler not fired)", () => {
		const handler = vi.fn();
		commandRegistry.register({
			id: 'file.save',
			label: 'Save',
			handler,
			when: () => false
		});
		cleanup = bindCommandKeymap({ 'Control+s': 'file.save' });
		dispatchKey('s', { ctrlKey: true });
		expect(handler).not.toHaveBeenCalled();
	});

	it('resolves the command at fire time, so late registration works', () => {
		const handler = vi.fn();
		cleanup = bindCommandKeymap({ 'Control+s': 'file.save' });
		dispatchKey('s', { ctrlKey: true });
		expect(handler).not.toHaveBeenCalled();
		commandRegistry.register({
			id: 'file.save',
			label: 'Save',
			handler
		});
		dispatchKey('s', { ctrlKey: true });
		expect(handler).toHaveBeenCalledTimes(1);
	});
});
