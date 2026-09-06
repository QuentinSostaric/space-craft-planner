import { useId, useMemo, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { useMissionSnapshot } from '../../hooks/useMissionSnapshot';
import type { MissionIntelligenceData, MissionIntelligenceMission, MissionIntelligenceTrack, MissionRouteInput } from '../../types/missionIntelligence';
import type { MissionOperation, OperationText } from '../../types/missionOperations';
import { getMissionRouteCandidates } from '../../utils/missionRoutePlanner';
import { planOperationUnlockRoute } from '../../utils/operationUnlockPlanner';
import { navigateToPath } from '../../utils/slug';
import { shouldHandleInternalLinkClick } from '../../utils/spaLinks';
import { AppButton, AppCheckbox, AppSelect, AppTextField } from '../ui/controls';
import './operation-unlock.css';

type AccessGoal = NonNullable<MissionOperation['accessGoals']>[number];

function useOperationText() {
  const { lang } = useI18n();
  return (value: OperationText) => typeof value === 'string' ? value : lang === 'fr' ? value.fr : value.en;
}

function readCurrent(key: string, track: MissionIntelligenceTrack) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (typeof saved?.current === 'string' && saved.current.trim() && Number.isFinite(Number(saved.current))) return saved.current;
  } catch { /* Start at the known initial reputation when storage is unavailable. */ }
  return String(track.initialReputation ?? 0);
}

function standingAllows(mission: MissionIntelligenceMission, trackId: string, reputation: number) {
  return mission.requirements.every((requirement) => {
    if (requirement.trackId !== trackId || requirement.minStandingResolved === false || requirement.maxStandingResolved === false) return false;
    if (requirement.minStandingId && requirement.minReputation === null) return false;
    if (requirement.maxStandingId && requirement.maxReputationExclusive === null && !requirement.maxStandingResolved) return false;
    const inside = (requirement.minReputation === null || reputation >= requirement.minReputation)
      && (requirement.maxReputationExclusive === null || reputation < requirement.maxReputationExclusive);
    return requirement.exclude ? !inside : inside;
  });
}

