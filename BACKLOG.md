# Markhub — BACKLOG

Idées et raffinements identifiés pendant le développement, mais hors-scope MVP (SPEC.md §3.6) ou différés à plus tard.

## Idées identifiées en cours de dev

### Phase 5
- **Panneau de settings vault** — alternative au menu contextuel pour exposer rename / toggle mode / change color, plus extensible (futur : custom icon, ordering).
- **Color picker custom** dans le menu contextuel d'un vault — permettre à l'utilisateur de choisir explicitement la couleur au lieu de la rotation auto.
- **Réordonner les vaults** par drag-and-drop dans la sidebar.

### Phase 1
- ~~Palette rotative pour `Vault.color`~~ — **fait en Phase 5** : `src/lib/utils/palette.ts` avec rotation `pickNextColor(vaults.length)`. Reste à backlog : color picker custom (voir Phase 5 ci-dessus).

## Hors-scope MVP (gelé, ne pas démarrer)
- Recherche full-text cross-vaults
- Frontmatter parsing/UI dédiée (édition champ par champ — on rend juste le bloc en MVP)
- Tags, backlinks, graph view
- Plugins, thèmes custom utilisateur
- Sync, multi-fenêtres
- Drag-drop de fichiers entre vaults
- **Drag-drop de fichiers entre dossiers** (intra-vault) — la création contextuelle MVP couvre la création, pas le déplacement.
