import { useMemo, useState } from 'react';
import { Box, Stack, Typography, alpha, useTheme } from '../../ui/system';
import { useI18n } from '../../i18n/I18nContext';
import { FONT_DISPLAY, FONT_MONO } from '../../theme';
import { AppButton, AppCheckbox, AppSelect, AppTextField, AppToggleGroup } from '../ui/controls';
import { AppChip } from '../ui/data-display/AppChip';
import { SurfaceState } from '../ui/feedback';
import { Panel } from '../ui/Panel';
import { PageHeader, PageLayout } from '../ui/page';
import { PageStatCard } from '../ui/PageStatCard';
import { useMissionSnapshot } from '../../hooks/useMissionSnapshot';
import { getMissionRouteCandidates, planMissionRoute } from '../../utils/missionRoutePlanner';
import type { MissionIntelligenceData, MissionIntelligenceTrack, MissionRouteInput, MissionRouteMode, MissionRouteResult } from '../../types/missionIntelligence';
import { MissionResearchHeader } from './MissionResearchHeader';
import { missionExclusionLabel } from '../../utils/missionLabels';

function formatMinutes(minutes: number) {
  const rounded = Math.round(minutes);
  return rounded < 60 ? `${rounded} min` : `${Math.floor(rounded / 60)} h ${String(rounded % 60).padStart(2, '0')}`;
}

interface PlannerSettings {
  current: string;
  target: string;
  mode: MissionRouteMode;
  duration: string;
  overrides: Record<string, number>;
  system: string;
  includesRefreshWait: boolean;
}

function initialSettings(track: MissionIntelligenceTrack): PlannerSettings {
  const current = track.initialReputation ?? 0;
  const next = track.standings.filter((standing) => standing.minReputation !== null && standing.minReputation > current).sort((a, b) => a.minReputation! - b.minReputation!)[0];
  return { current: String(current), target: String(next?.minReputation ?? current + 750), mode: 'count', duration: '15', overrides: {}, system: 'all', includesRefreshWait: false };
}

function settingsForEntry(track: MissionIntelligenceTrack, key: string): PlannerSettings {
  const settings = readSettings(key, initialSettings(track));
  const params = new URLSearchParams(window.location.search);
  const target = params.get('target');
  if (params.get('track') === track.id && target?.trim() && Number.isFinite(Number(target)) && Number(target) >= 0 && (track.reputationCeiling == null || Number(target) <= track.reputationCeiling)) {
    return { ...settings, target };
  }
  return settings;
}

function readSettings(key: string, fallback: PlannerSettings): PlannerSettings {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!value || typeof value !== 'object') return fallback;
    return {
      current: typeof value.current === 'string' ? value.current : fallback.current,
      target: typeof value.target === 'string' ? value.target : fallback.target,
      duration: typeof value.duration === 'string' ? value.duration : fallback.duration,
      mode: value.mode === 'count' ? 'count' : 'time',
      system: typeof value.system === 'string' ? value.system : 'all',
      includesRefreshWait: value.includesRefreshWait === true,
      overrides: value.overrides && typeof value.overrides === 'object' ? Object.fromEntries(Object.entries(value.overrides).filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]) && entry[1] > 0)) : {},
    };
  } catch { return fallback; }
}

