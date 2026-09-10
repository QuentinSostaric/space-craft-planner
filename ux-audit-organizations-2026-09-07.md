# Audit UX ciblé — Organisations et préparation de la marketplace

Date : 7 septembre 2026. Périmètre : page Organisations existante, composants de cartes associés et règles serveur de partage et de demandes de craft. Lecture du code avant refonte ; aucun parcours navigateur exécuté pour cet audit. Les références correspondent à l’état antérieur à la refonte Organisations, issu de la refonte Account.

Méthode : skill `ux-audit`, références web, formulaires et confiance/consentement. **Observé (code)** décrit une implémentation constatée ; **inféré** décrit son effet probable, à vérifier en navigateur. Aucune conclusion sur le contraste, les performances réelles ou les obligations juridiques. La marketplace communautaire n’existe pas encore : sa conception ci-dessous est une proposition, pas un défaut imputé au produit actuel.

## Synthèse

La fonction « Demander craft » et l’identité du fournisseur existent toujours. Elles sont placées dans les actions secondaires d’une carte de blueprint, masquées au repos sur les appareils à pointeur précis. La refonte doit rendre immédiatement lisible **qui possède quoi et auprès de qui demander**, puis assurer un suivi vers Account. Les partages d’organisation restent réservés aux membres vérifiés : une marketplace générale exige un consentement et une publication distincts.

## Parcours et fonctionnalités à préserver

- Annuaire des organisations liées ; accès aux organisations où l’utilisateur est membre/admin vérifié ; état périmé du snapshot ; synchronisation Citizen iD et explication des accès verrouillés.
- Détail d’organisation avec ressources, blueprints et contributeurs. Un blueprint peut être proposé par plusieurs membres ; chaque lot de ressource garde son propriétaire, sa quantité, son unité et sa qualité.
- Recherche, filtres par propriétaire/catégorie/fabricant/présence de qualité, remise à zéro et chargement progressif des blueprints.
- Consultation d’une fiche blueprint, favoris et inventaire personnel depuis les cartes.
- Demande de craft adressée à un propriétaire précis : blueprint et organisation explicites, commentaire, choix concernant les ressources, interdiction de se demander un craft et prévention des doublons en attente.
- Suivi privé dans Account pour les deux participants et protections serveur : identité RSI vérifiée, appartenance, détention et partage encore valides au moment de la demande.

## Constats prioritaires