function AccessRoute({ operation, goal, track, data }: { operation: MissionOperation; goal: AccessGoal; track: MissionIntelligenceTrack; data: MissionIntelligenceData }) {
  const { t, lang } = useI18n();
  const text = useOperationText();
  const number = (value: number) => new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(value);
  const storageKey = `itemfab:mission-route:${data.build.buildNumber}:${track.id}`;
  const [currentValue, setCurrentValue] = useState(() => readCurrent(storageKey, track));
  const introductionKey = `itemfab:operation-introduction:${data.build.buildNumber}:${track.id}`;
  const legacyIntroductionKey = `itemfab:operation-introduction:${data.build.buildNumber}:${operation.id}:${track.id}`;
  const [introductionCompleted, setIntroductionCompleted] = useState(() => {
    try { return (localStorage.getItem(introductionKey) ?? localStorage.getItem(legacyIntroductionKey)) === 'true'; } catch { return false; }
  });
  const current = currentValue.trim() ? Number(currentValue) : NaN;
  const valid = Number.isFinite(current) && (track.reputationCeiling === null || current <= track.reputationCeiling);
  const standings = [...track.standings].filter((standing) => standing.minReputation !== null).sort((a, b) => a.minReputation! - b.minReputation!);
  const requiredRank = standings.filter((standing) => standing.minReputation! <= goal.targetReputation).at(-1);
  const currentRank = valid ? standings.filter((standing) => standing.minReputation! <= current).at(-1) : undefined;
  const trackMissions = useMemo(() => data.missions.filter((mission) => mission.reputationRewards.some((reward) => reward.trackId === track.id)), [data, track.id]);
  const input = useMemo<MissionRouteInput>(() => ({
    missions: trackMissions, trackId: track.id, currentReputation: current,
    targetReputation: goal.targetReputation, reputationCeiling: track.reputationCeiling, mode: 'count',
  }), [trackMissions, track.id, track.reputationCeiling, current, goal.targetReputation]);
  const calculation = useMemo(() => valid ? planOperationUnlockRoute({ data, track, goal, currentReputation: current, introductionCompleted }) : null, [data, track, goal, current, introductionCompleted, valid]);
  const route = calculation?.route;
  const introduction = calculation?.introduction;
  const { candidates } = useMemo(() => getMissionRouteCandidates(input), [input]);
  const candidateIds = useMemo(() => new Set(candidates.map((candidate) => candidate.mission.id)), [candidates]);
  const leads = useMemo(() => {
    if (!valid || route?.status !== 'unreachable') return [];
    const seen = new Set<string>();
    return trackMissions.filter((mission) => {
      if (mission.notForRelease || mission.workInProgress || candidateIds.has(mission.id) || !standingAllows(mission, track.id, current)) return false;
      const rewards = mission.reputationRewards.filter((reward) => reward.trackId === track.id);
      if (!rewards.length || rewards.some((reward) => reward.success === null || !Number.isFinite(reward.success)) || rewards.reduce((sum, reward) => sum + reward.success!, 0) <= 0 || seen.has(mission.title)) return false;
      seen.add(mission.title);
      return true;
    }).slice(0, 3);
  }, [valid, route, trackMissions, track.id, current, candidateIds]);
  function updateCurrent(value: string) {
    setCurrentValue(value);
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
      const previous = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
      localStorage.setItem(storageKey, JSON.stringify({ ...previous, current: value }));
    } catch { /* The route remains usable during this visit. */ }
  }
  function updateIntroduction(completed: boolean) {
    setIntroductionCompleted(completed);
    try { localStorage.setItem(introductionKey, String(completed)); } catch { /* The selection remains usable during this visit. */ }
  }
  const params = new URLSearchParams({ view: 'reputation', track: track.id, target: String(goal.targetReputation), operation: operation.id });
  const plannerHref = `/missions?${params}`;
  const gap = valid ? Math.max(0, goal.targetReputation - current) : null;
  const hasRankGate = valid && standings.some((standing) => standing.gated && standing.minReputation! > current && standing.minReputation! <= goal.targetReputation);
  return <>
    <div className="operation-unlock-target">
      <div><span className="operation-unlock-label">{t('Who to work for', 'Pour qui travailler')}</span><strong>{track.factionName}</strong><span className="operation-unlock-category">{t('Category', 'Catégorie')} · {track.scopeName === 'Standing' ? t('Standing · general reputation', 'Standing · réputation générale') : track.scopeName}</span></div>
      <div className="operation-unlock-rank"><span className="operation-unlock-label">{t('Required rank', 'Rang requis')}</span><strong>{requiredRank?.name ?? t('Reputation threshold', 'Seuil de réputation')}</strong><span>{number(goal.targetReputation)} {t('points', 'points')}</span></div>
    </div>

    {(goal.buyInUec != null || goal.completionTag) && <div className="operation-unlock-extra">
      {goal.buyInUec != null && <span><i className="pi pi-wallet" aria-hidden="true" /><strong>{number(goal.buyInUec)} aUEC</strong> {t('contract access fee', 'de frais d’accès au contrat')}</span>}
      {goal.completionTag && <span><i className="pi pi-flag" aria-hidden="true" />{text(goal.note)}</span>}
    </div>}

    <div className="operation-unlock-start">
      <AppSelect label={t('Your current rank (estimate)', 'Votre rang actuel (estimation)')} value={currentRank?.id ?? null}
        options={standings.map((standing) => ({ value: standing.id, label: `${standing.name ?? t('Rank', 'Rang')} · ${number(standing.minReputation!)} pts` }))}
        onValueChange={(id) => { const rank = standings.find((standing) => standing.id === id); if (rank) updateCurrent(String(rank.minReputation)); }}
        placeholder={t('Choose your rank', 'Choisir votre rang')} />
      <AppTextField label={t('Current points', 'Points actuels')} type="number" step={1} max={track.reputationCeiling ?? undefined}
        value={currentValue} onValueChange={updateCurrent}
        error={!valid ? t('Enter a valid reputation value.', 'Renseignez une réputation valide.') : undefined} />
    </div>
    <p className="operation-unlock-help">{t('A rank uses its starting points. Refine the value if you know your exact progress.', 'Un rang utilise son seuil de départ. Affinez les points si vous connaissez votre progression exacte.')}</p>
    {introduction && <div className="operation-unlock-introduction"><AppCheckbox checked={introductionCompleted} onCheckedChange={updateIntroduction}
      label={t('I have already completed the introduction', 'J’ai déjà terminé l’introduction')}
      description={introduction.title} />
      {introduction.blocked && !introductionCompleted && introduction.description && <details><summary>{t('View the introduction contract', 'Voir le contrat d’introduction')}</summary><p>{introduction.description}</p></details>}
    </div>}

    <div className="operation-unlock-result" aria-live="polite">
      {route?.status === 'optimal' ? route.totalRuns === 0 ? <p className="operation-unlock-ready"><i className="pi pi-check-circle" aria-hidden="true" />{t('Reputation requirement met', 'Seuil de réputation atteint')}</p> : <>
        <div className="operation-unlock-route-heading"><h3>{t('Your path to this operation', 'Votre parcours vers cette opération')}</h3><strong>{number(route.totalRuns)} {t('contracts', 'contrats')}</strong></div>
        <ol className="operation-unlock-route">{route.steps.map((step, index) => {
          const mission = trackMissions.find((candidate) => candidate.id === step.missionId);
          return <li key={`${step.missionId}:${index}`}>
            <span className="operation-unlock-step-index" aria-hidden="true">{index + 1}</span>
            <div><strong>{step.title}</strong><span className="operation-unlock-step-gain">{introduction?.planned && introduction.missionId === step.missionId ? t('Introduction · once', 'Introduction · une fois') : `${number(step.count)} ${t('runs', 'fois')}`} · +{number(step.reputationGain)} {t('points in total', 'points au total')}{mission?.systems.length ? ` · ${mission.systems.join(' / ')}` : ''}</span>
              {mission?.description && <details><summary>{t('Mission details', 'Détails de la mission')}</summary><p>{mission.description}</p></details>}
            </div><span className="operation-unlock-step-points">{number(step.reputationBefore)} <i className="pi pi-arrow-right" aria-hidden="true" /> {number(step.reputationAfter)}</span>
          </li>;
        })}</ol>
        <p className="operation-unlock-help">{t('Fewest contracts among the calculable routes. Assumes full success, CrimeStat 0 and available offers; waiting time is not estimated.', 'Minimum de contrats parmi les parcours calculables. Réussite complète, CrimeStat 0 et offres disponibles supposés ; attente non estimée.')}</p>
      </> : route && <div className="operation-unlock-gap"><i className="pi pi-info-circle" aria-hidden="true" /><div><strong>{route.status === 'bounded' ? t('Route not fully calculated', 'Parcours non entièrement calculé') : t('No complete route established from this starting point', 'Aucun parcours complet établi depuis ce départ')}</strong><p>{introduction?.blocked && !introductionCompleted
        ? t('The introduction must be completed first; its full conditions are not yet confirmed. If you have already completed it, confirm this above to calculate the rest of your route.', 'L’introduction doit être terminée d’abord ; ses conditions complètes ne sont pas encore confirmées. Si vous l’avez déjà accomplie, indiquez-le ci-dessus pour calculer la suite du parcours.')
        : t('Some early offers depend on previous missions or waiting periods. Enter your current rank if you have already started working for this employer.', 'Certaines premières offres dépendent de missions préalables ou de délais. Renseignez votre rang actuel si vous avez déjà commencé à travailler pour cet employeur.')}</p></div></div>}
    </div>

    {leads.length > 0 && <details className="operation-unlock-leads"><summary>{t('Starting contracts to look for', 'Premiers contrats à rechercher')}</summary><p>{t('These contracts can award reputation, but their prerequisites and repeat availability are not fully confirmed. They are not a calculated sequence.', 'Ces contrats peuvent rapporter de la réputation, mais leurs prérequis et leur répétition ne sont pas entièrement confirmés. Ils ne constituent pas une séquence calculée.')}</p><ul>{leads.map((mission) => <li key={mission.id}><strong>{mission.title}</strong><span>+{number(mission.reputationRewards.filter((reward) => reward.trackId === track.id).reduce((sum, reward) => sum + (reward.success ?? 0), 0))} {t('points on success', 'points en cas de réussite')}</span>{mission.description && <details><summary>{t('Mission details', 'Détails de la mission')}</summary><p>{mission.description}</p></details>}</li>)}</ul></details>}
    {hasRankGate && <p className="operation-unlock-help">{t('A rank on this path also requires an additional promotion condition.', 'Un rang de ce parcours exige aussi une condition de promotion supplémentaire.')}</p>}
    <div className="operation-unlock-footer"><p>{gap === 0 ? t('Reputation alone does not confirm that the contract is currently available. Check the other access requirements above.', 'La réputation seule ne confirme pas que le contrat est actuellement disponible. Vérifiez aussi les autres conditions d’accès ci-dessus.') : t('The operation must also be available on your server.', 'L’opération doit aussi être disponible sur votre serveur.')}</p><AppButton href={plannerHref} variant="ghost" size="sm" onClick={(event) => { if (!shouldHandleInternalLinkClick(event)) return; event.preventDefault(); navigateToPath(plannerHref, { mainView: 'missions' }); }}>{t('Advanced planner', 'Planificateur avancé')}</AppButton></div>
  </>;
}