function TrackPlanner({ data, track }: { data: MissionIntelligenceData; track: MissionIntelligenceTrack }) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const number = (value: number) => new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(value);
  const storageKey = `itemfab:mission-route:${data.build.buildNumber}:${track.id}`;
  const [settings, setSettings] = useState(() => settingsForEntry(track, storageKey));
  const [route, setRoute] = useState<MissionRouteResult | null>(null);
  const [showCount, setShowCount] = useState(12);
  function update(patch: Partial<PlannerSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    setRoute(null);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* State remains available during this visit. */ }
  }
  const trackMissions = useMemo(() => data.missions.filter((mission) => mission.reputationRewards.some((reward) => reward.trackId === track.id)), [data, track.id]);
  const systems = [...new Set(trackMissions.flatMap((mission) => mission.systems))].sort();
  const missions = settings.system === 'all' ? trackMissions : trackMissions.filter((mission) => mission.systems.includes(settings.system));
  const current = settings.current.trim() ? Number(settings.current) : NaN;
  const target = settings.target.trim() ? Number(settings.target) : NaN;
  const input: MissionRouteInput = {
    missions, trackId: track.id, currentReputation: current, targetReputation: target,
    mode: settings.mode, defaultDurationMinutes: settings.duration.trim() ? Number(settings.duration) : undefined,
    durationMinutesByMissionId: settings.overrides,
    reputationCeiling: track.reputationCeiling,
    timingIncludesRefreshWait: settings.includesRefreshWait,
  };
  const { candidates, excludedMissions } = getMissionRouteCandidates(input);
  // Count mode includes untimed missions in the editable comparison list.
  const comparison = getMissionRouteCandidates({ ...input, mode: 'count' }).candidates.sort((a, b) => b.reputationGain - a.reputationGain || a.mission.title.localeCompare(b.mission.title));
  const standings = track.standings.filter((standing) => standing.minReputation !== null && standing.minReputation >= 0).sort((a, b) => a.minReputation! - b.minReputation!);
  const valid = Number.isFinite(current) && Number.isFinite(target) && target >= 0 && (track.reputationCeiling == null || (target <= track.reputationCeiling && current <= track.reputationCeiling));
  const rankTarget = standings.find((standing) => standing.minReputation === target);
  const hasGatedStanding = standings.some((standing) => standing.gated && standing.minReputation! > current && standing.minReputation! <= target);
  const gap = Number.isFinite(target - current) ? Math.max(0, target - current) : 0;
  return <>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(280px, 350px) minmax(0, 1fr)' }, gap: 2, alignItems: 'start' }}>
      <Stack spacing={2}>
        <Panel title={t('Set your destination', 'Définir votre objectif')} eyebrow={t('01 / YOUR PROGRESS', '01 / VOTRE PROGRESSION')}>
          <Stack spacing={1.5}>
            <AppTextField label={t('Current reputation points', 'Points de réputation actuels')} type="number" step={1} value={settings.current} onValueChange={(value) => update({ current: value })}
              helperText={t('Use a known value, or a rank threshold as an approximation.', 'Renseignez une valeur connue, ou le seuil de votre rang comme approximation.')} />
            <AppSelect label={t('Target rank threshold', 'Seuil du rang visé')} value={rankTarget?.id ?? null}
              options={standings.map((standing) => ({ value: standing.id, label: `${standing.name ?? t('Rank', 'Rang')} · ${number(standing.minReputation!)}${standing.gated ? ' *' : ''}` }))}
              onValueChange={(id) => { const standing = standings.find((candidate) => candidate.id === id); if (standing) update({ target: String(standing.minReputation) }); }} placeholder={t('Custom target', 'Objectif personnalisé')} />
            <AppTextField label={t('Target reputation points', 'Objectif en points')} type="number" min={0} max={track.reputationCeiling ?? undefined} value={settings.target} onValueChange={(value) => update({ target: value })}
              error={!valid ? t('Enter valid points and a nonnegative target within the track ceiling.', 'Renseignez des points valides et un objectif positif ou nul dans le plafond de cette réputation.') : undefined} />
            <AppSelect label={t('Mission system', 'Système des missions')} value={settings.system} options={[{ value: 'all', label: t('All extracted systems', 'Tous les systèmes extraits') }, ...systems.map((system) => ({ value: system, label: system }))]} onValueChange={(value) => update({ system: value ?? 'all' })} />
          </Stack>
        </Panel>
        <Panel title={t('Choose your strategy', 'Choisir votre stratégie')} eyebrow={t('02 / OPTIMIZATION', '02 / OPTIMISATION')}>
          <Stack spacing={1.5}>
            <AppToggleGroup value={settings.mode} onValueChange={(mode) => update({ mode })} ariaLabel={t('Optimization goal', 'Objectif d’optimisation')}
              options={[{ value: 'time', label: t('Fastest time', 'Temps minimal') }, { value: 'count', label: t('Fewest missions', 'Moins de missions') }]} />
            <AppTextField type="number" min={0.1} step={1} label={t('Default time per mission (min)', 'Durée par défaut par mission (min)')} value={settings.duration} onValueChange={(value) => update({ duration: value })}
              helperText={t('Assumption: 15 min initially. Include preparation and travel; refine each mission below.', 'Hypothèse initiale : 15 min. Incluez préparation et trajet ; affinez chaque mission plus bas.')} />
            {settings.mode === 'time' && <AppCheckbox checked={settings.includesRefreshWait} onCheckedChange={(includesRefreshWait) => update({ includesRefreshWait })}
              label={t('My times include waiting for mission offers', 'Mes durées incluent l’attente des offres')}
              description={t('Include missions with a configured offer refresh. Its real delay is not known; supply your own full cycle time.', 'Inclure les missions soumises à un renouvellement des offres. Son délai réel est inconnu ; estimez le cycle complet.')} />}
            <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>{t('The calculation assumes 100% completion of repeatable missions, CrimeStat 0 and the stated availability. It optimizes only the eligible missions below.', 'Le calcul suppose des missions accomplies à 100 %, répétables, un CrimeStat de 0 et les disponibilités indiquées. Il optimise uniquement les missions admissibles ci-dessous.')}</Typography>
            <AppButton variant="primary" fullWidth disabled={!valid} onClick={() => setRoute(planMissionRoute(input))} startIcon={<i className="pi pi-directions" aria-hidden="true" />}>
              {t('Calculate my route', 'Calculer mon parcours')}
            </AppButton>
          </Stack>
        </Panel>
      </Stack>

      <Stack spacing={2}>
        <Panel sx={{ borderTop: `3px solid ${theme.palette.primary.main}` }}>
          <Typography variant="overline" sx={{ fontFamily: FONT_MONO, color: 'primary.main' }}>{track.factionName} / {track.scopeName}</Typography>
          <Typography component="h2" sx={{ fontFamily: FONT_DISPLAY, fontWeight: 750, fontSize: { xs: '1.5rem', md: '2rem' }, mt: 0.5 }}>{t('A clear path to your next rank', 'Un parcours vers votre prochain rang')}</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1.5, mt: 2 }}>
            {[
              { label: t('Points to earn', 'Points à gagner'), value: number(gap) },
              { label: t('Eligible missions', 'Missions admissibles'), value: String(candidates.length) },
              { label: t('Excluded variants', 'Variantes exclues'), value: String(excludedMissions.length) },
            ].map((stat) => <Box key={stat.label}><Typography sx={{ fontFamily: FONT_MONO, color: 'primary.main', fontSize: { xs: '1.3rem', md: '1.8rem' } }}>{stat.value}</Typography><Typography variant="caption" sx={{ color: 'text.secondary' }}>{stat.label}</Typography></Box>)}
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 2 }}>
            {standings.map((standing) => <AppChip key={standing.id} label={`${standing.name ?? '—'} · ${number(standing.minReputation!)}${standing.gated ? ' *' : ''}`} variant="outlined" size="small" color={standing.minReputation! <= current ? 'success' : 'default'} />)}
          </Box>
          {standings.some((standing) => standing.gated) && <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>{t('* Gated standing: reaching the points may also require an in-game unlock.', '* Rang verrouillé : atteindre le seuil peut aussi nécessiter un déblocage en jeu.')}</Typography>}
        </Panel>

        <Panel title={t('Your calculated route', 'Votre parcours calculé')} eyebrow={t('03 / FLIGHT PLAN', '03 / PLAN DE MISSION')}>
          {!route ? <Box sx={{ py: 4, textAlign: 'center' }}>
            <i className="pi pi-directions" aria-hidden="true" style={{ fontSize: '2rem', color: theme.palette.primary.main }} />
            <Typography sx={{ mt: 1.5, fontWeight: 600 }}>{t('Choose a target, then calculate your route.', 'Choisissez un objectif, puis calculez votre parcours.')}</Typography>
            <Typography variant="body2" sx={{ mt: 0.75, color: 'text.secondary' }}>{t('The planner compares sequences and unlocks, including a change of mission at higher ranks.', 'Le planificateur compare les séquences et les seuils de déblocage, y compris un changement de mission aux rangs supérieurs.')}</Typography>
          </Box> : route.status !== 'optimal' ? <SurfaceState title={route.status === 'bounded' ? t('Search limit reached', 'Limite de recherche atteinte') : t('No verified route for this target', 'Aucun parcours vérifié pour cet objectif')}
            description={t('Try a nearer rank, enter missing durations or review the excluded mission prerequisites. No route is invented across an unknown gate.', 'Essayez un rang plus proche, complétez les durées ou consultez les prérequis des missions exclues. Aucun parcours n’est inventé à travers un verrou inconnu.')} />
            : <Box aria-live="polite">
              <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                <Box><Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 750, fontSize: '1.8rem', color: 'primary.main' }}>{route.totalRuns} {t('missions', 'missions')}</Typography><Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('Optimal within the selected model', 'Optimal dans le modèle sélectionné')}</Typography></Box>
                <Box sx={{ textAlign: 'right' }}><Typography sx={{ fontFamily: FONT_MONO, fontSize: '1.5rem' }}>{route.totalMinutes === null ? '—' : formatMinutes(route.totalMinutes)}</Typography><Typography variant="caption" sx={{ color: 'text.secondary' }}>{t('Estimated from your durations', 'Estimation selon vos durées')}</Typography></Box>
              </Box>
              {route.steps.length === 0 && <Typography>{t('The target is already reached.', 'L’objectif est déjà atteint.')}</Typography>}
              {route.steps.map((step, index) => <Box key={`${step.missionId}-${index}`} sx={{ display: 'flex', gap: 1.5, borderTop: '1px solid', borderColor: 'ui.border', py: 2 }}>
                <Box sx={{ minWidth: 32, height: 32, display: 'grid', placeItems: 'center', bgcolor: alpha(theme.palette.primary.main, 0.12), color: 'primary.main', fontFamily: FONT_MONO, borderRadius: '50%' }}>{index + 1}</Box>
                <Box sx={{ flex: 1, minWidth: 0 }}><Typography sx={{ fontWeight: 650 }}>{step.title}</Typography><Typography variant="caption" sx={{ color: 'text.secondary' }}>{missions.find((mission) => mission.id === step.missionId)?.systems.join(' / ')}</Typography><Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>{number(step.reputationBefore)} → {number(step.reputationAfter)} {t('rep', 'rép')} · +{number(step.reputationGain)}</Typography></Box>
                <Box sx={{ textAlign: 'right', flexShrink: 0 }}><Typography sx={{ fontFamily: FONT_MONO }}>×{step.count}</Typography><Typography variant="caption" sx={{ color: 'text.secondary' }}>{step.minutes === null ? '—' : formatMinutes(step.minutes)}</Typography></Box>
              </Box>)}
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 1 }}>{t('Success-only simulation. Times are assumptions, not measured game data. Mission availability, failures and travel between different sites can change the result.', 'Simulation de réussites. Les durées sont des hypothèses, pas des mesures en jeu. La disponibilité, les échecs et les déplacements entre sites peuvent modifier le résultat.')}</Typography>
              {hasGatedStanding && <Typography variant="body2" sx={{ mt: 1, color: 'warning.main' }}>{t('This target crosses a gated standing. This route estimates points only; the certification remains to be verified in game.', 'Cet objectif traverse un rang verrouillé. Ce parcours estime uniquement les points ; la certification reste à vérifier en jeu.')}</Typography>}
            </Box>}
        </Panel>
      </Stack>
    </Box>

    <Panel title={t('Compare missions & refine your times', 'Comparer les missions et affiner vos durées')}
      subtitle={t('A personal time estimate can change the fastest route. Requirements are checked again after every mission.', 'Une durée personnelle peut changer le parcours le plus rapide. Les prérequis sont revérifiés après chaque mission.')}>
      {comparison.length === 0 ? <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('No mission on this track has enough verified data for route calculation. Review the exclusions below.', 'Aucune mission de cette réputation ne dispose de données suffisantes pour le calcul. Consultez les exclusions ci-dessous.')}</Typography> : <>
        <Box sx={{ overflowX: 'auto' }}>
          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', minWidth: 640, '& th': { textAlign: 'left', color: 'text.secondary', fontWeight: 500, fontSize: '0.75rem', pb: 1.25 }, '& td': { py: 1.25, pr: 1.5, borderTop: '1px solid', borderColor: 'ui.border', verticalAlign: 'top' } }}>
            <thead><tr>{[t('Mission / location', 'Mission / lieu'), t('Success', 'Réussite'), t('Failure', 'Échec'), t('Standing range', 'Intervalle de réputation'), t('Your time (min)', 'Votre durée (min)')].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
            <tbody>{comparison.slice(0, showCount).map(({ mission, reputationGain }) => {
              const rewards = mission.reputationRewards.filter((reward) => reward.trackId === track.id);
              const failure = rewards.every((reward) => reward.failure !== null) ? rewards.reduce((sum, reward) => sum + reward.failure!, 0) : null;
              const requirements = mission.requirements.filter((requirement) => requirement.trackId === track.id);
              return <tr key={mission.id}>
                <td><Typography variant="body2" sx={{ fontWeight: 600 }}>{mission.title}</Typography><Typography variant="caption" sx={{ color: 'text.secondary' }}>{mission.systems.join(' / ') || t('Location unresolved', 'Lieu non résolu')}</Typography>
                  <Box component="details" sx={{ mt: 0.75, fontSize: '0.75rem', color: 'text.secondary' }}><summary style={{ cursor: 'pointer' }}>{t('Mission details', 'Détails de la mission')}</summary><Typography variant="body2" sx={{ mt: 1, maxWidth: '65ch', whiteSpace: 'pre-line' }}>{mission.description}</Typography><Typography variant="caption" sx={{ display: 'block', mt: 1, overflowWrap: 'anywhere' }}>{mission.sourceFile} · {mission.debugName}</Typography></Box>
                </td>
                <td><Typography sx={{ fontFamily: FONT_MONO, color: 'primary.main' }}>+{number(reputationGain)}</Typography></td>
                <td><Typography sx={{ fontFamily: FONT_MONO, color: failure && failure < 0 ? 'warning.main' : 'text.secondary' }}>{failure === null ? '?' : number(failure)}</Typography></td>
                <td><Typography variant="body2" sx={{ fontFamily: FONT_MONO }}>{requirements.length ? requirements.map((requirement) => `${requirement.exclude ? '∉' : ''}[${requirement.minReputation === null ? '−∞' : number(requirement.minReputation)}; ${requirement.maxReputationExclusive === null ? '+∞' : number(requirement.maxReputationExclusive)}[`).join(' ∩ ') : t('No standing gate', 'Sans seuil')}</Typography></td>
                <td><AppTextField type="number" min={0.1} step={1} ariaLabel={`${t('Duration for', 'Durée de')} ${mission.title}`} value={settings.overrides[mission.id] === undefined ? '' : String(settings.overrides[mission.id])} placeholder={settings.duration || '—'} sx={{ width: 96 }}
                  onValueChange={(value) => { const overrides = { ...settings.overrides }; if (!value.trim()) delete overrides[mission.id]; else overrides[mission.id] = Number(value); update({ overrides }); }} /></td>
              </tr>;
            })}</tbody>
          </Box>
        </Box>
        {comparison.length > showCount && <AppButton sx={{ mt: 2 }} onClick={() => setShowCount((count) => count + 20)}>{t('Show more missions', 'Afficher plus de missions')} ({comparison.length - showCount})</AppButton>}
      </>}
    </Panel>

    {excludedMissions.length > 0 && <Panel title={`${t('Excluded from this calculation', 'Exclues de ce calcul')} · ${excludedMissions.length}`} collapsible defaultCollapsed collapseLabel={t('Show excluded missions', 'Afficher les missions exclues')}
      subtitle={t('Missing rewards, unmodeled prerequisites, one-off missions and cooldowns remain visible for investigation.', 'Les gains inconnus, prérequis non modélisés, missions uniques et délais de réapparition restent visibles pour investigation.')}>
      <Box sx={{ maxHeight: 440, overflowY: 'auto' }}>
        {excludedMissions.map((mission) => <Box key={mission.missionId} sx={{ py: 1.25, borderBottom: '1px solid', borderColor: 'ui.border' }}><Typography variant="body2" sx={{ fontWeight: 600 }}>{mission.title}</Typography><Typography variant="caption" sx={{ color: 'text.secondary' }}>{mission.reasons.map((reason) => missionExclusionLabel(reason, lang)).join(' · ')}</Typography></Box>)}
      </Box>
    </Panel>}
  </>;
}

