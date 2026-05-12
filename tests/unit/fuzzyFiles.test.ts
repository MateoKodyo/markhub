import { describe, expect, it } from 'vitest';
import { rankFiles, type FilePaletteEntry } from '../../src/lib/commands/fuzzyFiles';

const F = (relativePath: string): FilePaletteEntry => {
	const i = relativePath.lastIndexOf('/');
	return {
		vaultId: 'v',
		relativePath,
		name: i < 0 ? relativePath : relativePath.slice(i + 1)
	};
};

describe('rankFiles', () => {
	it('returns every file when the query is empty', () => {
		const out = rankFiles([F('a.md'), F('b.md')], '', []);
		expect(out.map((r) => r.entry.relativePath).sort()).toEqual([
			'a.md',
			'b.md'
		]);
	});

	it('orders recent files first on empty query (matched by composite key)', () => {
		const files = [F('apple.md'), F('banana.md'), F('cherry.md')];
		const out = rankFiles(files, '', [
			{ vaultId: 'v', relativePath: 'cherry.md' },
			{ vaultId: 'v', relativePath: 'apple.md' }
		]);
		expect(out.map((r) => r.entry.relativePath)).toEqual([
			'cherry.md',
			'apple.md',
			'banana.md'
		]);
	});

	it('ranks filename matches above path-only matches', () => {
		// 'save' matches both `notes/save-config.md` (in the path) and
		// `save.md` (in the filename). The filename hit should rank first.
		const files = [F('notes/save-config.md'), F('save.md')];
		const out = rankFiles(files, 'save', []);
		expect(out[0].entry.relativePath).toBe('save.md');
	});

	it('returns match indices on the filename when present', () => {
		const out = rankFiles([F('save.md')], 'sv', []);
		expect(out[0].matchInName).toBeDefined();
		expect(out[0].matchInName).toEqual([0, 2]); // 's' + 'v' of "save.md"
	});

	it('excludes files in the `exclude` set (e.g. currently open file)', () => {
		const out = rankFiles(
			[F('a.md'), F('b.md')],
			'',
			[],
			new Set(['v::a.md'])
		);
		expect(out.map((r) => r.entry.relativePath)).toEqual(['b.md']);
	});

	it('drops recent entries that point to no-longer-existing files', () => {
		const out = rankFiles(
			[F('a.md')],
			'',
			[
				{ vaultId: 'v', relativePath: 'gone.md' },
				{ vaultId: 'v', relativePath: 'a.md' }
			]
		);
		expect(out.map((r) => r.entry.relativePath)).toEqual(['a.md']);
	});

	it('filters out non-matching files when the query is non-empty', () => {
		const out = rankFiles([F('alpha.md'), F('beta.md')], 'xyz', []);
		expect(out).toEqual([]);
	});
});
