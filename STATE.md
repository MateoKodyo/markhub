# STATE — état brutal et factuel du projet

> Porte d'entrée pour reprise de session. Lecture obligatoire avant tout.
> Pas de récap de progrès, pas d'optimisme. Faits seulement.

## Date de mise à jour

**2026-05-20** — **Rename Markhub → Markus livré et push.** L'app porte
désormais son nom définitif **Markus**. Rename complet : productName,
bundle id `com.kodyo.markus`, crate Rust `markus`, package npm,
data dir, clés localStorage `markus.*`, docs vivants. Exception
délibérée : les 2 thèmes signature gardent le nom "Markhub Light/Dark"
et les ids `markhub-light`/`markhub-dark`. Repo GitHub renommé
`Kodyo-studio/markus`, remote local à jour. DMG `Markus_0.1.0-alpha.1`
buildé et testé OK par Matheo.

## Branche courante

`main` — **sync avec `origin/main`** à `6095de4`. Tout est push.
Repo : `https://github.com/Kodyo-studio/markus`.

Dernière séquence de commits (récent → ancien) :

```
6095de4 docs(journal): session 2026-05-20 — Markhub → Markus rename
5589e1e feat(rename): Markhub → Markus — complete app rename
8d0d89c chore: gitignore local screenshots-ui directory
ba551fa chore(release): bump version to 0.1.0-alpha.1
817bdfa docs(backlog): refresh export note — drop stale puppeteer plan
662b030 chore(editor): consolidate table-handle coalesce
a3207d9 fix(editor): table handles add-row/add-col now work
fae2f0b refactor(editor): FloatingBar polish — vertical discreet + drop split
8bc740a fix(editor): vertical FloatingBar shows all actions
c583862 feat(editor): FloatingBar vertical/right mode + position setting
e0b3f89 feat(editor): copy-selection pill next to formatting toolbar
bd23bf6 docs(journal): session 2026-05-18
e891e22 feat(dev): debug shortcut Cmd+Shift+T to cycle the 6 light themes
70a4317 feat(themes): PLAN-LIGHT-THEMES STEP 2 — BlockNote bridging
bf9bc1f chore(themes): post-review cleanup
826f960 feat(themes): six light theme palettes with sage signature
08306f6 feat(editor): floating action bar + Settings Apparence refonte
66c22de feat(theming): add Terminal (Warp) + Editor (Cursor) dark themes
```

## Branches actives (non mergées)

| Branche | Statut |
|---|---|
| `feat/editor-polish` | ⏸ PAUSÉE (WIP `cb9dbcf`). STEPS 1-3 partiels, 2 bugs CSS cascade non résolus (H1 serif + blockquote color). PAUSE NOTE en tête de `PLAN-POLISH-EDIT.md`. **Ne pas merger.** |

## Tests (état actuel sur main)

- cargo : **156/156 ✅**
- vitest : **543/543 ✅**
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

**Sidebar file visibility** : toggle Eye/EyeOff, non-markdown mutés ou
filtrés selon `sidebar.hideNonMarkdown`.

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

## Fichiers untracked (déposés par Matheo, non traités)

`PLAN-AI-COMMANDS.md`, `PLAN-AI-READY.md`, `PLAN-CLI.md` — 3 plans
déposés à la racine pendant le chantier rename. Pas encore priorisés ni
traités. Untracked, hors de tout commit.

## Fichiers à relire en début de prochaine session

1. **`STATE.md`** (ce fichier — porte d'entrée)
2. **`CLAUDE.md`**
3. **`WORKPLAN.md`**
4. **`JOURNAL.md`** (dernière entrée 2026-05-20 — rename Markus)
5. **`BACKLOG.md`**
6. `PLAN-LIGHT-THEMES.md` si reprise du theming
7. `PLAN-POLISH-EDIT.md` si reprise de `feat/editor-polish` (voir PAUSE NOTE)

## Prochaine session — checklist de démarrage

1. **Renommer le dossier local** `markhub` → `markus` (hors session).
2. **Body typography** : décider — soit confirmer que le fix du 18 mai
   marche (via le diagnostic log déjà en place) et retirer le
   `console.log`, soit reprendre le diagnostic.
3. **Plans `PLAN-AI-*` / `PLAN-CLI`** : Matheo les priorise quand il veut.
4. Reprise possible : PLAN-UI-PAPER STEP 9, ou `feat/editor-polish`.
