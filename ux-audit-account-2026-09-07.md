# Audit UX ciblé — SC CRAFT / Account

Date : 7 septembre 2026. Rapport préalable à la refonte demandée.

## Périmètre et preuves

Revue rapide de la page Account existante dans une application web avec fonctions desktop conditionnelles. Public mixte : joueurs découvrant le craft et utilisateurs gérant de grandes collections. L'enjeu principal est l'exactitude des stocks et des droits de partage ; des suppressions peuvent faire perdre des données saisies. Les preuves proviennent de `client/src/components/AccountPage.tsx`, `client/src/components/account/{AccountGuestView,CraftRequestsPanel,ResourceInventoryPanel}.tsx`, `client/src/theme.ts` et des tokens de `client/src/ui/system.tsx`. Les références de lignes décrivent l'état avant refonte.

Aucun écran connecté, backend, bot Discord, runtime Tauri ni lecteur d'écran n'a été exécuté dans cette revue. Les propriétés du code sont observées ; leur effet visuel et leur comportement runtime sont inférés. Aucun ratio de contraste ou avis de conformité d'accessibilité n'est revendiqué. Les autres pages et les deux audits du 3 septembre sont hors périmètre et n'ont pas été modifiés.

## Les trois priorités

L'inventaire permet de créer des lots mais ne propose pas de modifier ceux déjà enregistrés. Une quantité vide ou négative peut être transformée silencieusement en quantité minimale, ce qui fragilise la confiance dans le stock. La suppression d'un lot est immédiate et ne prévoit aucune annulation dans la page. La bibliothèque confond ensuite absence de résultat et absence de données, et perd son contexte au remontage de la page. La base visuelle possède déjà des tokens, composants, modes clair/sombre et conventions de focus réutilisables. La refonte devrait préserver la richesse fonctionnelle et réduire l'effort pour retrouver une action, comprendre son effet et corriger une saisie.

## Parcours existants à préserver

| Parcours | Entrées et capacités observées |
|---|---|
| Connexion | Vue visiteur ; Citizen iD avec Discord lié ; connexion indisponible ; erreurs d'authentification ; déconnexion. |
| Données sauvegardées | Import local par fusion favoris/blueprints/ressources avec report ; rafraîchissement session ; mutations optimistes et erreurs ; copie LIVE vers PTU avec remplacement confirmé ; suppression du compte confirmée. |
| Identité RSI | Liaison Citizen iD ; alternative manuelle avec challenge, expiration et copie du code ; révérification ; déliaison ; checklist de configuration. |
| Bibliothèque | Favoris et inventaire blueprint ; protection des blueprints par défaut ; recherche et catégories ; détails blueprint/ressource ; chargement progressif ; lots distincts d'une même ressource avec quantité SCU/objets et qualité optionnelle. |
| Partage | Sélection indépendante des organisations pour un blueprint ou un lot ressource ; retrait du partage via désélection ; partage de ressources en lot par ressource et plage de qualité, avec aperçu du nombre ajouté. |
| Demandes | Flux reçues/envoyées/toutes ; filtres de statut ; accepter/refuser/clore/supprimer selon rôle et statut ; commentaire, ressources, contrepartie, organisation, dates, livraison Discord et prise de contact ; états de synchronisation. |
| Organisations | Ajout SID ou URL RSI ; contexte d'appartenance et rôle vérifié ; demande de revue d'administration ; départ ; invitation bot ; activation/désactivation du partage ; suppression pour l'administrateur ; resynchronisation Citizen iD. |
| Application desktop | Détection d'installations ; chemins personnalisés LIVE/PTU/HOTFIX/TECH-PREVIEW/EVOCATI ; ajout/suppression ; synchronisation blueprints ; surveillance LIVE ; démarrage automatique ; erreurs de détection et watcher. |

## Constats

