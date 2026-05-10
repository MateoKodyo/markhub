# Migration Crepe → BlockNote — notes d'investigation

> Document **temporaire** pour la durée du Chantier 1 (cf. WORKPLAN.md).
> À supprimer en fin de chantier.

## TL;DR

- **Vanilla viable** : `BlockNoteEditor.create()` + `editor.mount(element)` fonctionne sans React.
- **Logique block-based** (drag-handle, slash menu, formatting toolbar, table handles, suggestion menu, drop cursor) : déjà dans `@blocknote/core` via des **plugins ProseMirror**. Les plugins exposent leur état via `emitUpdate(state)` callbacks → on rendra l'UI en composants Svelte custom (pas React).
- **Markdown round-trip natif** : `blocksToMarkdownLossy()` + `tryParseMarkdownToBlocks()`.
- **Pas de wrapper Svelte officiel ni communautaire** trouvé. On code une intégration custom avec l'API core.
- **CSS** : `@blocknote/core/style.css` fournit les styles par défaut. Les `@blocknote/mantine` / `@blocknote/react` ajoutent leurs propres styles UI — on ne les importera pas, on stylera en CSS Markhub.

## Versions installées

```
"@blocknote/core": "^0.50.0"
```

Build après install : ✅ OK
svelte-check : 0/0
vitest : 152/152
cargo : 60/60

## Imports clés

```ts
// Editor + factory
import { BlockNoteEditor } from '@blocknote/core';

// Markdown round-trip — méthodes d'instance, pas d'import séparé
//   editor.blocksToMarkdownLossy(blocks?)
//   editor.tryParseMarkdownToBlocks(markdown)

// Extensions (plugins ProseMirror) si on veut customiser
import {
  SideMenu,           // drag handle ⋮⋮ + side affordance, émet { block, position }
  FormattingToolbar,  // floating toolbar sur sélection
  SuggestionMenu,     // slash menu (⋮ "/")
  TableHandles,       // resize colonnes / rangées
  DropCursor,         // ligne d'insertion pendant drag
  LinkToolbar,
  Placeholder
} from '@blocknote/core/extensions';

// Default slash items
import { getDefaultSlashMenuItems, getDefaultEmojiPickerItems } from '@blocknote/core/extensions';

// Style by default
import '@blocknote/core/style.css';
```

## API publique de `BlockNoteEditor`

D'après `package/types/src/editor/BlockNoteEditor.d.ts` :

```ts
class BlockNoteEditor<BSchema, ISchema, SSchema> {
  // Factory
  static create<...>(options?: BlockNoteEditorOptions): BlockNoteEditor;

  // Lifecycle
  mount(element: HTMLElement): void;
  unmount(): void;

  // Document access
  get document(): Block[];
  transact<T>(callback: (tr: Transaction) => T): T;
  insertBlocks(...);
  replaceBlocks(...);
  updateBlock(...);

  // Markdown round-trip (LOSSY = certaines features BN ne survivent pas en .md)
  blocksToMarkdownLossy(blocks?: PartialBlock[]): string;
  tryParseMarkdownToBlocks(markdown: string): Block[];

  // Reactivity
  onChange(cb: (editor, ctx) => void): Unsubscribe;
  onSelectionChange(cb: (editor) => void): Unsubscribe;

  // Readonly toggle
  get isEditable(): boolean;
  set isEditable(editable: boolean);

  // Selection / focus
  focus(): void;
  blur(): void;
  getTextCursorPosition(): TextCursorPosition;
}
```

## Pattern d'intégration UI Svelte

Les extensions UI (SideMenu, FormattingToolbar, etc.) sont des **PluginView ProseMirror** :

```ts
class SideMenuView<...> implements PluginView {
  constructor(
    editor: BlockNoteEditor,
    pmView: EditorView,
    emitUpdate: (state: SideMenuState) => void
  );
  // ...
}

type SideMenuState = UiElementPosition & {
  block: Block;       // bloc actuellement hovered
};
```

Donc on **passe un callback** au plugin, et le callback alimente un `$state` Svelte qui drive le rendering :

```ts
// Pseudo-code
let sideMenuState = $state<SideMenuState | null>(null);
const editor = BlockNoteEditor.create({
  // ... la config par défaut active déjà SideMenu via les extensions par défaut.
  // Pour customiser le rendering, on peut configurer manuellement.
});
```

→ **Vérification précise à faire en étape 2** : par défaut, BlockNote rend-il un fallback DOM pour SideMenu / FormattingToolbar / SuggestionMenu, ou faut-il TOUJOURS leur passer un `emitUpdate` ? Si l'éditeur fonctionne `mount()` only, on a déjà drag-and-drop natif sans rien faire. Si pas de fallback, on doit configurer chaque extension.

