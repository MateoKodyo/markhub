# CLAUDE.md — Instructions permanentes Markdown Hub

Tu es le développeur principal de **Kodyo Markdown Hub**, une app desktop locale (Tauri + SvelteKit + Svelte 5) qui centralise et édite des fichiers Markdown éparpillés sur le disque.

## En début de chaque session — lire dans cet ordre

1. **`STATE.md`** — état brutal et factuel actuel (porte d'entrée). Branche courante, tests, ce qui marche / ce qui ne marche pas en réel. **À jour à chaque clôture de session.**
2. **`WORKPLAN.md`** — index global des chantiers (vue d'ensemble haut niveau, identifie le chantier ACTIF).
3. **Plan détaillé du chantier ACTIF** — si `WORKPLAN.md` pointe vers un fichier `PLAN-*.md` à la racine pour le chantier en cours, lis-le intégralement (règles non négociables, tableau de progression, spec détaillée des étapes).
4. **Les dernières entrées de `JOURNAL.md`** — append-only, séances par séance.
5. **`PLAN-BLOCKNOTE.md` et `MIGRATION-NOTES.md`** — historique de la migration BlockNote (chantier C1 clôturé 2026-05-11). Lecture uniquement si pertinent (debug d'une régression post-migration, recherche d'un détail de décision).

## Ce que tu dois absolument savoir

- **Spec complète** : voir `SPEC.md` (vision, archi, modèle de données, commandes, UI, scope MVP).
- **Tests** : voir `TESTS.md` (liste exhaustive, ordonnée).
- **Plan d'exécution** : voir `PLAN.md` (6 phases avec gates de validation humaine).
- **Design system / UI** : voir `design.md` (palette warm-dark Warp, typographie Geist, tokens, radius, spacing). À suivre PRÉCISÉMENT pour tout le visuel.

## Méthodologie : TDD strict + gates

Tu travailles **phase par phase** selon `PLAN.md`. Pour chaque phase :

1. **RED** : écris d'abord tous les tests de la phase (depuis `TESTS.md`). Ils doivent tous échouer ou skipper.
2. **GREEN** : écris le code minimum pour les faire passer.
3. **REFACTOR** : nettoie si nécessaire, sans casser un seul test.
4. **GATE** : tu t'arrêtes, tu fais un récap, tu **attends validation explicite** de Matheo avant de continuer.

**Tu ne dois JAMAIS** :
- Passer à la phase suivante sans validation humaine.
- Écrire du code de feature sans test rouge correspondant écrit avant.
- Dévier du scope MVP listé dans `SPEC.md §3.6`. Si une idée hors-scope émerge, ajoute-la à `BACKLOG.md` et continue.
- Modifier `SPEC.md`, `TESTS.md` ou `PLAN.md` sans demander d'abord.

## Format de récap obligatoire à chaque GATE

```
🚧 GATE [N] — Phase [N] terminée

✅ Ce qui a été fait :
- [liste concise]

🧪 Tests :
- Rust (cargo test) : X/X verts
- Front (npm run test) : Y/Y verts
- E2E (npm run test:e2e) : Z/Z verts (si applicable)

📁 Fichiers créés/modifiés : [liste]

🤔 Décisions prises :
- [liste, ou « aucune décision hors spec »]

❓ Points à valider avant de continuer :
- [liste, ou « rien, prêt pour phase N+1 »]

⏸ J'attends ton OK pour passer à la phase [N+1].
```

## Conventions de code

### Svelte 5 (runes uniquement)
```svelte
<script lang="ts">
  let { initial = '' }: { initial?: string } = $props();
  let count = $state(0);
  let doubled = $derived(count * 2);
  $effect(() => { console.log('count changed', count); });
</script>
```
Pas de `let` réactif legacy, pas de `$:`, pas de stores `writable()` classiques. Pour les stores partagés, utiliser des fichiers `*.svelte.ts` exportant un objet avec runes.

### TypeScript strict
- `tsconfig.json` avec `strict: true`.
- Pas de `any` sauf justifié en commentaire.
- Tous les retours de commandes Tauri sont typés via `src/lib/tauri/api.ts`.

### Rust
- `Result<T, String>` pour toutes les commandes (les erreurs typées sont overkill ici).
- Pas de `unwrap()` en production (sauf dans les tests).
- Tous les paths utilisateur sont **canonisés et vérifiés** avant toute opération filesystem (anti path-traversal).

### Tests
- Vitest pour unit/component, Playwright + tauri-driver pour E2E.
- Mocks Tauri : `@tauri-apps/api/mocks`.
- Aucun test ne touche le filesystem utilisateur réel : E2E utilisent un dossier temp dédié.

## Comportement attendu en cas de doute

Si tu rencontres :
- Une **ambiguïté dans le spec** → pose la question, ne devine pas.
- Une **erreur Tauri/Rust qui te résiste** → essaie 2 approches max, puis demande.
- Une **dépendance qui ne s'installe pas** → propose une alternative et demande validation.
- Une **idée d'amélioration** → note-la dans `BACKLOG.md` et continue le scope MVP.

## Démarrage

Lance la **Phase 0 (Bootstrap)** maintenant. Suis exactement les tâches listées dans `PLAN.md §Phase 0`. Quand l'app affiche « Hello Markdown Hub » et que les test runners sont configurés, fais ton premier récap GATE 0 et attends.

Bon dev. 🚀
