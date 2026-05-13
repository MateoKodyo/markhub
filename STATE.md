# STATE — état brutal et factuel du projet

> Porte d'entrée pour reprise de session. Lecture obligatoire avant tout.
> Pas de récap de progrès, pas d'optimisme. Faits seulement.

## Date de mise à jour

2026-05-14 (après-midi) — session collaborative continue depuis le matin. Bilan :

- **PLAN-COMMAND-SYSTEM 8/8 ✅ MERGÉ + PUSHÉ** sur `origin/main`.
- **Outline panel V1 ✅** — `Cmd+\\` + bouton `PanelRight` dans le header éditeur. Click sur un heading → scroll source-mode (réutilise jump-to-line) OU preview-mode (via BlockNote `editor.document` walk + `scrollIntoView`).
- **Token estimate StatusBar ✅** — pill cycle words → chars → ~tokens (heuristique `chars / 4`, prefixed "~").
- **PLAN-SETTINGS STEPS 6/7/8 livrés** (smoke pending) — Advanced section + 6 section deep-link commands + closure docs.
- **Body typography fix** — TENTÉ via remount (commit `a8bbc41` + `!important` hammer) puis REVERTED (`e95f058`). N'a pas tenu en réel. Décision Matheo : laisser tomber, BACKLOG. Preview live dans le modal continue de marcher ; l'éditeur reste à 15px/1.6.
- **Drag-drop dossier sidebar fixé** + 4 bugs BlockNote (slash menu /query persistant, "Liste à cocher" manquante, edit perdu au switch, checkbox visuelle sobre).
- Tentative `backgroundColor` au resize → reverted, tracé en BACKLOG (WKWebView macOS).

## Branche courante

`main` — **5 commits ahead de `origin/main`** depuis le dernier push (`47693f9`). Push à faire quand Matheo veut.

Commits depuis le dernier push (du plus ancien au plus récent) :

```
189098d feat(status-bar): rough token estimate in the count cycle
0ab0098 feat(outline): toggleable TOC panel on the right (Cmd+\\)
47693f9 feat(editor): icon-only mode toggle + Outline button next to it  ← dernier push
fead47e docs(backlog): track the resize white-flash issue as deferred
a8bbc41 feat(settings): body typography wiring via apply-on-commit remount
58b33c5 feat(settings): advanced section + section deep-links (STEPS 6 + 7)
[closure] chore(state): closure PLAN-SETTINGS — handoff docs refresh
```

## Tests (état final)

- cargo : **120/120 ✅** (115 + 5 nouveaux pour STEP 6 settings backend)
- vitest : **350/350 ✅** (339 + 11 nouveaux pour outline + token)
- svelte-check : **0 erreur / 0 warning ✅**
- Aucun test désactivé.

## Chantiers

| Chantier | Statut |
|---|---|
| C1 — Migration Crepe → BlockNote | ✅ MERGÉ sur `main` (2026-05-11) |
| PLAN-DESIGN-DEFAULTS (10 steps) | ✅ MERGÉ sur `main` (2026-05-12) |
| **PLAN-SETTINGS (8 steps)** | **✅ 8/8 code livré, smoke audit pending** |
| Folder-delete EPERM | ✅ FIXÉ + smoke OK |
| Import de fichiers markdown | ✅ LIVRÉ 2026-05-13 |
| PLAN-COMMAND-SYSTEM (8 steps) | ✅ MERGÉ + PUSHÉ sur `origin/main` (2026-05-14) |
| Drag-drop sidebar — dossier + visual root drop | ✅ FIXÉ 2026-05-14 |
| Outline panel V1 (sommaire toggleable) | ✅ LIVRÉ 2026-05-14 |
| Token estimate StatusBar | ✅ LIVRÉ 2026-05-14 |
| Body typography fix (PLAN-SETTINGS STEP 3 dette) | ✅ RÉSOLU 2026-05-14 (apply-on-commit) |
| C2 — Toast / notifications | DÉBLOQUÉ — pas démarré |
| C5 — Drag-drop OS depuis Finder | ⏳ PAS DÉMARRÉ |
| Outline V2 (rail Notion-style hover) | gelé — V1 jugé suffisant 2026-05-14 |
| Onglets de fichiers (Phase 5c) | gelé |

## Surface livrée en production (recap)

**Raccourcis globaux** :
- `Cmd+K` — palette de commandes (9 visibles + 8 méta) + prefix switching `>` `@` `#`
- `Cmd+P` — file switcher (fuzzy filename+path, MRU)
- `Cmd+Shift+F` — search vault (ripgrep-backed)
- `Cmd+\\` — toggle outline panel
- `Cmd+S` — save (hidden, via autosave + manual flush)
- `Cmd+,` — settings

**Settings** : 6 sections (Apparence, Éditeur, Source, Fichiers, Comportement, Avancé). Body font-size + line-height appliqués via remount au close du modal.

**Editor** : Preview / Source (icônes) + Outline (toggle). Drag-drop dossier dans la sidebar. Checkboxes sobre sans strikethrough.

## Smoke pending (à faire par Matheo)

PLAN-SETTINGS STEP 6/7/8 :
- Open config folder → ouvre bien Finder au bon path
- Export : sauve un JSON valide
- Import : charge un JSON valide ET rejette un malformed
- Round-trip : export → modifier → import → state restauré
- Version display : affiche bien `Markhub v0.1.0`
- Cmd+K → "Settings: Editor" / etc. ouvre directement à la section

Body typography :
- Open Settings → modifier fontSize ou lineHeight → préview live dans le modal
- Fermer modal → l'éditeur applique les nouvelles valeurs (un flash de remount, acceptable)

## Dettes / dépendances ajoutées par cette session

- npm : `lucide-svelte` icons utilisés (déjà installée)
- localStorage keys ajoutées : `markhub.ui.outlineOpen.v1`

## BACKLOG enrichi par cette session

Voir `BACKLOG.md` :
- **Flash blanc au resize** — WKWebView macOS, 2 tentatives reverted, à reprendre via objc
- **Outline V2** (Notion-style hover rail) — pas urgent, V1 valide la valeur
- **PLAN-COMMAND-SYSTEM follow-ups** (`askBeforeClosingUnsaved` redondant, line→block preview jump, double scan, SearchOptions UI)

## Fichiers à relire en début de prochaine session

1. `STATE.md` (ce fichier — porte d'entrée)
2. `CLAUDE.md` (méthodologie)
3. `WORKPLAN.md` (plan global)
4. **Dernière entrée de `JOURNAL.md`** (clôture session 2026-05-14)
5. `BACKLOG.md` (dettes + items différés)
6. `plan-110526/PLAN-SETTINGS.md` (tableau de progression — 8/8 code livré)

## Prochaine session

Au choix :
- **Smoke + signature PLAN-SETTINGS** (10-15 min) → fin officielle du chantier
- **PLAN-COMMAND-SYSTEM follow-ups** (`askBeforeClosingUnsaved` cleanup, line→block, SearchOptions UI) — ~2h
- **C2 Toast system** — chantier mature, ~2h
- **Outline V2** (Notion rail) — ~3h
- **Flash blanc resize** (objc CALayer) — ~1-2h research
