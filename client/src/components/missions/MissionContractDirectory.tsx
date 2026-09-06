import { useMemo, useState } from 'react';
import { Box, Stack, Typography } from '../../ui/system';
import { useI18n } from '../../i18n/I18nContext';
import { FONT_MONO } from '../../theme';
import { AppButton, AppCheckbox, AppSelect, AppTextField } from '../ui/controls';
import { AppChip } from '../ui/data-display/AppChip';
import { SurfaceState } from '../ui/feedback';
import { Panel } from '../ui/Panel';
import { PageHeader, PageLayout } from '../ui/page';
import { MissionResearchHeader } from './MissionResearchHeader';
import { useMissionSnapshot } from '../../hooks/useMissionSnapshot';
import type { MissionIntelligenceData, MissionIntelligenceMission, MissionIntelligenceTrack } from '../../types/missionIntelligence';
import { navigateToPath } from '../../utils/slug';
import { shouldHandleInternalLinkClick } from '../../utils/spaLinks';

const PAGE_SIZE = 32;
const clean = (text: string) => text.replace(/<\/?EM\d*>/g, '').replace(/~mission\([^)]*\)/g, '…').replace(/ +/g, ' ').trim();
const searchable = (text: string) => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const BLOCKERS: Record<string, [string, string]> = {
  'gated-standing-transition': ['A rank transition needs an additional unlock.', 'Un changement de rang exige un déblocage supplémentaire.'],
  'hidden-contract': ['This contract is hidden in the mission interface.', 'Ce contrat est masqué dans l’interface des missions.'],
  'linear-series-order-unmodeled': ['Its position in a mission series is not modeled.', 'Sa place dans une série de missions n’est pas modélisée.'],
  'not-for-release': ['Marked as unreleased in the source.', 'Marqué comme non publié dans les fichiers.'],
  'personal-cooldown-unmodeled': ['Its personal cooldown is not modeled.', 'Son délai personnel de réapparition n’est pas modélisé.'],
  'requires-nonzero-crimestat': ['Requires a CrimeStat above zero.', 'Exige un CrimeStat supérieur à zéro.'],
  'runtime-reputation': ['The reputation gain is determined at runtime.', 'Le gain de réputation est déterminé en jeu.'],
  'subcontract-prerequisites-unmodeled': ['Subcontract requirements are not modeled.', 'Les prérequis des sous-contrats ne sont pas modélisés.'],
  'template-unresolved': ['The mission template could not be resolved.', 'Le modèle de mission n’a pas pu être résolu.'],
  'unresolved-maximum-standing': ['The upper reputation boundary is unknown.', 'La limite supérieure de réputation est inconnue.'],
  'unresolved-reputation-requirement': ['A reputation requirement could not be resolved.', 'Un prérequis de réputation n’a pas pu être résolu.'],
  'work-in-progress': ['Marked as work in progress in the source.', 'Marqué comme en développement dans les fichiers.'],
};

