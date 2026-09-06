const REASONS: Record<string, string> = {
  'not-for-release': 'Contrat marqué comme non publiable.',
  'work-in-progress': 'Contrat encore en développement.',
  'hidden-contract': 'Contrat masqué dans l’interface du jeu.',
  'personal-cooldown-unmodeled': 'Cooldown personnel non modélisé.',
  'gated-standing-transition': 'Déblocage de rang supplémentaire requis.',
  'subcontract-prerequisites-unmodeled': 'Prérequis de sous-contrats non modélisés.',
  'linear-series-order-unmodeled': 'Ordre de la chaîne de missions non reconstitué.',
  'runtime-reputation': 'Gain de réputation calculé en jeu.',
  'requires-nonzero-crimestat': 'CrimeStat supérieur à zéro requis.',
  'unresolved-reputation-requirement': 'Condition de réputation non résolue.',
  'unresolved-maximum-standing': 'Borne supérieure de réputation non résolue.',
  'template-unresolved': 'Modèle de mission non résolu.',
  'Success reputation is resolved at runtime or is unknown.': 'Gain de réussite inconnu ou calculé en jeu.',
  'No positive reputation gain on this track.': 'Aucun gain positif pour cette réputation.',
  'Reputation precision exceeds the supported model.': 'Précision du gain non prise en charge.',
  'This record is marked unreleased or work in progress.': 'Contrat non publiable ou en développement.',
  'This mission can only be completed once; completion history is not modeled.': 'Mission unique : historique d’accomplissement nécessaire.',
  'A cooldown or runtime refresh restriction is not modeled.': 'Cooldown ou restriction de renouvellement non modélisé.',
  'Mission completion prerequisites require history that is not modeled.': 'Des missions préalables doivent avoir été accomplies.',
  'A standing requirement on another reputation track is not modeled.': 'Une autre réputation est aussi requise.',
  'At least one standing boundary could not be resolved.': 'Au moins une borne de réputation reste inconnue.',
  'Mission offer refresh is nonzero or unknown. Confirm that your duration estimate includes waiting for another offer.': 'Renouvellement des offres non immédiat ou inconnu. Incluez son attente dans votre estimation de durée.',
  'Enter a positive completion-time estimate to compare this mission.': 'Renseignez une durée positive pour comparer cette mission.',
};

export function missionExclusionLabel(reason: string, lang: string): string {
  return lang === 'fr' ? REASONS[reason] ?? 'Une condition supplémentaire reste à vérifier dans le dossier du contrat.' : reason;
}
