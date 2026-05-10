# Markhub — BACKLOG

Idées et raffinements identifiés pendant le développement, mais hors-scope MVP (SPEC.md §3.6) ou différés à plus tard.

## Idées identifiées en cours de dev

### Phase 5
- **Panneau de settings vault** — alternative au menu contextuel pour exposer rename / toggle mode / change color, plus extensible (futur : custom icon, ordering).
- **Color picker custom** dans le menu contextuel d'un vault — permettre à l'utilisateur de choisir explicitement la couleur au lieu de la rotation auto.
- **Réordonner les vaults** par drag-and-drop dans la sidebar.

### Phase 1
- ~~Palette rotative pour `Vault.color`~~ — **fait en Phase 5** : `src/lib/utils/palette.ts` avec rotation `pickNextColor(vaults.length)`. Reste à backlog : color picker custom (voir Phase 5 ci-dessus).

## Phase 7 — block manipulation Notion-like (custom ProseMirror plugins)
Crepe ne fournit PAS nativement les comportements suivants — investigué dans le source `block-edit/index.js:1042-1135` et `components/table-block/view/operation.d.ts` (cf. session 2026-05-10).

- **Block transform menu au click sur ⋮⋮** — Crepe rend la `.operation-item` du ⋮⋮ sans aucun handler. Pour avoir un menu Notion-like de transformation au click (Heading/List/Quote/Code/etc.), il faut un plugin custom qui intercepte le mousedown, place le caret dans le block parent, et ouvre le slash menu en mode "transform" (l'`onRun` actuel utilise déjà `setBlockType` → transformation, mais il faut wire le menu sur le ⋮⋮). Estimation : 3-4h.
- **Drag-and-drop pour réorganiser les blocks** — Crepe ne wire AUCUN drag handler. HTML5 dragstart/dragend + manipulation de transaction ProseMirror. Estimation : 2-3h. (À ne pas confondre avec le drag-drop fichiers→dossier de la sidebar, qui est livré.)
- **Column resize sur tables** — `prosemirror-tables` (upstream) fournit un plugin `columnResizing` officiel ; Crepe ne l'active pas. Probablement installable comme plugin Milkdown supplémentaire au-dessus de Crepe. Estimation : 2-3h, attention à la compat avec le plugin `tableEditing` que Crepe customise déjà.

## Hors-scope MVP (gelé, ne pas démarrer)
- Recherche full-text cross-vaults
- Frontmatter parsing/UI dédiée (édition champ par champ — on rend juste le bloc en MVP)
- Tags, backlinks, graph view
- Plugins, thèmes custom utilisateur
- Sync, multi-fenêtres
- Drag-drop de fichiers entre vaults
- ~~**Drag-drop de fichiers entre dossiers** (intra-vault)~~ — **livré en Phase 6 (session autonome 2026-05-09T19:38)**. HTML5 native drag, MIME `application/x-markhub-path`, drop sur folder rows ou root, opacity 0.5 sur le source + accent-tint sur la drop zone, désactivé en readonly, follow l'onglet ouvert si déplacé. Pas de test Playwright automatique (dispatchDrop fragile) — smoke test interactif requis.
- Réordonner manuellement des fichiers / dossiers (interface de tri custom au-delà de l'alphabétique) — backlog post-MVP.