function ContractDetails({ mission, tracks, tagTitles }: {
  mission: MissionIntelligenceMission;
  tracks: Map<string, MissionIntelligenceTrack>;
  tagTitles: Map<string, string[]>;
}) {
  const { t, lang } = useI18n();
  const number = (value: number | null) => value == null ? t('Unknown', 'Inconnu') : new Intl.NumberFormat(lang, { maximumFractionDigits: 2, signDisplay: 'exceptZero' }).format(value);
  const trackName = (id: string) => { const track = tracks.get(id); return track ? `${track.factionName} · ${track.scopeName}` : t('Unresolved reputation track', 'Axe de réputation non résolu'); };
  const rewards = [...new Map(mission.reputationRewards.map((reward) => [reward.trackId, reward.trackId])).values()];
  const knownSum = (id: string, outcome: 'success' | 'failure' | 'abandon') => {
    const amounts = mission.reputationRewards.filter((reward) => reward.trackId === id).map((reward) => reward[outcome]);
    return amounts.some((amount) => amount == null) ? null : amounts.reduce<number>((sum, amount) => sum + amount!, 0);
  };
  const tags = (ids: string[]) => ids.map((id) => tagTitles.get(id)?.slice(0, 3).map(clean).join(' / ') || t('Unresolved completion condition', 'Condition d’accomplissement non résolue')).join(' · ');
  return <Stack spacing={1.75}>
    <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'pre-line', lineHeight: 1.7 }}>{mission.description ? clean(mission.description) : t('No localized briefing found.', 'Aucun briefing localisé trouvé.')}</Typography>
    {mission.description?.includes('~mission(') && <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t('Ellipses represent destinations, targets or quantities assigned in game.', 'Les points de suspension représentent les destinations, cibles ou quantités attribuées en jeu.')}</Typography>}
    {rewards.length > 0 ? <Box sx={{ overflowX: 'auto' }}><Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', '& th, & td': { textAlign: 'left', p: 1, borderBottom: '1px solid', borderColor: 'ui.border' } }}>
      <thead><tr><th>{t('Reputation', 'Réputation')}</th><th>{t('Success', 'Réussite')}</th><th>{t('Failure', 'Échec')}</th><th>{t('Abandon', 'Abandon')}</th></tr></thead>
      <tbody>{rewards.map((id) => <tr key={id}><td>{trackName(id)}</td><td>{number(knownSum(id, 'success'))}</td><td>{number(knownSum(id, 'failure'))}</td><td>{number(knownSum(id, 'abandon'))}</td></tr>)}</tbody>
    </Box></Box> : <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('No reputation reward is resolved for this contract.', 'Aucun gain de réputation n’est résolu pour ce contrat.')}</Typography>}
    {mission.requirements.length > 0 && <Box><Typography variant="body2" sx={{ fontWeight: 650 }}>{t('Standing conditions', 'Conditions de réputation')}</Typography>
      {mission.requirements.map((requirement, index) => <Typography key={index} variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>{trackName(requirement.trackId)} · {requirement.exclude ? t('Outside this interval', 'En dehors de cet intervalle') : t('Within this interval', 'Dans cet intervalle')} : {requirement.minReputation ?? '?'} ≤ {t('points', 'points')} {requirement.maxReputationExclusive == null ? t('(upper limit unresolved or open)', '(limite supérieure ouverte ou non résolue)') : `< ${requirement.maxReputationExclusive}`}</Typography>)}
    </Box>}
    {(mission.requiredCompletionTags.length > 0 || mission.excludedCompletionTags.length > 0) && <Box sx={{ borderLeft: '3px solid', borderColor: 'warning.main', pl: 1.5 }}>
      <Typography variant="body2" sx={{ fontWeight: 650 }}>{t('Completion history matters', 'L’historique des missions compte')}</Typography>
      {mission.requiredCompletionTags.length > 0 && <Typography variant="body2" sx={{ mt: 0.5 }}>{t('Required completion conditions', 'Conditions d’accomplissement requises')} : {tags(mission.requiredCompletionTags)}</Typography>}
      {mission.excludedCompletionTags.length > 0 && <Typography variant="body2" sx={{ mt: 0.5 }}>{t('Excluded completion conditions', 'Conditions d’accomplissement exclues')} : {tags(mission.excludedCompletionTags)}</Typography>}
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t('These tags are evidence of prerequisites. The planner does not reconstruct your completed missions or the full chain.', 'Ces tags attestent de prérequis. Le planificateur ne reconstitue pas vos missions terminées ni toute la chaîne.')}</Typography>
    </Box>}
    {mission.onceOnly && <Typography variant="body2">{t('One-time contract: completion history is required.', 'Contrat unique : l’historique d’accomplissement est nécessaire.')}</Typography>}
    {mission.cooldownSeconds != null && mission.cooldownSeconds !== 0 && <Typography variant="body2">{t('Declared cooldown', 'Délai déclaré')} : {mission.cooldownSeconds} s</Typography>}
    {mission.plannerBlockers.length > 0 && <Box><Typography variant="body2" sx={{ fontWeight: 650 }}>{t('Calculation limits', 'Limites du calcul')}</Typography><Box component="ul" sx={{ my: 0.5, pl: 2.5 }}>{mission.plannerBlockers.map((blocker) => <li key={blocker}><Typography variant="body2" sx={{ color: 'text.secondary' }}>{BLOCKERS[blocker] ? t(...BLOCKERS[blocker]) : t('An additional prerequisite needs review.', 'Un prérequis supplémentaire doit être vérifié.')}</Typography></li>)}</Box></Box>}
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>{rewards.filter((id) => tracks.has(id)).map((id) => {
      const href = `/missions?${new URLSearchParams({ view: 'reputation', track: id })}`;
      return <AppButton key={id} href={href} size="sm" variant="secondary" onClick={(event) => { if (!shouldHandleInternalLinkClick(event)) return; event.preventDefault(); navigateToPath(href, { mainView: 'missions' }); }}>{t('Explore', 'Explorer')} {trackName(id)}</AppButton>;
    })}</Box>
    <Box component="details" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}><summary>{t('Source record and raw conditions', 'Fichier source et conditions brutes')}</summary>
      <Typography variant="caption" component="p" sx={{ fontFamily: FONT_MONO, overflowWrap: 'anywhere' }}>{mission.sourceFile}<br />{mission.id}</Typography>
      {mission.prerequisites.map((prerequisite, index) => <Typography key={index} variant="caption" component="p" sx={{ overflowWrap: 'anywhere' }}>{prerequisite.type} · {prerequisite.summary}</Typography>)}
      {(mission.requiredCompletionTags.length + mission.excludedCompletionTags.length) > 0 && <Typography variant="caption" component="p" sx={{ fontFamily: FONT_MONO, overflowWrap: 'anywhere' }}>{[...mission.requiredCompletionTags, ...mission.excludedCompletionTags].join(' · ')}</Typography>}
    </Box>
  </Stack>;
}

