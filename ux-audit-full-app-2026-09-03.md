# Audit UX complet — Item Fabricator

Audit de l’application web publique Item Fabricator, réalisé le 3 septembre 2026 à partir de l’interface en production, des sources React/TypeScript et des états responsive déjà observés.

## 1. Périmètre et base de preuves

**Audité :** Fabricator, Blueprints, Missions, Planner, Ressources, Compte invité, politique de confidentialité, en-tête, navigation desktop/mobile, états de chargement et erreurs communs.

**Plateforme :** application web responsive (desktop et mobile).

**Audience :** mixte, avec un cœur d’utilisateurs experts de Star Citizen ; la densité des données et le vocabulaire de jeu sont donc légitimes, mais le produit doit rester progressif pour un premier plan de craft.

**Preuves :** application publique `https://itemfab.space` parcourue à 1280×720 et 390×844 ; inspection du DOM accessible ; lecture des composants sous `client/src` au dépôt local. Les contrastes échantillonnés en thème sombre sont conformes AA : texte secondaire `#8A9CB6` / fond `#0F2138` = 5,80:1 ; accent `#818CF8` / fond = 5,44:1 ; texte sombre / accent = 6,39:1.

**Non audité, et pourquoi :**

- Les parcours connectés d’organisation, de partage et de suppression de compte n’ont pas été exécutés afin de ne pas modifier de données utilisateur.
- Les erreurs réseau réelles, la lecture par NVDA/VoiceOver et Safari/Firefox ne sont pas accessibles dans cet environnement ; les conclusions correspondantes sont fondées sur le code lorsqu’indiqué.
- Les fonctions desktop natives ne font pas partie du parcours web public.

Il ne s’agit pas d’une déclaration de conformité accessibilité ; c’est une revue échantillonnée.

## 2. Résumé exécutif

L’application a une identité visuelle cohérente, une densité adaptée à un outil de craft et une navigation principale compréhensible sur desktop comme sur mobile. Les problèmes les plus sérieux ne sont pas décoratifs : l’application déclare ne faire aucune analytique alors qu’elle initialise PostHog sans choix préalable, certaines informations de mission sont affichées avec leurs variables techniques brutes, et un échec global peut exposer le message interne de l’exception. Le simulateur donne aussi une indication contradictoire : les slots non assignés paraissent remplis à 50 % alors que le résultat les compte à zéro. Plusieurs raccourcis de navigation et d’états vides empêchent la récupération : le titre d’onglet ne suit pas la page, l’erreur de dataset ne propose pas de nouvelle tentative et pouvait exposer une erreur HTTP brute, et une recherche Blueprint vide ne fournit pas d’action immédiate. Enfin, la suppression d’une note Planner est irréversible en un clic. Les correctifs proposés conservent l’interface et ses conventions existantes ; ils ciblent l’honnêteté des états, la récupération et l’accessibilité, plutôt qu’une refonte esthétique.

## 3. Quick wins

| ID | Constat | Dimension | Sévérité | Effort |
|---|---|---|---|---|
| A11Y-01 | Le bouton LIVE est annoncé « [object Object] » | Accessibilité | Haute | S |
| A11Y-02 | Plusieurs landmarks `main` sont imbriqués | Accessibilité | Moyenne | S |
| COPY-01 | Des variables `<Location:Address>` sont publiées dans les missions | Contenu | Haute | S |
| ERR-01 | Le boundary affiche le message interne brut d’une erreur | Erreurs | Haute | S |
| STATE-01 | L’échec de chargement du dataset n’offre aucune nouvelle tentative | États | Haute | S |
| ERR-02 | L’échec du dataset affiche un détail HTTP technique | Erreurs | Moyenne | S |
| FAB-01 | Des slots non renseignés se présentent visuellement à 50 % | Feedback / données | Haute | S |
| DATA-01 | La réputation nécessaire est tronquée sans moyen tactile de lire la valeur | Données | Moyenne | S |
| BP-01 | Une recherche Blueprint vide ne permet pas d’effacer la requête sur place | États | Moyenne | S |
| NAV-01 | Le titre de l’onglet ne reflète jamais la destination courante | Navigation | Moyenne | S |

## 4. Constats

### 4.1 Premier parcours — 1 constat

#### ONB-01 · Le premier Planner enseigne une syntaxe avant le bénéfice

