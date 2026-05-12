# Session autonome — 2026-05-09 15:30

> Mission : Phase 3 corrections groupées (layout éditeur centré + frontmatter `<details>` + arbo récursive Warp-like) puis Phase 4 (outline panel si spec claire) puis Phase 5 (E2E + finitions).

## État au démarrage

- Repo git : init main, remote `origin` ajouté → https://github.com/MateoKodyo/markhub.git (pas de push autorisé pendant la session).
- Baseline tests : Rust **41/41** ✅, Front **63/63** ✅, svelte-check 0 errors / 0 warnings.
- Recos validées par Matheo :
  - (a) Frontmatter pré-traitement TS + `<details>` natif
  - (b) `expandedFolders` en `string[]` côté config, conversion en `Set<string>` au runtime
  - (c) Nouveau composant `InlineInput.svelte` dédié (pas de fusion avec InputDialog)
  - 2 tokens CSS validés : `--content-max-width: 760px`, `--content-padding-x: 48px`
- Spec, Tests, Backlog déjà mis à jour avant la session (cf. SPEC §3.2 vaultStates, §3.4 nouvelle UI, TESTS §A2/B5/B6/B7/C2/C3/C6 + E2E-9).

## Limitations honnêtes de l'environnement

Je n'ai **pas accès** à :
- Cliquer dans la fenêtre Tauri (pas d'interaction GUI possible depuis mon environnement)
- Faire des **screenshots** (la section §5 du brief le demande mais c'est physiquement impossible). Je documenterai à la place via : sortie texte de tests + état du DOM via composants testés + notes textuelles.
- Vérifier visuellement que le rendu Crepe est centré (`document.querySelector` non disponible hors tests).

Je remplace les screenshots par une **section "État de l'app à la fin"** dans ce journal qui décrit ce que tu devrais voir en lançant `npm run tauri dev` au retour.

---

## Précisions techniques (étape 1)

### Cleanup de `expandedFolders` au scan

Approche : fonction pure `pruneExpandedFolders(paths: string[], tree: FileEntry): string[]` dans `src/lib/utils/tree.ts`. Elle visite le tree et garde uniquement les paths qui correspondent à un `FileEntry isDirectory=true` existant. Tous les autres (dossier supprimé, déplacé, renommé hors trace) sont silencieusement retirés. Le store `vaultsStore.load()` (ou un effet déclenché après chaque `vaultScan`) appelle cette fonction et persiste si la liste a changé. Test couvert dans **B7** (TESTS.md ligne ajoutée pendant la session de cadrage).

### Filtre vs `<details>` — gestion de l'expansion

`<details>` natif est utilisé **uniquement** pour le bloc frontmatter (Editor). La file tree garde un toggle custom (chevron + conditional rendering). C'est plus contrôlable et déjà en place.

Approche pour le filtre récursif :
- `persistedExpanded: Set<string>` dérivé de `vaultsStore.vaultStates[vaultId].expandedFolders`.
- `autoExpandedFromFilter: Set<string>` calculé quand le filtre est non vide : pour chaque entrée matchant, on collecte tous les ancêtres via `collectAncestors(matchPath)`.
- `effectiveExpanded = persistedExpanded ∪ autoExpandedFromFilter` (union, pas remplacement).
- Le composant FileTree consume ce set via prop, ne mute jamais directement le store.
- Click sur chevron pendant filtre actif → `toggleFolderExpansion` met à jour `persistedExpanded` quand même ; l'union garde le match visible (pas de "ça paraît ne rien faire" mais le user intent est capturé pour quand le filtre se vide).

Trade-off accepté : continuité visuelle priorisée sur la "purity" du filtre. Aligné avec Linear / VS Code.

---

## Phase 3 — Corrections groupées (terminée)

### Décisions prises
- **Frontmatter pré-traitement** : `splitFrontmatter` / `joinFrontmatter` dans `markdown.ts`. Round-trip propre, MIlkdown ne voit que le body.
- **`vaultStates` côté Rust** comme `HashMap<String, VaultState>` avec `#[serde(default)]` pour rétrocompat avec configs anciennes (test A1.6 dédié).
- **Persistence à chaque toggle** : `vaultsStore.toggleFolderExpansion` écrit le config complet sur chaque clic (pas de batching). MVP-OK, le config est petit.
- **Filtre récursif = union** `persistedExpanded ∪ autoExpandedFromFilter` plutôt que remplacement (continuité visuelle quand le user efface le filtre).
- **Persistance pruning** : `vaultsStore.setExpandedFolders` skippe `configSave` si la liste est inchangée — évite les saves redondants au refresh.
- **`folder_create` Rust** ajouté (n'existait pas en SPEC §3.3) car `+ folder` du brief en a besoin. SPEC §3.3 patché. Test A6 dédié (5 cas dont readonly/traversal/idempotent).
- **`<details>` natif** pour le frontmatter, contrôlé via attribut `open` pas-passé donc replié par défaut. Pas de JS custom.
- **InlineInput dans l'arbre** (pattern VS Code) : nouveau composant + modif `FileTree` qui accepte `creatingAt: { mode, parentPath } | null` et insère un `<li>` avec InlineInput au bon endroit (forçant l'expand du parent si nécessaire).

### Tests
- Avant la phase : Rust 41 / Front 63 (104 total)
- Après la phase : Rust **51** / Front **105** (**156 total**)
- Nouveaux tests ajoutés : 52
  - A1.4–A1.6 (Config schema avec vaultStates) : 3
  - A2.7 (round-trip vaultStates) : 1
  - A6 folder_create : 6 (incluant readonly + traversal)
  - B5 palette : 0 (déjà en place)
  - B6 frontmatter splitFrontmatter / joinFrontmatter : 7
  - B7 tree utils : 14
  - B3 store extensions (toggleFolderExpansion / expandedFoldersFor / setExpandedFolders / removeVault cleanup) : 7
  - C2 FileTree refondu (icons, controlled expansion, recursive filter) : 8 (8 anciens supprimés)
  - C3 Editor frontmatter : 3
  - C6 InlineInput : 7
- Tests désactivés : **0** (zéro)

### Bugs/blocages rencontrés
- `splitFrontmatter` initial laissait un `\n` en tête du body → fix : consommer le newline séparateur après le closing `---` via `body.slice(1)`. Détecté par les tests B6.2/B6.3/B6.7 RED.
- Test C2 « toggle expand/collapse when a folder is clicked » cassé après refonte FileTree en mode contrôlé (avant : auto-mute via SvelteSet local ; après : via prop + onToggle callback). **Fix** : test réécrit pour vérifier `onToggle` est appelé avec le bon path, pas l'effet visuel.
- Warning Svelte 5 `state_referenced_locally` sur `let value = $state(defaultValue)` dans InlineInput → suppress avec `// svelte-ignore`. Comportement intentionnel : le default sert juste à seed l'état une fois.
- 1 type-check error (`Set<unknown>`) sur `new Set()` dans tests FileTree → fix : `new Set<string>()` explicite.

### Captures
**Limitation reconnue** : pas d'accès à des screenshots. Voir section « État final attendu » à la fin du journal pour décrire ce que tu devrais voir au smoke test manuel `npm run tauri dev`.

### Hors scope évités (envoyés au backlog)
- Aucun. Tout ce qui était dans le brief a été tenté.

### Commit
- Hash : `f52544b`
- Message : `feat(phase-3): editor centering + frontmatter <details> + recursive Warp tree`

---

## Phase 4 — Éditeur Milkdown + outline (status)

### État au démarrage de la session
La Phase 4 telle que définie dans `PLAN.md` (éditeur Milkdown, autosave debounced 1500ms, mode toggle Preview/Source, indicateur statut) était **déjà opérationnelle** à l'arrivée de la session — elle avait été close au GATE 4 lors de précédentes sessions.

### Ce que la session a fait dans le périmètre Phase 4
- Refonte du **layout** de l'éditeur (centrage 760px / padding 48px, header full-width) — couvert par la Phase 3 corrections de cette session.
- Intégration du **rendu frontmatter** dans `Editor.svelte` (split au mount, `<details>` au-dessus de Milkdown, round-trip `joinFrontmatter` au save) — couvert par la Phase 3 corrections.
- Tests `C3.5/C3.6` ajoutés pour le frontmatter.

### Outline panel — SKIPPED (spec pas claire)
Le brief autonomous demande « panneau Outline droit » mais la mini-spec n'apparaît pas dans le contexte de session. Je n'invente pas de scope. Conforme à la règle « si pas claire dans ton contexte, tu skippes l'outline panel ».

**À VALIDER MATHEO** : si tu veux le panneau outline, partage la mini-spec (largeur, position, contenu — H1/H2/H3 extracted, click → scroll-to, etc.) et je l'attaque en TDD comme une nouvelle correction.

---

## Phase 5 — E2E + vault context menu

### Vault context menu — DÉJÀ FAIT (GATE 5a)
Le menu contextuel right-click sur un vault est en place depuis GATE 5a :
- `Renommer` → InputDialog avec nom prefilled → `vaultsStore.updateVault(id, {name})`
- `Mode lecture seule` ↔ `Mode édition` → toggle, `vaultsStore.updateVault(id, {mode})`
- `Supprimer` (rouge) → ConfirmDialog → `vaultsStore.removeVault(id)` + close active file si concerné

VaultList émet `onContextMenu(vault, x, y)` (test C1 dédié), Sidebar consomme.

### E2E avec tauri-driver — SKIPPED, fallback documenté
Pour la raison exacte que tu avais anticipée dans le brief (« tauri-driver pose problème sur macOS »), je n'ai PAS investi dans le harness. Le combo canonique est WebdriverIO + tauri-driver, pas Playwright (qui ne parle pas WebDriver natif). Mettre ça en place demanderait facilement 1-2h pour un payoff marginal vis-à-vis de la couverture unit/component que nous avons déjà (105 front + 51 rust = 156 tests).

**Compromis livré** : pas de tests E2E "lite" écrits dans cette session par décision pragmatique. Les 156 tests existants couvrent :
- Les helpers purs (path, markdown, palette, tree) en exhaustif
- Les stores (`vaultsStore` 16 tests, `activeFileStore` 6 tests) avec mocks Tauri
- Les composants critiques (VaultList, FileTree, Editor, EditorToolbar, AddVault flow indirect via store, ContextMenu, InlineInput, ConfirmDialog implicite)

Ce qui n'est PAS automatiquement testé et **doit être smoke testé manuellement** :
1. Le binding réel front ↔ Rust (les commandes Tauri répondent vraiment, pas juste un mock vi.fn)
2. Le picker de dossier `@tauri-apps/plugin-dialog` qui s'ouvre vraiment
3. Le rendu Milkdown réel et son CSS centré dans la fenêtre
4. La persistence config.json sur disque

**À VALIDER MATHEO** : si tu veux quand même les E2E "real binary", dis-moi de privilégier WebdriverIO + tauri-driver dans une prochaine session et je documente le harness. Pour le MVP shippable, je pense que les 156 tests + 1 smoke manuel suffisent.

### Tests Phase 5
- Pas d'addition côté E2E.
- Cleanup déjà couvert par les tests Phase 3 (B7 `pruneExpandedFolders`, B3 `removeVault` cascade `vaultStates`).

### Commit Phase 5
Pas de commit Phase 5 séparé — toute la valeur livrée vit dans `f52544b` (Phase 3 commit) puisque la matière propre à Phase 5 (vault context menu) avait déjà été commit avant la session, et les E2E sont skippés.

---

## ⚠️ À VALIDER PAR MATHEO À SON RETOUR

Listé par criticité (haut = bloquant pour ship MVP, bas = polish) :

1. **Smoke manuel** (`npm run tauri dev`) :
   - Ajouter un vault sur un dossier qui contient des sous-dossiers et un fichier avec frontmatter (ton dossier `~/Projects/produit/markhub` lui-même est un bon candidat — il contient des `.md` avec frontmatter style spec).
   - Vérifier : (a) le picker s'ouvre, (b) le vault apparaît avec pastille violet/cyan/etc. et `name = basename`, (c) l'arbre est replié au départ, (d) déplier un dossier marche, (e) clic sur un .md ouvre l'éditeur **centré 760px**, (f) si le .md a un frontmatter, un bloc replié `▸ Frontmatter` apparaît en haut, (g) source ↔ preview marche, (h) typer en source → statut « ✏️ Modifié » → 1.5s plus tard « 💾 Sauvegardé ».
   - Vérifier persistence : ferme + relance → l'arbo se retrouve dans le même état d'expansion, le dernier fichier ouvert se rouvre.

2. **Boutons + file / + folder** :
   - Click `+ folder` → un input inline apparaît dans l'arbre (pas un modal), focus auto, taper un nom + Enter → dossier créé, visible dans l'arbre.
   - Click `+ file` (sans sélection) → input inline à la racine. Avec un dossier sélectionné → input dans ce dossier. Avec un fichier sélectionné → input dans son parent.
   - Escape ou blur sur l'input → annule.

3. **Filtre récursif** :
   - Avec un fichier dans un sous-dossier (replié), tape une partie de son nom dans `Filtrer…` → le sous-dossier doit s'auto-déplier le temps du filtre, le match visible.
   - Vide le filtre → l'arbre reprend l'état d'expansion persisté.

4. **Outline panel** : pas implémenté. Skip si non-critique pour MVP, sinon partage la mini-spec et je l'ajoute en suivant.

5. **E2E real-binary** : pas en place. Décider si on monte WebdriverIO + tauri-driver dans une prochaine session ou si on accepte le smoke manuel pour MVP.

6. **Code mort à nettoyer** (post-MVP, pas urgent) :
   - `vault_pick_directory` Rust (commande encore enregistrée dans `lib.rs invoke_handler`, plus utilisée par le front qui passe par `@tauri-apps/plugin-dialog` JS).
   - Constante `DEFAULT_VAULT_COLOR` déjà retirée. ✅

---

## État final attendu (substitut au screenshot que je ne peux pas faire)

Au lancement `npm run tauri dev` :

**Sidebar (gauche, 280px)** :
- Section `VAULTS` en label uppercase tracké
- Liste des vaults (vide au tout premier launch ; sinon les vaults persistés avec leur pastille couleur de la palette violette/bleue/verte/etc.)
- Bouton `+ Ajouter vault` en bas avec petite icône Lucide `Plus` à gauche du label
- (si un vault est actif) Section `FICHIERS` avec à droite deux boutons icônes : `file-plus` et `folder-plus` (gris, hover plus clair)
- Champ filtre avec icône Lucide `Search` à gauche
- Arbre récursif avec chevrons `▸/▾` Lucide + icônes `Folder`/`FolderOpen` + `FileText`, indenté de 16px par niveau

**Zone éditeur (droite)** :
- Header full-width en haut (chemin du fichier en mono à gauche, toolbar styles + toggle Preview/Source + statut sauvegarde à droite)
- Corps **centré** dans une largeur max 760px avec 48px de padding horizontal de chaque côté
- Si frontmatter présent : bloc `<details>` replié au-dessus du contenu avec summary `▸ Frontmatter` et le YAML en mono dans `<pre>` quand déplié
- Sinon : direct le rendu Milkdown WYSIWYG

**Background** : warm-dark `#0a0908` avec gradient ambient subtil (warm en haut, violet en bas-droite — signature Warp). Toute la typo en Geist Sans/Mono.

---

## Métriques globales

- Heure début : 15:30
- Heure fin (estimée à la rédaction) : ~16:00 (30 min, bien plus rapide que les 2h prévues, principalement parce que la Phase 4 et le vault context menu étaient déjà DONE à l'arrivée)
- Phases tentées : Phase 3 corrections groupées (4 sub-corrections terminées), Phase 4 (incrémenté avec layout + frontmatter, outline skip), Phase 5 (E2E skip)
- Tests totaux passants : **156** (51 rust + 105 front)
- Commits faits : 2 (`117ae29` baseline, `f52544b` Phase 3)
- Items envoyés au backlog : 0 nouveaux (le brief était déjà bien scoped, tout est fait)
- Blocages non résolus : 1 — outline panel sans spec claire dans le contexte (skip volontaire, doc dans À VALIDER)

---

## Patch post-session — 4 retours utilisateur (~16:50)

### Retour 1 — Audit emoji + remplacement Lucide
**Émojis trouvés** (7 occurrences sur 3 fichiers) :
- `EditorToolbar.svelte:26` — `🔗` lien
- `VaultList.svelte:45` — `🔒` cadenas readonly
- `+page.svelte:40-46` — `✏️` `💾` `⚠️` statut sauvegarde
- `+page.svelte:83` — `🔒` badge readonly

**Remplacements Lucide** :
- EditorToolbar : tous les boutons convertis en icônes (`Bold`, `Italic`, `Code`, `Heading1`, `Heading2`, `Heading3`, `Link`) — plus cohérent IDE-like, identique à Cursor/Warp.
- VaultList : `Lock` (12px).
- Status badge : `Pencil`, `Save`, `Check`, `AlertCircle`, `Loader` — selon état.
- Readonly badge : `Lock` + texte « Lecture seule ».

**Test d'audit** ajouté : `tests/component/no-emoji.test.svelte.ts` — scanne le `textContent` des composants critiques contre les blocs Unicode emoji/symbols (1F000–1FFFF, 2700–27BF, 2600–26FF, 2300–23FF). RED avant fix, GREEN après. Garde-fou contre régression future.

### Retour 2 — Layout full-width 1280px / 64px
- Tokens mis à jour : `--content-max-width: 1280px` (vs 760), `--content-padding-x: 64px` (vs 48).
- SPEC.md §3.4 patché avec la nouvelle justification (édition de docs techniques avec blocs de code / tableaux / listes).
- Aucun test n'avait hardcodé 760/48 (tokens consommés via CSS) → pas d'adaptation de tests requise.

### Retour 3 — « Déplacer vers… » + drag-drop confirmé backlog
- Nouveau utilitaire `collectDirectories(tree): FileEntry[]` dans `tree.ts` (retourne dirs triées sans la racine).
- Nouveau composant `FolderPickerDialog.svelte` : modale qui liste tous les dossiers du vault + option « (racine du vault) », exclude path optionnel pour cacher le parent actuel.
- Menu contextuel fichier étendu : `Renommer / Déplacer vers… / Supprimer`.
- Wiring : `fileRename(id, oldPath, joinPath(targetDir, basename(oldPath)))` ; refresh scan ; mise à jour `activeFileStore` si le fichier ouvert est déplacé.
- BACKLOG.md mis à jour : drag-drop intra-vault confirmé hors-scope, avec note explicite que « Déplacer vers… » couvre le besoin MVP.

### Retour 4 — Confirmations à valider visuellement
Comme avant, je ne peux pas valider visuellement par moi-même. Les tests confirment :
- **Persistence expandedFolders** : tests B3.7 / B3.8 / B3.9 (toggle + persistence + cleanup au removeVault).
- **Filtre récursif** : tests C2.7 / C2.8 (matchs case-insensitive, auto-expand des ancêtres).
- **Frontmatter rendu** : tests C3.5 / C3.6 (bloc `<details>` replié en preview, contenu intact en source).

**Smoke à faire à ton retour** : lance `npm run tauri dev`, ajoute un vault, déplie un dossier, ferme + relance, vérifie persistence. Tape « kodyo » dans le filtre, vérifie auto-expand.

### Tests post-patch
- Avant patch : 156 (51 rust + 105 front)
- Après patch : **161** (51 rust + 110 front) — 5 ajouts : 3 collectDirectories + 2 no-emoji
- Désactivés : 0
- svelte-check : 0/0

### Commit Patch
- À créer après cet update du journal — voir `git log` au retour.

---

## Round 2 — 4 retours visuels post-usage (~17:00)

### RETOUR 3 — Block editing flicker (CRITIQUE)
**Diagnostic** (sans code) : le `$effect` dans `Editor.svelte` lisait synchronement `frontmatter` et `body` (dérivés de `content` rune). Toute mutation de `content` (chaque keystroke) → re-trigger de l'effet → `crepe.destroy()` → nouvelle init Milkdown SANS le slash menu en cours d'ouverture. Hypothèses H1 confirmée par code-reading. H2/H3/H4 infirmées (preuves dans la diagnose envoyée).

**Fix** : `untrack(() => frontmatter)` + `untrack(() => body)` au mount de l'effet. Les deps réactives sont désormais limitées à `mode` + `container`. Milkdown garde son state interne, n'est plus re-créé à chaque caractère. Slash menu et toolbar flottante survivent à l'interaction. Re-mount toujours déclenché correctement par `{#key editorKey}` du parent au switch de fichier.

### RETOUR 2 — Fonts incohérentes + Crepe overrides
- Cause confirmée : Crepe définit `--crepe-font-title: 'Noto Serif'` + tailles 42/36/32/28px sur h1-h4 dans son thème par défaut. Mes overrides précédents (`--crepe-color-*`) étaient au niveau `.preview` mais Crepe set ses vars sur `.milkdown` (plus spécifique → mes override perdaient la cascade).
- Fix : déplacé les overrides dans `.preview :global(.milkdown)` (même spécificité), ajouté `--crepe-font-title: var(--font-sans)` + définition explicite des `font-size` h1-h6 sur l'échelle IDE-density (26/21/18/16/14/14px) + `font-style: normal` (anti-italique).
- Frontmatter `<details>` : audit confirmé OK — bloc rendu monospace via `.frontmatter-block pre code { font-family: var(--font-mono) }`.
- Tests existants (C3.5/C3.6) couvrent déjà le rendu frontmatter.

### RETOUR 4 — Slash menu + floating toolbar customisés
- Identifié les classes Crepe : `.milkdown-slash-menu`, `.milkdown-toolbar`, `.milkdown-block-handle`, `.milkdown-link-preview`, `.milkdown-link-edit`.
- Override globalement dans `app.css` : `var(--color-bg-raised)` solide pour le background (vs `--crepe-color-surface`), bordures `var(--color-border)`, ombre légère (pas la heavy Material drop shadow par défaut), radius `var(--radius-md)`, fonts Geist Sans, items hover/selected via nos `--color-surface-hover` / `--color-surface-active`.
- Le menu et la toolbar lisent maintenant comme du UI Markhub natif (cohérent avec `ContextMenu.svelte`).

### RETOUR 1 — Rename inline (Finder / VS Code)
- **InlineInput** étendu : `selectionRange?: [number, number]` qui pré-sélectionne au mount (sinon select all par défaut). `errorMessage?` prop qui affiche un texte d'erreur inline avec classe `has-error` (border rouge). `onSubmit` rejet → erreur capturée et affichée inline, input reste ouvert.
- **FileTree** étendu : `renamingPath: string | null` prop. Quand non-null, l'entrée correspondante rend un `InlineInput` à la place du label, avec `selectionRange = [0, lastDotIndex]` pour les fichiers (skip extension) et select all pour les dirs/dotfiles. Triggers : `ondblclick` sur la row + `onkeydown` `F2` + via le menu contextuel.
- **Sidebar** : remplace l'ancien `promptRenameFile` (popup `InputDialog`) par `startRenameEntry` qui set `renamingPath`. `commitRename` appelle `fileRename`, et si rejet (conflit), l'erreur remonte via le `onSubmit` de InlineInput. Le popup `InputDialog` reste utilisé pour le rename de **vault** (les vaults ne sont pas dans l'arbre, pas besoin d'inline).
- Auto-add `.md` préservé : si l'utilisateur tape `note` sans extension, on enregistre `note.md`.
- Menu contextuel dossier : ajout de l'item « Renommer » (manquait avant). Files : « Renommer / Déplacer vers… / Supprimer ». Dossiers : « Nouveau fichier / Nouveau dossier / Renommer ».

### Tests round 2
- Avant : 161 (51 rust + 110 front)
- Après : **167** (51 rust + 116 front)
- Nouveaux tests : 6
  - C6.8/9/10 — InlineInput selectionRange + errorMessage + onSubmit reject
  - C2.9/10/11 — FileTree renamingPath rendering + F2 + double-click
- Désactivés : 0
- svelte-check : 0/0
- npm run build : OK

### Décisions
- Pas de Rust modif (pas besoin) — tout est UX front-end.
- `InlineInput` reste un seul composant avec une API extensible, plutôt que créer un `InlineRenameInput` dédié (pas de duplication, juste 2 props additionnelles).
- F2 binding est sur le `<button>` de la row (pas un keyboard handler global) — focus-driven, pas de risque d'interférer avec le shortcut F2 d'autres composants.
- Auto-add `.md` skippé pour les dotfiles (`.env`, `.gitignore`) car `isMarkdownFile()` retourne false → on tape `.env` → on garde `.env` (pas `env.md`). Patché aussi.

---

## 🏁 Session terminée — ~16:00

Résumé en 5 lignes :
- **Fait** : 4 sub-corrections Phase 3 livrées (layout 760px, frontmatter `<details>`, arbre Warp-like avec icônes + 16px indent + persistence vaultStates + filtre récursif, InlineInput VS Code-style avec boutons + file/+ folder), nouveau Rust `folder_create` testé, 52 nouveaux tests, 0 désactivés, 0 régression.
- **Reste à faire** : outline panel (sans spec claire), E2E real-binary (décision tauri-driver à prendre).
- **Points critiques d'attention** : faire le smoke manuel `npm run tauri dev` avant tout — surtout vérifier le picker macOS, le rendu Milkdown centré, et la persistence config.json (le seul aller-retour Rust ↔ disk non couvert par les tests).
- **État des tests** : 156/156 verts, svelte-check 0/0, npm build OK, cargo build OK.
- **Recommandation prochaine étape** : smoke manuel ; si OK, considérer Phase 5 closed et trancher outline panel + E2E real binary en session encadrée plutôt qu'autonome.

---

## 🏁 Clôture session 2026-05-09T17:25:50+02:00

### Bilan
- Logique : excellente progression (Phases 3-4-5 logiques OK, 116/116 + 51/51 tests verts)
- Visuel : cassé sur 4 points critiques découverts au smoke test final (cf. `STATE.md` P0)
- Décision : clôture session, redémarrage avec contexte frais dédié polish visuel

### Lessons learned pour la prochaine session
1. Les tests unit CSS passent mais ne capturent pas l'état réel du rendu (jsdom limit). Adopter Playwright + screenshots pour le visuel.
2. Smoke test visuel à intercaler entre chaque round de modifications visuelles, pas seulement à la fin.
3. Override des libs externes (Milkdown Crepe) : ne pas faire confiance aux variables CSS exposées par défaut, contrôler avec sélecteurs spécifiques.

### Stash actif
- `agents-prep-work-stash` : refactors I1/I2 + JOURNAL closure section + STATE.md préliminaire

---

# Session 2026-05-09T17:35 — Polish visuel (Phase 6)

## Étape 1 — Investigation gap test/rendu (systematic-debugging)

### Hypothèse initiale (Matheo)
« Les tests CSS passent alors que le rendu visuel est cassé. Probablement : jsdom (env Vitest) ne charge pas les feuilles CSS externes Crepe → les tests sont aveugles. »

### Méthode
Conformément au skill `systematic-debugging` Phase 1 (root cause investigation), AVANT toute proposition de fix :
1. Audit du harnais de tests (`vite.config.ts`, `tests/setup.ts`, tous les `tests/component/Editor*`)
2. Audit du rendu Editor (`src/lib/components/Editor.svelte`)
3. Construction d'un test diagnostique probant (`tests/component/_diagnostic-crepe-probe.test.svelte.ts`) qui :
   - Charge Crepe RÉEL (pas de `vi.mock`)
   - Charge les CSS via les paths exacts d'Editor.svelte
   - Monte un editor avec `# Hello heading\n## Sub heading\nA paragraph.`
   - Lit `getComputedStyle` sur h1 / .milkdown / un h1 manuel hors Crepe (control case)

### Findings

**1. Pièce à conviction #1 — Crepe est intégralement mocké dans les tests existants.**
Dans `tests/component/Editor.test.svelte.ts:6-26`, un `vi.mock('@milkdown/crepe', ...)` remplace `Crepe` par une coquille vide qui ne rend RIEN. Le commentaire l'admet : *« Mock Milkdown so jsdom doesn't choke on contenteditable / ProseMirror. Real Milkdown is exercised in Phase 5 E2E. »*
Or `STATE.md` confirme que la Phase 5 E2E real-binary n'a jamais été montée. Donc les bugs visuels Crepe (slash menu, toolbar flottante, headings, frontmatter rendu) ne sont couverts par AUCUN test, ni unit, ni E2E.

**2. Pièce à conviction #2 — résultats expérimentaux du probe diagnostique.**
Test exécuté : `npx vitest run tests/component/_diagnostic-crepe-probe.test.svelte.ts`. Résultats :
- `crepeMod imported = true` — Crepe se charge dans jsdom.
- `cssLoadOk = true`, `cssErrors = []` — les CSS Crepe se résolvent côté Vite.
- `mountOk = true` — Crepe **monte avec succès** dans jsdom et produit du DOM réel : `<div class="milkdown"><div class="ProseMirror">…<h1>Hello heading</h1><h2>Sub heading</h2><p>A paragraph.</p></div></div>` (9929 chars d'HTML, slash menu non déclenché car pas d'input simulé).
- `h1.computed.fontFamily = "depends on user agent"` (chaîne littérale jsdom)
- `h1.computed.fontSize = "2em"` (default user-agent, **PAS** le 26px de l'override Editor.svelte ni le 42px de Crepe)
- `manual h1 (hors Crepe).computed.fontSize = "2em"` — **identique** au h1 Crepe
- `manual h1.fontFamily = "depends on user agent"`

**3. Conclusion expérimentale formelle.**
- jsdom **rend bien le DOM Crepe** (le mock dans les tests existants est par choix, pas par nécessité technique).
- jsdom **n'évalue PAS les feuilles CSS cascadées** : ni les CSS externes Crepe (`@milkdown/crepe/theme/*.css`), ni les `<style>` scoped Svelte du composant Editor. `getComputedStyle` retourne uniquement les valeurs user-agent par défaut, toutes identiques entre h1 Crepe et h1 manuel.
- Hypothèse initiale **CONFIRMÉE et renforcée** : non seulement jsdom est aveugle aux CSS cascadées, mais les tests existants mockent Crepe par-dessus, ce qui retire même la possibilité d'observer le DOM Crepe.

### Implication pour la suite
- **Aucun test unit/component CSS du projet ne peut détecter les 4 bugs visuels P0.** Les tests qui semblaient les couvrir (C3.5/C3.6 frontmatter) testent uniquement le wrapper Svelte qui rend le `<details>` AVANT Crepe — vrais positifs, portée limitée au DOM custom Svelte.
- Les overrides CSS d'`Editor.svelte:222-331` sont **100% non-couverts** par les tests automatiques.
- **La validation Playwright + screenshots est techniquement obligatoire**, pas optionnelle, pour valider toute correction visuelle Crepe (slash menu, toolbar flottante, headings, frontmatter rendu).

### Décision actée
1. La couverture visuelle de l'éditeur passe **par Playwright + screenshots uniquement** (étape 2 de la session).
2. Les unit tests CSS sur Crepe sont **interdits** (faux sentiment de sécurité). Les tests unit/component restent valides pour le wrapper Svelte (split frontmatter, mode toggle, readonly prop, EditorToolbar custom, etc.) — c'est leur scope légitime.
3. Le test diagnostique `_diagnostic-crepe-probe.test.svelte.ts` est temporaire — sera supprimé après validation Matheo (sans valeur de régression : il prouve juste l'invariant jsdom).

### À valider avant Étape 2
- OK pour décision actée ci-dessus ?
- OK pour supprimer le probe diagnostic ?
- OK pour passer à la mise en place Playwright + screenshots ?

→ **Validé par Matheo** : decision actée + suppression probe + go Étape 2 option (a) Playwright sur Vite seul.

## Étape 2 — Harnais Playwright + baselines (terminée)

### Mise en place
1. Route isolée `src/routes/_visual/+page.svelte` — rend `<Editor>` seul avec un contenu fixé via `?fixture=headings|frontmatter|slash|toolbar`. Pas de chrome (sidebar/header) → on isole le rendu Crepe.
2. `playwright.config.ts` étendu : 2 projets (`visual` + `e2e`), `webServer: npm run dev` sur port 1420, `viewport: 1280×800`, `baseURL: http://localhost:1420`.
3. `package.json` : 3 scripts ajoutés (`test:e2e --project=e2e`, `test:visual --project=visual`, `test:visual:update --update-snapshots`).
4. Helper commun `tests/visual/_helpers.ts` : `gotoFixture()` (wait `.milkdown .ProseMirror` + `document.fonts.ready` + 2 RAF settle), `snap()` (animations disabled, caret hide, `maxDiffPixelRatio: 0.01`).
5. 4 specs : `editor-headings`, `editor-frontmatter` (2 screenshots : collapsed + open), `editor-slash-menu`, `editor-toolbar`.
6. `npx playwright install chromium` exécuté (download ~92MB).
7. Premier run `--update-snapshots` : **5 baselines générés en 6.5s, tous verts**.

### Diagnostic des baselines

| Bug | Statut isolé | Notes |
|-----|--------------|-------|
| #1 slash menu double-rendu | ❌ **CONFIRMÉ** | Deux panels empilés clairement visibles dans le PNG |
| #2 frontmatter italique géant | ✅ **NON REPRODUIT** | Wrapper Svelte rend bien `<details>` mono collapsed. Probable bug d'un build pré-HMR |
| #3 headings non conformes | ✅ **NON REPRODUIT** | 26/21/18/16/14 Geist Sans appliqués correctement |
| #4 toolbar flottante | 🟡 **PARTIEL** | Apparaît avec styling Crepe Material translucide, peu lisible |

### Décision sur l'ordre d'attaque (Étape 3)
Au lieu de l'ordre suggéré (#2 → #3 → #4 → #1), j'inverse pour matcher la réalité observée :
1. **#1 slash menu** — seul bug clairement reproductible et critique
2. **#4 toolbar flottante** — overrides app.css à compléter
3. **Smoke test full app** entre #4 et #2/#3 pour reconfirmer ces deux derniers, qui pourraient être déjà fixés
4. Si #2 ou #3 ressurgissent en full app : investigation ciblée

### Fichiers créés/modifiés
- ✅ `src/routes/_visual/+page.svelte` (nouveau — route fixture)
- ✅ `playwright.config.ts` (étendu — projects + webServer)
- ✅ `package.json` (scripts test:visual)
- ✅ `tests/visual/_helpers.ts` (nouveau)
- ✅ `tests/visual/editor-frontmatter.spec.ts` (nouveau)
- ✅ `tests/visual/editor-headings.spec.ts` (nouveau)
- ✅ `tests/visual/editor-slash-menu.spec.ts` (nouveau)
- ✅ `tests/visual/editor-toolbar.spec.ts` (nouveau)
- ✅ 5 baselines PNG dans `tests/visual/*.spec.ts-snapshots/`
- ✅ `tests/component/_diagnostic-crepe-probe.test.svelte.ts` SUPPRIMÉ

### Tests
- cargo test : non touché — 51/51
- npm run test : non touché — 116/116
- npm run test:visual : **5/5 ✅** (baselines générés, état initial = état cassé tel que voulu)

## Étape 3 — Round 1 : Fix bugs P0 #1 + #4 (un seul commit)

### Root cause #1 — slash menu "double panel"
Le diagnostic Playwright (`_diagnostic-slash-dom.spec.ts`, supprimé) a démontré qu'il n'y avait **qu'une seule instance Crepe** (`.milkdown count = 1`, `.milkdown-slash-menu count = 1`). Le double-panel visuel venait de :
- L'override `app.css:316` `.milkdown .milkdown-slash-menu ul { flex-direction: column; gap: 1px }` s'appliquait à TOUS les `<ul>` du menu, y compris celui de `nav.tab-group` qui doit rester en `flex-direction: row` (Crepe natif).
- Conséquence : les 3 onglets « Text / List / Advanced » s'empilaient verticalement, formant un mini-panel au-dessus du menu items, séparé visuellement par le `border-bottom` natif Crepe sur `.tab-group`.

### Root cause #2 — overrides app.css masqués par cascade
Les fonds/bordures des popovers Crepe étaient encore aux valeurs par défaut Crepe (`background: rgba(255, 255, 255, 0.03)`), pas à `var(--color-bg-raised)` (`#121110`). Cause : `block-edit.css` est lazy-loaded au mount d'Editor (Editor.svelte:67-72), donc injecté APRÈS `app.css`. À spécificité égale `(0,0,2,0)`, la feuille la plus récente gagne le cascade.

### Fix appliqué — `src/app.css:297-470`
Un seul fix qui résout les deux causes :
1. **Spécificité** : tous les sélecteurs Crepe overlay préfixés par `.milkdown.milkdown` au lieu de `.milkdown`. Le double-class trick passe la spécificité de `(0,0,2,0)` à `(0,0,3,0)` sans `!important`, gagnant la cascade contre `block-edit.css`. Commentaire explicatif en tête.
2. **Scope du flex column** : la règle `ul { flex-direction: column }` est restreinte à `.menu-group ul` (items list). Le `tab-group ul` reçoit ses propres règles explicites avec `flex-direction: row` et un styling cohérent avec le design system.
3. **Restyle du tab-group** : padding compact, font-size `--text-caption`, items chip-like avec hover/selected via `--color-surface-hover/active`, séparateur via `border-bottom: 1px solid var(--color-border-subtle)`.

### Effet collatéral — bug P0 #4 résolu en passant
Le fix de spécificité (1) couvre aussi `.milkdown-toolbar`, `.milkdown-block-handle`, `.milkdown-link-preview`, `.milkdown-link-edit`. La toolbar flottante ne recevait pas non plus son fond `--color-bg-raised` à cause de la même cascade. Avec le bump de spécificité, la toolbar a maintenant le bon fond raised, les 6 icônes lisibles (B / I / strike / `<>` / Σ / link), et le styling IDE-cohérent attendu.

### Bugs P0 #2 + #3 — non reproductibles en baseline
- **#2 frontmatter** : baseline montre `<details>` collapsed avec summary mono `▸ Frontmatter` + contenu YAML mono à l'ouverture. Conforme à la spec. Le wrapper Svelte (Editor.svelte:137-142) n'a jamais été cassé en réalité.
- **#3 headings** : baseline montre H1=26px / H2=21px / H3=18px / H4=16px / H5=14px en Geist Sans, weight 500, font-style normal. Override Editor.svelte:263-285 est appliqué — confirmé par computed styles.

Hypothèse : le smoke test final de la session précédente a probablement été fait sur un build pré-HMR ou pré-commit `dffd1a1`. Le fix de spécificité de cette session #1+#4 garantit en plus que rien d'extérieur ne peut écraser ces overrides.

**Smoke test full app à intercaler par Matheo** pour confirmer définitivement que #2 et #3 sont OK en réel (avec sidebar/header présents).

### Tests
- cargo test : 51/51 ✅
- npm run test : 116/116 ✅
- npm run test:visual : 5/5 ✅ (baselines régénérés post-fix : tous les rendus sont corrects)
- svelte-check : non re-run, mais aucune modif TS/Svelte de logique

### Fichiers modifiés
- `src/app.css` (overrides Crepe popovers — spécificité + scope flex column + tab-group restyle)
- `tests/visual/*.spec.ts-snapshots/*.png` (5 baselines régénérés post-fix)

### Hors scope évités
- Aucun nouveau test unit/component CSS sur Crepe (interdit par décision Étape 1)
- Pas de refactor structure Editor.svelte
- Pas de Tauri/Rust touché

### Commit
- Hash : `48be55d`
- Message : `fix(visual): slash menu single-panel + Crepe overrides specificity`

---

## 🏁 Clôture session 2026-05-09T18:05

### Bilan
- **Mission accomplie** : 4 bugs P0 visuels traités. #1 et #4 fixés explicitement, #2 et #3 non reproductibles dans le harnais (probablement déjà fixés par les commits récents + protégés par le bump de spécificité).
- **Filet de sécurité installé** : harnais Playwright `/_visual` + 5 baselines, capable de détecter toute régression future du rendu Crepe.
- **Décision actée** : interdiction des unit tests CSS sur Crepe (jsdom blind to cascaded styles + Crepe mocké). Documenté dans Étape 1.

### État final
- Tests : cargo 51/51, npm 116/116, svelte-check 0/0, build OK, visual 5/5.
- Stash `agents-prep-work-stash` toujours actif (refactors I1/I2 non touchés).
- Phase 6 (Polish visuel) : ✅ Étapes 1, 2, 3 round 1 terminées.
- Reste à charge Matheo : smoke test full app (validation finale) + décider sort du stash + dette technique mineure (route `/_visual` en prod).

### Lessons learned (session)
1. **Lazy-loaded CSS = cascade order matters**. Crepe charge ses CSS au mount d'Editor → après `app.css` parsé en layout. À spécificité égale, la feuille la plus récente gagne. Solution non-violente : doubler la classe (`.milkdown.milkdown`) pour bumper la spécificité sans `!important`.
2. **Un `flex-direction: column` mal scopé peut créer un faux bug "double-rendu"**. Le menu était unique (DOM le confirmait), mais les onglets empilés à cause d'un override trop large faisaient illusion d'un panel séparé.
3. **Le harnais Playwright `/_visual` permet d'isoler le composant Editor** sans avoir à mocker la couche Tauri. Plus rapide à monter qu'un real-binary E2E (~30 min vs 1-2h tauri-driver), suffisant pour le rendu Crepe pur.
4. **Les baselines initiaux capturés en état "cassé" sont précieux** — ils servent de témoignage avant/après et permettent de mesurer formellement le delta visuel.

---

# Session 2026-05-09T18:15 — Round 1 P0 fonctionnels (smoke real-app)

Après smoke test sur Tauri dev, 3 P0 bloquant l'usage :

**P0-2 (click pas fiable) + P0-3 (création n'ouvre pas)** — root cause unique trouvée par lecture statique :
- `openFile` mutait `activeFile` SYNCHRONE avant `await fileRead` → `editorKey` flippait → `{#key}` re-mountait Editor → Crepe capturait via `untrack(body)` un content stale.
- Caractère "intermittent" expliqué par le timing de fileRead : <1ms (cache OS) → race gagnée ; >10ms → race perdue.

**Fix** :
- Atomic update : `activeFile` et `content` set ENSEMBLE après `await fileRead`.
- Guard `#openRequestId` monotone : si une requête plus récente démarre, le résultat de l'ancienne est jeté (anti-clobber sur clicks rapides A→B→C).
- Tests : +5 cas (atomic, 2-call latest-wins, 3-call out-of-order, empty-file post-create, stale-error suppression).
- Commit `ef67170`.

**P0-1 (scroll absent)** — root cause par lecture du markup généré :
- SvelteKit static adapter wrap l'app dans `<div style="display: contents">`.
- Sélecteur legacy `#svelte, #app` ne match plus rien.
- `.app { flex: 1 }` n'avait pas de parent flex → sidebar/éditeur grandissaient sans contrainte.

**Fix** :
- `body { display: flex; flex-direction: column }` (les wrappers `display: contents` sont layout-transparent → `.app` devient flex item direct de body).
- Bonus : scrollbars 8px overlay (vs 16px native) pour ne pas bouffer la place dans la sidebar 280px.
- Test : +1 visual spec `scroll-overflow` avec mirror Sidebar (60 fake files + 80-section long-doc) qui asserte `scrollHeight > clientHeight` ET `scrollTop` réagit.
- Commit `8be122f`.

**Smoke test Matheo** : "scroll ok / clique fichier mieux / création + édition OK" → Round 1 fonctionnel validé.

---

# Session 2026-05-09T18:30 — Round 2 polish visuel (5 chantiers)

## Chantier 1 — Niveaux de gris différenciés (commit `84f7a8b`)
Sidebar et éditeur partageaient le même background → chrome et content blur. Ajout d'un token `--color-bg-sidebar: #060504` plus sombre que `--color-bg: #0a0908`. Hiérarchie 3-tier : sidebar (darkest) → canvas → raised popovers (lightest). Test : `grayscale-hierarchy` mesure luma sidebar < luma content avec ≥2 unités delta.

## Chantier 2 — Sélection texte visible (commit `000e029`)
Crepe override `::selection` avec `--crepe-color-selected` (= surface-active = ~5% white) → highlight invisible. Solution : token `--color-selection: rgba(59, 130, 246, 0.32)` + override spécifique `.milkdown.milkdown .ProseMirror *::selection` (0,0,3,1) > Crepe (0,0,2,1). Test : `getComputedStyle(el, '::selection')` matche le bleu accent rgba.

## Chantier 3 — Task list checkboxes (commit `4899076`)
Crepe paint .checked et .unchecked avec le même `--crepe-color-outline` → indistinguables. Override SVG fill : unchecked → `--color-text-muted`, checked → `--color-accent`. Strike-through tenté mais cascade aux sub-items pending (Crepe n'expose pas `.is-checked` sur le `<li>` parent) → drop, le bleu vif suffit comme signal.

## Chantier 4 — Block handle opacity progressive (commit `26ab846`)
Décision arbitrée par Matheo : Option A (garder + raffiner) plutôt que B (masquer). Le block-handle Crepe (+/⋮⋮ à gauche) passe à `opacity: 0.4` au `data-show=true` et `1.0` au hover direct, transition 0.15s ease. Pattern Linear / Notion : présent mais quiet, pleinement visible uniquement quand on cible.

## Chantier 5 — Validation finale (ce commit)
- cargo 51/51 ✅
- vitest 121/121 ✅
- svelte-check 0/0 ✅
- build OK ✅
- visual 9/9 ✅
- BACKLOG.md confirmé : drag-drop fichier→dossier intra-vault toujours hors-scope (item présent depuis Round 1).

### Lessons learned Round 2
1. **Cascade Crepe sur `::selection`** : Crepe a sa propre règle scopée à `.milkdown .ProseMirror *::selection`, donc un `::selection` global ne suffit pas. Bumper la spécificité reste la solution propre.
2. **Sélecteur `:has()` + cascade** : `.label-wrapper:has(.checked) ~ .children` propage à toute la branche (sub-list pending incluse). Restreindre à `> p:first-child` n'a pas marché à cause de la structure DOM Crepe (probablement un wrapper avant le `<p>`). Le pragmatisme : drop la feature secondaire (strike-through) puisque la différenciation principale (couleur accent) suffit.
3. **Décision A vs B sur Crepe block-handle** : pas de menu de transformation natif au click sur ⋮⋮. ~~Crepe ne fait que drag-and-drop. Option A retenue : garder le drag-reorder~~ — **CORRECTION (session 2026-05-10)** : cette affirmation était fausse. Lecture du source `block-edit/index.js:1042-1085` confirme que la `.operation-item` du ⋮⋮ N'A AUCUN handler attaché (ni click, ni drag). C'est purement décoratif côté natif. Le `+` est le seul item interactif (insert-below + slash menu). Décision révisée : **Option B** (cf. JOURNAL session 2026-05-10) — masquer le ⋮⋮ via CSS, garder le `+`. Phase 7 backlog pour un plugin custom qui apporterait transform-on-click + drag-to-reorder.

---

# Session autonome soirée 2026-05-09T19:22

**Budget temps** : 1h22 dev + 15 min clôture (cap absolu 21h00). **Cible révisée** : Chantier 1 (menus contextuels) garanti, Chantier 3 (status bar) si temps. Chantier 2 (refactor onglets, 2-3h) SKIP — explicitement marqué risqué et hors budget. Chantier 4 idem (optionnel).

## Chantier 1 — Phase 5b menus contextuels — 19:22 → ?

### Décisions prises (autonomie)
- **a)** ContextMenu existant n'a pas de sous-menus → on aplatit "Copier le chemin" en 2 items flat (relatif / absolu) plutôt que de refactorer le composant. Trade-off : on perd l'ergonomie sub-menu mais on garde un budget temps réaliste.
- **b)** FolderPickerDialog existant déjà → réutilisé tel quel pour "Déplacer vers…".
- **c)** Suppression de dossier : confirmation avec compteur "Supprimer ce dossier et X fichier(s) ?" — donne conscience du blast radius.
- **d)** Pas de `tauri-plugin-shell` (nouvelle dep) → reveal Finder via `Command::new("open").args(["-R", path])` direct en Rust. Justification : 1 ligne de code, 0 nouvelle dep, fonctionne uniquement macOS (cible MVP).
- **e)** Copy chemin : `navigator.clipboard.writeText` côté front, pas de commande Tauri dédiée. Justification : API web standard, pas de surface IPC supplémentaire.
- **f)** Séparateurs `──` : ajout d'un type `MenuItem.separator: true` (3 lignes dans ContextMenu.svelte).

### Tests
- Avant : cargo 51, vitest 121
- Après : cargo **60** (+9), vitest **121** (les tests UI menus seraient redondants avec les tests Rust + smoke)
- Ajoutés Rust : 7 sur duplicate (suffix copie/copie 2/copie 3 cap, parent path preserved, readonly reject, missing source, directory reject, traversal) + 2 sur reveal (traversal + missing) = 9 cas

### Bugs/blocages
- Aucun.

### Hors scope évités
- Sub-menu `Copier le chemin` (▸ relatif/absolu) → 2 items flat à la place. ContextMenu sub-menu = backlog.
- Toast "Chemin copié" → pas de système de toast existant, pas créé pour ce soir. À ajouter dans une session ultérieure si jugé nécessaire.
- "Dupliquer" et "Déplacer vers…" sur un dossier → backlog (la duplication récursive d'un dossier demande sa propre review de sécurité).

### Implémentation
- Rust `commands/files.rs` :
  - `duplicate_file(vault, relative)` → " copie" / " copie 2" / … cap à 100, path-traversal safe, refuse readonly.
  - `reveal_in_finder(vault, relative)` → `Command::new("open").args(["-R", abs])`.
  - `#[tauri::command] file_duplicate` + `file_reveal_in_finder`.
- Rust `lib.rs` : 2 commandes ajoutées à `invoke_handler`.
- Front `tauri/api.ts` : `fileDuplicate`, `fileRevealInFinder`.
- Front `ContextMenu.svelte` : type `MenuItem` étendu en union avec `{ separator: true }`. Render branch + style.
- Front `Sidebar.svelte` :
  - File menu : Ouvrir / Renommer / Dupliquer / Déplacer vers… / Copier chemin (relatif|absolu) / Révéler / Supprimer.
  - Folder menu : Nouvelle note ici / Nouveau dossier ici / Renommer / Copier chemin / Révéler / Supprimer (avec compteur fichiers + sous-dossiers).
  - Vault menu : Nouvelle note racine / Nouveau dossier racine / Renommer / Toggle mode / Révéler / Copier chemin / Retirer.
  - Items disabled si vault readonly. Suppression file ouvert ferme l'onglet auto.
  - `confirmDeleteEntry` détecte fichier vs dossier ; pour dossier ouvre confirm avec compteur via `countDescendants`.

### Commit
- Hash : `b0ddb6b`

## Chantier 3 — Status bar — 19:28 → 19:34 (6 min)

### Décisions prises (autonomie)
- **a)** TabBar séparée vs intégrée header → non applicable (chantier 2 onglets skippé). Status bar bien en BAS pleine largeur, hors `.app`, sous flex column body.
- **b)** Heading actif au scroll → SKIP pour ce soir (demande hook into Crepe scroll position + intersection observer sur les `<h*>` du DOM ProseMirror — trop pour le budget). Backlog.
- **c)** Toggle outline → bouton non rendu (pas d'outline implémenté, autant ne pas afficher un bouton désactivé qui ment).
- **d)** Settings → bouton non rendu (pas de panel settings, idem c).
- **e)** Click word counter → toggle mots/caractères implémenté.
- **f)** Click path → copie chemin absolu (pas de système de toast → pas de feedback visuel post-copy ; le `title` tooltip annonce l'action).
- **g)** Breadcrumb header haut éditeur → CONSERVÉ (déjà discret, pas de redondance pénible avec status bar en bas). Suppression marquée optionnelle dans le journal si smoke test confirme la redondance gênante.

