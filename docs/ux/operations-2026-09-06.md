# Revue ciblée — opérations, 6 septembre 2026

Périmètre : consultation et suivi d’une opération dans ItemFab, application web utilisée pendant une session de jeu. Public mixte, familiarisé avec Star Citizen. La densité est une contrainte explicite à conserver. Preuves : code de MissionOperationsPanel.tsx et OperationScene.tsx au commit b168f90, captures desktop/mobile de la session précédente, retour utilisateur. Pas d’analytics ni de test utilisateurs ; aucune conclusion sur les autres pages.

## Diagnostic et corrections prioritaires

| ID | Nature / dimension | Gravité / confiance | Preuve et conséquence | Correction / effort |
| --- | --- | --- | --- | --- |
| FLOW-01 | Défaut · action principale | Haute · observé (code + captures) | Le titre de l’objectif est répété dans une case à cocher, à côté de « Suivant » qui ne valide rien. Le joueur doit deviner comment terminer une étape. | Un bouton « Terminer l’étape » valide et avance ; retour et annulation explicites. M |
| VIS-01 | Opportunité · hiérarchie | Haute · observé (code + captures) | En-tête, total, schéma, pastilles numérotées et grille d’étapes précèdent l’objectif utile. Deux navigations affichent les mêmes étapes. Le regard doit traverser plusieurs accents de même poids. | Une seule surface avec lieu, objectif actif et action ; parcours complet sur demande. M |
| FLOW-02 | Défaut · reprise | Moyenne · observé (code) | activeStep repart à zéro malgré des étapes cochées persistées. À chaque visite le joueur doit retrouver sa place. | Reprendre la première étape restante et conserver l’opération choisie. S |
| CONTENT-01 | Opportunité · divulgation progressive | Moyenne · observé (code) | Équipement, conditions d’accès et récompenses sont affichés simultanément pendant l’exécution. | Préparation avant départ et détails à la demande ; accès réputation toujours disponible. M |
| VIS-02 | Opportunité · repérage | Moyenne · observé (code + captures) | Les silhouettes abstraites ne permettent pas de reconnaître les lieux. | Une photographie réelle référencée par opération, cadrage sobre et libellé de lieu ; aucun faux plan géographique. M |

Ordre : corriger validation/reprise, recentrer l’objectif, remplacer l’illustration, déplacer les informations secondaires, tester reprise et fin de parcours sur desktop/mobile.

À conserver : progression locale isolée par build et opération, accès au calcul de réputation, tokens de l’application, densité, réduction des mouvements. Les quantités ou coordonnées inconnues ne seront pas inventées. Question ouverte : le temps pour retrouver l’objectif en revenant de jeu devra être évalué avec des joueurs ; l’amélioration d’usage reste à confirmer par ces observations.

## Références visuelles retenues

Les images distantes sont accompagnées de leur crédit et d’un lien vers la fiche de l’image dans l’interface. Cadrage responsive par CSS ; elles ne constituent pas un plan de navigation. Les références communautaires ne servent pas à déduire la version actuelle des parcours.

- QV Breaker : CIG, [Alpha 4.7](https://robertsspaceindustries.com/en/comm-link/transmission/21038-Alpha-47-Welcome-To-The-Rock), extérieur et laser.
- Siege of Orison : [Solanki par Jonrellim](https://starcitizen.tools/File:Crusader-orison-inspiration-park-solanki-aerial.jpg), CC BY-SA 4.0, capture 2022.
- Tactical Strike Groups : CIG, [Alpha 4.8](https://robertsspaceindustries.com/en/comm-link/transmission/21142-Alpha-48-Tactical-Strike), entrée de QV Extraction Station, pas le vaisseau Tranquility.
- ASD Onyx : CIG, [Alpha 4.3](https://robertsspaceindustries.com/en/comm-link/transmission/20709-Alpha-43-Dark-Territory), approche de surface.
- Storm Breaker : [Farro Data Center VII par T00dled00](https://starcitizen.tools/File:Farro_Data_Center_VII,_Pyro_IV.webp), CC BY-SA 4.0, capture juin 2025 ; le nom historique du fichier ne fixe pas la planète actuelle.
- Hathor : CIG, [aperçu du 14 mars 2025](https://starcitizen.tools/File:CloudImperiumGames_SneakPeek_3142025.png), bâtiment Hathor sans sous-site identifié.
- Jumptown : CIG, [Jumptown 2.1](https://robertsspaceindustries.com/comm-link/transmission/19156-Jumptown-21), laboratoire sur Daymar ; suivre le site de son contrat en jeu.