function ProgressionExplorer({ data }: { data: MissionIntelligenceData }) {
  const { t } = useI18n();
  const tracks = useMemo(() => data.tracks.filter((track) => data.missions.some((mission) => mission.reputationRewards.some((reward) => reward.trackId === track.id))).sort((a, b) => a.factionName.localeCompare(b.factionName) || a.scopeName.localeCompare(b.scopeName)), [data]);
  const [trackId, setTrackId] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('track');
    if (tracks.some((track) => track.id === requested)) return requested!;
    const supported = tracks.map((track) => ({ track, count: getMissionRouteCandidates({ missions: data.missions, trackId: track.id, currentReputation: 0, targetReputation: 750, mode: 'count' }).candidates.length }));
    return supported.find((entry) => /highpoint/i.test(entry.track.factionName) && entry.track.scopeName === 'Standing' && entry.count > 0)?.track.id
      ?? supported.sort((a, b) => b.count - a.count)[0]?.track.id ?? '';
  });
  const track = tracks.find((candidate) => candidate.id === trackId) ?? tracks[0];
  return <>
    <PageHeader title={t('Reputation planner', 'Progression de réputation')} eyebrow={t('MISSION CONTROL / REPUTATION', 'MISSIONS / RÉPUTATION')}
      description={t('Choose who you work for, set your target rank and compare the mission sequences that get you there.', 'Choisissez pour qui travailler, fixez votre rang cible et comparez les séquences de missions pour l’atteindre.')}
      stats={<><PageStatCard label={t('Mined contracts', 'Contrats analysés')} value={String(data.missions.length)} domain="blue" /><PageStatCard label={t('Reputation tracks', 'Axes de réputation')} value={String(tracks.length)} domain="magenta" /><PageStatCard label={t('Source build', 'Build source')} value="4.10 LIVE" /></>} />
    <MissionResearchHeader />
    <Panel><AppSelect label={t('Reputation to progress', 'Réputation à faire progresser')} filterable value={track?.id ?? null}
      options={tracks.map((candidate) => ({ value: candidate.id, label: `${candidate.factionName} · ${candidate.scopeName}` }))} onValueChange={(value) => { if (value) setTrackId(value); }} /></Panel>
    {track ? <TrackPlanner key={`${data.build.buildNumber}:${track.id}`} data={data} track={track} /> : <SurfaceState title={t('No reputation tracks found', 'Aucun axe de réputation trouvé')} />}
  </>;
}

export function MissionProgressionPanel() {
  const { t } = useI18n();
  const { data, loading, error, retry } = useMissionSnapshot<MissionIntelligenceData>('intelligence');
  return <PageLayout width="wide">
    {loading ? <SurfaceState tone="loading" title={t('Loading reputation data…', 'Chargement des réputations…')} />
      : error || !data ? <SurfaceState tone="error" title={t('Reputation data unavailable', 'Données de réputation indisponibles')} actionLabel={t('Retry', 'Réessayer')} onAction={retry} />
        : <ProgressionExplorer data={data} />}
  </PageLayout>;
}
