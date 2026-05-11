# Markhub — BACKLOG

Idées et raffinements identifiés pendant le développement, mais hors-scope MVP (SPEC.md §3.6) ou différés à plus tard.

## Idées identifiées en cours de dev

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
