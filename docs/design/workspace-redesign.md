# SC Craft — poste de production

Branche : `codex/sc-craft-complete-redesign`.

## Direction

Refonte de l’application `sc-craft`, orientée outils et données. Le bleu nuit,
les accents indigo et les couleurs fonctionnelles de Star Citizen restent les
repères du thème. Surfaces plus neutres, angles courts, séparateurs précis,
chiffres tabulaires et espaces réglables remplacent les grandes cartes aérées.
Le mode clair reste disponible avec des surfaces ardoise claires.

## Parcours et fonctionnalités

| Espace | Nouvelle présentation | Capacités conservées |
| --- | --- | --- |
| Accueil | Workspace du CQ7 (ou premier blueprint disponible), registre de secours si dataset vide | Recherche par nom, fabricant et catégorie, favoris, inventaire, suggestions de drops, accès à tous les blueprints par chargement progressif |
| Atelier | Identité, commandes, indicateurs, navigation vers six sections | Quantité, qualité par matériau, préréglages, radar/statistiques, acquisition/réputation, sources, démontage, données objet, ajout au planificateur |
| Blueprints | Registre horizontal par défaut, cartes disponibles | Filtres, tris, favoris, inventaire, comparaison, composants, actions contextuelles et chargement progressif |
| Missions | Lignes par défaut, cartes disponibles | Tous les filtres, récompenses, réputation, factions, détail et liens vers les blueprints |
| Ressources | Tableau à colonnes bornées et aperçu latéral | Filtres, tri, sources, demande, missions, aperçu, détail, inventaire et ajout au planificateur |
| Planificateur | Liste de notes et éditeur rapprochés | Notes, recherche, cases à cocher, références de blueprints/ressources, édition et synchronisation |
| Compte | Connexion compacte, aperçus sélectionnables, parcours Discord | Citizen iD, import local, identité RSI, favoris/inventaire, demandes, partage, paramètres, LIVE/PTU et intégration desktop |
| Organisations | En-têtes et panneaux unifiés, cartes adaptatives | Membres, claims, partage, catalogue communautaire et demandes de fabrication |
| Changelog et confidentialité | Même hiérarchie, typographie et composants | Comparaison des datasets, filtres, statistiques et contenus légaux |

L’accueil `/` ouvre directement le workspace du CQ7, comme le Fabricator
historique. Les URL `/item/<slug>` ouvrent l’objet correspondant. Le bouton
« Blueprints » ouvre le catalogue ; précédent/suivant restent synchronisés.

La recherche globale dispose d’un état local et d’un index normalisé mémorisé :
accents ignorés, mots dans n’importe quel ordre, noms exacts prioritaires et
24 résultats maximum. Aucun délai artificiel ni sélection au changement de
focus. Entrée ou clic ouvrent explicitement le résultat ; Échap ferme la liste.
La sélection clavier conserve sa clé lorsque des missions arrivent en différé.
Les contrats des factions sont chargés à la première activation de la recherche.

Les animations communes couvrent entrées de pages/panneaux, navigation,
boutons, focus, menus, dialogues, qualité et valeurs projetées. Les valeurs
restent exactes pendant leur retour visuel. Les durées sont courtes
(120–340 ms) et le réglage système de réduction des mouvements est respecté.
Les indications de qualité et de comparaison sont explicites, les petites
étiquettes de l’atelier agrandies et les commandes se replient sur mobile.

`Ctrl/Cmd + K` place le focus dans la recherche globale hors dialogue.
Le choix Dense/Confort persiste localement sous `sc-craft-workspace-density`.
Il ajuste les espacements et les aperçus sans réduire les cibles tactiles.
Sur téléphone, les outils d’en-tête et la recherche occupent deux lignes ; la
navigation principale reste au bas de l’écran.

## Réalisation

Les règles communes passent par `theme.ts`, `ui/system.tsx`, le thème PrimeReact,
`ui/workspace.css`, `PageLayout`, `PageHeader`, `Panel` et `BentoPanel`.
Les composants métier et les contrats API restent utilisés. Aucun changement
backend, migration, publication de dataset ou déploiement n’est nécessaire.

Les lignes de qualité bénéficient aussi d’une correction du moteur CSS : les
indices numériques `gridRow` et `gridColumn` doivent rester sans unité. Les
statistiques projetées passent automatiquement à une colonne lorsque leur
panneau n’offre pas assez de place. Les descriptions des ressources ne peuvent
plus étirer leur tableau et masquer les colonnes suivantes.

## Vérification

- Build TypeScript et Vite de production.
- Tests client, garde d’architecture UI et tests serveur existants.
- Tests navigateur des huit routes publiques et du shell.
- Nouveau parcours avec dataset contrôlé : ouverture directe, recherche sans navigation au flou,
  sélection explicite, qualité maximale, ancre de section, retour et historique.
- Persistance de densité, raccourci clavier et en-tête contenu dans le viewport.
- Configurations ordinateur/mobile, sombre/clair et captures de référence.
- Contrôle visuel local avec le dataset LIVE publié, y compris le CQ7 rempli.

Les opérations nécessitant une session réelle (OAuth, synchronisation cloud,
partage d’organisation, demandes Discord) conservent leur logique, mais ne sont
pas exécutées contre un compte utilisateur pendant cette refonte.

Pour mettre à jour les références visuelles dans un environnement définissant
`CI`, lancer depuis la racine :

```sh
UPDATE_VISUAL_BASELINES=1 npm run test:e2e --workspace client -- --update-snapshots=all --workers=4
```

Les fichiers d’audit déjà modifiés avant cette intervention sont exclus du commit.

Résultat final : build réussi, 43 tests client, 5 tests serveur et 52 tests
navigateur réussis. Garde d’architecture et vérification du diff réussies.
Les références visuelles ont été régénérées pour les quatre configurations.