function OperationAccessData({ operation, buildNumber }: { operation: MissionOperation; buildNumber: string }) {
  const { t } = useI18n();
  const text = useOperationText();
  const [goalIndex, setGoalIndex] = useState(0);
  const { data, loading, error, retry } = useMissionSnapshot<MissionIntelligenceData>('intelligence');
  const goals = operation.accessGoals ?? [];
  const goal = goals[goalIndex] ?? goals[0];
  if (loading) return <p className="operation-unlock-help" role="status">{t('Loading the unlock route…', 'Chargement du parcours de déblocage…')}</p>;
  if (error || !data) return <div className="operation-unlock-footer"><p>{t('Unlock information is temporarily unavailable.', 'Les informations de déblocage sont temporairement indisponibles.')}</p><AppButton variant="secondary" size="sm" onClick={retry}>{t('Retry', 'Réessayer')}</AppButton></div>;
  if (String(data.build.buildNumber) !== String(buildNumber)) return <p className="operation-unlock-help">{t('The reputation data does not match this operation’s version. Its route cannot be combined safely.', 'Les réputations et cette opération concernent des versions différentes. Le parcours ne peut pas être calculé.')}</p>;
  const track = data.tracks.find((candidate) => candidate.factionGuid === goal?.factionReputationGuid && candidate.scopeGuid === goal?.scopeGuid);
  if (!goal || !track) return <p className="operation-unlock-help">{t('The reputation associated with this access is not available.', 'La réputation associée à cet accès n’est pas disponible.')}</p>;
  return <>
    {goals.length > 1 ? <div className="operation-unlock-choice"><AppSelect label={t('Access to unlock', 'Accès à débloquer')} value={goalIndex} options={goals.map((entry, index) => ({ value: index, label: text(entry.title) }))} onValueChange={(value) => { if (value !== null) setGoalIndex(value); }} /></div> : operation.id !== 'tactical-strike-groups' && <p className="operation-unlock-scope">{text(goal.title)}</p>}
    <AccessRoute key={`${data.build.buildNumber}:${track.id}:${goal.targetReputation}`} operation={operation} goal={goal} track={track} data={data} />
  </>;
}

