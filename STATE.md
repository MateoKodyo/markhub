# STATE — état brutal et factuel du projet

> Porte d'entrée pour reprise de session. Lecture obligatoire avant tout.
> Pas de récap de progrès, pas d'optimisme. Faits seulement.

## Date de mise à jour

2026-05-15 (session autonome longue, automode) — **PLAN-UI-PAPER STEPS 1–8 livrés**. 18 artboards dans `markhub-assets.paper` (app.paper.design/file/01KRMBRXTQNNYPFE64HVRM2QZS), 2160 nodes. STEP 9 (export PNG @2x) **différé** : budget MCP free tier Paper (~100 calls/sem) dépassé en cours de chantier (~110 calls consommés). Matheo vérifiera demain matin.

### Livré dans Paper
- `chrome/sidebar` (280×900), `chrome/status-bar` (1440×38), `chrome/window-controls` (1440×44), `chrome/tabs-bar` (1440×32) — STEP 3 ✅
- `screen/empty-state`, `screen/file-view`, `screen/settings` (1440×900 chacun) — STEP 4 ✅
- `palette/cmd-k`, `palette/cmd-p`, `palette/cmd-shift-f`, `palette/find-in-doc` (1440×900, file-view cloné en backdrop via `<x-paper-clone>`) — STEP 5 ✅
- `modal/confirm-delete`, `modal/input-dialog`, `menu/sidebar-context-menu`, `menu/vault-dropdown` — STEP 6 ✅
- `inline/frontmatter` (3 modes), `inline/toasts` (success + error) — STEP 7 ✅
- `editor/blocknote-showcase` (single tall artboard, H1-H6 + body + lists + blockquote + code + table + hr) — STEP 8 ✅

### Rework STEP 3 (icon fidelity)
Premier pass STEP 3 a redessiné les SVG Lucide à la main → drift visible (FileText body absent, Settings gear approximatif, Lock à moitié rendu). **Fix mécanique** : pull les `iconNode` verbatim depuis `node_modules/lucide-svelte/dist/icons/{kebab}.svelte`, suivre les alias (`Code2 → code-2.js → code-xml.svelte`), translater en inline SVG. 4 artboards chrome reconstruits.