function DirectoryExplorer({ data }: { data: MissionIntelligenceData }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [employer, setEmployer] = useState('all');
  const [system, setSystem] = useState('all');
  const [includeUnreleased, setIncludeUnreleased] = useState(false);
  const [page, setPage] = useState(0);
  const tracks = useMemo(() => new Map(data.tracks.map((track) => [track.id, track])), [data]);
  const tagTitles = useMemo(() => {
    const result = new Map<string, string[]>();
    data.missions.forEach((mission) => mission.completionTags.forEach((tag) => result.set(tag, [...(result.get(tag) ?? []), mission.title])));
    return result;
  }, [data]);
  const employers = useMemo(() => [...new Set(data.missions.map((mission) => mission.employer).filter((name): name is string => Boolean(name)))].sort(), [data]);
  const systems = useMemo(() => [...new Set(data.missions.flatMap((mission) => mission.systems))].sort(), [data]);
  const visible = useMemo(() => {
    const terms = searchable(query).split(/\s+/).filter(Boolean);
    return data.missions.filter((mission) => (includeUnreleased || (!mission.notForRelease && !mission.workInProgress))
      && (employer === 'all' || mission.employer === employer) && (system === 'all' || mission.systems.includes(system))
      && terms.every((term) => searchable([mission.title, mission.debugName, mission.employer, ...mission.systems].join(' ')).includes(term)))
      .sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  }, [data, query, employer, system, includeUnreleased]);
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const first = currentPage * PAGE_SIZE;
  const updateQuery = (value: string) => { setQuery(value); setPage(0); };
  return <>
    <PageHeader title={t('Contract directory', 'Répertoire des contrats')} eyebrow={t('MISSION CONTROL / ALL CONTRACTS', 'MISSIONS / TOUS LES CONTRATS')}
      description={t('Search every extracted contract, including missions without blueprint rewards. Inspect unlocks and reputation before choosing your next objective.', 'Recherchez tous les contrats extraits, y compris sans récompense de blueprint. Consultez les prérequis et la réputation avant de choisir votre prochain objectif.')} />
    <MissionResearchHeader />
    <Panel><Stack spacing={1.5}>
      <AppTextField type="search" label={t('Search title, employer or system', 'Rechercher un titre, employeur ou système')} placeholder="InterSec, mining, Nyx…" value={query} onValueChange={updateQuery} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
        <AppSelect label={t('Employer', 'Employeur')} filterable value={employer} options={[{ value: 'all', label: t('All employers', 'Tous les employeurs') }, ...employers.map((name) => ({ value: name, label: name }))]} onValueChange={(value) => { setEmployer(value ?? 'all'); setPage(0); }} />
        <AppSelect label={t('System', 'Système')} value={system} options={[{ value: 'all', label: t('All systems', 'Tous les systèmes') }, ...systems.map((name) => ({ value: name, label: name }))]} onValueChange={(value) => { setSystem(value ?? 'all'); setPage(0); }} />
      </Box>
      <AppCheckbox checked={includeUnreleased} onCheckedChange={(value) => { setIncludeUnreleased(value); setPage(0); }} label={t('Include unreleased and work-in-progress records', 'Inclure les contrats non publiés et en développement')} />
    </Stack></Panel>
    <Typography variant="body2" role="status" sx={{ color: 'text.secondary' }}>{visible.length} / {data.missions.length} {t('contract definitions', 'définitions de contrats')} · {t('Presence in this build does not confirm an offer is currently available.', 'La présence dans ce build ne confirme pas qu’une offre est actuellement disponible.')}</Typography>
    {visible.length === 0 ? <SurfaceState title={t('No matching contracts', 'Aucun contrat correspondant')} description={t('Try another search or broaden the filters.', 'Essayez une autre recherche ou élargissez les filtres.')} />
      : <Stack spacing={1.25}>{visible.slice(first, first + PAGE_SIZE).map((mission) => <Panel key={mission.id} title={clean(mission.title)} subtitle={[mission.employer ?? t('Unknown employer', 'Employeur inconnu'), ...mission.systems].join(' · ')} collapsible defaultCollapsed collapseLabel={t('Inspect contract', 'Consulter le contrat')}
        action={<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {(mission.notForRelease || mission.workInProgress) && <AppChip size="small" label={t('Unreleased / WIP', 'Non publié / WIP')} variant="outlined" />}
          {(/~mission\(/.test(mission.title) || ('titleIsTemplated' in mission && mission.titleIsTemplated === true)) && <AppChip size="small" label={t('Dynamic title', 'Nom dynamique')} variant="outlined" />}
        </Box>}><ContractDetails mission={mission} tracks={tracks} tagTitles={tagTitles} /></Panel>)}</Stack>}
    {visible.length > PAGE_SIZE && <Box component="nav" aria-label={t('Contract pages', 'Pages des contrats')} sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
      <AppButton disabled={currentPage === 0} variant="secondary" onClick={() => setPage(currentPage - 1)}>{t('Previous', 'Précédent')}</AppButton>
      <Typography variant="body2">{first + 1}–{Math.min(first + PAGE_SIZE, visible.length)} / {visible.length}</Typography>
      <AppButton disabled={currentPage + 1 === pages} variant="secondary" onClick={() => setPage(currentPage + 1)}>{t('Next', 'Suivant')}</AppButton>
    </Box>}
  </>;
}

export function MissionContractDirectory() {
  const { t } = useI18n();
  const { data, loading, error, retry } = useMissionSnapshot<MissionIntelligenceData>('intelligence');
  return <PageLayout width="wide">{loading ? <SurfaceState tone="loading" title={t('Loading contracts…', 'Chargement des contrats…')} />
    : error || !data ? <SurfaceState tone="error" title={t('Contract data unavailable', 'Contrats indisponibles')} actionLabel={t('Retry', 'Réessayer')} onAction={retry} />
      : <DirectoryExplorer data={data} />}</PageLayout>;
}