| ID | Constat | Dimension | Sévérité | Confiance | Effort |
|---|---|---|---|---|---|
| ERR-01 | Suppression d'un lot sans garde ni annulation | Prévention et récupération | Blocker | Observed (code) ; perte runtime Inferred | S |
| FORM-01 | Les quantités invalides deviennent des valeurs valides | Formulaires / exactitude | High | Observed (code) | M |
| FLOW-01 | Impossible de corriger un lot enregistré sur Account | Parcours principal | High | Observed (code) | M |
| A11Y-01 | Le déplacement du focus des onglets réutilise l'événement après le handler | Accessibilité | High | Observed (code) ; échec runtime Inferred | S |
| STATE-01 | Une recherche sans résultat prétend que l'inventaire est vide | États / contenu | Medium | Observed (code) ; présentation Inferred | S |
| NAV-01 | Onglet et contexte de bibliothèque ne sont pas conservés | Navigation / flexibilité | Medium | Observed (code) ; remontage Inferred | M |
| DATA-01 | La progression compare des ensembles différents | Données | Medium | Observed (code) | S |
| NAV-02 | L'identité occupe plusieurs emplacements, tandis que les actions fréquentes restent peu modulables | Architecture / présentation | Medium (opportunité) | Observed (code) ; effort de lecture Inferred | M |

### ERR-01 — Sécuriser la suppression d'un lot

**Preuve et lieu.** `AccountPage.tsx:2577` affiche « Retirer » avec appel direct à `handleRemoveResourceEntry`; `:1413` retire immédiatement le lot et ses partages. Il n'existe aucun état de confirmation ou de restauration associé. À titre de comparaison, les suppressions de compte et d'organisation possèdent déjà une garde.

**Conséquence.** L'utilisateur peut perdre quantité, qualité et destinataires d'un stock saisi par un seul clic erroné. Le qualificatif Blocker concerne cette absence de garde avant toute livraison de la refonte, pas une indisponibilité de toute la page.

**Recommandation.** Réutiliser `AppDialog` et afficher nom, quantité, qualité et nombre d'organisations concernées. Actions : « Conserver ce lot » et « Retirer ce lot ». Une annulation restaurant lot et partages constitue également une solution si sa cohérence est garantie. La suppression d'une demande appelle aussi directement la mutation dans `CraftRequestsPanel.tsx:629` ; son caractère récupérable côté serveur reste hors de cette revue.

### FORM-01 — Refuser les saisies invalides avant normalisation

**Preuve et lieu.** `AccountPage.tsx:167` transforme la chaîne avec `Number(value)`, puis applique `Math.max(1, Math.round(parsed))` ou le minimum SCU. Une chaîne vide devient donc zéro puis le minimum ; une valeur négative devient positive. Le contrôle à `:1173` intervient après cette normalisation. La qualité utilise un bornage sans message local. Les champs `:4102` ont `min` et `step`, mais l'enregistrement utilise une action JavaScript et ne passe pas par un formulaire natif validé.

**Conséquence.** L'utilisateur croit enregistrer sa saisie alors que la quantité a changé. L'erreur est difficile à repérer ensuite parmi des lots similaires.

**Recommandation.** Valider champ vide, finitude, quantité strictement positive, entier pour les objets, précision SCU et qualité optionnelle comprise entre 0 et 1000 avant toute normalisation. Afficher les erreurs sur la ligne : « Saisissez une quantité supérieure à zéro » ; « La qualité doit être comprise entre 0 et 1000 ». Conserver les brouillons et placer le focus sur le premier champ invalide.

### FLOW-01 — Ajouter l'édition des lots

**Preuve et lieu.** Le pied des cartes ressources `AccountPage.tsx:2521` ne propose que partage et retrait ; `:1116` crée toujours de nouveaux lots. Aucun formulaire d'édition d'un identifiant existant ne figure dans la page. Le composant indépendant `ResourceInventoryPanel.tsx` reproduit aussi retrait/partage et n'est importé nulle part dans `client/src`.

**Conséquence.** Un joueur dont le stock ou la qualité change doit retirer puis recréer le lot et rétablir ses partages. La donnée se périme ou l'utilisateur répète une opération risquée.

**Recommandation.** Ajouter « Modifier le lot » avec ressource, unité, quantité et qualité ; préserver identifiant, date de création et partages lors d'une simple correction. Réutiliser le même formulaire validé pour création/édition. Permettre de dupliquer un lot comme raccourci explicite. Retirer le composant mort après avoir confirmé l'absence d'autres points d'entrée.

### A11Y-01 — Stabiliser le focus des onglets

**Preuve et lieu.** `handleAccountTabKeyDown`, `AccountPage.tsx:118`, diffère l'accès à `event.currentTarget.parentElement` dans `requestAnimationFrame`. Le traitement exploite la cible courante d'un événement React après la fin du handler. Les rôles tablist/tab/tabpanel et le roving tabindex sont présents.

