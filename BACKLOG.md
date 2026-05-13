# Markhub — BACKLOG

Idées et raffinements identifiés pendant le développement, mais hors-scope MVP (SPEC.md §3.6) ou différés à plus tard.

## Idées identifiées en cours de dev

### Flash blanc au resize de la fenêtre (2026-05-14)
- Quand on redimensionne la fenêtre Markhub, une bande blanche apparaît brièvement au bord bas et droit pendant que le WebView re-rend. Tentatives reverted :
  - `tauri.conf.json` → ajout de `"backgroundColor": "#0a0908"` au window config. Le schéma Tauri 2 accepte le format hex, mais sur macOS + `titleBarStyle: "Overlay"` le param semble ne pas atteindre le CALayer du WKWebView.
  - `lib.rs` setup → `window.set_background_color(Some(tauri::webview::Color(10, 9, 8, 255)))` au runtime. Compile OK mais effet visuel identique.
- Cause probable : le NSWindow a bien notre couleur, mais pendant l'animation de resize macOS, c'est le WKWebView qui peint en blanc tant que la frame layout n'a pas convergé. Faut probablement attaquer via objc côté Rust pour set le CALayer backgroundColor directement (ou utiliser `WebViewConfiguration` au moment de la création).
- Non bloquant pour MVP — l'effet est bref. Reprendre quand on a un focus visuel/polish.

### PLAN-COMMAND-SYSTEM — follow-ups post-clôture (2026-05-14)

- **`askBeforeClosingUnsaved` setting maintenant redondant** — `activeFile.openFile()` flush son pending save inconditionnellement (commit `b3069da`, fix du bug "checkbox non persistée"). Le toggle dans Settings n'a plus d'effet. À retravailler : soit le supprimer + clarifier le contrat "autosave + flush forcé au switch", soit le repenser pour proposer un vrai modal "Sauvegarder / Ignorer / Annuler" comme dans VS Code.
- **`editor:jumpToLine` no-op en preview mode** — STEP 6 Search → click sur un hit ouvre le fichier mais le scroll n'arrive qu'en source mode. En preview (BlockNote), faut résoudre `lineNumber` → block correspondant. Non trivial : BlockNote n'expose pas de map ligne-markdown → block id. Option pragmatique : ouvrir en source mode si le hit vient de Search.
- **Double scan vaultTreeStore ↔ Sidebar** — chaque switch de vault déclenche deux walks indépendants (Sidebar pour son arbre interne, vaultTreeStore pour Cmd+P). Coût ~50ms gaspillé par switch. Factorisable : Sidebar consomme vaultTreeStore.root + diffuse via les mêmes API.
- **`SearchOptions` UI hardcodée** — `DEFAULT_SEARCH_OPTIONS` (case off, whole-word off, regex off) passé en dur. À exposer : 3 toggles compacts en footer de SearchMode, persistés en localStorage.

### Export du fichier courant (idée 2026-05-13, hors scope MVP)
- **Export as Markdown** — commande palette qui propose un export "Save As…" du fichier courant (utilisable pour copier hors-vault). Comportement attendu : dialog natif Tauri `save` filtré `.md`, écrit le contenu actuel à l'emplacement choisi. Triviale techniquement.
- **Export as PDF** — commande palette qui rend le markdown courant en PDF. Plus de travail : pipeline de rendu (puppeteer ? wkhtmltopdf ? `printable_web_view` Tauri ?). Décision techno à instruire en propre.
- **UI shells déjà posés** dans la debug palette de STEP 2 (commandes désactivées avec badge "Soon"). Les retirer / les câbler en vrai dans un chantier dédié post-MVP.

### Settings v1 — wiring différé
- **Appliquer `appearance.editorFontSize` + `editorLineHeight` au body de l'éditeur** — STEP 3 livre le store + le modal + le live preview dans le modal. Le wiring DANS BlockNote a été tenté en STEP 3+ et reverté le 2026-05-12 nuit (commit `b2c19d2`) : BlockNote applique son propre cascade sur `.bn-default-styles`, `.bn-block-outer` et `.bn-block-content[data-content-type=...]`, et nos overrides CSS + JS-DOM + MutationObserver ont fini par freezer l'éditeur. **Chemin propre = passer par l'API de theming / styling de BlockNote** (le fichier `editor-blocknote.css` utilise déjà ses variables `--bn-*` propres, c'est probablement la bonne porte). Ce qui MARCHE déjà live : theme, font family du chrome heading (via `--font-editor`), content width, autosave delay, spellcheck, mono font. Reste : body font-size + body line-height.