| ID | Sévérité / confiance | Preuve et conséquence | Correction attendue |
| --- | --- | --- | --- |
| ORG-01 | Élevée / élevée pour le code | **Observé (code)** : `OrganizationsPage.tsx:979–1050` place l’identité du fournisseur et « Request craft » dans `extraQuickActions`. `BlueprintGrid.tsx:509` met ici cinq actions dans une seule rangée ; `:518–521` applique une opacité nulle hors survol/focus. **Inféré** : le parcours principal paraît absent et les libellés sont comprimés sur les petites cartes desktop. | Présenter durablement avatar, nom/handle et action de demande. Séparer les actions personnelles des actions concernant le fournisseur. Garder les états « vous », « en attente » et « envoi en cours » explicites. |
| ORG-02 | Élevée / élevée | **Observé (code)** : `OrganizationsPage.tsx:203–318`, notamment `:236`, charge blueprints et ressources avec `Promise.all`, puis utilise un seul état d’erreur ; `:632–635` ne propose pas de nouvelle tentative. **Inféré** : la panne d’un catalogue masque également l’autre, même s’il a répondu. | Deux états de chargement/erreur et deux nouvelles tentatives ; conserver les données disponibles et le contexte de navigation. |
| ORG-03 | Élevée / élevée pour le code | **Observé (code)** : le clavier des onglets, `OrganizationsPage.tsx:130–136`, relit `event.currentTarget` dans `requestAnimationFrame`. La référence dépend du dispatch de l’événement. **Inféré** : une touche fléchée change la sélection sans déplacer correctement le focus, voire provoque une erreur. | Capturer le conteneur avant le callback ou employer des refs ; vérifier flèches, Home/End, focus visible et correspondance tab/tabpanel. |
| ORG-04 | Moyenne / élevée | **Observé (code)** : `OrganizationsPage.tsx:1570` conserve seulement l’organisation sélectionnée en stockage local ; les onglets/filtres sont des états locaux (`:184` et suivants). Ouvrir/retourner met à jour cet état, sans URL (`:1591`, `:1640` et suivants). **Inféré** : impossible de partager une vue précise ou de parcourir annuaire/détail avec précédent/suivant du navigateur. | URL stable contenant organisation et section, liens utilisables vers Account, restauration cohérente au rechargement et via l’historique. |
| ORG-05 | Moyenne / élevée pour le code, conditionnelle pour les données | **Observé (code)** : les lots sont regroupés par `resourceId` (`OrganizationsPage.tsx:399–414`), puis leurs quantités sont additionnées et l’unité du premier lot est retenue (`:724–725`). **Inféré** : des entrées historiques/importées avec des unités différentes produisent un total trompeur ; les lots demeurent pourtant individuels. | Calculer les totaux par unité, conserver tous les lots/propriétaires/qualités et formater les nombres selon la langue. Ne pas présenter une quantité agrégée comme immédiatement disponible à l’achat. |
| ORG-06 | Moyenne / élevée | **Observé (code)** : l’onglet « Members » (`OrganizationsPage.tsx:1069–1174`) construit sa liste à partir des seuls fournisseurs présents dans les résultats, et le compte « active » désigne ces contributeurs. Ce n’est ni le roster complet ni un statut de présence. **Inféré** : confusion sur les membres absents et leur activité. | Nommer cette vue « Contributeurs » et indiquer la nature du compteur ; proposer un accès direct à leurs offres. N’afficher un véritable roster que si une source autorisée le fournit. |
| ORG-07 | Moyenne / élevée | **Observé (code)** : les résultats vides de ressources (`OrganizationsPage.tsx:704–718`) et de blueprints (`:940–953`) conseillent de retirer des filtres même lorsque personne n’a encore partagé d’entrée. **Inféré** : l’utilisateur cherche une correction qui ne peut rien afficher. | Distinguer organisation sans partage, aucun résultat filtré, catalogue indisponible et accès non vérifié. Offrir respectivement partage depuis Account, effacement des filtres, nouvelle tentative et vérification/synchronisation. |

## Architecture et présentation proposées

1. **Organisations** : annuaire avec recherche et tri, nom/SID et rôle explicites, contexte d’accès compréhensible. Le détail propose Blueprints, Ressources et Contributeurs avec URL stable et retour annuaire. Les actions de partage personnel et de suivi des demandes mènent aux sections appropriées d’Account.
2. **Blueprints d’organisation** : les cartes ou lignes identifient le fournisseur en permanence ; le bouton de craft est prioritaire. Les différents propriétaires d’un même blueprint restent distinguables. Les filtres permettent de choisir une personne sans masquer sa provenance une fois la demande ouverte.
3. **Ressources d’organisation** : regroupement lisible par matériau, puis lots distincts avec propriétaire, quantité, unité et qualité. Les totaux respectent les unités. Une liste d’inventaire partagé ne doit pas annoncer un achat ou une disponibilité contractuelle inexistante.
4. **Marketplace communautaire** : entrée séparée, avec catalogue public/communautaire et gestion de mes publications. Chaque publication montre son auteur, son périmètre et son statut. Une publication est choisie explicitement ; l’interface permet de voir les champs exposés et de retirer l’offre. Les demandes restent privées entre participants.
5. **Cohérence visuelle** : reprendre les surfaces, en-têtes, filtres et états de la nouvelle page Account ; actions visibles sur mobile et desktop, libellés courts EN/FR/DE, grille adaptée à la largeur et formulaires à labels persistants.

## Confidentialité et contraintes établies par le serveur

