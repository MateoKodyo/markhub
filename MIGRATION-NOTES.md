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

---

## Étape 2 — Round-trip + smoke (résultats)

**Probe** : route `src/routes/_blocknote-test/+page.svelte` qui parse → mount → re-export les 3 fixtures de `tests/fixtures/c1/` et affiche source/rendered/output côte-à-côte avec un badge OK/DIFFERS et un diff résumé. Test Playwright `tests/visual/blocknote-roundtrip.spec.ts` qui visite la route et logge le markdown re-exporté complet (sortie test ≅ rapport).

### Résultats round-trip — gravités

| Fixture | Statut | Diffs observés | Verdict |
|---|---|---|---|
| 01 frontmatter + headings + lists | BODY DIFFERS | listes : `-` source → `*` export ; "tight list" → "loose list" (ligne vide entre items) | **MINEUR** cosmétique. Sémantique préservée. |
| 02 table + code + tasks + quote | BODY DIFFERS | table : padding colonnes recompacté ; code-block sans langage → ` ```text ` (langage par défaut injecté) ; tasks : `- [x]` → `* [x]` + tight→loose ; quote : multi-lignes reflowed sur une ligne | **MINEUR**. Tout récupérable + idempotent au 2ème round-trip. |
| 03 links + emphases + hr | BODY DIFFERS | `---` → `***` (deux formes valides du HR) ; bold imbriqué `**bold *with italic***` → `**bold&#x20;*****with italic***` (encode l'espace + 5 asterisks). Liens, autolinks, strike, inline code, italic simple : tous préservés. | ⚠️ **POINT D'ATTENTION** sur le bold-imbriqué-italic — cas extrême, à vérifier en réel. Le reste **OK / MINEUR**. |

### Verdict round-trip

**Pas de blocker fatal.** Les diffs sont tous cosmétiques ou idempotents :
- Bullet style (`-` ↔ `*`), tight↔loose, HR (`---` ↔ `***`) : Crepe avait probablement les mêmes idiosyncrasies, on ne perd pas de qualité fonctionnelle.
- Code-block sans langage qui devient ` ```text ` : sémantique correcte, le 2ème round-trip ne change plus rien.
- Bold imbriqué : pattern marginal (rarement écrit en pratique). À surveiller.

**Frontmatter** : conservé via notre `splitFrontmatter` / `joinFrontmatter` existants (BlockNote ne le voit jamais). Stratégie identique à Crepe → aucun risque.

### Smoke des features UI natives — ⚠️ point méthodologique

`@blocknote/core` mounté seul **ne rend AUCUNE UI** par défaut :
- Pas de drag handle ⋮⋮ visible
- Pas de slash menu visible quand on tape `/`
- Pas de toolbar flottante au survol de sélection
- Pas de table handles
- Pas de language picker

**C'est attendu** : le core fournit la LOGIQUE des plugins (`SideMenu`, `FormattingToolbar`, `SuggestionMenu`, `TableHandles`) via des `PluginView` ProseMirror qui appellent un `emitUpdate(state)` — l'UI doit être rendue par notre code Svelte. Le rendering React natif est dans `@blocknote/react` / `@blocknote/mantine` qu'on ne peut pas utiliser.

→ Le smoke test interactif demandé par le brief (drag handle, slash menu, toolbar flottante, etc.) n'est **pas testable en l'état**. Il devient testable une fois qu'on a écrit les composants UI Svelte. Estimation honnête de cet effort : **1-2 jours** (4-5 composants Svelte à wrapper, un par plugin).

**Implication pour le workplan** : entre l'étape 2 et l'étape 3 telles que rédigées, il manque une étape dédiée "écrire l'UI Svelte des plugins BlockNote". À cadrer avec Matheo avant de continuer.

### Recommandation

**GO sur la migration** côté round-trip markdown — pas de blocker fatal. Le bold-imbriqué-italic est le seul point d'attention, marginal en usage Markhub.

**STOP avant l'étape 3** — l'étape 3 du workplan présuppose une UI fonctionnelle qu'on n'a pas. Soit on insère une "étape 2.5 — UI Svelte" (~1-2j), soit on revoit la décision de migration sachant que tout l'UI block-based est à coder.

---

## Étape 2.5.a — Slash menu Svelte UI (livré)

### Pattern d'intégration confirmé en pratique

```ts
// 1. editor.extensions est un Map<string, ExtensionInstance> — utiliser
//    editor.getExtension('suggestionMenu') (PAS editor.extensions.suggestionMenu).
const ext = editor.getExtension('suggestionMenu');

