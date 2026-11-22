# Protocole d'autorité durable des sessions desktop

## Objet

Ce document décrit l'implémentation locale du protocole d'autorité durable des
sessions desktop pour Item Fabricator (code Rust/Tauri), succ distinct de la
PR #108. Il remplace la préférence de restauration figée "magasin OS d'abord,
puis fichier de fallback" par une **autorité désignée explicitement** portée par
un registre versionné.

Ce document est une note d'implémentation et de preuves. Il ne constitue pas un
rapport d'incident et ne divulgue aucun secret.

## Références

- Carte de décision : `t_9d23ba11` (Politique B).
- Carte d'implémentation : `t_7dfed70f` (cette tâche).
- Revues indépendantes : `t_b9a5da93` ; revue indépendante requise par `tannerverifier` (`t_f30113f5`) avant toute publication.
- Recommandation normative : `RECOMMANDATION_AUTORITE_SESSION.md`.
- Base d'intégration : commit `f312ebb2` (tête de #108 vérifiée).
- Branche de travail : `fix/desktop-session-authority-protocol` (worktree isolé, local uniquement).
- Contrat : `local-only`. Aucun push, PR, merge, release ou déploiement.

## Fichiers produits

- `src-tauri/src/session_authority.rs` — protocole, `SessionAuthority`, registre
  JSON versionné, enveloppe trousseau, verrou interprocessus, remplacement
  atomique, tests unitaires R01–R17.
- `src-tauri/tests/session_authority_process.rs` — tests d'intégration
  (reprise interprocessus, purge différée, crash après pending, dernier commit
  gagnant).
- `src-tauri/src/lib.rs` — intégration : `DesktopAuthState` publie en mémoire
  uniquement après le commit durable de l'autorité ; `authorized_token()`
  revalide le cache sous verrou avant chaque émission authentifiée.
- `src-tauri/Cargo.toml` — `getrandom`, `serde_json`, `libc` déjà présents ;
- `windows-sys` ajoutée uniquement pour les cibles Windows (`cfg(windows)`,
-  features `Win32_Foundation` et `Win32_Storage_FileSystem`).

## Contrat d'autorité (décisions figées, non redécidées)

### Registre d'autorité

Un seul fichier `ItemFabricator/desktop-session.token`, registre JSON versionné
`version: 1`, exactement l'une des variantes :

- `pending{generation}` — mutation commencée, aucune session restaurable.
- `secure{generation}` — seul le trousseau OS correspondant fait autorité ; aucun jeton sur disque.
- `fallback{generation, token}` — seul ce jeton du fallback fait autorité.
- `none{}` — tombstone de déconnexion ; aucune session restaurable.

`generation` : 32 octets aléatoires, hex minuscule 64 caractères, neuve par
login, non dérivée d'un compte, d'un jeton ou d'une horloge.

Seul l'état `fallback` contient un secret (le jeton), à l'emplacement déjà
prévu pour le fichier de fallback. `secure`, `pending`, `none` sont des
métadonnées non secrètes. Aucun nouveau fichier permanent de secrets en clair.

### Enveloppe trousseau

Dans le trousseau OS (même service `space.itemfab.desktop` / utilisateur
`desktop-session`) : `{version: 1, generation, token}`. `secure` exige l'égalité
de génération et la validation du jeton. Un jeton brut ancien, une autre
génération ou une enveloppe invalide ne sont jamais acceptés.

### Lecture d'autorité d'abord

1. `fallback(g, T2)` valide → retourner T2, même si le trousseau contient T1.
   Une purge OS peut suivre ; son échec est un nettoyage différé, pas un rejet.
2. `secure(g)` → ouvrir et lire le trousseau ; retourner seulement l'enveloppe
   valide de génération g. Construction/lecture impossible → aucune session,
   registre conservé, pas de lecture alternative.
3. `none` / `pending` → aucune session.
4. Registre absent, legacy, vide, corrompu, surdimensionné, symlink, version
   inconnue, champs incohérents → aucune restauration, diagnostic non secret.

### Login (installation de T2)

