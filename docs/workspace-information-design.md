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
| Fabricator | Fiche du Vendetta HMG par défaut ; composition inspirée de main : bandeau d’indicateurs, simulation large, acquisition en bande et trois panneaux complémentaires, dans un dashboard 1080p | Les liens `/item/…` conservent leur objet ; les longues listes défilent dans leur panneau |
| Objet | Simulation et toutes les caractéristiques visibles, acquisition, matériaux, démontage et données objet | Navigation de section conservée sur les écrans étroits, description et visuel agrandi à la demande |
| Blueprints | Image sur environ 40 % de la carte du registre, identité et matériaux, actions en pied | Filtres avancés et fiches détaillées |
| Ressources | Choix du matériau, meilleures sources disponibles, collecte/stock | Propriétés, sources complètes, missions chargées à la demande, blueprints |
| Planificateur | Prochaine tâche avec validation/annulation ; accès aux crafts et collectes sauvegardés | Checklist complète, édition, organisation/export, un tableau de production à la fois |
| Changelog | Lignes compactes : image, nom, type, statut et accès aux modifications | Un clic ouvre toutes les valeurs avant/après dans une fenêtre, sans allonger la liste |
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

Les 124 tests du client, les 60 scénarios E2E, le contrôle des conventions UI et le build passent. Les scénarios de navigation ont été adaptés au Vendetta par défaut et à la densité fixe. Les huit références visuelles du shell et de la fiche objet ont été régénérées et inspectées sur ordinateur et mobile, en clair et sombre.
