# Présentation des espaces de travail

Cette évolution étend aux autres pages les principes validés sur Missions : densité élevée, identité visuelle claire, une action principale et détails accessibles à la demande.

## Règles communes

- Conserver les valeurs, descriptions, filtres et actions. Déplier les détails au lieu de couper les données.
- Utiliser les images des objets et ressources lorsqu'elles existent ; ne pas présenter un logo fabricant comme une photo d'objet.
- Compacter l'espace et les répétitions, conserver des libellés lisibles et des cibles tactiles utilisables.
- Rendre les actions explicites ; les confirmations de tâche et de rang peuvent être annulées.
- Montrer les compteurs chargés ou un état d'attente. Zéro ne remplace pas une donnée non chargée.
- Conserver les tokens des thèmes clair/sombre, le focus clavier et la préférence de réduction des animations.

## Application

| Espace | Premier regard | Détails disponibles |
| --- | --- | --- |
| Atelier | Sélection d'objet illustrée, recherche et collection personnelle | Suggestions d'acquisition, guide de production |
| Objet | Qualité des matériaux et résultat de simulation | Toutes les caractéristiques, acquisition/réputation, matériaux, démontage, données objet |
| Blueprints | Identité, matériaux et actions à côté de l'objet | Filtres avancés et fiches détaillées |
| Ressources | Choix du matériau, meilleures sources disponibles, collecte/stock | Propriétés, sources complètes, missions chargées à la demande, blueprints |
| Planificateur | Prochaine tâche avec validation/annulation ; accès aux crafts et collectes sauvegardés | Checklist complète, édition, organisation/export, un tableau de production à la fois |
| Changelog | Versions comparées, statut et valeurs avant/après | Filtres avancés et intégralité des changements de chaque objet |
| Compte / organisations | Connexion ou actions courantes ; espaces partagés | Fonctionnement, conditions de synchronisation et détails des accès |

## Continuité fonctionnelle

- Les liens des sections d'objet ouvrent leur contenu avant de faire défiler la page.
- Un ajout au planificateur propose `/planner#planner-production`, qui ouvre les données enregistrées.
- Les cartes de goals rouvrent le bon objet et sa configuration.
- Les missions d'une ressource utilisent les contrats chargés par faction, y compris les catalogues allégés avec `contracts: []`.
- Le changelog n'arrête plus les détails à huit éléments : tous restent consultables.
- Les notes existantes sont préservées ; aucun contenu de démonstration n'est créé pour une nouvelle bibliothèque vide.

## Validation

Tests d'interaction : détails complets du changelog, sélection/source/mission/stock des ressources, conservation des notes et annulation, agrégation des crafts et collectes, liens directs du planificateur. Vérification visuelle locale des principales pages sur ordinateur et écran de 390 px. La vue authentifiée du compte et les organisations avec membres ont été revues dans le code, sans connexion à un compte pendant cette passe.

Les 124 tests du client, les 56 scénarios E2E, le contrôle des conventions UI et le build passent. Les scénarios de navigation ont été adaptés au nouvel accueil et à la densité fixe. Les huit références visuelles du shell et de la fiche objet ont été régénérées et inspectées sur ordinateur et mobile, en clair et sombre.
