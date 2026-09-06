import { useState } from 'react';
import { Box, Stack, Typography, alpha, useTheme } from '../../ui/system';
import { useI18n } from '../../i18n/I18nContext';
import { FONT_DISPLAY, FONT_MONO } from '../../theme';
import { AppButton, AppCheckbox } from '../ui/controls';
import { SurfaceState } from '../ui/feedback';
import { Panel } from '../ui/Panel';
import { PageHeader, PageLayout } from '../ui/page';
import { useMissionSnapshot } from '../../hooks/useMissionSnapshot';
import type { MissionOperation, MissionOperationsData, OperationText } from '../../types/missionOperations';
import { OperationScene, operationIcon } from './OperationScene';
import './mission-operations.css';
import { gameplayDescription, gameplayTeam } from './operationGameplay';
import { navigateToPath, toSlug } from '../../utils/slug';
import { shouldHandleInternalLinkClick } from '../../utils/spaLinks';
import { useCraft } from '../../store/CraftContext';

function useOperationText() {
  const { lang } = useI18n();
  return (value: OperationText): string => typeof value === 'string' ? value : lang === 'fr' ? value.fr : value.en;
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
  const [activeStep, setActiveStep] = useState(0);
  const done = checked.length;
  const current = operation.steps[activeStep];
  const rewards = [...new Map(operation.contracts.flatMap((contract) => contract.blueprintRewards ?? []).map((pool) => [pool.poolId, pool])).values()];
  return (
    <Stack spacing={2}>
      <Panel dense sx={{ borderTop: `3px solid ${theme.palette.primary.main}` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ flex: 1, minWidth: 120 }}>
            <Typography variant="overline" sx={{ color: 'primary.main', fontFamily: FONT_MONO }}>{operation.systems.join(' / ')} · {t('Operation', 'Opération')}</Typography>
            <Typography component="h2" sx={{ fontSize: { xs: '1.65rem', md: '1.6rem' }, lineHeight: 1.15, fontFamily: FONT_DISPLAY, fontWeight: 750, my: 0.5 }}>{operation.title}</Typography>
            <Typography sx={{ color: 'text.secondary', lineHeight: 1.7, mt: 1 }}>{text(operation.subtitle)}</Typography>
          </Box>
          <Box sx={{ color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.08), p: 1, borderRadius: 1, textAlign: 'center', minWidth: 64 }}>
            <Typography sx={{ fontSize: '1.75rem', fontFamily: FONT_MONO }}>{done}<Typography component="span" sx={{ fontSize: '1rem', color: 'text.secondary' }}>/{operation.steps.length}</Typography></Typography>
            <Typography variant="caption">{t('steps checked', 'étapes cochées')}</Typography>
          </Box>
        </Box>
        <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'ui.border' }}>
          <Typography variant="body2"><i className="pi pi-users" aria-hidden="true" /> {text(gameplayTeam(operation))}</Typography>
        </Box>
      </Panel>

      <section className="operation-console">
        <OperationScene operation={operation} checked={checked} activeStep={activeStep} onSelect={setActiveStep} />
        <div className="operation-console-heading"><span>{t('Your route', 'Votre parcours')}</span><AppButton size="sm" variant="ghost" disabled={done === 0} onClick={() => save([])}>{t('Reset', 'Réinitialiser')}</AppButton></div>
        <div className="operation-progress" role="progressbar" aria-label={t('Operation progress', 'Progression de l’opération')} aria-valuemin={0} aria-valuemax={operation.steps.length || 1} aria-valuenow={done}><span style={{ width: `${done / (operation.steps.length || 1) * 100}%` }} /></div>
        <div className="operation-steps">{operation.steps.map((step, index) => <button key={step.id} className="operation-step" aria-pressed={activeStep === index} onClick={() => setActiveStep(index)} data-complete={checked.includes(step.id)}><span className="operation-step-number">{checked.includes(step.id) ? <i className="pi pi-check" aria-hidden="true" /> : String(index + 1).padStart(2, '0')}</span><span>{text(step.title)}</span>{step.optional && <small>{t('Optional', 'Facultatif')}</small>}</button>)}</div>
        {current && <div className="operation-objective" key={current.id}>
          <div className="operation-objective-icon"><i className={`pi ${operationIcon(operation.id)}`} aria-hidden="true" /></div>
          <div><span className="operation-kicker">{t('OBJECTIVE', 'OBJECTIF')} {String(activeStep + 1).padStart(2, '0')}</span><h3>{text(current.title)}</h3><p>{text(gameplayDescription(operation.id, current))}</p><AppCheckbox checked={checked.includes(current.id)} onCheckedChange={(value) => save(value ? [...new Set([...checked, current.id])] : checked.filter((id) => id !== current.id))} label={text(current.title)} /></div>
          {activeStep < operation.steps.length - 1 && <AppButton size="sm" variant="ghost" onClick={() => setActiveStep(activeStep + 1)}>{t('Next', 'Suivant')} <i className="pi pi-arrow-right" aria-hidden="true" /></AppButton>}
        </div>}
      </section>

      {operation.requirements.length > 0 && <Panel dense title={t('Before you leave', 'Avant de partir')}>
        <div className="operation-prep">{operation.requirements.map((requirement, i) => <div key={i}><i className={`pi ${['pi-key', 'pi-shield', 'pi-briefcase'][i % 3]}`} aria-hidden="true" /><Typography variant="body2">{text(requirement.text)}</Typography></div>)}</div>
      </Panel>}

      {(operation.accessGoals?.length ?? 0) > 0 && <Panel dense title={t('Plan the unlock', 'Préparer le déblocage')}>
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

      {rewards.length > 0 && <Panel dense title={t('Possible blueprints', 'Blueprints possibles')}>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>{t('Rewards depend on the contract variant. Each blueprint is a possible reward, not a guaranteed drop.', 'Les récompenses dépendent de la variante du contrat. Chaque blueprint est une récompense possible, sans garantie de l’obtenir.')}</Typography>
        {rewards.map((pool, index) => <Box component="details" key={pool.poolId} sx={{ py: 1, overflowWrap: 'anywhere' }}>
          <summary style={{ cursor: 'pointer' }}>{t('Reward group', 'Groupe de récompenses')} {index + 1} · {pool.blueprints.length} blueprints</summary>
          <Box component="ul" sx={{ pl: 2.5 }}>{pool.blueprints.map((blueprint) => <li key={blueprint.id}><Typography variant="body2">{canOpenBlueprints && !blueprint.name.startsWith('BP_') ? <a href={`/item/${toSlug(blueprint.name)}`}>{blueprint.name}</a> : blueprint.name}</Typography></li>)}</Box>
        </Box>)}
      </Panel>}

    </Stack>
  );
}