**Observé (code)** : `shared/organizationService.mjs:890` et `:1048` réservent les catalogues partagés aux membres vérifiés. `shared/craftRequestService.mjs:269–355` vérifie identité RSI, appartenance des deux participants, organisation active, partage autorisé, détention et partage du blueprint. `:362` prévient une demande en attente identique. La demande conserve les identifiants des deux comptes et leurs informations privées de suivi (`:375` et suivants).

**Décision de conception recommandée** : ne pas transformer ces données d’organisation en publications générales. Introduire un consentement séparé, désactivé par défaut, et un DTO de publication limité aux champs nécessaires. Les SID privés, listes de membres, inventaires non publiés, commentaires de demandes et identifiants internes de comptes n’ont pas à figurer dans les réponses de découverte. Une quantité publiée ne doit pas révéler tout l’inventaire par défaut.

Le retrait d’une publication doit empêcher une nouvelle demande depuis une ancienne page. Les échanges déjà créés doivent conserver un suivi compréhensible selon le contrat retenu. La politique d’authentification de la consultation, les conditions d’identité pour publier/demander et la portée exacte des lots restent à fixer avec les contrats serveur ; les tests ci-dessous seront adaptés à ces décisions.

## Matrice de validation proposée — avant écriture des tests

| Surface | Scénario déterministe | Résultat à vérifier |
| --- | --- | --- |
| Organisations / accès | Invité, compte sans RSI, vérification requise, membre vérifié, adhésion révoquée | Action pertinente dans chaque état ; aucun contenu privé obtenu hors autorisation. |
| Organisations / navigation | Lien direct SID + onglet, clavier flèches/Home/End, précédent/suivant, rechargement | URL, sélection et focus cohérents ; retour annuaire prévisible. |
| Organisations / fournisseurs | Deux personnes partagent le même blueprint ; soi-même et fournisseur avec demande en attente | Identités et actions toujours visibles ; bonne personne ciblée ; états propres/pending désactivés. |
| Organisations / craft | Commentaire et choix de ressources ; succès, échec, double clic, doublon 409, partage retiré | Payload exact, une demande, brouillon préservé après échec, suivi Account côté participants, refus serveur des données devenues invalides. |
| Organisations / disponibilité | Un endpoint répond et l’autre échoue ; nouvelle tentative | Catalogue réussi accessible ; retry local sans perte des filtres/contexte. |
| Organisations / ressources | Plusieurs lots/propriétaires/qualités et unités différentes | Aucune fusion trompeuse ; unités et quantités correctes, filtres et totaux cohérents. |
| Organisations / états vides | Aucun partage initial ; recherche sans résultat ; ID absent du dataset | Message et action spécifiques ; reset efficace ; avertissement de catalogue sans masquer les autres entrées. |
| Marketplace / consentement | Compte possédant déjà inventaire et partages d’organisation, sans publication | Aucune exposition automatique ni migration implicite des partages privés. |
| Marketplace / publication | Sélection explicite, aperçu des données publiques, soumission, modification, retrait | Seulement les champs et quantités autorisés sont visibles ; retrait pris en compte par découverte et nouvelles demandes. |
| Marketplace / autorisations | Édition d’une publication tierce, blueprint non détenu, ancien lien après retrait, session manquante | Refus côté serveur ; absence de fuite des données privées dans réponses et erreurs. |
| Marketplace / demandes | Demande communautaire sans SID d’organisation ; doublon ; acceptation/refus/clôture | Contrat communautaire distinct, destinataire correct et suivi privé ; contrôles d’identité et statut appliqués selon contrat retenu. |
| Transversal / portée | Fixtures LIVE et PTU, comptes et organisations distincts | Catalogues, publications, demandes et caches ne traversent pas leur portée. |
| Transversal / UX | Desktop/mobile, clair/sombre, EN/FR/DE, clavier et formulaire invalide | Pas de collision des actions ; noms accessibles ; labels stables ; validation avant API ; captures de panneaux complets. |

Ces validations utiliseront des interceptions API et des fixtures déterministes ; aucune publication réelle ni donnée de production n’est nécessaire. Les tests UI seront écrits après stabilisation des libellés et contrats.
