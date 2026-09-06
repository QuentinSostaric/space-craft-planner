import { useState } from 'react';
import { Box, Stack, Typography, alpha, useTheme } from '../../ui/system';
import { useI18n } from '../../i18n/I18nContext';
import { FONT_DISPLAY, FONT_MONO } from '../../theme';
import { AppButton, AppCheckbox, AppTextField } from '../ui/controls';
import { AppChip } from '../ui/data-display/AppChip';
import { SurfaceState } from '../ui/feedback';
import { Panel } from '../ui/Panel';
import { PageHeader, PageLayout } from '../ui/page';
import { PageStatCard } from '../ui/PageStatCard';
import { useMissionSnapshot } from '../../hooks/useMissionSnapshot';
import type { MissionOperation, MissionOperationsData, OperationEvidence, OperationText } from '../../types/missionOperations';
import { MissionResearchHeader } from './MissionResearchHeader';
import { navigateToPath, toSlug } from '../../utils/slug';
import { shouldHandleInternalLinkClick } from '../../utils/spaLinks';
import { useCraft } from '../../store/CraftContext';

function useOperationText() {
  const { lang } = useI18n();
  return (value: OperationText): string => typeof value === 'string' ? value : lang === 'fr' ? value.fr : value.en;
}

function Evidence({ entries }: { entries: OperationEvidence[] }) {
  return <Box component="ul" sx={{ pl: 2, my: 1, display: 'grid', gap: 0.75 }}>
    {entries.map((entry, index) => (
      <li key={`${entry.path ?? entry.url}-${index}`}>
        {entry.url?.startsWith('https://')
          ? <a href={entry.url} target="_blank" rel="noopener noreferrer">{entry.title ?? entry.url}</a>
          : <Typography component="span" variant="caption" sx={{ overflowWrap: 'anywhere', fontFamily: FONT_MONO, color: 'text.secondary' }}>{entry.path}{entry.token ? ` · ${entry.token}` : ''}</Typography>}
      </li>
    ))}
  </Box>;
}

