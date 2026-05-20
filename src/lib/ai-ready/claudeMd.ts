/**
 * CLAUDE.md helper — PLAN-AI-READY.
 *
 * Shared by the AI Context panel's empty-state action (STEP 5) and the
 * `ai.open-claude-md` command (STEP 6): create a vault-root `CLAUDE.md`
 * seeded with a minimal starter template.
 */
import * as api from '$lib/tauri/api';

/** Vault-relative path of the project CLAUDE.md (always at the root). */
export const CLAUDE_MD_PATH = 'CLAUDE.md';

/** Minimal starter content for a freshly created project CLAUDE.md. */
export const CLAUDE_MD_TEMPLATE = `# CLAUDE.md

> Instructions for Claude when working in this project.

## Context

<describe your project>

## Conventions

- <convention 1>
- <convention 2>
`;

/**
 * Create a `CLAUDE.md` at the vault root with the starter template.
 * Returns its vault-relative path. The caller is responsible for
 * refreshing the file tree and opening the file.
 */
export async function createClaudeMd(vaultId: string): Promise<string> {
	await api.fileCreate(vaultId, CLAUDE_MD_PATH);
	await api.fileWrite(vaultId, CLAUDE_MD_PATH, CLAUDE_MD_TEMPLATE);
	return CLAUDE_MD_PATH;
}