1. Valider le jeton et le chemin ; refus fermé si invalide.
2. Enregistrer durablement `pending(g)` **avant toute mutation du trousseau**.
3. Écrire/lire-vérifier l'enveloppe OS.
4. Si vérifié → `secure(g)` durable, puis publier en mémoire et annoncer succès.
5. Sinon → `fallback(g, T2)` durable, publier en mémoire, mode dégradé signalé.
   Tenter la purge OS si une Entry existe ; l'échec est un nettoyage différé.
6. Publication finale échouée après `pending` → mémoire vide, aucun rollback
   inventé, aucune sélection opportuniste de T1.

### Logout

1. Vider la mémoire dans tous les cas.
2. Écrire durablement `none` **avant** de supprimer les credentials OS.
3. Conserver la tombstone même après purge complète.
4. `none` confirmé + suppression réussie ou `NoEntry` → logout durable.
5. `none` confirmé + suppression impossible → logout durable, nettoyage différé
   explicitement signalé.
6. `none` non confirmé → erreur de durabilité, logout local seulement, aucune
   annonce de révocation serveur.

### Sérialisation et verrou

Toutes les opérations (lecture, login, logout, purge) sont sérialisées par un
verrou interprocessus système sur `ItemFabricator/desktop-session.lock`
(`flock` Unix, `LockFile` Windows). Le fichier de verrou est stable, non secret,
jamais supprimé/recréé pour déverrouiller. Toute purge relit l'autorité sous
verrou et termine avant de le relâcher (pas de purge asynchrone détachée).
Le cache mémoire (génération + source) est revalidé sous verrou avant toute
nouvelle émission authentifiée. Le verrou n'est pas retenu durant le réseau.

### Remplacement atomique durable

Temporaire protégée (0o600 Unix) + `sync_all` + remplacement natif
(`rename` Unix, `MoveFileExW` `REPLACE_EXISTING|WRITE_THROUGH` Windows) +
synchronisation du répertoire (0o700 Unix). Aucune fenêtre où le registre
disparaît. Le remove-then-rename Windows est remplacé. Refus fermé si la
garantie est impossible.

Pas de symlink/reparse suivi ; erreurs `NotFound` distinctes.

## Critères de régression R01–R17

Chaque critère est couvert par au moins un test unitaire dans
`session_authority.rs` ; les scénarios interprocessus et reprise sont couverts
par `session_authority_process.rs`.