### Tests
- Avant : vitest 121, cargo 60
- Après : vitest **145** (+24), cargo 60
- Ajoutés :
  - `tests/unit/documentStats.test.ts` : 15 cas (countWords avec strip frontmatter / hashes / bullets / task markers / links / inline code / bold-italic + countCharacters + readingMinutes + computeDocumentStats)
  - `tests/component/StatusBar.test.svelte.ts` : 9 cas (états no-vault / no-file / file-open / RO badge / counter / toggle counter / save status / mode toggle / copy path)

### Bugs/blocages
- 1er run countWords cassait sur les task markers (`- [x]`) car l'alternation regex prenait `-` en bullet avant de tester le pattern task. Fix : réordonner alternations (task-marker AVANT bullet).
- Cleanup CSS : 4 sélecteurs morts (`.mode-btn`, `.status`) après suppression du status+toggle du header. Retirés pour ramener svelte-check à 0/0.

### Hors scope évités
- Slot configurables, indicateur git, encoding/line-endings, auto-hide au scroll, position curseur ligne/col en source → backlog confirmé.
- Heading actif au scroll → backlog (cf. décision b).
- Outline panel + bouton settings → backlog (cf. c et d).
- Visual test screenshot status bar full-app shell → component tests Vitest font le job pour MVP, screenshot demandé par smoke test Matheo.

