import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import EditorToolbar from '../../src/lib/components/EditorToolbar.svelte';
import VaultList from '../../src/lib/components/VaultList.svelte';
import type { Vault } from '$lib/tauri/types';

// Reject any character outside of basic ASCII / Latin Supplement / general
// punctuation / arrows / spacing-modifier blocks that ISN'T allowed for UI text.
// Specifically: emoji-bearing planes (1F000–1FFFF), dingbats (2700–27BF),
// misc symbols (2600–26FF), misc tech symbols (2300–23FF including ⚠️ ✏️).
// Lucide SVGs are markup, not text — only `textContent` is scanned.
const FORBIDDEN_RE = /[\u{1F000}-\u{1FFFF}\u{2700}-\u{27BF}\u{2600}-\u{26FF}\u{2300}-\u{23FF}]/u;

const editVault: Vault = {
	id: 'v1',
	name: 'Notes',
	path: '/tmp/notes',
	mode: 'edit',
	color: '#A78BFA'
};
const readonlyVault: Vault = {
	id: 'v2',
	name: 'Skills',
	path: '/tmp/skills',
	mode: 'readonly',
	color: '#60A5FA'
};

function assertNoEmoji(text: string, where: string) {
	const match = text.match(FORBIDDEN_RE);
	if (match) {
		throw new Error(
			`Emoji/symbol "${match[0]}" (U+${match[0]
				.codePointAt(0)
				?.toString(16)
				.toUpperCase()}) found in ${where}. Use a Lucide icon instead.`
		);
	}
}

describe('UI must not use emoji as icons', () => {
	it('EditorToolbar uses no emoji glyphs', () => {
		const { container } = render(EditorToolbar);
		assertNoEmoji(container.textContent ?? '', 'EditorToolbar');
	});

	it('VaultList uses no emoji glyphs (incl. readonly indicator)', () => {
		const { container } = render(VaultList, { vaults: [editVault, readonlyVault] });
		assertNoEmoji(container.textContent ?? '', 'VaultList');
	});
});