### Phase 5
- **Panneau de settings vault** — alternative au menu contextuel pour exposer rename / toggle mode / change color, plus extensible (futur : custom icon, ordering).
- **Color picker custom** dans le menu contextuel d'un vault — permettre à l'utilisateur de choisir explicitement la couleur au lieu de la rotation auto.
- **Réordonner les vaults** par drag-and-drop dans la sidebar.

### Phase 1
- ~~Palette rotative pour `Vault.color`~~ — **fait en Phase 5** : `src/lib/utils/palette.ts` avec rotation `pickNextColor(vaults.length)`. Reste à backlog : color picker custom (voir Phase 5 ci-dessus).

## Phase 7 — block manipulation Notion-like (résolu via migration BlockNote)

- ~~**Block transform menu au click sur ⋮⋮**~~ — **livré 2026-05-10 (Crepe), re-livré nativement via BlockNote SideMenu plugin + composant `BlockNoteSideMenu.svelte` (commit `31193c6`, étape 2.5.c)**. Sub-menu : Texte / Titre 1-3 / Liste à puces / Liste numérotée / Citation / Bloc de code.
- ~~**Drag-and-drop pour réorganiser les blocks**~~ — **livré 2026-05-10 (Crepe), re-livré nativement via BlockNote SideMenu + DropCursor plugins (commits `31193c6`, `21ac2ee`)**. Drag fluide, drop indicator natif accent-tinted.
- ~~**Column resize sur tables**~~ — **livré nativement via `prosemirror-tables` que BlockNote inclut (`.column-resize-handle`, stylé par `editor-blocknote.css` en accent)**. Drag des frontières de colonne fonctionne out-of-the-box.
- **Block menu enrichi (Color / Copy link to block / Move to / etc.)** — items du menu Notion qui dépassent le besoin Markhub MVP. BlockNote expose les `textColor`/`backgroundColor` props nativement mais on ne les a pas câblées en MVP (markdown standard ne les supporte pas). "Copy link to block" demande un système d'ancres permanents. "Move to" n'a pas de sens (Markhub édite des fichiers .md plats). À évaluer après usage du MVP.

## Hors-scope MVP (gelé, ne pas démarrer)
- Recherche full-text cross-vaults
- Frontmatter parsing/UI dédiée (édition champ par champ — on rend juste le bloc en MVP)
- Tags, backlinks, graph view
- Plugins, thèmes custom utilisateur
- Sync, multi-fenêtres
- Drag-drop de fichiers entre vaults
- **Gestion des images dans l'éditeur** — BlockNote propose nativement un bloc Image avec panneau Upload/Embed/Browse via une fonction `uploadFile` à fournir. À trancher post-MVP migration :
  - **Stratégie A** : URLs externes uniquement (pas de `uploadFile`, l'utilisateur ne peut coller que des liens HTTPS). MVP zero-effort, mais pas de paste d'image / screenshot.
  - **Stratégie B** : drop/paste sauvegardé dans un dossier `<filename>.assets/` à côté du `.md` (style Obsidian). URL relative dans le markdown. Implique une commande Rust Tauri pour écrire le fichier.
  - **Stratégie C** : dossier `_assets/` centralisé à la racine du vault.
  - Markhub étant un agrégateur de markdowns dev (pas un Notion / pas un PKM visuel), l'usage des images sera marginal. Stratégie A probable pour shipper, B à évaluer après feedback usage réel.
- ~~**Drag-drop de fichiers entre dossiers** (intra-vault)~~ — **livré en Phase 6 (session autonome 2026-05-09T19:38)**. HTML5 native drag, MIME `application/x-markhub-path`, drop sur folder rows ou root, opacity 0.5 sur le source + accent-tint sur la drop zone, désactivé en readonly, follow l'onglet ouvert si déplacé. Pas de test Playwright automatique (dispatchDrop fragile) — smoke test interactif requis.
- Réordonner manuellement des fichiers / dossiers (interface de tri custom au-delà de l'alphabétique) — backlog post-MVP.