function OperationsExplorer({ data }: { data: MissionOperationsData }) {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState(new URLSearchParams(window.location.search).get('operation') ?? data.operations[0]?.id ?? '');
  const selected = data.operations.find((operation) => operation.id === selectedId) ?? data.operations[0];
  return <>
    <PageHeader title={t('Operations & events', 'Opérations & événements')}
      eyebrow={t('MISSION CONTROL / FIELD OPERATIONS', 'MISSIONS / OPÉRATIONS DE TERRAIN')}
      description={t('Prepare a major operation, understand its prerequisites and keep your place in the sequence.', 'Préparez une grande opération, identifiez ses prérequis et gardez le fil des objectifs.')}
    />
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(250px, 300px) minmax(0, 1fr)' }, alignItems: 'start', gap: 2 }}>
      <Panel dense className="operation-picker" title={t('Choose your operation', 'Choisir une opération')}>
        <Box className="operation-choices" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: '1fr' }, gap: 1, mt: 1.5 }}>
          {data.operations.map((operation) => <AppButton key={operation.id} ariaPressed={selected?.id === operation.id} variant={selected?.id === operation.id ? 'primary' : 'ghost'} onClick={() => setSelectedId(operation.id)} sx={{ justifyContent: 'flex-start', textAlign: 'left', py: 1.5, whiteSpace: 'normal', width: '100%' }}>
            <span><span style={{ display: 'block', fontWeight: 700 }}>{operation.title}</span><span style={{ display: 'block', marginTop: 5, fontSize: '0.75rem', opacity: 0.85 }}>{operation.systems.join(' / ')} · {operation.steps.length} {t('steps', 'étapes')}</span></span>
          </AppButton>)}
        </Box>

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
