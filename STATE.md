# STATE — état brutal et factuel du projet

> Porte d'entrée pour reprise de session. Lecture obligatoire avant tout.
> Pas de récap de progrès, pas d'optimisme. Faits seulement.

## Date de mise à jour

2026-05-14 (fin d'après-midi) — longue session : PLAN-THEMING v1 mergé, PLAN-FRONTMATTER-UI v1 mergé, **PLAN-EDITOR-POLISH démarré puis pausé** (2 bugs visuels non résolus), **PLAN-UI-PORT-PENCIL démarré puis bloqué** (MCP enregistré mais tools pas chargés dans la session courante — restart Claude Code requis).

## Branche courante

`main` — **1 commit d'avance sur `origin/main`** (housekeeping, push à faire par Matheo).

Dernière séquence de commits sur main :

```
b116c01 chore: housekeeping — relocate retired plans, refresh app icons, drop retired notes
7469dc8 chore(frontmatter): closure — PLAN-FRONTMATTER-UI v1 complete
ff96807 feat(frontmatter): visual polish and Playwright baselines
0a07bb8 feat(frontmatter): persist collapsed state to disk
af51767 feat(frontmatter): typed controls — date, tags, toggle, number
650fb68 feat(frontmatter): raw YAML edit mode
930cd25 feat(theming): swap Solar/Tokyo for Cocoa (Claude-warm) and Forest (kaki)
c3b7252 docs(theming): close PLAN-THEMING progress table
cd636e0 fix(theming): theme selectors lost the cascade race against the :root fallback
fc18d14 chore(theming): final audit and documentation update
```

Plus en amont : 8 autres commits theming (af998e5..) — voir `git log`.

## Branches actives (non mergées)

| Branche | Commits ahead de main | Statut |
|---|---|---|
| `feat/editor-polish` | 1 | ⏸ PAUSÉE (WIP `cb9dbcf`). Plan partiellement appliqué (STEPS 1-3), 2 bugs visuels non résolus côté CSS cascade. PAUSE NOTE détaillée en tête de `PLAN-POLISH-EDIT.md`. **Ne pas merger.** |

## Tests (état actuel sur main)

- cargo : **126/126 ✅**
- vitest : **505/505 ✅**
- svelte-check : **0 erreur / 0 warning ✅**
- Aucun test désactivé.

## Working tree (non-committé)

- `?? Pencil/markhub.pen` — placeholder `.pen` créé via Pencil Desktop app (frame 800×600 blanche, version "2.11"). Pas committé pour ne pas figer un emplacement / structure encore en flux. Le plan dit `design/markhub.pen` à la racine ; l'app a créé `Pencil/markhub.pen`. À trancher au reboot de session.

## Chantiers

| Chantier | Statut |
|---|---|
| C1 — Migration Crepe → BlockNote | ✅ MERGÉ (2026-05-11) |
| PLAN-DESIGN-DEFAULTS | ✅ MERGÉ (2026-05-12) |
| PLAN-SETTINGS (8 steps) | ✅ MERGÉ 2026-05-14 |
| PLAN-COMMAND-SYSTEM (8 steps) | ✅ MERGÉ 2026-05-14 |
| Onglets de fichiers (Phase 5c) | ✅ MERGÉ 2026-05-14 |
| Cmd+F find-in-document, resize handles, content-width slider, tabs polish | ✅ LIVRÉS 2026-05-14 |
| PLAN-FRONTMATTER-UI STEPS 1-3 (parser/store/read/edit-structured) | ✅ MERGÉ 2026-05-13 |
| **PLAN-FRONTMATTER-UI STEPS 4-8 (raw YAML, typed controls, disk persist, polish + closure)** | **✅ MERGÉ 2026-05-14** |
| **PLAN-THEMING v1 — 4 thèmes curated, picker à 2 slots, OS-follow, anti-flash** | **✅ MERGÉ 2026-05-13** |
| **PLAN-THEMING iteration Cocoa + Forest (remplacent Solar/Tokyo)** | **✅ MERGÉ 2026-05-13** |
| **PLAN-EDITOR-POLISH (16 steps)** | **⏸ PAUSÉ après STEPS 1-3 partiels — `feat/editor-polish` branch, 2 bugs CSS cascade (H1 serif + blockquote color)** |
| **PLAN-UI-PORT-PENCIL (7 steps)** | **🚧 BLOQUÉ avant STEP 1 — MCP enregistré mais tools pas dans la session courante** |
| PLAN-UI-PORT-PAPER (mirror plan Pencil) | ⏳ pas démarré (mirror du Pencil run, sera lancé après) |
| Body typography (PLAN-SETTINGS STEP 3 dette) | ⛔ 4e tentative reverted, BACKLOG |
| Drag-drop FROM Finder | ⛔ reverted, BACKLOG |
| Outline V2 Notion rail | gelé |
| Flash blanc resize | gelé |

## PLAN-EDITOR-POLISH — état précis (branche `feat/editor-polish`)

**Ce qui marche** :
- CSS architecture restructurée en 15 sections nommées (STEP 1)
- Heading scale appliqué (STEP 2) : H1 2em, H2 1.5em, H3 1.1875em, H4 1em, H5 0.875em, H6 0.8125em avec letter-spacing + weight + line-height per level. Override propre via redéfinition de la variable `--level` de BlockNote.
- Vertical rhythm Notion-aligned (STEP 3) : H1 64/20, H2 48/16, H3 36/12, H4-H6 28/16, paragraph 0/14, list items 0/6, blockquote/code/table 20/20.
- Checkbox refactor : 18×18, radius 4, margin-right 10, checkmark 11, strikethrough sur checked + couleur muted.
- Body line-height 1.55, list items 1.55.
- Side-effect (agent fix) : `src/routes/+page.svelte` chrome split sidebar/canvas pour éliminer le seam dans le title-bar overlay.

**Ce qui ne marche PAS — bugs non résolus** :
1. **H1 font-family** : reste rendu en **serif** sur certains fichiers (PLAN-FRONTMATTER-UI.md, PLAN-EDITOR-POLISH.md, etc.) malgré une règle `!important` correctement écrite sur `.preview .bn-editor h1`. **Hypothèse principale** : Vite ne reload pas `editor-blocknote.css` après edit dans cette session — le cache HMR a probablement bloqué les overrides récents.
2. **Blockquote text color** : reste `--color-text-body` (gris) au lieu de `--color-text-primary` (cream) malgré règle `!important` sur tous les descendants. Même diagnostic suspecté.

**À faire au retour sur cette branche** :
1. `rm -rf node_modules/.vite .svelte-kit` puis `npm run tauri dev` → si les 2 bugs disparaissent, c'était bien le cache HMR.
2. Sinon : DevTools dans la fenêtre Tauri, inspect un `<h1>` problématique, regarder les rules computed et la cascade en direct. Cela révèlera la règle qui gagne.
3. Sinon (worst case) : revert le commit WIP, isoler les changements par paquet (commit par STEP), smoke test pas à pas.

## PLAN-UI-PORT-PENCIL — état précis

**Ce qui est en place** :
- Pencil CLI installé via Homebrew (`/opt/homebrew/bin/pencil`, v0.2.6). **Non authentifié** (`pencil status` dit "Not authenticated"). Auth bloquée mais probablement contournable car on passe par le MCP de l'app desktop, pas par le CLI.
- **Pencil Desktop app** installé (`/Applications/Pencil.app`). Son MCP server bundled à `/Applications/Pencil.app/Contents/Resources/app.asar.unpacked/out/mcp-server-darwin-arm64`.
- **MCP server enregistré au scope user dans Claude Code** : `claude mcp list` → `pencil: ... ✓ Connected`.
- Un `Pencil/markhub.pen` minimal créé manuellement via l'app (frame 800×600 blanche, version "2.11"). Non committé.

**Ce qui bloque** :
- **Les tools MCP Pencil ne sont pas chargés dans la session Claude Code courante**. Claude Code charge les MCP servers au démarrage ; un serveur ajouté en cours de session ne devient pas accessible avant un restart de session.
- ToolSearch query="pencil" retourne "No matching deferred tools found" — confirmation.

**À faire au retour pour démarrer Pencil** :
1. **Quitter et relancer la session Claude Code** (CLI ou IDE host).
2. **Premier check** : `ToolSearch query="pencil"` doit lister les tools du MCP Pencil.
3. **Adapter PLAN-UI-PENCIL.md** au modèle réel (MCP server du Desktop app, pas extension IDE comme le plan le décrit). Le plan a été rédigé sur des assumptions Pencil = extension IDE avec MCP — la réalité c'est Desktop app séparée + MCP bundled.
4. Vérifier où placer le `.pen` : plan dit `design/markhub.pen`, app a créé `Pencil/markhub.pen`. Trancher.
5. Créer la branche `feat/ui-port-pencil` from main.
6. Lancer STEP 1 round-trip test via les tools MCP.

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

**4 thèmes** (depuis PLAN-THEMING) : Markhub Light, Markhub Dark, Cocoa (warm browns), Forest (kaki). Picker à 2 slots dans Settings → Apparence.

**Frontmatter custom UI** (depuis PLAN-FRONTMATTER-UI) : block au-dessus de BlockNote avec read collapsed + structured edit (controls typés date/tags/toggle/number) + raw YAML edit + collapsed state sur disque (`frontmatter-state.json`).

## BACKLOG (dettes ouvertes)

Voir `BACKLOG.md` :
- **Body editor font-size + line-height** (4 tentatives reverted)
- **Scroll-in-preview pour jumps** (workaround source-mode partout)
- **Drag-drop FROM Finder** (refactor pointer events nécessaire)
- **Flash blanc resize** (objc CALayer)
- **PLAN-COMMAND-SYSTEM follow-ups** : double-scan vault tree, SearchOptions UI
- **Outline V2 Notion rail** (gelé)
- **PLAN-EDITOR-POLISH STEPS 1-3** : 2 bugs CSS cascade à résoudre (`feat/editor-polish` branche)
- **Pencil tools loading** : restart session Claude Code requis

## Fichiers à relire en début de prochaine session

1. **`STATE.md`** (ce fichier — porte d'entrée)
2. **`CLAUDE.md`**
3. **`WORKPLAN.md`**
4. **`PLAN-UI-PENCIL.md`** (chantier prioritaire — STEP 1 à démarrer après restart session)
5. **`PLAN-POLISH-EDIT.md`** (à lire seulement si tu reprends `feat/editor-polish` — voir PAUSE NOTE en tête)
6. **`JOURNAL.md`** (dernière entrée 2026-05-14 — session longue)
7. **`BACKLOG.md`**

## Prochaine session — checklist de démarrage

1. **Push origin/main** (1 commit ahead).
2. **Restart Claude Code** pour charger les tools MCP Pencil.
3. `ToolSearch query="pencil"` → confirmer les tools dispos.
4. Adapter PLAN-UI-PENCIL.md selon ce que le MCP expose réellement (lister les tools dans le plan).
5. Démarrer STEP 1 du PLAN-UI-PENCIL — vraie scaffold de branche + round-trip MCP.