function OperationDossier({ operation, buildNumber }: { operation: MissionOperation; buildNumber: string }) {
  const { t } = useI18n();
  const text = useOperationText();
  const theme = useTheme();
  const { activeDataset } = useCraft();
  const canOpenBlueprints = String(activeDataset.buildNumber) === String(buildNumber) && activeDataset.channel === 'live';
  const storageKey = `itemfab:operation:${buildNumber}:${operation.id}`;
  const [checked, setChecked] = useState<string[]>(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
      return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string' && operation.steps.some((step) => step.id === id)) : [];
    } catch { return []; }
  });
  function save(next: string[]) {
    setChecked(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* The checklist remains usable for this visit. */ }
  }
  const done = checked.length;
  const rewards = [...new Map(operation.contracts.flatMap((contract) => contract.blueprintRewards ?? []).map((pool) => [pool.poolId, pool])).values()];
  return (
    <Stack spacing={2}>
      <Panel sx={{ borderTop: `3px solid ${theme.palette.primary.main}` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ flex: 1, minWidth: 180 }}>
            <Typography variant="overline" sx={{ color: 'primary.main', fontFamily: FONT_MONO }}>{operation.systems.join(' / ')} · {t('Field dossier', 'Dossier de terrain')}</Typography>
            <Typography component="h2" sx={{ fontSize: { xs: '1.65rem', md: '2rem' }, lineHeight: 1.15, fontFamily: FONT_DISPLAY, fontWeight: 750, my: 0.5 }}>{operation.title}</Typography>
            <Typography sx={{ color: 'text.secondary', lineHeight: 1.7, mt: 1 }}>{text(operation.summary)}</Typography>
          </Box>
          <Box sx={{ color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.08), p: 2, borderRadius: 1, textAlign: 'center', minWidth: 94 }}>
            <Typography sx={{ fontSize: '1.75rem', fontFamily: FONT_MONO }}>{done}<Typography component="span" sx={{ fontSize: '1rem', color: 'text.secondary' }}>/{operation.steps.length}</Typography></Typography>
            <Typography variant="caption">{t('steps checked', 'étapes cochées')}</Typography>
          </Box>
        </Box>
        <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'ui.border' }}>
          <Typography variant="body2"><i className="pi pi-users" aria-hidden="true" /> {text(operation.groupGuidance)}</Typography>
        </Box>
      </Panel>

      {operation.requirements.length > 0 && <Panel title={t('Before you leave', 'Avant de partir')}>
        <Box component="ul" sx={{ m: 0, pl: 2.25, display: 'grid', gap: 1 }}>
          {operation.requirements.map((requirement, i) => <li key={i}><Typography variant="body2" sx={{ lineHeight: 1.6 }}>{text(requirement.text)}</Typography></li>)}
        </Box>
      </Panel>}

      {(operation.accessGoals?.length ?? 0) > 0 && <Panel title={t('Plan the unlock', 'Préparer le déblocage')}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
          {operation.accessGoals!.map((goal, index) => {
            const params = new URLSearchParams({ view: 'reputation', track: `${goal.factionReputationGuid}:${goal.scopeGuid}`, target: String(goal.targetReputation), operation: operation.id });
            const href = `/missions?${params}`;
            return <Box key={index} sx={{ border: '1px solid', borderColor: 'ui.border', borderRadius: 1, p: 1.5 }}>
              <Typography sx={{ fontWeight: 650 }}>{text(goal.title)}</Typography>
              <Typography sx={{ fontFamily: FONT_MONO, color: 'primary.main', mt: 1 }}>{goal.targetReputation.toLocaleString()} {t('reputation points', 'points de réputation')}</Typography>
              {goal.buyInUec != null && <Typography variant="body2" sx={{ mt: 0.5 }}>{t('Access cost', 'Coût d’accès')} : {goal.buyInUec.toLocaleString()} aUEC</Typography>}
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1, lineHeight: 1.6 }}>{text(goal.note)}</Typography>
              <AppButton href={href} size="sm" sx={{ mt: 1.5 }} onClick={(event) => { if (!shouldHandleInternalLinkClick(event)) return; event.preventDefault(); navigateToPath(href, { mainView: 'missions' }); }}>{t('Plan this reputation', 'Planifier cette réputation')}</AppButton>
            </Box>;
          })}
        </Box>
      </Panel>}

      <Panel title={t('Your operation checklist', 'Votre parcours sur le terrain')}
        subtitle={t('Check off your progress. Saved on this device for this build.', 'Cochez votre progression. Mémorisée sur cet appareil pour ce build.')}
        action={<AppButton size="sm" variant="ghost" disabled={done === 0} onClick={() => save([])}>{t('Reset', 'Réinitialiser')}</AppButton>}>
        <Box role="progressbar" aria-label={t('Operation progress', 'Progression de l’opération')} aria-valuemin={0} aria-valuemax={operation.steps.length || 1} aria-valuenow={done}
          sx={{ height: 4, bgcolor: 'ui.border', mb: 2, borderRadius: 2, overflow: 'hidden' }}>
          <Box sx={{ height: '100%', width: `${operation.steps.length ? done / operation.steps.length * 100 : 0}%`, bgcolor: 'primary.main', transition: 'width 180ms ease' }} />
        </Box>
        <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {operation.steps.map((step, index) => {
            const isDone = checked.includes(step.id);
            return <Box component="li" key={step.id} sx={{ display: 'flex', gap: 1.5, py: 2, borderTop: index ? '1px solid' : 'none', borderColor: 'ui.border' }}>
              <Box sx={{ fontFamily: FONT_MONO, color: isDone ? 'primary.main' : 'text.disabled', minWidth: 25, pt: 0.1 }}>{String(index + 1).padStart(2, '0')}</Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <AppCheckbox checked={isDone} onCheckedChange={(value) => save(value ? [...new Set([...checked, step.id])] : checked.filter((id) => id !== step.id))}
                  label={<Typography component="span" sx={{ fontWeight: 650, textDecoration: isDone ? 'line-through' : 'none', color: isDone ? 'text.secondary' : 'text.primary' }}>{text(step.title)}</Typography>} />
                {step.optional && <AppChip label={t('Optional', 'Facultatif')} size="small" variant="outlined" sx={{ ml: 1 }} />}
                <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, mt: 0.75 }}>{text(step.description)}</Typography>
                {step.dependsOn.length > 0 && <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
                  {t('After', 'Après')} : {step.dependsOn.map((id) => operation.steps.find((candidate) => candidate.id === id)).filter((candidate) => candidate != null).map((candidate) => text(candidate.title)).join(' · ')}
                </Typography>}
                {step.evidence.length > 0 && <Box component="details" sx={{ mt: 1, fontSize: '0.75rem', color: 'text.secondary' }}>
                  <summary style={{ cursor: 'pointer' }}>{t('Source of this step', 'Source de cette étape')}</summary>
                  <Evidence entries={step.evidence} />
                </Box>}
              </Box>
            </Box>;
          })}
        </Box>
      </Panel>

      {operation.caveats.length > 0 && <Panel title={t('What to verify in game', 'À vérifier en jeu')} accent={theme.palette.warning.main}>
        <Box component="ul" sx={{ m: 0, pl: 2.25, display: 'grid', gap: 1 }}>
          {operation.caveats.map((caveat, index) => <li key={index}><Typography variant="body2" sx={{ lineHeight: 1.7 }}>{text(caveat)}</Typography></li>)}
        </Box>
      </Panel>}

      {rewards.length > 0 && <Panel title={t('Blueprint reward pools', 'Pools de récompenses blueprints')}>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>{t('Rewards depend on the contract variant. A pool roll does not guarantee each blueprint.', 'Les récompenses dépendent de la variante du contrat. Un tirage dans un pool ne garantit pas chaque blueprint.')}</Typography>
        {rewards.map((pool, index) => <Box component="details" key={pool.poolId} sx={{ py: 1, overflowWrap: 'anywhere' }}>
          <summary style={{ cursor: 'pointer' }}>{t('Reward group', 'Groupe de récompenses')} {index + 1} · {pool.blueprints.length} blueprints</summary>
          <Box component="ul" sx={{ pl: 2.5 }}>{pool.blueprints.map((blueprint) => <li key={blueprint.id}><Typography variant="body2">{canOpenBlueprints && !blueprint.name.startsWith('BP_') ? <a href={`/item/${toSlug(blueprint.name)}`}>{blueprint.name}</a> : blueprint.name}</Typography></li>)}</Box>
        </Box>)}
      </Panel>}

      <Panel title={t('Contracts & evidence', 'Contrats et sources')} collapsible defaultCollapsed collapseLabel={t('Show contracts and sources', 'Afficher les contrats et sources')}>
        <Typography variant="body2" sx={{ mb: 1.5, color: 'text.secondary' }}>{operation.contracts.length} {t('contract variants identified in this build.', 'variantes de contrats identifiées dans ce build.')}</Typography>
        {operation.contracts.map((contract) => <Box component="details" key={contract.id} sx={{ py: 1.25, borderBottom: '1px solid', borderColor: 'ui.border' }}>
          <summary style={{ cursor: 'pointer', overflowWrap: 'anywhere' }}>{contract.title || contract.debugName}</summary>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-line', color: 'text.secondary', mt: 1 }}>{contract.description}</Typography>
          <Typography variant="caption" sx={{ display: 'block', mt: 1, overflowWrap: 'anywhere' }}>{contract.recordPath} · {contract.debugName}</Typography>
        </Box>)}
        <Evidence entries={operation.sources} />
        {(operation.unavailableContracts?.length ?? 0) > 0 && <Typography variant="caption" sx={{ color: 'text.secondary' }}>{operation.unavailableContracts!.length} {t('unreleased variants excluded from the checklist.', 'variantes non publiables exclues du parcours.')}</Typography>}
      </Panel>
    </Stack>
  );
}