### Docs et règles renforcés
- **PLAN-UI-PAPER.md règle 10 ajoutée** : "Icon fidelity — verbatim from node_modules". Plus règle 11 sur "Mirror discipline — read source before writing pixel".
- **Procédure de testing custom** ajoutée au plan (5 checkpoints : token spot-check, icon fidelity verbatim, live-app side-by-side, state coverage, MCP budget honesty).
- **OBSERVER-NOTES.md** enrichi : MCP limitations (variables, components), conventions STEP 3 (rework + recipe bash), STEP 4-8 tentative answers aux open questions de STEP 1.
- **PAPER-TOKENS.md** créé à la racine — mirror code-side de markhub-dark.css + app.css, source de vérité pour les valeurs inline (Paper MCP n'expose pas de tool variables).
- **Skill `paper-mirror`** mis à jour : section "Lucide icons — verbatim from node_modules", section "Tool limitations & gotchas (Paper MCP)". 2 copies de l'edit syncées (hardlink ~/.claude/skills + ~/Ressources/Skills).

### Détails / décisions
- Le scope tokens Paper a été pivoté en code-side `PAPER-TOKENS.md` car la MCP n'expose pas de tool de gestion variables (vérifié 2× via ToolSearch + relecture guide). Strategy : agent emit valeurs literales inline, source de vérité reste la CSS. Documenté dans OBSERVER-NOTES.md.
- État variants regroupés dans le même artboard quand possible (sidebar avec rest/hover/active dans un seul tree) plutôt qu'éclatés.
- Backdrop dimmed pour overlays = clone du screen/file-view via `<x-paper-clone node-id="EW-0">`. Économise ~150 MCP calls (sinon chaque palette aurait dû ré-émettre l'intégralité du file-view). Pattern à généraliser.
- Dimensions artboards = tailles shipped (sidebar 280, status-bar 1440×38, etc.), pas full-window. Sauf pour les screens et overlays où full-window 1440×900 est nécessaire.
- Theme picker tile : skippé comme artboard séparé puisque déjà visible dans screen/settings.

### Review pass — défauts identifiés et statut

Après livraison initiale des 8 STEPs, Matheo a flaggé "beaucoup, beaucoup de défauts" et demandé une review autonome. Pass systématique screenshot de tous les artboards. Verdict factuel :

**Corrigé pendant la review** :
- ✅ `screen/empty-state` shippait sans file tree dans la sidebar — corrigé (4 rows ajoutés README/SPEC/docs/src).

**Documenté comme limitations Paper MCP, pas corrigé** :
- ⚠️ `palette/find-in-doc` : la `<x-paper-clone node-id="EW-0">` du file-view ne préserve pas les contraintes `width:60%;max-width:760px;padding:32px 64px` du `.editor-canvas` interne. Résultat : le H1 et l'intro paragraphe rendent overlapping, le code block aussi. Sur les autres overlays (cmd-k/cmd-p/cmd-shift-f) ce n'est pas visible parce que le backdrop 0.5 + la palette couvrent le haut de la zone. Sur find-in-doc seul un fin find-bar overlay → le clone bug est visible. Fix possible : remplacer le clone par un placeholder canvas simple. ~10 MCP calls. Différé.
- ⚠️ `editor/blocknote-showcase` body paragraph : les inline `<span style="font-weight:500">bold</span>`, `italic`, `strike`, `link` ne se distinguent pas tous à scale 1 (Paper guide : "Rich text isn't supported in Paper"). Fix possible : isoler chaque inline annotation en block-level avec contexte. Différé.
- ⚠️ États hover/active sidebar (`surface-hover` 0.025 alpha) sont quasi invisibles. **Fidèle à l'app live** (IDE-restrained), mais peut ne pas suffire pour landing-page hero shots. Si besoin : variante boostée à 0.06 dans STEP 7 ultérieur.
- ⚠️ Icônes Lucide à low-contrast (#666469 / #868584 sur near-black) faithful mais peu lisibles à scale 1. Hero shots devront peut-être override la couleur.

**Limitations confirmées (pas des défauts, sont structurelles Paper MCP)** :
- Pas d'API variables → tokens en code-side `PAPER-TOKENS.md`.
- Pas d'API composants → réutilisation via `<x-paper-clone>` (avec bug layout cf. find-in-doc).
- Pas d'animation captée (HTML statique only).
- Inline `<span>` styles flattenés dans certains contextes.

### Limitations honnêtes
- **MCP budget** : consommé probablement ~145/100 hebdo cette semaine (~45 calls au-dessus du free tier). Si Paper renvoie 429 sur prochaines calls, attendre la prochaine semaine ou passer au tier payant.
- **STEP 9 différé** : aucun PNG dans `assets/exports/`. À reprendre en session dédiée (budget MCP frais), via `export` tool ou via Paper UI manuel (File → Export).

## Branche courante

`main` — **3 commits d'avance sur `origin/main`** (housekeeping + docs marathon + export). Push autorisé explicitement cette fois (override de la règle habituelle).

Dernière séquence de commits sur main :

```
602bab8 feat(export): export current file as clean Markdown
5834ef9 docs: refresh STATE + JOURNAL for the 2026-05-14 marathon session
b116c01 chore: housekeeping — relocate retired plans, refresh app icons, drop retired notes
7469dc8 chore(frontmatter): closure — PLAN-FRONTMATTER-UI v1 complete
ff96807 feat(frontmatter): visual polish and Playwright baselines
0a07bb8 feat(frontmatter): persist collapsed state to disk
af51767 feat(frontmatter): typed controls — date, tags, toggle, number
650fb68 feat(frontmatter): raw YAML edit mode
930cd25 feat(theming): swap Solar/Tokyo for Cocoa (Claude-warm) and Forest (kaki)
c3b7252 docs(theming): close PLAN-THEMING progress table
```

Plus en amont : `cd636e0 fix(theming)`, `fc18d14 chore(theming)` + 8 commits theming antérieurs (af998e5..).

## Branches actives (non mergées)

| Branche | Commits ahead de main | Statut |
|---|---|---|
| `feat/editor-polish` | 1 | ⏸ PAUSÉE (WIP `cb9dbcf`). Plan partiellement appliqué (STEPS 1-3), 2 bugs visuels non résolus côté CSS cascade. PAUSE NOTE détaillée en tête de `PLAN-POLISH-EDIT.md`. **Ne pas merger.** |

## Tests (état actuel sur main)

- cargo : **156/156 ✅** (+30 sur `commands::export`)
- vitest : **512/512 ✅** (+7 sur `utils/export`)
- svelte-check : **0 erreur / 0 warning ✅**
- Aucun test désactivé.

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
| **PLAN-EXPORT-MD — export normalisé : pipeline Rust + 3 entrées UI** | **✅ MERGÉ 2026-05-14 (soir)** |
| **PLAN-THEMING v1 — 4 thèmes curated, picker à 2 slots, OS-follow, anti-flash** | **✅ MERGÉ 2026-05-13** |
| **PLAN-THEMING iteration Cocoa + Forest (remplacent Solar/Tokyo)** | **✅ MERGÉ 2026-05-13** |
| **PLAN-EDITOR-POLISH (16 steps)** | **⏸ PAUSÉ après STEPS 1-3 partiels — `feat/editor-polish` branch, 2 bugs CSS cascade (H1 serif + blockquote color)** |
| **PLAN-UI-PAPER (9 steps)** | **🟡 STEPS 1-8 livrés en automode 2026-05-15 — 18 artboards dans Paper, STEP 9 export différé** |
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

**Export Markdown propre** (depuis PLAN-EXPORT-MD) : 3 entrées UI (Cmd+K → "Export File…", bouton Download dans la status bar, item "Exporter…" dans le context menu sidebar). Pipeline de normalisation côté Rust : frontmatter YAML passthrough verbatim, blank line forcée entre frontmatter et body, CRLF/CR → LF, trim trailing whitespace par ligne, collapse 3+ newlines → 2, final LF. Aucune transformation sémantique des tokens markdown. Palette/status bar exportent le buffer courant ; sidebar lit depuis disque.

## BACKLOG (dettes ouvertes)

Voir `BACKLOG.md` :
- **Body editor font-size + line-height** (4 tentatives reverted)
- **Scroll-in-preview pour jumps** (workaround source-mode partout)
- **Drag-drop FROM Finder** (refactor pointer events nécessaire)
- **Flash blanc resize** (objc CALayer)
- **PLAN-COMMAND-SYSTEM follow-ups** : double-scan vault tree, SearchOptions UI
- **Outline V2 Notion rail** (gelé)
- **PLAN-EDITOR-POLISH STEPS 1-3** : 2 bugs CSS cascade à résoudre (`feat/editor-polish` branche)

## Fichiers à relire en début de prochaine session

1. **`STATE.md`** (ce fichier — porte d'entrée)
2. **`CLAUDE.md`**
3. **`WORKPLAN.md`**
4. **`PLAN-UI-PAPER.md`** (chantier prioritaire — STEP 1 à démarrer)
5. **`PLAN-POLISH-EDIT.md`** (à lire seulement si tu reprends `feat/editor-polish` — voir PAUSE NOTE en tête)
6. **`JOURNAL.md`** (dernière entrée 2026-05-14 — session longue)
7. **`BACKLOG.md`**

## Prochaine session — checklist de démarrage

1. **Push origin/main** si commits ahead.
2. **Charger le skill officiel Paper** s'il existe avant tout code — règle d'or pour tout outil tiers, leçon retenue d'une exploration récente.
3. Lire `PLAN-UI-PAPER.md` end to end et démarrer STEP 1.
