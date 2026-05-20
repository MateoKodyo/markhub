import { describe, it, expect } from 'vitest';
import { detectAiAware } from '../../src/lib/ai-ready/detector';

describe('ai-ready detector', () => {
	// ------ Filename matches ------
	it('AD.1 — CLAUDE.md → claude-project', () => {
		const r = detectAiAware('CLAUDE.md', 'CLAUDE.md', null);
		expect(r?.category).toBe('claude-project');
		expect(r?.label).toBe('Claude project instructions');
	});

	it('AD.2 — AGENTS.md → agents-md', () => {
		expect(detectAiAware('AGENTS.md', 'AGENTS.md', null)?.category).toBe('agents-md');
	});

	it('AD.3 — AGENT.md (singular) → agents-md', () => {
		expect(detectAiAware('AGENT.md', 'AGENT.md', null)?.category).toBe('agents-md');
	});

	it('AD.4 — GEMINI.md → gemini', () => {
		expect(detectAiAware('GEMINI.md', 'GEMINI.md', null)?.category).toBe('gemini');
	});

	it('AD.5 — CODEX.md → codex', () => {
		expect(detectAiAware('CODEX.md', 'CODEX.md', null)?.category).toBe('codex');
	});

	it('AD.6 — .aider.conf.yml → aider-config', () => {
		expect(detectAiAware('.aider.conf.yml', '.aider.conf.yml', null)?.category).toBe(
			'aider-config'
		);
	});

	it('AD.7 — .aider.conf.yaml → aider-config', () => {
		expect(detectAiAware('.aider.conf.yaml', '.aider.conf.yaml', null)?.category).toBe(
			'aider-config'
		);
	});

	it('AD.8 — filename match works regardless of directory depth', () => {
		expect(detectAiAware('CLAUDE.md', 'docs/sub/CLAUDE.md', null)?.category).toBe(
			'claude-project'
		);
	});

	// ------ Path matches ------
	it('AD.9 — .cursor/rules.md → cursor-rules', () => {
		const r = detectAiAware('rules.md', '.cursor/rules.md', null);
		expect(r?.category).toBe('cursor-rules');
		expect(r?.label).toBe('Cursor rules');
	});

	it('AD.10 — file under .cursor/rules/ directory → cursor-rules', () => {
		expect(
			detectAiAware('python.md', '.cursor/rules/python.md', null)?.category
		).toBe('cursor-rules');
	});

	it('AD.11 — .github/copilot-instructions.md → copilot-instructions', () => {
		expect(
			detectAiAware('copilot-instructions.md', '.github/copilot-instructions.md', null)
				?.category
		).toBe('copilot-instructions');
	});

	it('AD.12 — bare rules.md NOT under .cursor → no match', () => {
		expect(detectAiAware('rules.md', 'rules.md', null)).toBeNull();
	});

	// ------ Frontmatter matches ------
	it('AD.13 — audience: ai (string) → frontmatter-audience', () => {
		const r = detectAiAware('notes.md', 'notes.md', { audience: 'ai' });
		expect(r?.category).toBe('frontmatter-audience');
	});

	it('AD.14 — audience: [ai, human] (array) → frontmatter-audience', () => {
		expect(
			detectAiAware('notes.md', 'notes.md', { audience: ['ai', 'human'] })?.category
		).toBe('frontmatter-audience');
	});

	it('AD.15 — audience: claude-code → frontmatter-specific-agent with detail', () => {
		const r = detectAiAware('notes.md', 'notes.md', { audience: 'claude-code' });
		expect(r?.category).toBe('frontmatter-specific-agent');
		expect(r?.detail).toBe('claude-code');
		expect(r?.label).toBe('AI-targeted: claude-code');
	});

	it('AD.16 — audience: cursor → frontmatter-specific-agent', () => {
		expect(
			detectAiAware('notes.md', 'notes.md', { audience: 'cursor' })?.detail
		).toBe('cursor');
	});

	it('AD.17 — audience: [ai, claude-code] → specific agent wins over generic', () => {
		const r = detectAiAware('notes.md', 'notes.md', {
			audience: ['ai', 'claude-code']
		});
		expect(r?.category).toBe('frontmatter-specific-agent');
		expect(r?.detail).toBe('claude-code');
	});

	// ------ Precedence ------
	it('AD.18 — filename beats frontmatter: CLAUDE.md + audience:human stays claude-project', () => {
		const r = detectAiAware('CLAUDE.md', 'CLAUDE.md', { audience: 'human' });
		expect(r?.category).toBe('claude-project');
	});

	it('AD.19 — path beats frontmatter: .cursor/rules.md + audience:ai stays cursor-rules', () => {
		const r = detectAiAware('rules.md', '.cursor/rules.md', { audience: 'ai' });
		expect(r?.category).toBe('cursor-rules');
	});

	// ------ Negative cases ------
	it('AD.20 — ordinary file with no frontmatter → null', () => {
		expect(detectAiAware('README.md', 'README.md', null)).toBeNull();
	});

	it('AD.21 — lowercase claude.md does NOT match (strict case)', () => {
		expect(detectAiAware('claude.md', 'claude.md', null)).toBeNull();
	});

	it('AD.22 — audience: human → null (not AI-aware)', () => {
		expect(detectAiAware('notes.md', 'notes.md', { audience: 'human' })).toBeNull();
	});

	it('AD.23 — audience key missing → null', () => {
		expect(detectAiAware('notes.md', 'notes.md', { title: 'x' })).toBeNull();
	});

	// ------ Frontmatter edge cases ------
	it('AD.24 — audience as a number → null (unrecognized shape)', () => {
		expect(detectAiAware('notes.md', 'notes.md', { audience: 42 })).toBeNull();
	});

	it('AD.25 — audience as an object → null', () => {
		expect(
			detectAiAware('notes.md', 'notes.md', { audience: { kind: 'ai' } })
		).toBeNull();
	});

	it('AD.26 — audience: null → null', () => {
		expect(detectAiAware('notes.md', 'notes.md', { audience: null })).toBeNull();
	});

	it('AD.27 — audience: [] (empty array) → null', () => {
		expect(detectAiAware('notes.md', 'notes.md', { audience: [] })).toBeNull();
	});

	it('AD.28 — audience array with non-string entries is tolerated → null', () => {
		expect(
			detectAiAware('notes.md', 'notes.md', { audience: [1, 2, { x: 1 }] })
		).toBeNull();
	});
});