/** The player-facing access requirements and route stay next to the operation they unlock. */
export function OperationUnlockPanel({ operation, buildNumber }: { operation: MissionOperation; buildNumber: string }) {
  const { t } = useI18n();
  const titleId = useId();
  const hasGoals = Boolean(operation.accessGoals?.length);
  const text = useOperationText();
  const accessNotes: Record<string, OperationText> = {
    'siege-of-orison': { en: 'Accept the Northrock assault contract while the event is active. The main contract accepts CrimeStat 0–2.', fr: 'Acceptez le contrat d’assaut Northrock pendant l’événement. Le contrat principal accepte un CrimeStat de 0 à 2.' },
    'asd-onyx': { en: 'Start Hockrow’s mission chain and complete its preceding contracts to reach Project Hyperion.', fr: 'Commencez la chaîne de missions de Hockrow, puis terminez les contrats précédents pour accéder à Project Hyperion.' },
    jumptown: { en: 'Choose the legal contract or Ruto’s contract during the event. Follow the delivery destination specified by your contract.', fr: 'Choisissez le contrat légal ou celui de Ruto pendant l’événement. Suivez la destination de livraison indiquée par votre contrat.' },
  };
  return <section className="operation-unlock" aria-labelledby={titleId}>
    <h2 id={titleId}><i className={`pi ${hasGoals ? 'pi-lock' : 'pi-sign-in'}`} aria-hidden="true" />{t('Unlock this operation', 'Débloquer cette opération')}</h2>
    {hasGoals ? <OperationAccessData key={operation.id} operation={operation} buildNumber={buildNumber} /> : <p className="operation-unlock-help">{accessNotes[operation.id] && <>{text(accessNotes[operation.id])}<br /></>}{t('No reputation threshold is confirmed for this operation.', 'Aucun seuil de réputation n’est confirmé pour cette opération.')} {operation.kind === 'event' ? t('Watch for the event contract when it is active on your server.', 'Surveillez le contrat de l’événement lorsqu’il est actif sur votre serveur.') : t('Follow its access and preparation requirements below.', 'Consultez ses conditions d’accès et de préparation ci-dessous.')}</p>}
  </section>;
}
