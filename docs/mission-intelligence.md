# Missions : datamining et proposition fonctionnelle

Branche : `codex/mission-intelligence`, dans l’app et l’exporter.

Le build de référence est **LIVE 4.10.191.2241, 12519617, 26 août 2026**, issu de la copie déjà extraite. Cette proposition enrichit Missions avec une recherche générale, un calcul de progression et des dossiers d’opérations. Elle ne modifie pas les datasets R2 publiés. Les nouvelles données sont des snapshots explicitement identifiés par build ; si le dataset sélectionné diffère, l’interface le signale et les liens de récompenses vers ses blueprints sont désactivés.

## Essayer les propositions

Avec `npm run dev` (Node 24), ouvrir :

- [Progression de réputation](http://localhost:5173/missions?view=reputation)
- [Opérations et événements](http://localhost:5173/missions?view=operations)
- [Tous les contrats](http://localhost:5173/missions?view=directory)
- [Récompenses de blueprints existantes](http://localhost:5173/missions?view=catalog)

Les liens historiques `/missions/<contrat>` et le catalogue publié restent compatibles. Les paramètres `track`, `target` et `operation` relient les dossiers aux objectifs de réputation. Les réglages et les étapes terminées sont conservés localement, séparés par build et par réputation/opération. Aucun compte n’est nécessaire.

## Données retrouvées

| Couverture | Résultat |
| --- | --- |
| Contrats ContractGenerator analysés | 2 513, contre 781 contrats de récompense de blueprints dans l’export antérieur |
| Axes faction + activité identifiés | 44 ; 40 portent des gains de contrats et sont sélectionnables |
| Contrats avec gain numérique de réussite | 2 207 |
| Candidats après restrictions du planificateur | 264, sur 9 axes ; un gain numérique ne suffit pas à rendre un contrat planifiable |
| Dossiers d’opérations | QV Breaker, Siege of Orison, Tactical Strike Groups, ASD Onyx, Storm Breaker, Hathor, Jumptown |
| Étapes documentées | 37, bilingues français/anglais |
| Variantes rattachées aux dossiers | 40 retenues et 11 exclues par les marqueurs de non-publication/développement |

Ces nombres concernent des **définitions présentes dans les fichiers**, pas le nombre de missions actuellement proposées par les serveurs. Le répertoire inclut aussi le contenu non publiable, masqué par défaut. Les missions MissionBroker historiques restent accessibles dans le catalogue de paiements existant ; les 2 513 contrats ne représentent pas à eux seuls toutes les structures de missions du jeu.

Les preuves détaillées et commandes d’extraction se trouvent dans l’exporter : `docs/MISSION_REPUTATION_DATAMINING.md` et `docs/MISSION_OPERATIONS_DATAMINING.md`. Elles conservent les GUID, fichiers sources, tokens de localisation et les contradictions rencontrées. L’ordre des résultats de mission a été vérifié dans le schéma binaire DCB avant d’interpréter les gains.

## Calcul du parcours

Le moteur recherche le chemin de coût minimal entre des états de réputation, en réévaluant les prérequis à chaque mission. Il compare les séquences complètes, tient compte des plafonds, des intervalles de rang inclus/exclus et du dépassement du seuil lors de la dernière mission. Le résultat est optimal **dans le modèle choisi et parmi les missions admissibles** ; atteindre le nombre de points d’un rang verrouillé ne prouve pas que sa certification est obtenue.

Deux modes :

- **Moins de missions** : minimiser le nombre de réussites complètes. Les durées restent absentes lorsqu’un délai de renouvellement d’offre n’est pas estimé.
- **Temps minimal** : minimiser la somme des durées personnelles, préparation et trajet inclus. Pour les générateurs avec renouvellement d’offres non immédiat ou inconnu, il faut explicitement confirmer que les durées incluent aussi l’attente. Les valeurs brutes `respawnTime` et `respawnTimeVariation` ne sont pas converties en secondes : leurs unités n’ont pas été confirmées.

Les gains supposent **100 % des objectifs accomplis**. Échecs, abandons, livraison partielle, disponibilité instantanée, concurrence et géométrie des déplacements ne sont pas simulés. Une perte absente des records reste inconnue, jamais remplacée par zéro. Les missions uniques, cooldowns personnels, chaînes de tags, autres réputations requises et conditions non résolues sont exclues plutôt que présumées satisfaites. La recherche est bornée : si sa limite est atteinte, aucun optimum n’est annoncé.

Exemples vérifiés sur le snapshot :

- Highpoint, Standing, **0 → 800** : 8 réussites de « Reduce Valakkar Breaker Station Population » à +100. Le temps est absent par défaut. Avec une hypothèse explicitement confirmée de 15 minutes par cycle complet, le modèle affiche 120 minutes.
- Shubin, **800 → 5 800** : avec renouvellement d’offres inclus et 15 minutes par cycle, 14 petites commandes jusqu’à 2 200 puis 24 moyennes : **38 missions, 9 h 30 estimées**. Sans confirmation d’attente, le sous-ensemble sans délai de renouvellement explicite donne un autre parcours. Shubin **0 → 800** n’a pas de route établie par ce modèle : l’interface ne saute pas le prérequis.

## Dossiers d’opérations

Les dossiers affichent un repère photographique réel, l’objectif en cours et le bouton « Terminer l’étape ». La validation avance vers la première étape restante ; « Annuler » restaure la dernière action. L’opération choisie et sa progression sont mémorisées localement. Parcours complet, préparation, prérequis et récompenses sont accessibles à la demande. Les preuves techniques restent dans les rapports de datamining. Ils sont des guides revus à partir des fichiers, pas une reconstruction automatique complète des interactions Subsumption.

- QV : Shubin 800 points et 175 000 aUEC pour les droits partagés ; 2 200 points et 850 000 aUEC pour les droits exclusifs. Courant, redémarrage, préparation optique, laser et astéroïde sont distingués.
- TSG : InterSec 5 800 points **et** tag d’introduction. Les variantes marquées non publiables sont exclues du guide.
- Siege : le dossier suit SOO2/Northrock du build 4.10 ; il ne mélange pas les objectifs de l’ancien événement CDF.
- Onyx : progression Hockrow et répétitions distinguées ; la divergence de description P2M4/P2M1 reste documentée dans le rapport technique.
- Storm Breaker : dossier de mécanismes documentés, sans prétendre connaître toute la chaîne ni des codes universels ; l’incohérence historique Pyro I/Pyro IV reste documentée dans le rapport technique.

Les codes dynamiques, quantités non établies, durée réelle, activation des événements et parcours physiques optimaux restent à documenter. Les sept dossiers ont une checklist ; les autres familles sont consultables dans les données générales ou inventoriées dans le rapport, sans guide complet inventé.

## Reproduction et intégration

1. Générer les deux exports dans l’exporter, à partir de la copie du build et avec les commandes documentées dans ses rapports.
2. Dans l’app : `node scripts/importMissionResearch.mjs /chemin/sc-craft-exporter/work/mission-intelligence`.
3. Le script contrôle le canal, le build et le schéma, conserve les champs de calcul et écrit les snapshots sous `client/public/data/`. Les gros fichiers XML et sorties de travail restent exclus de Git. Les empreintes SHA-256 sont affichées.
4. Exécuter `npm run test:client`, `npm run typecheck`, `npm run ui:guard` et `npm run build --workspace client`. Dans l’exporter : `npm run verify`.

Les snapshots sont chargés à la demande et mis en cache en mémoire. Une mise à jour future devra les versionner avec le build ou intégrer des chunks équivalents au pipeline de publication. Aucune migration ni publication de production n’est nécessaire pour examiner cette branche.

Une correction compatible accompagne la proposition : la normalisation des données publiées conserve maintenant `missionPayouts` et `resourceObjectiveIndex`, qui étaient supprimés alors qu’ils figuraient déjà dans le contrat de données.

## Validation

Tests d’extraction : ordre des résultats, gains multiples et inconnus, bornes de rang, cooldowns, refresh des offres, preuves et dépendances des opérations. Tests du moteur : contre-exemple au classement glouton, changements de rang, plafonds, durées, limites de recherche, exclusions. Tests d’interface : recalcul après modification, saisies invalides, mode temps/nombre, attente incluse, liens de déblocage et isolation des checklists par build/opération. Vérification manuelle dans le navigateur avec les données LIVE locales.


### Refonte UX du 6 septembre

La [revue ciblée](ux/operations-2026-09-06.md) détaille les décisions et les références photographiques. Les images distantes conservent leur attribution ; si leur chargement échoue, l’objectif et son action restent utilisables. Les repères ne prétendent pas cartographier le trajet exact. Les vues de Solanki, Hartmoore et Admin Center suivent les étapes d’Orison ; le laser QV dispose de sa propre photo.

Validation : 92 tests client, contrôle TypeScript et architecture UI ; vérification des vues sombre/claire, mobile 390 px, avancement et annulation dans le navigateur. Le cas réel d’un blueprint sans nom dans Onyx est couvert contre les régressions.