| | |
|---|---|
| **Dimension** | Premier parcours et flux principaux (D1, D3) |
| **Sévérité** | Moyenne |
| **Confiance** | Observé (interface et code) |
| **Effort** | S |
| **Emplacement** | `PlannerPage.tsx:20-31`, `/planner` |

**Preuve.** La seule note initiale est un mini document Markdown qui introduit immédiatement `@bp:id` et `@res:id`. La description de page présente elle aussi le Planner comme un « Research notebook in markdown format ».

**Pourquoi cela compte.** Un joueur qui veut simplement préparer sa prochaine fabrication doit d’abord comprendre un format d’édition et des identifiants internes. La tâche principale — choisir un blueprint, lister les matériaux puis cocher les actions — est masquée par l’outil d’édition.

**Recommandation.** Démarrer par une checklist de premier craft, écrite en langage naturel, et présenter les références Blueprint/Ressource comme un raccourci dans le mode édition, non comme une condition pour commencer.

### 4.2 Navigation et orientation — 1 constat

#### NAV-01 · Le titre du navigateur reste générique quelle que soit la route

| | |
| **Dimension** | Architecture de l’information et navigation (D2) |
| **Sévérité** | Moyenne |
| **Confiance** | Observé (production et code) |
| **Effort** | S |
| **Emplacement** | `App.tsx`, toutes les routes principales |

**Preuve.** Sur `/privacy`, le titre d’onglet observé est toujours « Item Fabricator — Star Citizen Craft & Resource Planner ». Aucun appel à `document.title` n’existe dans `client/src`.

**Pourquoi cela compte.** Les signets, onglets multiples et lecteurs d’écran ne donnent pas de contexte sur la destination courante.

**Recommandation.** Définir `Blueprints · Item Fabricator`, `Missions · Item Fabricator`, etc. lors de chaque changement de vue.

### 4.3 Flux et prévention des erreurs — 1 constat

#### FLOW-01 · Une note Planner peut être supprimée définitivement en un clic

| | |
| **Dimension** | Flux principaux et prévention des erreurs (D3, D6) |
| **Sévérité** | Haute |
| **Confiance** | Observé (code) |
| **Effort** | S |
| **Emplacement** | `PlannerPage.tsx:464-475` |

**Preuve.** Le bouton « Delete note » appelle directement `removeNote(activeNote.id)`, qui retire la note du stockage local. Ni confirmation, ni annulation ne sont proposés.

**Pourquoi cela compte.** Les notes sont des données personnelles de planification ; une erreur de clic supprime immédiatement leur contenu et les tâches associées.

**Recommandation.** Afficher une confirmation nommant la note et indiquant explicitement que la suppression est définitive ; focaliser l’action sûre « Keep note ».

### 4.4 Système, erreurs et couverture des états — 4 constats

#### ERR-01 · Le boundary révèle le message interne de l’exception

| | |
| **Dimension** | Feedback et récupération (D5, D6) |
| **Sévérité** | Haute |
| **Confiance** | Observé (code) |
| **Effort** | S |
| **Emplacement** | `ErrorBoundary.tsx:52-66` |

**Preuve.** L’état d’erreur rend `this.state.error.message` dans un bloc `pre` visible à l’utilisateur.

**Pourquoi cela compte.** Les messages d’exception peuvent contenir des détails techniques incompréhensibles ou sensibles et ne disent pas quoi faire pour récupérer.

**Recommandation.** Afficher « We couldn’t load this part of the app. Try again or reload the page. » sans exposer l’erreur brute, avec un bouton de nouvelle tentative et un bouton de rechargement.

#### STATE-01 · L’échec du dataset est un cul-de-sac

| | |
| **Dimension** | Couverture des états (D7) |
| **Sévérité** | Haute |
| **Confiance** | Observé (code) |
| **Effort** | S |
| **Emplacement** | `App.tsx:875-904` |

**Preuve.** Quand `datasetError` est présent et qu’aucun dataset n’est chargé, l’interface affiche une explication statique. `CraftContext` expose pourtant `refreshDatasets()`.

**Pourquoi cela compte.** Une panne temporaire ou un retour de réseau force l’utilisateur à recharger toute la page, sans signal clair qu’une récupération est possible.

**Recommandation.** Ajouter « Try again » qui appelle `refreshDatasets()` ; conserver le message d’erreur dans une région annoncée.