// 2. ext.store est un TanStack Store. subscribe() reçoit { prevVal, currentVal },
//    PAS le state directement.
ext.store.subscribe(({ currentVal }) => {
  if (!currentVal?.show) return closeUI();
  renderUI(currentVal); // { show, referencePos, query, triggerCharacter }
});

// 3. Items via getDefaultSlashMenuItems(editor) + filterSuggestionItems(items, query).
//    Chaque item a onItemClick() qui dispatch la transaction ProseMirror —
//    on n'écrit AUCUNE logique de transformation.

// 4. Fermeture du menu après pick : ext.closeMenu() (le plugin ne le fait pas tout seul).
```

### Composant livré

- `src/lib/components/BlockNoteSlashMenu.svelte` — rendu Svelte du store.
  - Props : `menuState` (la prop a dû être renommée pour ne pas collider avec le rune `$state`), `items`, `onSelect`, `onClose`.
  - Render : menu fixed positionné sur `referencePos.left / referencePos.bottom + 4`.
  - Items groupés par `item.group` (header non-cliquable par groupe).
  - Navigation clavier : ↑/↓/Enter/Escape, écouteur `window` pour ne pas perdre le focus de l'éditeur.
  - **Selection via `mousedown.preventDefault()`** : sinon le blur de l'éditeur retire le caret avant que le pick ne tourne. Test E2E utilise `dispatchEvent('mousedown')` en conséquence.

### Tests

- `tests/visual/blocknote-slash-menu.spec.ts` :
  - Test 1 : taper `/` ouvre le menu avec items par défaut (Heading, Bullet List, etc.). Filtrage par query (`/head` ne montre plus Bullet List). ✅
  - Test 2 : sélectionner "Heading 1" transforme le block courant en H1 (compte les `<h1.bn-inline-content>` dans le DOM avant/après). ✅

### Décisions autonomes

- **Prop nommée `menuState`** au lieu de `state` : Svelte 5 confond `state.show` avec `$state.show` rune et émet 3 erreurs `store_rune_conflict`.
- **Pas de wrapper du store** côté Svelte : on subscribe directement au TanStack Store dans la route. Si plus tard d'autres routes utilisent BlockNote, on extraira un helper `bridgeBlockNoteStore`.
- **Pas de gestion focus avancée** : le caret reste dans l'éditeur grâce au `mousedown.preventDefault`. Pas de tabIndex / aria-activedescendant pour ce premier round — KISS.

---

## Étape 2.5.b — FormattingToolbar Svelte UI (livré)

### Pattern d'intégration confirmé en pratique

```ts
// 1. Le store de `formattingToolbar` est Store<boolean> (PAS un objet d'état
//    avec referencePos comme suggestionMenu). On calcule le positionnement
//    nous-mêmes depuis window.getSelection().
const ext = editor.getExtension('formattingToolbar');
ext.store.subscribe(({ currentVal }) => {
  // currentVal est un boolean : true = toolbar visible, false = cachée
  if (!currentVal) return closeUI();
  const range = window.getSelection()?.getRangeAt(0);
  const rect = range?.getBoundingClientRect();
  renderUI({ visible: true, referencePos: rect });
});

// 2. Refresh aussi sur editor.onSelectionChange (la sélection peut bouger
//    au clavier sans flip du store).
editor.onSelectionChange(() => updateActiveStyles());

// 3. Lecture des actifs : editor.getActiveStyles() retourne { bold, italic, ... }.
//    Détection lien : editor.getSelectedLinkUrl() (string | undefined).

