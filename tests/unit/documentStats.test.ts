import { describe, it, expect } from 'vitest';
import {
	countCharacters,
	countWords,
	readingMinutes,
	stripMarkdownNoise,
	computeDocumentStats
} from '../../src/lib/stores/documentStats.svelte';

describe('documentStats', () => {
	describe('countWords', () => {
		it('returns 0 for empty content', () => {
			expect(countWords('')).toBe(0);
			expect(countWords('   \n  ')).toBe(0);
		});

		it('counts plain words', () => {
			expect(countWords('hello world')).toBe(2);
			expect(countWords('one two three four five')).toBe(5);
		});

		it('strips heading hashes before counting', () => {
			expect(countWords('# Hello world')).toBe(2);
			expect(countWords('## Sub heading title')).toBe(3);
		});

		it('strips list bullets and task markers', () => {
			expect(countWords('- item one\n- item two')).toBe(4);
			expect(countWords('- [x] done one\n- [ ] todo two')).toBe(4);
		});

		it('keeps link text but drops the URL', () => {
			expect(countWords('see [the docs](https://example.com)')).toBe(3);
		});

		it('drops YAML frontmatter at the top', () => {
			const md = '---\ntitle: x\ntags: [a, b]\n---\n\n# Body title\n\nSome words here.';
			expect(countWords(md)).toBe(5); // "Body title Some words here"
		});

		it('keeps inline code text but drops backticks', () => {
			expect(countWords('use `npm test` to run')).toBe(5);
		});

		it('drops bold / italic markers', () => {
			expect(countWords('**bold** and *italic* words')).toBe(4);
		});
	});

	describe('countCharacters', () => {
		it('returns the raw length (markdown syntax included)', () => {
			expect(countCharacters('hello')).toBe(5);
			expect(countCharacters('# Heading')).toBe(9);
			expect(countCharacters('')).toBe(0);
		});
	});

	describe('readingMinutes', () => {
		it('returns 0 for zero words', () => {
			expect(readingMinutes(0)).toBe(0);
		});

		it('rounds up to at least 1 minute for short content', () => {
			expect(readingMinutes(1)).toBe(1);
			expect(readingMinutes(50)).toBe(1);
		});

		it('rounds words / 200 to nearest minute', () => {
			expect(readingMinutes(200)).toBe(1);
			expect(readingMinutes(400)).toBe(2);
			expect(readingMinutes(1000)).toBe(5);
		});
	});

	describe('stripMarkdownNoise', () => {
		it('preserves the body when no markdown', () => {
			expect(stripMarkdownNoise('plain text')).toBe('plain text');
		});

		it('removes leading frontmatter', () => {
			const md = '---\ntitle: x\n---\n\nbody';
			expect(stripMarkdownNoise(md).trim()).toBe('body');
		});
	});

	describe('computeDocumentStats', () => {
		it('returns all three metrics in one pass', () => {
			const stats = computeDocumentStats('# Title\n\nThree words here.');
			expect(stats.words).toBe(4); // Title + Three + words + here
			expect(stats.characters).toBe('# Title\n\nThree words here.'.length);
			expect(stats.readingMinutes).toBe(1);
		});
	});
});