#### ERR-02 · L’échec du dataset expose un détail HTTP technique

| | |
|---|---|
| **Dimension** | Feedback et récupération (D5, D6) |
| **Sévérité** | Moyenne |
| **Confiance** | Observé (test local) |
| **Effort** | S |
| **Emplacement** | `App.tsx`, état `datasetError` |

**Preuve.** Lors du test local sans API runtime disponible, l’état affiche « Non-JSON response - HTTP 502 » dans le contenu principal.

**Pourquoi cela compte.** Un statut HTTP ne permet pas à un joueur de comprendre l’action attendue et peut révéler des détails de l’implémentation.

**Recommandation.** Conserver l’erreur pour la logique de récupération, mais présenter un message stable indiquant que le dataset est inaccessible et proposer une nouvelle tentative.

#### BP-01 · Le résultat vide Blueprint ne propose pas de récupération immédiate

| | |
| **Dimension** | États vides et recherche (D7, D2) |
| **Sévérité** | Moyenne |
| **Confiance** | Observé (production et code) |
| **Effort** | S |
| **Emplacement** | `/blueprints`, `BlueprintGrid.tsx:990-1039` |

**Preuve.** Une recherche de chaîne inexistante affiche « No obtainable blueprints found. » ; la requête n’est pas nommée et aucun bouton ne l’efface dans l’état vide.

**Pourquoi cela compte.** L’utilisateur n’a ni explication de ce qui a produit le zéro, ni chemin de retour dans la zone où le problème apparaît.

**Recommandation.** Afficher la requête active et le bouton « Clear search » dans l’état vide. Le bouton de réinitialisation de filtres existant reste le recours pour les filtres avancés.

### 4.5 Contenu — 1 constat

#### COPY-01 · Des modèles de mission non résolus sont montrés tels quels

| | |
| **Dimension** | Contenu et microcopy (D8) |
| **Sévérité** | Haute |
| **Confiance** | Observé (production et code) |
| **Effort** | S |
| **Emplacement** | `/missions`, `utils/crafting.ts:68-80` |

**Preuve.** La production affiche des titres contenant `<Location:Address>`. `getMissionContractName()` retourne sans contrôle `displayText`, puis `template`.

**Pourquoi cela compte.** Une variable interne dans le titre principal donne l’impression que les données sont cassées et masque le nom réellement utile de la mission.

**Recommandation.** Écarter tout titre comportant une interpolation non résolue (`<…>`, `{…}`, `{{…}}`) et retomber sur le nom de contrat formaté.

### 4.6 Hiérarchie et données — 2 constats

#### FAB-01 · Les slots non assignés semblent renseignés à 50 %

| | |
| **Dimension** | Feedback, hiérarchie et données (D5, D9, D11) |
| **Sévérité** | Haute |
| **Confiance** | Observé (production et code) |
| **Effort** | S |
| **Emplacement** | `/`, `fabricator/CraftBench.tsx:111-125` |

**Preuve.** Le simulateur montre « 0/3 valid » et une valeur affichée `—`, mais chaque slider annonce « 50% quality, 500 of 1000 ». La valeur de secours `quality ?? 500` alimente le slider même quand `assigned` est faux.

**Pourquoi cela compte.** Le remplissage central est lu comme une saisie déjà faite ; il contredit le score Q0 et les slots non assignés.

**Recommandation.** Garder le comportement de raccourci à 500 pour les boutons +/- mais présenter le slider non assigné comme une valeur non définie (curseur au départ, valeur accessible « Quality not assigned »).

#### DATA-01 · La réputation cible peut être rendue illisible par ellipse

| | |
| **Dimension** | Affichage des données (D11) |
| **Sévérité** | Moyenne |
| **Confiance** | Observé (production et code) |
| **Effort** | S |
| **Emplacement** | `FabricatorPage.tsx:195-252`, ruban KPI |

**Preuve.** Le ruban tronque la valeur avec `whiteSpace: nowrap`, `overflow: hidden` et `textOverflow: ellipsis`. À largeur contrainte, « Trusted Associate » devient « Trusted Associ… ».

**Pourquoi cela compte.** C’est le rang exact requis pour débloquer l’objet ; sur mobile, aucun survol ne permet de récupérer le texte intégral.

**Recommandation.** Autoriser le retour à la ligne pour les valeurs textuelles du KPI et conserver le nombre d’étages de lignes raisonnable.

