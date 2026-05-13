import { describe, expect, it } from 'vitest';
import { detectModeSwitch } from '../../src/lib/components/palette/modeSwitch';

describe('detectModeSwitch', () => {
	it('returns null on an empty query', () => {
		expect(detectModeSwitch('command', '', true)).toBeNull();
		expect(detectModeSwitch('file', '', true)).toBeNull();
		expect(detectModeSwitch('search', '', true)).toBeNull();
	});

	it('switches to command on ">" from file mode', () => {
		expect(detectModeSwitch('file', '>save', true)).toEqual({
			mode: 'command',
			query: 'save'
		});
	});

	it('switches to command on ">" from search mode', () => {
		expect(detectModeSwitch('search', '>theme', true)).toEqual({
			mode: 'command',
			query: 'theme'
		});
	});

	it('switches to file on "@" from command mode', () => {
		expect(detectModeSwitch('command', '@readme', true)).toEqual({
			mode: 'file',
			query: 'readme'
		});
	});

	it('switches to search on "#" when a vault is active', () => {
		expect(detectModeSwitch('command', '#todo', true)).toEqual({
			mode: 'search',
			query: 'todo'
		});
	});

	it('does NOT switch to search on "#" when no vault is active', () => {
		expect(detectModeSwitch('command', '#anything', false)).toBeNull();
	});

	it('does NOT switch if already in the target mode (prefix kept)', () => {
		// Already in command: '>' is a regular character — no switch.
		expect(detectModeSwitch('command', '>foo', true)).toBeNull();
		expect(detectModeSwitch('file', '@home.md', true)).toBeNull();
		expect(detectModeSwitch('search', '#tag', true)).toBeNull();
	});

	it('strips only the first character on switch', () => {
		expect(detectModeSwitch('file', '>>literal', true)).toEqual({
			mode: 'command',
			query: '>literal'
		});
	});

	it('returns null for queries that do not start with a known prefix', () => {
		expect(detectModeSwitch('file', 'save', true)).toBeNull();
		expect(detectModeSwitch('command', '!bang', true)).toBeNull();
	});
});