| ID | Objet | Couverture |
|---|---|---|
| R01 | Factory échoue avant handle ; T1 reste ; T2 accepté fallback ; aucun set/get/delete sur handle absent | `r01_factory_fails_before_handle_t1_remains_t2_fallback`, `r01_no_call_on_absent_handle` |
| R02 | Récupération / autre processus : T2 seul, jamais T1, purge sous verrou, autorité fallback conservée | `r02_recovery_t2_only_t1_never_purge_under_lock` + `integ_recovery_other_process_t2_only` |
| R03 | Panne persistante : T2 fallback sans dépendance au keyring | `r03_persistent_failure_fallback_without_keyring` |
| R04 | Backend sain, vieux fallback : T2 OS vérifié, secure sans token disque, relance T2 | `r04_healthy_backend_secure_no_disk_token` |
| R05 | Set/read-back échoue, stale, invalide, mauvaise génération ; purge OK/NoEntry → fallback T2 | `r05_set_failed_fallback`, `r05_readback_mismatch_fallback`, `r05_purge_ok_fallback` |
| R06 | Delete refusé : fallback T2 confirmé, nettoyage différé puis reprise, jamais T1 | `r06_delete_refused_deferred_cleanup` |
| R07 | secure(g) inaccessible puis récupération : aucune session en panne, même g ensuite, aucun fallback ancien | `r07_secure_inaccessible_then_recovery` |
| R08 | secure(g) avec T1 brut/autre génération : aucune session | `r08_secure_wrong_generation_or_raw_t1_no_session` |
| R09 | Logout backend sain/NoEntry : none avant delete, mémoire vide, relance sans session | `r09_logout_healthy_backend`, `r09_logout_noentry` |
| R10 | Logout sans Entry puis récupération : none conservé, jamais T1, purge différée | `r10_logout_without_entry_none_kept` + `integ_logout_without_entry_none_kept` |
| R11 | Logout delete refusé : none protège, erreur physique visible | `r11_logout_delete_refused` |
| R12 | Erreurs chemin/permissions/écriture/sync/remplacement distinguées avant remplacement | `r12_path_error_before_replace`, `r12_registre_chemin_est_repertoire_erreur_avant_remplacement`, `r12_aucun_temporaire_orpelin_apres_echec_installation` |
| R13 | Crash à chaque frontière : pending/none sans session, jamais T1 opportuniste | `r13_crash_after_pending_no_session`, `r13_crash_after_none_no_session`, `r13_crash_apres_set_envelope_valide_registre_encore_pending`, `r13_crash_apres_commit_secure_os_vide`, `r13_crash_apres_none_purge_quand_store_recupere` + `integ_crash_after_pending_no_session` |
| R14 | Registre absent/legacy/vide/corrompu/trop grand/symlink/version/champs incohérents : aucune restauration | `r14_registry_*_no_restore`, `r14_registre_oversized_no_restore`, `r14_registre_fallback_sans_token_no_restore`, `r14_registre_none_avec_generation_incoherente`, `r14_registre_generation_hex_invalide`, `r14_registre_etat_inconnu`, `r14_enveloppe_trop_grosse_erreur_pas_de_session` |
| R15 | Deux processus, sérialisation, dernier commit gagnant, pas de purge tardive | `r15_two_processes_last_commit_wins`, `r15_cache_invalidation_before_emit` + `integ_two_processes_last_commit_wins` |
| R16 | Migration legacy : reconnexion explicite puis format moderne | `r16_migration_explicit_reconnect` |
| R17 | Pas de nouvelle copie en clair, pas de token dans secure/pending/none/diagnostics, bornes conservées | `r17_no_token_in_non_fallback_states`, `r17_generation_not_derived`, `r17_registre_fichier_0600_unix`, `r17_echec_installation_registre_inchange_aucune_session`, `r17_diagnostic_ne_fuite_pas_le_jeton` |

## Preuves et vérification

Exécuter depuis le worktree isolé (`/home/sam/Projects/space-craft-planner/.worktrees/session-authority-followup`):

```
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml --lib
cargo test --manifest-path src-tauri/Cargo.toml --test session_authority_process
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

Les tests sont exécutés sur Linux (x86_64). Les branches spécifiques à
Windows (`MoveFileExW`, `LockFile`) et macOS ne sont pas exercées localement ;
elles sont garde-fou compilées conditionnellement. Aucun keyring CI n'est
requis : le magasin de credentials est abstraité par `CredentialStore` et
injecté par un magasin synthétique.

## Limites et risques résiduels

- Aucune protection contre un attaquant pouvant modifier tous les stores de
  l'utilisateur, un rollback externe cohérent des données ou une perte
  matérielle violant les garanties du stockage.
- Le retour à un ancien binaire ignorant le protocole est hors garantie et ne
  doit pas être proposé comme rollback transparent.
- La garantie porte sur les opérations confirmées et les interruptions couvertes
  par l'atomicité du registre.
- Aucun secret n'est publié dans les diagnostics, les journaux ou les rapports.
- Un remplacement réussi dont la synchronisation du répertoire échouerait ensuite
  (indéterminé post-remplacement) est signalé comme une erreur d'E/S, jamais
  comme un succès silencieux. L'injection déterministe de cette panne entre le
  renommage et la synchronisation n'est pas réalisable sur Linux sans fault-injection
  dédié ; la branche Windows est prouvée compilable par
  `cargo check --target x86_64-pc-windows-gnu`.

## Intégration avec #108

Les protections OAuth/401 existantes de #108 (génération de session, garde-fou
`finish_oauth`, `clear_token_if_matches`) sont préservées. `lib.rs` ne déclare
aucun nouveau writer Rust concurrent : #108 et cette implémentation restent les
seuls writers sur `src-tauri/src/lib.rs`.

## Statut

Implémentation locale terminée, tests unitaires et d'intégration rédigés.
Révision indépendante requise par `tannerverifier` avant toute publication.
Aucun push/PR/merge/tag/release/déploiement n'a été effectué.