### 4.7 Accessibilité — 2 constats

#### A11Y-01 · Le canal LIVE n’a pas de nom accessible utilisable

| | |
| **Dimension** | Accessibilité (D12) |
| **Sévérité** | Haute |
| **Confiance** | Observé (DOM de production et code) |
| **Effort** | S |
| **Emplacement** | `Header.tsx:328-345`, `AppToggleGroup.tsx:45-63` |

**Preuve.** Le snapshot accessible de production annonce le bouton sélectionné comme « [object Object] ». Le label JSX du canal LIVE est transmis à PrimeReact comme option libellée.

**Pourquoi cela compte.** Les utilisateurs de lecteur d’écran et de contrôle vocal ne peuvent pas identifier l’option active. Cela échoue le critère WCAG 4.1.2 (Name, Role, Value).

**Recommandation.** Utiliser le texte simple « LIVE » comme libellé de l’option ; le groupe garde le nom « Dataset channel ».

#### A11Y-02 · Les vues publiques imbriquent plusieurs landmarks `main`

| | |
| **Dimension** | Accessibilité (D12) |
| **Sévérité** | Moyenne |
| **Confiance** | Observé (DOM de production et code) |
| **Effort** | S |
| **Emplacement** | `App.tsx:767-775`, `BlueprintGrid.tsx:1007`, `MissionsPanel.tsx:1913-1957`, `FabricatorPage.tsx:654` |

**Preuve.** Le shell fournit déjà `<main id="main-content">`. Le DOM de production contient ensuite un second `main` ; les pages Blueprint, Missions et Fabricator demandent aussi `component="main"` à `PageLayout`.

**Pourquoi cela compte.** La navigation par landmarks propose plusieurs zones principales non distinguées, ce qui désoriente un utilisateur de lecteur d’écran. Cela dégrade la structure de la page (WCAG 1.3.1).

**Recommandation.** Conserver le `main` unique du shell et laisser les layouts de page utiliser leur `div` sémantique par défaut.

### 4.8 Confiance et vie privée — 1 constat

#### TRUST-01 · La promesse « aucune analytique » contredit l’implémentation

| | |
| **Dimension** | Confiance, confidentialité et consentement (D15) |
| **Sévérité** | Haute |
| **Confiance** | Observé (production, configuration et code) |
| **Effort** | M |
| **Emplacement** | `PrivacyPolicyPage.tsx:124`, `CookieConsentBanner.tsx:55-65`, `analytics/posthog.tsx:155-184`, `wrangler.toml:7` |

**Preuve.** La politique affichée publiquement dit que les données ne sont pas utilisées « for advertising or analytics purposes ». Pourtant, la configuration active PostHog (`VITE_POSTHOG_ENABLED = "true"`) et le provider initialise une collecte d’événements avant toute décision dans la bannière, laquelle promet aussi « No tracking … data is collected ».

**Pourquoi cela compte.** L’utilisateur reçoit une information contradictoire au moment du consentement ; il n’a ni choix symétrique ni moyen apparent de modifier une préférence d’analytique.

**Recommandation.** Ne lancer PostHog qu’après un opt-in explicite, offrir « Essential only » au même niveau que « Allow analytics », décrire précisément les données d’usage concernées et permettre de retirer ce choix dans la politique de confidentialité.

### 4.9 Dimensions sans défaut confirmé

**Formulaires et entrées.** Les champs échantillonnés possèdent des noms accessibles, les contrôles de quantité ont des libellés et des cibles tactiles correctes. Aucun défaut confirmé sans exécuter les authentifications tierces.

**Système de design.** Des tokens, primitives de contrôle et styles de focus/réduction de mouvement sont présents. Aucun inventaire de dérive n’est rapporté faute de mesure exhaustive de toutes les valeurs brutes ; ce serait une tâche séparée, mécanique.

**Conventions web et mobile.** La navigation s’adapte sans défilement horizontal observé à 390 px, les destinations principales restent accessibles et le bas de page respecte l’inset bas. Aucun anti-pattern intentionnel, coût caché ou mécanisme d’urgence n’a été observé.

## 5. Backlog priorisé