function OperationsExplorer({ data }: { data: MissionOperationsData }) {
  const { t } = useI18n();
  const text = useOperationText();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(new URLSearchParams(window.location.search).get('operation') ?? data.operations[0]?.id ?? '');
  const selected = data.operations.find((operation) => operation.id === selectedId) ?? data.operations[0];
  const visible = data.operations.filter((operation) => `${operation.title} ${text(operation.subtitle)} ${operation.systems.join(' ')} ${text(operation.summary)}`.toLocaleLowerCase().includes(search.toLocaleLowerCase().trim()));
  return <>
    <PageHeader title={t('Operations & events', 'Opérations & événements')}
      eyebrow={t('MISSION CONTROL / FIELD OPERATIONS', 'MISSIONS / OPÉRATIONS DE TERRAIN')}
      description={t('Prepare a major operation, understand its prerequisites and keep your place in the sequence.', 'Préparez une grande opération, identifiez ses prérequis et gardez le fil des objectifs.')}
      stats={<>
        <PageStatCard label={t('Operations', 'Opérations')} value={String(data.summary.operationCount)} domain="blue" />
        <PageStatCard label={t('Contract variants', 'Variantes de contrats')} value={String(data.summary.contractCount)} domain="magenta" />
        <PageStatCard label={t('Documented steps', 'Étapes documentées')} value={String(data.summary.stepCount)} />
      </>} />
    <MissionResearchHeader />
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(250px, 300px) minmax(0, 1fr)' }, alignItems: 'start', gap: 2 }}>
      <Panel title={t('Choose your operation', 'Choisir une opération')}>
        <AppTextField type="search" label={t('Search operations', 'Rechercher une opération')} value={search} onValueChange={setSearch} placeholder="QV, Orison, Onyx…" />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: '1fr' }, gap: 1, mt: 1.5 }}>
          {visible.map((operation) => <AppButton key={operation.id} ariaPressed={selected?.id === operation.id} variant={selected?.id === operation.id ? 'primary' : 'ghost'} onClick={() => setSelectedId(operation.id)} sx={{ justifyContent: 'flex-start', textAlign: 'left', py: 1.5, whiteSpace: 'normal', width: '100%' }}>
            <span><span style={{ display: 'block', fontWeight: 700 }}>{operation.title}</span><span style={{ display: 'block', marginTop: 5, fontSize: '0.75rem', opacity: 0.85 }}>{operation.systems.join(' / ')} · {operation.steps.length} {t('steps', 'étapes')}</span></span>
          </AppButton>)}
        </Box>
        {visible.length === 0 && <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>{t('No matching operation.', 'Aucune opération correspondante.')}</Typography>}
      </Panel>
      {selected && <OperationDossier key={`${data.build.buildNumber}:${selected.id}`} operation={selected} buildNumber={data.build.buildNumber} />}
    </Box>
  </>;
}

export function MissionOperationsPanel() {
  const { t } = useI18n();
  const { data, loading, error, retry } = useMissionSnapshot<MissionOperationsData>('operations');
  return <PageLayout width="wide">
    {loading ? <SurfaceState tone="loading" title={t('Loading operation dossiers…', 'Chargement des dossiers d’opérations…')} />
      : error || !data ? <SurfaceState tone="error" title={t('Operation dossiers unavailable', 'Dossiers d’opérations indisponibles')} actionLabel={t('Retry', 'Réessayer')} onAction={retry} />
        : <OperationsExplorer data={data} />}
  </PageLayout>;
}
