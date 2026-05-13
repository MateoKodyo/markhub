import { describe, expect, it } from 'vitest';
import {
	parseFrontmatter,
	serializeFrontmatter
} from '../../src/lib/frontmatter/parser';

/**
 * Pure data-layer contract for the frontmatter parser/serializer. These tests
 * pin the shape of `ParseResult`, the choice to treat empty/whitespace input
 * as `{}`, the rejection of non-mapping roots, and the round-trip stability
 * of `parse → serialize → parse` for representative shapes.
 */
describe('parseFrontmatter', () => {
	it('returns ok with empty data for an empty string', () => {
		const result = parseFrontmatter('');
		expect(result).toEqual({ ok: true, data: {} });
	});

	it('returns ok with empty data for whitespace-only input', () => {
		const result = parseFrontmatter('   \n\t  \n');
		expect(result).toEqual({ ok: true, data: {} });
	});

	it('parses a simple key: value pair', () => {
		const result = parseFrontmatter('title: Hello');
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.data).toEqual({ title: 'Hello' });
	});

	it('parses a one-level nested map', () => {
		const result = parseFrontmatter('author:\n  name: Ada\n  age: 36');
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data).toEqual({ author: { name: 'Ada', age: 36 } });
		}
	});

	it('parses an array of strings', () => {
		const result = parseFrontmatter('tags:\n  - foo\n  - bar\n  - baz');
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.data).toEqual({ tags: ['foo', 'bar', 'baz'] });
	});

	it('parses boolean, number, and null scalars', () => {
		const result = parseFrontmatter(
			'published: true\nrating: 4.5\nreviewer: null'
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data).toEqual({
				published: true,
				rating: 4.5,
				reviewer: null
			});
		}
	});

	it('parses a folded multi-line string (>)', () => {
		const yaml = 'summary: >\n  one two\n  three four\n';
		const result = parseFrontmatter(yaml);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.data).toEqual({ summary: 'one two three four\n' });
	});

	it('parses a literal multi-line string (|)', () => {
		const yaml = 'body: |\n  line one\n  line two\n';
		const result = parseFrontmatter(yaml);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.data).toEqual({ body: 'line one\nline two\n' });
	});

	it('rejects malformed YAML and preserves the raw input', () => {
		const bad = 'title: hello\n  bad: indent';
		const result = parseFrontmatter(bad);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBeTruthy();
			expect(typeof result.error).toBe('string');
			expect(result.raw).toBe(bad);
		}
	});

	it('rejects a top-level sequence (non-object root)', () => {
		const result = parseFrontmatter('- a\n- b\n- c');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toMatch(/mapping/i);
			expect(result.raw).toBe('- a\n- b\n- c');
		}
	});

	it('rejects a top-level scalar (non-object root)', () => {
		const result = parseFrontmatter('just-a-string');
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toMatch(/mapping/i);
		}
	});

	it('handles special characters in keys (quoted keys, colons, hyphens)', () => {
		const yaml = `'key:with:colons': one
"key with spaces": two
my-hyphen-key: three`;
		const result = parseFrontmatter(yaml);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.data).toEqual({
				'key:with:colons': 'one',
				'key with spaces': 'two',
				'my-hyphen-key': 'three'
			});
		}
	});

	it('round-trip stays stable for a flat mapping', () => {
		const original = { title: 'Hello', count: 3, active: true };
		const yaml = serializeFrontmatter(original);
		const reparsed = parseFrontmatter(yaml);
		expect(reparsed.ok).toBe(true);
		if (reparsed.ok) expect(reparsed.data).toEqual(original);
	});

	it('round-trip stays stable for a nested mapping with arrays', () => {
		const original = {
			author: { name: 'Ada', tags: ['math', 'code'] },
			published: true,
			rating: null
		};
		const yaml = serializeFrontmatter(original);
		const reparsed = parseFrontmatter(yaml);
		expect(reparsed.ok).toBe(true);
		if (reparsed.ok) expect(reparsed.data).toEqual(original);
	});

	it('round-trip preserves multi-line string content', () => {
		const original = { body: 'line one\nline two\nline three\n' };
		const yaml = serializeFrontmatter(original);
		const reparsed = parseFrontmatter(yaml);
		expect(reparsed.ok).toBe(true);
		if (reparsed.ok) expect(reparsed.data).toEqual(original);
	});
});

describe('serializeFrontmatter', () => {
	it('produces output that does not line-wrap long strings', () => {
		const longUrl = 'https://example.com/' + 'x'.repeat(200);
		const yaml = serializeFrontmatter({ url: longUrl });
		// One line for the key+value, plus the trailing newline js-yaml adds.
		expect(yaml.split('\n').filter(Boolean)).toHaveLength(1);
		expect(yaml).toContain(longUrl);
	});

	it('preserves insertion order (sortKeys: false)', () => {
		const yaml = serializeFrontmatter({ z: 1, a: 2, m: 3 });
		const keys = yaml
			.split('\n')
			.filter((line) => line.includes(':'))
			.map((line) => line.split(':')[0]);
		expect(keys).toEqual(['z', 'a', 'm']);
	});
});