## Markdown round-trip — ⚠️ "lossy"

`blocksToMarkdownLossy` est marqué **lossy** : certaines features BlockNote ne sont pas représentables en markdown standard (ex. couleurs de blocks, alignements, etc.). Pour Markhub, le scope est markdown standard → ça devrait être OK. À tester rigoureusement en étape 2 avec :
- Headings 1-6
- Listes ordonnées / non-ordonnées / tâches
- Citations imbriquées
- Code blocks avec langage
- Tables
- Liens / images
- Frontmatter (probablement à pré-traiter par notre `splitFrontmatter` comme on fait avec Crepe)

## Ce que BlockNote fournit (vs Crepe)

| Feature | Crepe | BlockNote core |
|---|---|---|
| Drag handle ⋮⋮ logique (drag-and-drop block) | ❌ aucun handler | ✅ `SideMenu` plugin natif |
| Drop indicator pendant drag | ❌ on a dû coder | ✅ `DropCursor` plugin natif |
| Transform menu (block → other block) | ❌ on a dû coder | ✅ via SuggestionMenu / SideMenu state + commands |
| Slash menu | ✅ natif | ✅ `SuggestionMenu` plugin natif |
| Floating toolbar | ✅ natif | ✅ `FormattingToolbar` plugin |
| Table column resize | ❌ pas dans Crepe | ✅ `TableHandles` plugin natif |
| Code block language picker | 🟡 cassé chez nous | ✅ Built-in `codeBlock` |

Le gain sur drag-handle + transform + table resize est majeur — **trois bugs MVP que nos hacks ne résolvaient qu'à moitié**.

## Ce qu'on devra coder en Svelte

- **Composants UI** rendant l'état des plugins :
  - `BlockSideMenuView.svelte` (le menu ⋮⋮) — réutilise notre `<ContextMenu>`
  - `BlockFormattingToolbar.svelte` (toolbar flottante) — peut réutiliser nos pills design-system
  - `BlockSlashMenu.svelte` — peut réutiliser notre slash menu styling actuel
  - `BlockSuggestionList.svelte` (les items proposés)
- **Wiring** dans `Editor.svelte` :
  - Mount BlockNote
  - Configure chaque extension avec un `emitUpdate` qui pousse dans un `$state`
  - Render conditionnellement chaque UI quand l'extension est active
- **Markdown plumbing** : `editor.onChange()` → `blocksToMarkdownLossy()` → debounce 1500ms → `fileWrite`. Frontmatter pré-extrait avant `tryParseMarkdownToBlocks()`.

## Risques connus

1. **Pas de wrapper Svelte officiel** — on est seuls à câbler. Mais la surface d'API est petite (mount, onChange, blocksToMarkdownLossy, tryParseMarkdownToBlocks).
2. **`@blocknote/core/style.css` peut conflicter avec nos overrides** — on peut soit l'importer puis l'overrider, soit ne pas l'importer et tout styler nous-mêmes. À trancher étape 3.
3. **Les peer deps Tiptap/ProseMirror** sont installées comme deps directes de `@blocknote/core` → 38 deps installées avec lui. Pas idéal côté bundle size, mais inévitable et acceptable.
4. **Markdown lossy** : feature couleurs/alignements ne survivront pas l'aller-retour. Pour Markhub MVP c'est OK (on ne supporte pas ces features), mais à confirmer en étape 2 sur des fichiers représentatifs.
5. **Extensions par défaut vs custom config** : doute sur ce que `BlockNoteEditor.create()` active par défaut sans qu'on configure les extensions. À clarifier en étape 2 (rendre un éditeur minimal et observer).

## URLs lues

- https://github.com/TypeCellOS/BlockNote (README — limité, React-centric)
- https://github.com/TypeCellOS/BlockNote/blob/main/packages/core/src/editor/BlockNoteEditor.ts (signatures publiques)
- `npm pack @blocknote/core --dry-run` + lecture des `.d.ts` → source de vérité

Sites blocknotejs.org/docs renvoient parfois 404 sur certains paths — la doc officielle est en cours de réorganisation. **Source de vérité : les .d.ts du package**.

## Décision pour étape 2

L'API vanilla est confirmée et l'investigation montre que la migration EST viable, avec un coût UI modéré (3-4 composants Svelte à écrire pour wrapper les plugins). Les gains fonctionnels (drag-drop natif propre, table resize, transform menu propre) justifient le chantier.

Je propose de continuer en étape 2 dès ton OK : créer `/_blocknote-test` avec un éditeur minimal et faire le round-trip markdown sur 3 fichiers représentatifs.