// 4. Application : editor.toggleStyles({ bold: true }) etc.
//    Lien : editor.createLink(url) (avec prompt() inline pour MVP, vrai
//    LinkToolbar = étape 2.5.e).
```

### Composant livré

- `src/lib/components/BlockNoteFormattingToolbar.svelte` — rendu Svelte du store.
  - Props : `visible`, `referencePos`, `activeStyles` (`{ bold, italic, strike, code }`), `hasLink`, `onToggle(style)`, `onLink()`.
  - Render : toolbar `position: fixed` au-dessus de `referencePos.top - height - 8px`, auto-flip en dessous si pas la place en haut.
  - 5 boutons : B / I / S / `</>` / 🔗, classe `is-active` selon `activeStyles[style]`.
  - **`mousedown.preventDefault()`** : sinon le blur de l'éditeur retire le caret avant que le toggle ne tourne.

### Découvertes API

- Le store de `formattingToolbar` est `Store<boolean>` (PAS `Store<UiElementPosition>`). Différence majeure avec `suggestionMenu` qui expose un objet d'état complet.
- Le `n()` interne du plugin retourne `false` si la sélection contient un block code → toolbar cachée sur les code blocks (comportement natif voulu, à connaître pour les futurs tests).
- Plain `Shift+Home` est unreliable dans le contenteditable BlockNote via Playwright ; on tape puis on recule avec `Shift+ArrowLeft` × N pour avoir une sélection déterministe (consigné dans le helper `typeAndSelect`).

### Tests

- `tests/component/BlockNoteFormattingToolbar.test.svelte.ts` — 7 tests unitaires (montage, rendu boutons, click toggle, mousedown.preventDefault, classes is-active, auto-flip, hasLink).
- `tests/visual/blocknote-formatting-toolbar.spec.ts` — 3 tests E2E (sélection texte → toolbar apparaît ; bold → `<strong>` ; italic → `<em>`).

### Décisions autonomes

- **API du composant** : pure présentation (visible, referencePos, activeStyles, hasLink + callbacks onToggle/onLink). Toute la logique éditeur reste côté host. Plus testable, et identique au pattern slash menu : la wiring (subscribe store + selection rect) vit dans la route, pas dans le composant.
- **UX du lien** : `prompt()` natif. Cohérent avec « minimal » de la spec étape 2.5.b ; le vrai LinkToolbar est l'étape 2.5.e.
- **Auto-flip** : si la sélection est trop haute pour que la toolbar tienne au-dessus, elle bascule en dessous (offset 8px).
- **Pas de polish CSS poussé** (étape 3) : tokens Markhub directs, pas de `!important`.

---

## Stratégie révisée (2026-05-10 fin journée)

Après la livraison de 2.5.b, on a révisé la stratégie de migration. Voir `PLAN-BLOCKNOTE.md` §"Stratégie révisée".

**TL;DR** : la bascule de `Editor.svelte` (étape 4) se fait MAINTENANT, avec les 2 composants UI livrés. Les 3 composants UI restants (SideMenu, TableHandles, LinkToolbar) seront écrits ensuite directement dans l'app principale.

Raison : 4 étapes invisibles d'affilée (composants UI sur la route de test sans bascule) deviennent psychologiquement insoutenables et empêchent tout test en conditions réelles. La bascule anticipée débloque le smoke test sur de vrais fichiers Markdown.

---

## Étape 4 — Bascule `Editor.svelte` (livrée)

### Refactor (770 → ~270 lignes)

**Retiré** :
- Imports `@milkdown/crepe` + `@milkdown/kit/preset/commonmark`/`gfm`/CSS Crepe.
- Block menu transform/duplicate/delete custom (`buildBlockMenuItems`, `transformTargetBlock`, `duplicateTargetBlock`, `deleteTargetBlock`).
- Drag-reorder pointer events (`onHandlePointerDown`, `onWindowPointerMove/Up`, `updateDropIndicator`, `applyBlockReorder`).
- Drop indicator (`<div class="block-drop-indicator">`).
- `wireBlockHandle` (poll DOM Crepe pour attacher click+pointerdown sur `.operation-item`).
- État `blockMenuOpen / blockTargetStart / dropIndicatorTop / dragSourceStart …`.
- Override `--crepe-*` sur `.preview :global(.milkdown)`.

**Introduit** :
- Mount BlockNote : `BlockNoteEditor.create()` + `editor.mount(container)`.
- Initial doc : `editor.replaceBlocks(editor.document, editor.tryParseMarkdownToBlocks(initialBody))`.
- `editor.isEditable = !readonly` (réactif sur changement de prop via `$effect`).
- Save flow : `editor.onChange(() => editor.blocksToMarkdownLossy() → joinFrontmatter(initialFrontmatter, md) → onChange(...))`.
- Wiring `BlockNoteSlashMenu` + `BlockNoteFormattingToolbar` (mêmes patterns que `_blocknote-test/+page.svelte`).
- `unsubscribers[]` cleanup (onChange, onSelectionChange, store subscriptions, unmount).

**Préservé** :
- API publique : props `content / readonly / mode / onChange / onReady`.
- Frontmatter `<details>` au-dessus.
- Source-mode `<textarea>`.
- `EditorApi { runCommand }` en stub no-op (header `EditorToolbar` était déjà cosmétique).

### Bug latent évité — `replaceBlocks` initial déclenche `onChange`

Sans précaution, le mount du fichier ré-emit le contenu identique vers `onChange` qui déclenche un autosave inutile. Flag `suppressNextChange = true` initialisé avant le `replaceBlocks` initial, reset au premier `onChange` reçu.

### CSS

- Override `--crepe-*` supprimé.
- Tokens Markhub appliqués sur `.preview :global(.bn-editor) {…}` : font-family Geist, scale headings IDE-density (26/21/18/16/14), code/pre/blockquote/links cohérents.
- `app.css` : règle `::selection` retargetée de `.milkdown.milkdown .ProseMirror` vers `.bn-editor.ProseMirror`.
- Polish CSS complet → étape 3.

### Tests

- `tests/component/Editor.test.svelte.ts` : mock `@milkdown/crepe` remplacé par mock `@blocknote/core` (BlockNoteEditor stub minimal). Les 7 tests existants (source-mode, frontmatter rendering, toggle preview/source) passent.
- `tests/visual/_helpers.ts` : sélecteur d'attente `.milkdown .ProseMirror` → `.bn-editor.ProseMirror`.
- Specs Crepe-spécifiques skippées via `test.describe.skip` :
  - `tests/visual/block-handle.spec.ts` (drag handle / transform / duplicate / delete) → réactivé / remplacé à 2.5.c.
  - `tests/visual/editor-slash-menu.spec.ts` → déjà couvert par `tests/visual/blocknote-slash-menu.spec.ts`.
- Baselines régénérées (rendu BlockNote ≠ rendu Crepe) : `editor-headings(-light)`, `app-shell-light`, `task-list(-light)`, `editor-slash-menu-light`, `sidebar-overflow`.

### Bugs acceptés temporairement (cf. PLAN-BLOCKNOTE.md §"Bugs ACCEPTÉS")

- Pas de drag handle ⋮⋮ visible (rétabli à 2.5.c)
- Pas de transform menu au clic ⋮⋮ (slash menu via `/` accessible)
- Pas de toolbar custom sur les liens (`prompt()` du formatting toolbar)
- Tables : pas de boutons `+` row/col custom, drag natif fonctionnel
- Polish CSS imparfait (étape 3)

### Smoke test attendu

URL : `http://localhost:1420/` (app principale, **PAS** `/_blocknote-test`). Procédure 11 étapes documentée dans le plan. Bugs INTERDITS = STOP : fichier ne s'ouvre pas, sauvegarde cassée (perte de données), frontmatter perdu, crash, régression sidebar/status bar/vaults, drag-and-drop totalement impossible.
