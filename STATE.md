# STATE — état brutal et factuel du projet

> Porte d'entrée pour reprise de session. Lecture obligatoire avant tout.
> Pas de récap de progrès, pas d'optimisme. Faits seulement.

## Date de mise à jour

**2026-05-21** — **PLAN-AI-READY clôturé (STEPS 1-7) + gros batch de
polish UI.** Markus reconnaît désormais les fichiers de collaboration IA
(`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `CODEX.md`, frontmatter
`audience:`) — badge sidebar, chip éditeur, panneau "AI Context", 3
commandes ⌘K. En parallèle : refonte de la recherche in-document (champ
inline + highlight in-text), en-tête sidebar fixe + 2 switches de
filtrage, dossiers colorés, FloatingBar unifiée. Session autonome —
**la recherche/highlight n'a PAS été vérifiée visuellement**.

## Branche courante

`main` à `1137473` **+ le commit docs de clôture qui suit cette mise à
jour**. **NON push** — `git push` reste à faire par Matheo.
Repo : `https://github.com/Kodyo-studio/markus`.

Dernière séquence de commits (récent → ancien) :

```
1137473 feat(ai-ready): command palette integration            (STEP 6)
ceb659d feat(editor): inline document search with in-text highlighting
83e808d style(editor): unify FloatingBar surface across orientations
94af7e8 feat(sidebar): optional accent-tinted folder icons
83b79b2 feat(sidebar): fixed files header + filter switches
237900b style(editor): drop the FloatingBar drop shadow in bottom position
a48a1c4 style(editor): high-contrast active segment in FloatingBar mode picker
31d7ba9 refactor(editor): drop redundant mode + outline toggles from header
7571d08 fix(ai-ready): AI Context items mirror the file tree row
3dd950f feat(ai-ready): AI Context panel in sidebar             (STEP 5)
f8f3225 feat(ai-ready): editor header chip for AI-aware files   (STEP 4)
d5b36c6 fix(ai-ready): reactive aiAwareStore via SvelteMap
7adbf99 feat(ai-ready): sidebar badge with Settings toggle      (STEP 3)
812d1ec feat(ai-ready): aiAwareStore with vault scan integration (STEP 2)
4bbf517 feat(ai-ready): deterministic detector for AI-aware files (STEP 1)
```

## Branches actives (non mergées)

| Branche | Statut |
|---|---|
| `feat/editor-polish` | ⏸ PAUSÉE (WIP `cb9dbcf`). STEPS 1-3 partiels, 2 bugs CSS cascade non résolus (H1 serif + blockquote color). PAUSE NOTE en tête de `PLAN-POLISH-EDIT.md`. **Ne pas merger.** |

## Tests (état actuel sur main)

- cargo : **158/158 ✅**
- vitest : **580/580 ✅**
- svelte-check : **0 erreur / 0 warning ✅**
- Aucun test désactivé.

## Catalogue de thèmes (12)

- **Light (6)** : `markhub-light` (sage signature — thème par défaut light),
  `terracotta`, `rose`, `amber`, `ink`, `plum`. Source : PLAN-LIGHT-THEMES.
- **Dark (6)** : `markhub-dark` (défaut dark), `forest`, `kodyo`, `sage`,
  `terminal` (Warp-inspired), `editor` (Cursor-inspired).
- Les ids `markhub-light`/`markhub-dark` + noms "Markhub Light/Dark" sont
  conservés volontairement (le nom d'origine vit dans les thèmes signature).
- Picker dual-slot dans Settings → Apparence. OS-follow.

## Surface livrée en production

**Raccourcis globaux** : `⌘K` palette, `⌘P` file switcher, `⌘⇧F` search
vault, `⌘F` find-in-doc, `⌘G`/`⇧⌘G` next/prev match, `⌘\` outline,
`⌘W` close tab, `⌘1..9` tab N, `⌘S` save, `⌘,` settings.
`⌘⇧T` (dev only) cycle des 6 light themes.

**FloatingBar** (sessions 2026-05-18/20) : pill flottante en bas de
l'éditeur (search / export / copy / mode picker preview-source /
outline). Setting `editorFloatingBarPosition` (`bottom` | `right`) dans
Settings → Apparence → Interface : mode `right` = colonne verticale
collée au bord droit, discrète (bg éditeur, sans ombre). Le segment
"split view" a été retiré du mode picker (feature non développée).

**Copy pill** : sélection de texte → second pill à droite de la
formatting toolbar avec un bouton Copy (presse-papier, HTML + texte).

**Tables BlockNote** : les handles add-row/add-col fonctionnent (fix du
2026-05-20 — coalesce du state quand le curseur quitte la cellule).

**Settings Apparence** : réglages typo (police/taille/hauteur/largeur)
en number fields + bouton "Appliquer" (draft → commit).

**12 thèmes** (cf. section catalogue ci-dessus).

**Frontmatter custom UI** : block au-dessus de BlockNote (read collapsed
+ structured edit + raw YAML + collapsed state sur disque).

**Export Markdown** : 3 entrées UI (Cmd+K, bouton Download status bar +
FloatingBar, context menu sidebar). Pipeline de normalisation Rust.

**Sidebar files header** (2026-05-21) : en-tête "Fichiers" fixe (ne
scrolle plus — seul l'arbre scrolle), icône de filtre, et 2 switches
sous le champ de filtre : "Show all files" (= `sidebar.hideNonMarkdown`,
remplace l'ancien toggle œil) et "Show AI files" (filtre session-only,
arbre réduit aux fichiers AI-aware). Filtres indépendants et composables.

**AI-READY** (2026-05-21, PLAN-AI-READY clôturé) : reconnaissance
déterministe (zéro LLM) des fichiers de collaboration IA — `CLAUDE.md`,
`AGENTS.md`/`AGENT.md`, `GEMINI.md`, `CODEX.md`, frontmatter
`audience: ai|<agent>`. Badge étincelle dans la sidebar, chip dans
l'en-tête éditeur, panneau "AI Context" repliable en bas de sidebar,
3 commandes ⌘K (groupe "AI"). Réglage `appearance.highlightAiAware`
(défaut ON) dans Apparence. Patterns cachés (`.cursor`, `.github`,
`.aider`) différés — le scan ignore les dotfiles (cf. Dettes).

**Recherche in-document** (2026-05-21, refonte) : champ de recherche
inline dans la FloatingBar horizontale (compteur + flèches prev/next +
clear ; ⌘F le focus). Highlight in-text de tous les résultats en mode
preview via la CSS Custom Highlight API. Mode source = sélection
textarea simple. La popup top-right est conservée uniquement pour la
FloatingBar verticale. **Non vérifié visuellement** (session autonome).

**Apparence — dossiers colorés** : réglage `appearance.colorFolders`
(défaut OFF) — teinte les icônes de dossier de la sidebar à l'accent.

## Chantiers

| Chantier | Statut |
|---|---|
| C1 — Migration Crepe → BlockNote | ✅ MERGÉ 2026-05-11 |
| PLAN-DESIGN-DEFAULTS / SETTINGS / COMMAND-SYSTEM | ✅ MERGÉ 2026-05-12/14 |
| Onglets de fichiers, Cmd+F, resize handles | ✅ LIVRÉS 2026-05-14 |
| PLAN-FRONTMATTER-UI (8 steps) | ✅ MERGÉ 2026-05-14 |
| PLAN-EXPORT-MD | ✅ MERGÉ 2026-05-14 |
| PLAN-THEMING v1 (4 thèmes, picker, OS-follow) | ✅ MERGÉ 2026-05-13 |
| PLAN-UI-PAPER (9 steps) | 🟡 STEPS 1-8 livrés 2026-05-15, STEP 9 export différé |
| PLAN-SIDEBAR-FILE-VISIBILITY | ✅ MERGÉ 2026-05-15 |
| Terminal + Editor dark themes | ✅ MERGÉ 2026-05-18 |
| FloatingBar (bottom + vertical) + copy pill | ✅ MERGÉ 2026-05-18/20 |
| **PLAN-LIGHT-THEMES (6 light themes)** | **✅ STEPS 1-3 MERGÉS 2026-05-18. STEP 4 (Playwright baselines) abandonné par décision Matheo.** |
| Table handles fix | ✅ MERGÉ 2026-05-20 |
| **Rename Markhub → Markus** | **✅ MERGÉ 2026-05-20. Phase H (dossier local) reste à faire.** |
| **PLAN-AI-READY (7 steps)** | **✅ STEPS 1-7 sur `main` 2026-05-21. Smoke test interactif STEP 7 à faire par Matheo.** |
| **Refonte recherche + batch UI polish** | **✅ sur `main` 2026-05-21 (7 items). Recherche/highlight non vérifiée visuellement.** |
| PLAN-CLI | ⏳ déposé, non démarré |
| PLAN-EDITOR-POLISH | ⏸ PAUSÉ — `feat/editor-polish`, 2 bugs CSS cascade |
| Body typography (font-size/line-height) | ⚠️ voir Dettes ci-dessous |

## Dettes ouvertes / ce qui ne marche pas

- **Body typography font-size + line-height** : tentative du 2026-05-18
  (sélecteur deep `.bn-block-content[data-content-type] .bn-inline-content`
  + `!important` + vars `--editor-body-*` câblées dans `+page.svelte`).
  **Statut réel incertain** — pas de confirmation explicite que la taille
  s'applique en live. Le diagnostic `console.log` a été retiré (commit
  `9daf73e`). `BACKLOG.md` le liste encore comme non résolu.
- **`feat/editor-polish`** : 2 bugs CSS cascade (H1 serif, blockquote
  color). Branche pausée.
- **Split view BlockNote** : non développé. Segment retiré du FloatingBar
  mode picker. Estimé 2-3 sessions si repris.
- **Recherche / highlight non vérifiée** : la refonte recherche du
  2026-05-21 (champ inline + CSS Custom Highlight API en preview) a été
  faite en session autonome — tests verts (`find` + `domFind`) mais
  **aucune vérification visuelle**. À smoke-tester en priorité : le
  highlight in-text en mode preview, le scroll vers le match actif, le
  compteur, le focus ⌘F.
- **Patterns AI cachés non détectés** : `.cursor/rules`,
  `.github/copilot-instructions.md`, `.aider.conf.*` — le `vault_scan`
  Rust ignore les dotfiles, donc le détecteur ne les voit jamais. Le
  code détecteur les gère (testé). Révéler ces fichiers = décision UX
  (montrer `.cursor`/`.github` dans l'arbre). Cf. `BACKLOG.md`
  PLAN-AI-READY v2.

## Distribution / DMG

- **DMG release** : `Test-Builds/Markus_0.1.0-alpha.1_aarch64.dmg`
  (Apple Silicon). Commité dans le repo (`git add -f` — le dossier
  `Test-Builds/` est sinon gitignoré ; ce DMG alpha est épinglé comme
  artefact de référence).
- **Build** : `bundle_dmg.sh` de Tauri échoue (styling AppleScript sans
  accès GUI) → le DMG est packagé via `hdiutil` depuis le `.app`. Le
  bundle `.app` est ensuite codesigné adhoc proprement
  (`codesign --deep --force --sign -`, ressources scellées).
- **Pas notarisé** : `spctl --assess` → `rejected`. Les destinataires
  doivent faire `xattr -cr /Applications/Markus.app` après installation
  (retire le flag quarantine, sinon macOS affiche un faux "endommagé").
- **Vraie solution en attente** : notarization Apple. Compte Apple
  Developer disponible, mais le certificat *Developer ID Application*
  n'est PAS installé (`security find-identity` → 0 identity) et aucun
  credential `notarytool` n'est stocké. Setup à faire : cert via Xcode +
  app-specific password + Team ID, puis câbler signature + notarization
  dans `tauri.conf.json`.

## Hors-scope / à faire hors session

- **Dossier projet local** : `/Users/lkid/Projects/products/markhub`
  porte encore le nom `markhub`. Le renommer en `markus` casse les
  chemins absolus d'une session Claude Code active — à faire à la main
  hors session (`mv markhub markus`).

## Fichiers untracked / non traités

- `PLAN-CLI.md` — déposé à la racine, non démarré, non commité.
- `TESTS.md` — modifié par Matheo (working tree), laissé tel quel.
- `PLAN-AI-COMMANDS.md` a été supprimé (décision : pas de LLM).
  `PLAN-AI-READY.md` est désormais commité (plan clôturé).

## Fichiers à relire en début de prochaine session

1. **`STATE.md`** (ce fichier — porte d'entrée)
2. **`CLAUDE.md`**
3. **`WORKPLAN.md`**
4. **`JOURNAL.md`** (dernière entrée 2026-05-21 — AI-READY + batch polish)
5. **`BACKLOG.md`** (section PLAN-AI-READY v2)
6. `PLAN-AI-READY.md` si reprise (table de progression, STEP 7)

## Prochaine session — checklist de démarrage

1. **`git push`** des 14 commits de la session 2026-05-21 (non push).
2. **Smoke test PLAN-AI-READY** : badges sidebar, chip éditeur, panneau
   "AI Context", les 3 commandes ⌘K, le toggle Apparence.
3. **Smoke test refonte recherche** (PRIORITÉ — non vérifié) : champ
   inline FloatingBar, highlight in-text en preview, scroll match actif.
4. **Renommer le dossier local** `markhub` → `markus` (hors session).
5. `PLAN-CLI` : Matheo le priorise quand il veut.
