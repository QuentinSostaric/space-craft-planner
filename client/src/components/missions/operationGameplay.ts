import type { MissionOperation, OperationStep, OperationText } from '../../types/missionOperations';
const descriptions: Record<string, OperationText> = {
  'qv-breaker:prepare-laser': { fr: 'Extraire du Sadaryx avec le Multi-Tool pour fabriquer les lentilles. Installer les éléments optiques, préparer le catalyseur et aligner les réfracteurs avant le tir.', en: 'Mine Sadaryx with a Multi-Tool to manufacture lenses. Install the optics, prepare the catalyst and align the refractors before firing.' },
  'asd-onyx:repeat': { fr: 'Reprendre le contrat répétable et varier les réactifs et catalyseurs de l’expérience.', en: 'Accept the repeatable contract and vary the experiment’s reagents and catalysts.' },
  'storm-breaker:lazarus': { fr: 'Utiliser les accès à usage unique pour rejoindre le Specimen Cache de Lazarus. Vérifier les conditions affichées au terminal.', en: 'Use single-use access credentials to reach the Lazarus Specimen Cache. Check the conditions displayed at the terminal.' },
  'storm-breaker:apex': { fr: 'Utiliser les pylônes pour comprimer les œufs et attirer un apex valakkar. Préparer votre équipe avant de déclencher la rencontre.', en: 'Use the pylons to compress eggs and attract an apex valakkar. Prepare your team before triggering the encounter.' },
  'hathor:cargo': { fr: 'Récupérer la cargaison à PAF et OLP dans l’ordre de votre choix, puis rejoindre la destination de livraison.', en: 'Collect cargo at PAF and OLP in either order, then head to the delivery destination.' },
};
export function gameplayDescription(operationId: string, step: OperationStep): OperationText {
  return descriptions[`${operationId}:${step.id}`] ?? step.description;
}

export function gameplayTeam(operation: MissionOperation): OperationText {
  const teams: Record<string, OperationText> = {
    'siege-of-orison': { fr: 'Petite équipe d’assaut · combat au sol', en: 'Small strike team · ground combat' },
    'tactical-strike-groups': { fr: 'Vaisseaux de combat · balistique / explosifs · équipe au sol', en: 'Combat ships · ballistics / ordnance · ground team' },
    'asd-onyx': { fr: 'Combat au sol · investigation · laboratoires dangereux', en: 'Ground combat · investigation · hazardous labs' },
    'storm-breaker': { fr: 'Équipe coordonnée · combat · extraction', en: 'Coordinated team · combat · extraction' },
    hathor: { fr: 'Combat au sol · soute cargo · rayon tracteur portatif', en: 'Ground combat · cargo space · handheld tractor beam' },
    jumptown: { fr: 'Résistance armée · rotations cargo', en: 'Armed resistance · cargo runs' },
  };
  return teams[operation.id] ?? operation.groupGuidance;
}