| # | ID | Action | Sévérité | Effort | Justification |
|---|---|---|---|---|---|
| 1 | TRUST-01 | Rendre l’analytique opt-in, transparente et réversible | Haute | M | La promesse de confidentialité est actuellement contradictoire |
| 2 | COPY-01 | Éliminer les variables de mission non résolues | Haute | S | Défaut immédiatement visible dans le contenu principal |
| 3 | A11Y-01 | Corriger le nom accessible de LIVE | Haute | S | Le sélecteur de dataset n’est pas compréhensible avec assistance |
| 4 | FLOW-01 | Confirmer la suppression de note | Haute | S | Évite une perte de données locale irréversible |
| 5 | ERR-01 | Masquer l’erreur brute et donner une récupération claire | Haute | S | Réduit l’exposition technique et la confusion lors d’un crash |
| 6 | STATE-01 | Ajouter une relance du dataset | Haute | S | Transforme une panne temporaire en état récupérable |
| 7 | FAB-01 | Rendre l’état non assigné du simulateur non ambigu | Haute | S | Corrige une contradiction sur la tâche centrale |
| 8 | A11Y-02 | Retirer les landmarks `main` imbriqués | Moyenne | S | Restaure une structure de page fiable |
| 9 | NAV-01 | Mettre à jour le titre d’onglet par route | Moyenne | S | Améliore orientation, favoris et lecteurs d’écran |
| 10 | BP-01 | Ajouter une récupération dans le zéro résultat | Moyenne | S | Rend la recherche immédiatement réversible |
| 11 | DATA-01 | Ne plus tronquer les rangs de réputation | Moyenne | S | Préserve une donnée décisionnelle sur petit écran |
| 12 | ONB-01 | Remplacer le premier exemple Planner par une checklist | Moyenne | S | Donne une première valeur sans apprendre Markdown |
| 13 | ERR-02 | Masquer le détail HTTP du dataset | Moyenne | S | Fournit une erreur compréhensible sans fuite technique |

## 6. Ce qui fonctionne et ce qui est volontairement laissé tel quel

**Ce qui fonctionne.** La palette sombre et claire est cohérente et les paires de contraste testées dépassent AA. Les chargements de listes utilisent des squelettes structurés, le shell possède un lien d’évitement et un déplacement de focus après changement de route, et le menu mobile reste opérationnel à 390 px sans défilement horizontal du document. Les composants de contrôle partagés concentrent déjà les labels, erreurs et états.

**Laissé tel quel.** La densité du Fabricator et l’emploi du vocabulaire Star Citizen ne sont pas des défauts pour cette audience experte. Le mode sombre, les rayons de cartes et la répartition des destinations de navigation sont des choix cohérents auxquels je ne peux pas attribuer de coût utilisateur démontré. Les liens de confidentialité et de droit d’auteur sont présents ; le problème est la cohérence du contenu de confidentialité avec l’analytique, non leur absence.

## 7. Questions ouvertes

- **PostHog est-il activé dans tous les environnements publics ?** La configuration le rend possible et la production fournit le client ; vérifier le paramétrage de production déterminera si une migration de consentement doit aussi traiter des identifiants existants.
- **Quels sont les taux d’abandon autour du Planner et du simulateur ?** Les deux points de friction sont visibles dans l’interface ; les données de funnel diraient lequel a le plus de poids réel.
- Les erreurs métier propres à chaque route ne sont pas toutes testées avec leur API indisponible ; appliquer la même règle de message orienté action si l’une d’elles révèle une chaîne technique brute.

## Annexe — journal de preuves

| Vue / état | Chargement | Vide | Erreur | Débordement | Méthode |
|---|---|---|---|---|---|
| Fabricator | ✅ squelette / progression | n/a | non déclenché | ⚠️ réputation KPI tronquée ; slots ambigus | production + code |
| Blueprints | ✅ squelette | ⚠️ recherche sans action locale | non déclenché | ✅ grille reflow 390 px | production + code |
| Missions | ✅ chargement différé | n/a | non déclenché | ⚠️ variables brutes visibles | production + code |
| Planner | n/a local | ✅ note absente avec CTA | ⚠️ suppression sans garde | non testé à grande taille de texte | code + interface |
| Shell dataset | ✅ message de chargement | n/a | ⚠️ pas de retry et détail HTTP brut | ✅ nav desktop/mobile | production + code + test local |
| Confidentialité | n/a | n/a | n/a | n/a | production + configuration + code |

✅ présent et adéquat · ⚠️ présent mais insuffisant / défaut identifié · n/a non applicable