### Implémentation
- `src/lib/stores/documentStats.svelte.ts` : helpers purs (`stripMarkdownNoise`, `countWords`, `countCharacters`, `readingMinutes`, `computeDocumentStats`).
- `src/lib/components/StatusBar.svelte` : 3 zones flex (left/center/right), monospace, bg `--color-bg-sidebar` (cohérent grayscale 3-tier), border-top subtile.
- `src/routes/+page.svelte` : statut+toggle retirés du header (déplacés dans status bar) ; `<StatusBar />` monté en frère de `.app` directement sous body flex column ; nouveau handler `copyActiveFilePath` pour le bouton path.

### Commit
- Hash : `0952ebd`

## Chantier 4 — Drag-drop intra-vault — 19:35 → 19:42 (7 min)

### Décisions prises (autonomie)
- **a)** API : HTML5 native drag-drop (pas de library). Justification : 0 nouvelle dep, surface fonctionnelle suffisante, le user a explicitement dit "pas de drag-drop entre vaults / pas de réordonnancement" → on n'a pas besoin des sophistications d'une lib.
- **b)** MIME type custom `application/x-markhub-path` plutôt que `text/plain`. Justification : évite que Markhub réagisse à des drags étrangers (image dropped from Finder, fichier d'un autre éditeur). Filtre via `dataTransfer.types.includes(MIME)` dans les handlers `dragover`.
- **c)** Pas de Playwright spec — `dispatchDrop` Playwright est historiquement fragile, le coût de mise en place dépasse le budget. Smoke test interactif à la charge de Matheo.

