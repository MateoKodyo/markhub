# STATE — état brutal et factuel du projet

> Porte d'entrée pour reprise de session. Lecture obligatoire avant tout.
> Pas de récap de progrès, pas d'optimisme. Faits seulement.

## Date de mise à jour

2026-05-13 (soir) — session frontmatter UI : STEPS 1+2+3 du PLAN-FRONTMATTER-UI livrés. Commit unique `aa93a83`. Retrait du champ `behavior` côté Rust (alignement avec retrait TS antérieur, fixe le warn `settings_write — missing field behavior` qui revenait à chaque persist).

## Branche courante

`main` — **5 commits d'avance sur `origin/main`** (push à faire par Matheo).

Dernière séquence de commits :

```
aa93a83 feat(frontmatter): UI block with collapsible read + structured edit modes
430e8e2 style(tabs): 4px top-left/top-right radius on each tab
d6cb591 style(tabs): drop the accent top border on the active tab
2d66604 style(tabs): wider, more contrasted, Warp-style accent top border
5a23542 feat(status-bar): content-width slider — percent of editor area
f3f5c96 chore(state): refresh handoff docs after the 16-commit afternoon/evening
078d849 fix(outline): route outline-panel jumps through source-mode scroll
fa5b1b4 fix(panels): outline resize handle now lives on the panel's edge
05d5420 refactor(sidebar): + icon next to "Vaults" header, drop the bottom button
653bffc fix(panels): window-level pointer events + third resize (vaults / files)
```

## Tests (état final)

- cargo : **120/120 ✅**
- vitest : **464/464 ✅** (+57 depuis 407 — frontmatter parser/store/collapsed/component + STEP 3 edit)
- svelte-check : **0 erreur / 0 warning ✅**
- Aucun test désactivé.

## Working tree (non-committé)

Housekeeping héritée d'avant la session, **non touchée par moi** :
- `M JOURNAL.md` (à mettre à jour par Matheo)
- `D MIGRATION-NOTES.md`, `D PLAN-BLOCKNOTE.md`, `D PLAN.md` (relocations vers `plan-110526/`)
- `?? plan-110526/PLAN-BLOCKNOTE.md`, `?? features/PLAN-AI-AGENT.md`, `?? icon/`
- `?? src-tauri/.svelte-kit/` (devrait être gitignoré — vérifier)

## Chantiers

| Chantier | Statut |
|---|---|
| C1 — Migration Crepe → BlockNote | ✅ MERGÉ (2026-05-11) |
| PLAN-DESIGN-DEFAULTS | ✅ MERGÉ (2026-05-12) |
| PLAN-SETTINGS (8 steps) | ✅ MERGÉ 2026-05-14 (body typo BACKLOG) |
| PLAN-COMMAND-SYSTEM (8 steps) | ✅ MERGÉ 2026-05-14 |
| Onglets de fichiers (Phase 5c) | ✅ MERGÉ 2026-05-14 |
| Cmd+F find-in-document | ✅ LIVRÉ 2026-05-14 |
| Resize handles trio | ✅ LIVRÉ 2026-05-14 |
| Content-width slider % StatusBar | ✅ LIVRÉ 2026-05-14 |
| Tabs polish Warp/Cursor (4px radius, no top border) | ✅ LIVRÉ 2026-05-14 |
| **PLAN-FRONTMATTER-UI STEP 1 (parser+store)** | **✅ LIVRÉ 2026-05-13** |
| **PLAN-FRONTMATTER-UI STEP 2 (read mode)** | **✅ LIVRÉ 2026-05-13** |
| **PLAN-FRONTMATTER-UI STEP 3 (structured edit)** | **✅ LIVRÉ 2026-05-13 — user-validé** |
| PLAN-FRONTMATTER-UI STEP 4 (raw YAML edit) | ⏳ NEXT |
| PLAN-FRONTMATTER-UI STEP 5 (typed controls: date/tags/toggle/number) | ⏳ |
| PLAN-FRONTMATTER-UI STEP 6 (collapsed state — disque) | ⏳ (actuellement localStorage transient — module `frontmatterCollapsed.svelte.ts`) |
| PLAN-FRONTMATTER-UI STEP 7 (visual polish + Playwright baselines) | ⏳ |
| Body typography (PLAN-SETTINGS STEP 3 dette) | ⛔ 4e tentative reverted, BACKLOG |
| Drag-drop FROM Finder | ⛔ reverted, BACKLOG |
| Outline V2 Notion rail | gelé |
| Flash blanc resize | gelé |

## Architecture du frontmatter UI (livré)

`Editor.svelte` rend `<FrontmatterBlock>` au-dessus de BlockNote uniquement en preview (source mode garde la YAML inline dans le textarea). 3 états :

1. **Read** (default collapsed) — strip d'une ligne `▶ FRONTMATTER · N clé(s)`. Click sur la toggle → expansion → rows clé/valeur + pencil top-right.
2. **Edit-structured** — pencil → mode édition. Chaque ligne = inputs key + value, `+ Ajouter un champ` bottom, `✕` par ligne. Commit débounced 200ms via `onChange(data)`. Cancel restaure le snapshot, Done flush le pending. **Round-trip type-preservant** : la valeur passe par `yaml.load(valueStr)` → `42` devient number, `true` boolean, `2026-05-13` Date.
3. **Error** — banner rouge si le YAML ne parse pas, raw YAML affiché en monospace + bouton "Modifier le YAML brut" inerte jusqu'à STEP 4.

