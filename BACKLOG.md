# Markhub — BACKLOG

Idées et raffinements identifiés pendant le développement, mais hors-scope MVP (SPEC.md §3.6) ou différés à plus tard.

## Idées identifiées en cours de dev

### Phase 5
- **Panneau de settings vault** — alternative au menu contextuel pour exposer rename / toggle mode / change color, plus extensible (futur : custom icon, ordering).
- **Color picker custom** dans le menu contextuel d'un vault — permettre à l'utilisateur de choisir explicitement la couleur au lieu de la rotation auto.
- **Réordonner les vaults** par drag-and-drop dans la sidebar.

### Phase 1
- ~~Palette rotative pour `Vault.color`~~ — **fait en Phase 5** : `src/lib/utils/palette.ts` avec rotation `pickNextColor(vaults.length)`. Reste à backlog : color picker custom (voir Phase 5 ci-dessus).

## Phase 7 — block manipulation Notion-like

- ~~**Block transform menu au click sur ⋮⋮**~~ — **livré 2026-05-10** : `Editor.svelte` intercepte click + dragstart sur le ⋮⋮ et utilise les commandes Crepe (`setBlockTypeCommand`, `wrapInBlockTypeCommand`) via `crepe.editor.action(ctx => …)`. Items : Texte / Titre 1-3 / Liste à puces / Liste numérotée / Citation / Bloc de code / Séparateur + Dupliquer + Supprimer. Header non-cliquable « Transformer en » (ContextMenu étendu avec `{ header: string }`).
- ~~**Drag-and-drop pour réorganiser les blocks**~~ — **livré 2026-05-10** : HTML5 dragstart sur le ⋮⋮, MIME `application/x-markhub-block`, dragover sur l'éditeur calcule le drop indicator (snap au boundary block via `posAtCoords`), drop applique `tr.delete + tr.insert` avec ajustement de la position si destination après source.
- **Column resize sur tables** — `prosemirror-tables` (upstream) fournit un plugin `columnResizing` officiel ; Crepe ne l'active pas. Probablement installable comme plugin Milkdown supplémentaire au-dessus de Crepe. Estimation : 2-3h, attention à la compat avec le plugin `tableEditing` que Crepe customise déjà.
- **Block menu enrichi (Color / Copy link to block / Move to / etc.)** — items du menu Notion qui dépassent le besoin Markhub MVP. Color demande un plugin de coloration de block que Crepe n'a pas. "Copy link to block" demande un système d'ancres permanents. "Move to" n'a pas de sens (Markhub édite des fichiers .md plats). À évaluer après usage du MVP.

## Hors-scope MVP (gelé, ne pas démarrer)
- Recherche full-text cross-vaults
- Frontmatter parsing/UI dédiée (édition champ par champ — on rend juste le bloc en MVP)
- Tags, backlinks, graph view
- Plugins, thèmes custom utilisateur
- Sync, multi-fenêtres
- Drag-drop de fichiers entre vaults
- ~~**Drag-drop de fichiers entre dossiers** (intra-vault)~~ — **livré en Phase 6 (session autonome 2026-05-09T19:38)**. HTML5 native drag, MIME `application/x-markhub-path`, drop sur folder rows ou root, opacity 0.5 sur le source + accent-tint sur la drop zone, désactivé en readonly, follow l'onglet ouvert si déplacé. Pas de test Playwright automatique (dispatchDrop fragile) — smoke test interactif requis.
- Réordonner manuellement des fichiers / dossiers (interface de tri custom au-delà de l'alphabétique) — backlog post-MVP.