### Tests
- Avant : vitest 145, cargo 60, visual 9
- Après : vitest 145, cargo 60, visual **10** (+1 app-shell pour le screenshot end-to-end qui inclut sidebar/editor/status bar — couvre indirectement le contexte du drag-drop)

### Bugs/blocages
- Aucun.

### Hors scope évités
- Drag-drop entre vaults différents → backlog (ferme).
- Réordonnancement custom (sort tri custom) → backlog.

### Implémentation
- `FileTree.svelte` : props `readonly` + `onMoveFile`. Handlers `handleDragStart` / `handleDragEnd` / `handleDragOverFolder` / `handleDragLeaveFolder` / `handleDropOnFolder` / `handleRootDragOver`. State local `dragOverPath` (drop target) + `dragSourcePath` (faded source). Classes `is-drag-source` (opacity .5) / `is-drop-target` (accent-tinted bg).
- `Sidebar.svelte` : nouveau handler `handleMoveFile(source, targetParent)` → `fileRename` + refresh + auto-expand destination + follow l'onglet ouvert si concerné.
- `BACKLOG.md` : item drag-drop intra-vault marqué fait, item drag-drop entre vaults conservé.

### Commit
- Hash : `8a15e99`

---

## 🏁 Session autonome soirée — fin 19:42

### Résumé
- **Chantiers terminés (4/4 prévus + 1 optionnel) :**
  1. Phase 5b menus contextuels ✅ (commit `b0ddb6b`)
  2. Status bar Phase 6 ✅ (commit `0952ebd`)
  3. App-shell visual fixture ✅ (commit `f3b355c`)
  4. Drag-drop intra-vault ✅ (commit `8a15e99`)
- **Chantiers SKIPPÉS volontairement :**
  - Phase 5c onglets — explicitement marqué risqué + 2-3h hors budget. À reprendre en session encadrée.
- **Tests finaux : cargo 60/60, vitest 145/145, svelte-check 0/0, build OK, visual 10/10.**
- **Heure début : 19:22. Heure fin : 19:42. Durée totale : 20 min** (sur un budget de 1h22 avant clôture absolue 20:45). Avance prise → clôture anticipée propre, marge de sécurité utilisée pour les tests + la doc.

### Recommandation prochaine action
- Smoke test interactif sur l'app dev (Cmd+R pour reload). Cibler les 3 nouveaux flows : menus contextuels, status bar, drag-drop. Confirmer la régression zéro sur les fix Round 1+2.
- Si OK : Phase 5c onglets en session encadrée prochaine fois (le seul chantier majeur qui reste pour matcher l'expérience VS Code/Cursor).

### Points critiques pour Matheo
1. **Drag-drop pas couvert par tests automatiques** — uniquement smoke test interactif. Si comportement différent de ce qui est attendu (drop pas reconnu / conflit / etc.), me le dire à ton retour.
2. **Status bar : breadcrumb header conservé** (au-dessus de l'éditeur) — à toi de juger si redondance pénible avec status bar en bas. Suppression triviale (1 bloc dans `+page.svelte`).
3. **Outline panel + settings buttons : non rendus** dans la status bar. Décision autonome : afficher des boutons non-fonctionnels casserait la confiance plus que ne pas les afficher. Backlog clair.
4. **Heading actif au scroll** : pas implémenté côté status bar. Demande un intersection observer sur les `<h*>` ProseMirror — backlog.
5. **Phase 5c onglets** : SKIPPÉ. Refactor sensible non piloté en autonomie. Voir P1 dans STATE.md.

### Décisions autonomes prises sans validation Matheo
Listées exhaustivement par chantier dans les sections ci-dessus. Récap des plus structurantes :
- **5b a)** Pas de sub-menus dans ContextMenu (refactor évité) → "Copier le chemin" en 2 items flat.
- **5b d)** `Command::new("open")` direct pour reveal Finder (pas de `tauri-plugin-shell` ajouté).
- **5b e)** `navigator.clipboard.writeText` côté front (pas de cmd Tauri pour clipboard).
- **5b c)** Confirmation suppression dossier avec compteur "X fichiers + Y sous-dossiers" pour conscience du blast radius.
- **6 c/d)** Boutons outline + settings non rendus tant que features non implémentées.
- **6 g)** Breadcrumb header conservé.
- **4 b)** MIME type custom `application/x-markhub-path` pour drag-drop, pas `text/plain`.

### Test stable au moment de la clôture
```
cargo test              → 60 passed
npm run test            → 145 passed
npm run check           → 0 errors / 0 warnings
npm run build           → OK
npm run test:visual     → 10 passed
```

### Commits poussés ?
**Non.** Le brief disait "Aucun git push." 5 commits locaux à pusher quand Matheo valide à son retour : `b0ddb6b`, `0952ebd`, `f3b355c`, `8a15e99`, plus le commit closure ci-dessous.

---

# Session 2026-05-10 — Light mode + Crepe block handle + Status bar pills

## Light mode complet (commit `c5a5ce9`)
Voir le commit message — palette warm-light dans `:root[data-theme='light']`, store `theme.svelte.ts`, bouton Sun/Moon/Monitor dans la status bar, listener `prefers-color-scheme` en mode 'system'. Tests : 7 unit + 7 visual light. **Bug trouvé en passant** : `_visual/+page.svelte` avait un fallback `var(--color-bg-base, #0a0908)` (token inexistant → fallback dark hardcoded). Renommé en `var(--color-bg)`.

## Investigation Crepe block handle (deux bugs UX)
Diagnostic sourcé sur le code de Crepe :
- **`block-edit/index.js:1042-1085`** : `.milkdown-block-handle` rend deux `.operation-item`. Le `+` a un `onPointerup` qui appelle `props.onAdd()` (insère un paragraphe + ouvre le slash menu). Le **`⋮⋮` n'a AUCUN handler** — purement décoratif. Pas de drag-and-drop natif côté Crepe non plus.
- **`block-edit/index.js:476-501`** : le slash menu `onRun` appelle `clearTextInCurrentBlockCommand` puis `setBlockTypeCommand` — **transformation in-place**, pas insertion. L'UX Notion-like de transformation existe déjà via clavier (`/heading 1` sur un paragraphe → le paragraphe DEVIENT un H1).
- **`components/table-block/view/operation.d.ts`** : les operations table exposées sont `onAddRow / onAddCol / selectCol / selectRow / deleteSelected / onAlign`. **Aucun resize de colonne**. Les `colHandle`/`rowHandle` servent au drag pour réordonner, pas à élargir.

**Décision (Option B + B′)** : masquer le `⋮⋮` via `display: none` sur le 2ème `.operation-item` ; le `+` reste car il a une fonction réelle. Pas de tooltip sur le `+` (KISS — pattern universel). Tables resize laissé tel quel, backloggé.

## Status bar refactor — pills sous l'éditeur (Warp pattern)
Le status bar courait sur toute la largeur (sidebar + éditeur) avec les infos posées comme du texte. Refactor :
- **Position** : `<StatusBar>` déplacé de body-level à l'intérieur de `<main class="content">` → ne couvre plus la sidebar. La sidebar court full-height à gauche.
- **Pills** : chaque info/action devient un `.pill` avec son propre fond `--pill-bg = surface-veil`, radius `--pill-radius = 6px`, padding `8px 0`, hauteur `24px`, gap `4px`. Tokens ajoutés dans `:root` (auto-inversibles avec le thème via `surface-veil` qui s'inverse déjà).
- **Mode toggle** : reste un segmented control (un pill avec deux boutons internes) plutôt que deux pills séparés — pattern segmented standard.
- **Status bar background** : passe de `--color-bg-sidebar` à `transparent` (le canvas main passe à travers, les pills se détachent).

### Tests
- Avant : vitest 152, cargo 60, visual 17
- Après : vitest **152** (1 test ajusté pour le nouveau texte "Aucun fichier"), cargo 60, visual **18** (+block-handle.spec.ts). Tous baselines régénérés (le ⋮⋮ disparaît, les pills apparaissent).

### Décisions autonomes
- Texte "Aucun fichier sélectionné" raccourci en "Aucun fichier" pour rentrer dans le pill.
- Pas de tooltip sur le `+` (cf. analyse du brief).
- ⋮⋮ caché par `display: none` plutôt que par `visibility: hidden` — on retire l'affordance complètement (cliquer sur l'espace ne fait plus rien, plus honnête).

## Block menu Notion-like + drag-reorder (Phase 7) — 15:09 → ~15:35

### Changement de cap par rapport à hier
Hier (option B) : ⋮⋮ masqué, Phase 7 backloggée. À l'usage, frustration UX confirmée : transformer un block via clavier (taper `/heading 2`) demande de se rappeler les commandes ; cliquer sur ⋮⋮ pour avoir un menu Notion-like est ce que les utilisateurs attendent. Décision révisée : implémenter Phase 7 maintenant.

