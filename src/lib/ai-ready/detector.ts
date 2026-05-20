/**
 * AI-aware file detection — PLAN-AI-READY STEP 1.
 *
 * Pure, deterministic recognition of files designed for human-AI
 * collaboration: `CLAUDE.md`, `AGENTS.md`, `.cursor/rules`, Copilot
 * instructions, Aider config, and files marked by an `audience:`
 * frontmatter key.
 *
 * No LLM, no network, no file content read beyond the already-parsed
 * frontmatter. Detection is a fast pattern match — the conventions are
 * deliberate and the files are named to be recognized.
 */

export type AiAwareCategory =
	| 'claude-project'
	| 'agents-md'
	| 'cursor-rules'
	| 'copilot-instructions'
	| 'aider-config'
	| 'gemini'
	| 'codex'
	| 'frontmatter-audience'
	| 'frontmatter-specific-agent';

export interface AiAwareInfo {
	category: AiAwareCategory;
	/** User-facing label (sidebar tooltip, editor chip). */
	label: string;
	/** Extra detail — e.g. the specific audience value when frontmatter-based. */
	detail?: string;
}

/** Exact filename → category. Case-sensitive: the conventions are uppercase
 *  (`CLAUDE.md`), git treats filenames case-sensitively, and a lowercase
 *  `claude.md` is almost always an ordinary note. */
const FILENAME_TABLE: Record<string, AiAwareInfo> = {
	'CLAUDE.md': { category: 'claude-project', label: 'Claude project instructions' },
	'AGENTS.md': { category: 'agents-md', label: 'Agents documentation' },
	'AGENT.md': { category: 'agents-md', label: 'Agents documentation' },
	'GEMINI.md': { category: 'gemini', label: 'Gemini instructions' },
	'CODEX.md': { category: 'codex', label: 'Codex instructions' },
	'.aider.conf.yml': { category: 'aider-config', label: 'Aider configuration' },
	'.aider.conf.yaml': { category: 'aider-config', label: 'Aider configuration' }
};

/** Known agent ids accepted in an `audience:` frontmatter value. A value
 *  matching one of these is treated as a *specific-agent* target; the
 *  generic `ai` value is treated as `frontmatter-audience`. */
const KNOWN_AGENT_IDS: ReadonlySet<string> = new Set([
	'claude-code',
	'cursor',
	'copilot',
	'gemini',
	'aider',
	'codex'
]);

/** Normalize a relative path to forward-slash segments, dropping empties. */
function segments(relativePath: string): string[] {
	return relativePath.split(/[/\\]/).filter((s) => s.length > 0);
}

/** Path-based matches: `.cursor/rules*` and `.github/copilot-instructions.md`. */
function detectByPath(relativePath: string): AiAwareInfo | null {
	const segs = segments(relativePath);

	// `.cursor/rules.md` or any file under a `.cursor/rules/` directory.
	const cursorIdx = segs.indexOf('.cursor');
	if (cursorIdx >= 0 && cursorIdx + 1 < segs.length) {
		const next = segs[cursorIdx + 1];
		if (next === 'rules' || next === 'rules.md') {
			return { category: 'cursor-rules', label: 'Cursor rules' };
		}
	}

	// `.github/copilot-instructions.md` — the file inside a `.github` dir.
	const githubIdx = segs.indexOf('.github');
	if (
		githubIdx >= 0 &&
		segs[githubIdx + 1] === 'copilot-instructions.md' &&
		githubIdx + 2 === segs.length
	) {
		return { category: 'copilot-instructions', label: 'Copilot instructions' };
	}

	return null;
}

/** Frontmatter-based match on the `audience:` key (string or array). */
function detectByFrontmatter(
	frontmatter: Record<string, unknown> | null
): AiAwareInfo | null {
	if (!frontmatter) return null;
	const audience = frontmatter.audience;
	if (audience == null) return null;

	// Collect candidate string values from either a string or an array.
	const values: string[] = [];
	if (typeof audience === 'string') {
		values.push(audience);
	} else if (Array.isArray(audience)) {
		for (const v of audience) {
			if (typeof v === 'string') values.push(v);
		}
	} else {
		// audience is a number / object / boolean — not a recognized shape.
		return null;
	}

	// A specific known agent is the most specific match — prefer it.
	const specificAgent = values.find((v) => KNOWN_AGENT_IDS.has(v));
	if (specificAgent) {
		return {
			category: 'frontmatter-specific-agent',
			label: `AI-targeted: ${specificAgent}`,
			detail: specificAgent
		};
	}

	// Generic `ai` marker.
	if (values.includes('ai')) {
		return { category: 'frontmatter-audience', label: 'AI-targeted (frontmatter)' };
	}

	return null;
}

/**
 * Detect whether a file is AI-aware.
 *
 * Precedence: filename match > path match > frontmatter match. The first
 * tier that produces a hit wins — a `CLAUDE.md` is reported as
 * `claude-project` even if it also carries `audience: ai`.
 *
 * Returns `null` for ordinary files.
 */
export function detectAiAware(
	filename: string,
	relativePath: string,
	frontmatter: Record<string, unknown> | null
): AiAwareInfo | null {
	const byFilename = FILENAME_TABLE[filename];
	if (byFilename) return byFilename;

	const byPath = detectByPath(relativePath);
	if (byPath) return byPath;

	return detectByFrontmatter(frontmatter);
}
