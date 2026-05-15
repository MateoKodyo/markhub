import { describe, it, expect } from 'vitest';
import {
	getFileName,
	getFileNameWithoutExt,
	getParentPath,
	joinPath
} from '../../src/lib/utils/path';

describe('path utils', () => {
	// ------ B1.1 — joinPath normalizes slashes ------
	it('joinPath joins parts with a single forward slash', () => {
		expect(joinPath('a', 'b/c')).toBe('a/b/c');
	});

	it('joinPath handles trailing slash on left part', () => {
		expect(joinPath('a/', 'b/c')).toBe('a/b/c');
	});

	it('joinPath handles leading slash on right part', () => {
		expect(joinPath('a', '/b/c')).toBe('a/b/c');
	});

	it('joinPath joins more than two parts', () => {
		expect(joinPath('a', 'b', 'c', 'd.md')).toBe('a/b/c/d.md');
	});

	// ------ B1.2 — getParentPath ------
	it('getParentPath returns directory for a nested file', () => {
		expect(getParentPath('a/b/c.md')).toBe('a/b');
	});

	it('getParentPath returns "" for a top-level file', () => {
		expect(getParentPath('c.md')).toBe('');
	});

	// ------ B1.3 — getFileName ------
	it('getFileName returns the leaf basename', () => {
		expect(getFileName('a/b/c.md')).toBe('c.md');
	});

	it('getFileName returns the input itself when no slashes', () => {
		expect(getFileName('c.md')).toBe('c.md');
	});

	// ------ B1.4 — getFileNameWithoutExt ------
	it('getFileNameWithoutExt strips the last extension', () => {
		expect(getFileNameWithoutExt('a/b/c.md')).toBe('c');
	});

	it('getFileNameWithoutExt handles dotfiles correctly (keeps name)', () => {
		// "note" has no extension, returns "note"
		expect(getFileNameWithoutExt('note')).toBe('note');
	});
});