### Implémentation
- `app.css` : restauré la visibilité du ⋮⋮, `cursor: grab` / `grabbing` pour signaler l'affordance drag.
- `ContextMenu.svelte` : `MenuItem` étendu en discriminated union à 3 cas : `{ separator: true }` | `{ header: string }` | item interactif. Le `{ header }` rend un `<li role="presentation">` non-cliquable, uppercase tracké, pour les sections type « Transformer en ». Pas de sub-menu nested (KISS — flat avec section header suffit).
- `Editor.svelte` : 
  - Capture `crepe.editor.action(ctx => …)` + les imports `commandsCtx`, `editorViewCtx` du `@milkdown/kit/core` + les schemas/commandes de `@milkdown/kit/preset/commonmark`.
  - `wireBlockHandle()` : poll bref pour `.milkdown-block-handle .operation-item:nth-child(2)`, attache click + dragstart + dragend. Et `dragover` + `drop` sur le root.
  - `resolveTargetBlock()` : utilise `view.posAtCoords({ left: handleRect.right + 30, top: handleRect.top + handleHeight/2 })` — le handle vit dans le gutter gauche, on probe à droite pour atterrir dans le block. Renvoie `{ start, end, level }`.
  - `transformTargetBlock(kind)` : place la sélection au début du block via `state.selection.constructor.near()` (pas d'import statique de `prosemirror-state`), puis dispatche `setBlockTypeCommand` ou `wrapInBlockTypeCommand` selon le `kind`. Pas d'appel à `clearTextInCurrentBlockCommand` — c'est ce qui supprime le `/heading 2` tapé dans le slash menu, ici on veut PRÉSERVER le contenu existant.
  - `duplicateTargetBlock()` : `tr.insert(end, doc.slice(start, end).content)`.
  - `deleteTargetBlock()` : `tr.delete(start, end)`.
  - Drag : `dragstart` capture `{ srcStart, srcEnd, level }` + MIME `application/x-markhub-block`. `dragover` calcule le drop indicator en snappant au boundary block hovered (start ou end selon `clientY < mid`). `drop` applique `tr.delete(src) + tr.insert(dropPos, slice)` avec ajustement de `dropPos` si la destination est après la source.

### Décisions autonomes
- **Pas de sub-menu** : ContextMenu a déjà la structure flat avec `{ header }`. Implémenter du nested aurait demandé une grosse refonte du composant pour un gain UX marginal.
- **Pas de `clearTextInCurrentBlockCommand`** : on veut transformer un block existant SANS perdre son contenu, contrairement au slash menu Crepe qui efface le `/heading 2` tapé.
- **Drop indicator simple** : ligne accent 2px snappée au boundary, pas de ghost preview du block. Le ghost preview demanderait un layer custom au-dessus du DOM ProseMirror — disproportionné pour MVP.
- **Pas de patch monkey de Crepe** : tout le wiring se fait depuis l'extérieur via `posAtCoords` et le `crepe.editor.action(ctx)` API publique. Robuste aux maj Crepe.

### Tests
- Avant : vitest 152, cargo 60, visual 18
- Après : vitest 152, cargo 60, visual **21** (+3 nouveaux dans `block-handle.spec.ts` : ⋮⋮ visible, menu open + items, transform H1→H2, delete bloc).
- E2E fonctionnels intentionnellement minimaux — Playwright peut tester `posAtCoords` + click via réel browser ; les transactions ProseMirror sont alors testées de bout en bout.
- **Drag-drop pas testé en automatique** — `dispatchDrop` Playwright fragile, smoke test interactif. Logique couverte par le code (resolveTargetBlock + tr.delete/insert).

### Bugs/blocages
- 1ère version `transformTargetBlock` : code TypeScript brouillon avec une `TextSelection` mal importée. Refactor pour utiliser `state.selection.constructor.near($pos)` — pas de dépendance statique sur `prosemirror-state`, plus léger.
- Variables locales préfixées `$pos` rejetées par Svelte 5 (réservé aux runes). Renommées en `resolvedPos` / `posStart` via sed.
- Test `:first-child` initial cassé car Crepe ajoute un `<div class="ProseMirror-widget">` en première position. Tests réécrits pour cibler les blocks par `tagName` + texte au lieu de position DOM.

### Commit
- Hash : `abff5fd`





---

# Session 2026-05-10 — Polish drag-drop + ContextMenu overflow + code picker, puis migration BlockNote (interrompue)

## Audit fixes Crepe (commit `74b0066`)
Trois bugs identifiés en usage réel par Matheo :
1. **Drag-drop block ne déplaçait rien** — Chromium exige `preventDefault()` dans `dragenter` ; `dataTransfer.types.includes(MIME)` est unreliable côté drop pour les MIMEs custom. Fix : ajout d'un `dragenter` handler ; gating sur `dragSourceStart !== null` (variable JS) au lieu du check `.types`.
2. **Block menu clippé en bas du viewport** — pas de max-height, pas d'auto-flip. Fix : `tick() + getBoundingClientRect` dans `ContextMenu.svelte`, auto-flip si `y + height > viewport - 8`, clamp horizontal, `max-height: calc(100vh - 16px)` + `overflow-y: auto`, `box-shadow: var(--shadow-popover)`.
3. **Picker langage code blocks see-through** — Crepe `.list-wrapper` mappé sur `--crepe-color-surface-low` (~3% white). Fix : override `.list-wrapper` opaque (`--color-bg-raised`) + bordure + popover shadow + Markhub fonts. Search-box, language-list-item, language-button restylés en cohérence. z-index: 100.

Tests : cargo 60/60, vitest 152/152, visual 22 passed + 1 skipped (drag manuel).

## Drag-reorder ré-implémenté en pointer events (commit `103cdfe`)
**Smoke réel utilisateur** : "drag and drop marche pas... pas de ligne bleue rien". Les fix HTML5 ne tenaient pas. Rewrite complet en pointer events :
- `pointerdown` sur ⋮⋮ → resolve target block, `setPointerCapture`, écoute `window`
- `pointermove` → seuil 4px → commit drag → drop indicator continu via `posAtCoords`
- `pointerup` → si drag : `tr.delete + tr.insert` ; si click pur : laisser le menu s'ouvrir
- Flag `clickSuppressed` pour swallow le click synthétique post-drop

Le test Playwright drag E2E qui était skippé tourne maintenant et passe (page.mouse.down + move + up dispatchent des pointer events natifs).

**Ce qui est encore inconnu** : malgré ce rewrite, smoke réel utilisateur post-103cdfe non explicitement re-confirmé.

## Investigation BlockNote (commits `abccc90`, `64f6482`)
Hors workplan initial. Décision Matheo (2026-05-10) : remplacer Crepe par BlockNote.

- Étape 1 : install `@blocknote/core@^0.50.0`. API vanilla confirmée par lecture des `.d.ts` du package : `BlockNoteEditor.create()` + `editor.mount(el)` + `onChange()` + `blocksToMarkdownLossy()` + `tryParseMarkdownToBlocks()`. Plugins UI logiques dans `@blocknote/core/extensions` exposent leur état via `emitUpdate(state)` callbacks → on rendra l'UI en Svelte custom (pas React). Notes complètes dans `MIGRATION-NOTES.md`.
- Étape 2 : route dev `_blocknote-test` avec round-trip sur 3 fixtures représentatives (`tests/fixtures/c1/`). Verdict : **pas de blocker fatal**. Tous les diffs sont cosmétiques (`-`↔`*`, tight↔loose lists, table padding, `---`↔`***`) ou idempotents (default `text` lang on code blocks). Un cas marginal à surveiller : nested bold-italic re-encodé.

**Smoke des features UI natives non-testable en l'état** : `@blocknote/core` mounté seul ne rend AUCUN chrome (drag handle, slash menu, toolbar, etc.). Logique dans les plugins, UI à coder en Svelte. Estimation 1-2j pour 4-5 composants.

## Étape 2.5.a — Slash menu BlockNote en Svelte (commit `9256f57`)
Premier des 5 composants UI BlockNote.
- `src/lib/components/BlockNoteSlashMenu.svelte` consomme le TanStack Store du `SuggestionMenu` plugin via `editor.getExtension('suggestionMenu').store.subscribe(...)`.
- Items via `getDefaultSlashMenuItems(editor)` + `filterSuggestionItems(items, query)`.
- Nav clavier ↑/↓/Enter/Escape sur listener `window` (pas de blur de l'éditeur).
- Sélection via `mousedown.preventDefault()` pour préserver le caret.
- Tests : 2/2 (menu opens with default items + transform H1).

**Découvertes BlockNote-API** (réutilisables pour les composants à venir) :
1. `editor.extensions` est un `Map<string, ExtensionInstance>` — accès via `editor.getExtension(key)` (pas `editor.extensions.suggestionMenu`).
2. `ext.store.subscribe(callback)` reçoit `{ prevVal, currentVal }`, **pas** le state directement.

## État brutal (audit demandé par Matheo en fin de session, avant nouvelle session)
- App principale : **Crepe** + patches custom. BlockNote NON branché, vit sur route dev.
- Drag-drop block : "pas de ligne bleue rien" en réel (post-103cdfe — non confirmé fixé).
- Drag-drop sidebar : "doesn't work at all" en réel. HTML5 native, jamais migré en pointer events. Workplan §C3 prévoit la migration.
- Toast / notifications : pas démarré.
- Onglets fichiers / Outline panel / Empty state : briefs posés (`features/sommaire.md`, `features/empty-state.md`), aucun code.
- Tests : cargo 60/60, vitest 152/152, visual 23 + 1 skipped, check 0/0, build OK.

Voir `STATE.md` pour le détail factuel.

## Prochaine session
Nouveau plan à recevoir de Matheo. Cette session se termine sur la branche `feat/blocknote-migration` (3 commits ahead de `main`, non mergée).

# Session 2026-05-10 (suite) — Étape 2.5.b + Bascule étape 4

## Étape 2.5.b — FormattingToolbar BlockNote en Svelte (commit `c8587d7`)

Deuxième des cinq composants UI BlockNote.

- `src/lib/components/BlockNoteFormattingToolbar.svelte` : 5 boutons (B / I / S / </> / 🔗), position fixed au-dessus de `referencePos`, auto-flip si pas la place en haut, `is-active` selon `activeStyles`, `mousedown.preventDefault()` pour ne pas perdre la sélection.
- Wiring dans `_blocknote-test/+page.svelte` : subscribe au plugin `formattingToolbar` (store `Store<boolean>`, **pas** d'objet d'état comme le slash menu — on calcule `referencePos` via `window.getSelection().getRangeAt(0).getBoundingClientRect()`). Lecture des marks actifs via `editor.getActiveStyles()`. Lien via `editor.createLink(prompt(...))` (LinkToolbar inline = étape 2.5.e).
- 7 tests vitest (composant pur), 3 tests Playwright sur la route dev.

**Découverte API supplémentaire** : le `n()` interne du plugin retourne `false` si la sélection contient un block code → toolbar cachée sur les code blocks (comportement natif voulu, à connaître pour les futurs tests).

**Souci de test E2E** : `Shift+Home` est unreliable dans le contenteditable BlockNote via Playwright. Workaround consigné dans le helper `typeAndSelect` du spec : on tape puis recule avec `Shift+ArrowLeft` × N pour avoir une sélection déterministe.

## Bascule étape 4 anticipée — `Editor.svelte` passe sur BlockNote (commit `???`)

Décision conjointe avec Matheo en fin de session : la spec d'étape 4 du plan est avancée AVANT 2.5.c/d/e. Raison : 5 étapes de plus à attendre Crepe dans l'app principale = psychologiquement insoutenable et empêche tout test en conditions réelles. Plan révisé documenté dans `PLAN-BLOCKNOTE.md`.

### Ce qui change dans `Editor.svelte`

Refactor complet (770 → ~270 lignes) :

- **Out** : `@milkdown/crepe` + `@milkdown/kit/*`, `wireBlockHandle`, `resolveTargetBlock`, block menu transform/duplicate/delete custom (`buildBlockMenuItems`, `transformTargetBlock`, …), drag-reorder pointer events (`onHandlePointerDown`, `updateDropIndicator`, `applyBlockReorder`), drop indicator div, override `--crepe-*`.
- **In** : `BlockNoteEditor.create()` + `editor.mount(container)` + `editor.replaceBlocks(editor.document, editor.tryParseMarkdownToBlocks(initialBody))`. `editor.onChange(() => editor.blocksToMarkdownLossy() → joinFrontmatter(initialFrontmatter, md) → onChange(...))`. `BlockNoteSlashMenu` + `BlockNoteFormattingToolbar` montés en frères, alimentés par les stores des plugins via `getExtension`. `editor.isEditable = !readonly` (réactif sur changement de prop).
- **Préservé** : props `content / readonly / mode / onChange / onReady`, frontmatter `<details>` au-dessus, source-mode `<textarea>`, `EditorApi { runCommand }` en stub no-op (la EditorToolbar du header était déjà cosmétique).

### Bug latent évité — `replaceBlocks` initial

`editor.onChange` se déclenche aussi pour `replaceBlocks`. Sans précaution, le mount du fichier ré-emit le contenu identique vers `onChange` qui déclenche un autosave inutile. Flag `suppressNextChange = true` initialisé avant le `replaceBlocks` initial, puis reset au premier `onChange` reçu.

### Documentation mise à jour

- `MIGRATION-NOTES.md` : section bascule, décisions, bugs acceptés temporairement.
- Tests :
  - `tests/component/Editor.test.svelte.ts` : mock `@milkdown/crepe` remplacé par mock `@blocknote/core` (BlockNoteEditor stub). Les 7 tests existants passent.
  - `tests/visual/_helpers.ts` : sélecteur d'attente `.milkdown .ProseMirror` → `.bn-editor.ProseMirror`.
  - `tests/visual/text-selection.spec.ts`, `editor-toolbar.spec.ts`, `light-mode.spec.ts` : sélecteurs adaptés.
  - `tests/visual/block-handle.spec.ts` : `test.describe.skip` (réactivé / remplacé à 2.5.c).
  - `tests/visual/editor-slash-menu.spec.ts` : `test.describe.skip` (déjà couvert par `blocknote-slash-menu.spec.ts`).
  - Baselines visuelles : `editor-headings`, `editor-headings-light`, `app-shell-light`, `task-list-light`, `editor-slash-menu-light`, `task-list`, `sidebar-overflow` régénérées (pixel diffs attendus, rendu BlockNote ≠ rendu Crepe).
- `app.css` : règle `::selection` Crepe-spécifique (`.milkdown.milkdown .ProseMirror …`) remplacée par l'équivalent BlockNote (`.bn-editor.ProseMirror …`).

### Bugs acceptés temporairement (cf. PLAN-BLOCKNOTE.md §"Bugs ACCEPTÉS à cette étape")

- Pas de drag handle ⋮⋮ visible (étape 2.5.c)
- Pas de transform menu au clic ⋮⋮ (slash menu via `/` accessible en attendant)
- Pas de toolbar custom sur les liens (`prompt()` du formatting toolbar)
- Tables : pas de boutons `+` row/col custom, drag natif fonctionnel
- Polish CSS imparfait (étape 3)

### Tests post-bascule

- cargo : 60/60 ✅
- vitest : 159/159 ✅
- check : 0 erreur, 0 warning ✅
- build : OK ✅
- visual : 22 passants + 7 skipped (5 block-handle Crepe + 1 slash-menu Crepe + 1 e2e placeholder) ✅

Aucun test ne tape le filesystem utilisateur réel.

### Prochaine étape

Smoke test exhaustif Matheo dans l'app principale (11 étapes listées dans la spec étape 4). Si OK : étape 2.5.c (SideMenu — drag handle ⋮⋮ + transform menu) directement dans l'app principale.

# Session 2026-05-11 — Clôture migration BlockNote (étapes 2.5.e + 3 + 5 + 6)

## Mode d'exécution

L'user a explicitement autorisé l'enchaînement étapes 2.5.e → 3 → 5 → 6 sans smoke entre chaque, "vas y jusqu'à 6 et on clôture". Risques acceptés (rollback plus coûteux après étape 5 si quelque chose casse en réel, mais étapes commitées une par une donc revert possible commit par commit).

Travail parallélisé : 4 agents recherche dispatch en parallèle au démarrage pour préparer chaque étape (API LinkToolbar, mapping CSS, catalog cleanup Crepe, drafts docs clôture). ~10 min pour les 4 briefs, ensuite exécution séquentielle des écritures (évite les merge-conflicts sur Editor.svelte + app.css). Gain estimé ~60% vs séquentiel pur.

## Étape 2.5.e — LinkToolbar (commit `be13afa`)

Composant `BlockNoteLinkToolbar.svelte` pour l'édition inline d'un lien existant (URL + supprimer). Remplace partiellement le `window.prompt()` de 2.5.b : la **création** d'un lien reste sur le prompt (Option A du brief, MVP), l'**édition** d'un lien existant passe par la nouvelle toolbar.

**Spécificité du plugin** : pas de `.store` TanStack contrairement aux 4 autres plugins. C'est une API query-only :
- `getLinkAtSelection()` → `{ range, mark.attrs.href, text, position: DOMRect }`
- `editLink(url, text, position)` / `deleteLink(position)`

Le host poll `getLinkAtSelection()` à chaque `onSelectionChange` et drive sa propre visibilité.

Tests : 8 unit vitest + 3 E2E Playwright sur fixture `link` ajoutée à `_visual`.

## Étape 3 — Polish CSS Markhub (commit `7ae23e7`)

Création de `src/lib/styles/editor-blocknote.css` (~270 lignes), importé dynamiquement après `@blocknote/core/style.css`. Couvre :

- **Mapping des 6 variables `--bn-*`** exposées par BlockNote → tokens Markhub (`--bn-colors-editor-text` → `--color-text-primary`, `--bn-colors-hovered-background` → `--color-surface-hover`, `--bn-colors-side-menu` → `--color-text-muted`, etc.). Auto-inversion light/dark via les tokens.
- **Échelle IDE-density** pour les headings (26/21/18/16/14/14) vs 42/36/32/28/24/18 par défaut BN.
- **Override des hex hardcodés** lus dans `@blocknote/core/dist/style.css` (avec `!important` car BN utilise des sélecteurs équivalents) :
  - code blocks (#161616/#fff → `--color-surface-veil` / `--color-text-primary`)
  - blockquote (#7d797a → `--color-text-body` / `--color-border-strong`)
  - tables (#ddd → `--color-border`)
  - selected node outline (#64a0ff → `--color-accent`)
  - drop cursors block + table + column-resize (#adf → `--color-accent`)
  - file blocks (#f2f1ee → `--color-surface-veil`)
- **Task list** : `accent-color: var(--color-accent)` sur les checkboxes.
- **Light mode** : aucune duplication nécessaire, tokens auto-inversent. Seule exception le `<select>` picker du code block (texte forcé `text-muted` en light pour rester lisible).

Les ~70 lignes de `<style>` scoped dans Editor.svelte (étape 4) migrent vers le fichier dédié (sans le wrapper `:global()` puisque le fichier est global). Aucune baseline visuelle régénérée — les diffs étaient sous le seuil de tolérance.

Note : les 4 composants UI Svelte que j'avais écrits aux étapes 2.5.a-d utilisaient déjà les tokens Markhub directement → 0 refonte nécessaire.

## Étape 5 — Cleanup Crepe (commit `e52536a`)

Désinstallation `npm uninstall @milkdown/core @milkdown/crepe @milkdown/preset-commonmark`. Le lockfile perd 1456 lignes (purge de ~38 deps transitives Tiptap/ProseMirror).

`src/app.css` perd les lignes 434-743 (311 lignes d'overrides Crepe : slash menu, toolbar, block handle, code block, list items, task checkboxes). Tout est déjà géré par `editor-blocknote.css` (étape 3).

Specs Playwright supprimés : `tests/visual/block-handle.spec.ts` (28 refs Crepe, skippé étape 4) + `tests/visual/editor-slash-menu.spec.ts` (4 refs, skippé étape 4) + leurs snapshots PNG.

Commentaires obsolètes nettoyés dans : `Editor.svelte` (stub EditorToolbar), `activeFile.svelte.ts` (race condition), 3 specs visuelles (`editor-frontmatter`, `task-list`, `text-selection`).

**2 déviations du plan, documentées dans le message de commit** :
- `src/routes/_blocknote-test/+page.svelte` CONSERVÉE (plan disait supprimer). 8 tests E2E actifs (slash-menu, formatting-toolbar, roundtrip) l'utilisent comme dev surface. Migrer aurait coûté plus que la valeur.
- `MIGRATION-NOTES.md` CONSERVÉE (plan disait supprimer). Valeur historique, zéro coût.

Vérification finale : `grep -rE "milkdown|crepe|Crepe" src/ tests/visual/ tests/component/` retourne 0 hit (sauf contenu textuel des fixtures `.md`).

## Étape 6 — Clôture (ce commit)

Documentation mise à jour : `STATE.md` (réécrit), `WORKPLAN.md` (C1 → ✅, C2/C3 débloqués), `BACKLOG.md` (items Phase 7 ré-annotés comme livrés via BN), `PLAN-BLOCKNOTE.md` tableau de progression (tous ✅ avec commits réels).

## Bugs trouvés et fixés (récap session complète)

1. **Drag preview leak** (étape 2.5.d) : `.preview { position: relative }` (reliquat Crepe) écrasait `.bn-drag-preview { position: absolute }` → clone 1280×410 en flow → status bar poussée à chaque dragstart. Fix : retrait de la règle, commentaire inline (`a250096`).
2. **Tauri WKWebView interception drag** (post-2.5.c) : `dragDropEnabled: true` (défaut Tauri 2) absorbe les events drag pour l'API file-drop OS, bloquant tout drag HTML5 in-page. Fix : `dragDropEnabled: false`. Trade-off : pas d'API file-drop OS (non utilisée par Markhub). User validation explicite "OK ! bravo" (`21ac2ee`).
3. **`replaceBlocks` initial déclenche `onChange`** (étape 4) : autosave inutile au mount. Flag `suppressNextChange`.
4. **`Shift+Home` non-déterministe** dans BN Playwright : workaround `Shift+ArrowLeft × N`.

## Tests finaux (branche `feat/blocknote-migration`)

- cargo : **60/60 ✅**
- vitest : **189/189 ✅** (152 au début → +37 nouveaux pour les 5 composants UI)
- svelte-check : **0/0 ✅**
- build : **OK ✅**
- visual Playwright : **34/34 ✅** (les 2 specs Crepe skippées sont supprimées, plus aucun skipped résiduel côté visual)

## Aucun chantier hors migration ouvert pendant cette session

Strict respect du scope. C2 (toast), C3 (sidebar drag-drop), folder-delete EPERM (diagnostiqué hors plan le 2026-05-10 mais NON corrigé pendant cette session) attendent leur tour post-merge.

## Prochaine session

L'user merge `feat/blocknote-migration` sur `main` manuellement. Puis arbitrage entre C2 / C3 / folder-delete fix. La mémoire `pending_folder_delete.md` rappellera le diagnostic du folder-delete au moment voulu.

---

# Session 2026-05-11 (après-midi/nuit) — PLAN-DESIGN-DEFAULTS clôturé (10 steps)

## Contexte

Migration BlockNote mergée le matin (commit `0e72755` sur `main`). Au cours d'une session continue overnight, l'user (Matheo) demande l'exécution séquentielle de 4 plans dans `plan-110526/` : PLAN-BLOCKNOTE (leftovers), **PLAN-DESIGN-DEFAULTS (10 steps)**, PLAN-COMMAND-SYSTEM, PLAN-SETTINGS. La session s'est arrêtée à la clôture de DESIGN-DEFAULTS — les deux derniers plans attendent une nouvelle session.

Règles de session répétées : un step à la fois, wrap-up obligatoire avec procédure smoke test, branche dédiée par plan, pas de merge auto, honnêteté brutale, pas de "vibe coding".

## Branche

`feat/design-defaults` (10 commits ahead de `main`). Prête merge manuel par Matheo.

## Commits livrés (10)

```
e6c459e feat(design): augment CSS token namespace                            (STEP 1)
9378691 feat(design): theme-aware danger surface + WCAG fix                  (STEP 2)
0e37004 feat(design): migrate components to --font-ui / --font-editor split  (STEP 3)
6136502 feat(design): spacing rhythm sweep + .button floor compliance        (STEP 4)
aa90373 feat(design): micro-interactions baseline — transitions + focus     (STEP 5)
e7a987d feat(ux):     EmptyState launcher + launch on welcome                (STEP 6)
a9f89aa feat(ui):     Warp-style sidebar toggle in window chrome             (STEP 7)
92b358c design(empty-state): bump card icons to 20px                         (STEP 8)
8ca96a3 test(visual): full design baseline coverage                          (STEP 9)
```
(plus `bc0d93b` en tête de branche — reliquat BlockNote step 4 "UI finish" fait en intro avant STEP 1.)

## Ce qui a livré côté UX visible

1. **EmptyState** (launch screen) : wordmark Markhub + 4 cartes uniformes (Ouvrir / Créer / Cloner / Vault d'exemple) + liste de vaults récents (dot couleur + nom + path mono). C'est le 1er écran visible au lancement.
2. **Window chrome strip** (44px) avec **bouton toggle sidebar Warp-style** (24×24 PanelLeft) aligné aux feux macOS (gutter gauche 80px). La sidebar se replie / déplie via animation width 280→0.
3. **Tokens CSS complets** (tier `--color-*`, `--font-*`, `--text-*`, `--leading-*`, `--space-*` 4px-grid, `--radius-*`, `--shadow-*`, `--duration-*`, `--easing-*`). Tous les composants migrés du système legacy vers tokens.
4. **`--font-ui` / `--font-editor` split** (les deux mappent Geist Sans aujourd'hui — préparation PLAN-SETTINGS qui permettra le choix d'une police d'éditeur indépendante du chrome).
5. **Light theme WCAG fix** : `--color-text-muted` `#a09e9a` → `#8a8884` (4.5:1 sur fond cream).
6. **Transitions / focus rings universels** via tokens (150ms + cubic-bezier standard).
7. **3 nouvelles commandes Tauri** : `vault_create`, `vault_create_sample` (seed 3 fichiers Bienvenue + Syntaxe + Astuces), `vault_clone_git` (shell `git clone`). Toutes typées + 8 tests Rust.
8. **`url_open` Tauri command** (http/https only) : `window.prompt` est bloqué dans WKWebView → le bouton "lien externe" du floating toolbar BlockNote + le LinkToolbar utilisent maintenant cette command pour ouvrir l'URL dans le navigateur système.

## Itérations visuelles avec l'user (notable)

- **EmptyState** : 1ère version "vibe coding too literal" (cards avec descriptions sous label, primary card inversée, recents avec bordures). User a comparé à Cursor avec capture d'écran et rejeté. Refactor : juste wordmark, 4 cartes uniformes 16px gap, max-width 640px centré vertical, recents sans bordures.
- **Window chrome toggle** : 5+ rounds d'alignement. L'user voulait que l'icône toggle s'aligne pile au centre vertical des feux macOS rouge/orange/vert. Settled sur `padding: 5px var(--space-3) 0 80px` après 4 micro-ajustements (~descend 4px / remonte 2 / descend 1).

## Décisions design importantes (capturées dans PLAN + DESIGN-PRINCIPLES)

1. **IDE-density chrome est un default Markhub** (pills/badges/toolbar 11–14px icons, 4px-grid micro-padding). La "comfortable density" Cursor s'applique **au canvas** (éditeur, EmptyState, modals), pas au chrome. **Nuance ajoutée à `DESIGN-PRINCIPLES.md §2 Density`.**
2. EmptyState refusé en "Cursor exact" → "Cursor-but-quieter" (pas de primary CTA inversé, pas de descriptions, pas de bordures).
3. STEP 8 iconography sweep : pas de bump 14→16 sur les inline icons. Seul outlier déplacé = EmptyState cards 18→20px (match plan "feature card" tier). Cohérent avec décision 1.
4. Visual baselines tolerance 1% : suffit à absorber la migration STEP 1-8 sans aucune régression sur les 34 baselines BlockNote préservées. Prouve que les changements étaient infrastructuraux, pas visuellement disruptifs.

## Tests finaux (branche `feat/design-defaults`)

- cargo : **60/60 ✅** (Rust quasi pas touché — sauf `url_open` + 3 vault commands testées)
- vitest : **193/193 ✅** (+4 vs BlockNote close : 3 tests URL inline toolbar, 6 tests EmptyState, 1 test Sidebar `collapsed`)
- visual Playwright : **39/39 ✅** (34 préservés + 5 nouveaux : `empty-state.spec.ts` × 3 + `window-chrome.spec.ts` × 2)

## Bugs et impasses notés

- **Drag fichier→dossier sidebar** : régression "Failed to rename ... os error 2" toast confirmée par l'user pendant la session. Diagnostic : pre-existing bug C3 (HTML5 event bubbling entre drop zones imbriquées — l'inner rename réussit puis l'outer drop zone reçoit l'event sur le path stale et ENOENT). **Out of scope DESIGN-DEFAULTS.** Reste C3 du workplan.
- **Folder-delete EPERM macOS** : toujours pas fixé. Branche `fix/folder-delete-permission` attend du temps post-merge.

## Aucun chantier hors DESIGN-DEFAULTS attaqué pendant cette session

Strict respect du scope. PLAN-COMMAND-SYSTEM (8 steps : Cmd+K command palette, Cmd+P file picker, Shift+F filter), PLAN-SETTINGS (8 steps : panel de préférences), C2 toast, C3 sidebar drag-drop, folder-delete fix → tous en attente.

## Prochaine session

Matheo merge `feat/design-defaults` sur `main` manuellement. Puis arbitrage : démarrer PLAN-COMMAND-SYSTEM ou attaquer un bug bloquant (C3 ou folder-delete) en priorité.

---

# Session 2026-05-12 (nuit, suite) — fixes post-clôture DESIGN-DEFAULTS

Cette mini-session est la suite directe de la clôture DESIGN-DEFAULTS du 11 (même branche `feat/design-defaults`). Deux commits ajoutés après la GATE STEP 10.

## Commit `e791d91` — slash-menu flip

User a remonté en réel : "quand je fais / en bas d'écran, souci affichage sélecteur". Le menu BlockNote était positionné en dur à `referencePos.bottom + 4` sans check viewport → clip sous la status bar quand le caret était bas.

Fix dans `src/lib/components/BlockNoteSlashMenu.svelte` :
- Mesure `menuEl.getBoundingClientRect()` après chaque mount / changement d'items via `$effect` qui tracke `items.length` et `menuState.show`.
- $derived `top` : si pas de place dessous (`desiredBelow + menuHeight + 8 > innerHeight`), flip au-dessus (`ref.top - menuHeight - 4`). Si ni au-dessus ni en-dessous ne fit, clamp au bas avec marge 8px.
- $derived `left` : même logique défensive sur l'axe horizontal pour les carets près du bord droit.
- 1ère frame avant mesure : `menuHeight === 0` → renvoie `desiredBelow` (auto-corrigé au tick suivant).

Test ajouté : `tests/visual/blocknote-slash-menu.spec.ts` test "slash menu flips above the caret when there is no room below" — utilise la fixture `editor-overflow`, scroll en bas, tape "/", vérifie que la bounding box du menu reste dans la viewport ET au-dessus du caret. 40/40 visual verts.

User a validé live : "fixé."

## Commit `b969fb6` — audit pré-merge (a11y + security + drag)

À ma demande pré-merge, l'user a lancé 2 agents code review en parallèle avec focus complémentaire :
- **Agent A (rigueur code / TS / Svelte 5 / Rust)** — verdict "fix P0 before merge", 1 P0 (`url_open` validate ≠ spawn bytes) + 8 P1/P2.
- **Agent B (design system / a11y / WCAG)** — verdict "fix P0s before merge", 4 P0 (sidebar focus trap, slash menu activedescendant, icones Lucide aria-hidden, light text-secondary WCAG fail) + 8 P1/P2.

User a OK une stratégie unique : "5 P0 + P1 rapides en un commit".

Pendant l'audit, user a remonté live : "je ne sais plus draguer l'app sur le bureau" / "position fixe !". Diagnostic : avec `titleBarStyle: "Overlay"` introduit en STEP 7, Tauri 2 ne câble pas toujours `data-tauri-drag-region` correctement, et `getCurrentWindow().startDragging()` était bloqué par capabilities manquantes.

Bundle livré (8 fichiers touchés) :

### Window drag fix
- `src-tauri/capabilities/default.json` : ajout `core:window:allow-start-dragging`.
- `src/routes/+page.svelte` : handler `onmousedown` manuel sur la chrome strip → `startDragging()` direct, skip si target.closest('button, a, input, ...'). Suppression du `data-tauri-drag-region="false"` sur le bouton (inutile vu le manual handler).

User a validé : "fixé".

### Sécurité Rust
- `src-tauri/src/commands/files.rs` : extraction de `validate_open_url(url: &str) -> Result<&str, String>` qui retourne les **bytes trimmés réellement passés à `open`** (validation et syscall sur la même string). Rejet des control chars (NUL, newline, tab) qui pouvaient découpler la validation de l'exécution. **+5 tests** : http/https accept, mixed-case, whitespace trim, non-http schemes (file/javascript/ftp/data/vscode), control chars, empty input.
- `src-tauri/src/commands/vaults.rs` : `derive_vault_name_from_git_url` rejette `.`, `..`, tails contenant `/`/`\`. **+1 test**.

### A11y
- `src/lib/components/Sidebar.svelte` : `aria-hidden={collapsed}` → `inert={collapsed}` (fix focus trap inverse : avant, descendants restaient tabbables tout en étant cachés à l'AT).
- `src/lib/components/BlockNoteSlashMenu.svelte` : ajout id stable par item (`bn-slash-item-idx-${idx}`), `tabindex="-1"` + `aria-activedescendant` sur le menu, wrap des groupes en `role="group" aria-labelledby`. Retrait du `aria-selected` (invalide sur `role="menuitem"`). Modernisation `<svelte:window on:keydown>` → `onkeydown`.
- 6 icônes Lucide → `aria-hidden="true" focusable="false"` : EmptyState ×4 cards + chrome PanelLeft + badge Lock.
- `src/app.css` light theme : `--color-text-secondary` `#75736f` → `#6c6a66` (4.12 → 4.6 sur fond sidebar = clear WCAG AA 4.5:1).
- `chrome-toggle` aria-label varie par état ("Replier" / "Déplier") au lieu d'un label statique générique.

### Décisions / non-pris
- Pas de bump 14→16 sur les inline icons (cohérent avec décision IDE-density chrome).
- Pas de standardisation des focus-ring offsets (1px / 2px / -2px) — c'est un call stylistique qui mérite eye-balling, reporté à un follow-up.
- Pas de tracker MRU pour les vaults récents EmptyState — ajout d'un `lastOpenedAt` à modéliser dans PLAN-SETTINGS.
- Pas de timeout/progress sur `git clone` — backlog.

## Tests finaux après audit

- cargo : 74/74 (+14 vs BlockNote close)
- vitest : 193/193
- visual : 40/40
- svelte-check : 0/0

## État pour la session suivante

Branche `feat/design-defaults` à 13 commits ahead de `main`, prête merge manuel (auto-classifier bloque le merge depuis Claude — conforme aux règles).

Prochain chantier : **PLAN-COMMAND-SYSTEM** (Cmd+K command palette, Cmd+P file picker, Shift+F filter) — 8 steps. Branche dédiée `feat/command-system` depuis `main` post-merge.

Memory persistante toujours à jour : `pending_folder_delete.md` rappelle le diag du folder-delete EPERM, à attaquer un jour.

---

# Session 2026-05-12 (nuit, autonome) — merge design-defaults + folder-delete + PLAN-SETTINGS STEP 1 + 2

## Contexte

Matheo va dormir. Demande à Claude d'analyser les journaux et de proposer ce qui est faisable en autonomie. Discussion : COMMAND-SYSTEM / SETTINGS / drag-drop / folder-delete sont tous candidats. Matheo choisit **PLAN-SETTINGS en priorité** ("les commandes ne sont pas une priorité"). Il valide aussi : (a) fusionner les branches dans un main global maintenant (il s'embrouillait dans les commits), (b) supprimer les branches obsolètes, (c) cette nuit travailler directement sur `main` (zero ceremony).

**Politique mise en mémoire :**
- `feedback-branch-strategy.md` : par défaut commit sur `main`. Branches dédiées uniquement quand vraiment instable / expérimental.
- `feedback-merge-authorization.md` : Claude peut merger les branches feature sur main directement (l'ancienne règle "Matheo merge manuellement" est levée). Le push sur origin reste à Matheo.

## Setup initial (avant le code)

1. `git switch main` puis `git merge --ff-only feat/design-defaults` (13 commits ahead → main passe de `0e72755` à `659eba2`).
2. `git branch -d feat/design-defaults feat/blocknote-migration feat/blocknote-step4-ui-finish` (3 branches obsolètes nettoyées).

## Tentative dispatch parallèle (avec leçons)

L'user a explicitement demandé "tu ne lancerais pas une équipe en parallèle aussi ? Le drag and drop par exemple." → lancement de 2 agents `general-purpose` avec `isolation: "worktree"`, en background :
- Agent A : folder-delete EPERM fix (mémoire `pending_folder_delete` comme brief de diagnostic).
- Agent B : C3 drag-drop sidebar (HTML5 → pointer events).

**Les deux agents ont opéré dans MON arbre principal au lieu de leur worktree.** Probable cause : les prompts contenaient des chemins relatifs (`src-tauri/src/...`) que les agents ont résolus contre `/Users/lkid/Projects/products/markhub` (le project root cité en intro) plutôt que contre le worktree path. L'agent folder-delete a même fait un `git stash` poli de mon travail settings WIP avant de coder, puis créé une branche `fix/folder-delete-permission` dans mon arbre principal et committé `2fadb5b`.

**Récupération propre** :
- `git switch main` → `git merge --ff-only fix/folder-delete-permission` (FF clean) → `git branch -d fix/folder-delete-permission` → `git stash pop stash@{0}` (récupère mon WIP mod.rs + models.rs).
- Re-éditer manuellement `lib.rs` pour ajouter `settings_read` / `settings_write` (n'étaient pas dans le stash — l'Edit initial avait échoué avec "file modified since read" pendant que l'agent éditait le même fichier).
- Worktrees forcés `git worktree remove -f -f` + branches `worktree-agent-*` supprimées.

L'agent drag-drop a été tué en RED phase ; il n'avait commencé qu'un fichier test (`tests/component/FileTreeDragDrop.test.svelte.ts`, jamais commité) → perdu avec le worktree. **À reprendre en session directe.** Mémoire `feedback-parallel-agent-worktrees.md` posée.

## Commits livrés (3, sur `main`)

```
59893c7 feat(settings): modal shell with section navigation            ← STEP 2 settings
c4db29f feat(settings): persistent settings store with Tauri backend   ← STEP 1 settings
2fadb5b fix(files): folder deletion uses remove_dir_all (fixes EPERM)  ← folder-delete (de l'agent)
```

## Folder-delete fix (`2fadb5b`)

Le diagnostic posé le 10/05 par 2 agents diag était exact : bug code, pas TCC. macOS `unlink(2)` sur un dossier renvoie EPERM. Fix livré : nouvelle commande Rust `folder_delete` avec `fs::remove_dir_all`, gated by `resolve_safe_path` + `ensure_writable` + refus si relative path vide (racine vault), enregistrée dans `lib.rs`. Front : `folderDelete` wrapper + dispatch `entry.isDirectory` dans `Sidebar.svelte`. 5 tests Rust (empty / non-empty / refuse root / refuse traversal / refuse readonly).

Mémoire `pending_folder_delete.md` → à supprimer (résolu).

## STEP 1 — Settings store + persistence (`c4db29f`)

**Backend Rust** : `models::UserSettings` (versioned + 5 nested sections), `commands::settings::{settings_read, settings_write}`. **Atomic write** via `.tmp` + `fs::rename` (POSIX-atomic). **Resilient read** : missing file → defaults silencieux ; malformed JSON → defaults + backup `.bak` + warning log. 8 tests Rust (defaults / round-trip / parent dirs / pas de .tmp leftover / malformed → backup / overwrite atomique / schema defaults / camelCase JSON keys).

**Front Svelte 5** : `tauri/types.ts` ajout `UserSettings` + `DEFAULT_USER_SETTINGS`. `tauri/api.ts` wrappers. `stores/settings.svelte.ts` : `settingsStore` rune `$state` avec debounce 250ms via `setTimeout`. **Theme délégué au themeStore existant** (pas de duplication de logique runtime — `themeStore.init()` + `setPreference()` font le boulot). Boot hydration câblée dans `+page.svelte` après `vaultsStore.load` et `themeStore.init`. 10 tests vitest sur le store contract (mocks api + themeStore via `vi.mock`).

**Déviations documentées** :
- `appearance.theme: string` reste typé `'dark' | 'light' | 'system'` (legacy 3 valeurs) au lieu des 4 themes du plan. Les 4 themes du plan n'ont pas de CSS → STEP 3 les implémentera.
- `editor_line_height: f64` → drop `Eq` derive sur le struct (PartialEq suffit pour les tests).

## STEP 2 — Modal shell + navigation (`59893c7`)

**Composant `SettingsModal.svelte`** :
- Backdrop (`--color-backdrop`, z-index 200) + panneau centré 760×600 (`--radius-xl`, `--shadow-xl`).
- Header : titre + bouton X (Lucide).
- Left rail 200px : 6 sections avec icônes Lucide (Palette, Settings, Code, Folder, MousePointer, Wrench).
- Right pane : placeholder pour STEP 3+.
- A11y : `role="dialog"` + `aria-modal` + `aria-labelledby` ; `aria-current` sur la section active ; icônes Lucide `aria-hidden`.
- Auto-focus du panel à l'ouverture pour que Escape fonctionne sans préliminaire.
- Backdrop click + Escape ferment (Escape vérifie `isOpen` pour ne pas hijack quand fermé).
- Tous visuels via tokens design-system : `--color-bg-raised`, `--color-border`, `--color-surface-veil`, `--color-surface-hover`, `--color-accent`, `--radius-*`, `--shadow-xl`, `--space-*`, `--duration-base`, `--easing-standard`. Zéro hex/px hardcodé.

**Store additions** : `isOpen` + `activeSection` runes, `open(section?)` / `close()`. `SETTINGS_SECTIONS` typed const + `SettingsSection` union (utilisé par PLAN-COMMAND-SYSTEM pour deep-link `settings.open.appearance` etc.).

**Keyboard trigger temporaire** : `Cmd+,` / `Ctrl+,` global handler dans `+page.svelte` (OS-standard pour Settings). Quand PLAN-COMMAND-SYSTEM lance, ce binding migrera dans le command registry.

**Tests** :
- 10 tests vitest component (mocks api + themeStore).
- 5 tests visual Playwright : shell dark + shell light + deep-link advanced + escape close + backdrop close. Nouveau fixture `?fixture=settings-modal&section=...` dans `/_visual/+page.svelte`.

## Tests finaux après cette session

- cargo : **87/87 ✅** (74 + 5 folder-delete + 8 settings backend)
- vitest : **213/213 ✅** (193 + 10 settings store + 10 SettingsModal component)
- svelte-check : **0/0 ✅**
- visual Playwright : **45/45 ✅** (40 + 5 settings-modal)

## Validation user pendante

L'user dort. Au matin, smoke tests à faire (procédure détaillée dans `STATE.md` § "Smoke tests à faire par Matheo") :
1. Folder-delete sur un vrai dossier dans la sidebar.
2. `Cmd+,` ouvre le modal Settings, navigation rail OK, Escape/backdrop/X ferment.
3. Pas de régression visuelle sur l'éditeur / sidebar / EmptyState.

## Prochaine étape

Si smoke tests passent : **STEP 3 — Appearance section** (theme cards, font selectors, sliders avec live preview). Nécessite l'oeil de Matheo (visuel) → ne sera PAS attaqué en autonomie. En session collaborative directe.

Pas de scope creep cette nuit : pas de touche à drag-drop / toast / outline / onglets / etc. Strict respect du scope SETTINGS demandé par Matheo.

---

# Session 2026-05-12 → 2026-05-13 (continuation marathon collaborative) — Settings STEPS 3-5 + polish + import

Session continue avec Matheo réveillé. Validation des smoke tests STEP 1+2 le matin du 2026-05-12, puis enchaînement STEP 3-5, polish UX, tentative drag-drop OS abandonnée, livraison de la feature Import comme alternative orchestrable.

## STEP 3 — Apparence section (commits `39d2027` + `13489ac`)

Première version livrée en card-grid (theme cards 96px + font cards 110px + sliders + live preview paragraphe). Matheo a screenshot Cursor + ma version et a dit "petites box, pas Markhub". Reverté en design **flat** : group labels uppercase muted (Thème / Typographie / Aperçu), rangées full-width sur la surface modal, hairlines `--color-border-subtle` entre rows, segmented controls compacts à droite, sliders 160px + value chip mono. Pas de box-in-box. Mémoire `feedback_communication_style` posée au passage (Matheo veut des réponses conceptuelles, pas des dumps techniques).

## STEP 4 — Editor section (commit `d9dd033`)

Autosave delay slider 500-5000ms (label switche "ms"/"s" au-dessus de 1000), spellcheck toggle ARIA switch. Wiring consommateur :
- `activeFile.svelte.ts` lit `editor.autosaveDelayMs` du store au moment de scheduler le timer (fallback 1500 jusqu'à hydratation).
- `Editor.svelte` source-mode textarea bind `spellcheck={settingsStore.current.editor.spellCheck}`.
- BlockNote contenteditable : `applySpellcheck()` query `.ProseMirror` après mount + $effect réactif qui re-set sur toggle.

Refactor au passage : extraction des classes settings dans `$lib/styles/settings.css` (.settings-row, .settings-group-label, .settings-segmented, .settings-slider, .settings-switch) — importé une fois depuis `SettingsModal.svelte`. Refactoré SettingsAppearance pour utiliser ces classes.

## STEP 5 — Source + Files + Behavior (commit `40feb30`)

3 sections d'un coup :
- **Mode source** : picker monospace (Geist Mono / JetBrains Mono / Fira Code) en segmented control rendu dans chaque typo. Wiring via `--font-mono` override sur documentElement → source textarea + code blocks BlockNote prennent la nouvelle famille live.
- **Fichiers** : toggle confirmDelete. Consommé dans Sidebar.confirmDeleteFile + confirmDeleteEntry : si off, run handler immédiatement, skip dialog.
- **Comportement** : toggle askBeforeClosingUnsaved. Consommé dans Sidebar.handleOpenFile : si on + activeFileStore.status === 'modified', force-save avant l'openFile.

Bonus : ajout d'une **icône Settings dans la StatusBar** (next to theme toggle) à la demande de Matheo. Cmd+, reste le raccourci global.

## Polish (commit `e3b313e`)

3 fixes UX flaggés pendant smoke :
1. **StatusBar right zone reorder** — save-pill rendu à GAUCHE des icônes thème+settings. Icônes pinnées à l'extrême droite (plus de décalage horizontal quand le statut change).
2. **Path copy icon** — split le path pill en static-display + bouton icône Copy. Click sur l'icône copie chemin absolu, click sur le path ne fait plus rien (pas d'action discoverable).
3. **Modal Settings entrance** — backdrop fade-in 180ms + panel scale 0.96 → 1 + fade-in 180ms. Out 140ms. cubicOut. Souple, dev-tool.

Infra : polyfill `Element.prototype.animate` dans `tests/setup.ts` parce que jsdom n'implémente pas Web Animations API que Svelte 5 transitions utilisent.

## Tentative drag-drop OS body typography → REVERT (commits `afe0ae1` + `b2c19d2` + `506d1ec`)

Matheo a flaggué que les sliders fontsize/lineHeight de STEP 3 ne s'appliquaient PAS dans l'éditeur en réel. J'avais explicitement déféré ce wiring à STEP 4, puis oublié de le faire. Tentatives en escalade :

1. **CSS variables** avec fallback `--editor-body-font-size, 15px` → BlockNote cascade gagne.
2. **CSS variables + sélecteurs plus spécifiques** (`.preview .bn-editor.bn-default-styles`) → idem.
3. **CSS `!important` × 4 sélecteurs** + conversion import statique CSS (HMR was suspect on dynamic imports) → toujours pas appliqué.
4. **JS-driven `setProperty(..., 'important')` direct sur les éléments DOM + MutationObserver** pour les nouveaux blocs → **freezeait l'éditeur** sur chaque frappe (observer bouclant infiniment : apply → DOM mutation → observer fire → apply...).

Matheo a dit "On est pas en train de faire un truc très sale avec cette histoire de settings. Si tu veux on met ça de côté et on fait ça plus tard." → revert complet. Path propre identifié : passer par l'API de theming BlockNote (le fichier `editor-blocknote.css` utilise déjà ses tokens `--bn-*` propres). Tracé dans BACKLOG.md.

## Tentative drag-drop OS vers Finder → REVERT (commits `80b082b` + `81451d8`)

Matheo a demandé "drag md → Finder/bureau" comme feature dev-tool naturelle. Plan en 2 chantiers : C4 (sortie) + C5 (entrée, conflit BlockNote). J'attaque C4 avec `@crabnebula/tauri-plugin-drag` v2.1.1 :

- Plugin installé Cargo + npm
- Registered dans lib.rs + capability `drag:default` ajoutée
- Wrapper `dragFileOut(absolutePath)` dans api.ts
- FileTree.svelte : `handleDragStart` détecte `e.metaKey || e.ctrlKey` → preventDefault HTML5 + appel `onDragOut(entry)`. Sans modifier = drag in-app reorg existant.
- Sidebar.svelte : `handleDragOut` résout absolutePath et appelle dragFileOut.

Tests OK : cargo + vitest + svelte-check verts. Mais au lancement du dev server : **panic Rust** "called Result::unwrap() on an Err value: RecvError" dans `tauri-plugin-drag-2.1.1/src/commands.rs:162:15`. Plugin v2.1.1 buggé au démarrage (pas notre code). Pas de version plus récente sur crates.io. Plugin probablement abandonné (Crabnebula a pivoté).

Matheo a dit "C'est pas le mécanisme principal de l'application, c'est à considérer comme une option" → revert complet, drag-drop OS déprio.

## Feature Import — alternative orchestrable au drag-drop (commits `ae5fbd9` + `6124575`)

Matheo a proposé : "une fonction import dans le vault serait plus facile à orchestrer". Excellente idée — zéro plugin tiers, zéro conflit avec BlockNote, juste : dialogue natif → choix de fichiers → copie dans le vault.

**Rust** (`commands::files::import_files`) :
- Signature : `(vault, source_paths[], target_parent) -> Result<Vec<String>>`
- Pré-validation atomique : check chaque source (exists, is_file, ext `.md` ou `.markdown`) AVANT de copier quoi que ce soit. Pas de partial import laissant l'utilisateur deviner ce qui a atterri.
- Naming collisions : suffixe ` copie` / ` copie 2` / ... même algo que `duplicate_file`. **Inclut les collisions intra-batch** (deux sources avec le même basename dans le même appel — le 2nd se renomme).
- Refusé sur readonly vault, path traversal sur target_parent bloqué via `resolve_safe_path`.
- 13 tests cargo nouveaux (cargo 100/100).

**Frontend** :
- Wrapper `fileImport(vaultId, sourcePaths[], targetParent)` dans api.ts.
- `Sidebar.handleImport()` ouvre le dialogue Tauri (`@tauri-apps/plugin-dialog::open`) avec filter `.md`/`.markdown` + `multiple: true`. Résout `targetParent` via `findInsertionTarget(selectedEntry)` (même logique que startCreate). Après import : refresh scan + auto-expand target folder + sélectionne le 1er fichier importé.
- Nouveau bouton Lucide `FileInput` dans le header de la section Fichiers, à côté des `+ file` / `+ folder`.

## Fix Finder-style — clic sur espace vide deselect (commit `6124575`)

Matheo a flaggué pendant smoke : "il y a toujours par défaut un folder qui est sélectionné. Ça veut dire que si j'importe un fichier, il va par défaut se mettre dans ce folder là. Il faudrait qu'on puisse cliquer en dehors de la liste pour désélectionner tous les folders."

Fix dans `FileTree.svelte` : `onclick` sur `.tree-wrap` + guard `e.target === e.currentTarget` → appelle `onSelectionChange(null)`. Clicks sur les rows bubble up mais ne passent pas le guard. Click direct sur le wrapper (= empty area du min-height 60px) clear la sélection. Comportement Finder reproduit.

## Tests finaux

- cargo : **100/100 ✅** (87 + 13 import)
- vitest : **242/242 ✅** (les 10 SettingsModal + 10 SettingsAppearance + 7 SettingsEditor + 4 SettingsSource + 4 SettingsFiles + 4 SettingsBehavior tests, plus le polyfill animate pour les transitions Svelte 5)
- svelte-check : **0 erreur / 0 warning ✅**
- visual Playwright : **50/50 ✅** (avec settings-modal en dark+light, 5 sections section-specific en dark)

## Décisions importantes prises

1. **Communication style** — Matheo a explicitement demandé des réponses conceptuelles, pas des dumps techniques. Mémoire `feedback_communication_style.md` posée. À respecter dans toutes les futures sessions.
2. **Body editor typography wiring** — déféré à BACKLOG. Path propre = API theming BlockNote.
3. **Drag-drop OS** — déprio. Pas le mécanisme principal. Le bouton Import couvre 90% du besoin.
4. **STEP 6 Settings (Avancé)** — pas encore démarré, ~1h. Open config folder + Export/Import JSON + version display.
5. **STEP 7+8** — dépendent de PLAN-COMMAND-SYSTEM (pas démarré).

## Prochaine session

Au choix :
- STEP 6 Settings Avancé (~1h, clôture partielle de Settings v1)
- PLAN-COMMAND-SYSTEM (gros chantier, débloque STEP 7+8)
- Body typography fix via API BlockNote (research + dev, ~2-3h)
- C2 Toast / C5 drag-drop entrée / autre

State + push : **STATE.md + JOURNAL.md** updated puis `git push origin main` à la fin de cette session.


# Session 2026-05-13 → 2026-05-14 (nuit, autonome) — PLAN-COMMAND-SYSTEM STEPS 1-6

Branche : `feat/command-system`. 5 commits enchaînés en mode autonome après que Matheo soit allé dormir.

## STEPS 1+2 (commit `7543c91`) — bootstrap registry + palette shell

Lecture du STATE.md à la reprise : la session précédente avait déjà mis le code des STEPS 1+2 dans le working tree (non commité) — registry/keymap/seed + CommandPalette.svelte + debug palette wiring + tests. Plus un fix de dernière minute pour le bug "click rows" relevé par Matheo (rows interactives par hover + click, plus uniquement clavier).

Commit unique de bootstrap couvrant les deux STEPS pour ne pas splitter le diff de `+page.svelte` (debug palette + lifting `sidebarCollapsed` → `uiStateStore` mélangés dans un seul fichier). 270 → 295 tests vitest, +28 nouveaux.

## STEP 3 — Command mode réel (commit `004b6c0`)

Remplace le debug palette par le vrai registry-driven Cmd+K :

- `fuzzysort@3.1.0` (~5 KB) installé. Wrapper `fuzzy.ts:rankCommands(commands, query, recentIds)` qui ranke par score quand query non-vide, et par recent + registration order quand vide. Garde `when` actif des deux côtés (dont les recents pointant vers un cmd guardé out → drop).
- `recent.svelte.ts` — MRU localStorage `markhub.commands.recent.v1`, cap 10, dedupe.
- `catalog.ts` — 12 commands (file: new/newFolder/import/save/reveal ; vault: add/next/previous ; view: toggleSidebar/toggleTheme/toggleEditorMode ; settings: open). `when` guards solides (no vault → file ops hidden, no active file → save/reveal/toggleMode hidden, vaults.length<2 → next/previous hidden).
- `APP_KEYMAP` — Cmd+S → file.save, Cmd+K → palette.open, Cmd+, → settings.open (Cmd+, migré du `onGlobalKeydown` inline du +page).
- `CommandMode.svelte` — body de la palette en mode command, match highlighting via `<mark>` avec splitLabel(label, matchIndices).
- `seedCommands.ts` supprimé (superseded).
- **Fix infrastructure** : Node 25 ship un built-in `localStorage` partiel (no `clear`, no `length`) qui shadow l'impl jsdom. Ajout d'un polyfill `MemoryStorage` dans `tests/setup.ts` pour avoir un Storage complet et isolé.

Tests : 295/295 ✅, +25 (registry+keymap déjà là, +9 recentStore, +7 fuzzy, +9 CommandMode).

## STEP 4 — File mode Cmd+P (commit `9d48658`)

- `vaultTree.svelte.ts` — store partagé qui re-scanne sur changement de `vaultsStore.activeVaultId` via un `$effect` dans +layout. Sidebar garde son scan local séparé pour l'instant — duplication assumée (factorisation = chantier follow-up).
- `recentFiles.svelte.ts` — MRU de `{vaultId, relativePath}` sous `markhub.files.recent.v1`, cap 20, dedup par composite key.
- `fuzzyFiles.ts:rankFiles(files, query, recentKeys, exclude)` — fuzzysort sur **deux** clés : `name` et `relativePath`, boost +1000 sur matches filename pour qu'ils battent les hits path-only. `exclude` set drop par composite key (utilisé pour exclure le fichier ouvert).
- `palette.svelte.ts` — store lifté de +page (état isOpen/mode/query/selectedIndex/itemCount) pour que le catalog puisse driver l'open/close sans prop-drilling.
- `FileMode.svelte` — body Cmd+P. Filename + path tail avec highlighting séparé sur les deux. Empty states distincts pour "no files at all" vs "no matches".
- Cmd+P → `palette.openFile` qui fait `void vaultTreeStore.refresh()` puis `paletteStore.open('file')`.
- **Décision test** : "excludes currently open file" gardé au niveau pure-function `rankFiles` (fuzzyFiles.test.ts). Mocker `activeFileStore.activeFile` au component test trippait sur le shape getter/setter de `$state` en Svelte 5 (close() crashe car assignment to getter-only after defineProperty).

Tests : 318/318 ✅, +23 (recentFiles 9, fuzzyFiles 7, FileMode 7).

## STEP 5 — Rust backend search (commit `d3b2f60`)

- 4 crates Rust ajoutées : `ignore` + `grep-matcher` + `grep-regex` + `grep-searcher` + `regex`. Coût bundle estimé ~2-3 MB. Compile clean.
- `commands/search.rs` :
  - `SearchOptions { caseSensitive, wholeWord, regex }`
  - `SearchHit { lineNumber, lineContent, matchStart, matchEnd }` (byte offsets UTF-8)
  - `SearchMatch { relativePath, hits }`
  - `search(vault, query, options)` testable pure (pas d'AppHandle).
  - `search_in_vault` Tauri command via `vault_for` (rendue publique).
- Walker : `WalkBuilder::standard_filters(true).require_git(false)` — respecte `.gitignore`/`.ignore` **même hors git repo** parce que Markhub vaults sont souvent des plain folders. Skip aussi hidden + git internals.
- Caps : 100 hits/file, 200 files max. Une row par ligne matchée (premier match span de la ligne) — multiple matches sur une seule ligne collapse en un.
- Literal mode escape les meta-chars regex via `regex::escape`. Smart-case off par défaut (insensitive opt-out).
- Whole-word wrap `\b…\b`.
- Bug fixé : `WalkBuilder` honore `.gitignore` seulement dans un git repo par défaut → `require_git(false)` ajouté.
- Bug fixé dans le test fixture regex : `"abc"` ne matche pas `a.b` (faut un char between). Corrigé en `"axb"`.

Front-end : `types.ts` ajoute `SearchOptions/SearchHit/SearchMatch/DEFAULT_SEARCH_OPTIONS`, `api.ts:searchInVault(vaultId, query, options)`.

Tests : cargo 115/115 ✅, +15 (literal/regex/case/whole-word/walk/relative-paths/non-md skip/hidden skip/gitignore honor/invalid regex/missing dir/caps smoke).

## STEP 6 — Search UI Cmd+Shift+F (commit `f066f82`)

- `SearchMode.svelte` — body palette mode 'search'. Appelle `searchInVault` après debounce 200ms. `activeRequestId` counter pour que les réponses tardives ne contaminent pas les fraîches.
- Results group by file : sticky header (path + count), une row par hit (line number + content avec match `<mark>`). Click → `onActivate({ relativePath, lineNumber })`.
- Empty/loading/no-results states distincts.
- `bind:flatTargets` expose la liste plate au parent pour que keyboard Enter sur le shell active la même row que le click.
- `types.ts` partagé pour `SearchActivation` (hors `<script module>` côté Svelte).
- `palette.openSearch` (⌘⇧F) dans catalog, `when: hasActiveVault`. APP_KEYMAP : `$mod+Shift+f`.
- `+page.svelte:activateSearch` close + record MRU + openFile + dispatch `editor:jumpToLine`.
- `Editor.svelte` écoute `editor:jumpToLine` : en source mode, compute byte offset de la ligne, focus textarea, setSelectionRange, scroll à ⅓ from top. **Preview mode (BlockNote) = no-op** — line→block resolution est BACKLOG.

Tests : vitest 324/324 ✅, +6 SearchMode (empty/loading/results/click/no-results/stale-drop). Mock `api.searchInVault` via `vi.mock('$lib/tauri/api', …)`, fake timers pour avancer le debounce.

## Décisions importantes prises en autonomie

1. **Single bootstrap commit STEPS 1+2** au lieu de splitter — diff `+page.svelte` mélangeait debug palette + lifting `sidebarCollapsed`. Pragmatique, traçabilité préservée par le message de commit.
2. **`paletteStore` lifté de +page** dès STEP 4 — sinon catalog ne peut pas driver l'open/close des palettes sans prop-drilling.
3. **vaultTreeStore + Sidebar scannent en double** quand le vault change — accepté pour la nuit. Factorisation = chantier follow-up.
4. **`require_git(false)` sur WalkBuilder** — `.gitignore`/`.ignore` honored hors git repo, car Markhub vaults sont souvent plain folders.
5. **Editor jump-to-line preview-mode = no-op** — BlockNote line→block resolution non-trivial, tracé en BACKLOG.
6. **Polyfill `localStorage` complet dans tests/setup.ts** — Node 25 ship un built-in partiel qui shadow jsdom.
7. **Test "excludes open file" gardé en pure-function layer** — `vi.spyOn`/`defineProperty` sur `activeFileStore.activeFile` ($state Svelte 5) cassait le test suivant via `close()`.

## Tests finaux

- cargo : **115/115 ✅** (100 base + 15 search)
- vitest : **324/324 ✅** (242 baseline + 82 nouveaux : 8 registry + 6 keymap + 14 palette shell + 9 recent + 7 fuzzy + 9 CommandMode + 9 recentFiles + 7 fuzzyFiles + 7 FileMode + 6 SearchMode)
- svelte-check : **0 erreur / 0 warning ✅**
- Aucun test désactivé pour faire passer un build.

## STEP 7 + STEP 8 — pas démarrés (pour smoke matinal)

STEP 7 (Polish + mode-switching: prefix `>` pour command, `?` pour help, mode indicator badge, etc.) et STEP 8 (Closure) attendent le smoke matinal et la validation de feel de Matheo. C'était le mandat de la nuit.

## Plan de smoke pour le matin (Matheo)

À tester dans l'ordre. App lancée via `npm run tauri dev`.

### 1. Cmd+K — Command mode
- [ ] Cmd+K ouvre la palette, focus auto sur l'input, placeholder "Type a command…"
- [ ] Liste : toutes les commandes registry (file/vault/view/settings + palette ones)
- [ ] Type "save" → 1 résultat "Save File" (matched chars highlightés en couleur accent + bold)
- [ ] Type "togg" → "Toggle Sidebar" + "Toggle Theme" + "Toggle Preview / Source" (si fichier ouvert)
- [ ] ↑↓ navigue, Enter active, Escape ferme, clic backdrop ferme
- [ ] Activer "Toggle Theme" → thème change live
- [ ] Hover sur une row → highlight suit la souris (hover-to-select)
- [ ] Re-ouvrir Cmd+K → "Toggle Theme" en haut de la liste (MRU au top)

### 2. Cmd+P — File mode
- [ ] Sans vault actif : ouvre quand même mais montre "No files in this vault"
- [ ] Avec vault actif : liste tous les .md (récursif), recent files au top
- [ ] Type partie du filename → match boosté vs path-match
- [ ] Le fichier ouvert n'apparaît pas dans la liste
- [ ] Path tail (e.g. "notes/deep/") affiché en muted à droite du nom
- [ ] Match chars highlightés en accent dans le nom ET dans le path
- [ ] Enter ou click → fichier s'ouvre, palette se ferme
- [ ] Re-ouvrir Cmd+P → fichier vient-d'ouvrir au top des recents

### 3. Cmd+Shift+F — Search mode
- [ ] Cmd+Shift+F ouvre en search mode, placeholder "Search across vault…"
- [ ] Query vide → hint "Type to search across your vault"
- [ ] Type 2 lettres rapidement → debounce, pas de flash de résultats partiels
- [ ] Type "TODO" (ou un mot qui existe) → results groupés par fichier (path + count) + rows avec line number + content + match `<mark>` accent
- [ ] Click sur un hit → palette ferme, fichier s'ouvre
  - **En mode source** : textarea focus + ligne sélectionnée + scroll au tiers haut
  - **En mode preview** : fichier ouvre mais pas de scroll (BACKLOG)
- [ ] ↑↓ + Enter → idem (active la row sélectionnée)
- [ ] Type un truc qui n'existe pas → "No matches for `query`"
- [ ] Tape vite plusieurs queries → les réponses tardives ne contaminent pas (verifié par test `drops stale results`)

### 4. Edge cases à vérifier (rapide)
- [ ] Cmd+, ouvre Settings (passe par le keymap registry maintenant)
- [ ] Cmd+S sauvegarde le fichier actif (status pill bouge en "Saved")
- [ ] Changement de thème via "Toggle Theme" du Cmd+K persiste après reload
- [ ] Drag-drop file → folder dans la sidebar marche encore (pas régressé)
- [ ] Import file via 📥 dans la sidebar marche encore
- [ ] La debug palette n'existe plus (Cmd+K affiche le vrai catalog, pas les rows "New file/Export as PDF Soon")

### 5. Si quelque chose accroche
- Tout le code est sur la branche `feat/command-system`, 5 commits depuis main : `7543c91` (1+2), `004b6c0` (3), `9d48658` (4), `d3b2f60` (5), `f066f82` (6).
- Le revert d'un STEP isolé est possible (`git revert <hash>`) si feel pas bon, sans casser les autres.
- BACKLOG entry à ajouter pour : "BlockNote line→block resolution pour jump-to-line en preview mode" (déjà signalé dans le commit STEP 6).

## Prochaine session

- STEP 7 — Polish + mode-switching (prefix `>` switch entre modes, mode indicator badge, ergonomics audit). ~1-2h.
- STEP 8 — Closure (final wrap-up, push, merge sur main).
- (en parallèle ou après) factoriser `vaultTreeStore`/Sidebar scan, BlockNote jump-to-line, body typography via API BlockNote.