**Quiet-by-default** : pas d'état "Ajouter" affiché pour les fichiers sans frontmatter (écart conscient de la lettre du plan §2 — STEP 3+ pourra réintroduire via palette).

**Persistance collapsed** : `localStorage['markhub.frontmatter.collapsed.v1']` = map keyed `vaultId::relativePath`. Module `src/lib/stores/frontmatterCollapsed.svelte.ts`. STEP 6 du plan déplacera ça en disque app config dir.

**Valeurs complexes** (arrays / objects nested) : readonly dans le edit form avec tooltip "Éditer en mode brut (à venir)". STEP 4 livrera l'escape hatch.

**Wire avec autosave** : `Editor.svelte::onFrontmatterChange` re-serialize via `serializeFrontmatter()`, récupère le body courant de BlockNote (`blocksToMarkdownLossy()`) ou fallback sur `body` $derived, puis appelle `onChange(joinFrontmatter(newYaml, body))` qui remonte au store + autosave. **BlockNote onChange a été corrigé** pour lire `frontmatter` $derived au callback-time (au lieu de `initialFrontmatter` capturé à mount) — sinon une édition body après une édition frontmatter clobbait celle-ci.

## Rust nettoyé

`UserSettings.behavior` retiré (struct `BehaviorSettings` supprimée). Le champ était inerte côté TS depuis le retrait de la section Behavior en 2026-05-14, mais le payload côté Rust l'attendait toujours en sérialisation, déclenchant un warn `settings_write — missing field behavior` à chaque persist. Tests cargo cleanés (2 assertions retirées). 120/120 verts.

## Surface livrée en production (inchangée)

**Raccourcis globaux** :
- `⌘K` palette de commandes
- `⌘P` file switcher
- `⌘⇧F` search vault (ripgrep)
- `⌘F` find-in-document
- `⌘G` / `⇧⌘G` next/previous match
- `⌘\` outline panel toggle
- `⌘W` ferme le tab actif
- `⌘1..9` active le N-ième tab
- `⌘S` save manuel — `⌘,` settings

**Layout 3 colonnes resizables** :
- Sidebar gauche (180-480px) avec split vertical Vaults/Files (80-600px)
- Main editor au milieu avec tabs Cursor-style intégrant le mode-toggle + outline button
- Outline panel droite (200-480px) toggleable, handle sur son edge gauche

**StatusBar** : pill compteur (mots/caractères/tokens cycliques), reading time, slider content-width en %, save status, theme toggle, settings shortcut.

## Pattern "auto-switch source" pour le scroll programmatique

Inchangé. Find / search hits / outline click basculent en source mode quand l'utilisateur est en preview. BlockNote scroll programmatique BACKLOG'd.

## BACKLOG (dettes ouvertes)

Voir `BACKLOG.md` :
- **Body editor font-size + line-height** (4e tentative reverted)
- **Scroll-in-preview pour jumps** (workaround source-mode partout)
- **Drag-drop FROM Finder** (refactor pointer events nécessaire)
- **Flash blanc resize** (objc CALayer)
- **PLAN-COMMAND-SYSTEM follow-ups** : double-scan vault tree, SearchOptions UI
- **Outline V2 Notion rail** (gelé)

Idées identifiées en cours de session 2026-05-13 (frontmatter) :
- "Add frontmatter" affordance via palette pour fichiers sans `---` (skipped par décision quiet-by-default, à reconsiderer après STEP 4-5)
- Inline duplicate-key validation pendant l'édition (v2)
- Field-level undo dans le edit mode (v2)
- Migration localStorage → disque pour collapsed state (STEP 6 du plan)

## Fichiers à relire en début de prochaine session

1. `STATE.md` (ce fichier — porte d'entrée)
2. `CLAUDE.md`
3. `WORKPLAN.md`
4. `PLAN-FRONTMATTER-UI.md` (chantier actif — STEPS 4-8 à venir)
5. `JOURNAL.md` (dernière entrée à compléter par Matheo)
6. `BACKLOG.md`

## Prochaine session

Toutes les pistes :
- **PLAN-FRONTMATTER-UI STEP 4** — raw YAML edit mode (textarea monospace, validation live, switch depuis structured / depuis error banner) ~1-2h
- **PLAN-FRONTMATTER-UI STEP 5** — typed controls : date picker, tag chips, toggle boolean, number input ~2-3h
- **PLAN-FRONTMATTER-UI STEP 6** — collapsed state persistence sur disque (`frontmatter-state.json` app config dir) ~1h
- **PLAN-FRONTMATTER-UI STEP 7** — visual polish + Playwright baselines ~2h
- Tab right-click menu + middle-click close (~30min)
- Pin tab (~1h)
- Réordrer vaults (~30min)
- Find-and-replace (~1h)
- Body typography via BlockNote theming API (~2-3h research+dev)
- Scroll preview via ProseMirror view.coordsAtPos (~1-2h)
- Drag-drop FROM Finder via pointer events (~1-2h)
