---

---

# Markdown Hub — Pack de spec pour Claude Code

## Comment utiliser ce pack

1. **Crée un dossier vide** pour le projet :

```bash
mkdir ~/Projects/markdown-hub
cd ~/Projects/markdown-hub
```

1. **Copie les 4 fichiers** de ce pack à la racine :

   * `CLAUDE.md` (instructions permanentes — Claude Code le lit automatiquement)

   * `SPEC.md` (vision, archi, contrat)

   * `TESTS.md` (liste des tests à écrire)

   * `PLAN.md` (phases d'exécution avec gates)

2. **Lance Claude Code** dans ce dossier :

```bash
claude
```

1. **Premier message à donner à Claude Code** :

```text
Lis SPEC.md, TESTS.md, PLAN.md et CLAUDE.md.
Confirme que tu as compris la mission et lance la Phase 0.
```

1. **Ton seul boulot** : valider à chaque GATE. Claude Code s'arrête tout seul, te montre un récap, attend ton OK. Tu réponds « ok » ou « lance la phase suivante » et il continue. Tu peux aussi tester l'app entre les phases (à partir de la phase 3) pour valider visuellement.

## Estimation temps

* Phase 0 : 30 min

* Phase 1 : 30-45 min

* Phase 2 : 1h-1h30 (la plus dense, sécurité critique)

* Phase 3 : 1h-1h30

* Phase 4 : 1h (Milkdown peut surprendre)

* Phase 5 : 1h-1h30 (E2E avec tauri-driver)

* Phase 6 (optionnelle) : 1h

**Total réaliste : 5-7h de session Claude Code, dont peut-être 1h de ta présence active aux gates.**

## Si quelque chose dérape

* Claude Code dévie du plan → réponds « relis PLAN.md, tu es à la phase X, ne saute pas d'étapes ».

* Un test ne passe pas et Claude Code patine → demande-lui de te montrer le test + le code et tranche toi-même.

* Tu veux ajuster le scope → édite `SPEC.md §3.6` et dis-le à Claude Code explicitement.