**Conséquence.** L'onglet sélectionné peut changer sans que le focus suive ; l'utilisateur au clavier perd la position prévue. L'échec précis doit être vérifié au rendu.

**Recommandation.** Capturer le conteneur avant le changement d'onglet ou utiliser des refs de boutons. Vérifier flèches gauche/droite, Home/End, Tab, Shift+Tab et focus après fermeture des dialogues. Conserver la structure ARIA existante.

### STATE-01 — Distinguer collection vide et filtre vide

**Preuve et lieu.** `AccountPage.tsx:2378` branche uniquement sur `filteredAssetEntries.length === 0`, puis affiche « Aucune ressource stockee pour le moment », « Aucun blueprint favori pour le moment » ou « Aucun actif sauvegarde pour le moment » selon le type, même si la recherche exclut une collection existante. Le panneau des demandes possède déjà un état demandant de changer les filtres.

**Conséquence.** Après une recherche sans résultat, l'utilisateur peut croire avoir perdu son inventaire et ne reçoit pas de raccourci pour le retrouver.

**Recommandation.** Afficher « Aucun résultat pour ces filtres » et « Réinitialiser les filtres » si une recherche ou un filtre exclut les éléments. Réserver « Votre inventaire est vide » au premier usage avec actions « Ajouter des ressources » et « Explorer les blueprints ».

### NAV-01 — Conserver le contexte

**Preuve et lieu.** `AccountPage.tsx:243` et `:305` initialisent recherche, catégorie et onglet avec `useState` ; aucune représentation URL de ce contexte n'existe. À l'inverse, `CraftRequestsPanel.tsx:133` conserve ses filtres avec `useLocalPersist`. Le lien ressource quitte la page Account à `:2491`.

**Conséquence.** Après un détail, une actualisation ou un lien vers Account, l'utilisateur doit retrouver l'onglet et sa sélection. Il ne peut pas enregistrer une entrée directe vers ses demandes ou ses ressources.

**Recommandation.** Encoder au minimum la section dans l'URL, conserver les préférences de bibliothèque valides et réinitialiser explicitement les filtres. Prévoir une résolution sûre des anciennes valeurs et un comportement Back/Forward cohérent. Ne pas persister de données privées dans l'URL.

### DATA-01 — Compter les blueprints obtenables réellement détenus

**Preuve et lieu.** `AccountPage.tsx:422` définit le total avec `obtainableBlueprintIds.size` mais le nombre détenu avec tout `inventoryCount`. Seule la barre est bornée ; le compteur affiche ces deux valeurs sans intersection.

**Conséquence.** Des blueprints par défaut, indisponibles ou hors catalogue peuvent augmenter une progression présentée comme celle du catalogue obtenable. L'utilisateur reçoit un repère de collection incorrect.

**Recommandation.** Compter l'intersection des identifiants détenus et obtenables ; afficher séparément le total d'inventaire. Garder un état de chargement tant que le catalogue mission n'est pas disponible.

### NAV-02 — Donner un rôle clair à chaque section

**Preuve et lieu.** Le bandeau d'identité, la checklist et les comptes externes de l'aperçu (`AccountPage.tsx:1729`, `:1907`, `:2096`) répètent l'état RSI/Discord ; la gestion RSI revient dans les paramètres (`:3460`). La bibliothèque possède un seul rendu en grille, une catégorie et une recherche (`:2282`, `:2413`), sans tri, filtre de partage ni choix de densité.

**Conséquence.** Les nouveaux utilisateurs relisent les mêmes informations tandis que les grandes collections restent coûteuses à parcourir. L'ajout répété de réglages dans la page de 4 625 lignes favorise aussi les divergences entre parcours.

**Recommandation.** Faire du bandeau un résumé compact d'identité/synchronisation ; de l'aperçu une page d'actions prioritaires ; des paramètres la référence pour identité et données. Dans l'inventaire, proposer tri alphabétique/date, filtres indépendants type/partage et vue cartes/liste, avec préférences conservées. Extraire des sections et des hooks par domaine sans modifier les contrats de droits.

## Architecture proposée pour la refonte

Conserver cinq destinations, avec libellés simples et entrées directes : **Aperçu, Inventaire, Demandes, Organisations, Paramètres**. Garder un bandeau compact avec avatar, nom, canal LIVE/PTU actif, état de synchronisation, actualisation et déconnexion. Les erreurs et actions bloquantes restent proches de leur domaine, avec un résumé global uniquement pour un problème de session.

| Section | Structure recommandée |
|---|---|
| Aperçu | Priorité aux demandes en attente et à une action de configuration pertinente ; trois liens avec compteurs ; progression correctement calculée ; checklist reportable sans imposer RSI aux usages solo. |
| Inventaire | Barre de recherche, type, partage, tri et vue ; total de résultats ; actions « Ajouter des ressources », synchronisation desktop et partage en lot ; cartes familières ou lignes compactes ; création/édition commune ; protection et garde de suppression. |
| Demandes | Compteurs reçues à traiter/actives/historique, direction et statut, recherche ; entrée lisible avec blueprint, personne, organisation, statut et action principale ; commentaire et informations Discord sur développement. |
| Organisations | Cartes nom/SID/rôle/état de partage ; action d'entrée et partages comme actions principales ; gestion administrative regroupée ; ajout et resynchronisation explicites ; explication des limites Citizen iD conservée. |
| Paramètres | Sections identité et connexions, données du compte/import/copie LIVE→PTU, installation et automatisation desktop, suppression du compte séparée ; provenance locale/cloud indiquée quand elle explique la portée d'un réglage. |

**Direction visuelle (choix de design, non défaut mesuré).** Réutiliser Manrope pour les titres, Inter pour la lecture et JetBrains Mono pour quantités/SID ; tokens `ui.bg`, `ui.bgElev`, `ui.border`, `text.primary/secondary`, `primary` et statuts existants. Limiter l'empilement de panneaux et l'usage des petits textes en capitales. Offrir une hiérarchie titre → courte aide → contrôles → contenu. Réduire les sous-panneaux des demandes et organisations au profit d'un résumé et de détails développables. Sur mobile, empiler les filtres et les lignes de saisie ; conserver les cibles tactiles et le focus du système. Aucun nouveau branding ou palette n'est nécessaire.

## Backlog prioritaire et quick wins

1. **ERR-01, A11Y-01** : sécuriser le retrait et capturer le focus d'onglet ; correctifs localisés.
2. **FORM-01, FLOW-01** : centraliser validation et édition des lots, conserver partages et brouillons.
3. **STATE-01, DATA-01** : corriger immédiatement les messages et compteurs trompeurs.
4. **NAV-01** : section accessible directement et filtres/préférences cohérents au retour.
5. **NAV-02** : refondre les sections, extraire composants et hooks, apporter filtres/tri/densité.
6. Valider les états connectés/visiteurs, clavier, desktop/web, clair/sombre, mobile et grands inventaires ; vérifier ensuite les mutations serveur et la récupération sur erreur dans une passe fonctionnelle dédiée.

## Ce qui fonctionne et reste en place

Le produit possède déjà une différenciation visiteur/connecté, des libellés en trois langues, des erreurs visibles, des confirmations pour le compte et les organisations, des états optimistes pour les demandes et des contrôles tactiles/clavier largement explicités. Le partage est fin par organisation et par lot, et la copie LIVE→PTU décrit son effet de remplacement. Ces capacités font partie du socle à préserver. Les marques Citizen iD et Discord, les limites des données RSI et les canaux du jeu sont des contraintes métier ; elles ne sont pas des défauts de design.

## Vérifications encore ouvertes

- Le runtime valide-t-il et annonce-t-il correctement les erreurs des champs réutilisés ? Vérifier au clavier et avec lecteur d'écran après refonte.
- La suppression de demande ou la déliaison RSI est-elle récupérable côté serveur ? Si elle détruit des historiques/partages, une garde contextualisée sera nécessaire ; le backend n'est pas audité ici.
- Les installations personnalisées sont-elles toutes utilisables pour scan et surveillance, notamment hors Windows ? Le texte et les contrôles doivent refléter les capacités réelles du runtime ; la détection n'a pas été exécutée.
- Les longues traductions, identités et noms d'organisations tiennent-ils à 320 px et à fort zoom ? Aucune mesure visuelle n'est incluse dans ce rapport.
