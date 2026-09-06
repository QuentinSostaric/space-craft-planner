import { useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { AppButton } from '../ui/controls';
import { SurfaceState } from '../ui/feedback';
import { PageLayout } from '../ui/page';
import { useMissionSnapshot } from '../../hooks/useMissionSnapshot';
import type { MissionOperation, MissionOperationsData, OperationText } from '../../types/missionOperations';
import { OperationScene, operationIcon } from './OperationScene';
import { gameplayDescription, gameplayTeam } from './operationGameplay';
import { navigateToPath, toSlug } from '../../utils/slug';
import { shouldHandleInternalLinkClick } from '../../utils/spaLinks';
import { useCraft } from '../../store/CraftContext';
import './mission-operations.css';

function useOperationText() {
  const { lang } = useI18n();
  return (value: OperationText): string => typeof value === 'string' ? value : lang === 'fr' ? value.fr : value.en;
}

function OperationDossier({ operation, buildNumber }: { operation: MissionOperation; buildNumber: string }) {
  const { t } = useI18n();
  const text = useOperationText();
  const { activeDataset } = useCraft();
  const canOpenBlueprints = String(activeDataset.buildNumber) === String(buildNumber) && activeDataset.channel === 'live';
  const storageKey = `itemfab:operation:${buildNumber}:${operation.id}`;
  const [checked, setChecked] = useState<string[]>(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
      return Array.isArray(stored) ? [...new Set(stored.filter((id): id is string => typeof id === 'string' && operation.steps.some((step) => step.id === id)))] : [];
    } catch { return []; }
  });
  const [activeStep, setActiveStep] = useState(() => Math.max(0, operation.steps.findIndex((step) => !checked.includes(step.id))));
  const [undo, setUndo] = useState<{ checked: string[]; activeStep: number } | null>(null);
  const [notice, setNotice] = useState('');
  const [inspecting, setInspecting] = useState(false);
  function save(next: string[]) {
    setChecked(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Remains usable without storage. */ }
  }
  const done = checked.length;
  const complete = operation.steps.length > 0 && done === operation.steps.length;
  const current = operation.steps[activeStep];
  const nextStep = operation.steps.find((step) => step.id !== current?.id && !checked.includes(step.id));
  function finishStep() {
    if (!current || checked.includes(current.id)) return;
    setUndo({ checked, activeStep });
    const next = [...checked, current.id];
    save(next);
    setInspecting(false);
    const index = operation.steps.findIndex((step) => !next.includes(step.id));
    if (index >= 0) setActiveStep(index);
    setNotice(`${text(current.title)} — ${t('completed', 'terminé')}`);
  }
  function restore() {
    if (!undo) return;
    save(undo.checked);
    setActiveStep(undo.activeStep);
    setUndo(null);
    setInspecting(false);
    setNotice(t('Last action undone.', 'Dernière action annulée.'));
  }
  const rewards = [...new Map(operation.contracts.flatMap((contract) => contract.blueprintRewards ?? []).map((pool) => [pool.poolId, pool])).values()];
  return <article className="operation-workspace">
    <header className="operation-header">
      <div><span className="operation-eyebrow">{operation.systems.join(' / ')}</span><h1>{operation.title}</h1></div>
      <div className="operation-completion"><span>{done}<span> / {operation.steps.length}</span></span><span>{t('completed', 'terminées')}</span></div>
    </header>
    <div className="operation-progress" role="progressbar" aria-label={t('Operation progress', 'Progression de l’opération')} aria-valuemin={0} aria-valuemax={operation.steps.length || 1} aria-valuenow={done}><span style={{ width: `${done / (operation.steps.length || 1) * 100}%` }} /></div>
    <section className="operation-focus" aria-label={t('Current objective', 'Objectif en cours')}>
      <OperationScene operation={operation} activeStep={activeStep} complete={complete} />
      <div className="operation-focus-body">
        {complete && !inspecting ? <div className="operation-finished"><i className="pi pi-check-circle" aria-hidden="true" /><span className="operation-eyebrow">{t('All steps completed', 'Toutes les étapes terminées')}</span><h2>{t('Operation complete', 'Opération terminée')}</h2><p>{t('Your progress is saved. Ready for your next operation.', 'Votre progression est enregistrée. Prêt pour votre prochaine opération.')}</p></div>
          : current ? <div className="operation-active" key={current.id}>
            <div className="operation-eyebrow">{t('NOW', 'MAINTENANT')} · {String(activeStep + 1).padStart(2, '0')} / {String(operation.steps.length).padStart(2, '0')}{current.optional && ` · ${t('Optional', 'Facultatif')}`}</div>
            <h2>{text(current.title)}</h2>
            <p>{text(gameplayDescription(operation.id, current))}</p>
            {checked.includes(current.id)
              ? <AppButton variant="secondary" onClick={() => { setUndo({ checked, activeStep }); save(checked.filter((id) => id !== current.id)); setNotice(t('Step reopened.', 'Étape rouverte.')); }}>{t('Reopen step', 'Rouvrir l’étape')}</AppButton>
              : <AppButton variant="primary" className="operation-complete-button" onClick={finishStep} endIcon={<i className="pi pi-check" aria-hidden="true" />}>{t('Complete step', 'Terminer l’étape')}</AppButton>}
            {nextStep && <div className="operation-up-next"><span>{t('Then', 'Ensuite')}</span>{text(nextStep.title)}</div>}
          </div> : <p>{t('No objectives available.', 'Aucun objectif disponible.')}</p>}
        <div className="operation-feedback"><span role="status">{notice || t('Progress saved on this device', 'Progression enregistrée sur cet appareil')}</span>{undo && <AppButton size="sm" variant="ghost" onClick={restore}>{t('Undo', 'Annuler')}</AppButton>}</div>
      </div>
    </section>

    <div className="operation-disclosures">
      <details className="operation-disclosure">
        <summary><i className="pi pi-list" aria-hidden="true" /><span>{t('Route', 'Parcours')}</span><small>{done} / {operation.steps.length}</small><i className="pi pi-chevron-down" aria-hidden="true" /></summary>
        <div className="operation-disclosure-body"><ol className="operation-route">{operation.steps.map((step, index) => <li key={step.id}><button type="button" aria-current={activeStep === index ? 'step' : undefined} onClick={() => { setActiveStep(index); setInspecting(true); }} data-complete={checked.includes(step.id)}><span aria-hidden="true">{checked.includes(step.id) ? <i className="pi pi-check" /> : String(index + 1).padStart(2, '0')}</span>{text(step.title)}{step.optional && <small>{t('Optional', 'Facultatif')}</small>}</button></li>)}</ol><AppButton size="sm" variant="ghost" disabled={!done} onClick={() => { setUndo({ checked, activeStep }); save([]); setActiveStep(0); setNotice(t('Progress reset.', 'Progression réinitialisée.')); }}>{t('Reset', 'Réinitialiser')}</AppButton></div>
      </details>
      <details className="operation-disclosure">
        <summary><i className="pi pi-briefcase" aria-hidden="true" /><span>{t('Preparation', 'Préparation')}</span><small>{t('Gear & access', 'Équipement & accès')}</small><i className="pi pi-chevron-down" aria-hidden="true" /></summary>
        <div className="operation-disclosure-body"><p className="operation-team"><i className="pi pi-users" aria-hidden="true" /> {text(gameplayTeam(operation))}</p>
          {operation.requirements.length > 0 && <ul className="operation-requirements">{operation.requirements.map((requirement, i) => <li key={i}>{text(requirement.text)}</li>)}</ul>}
          {(operation.accessGoals?.length ?? 0) > 0 && <div className="operation-access">{operation.accessGoals!.map((goal, index) => {
            const params = new URLSearchParams({ view: 'reputation', track: `${goal.factionReputationGuid}:${goal.scopeGuid}`, target: String(goal.targetReputation), operation: operation.id });
            const href = `/missions?${params}`;
            return <div key={index}><strong>{text(goal.title)}</strong><span>{goal.targetReputation.toLocaleString()} {t('reputation points', 'points de réputation')}{goal.buyInUec != null && ` · ${goal.buyInUec.toLocaleString()} aUEC`}</span><p>{text(goal.note)}</p><AppButton href={href} size="sm" onClick={(event) => { if (!shouldHandleInternalLinkClick(event)) return; event.preventDefault(); navigateToPath(href, { mainView: 'missions' }); }}>{t('Plan this reputation', 'Planifier cette réputation')}</AppButton></div>;
          })}</div>}
        </div>
      </details>
      {rewards.length > 0 && <details className="operation-disclosure">
        <summary><i className="pi pi-box" aria-hidden="true" /><span>{t('Rewards', 'Récompenses')}</span><small>Blueprints</small><i className="pi pi-chevron-down" aria-hidden="true" /></summary>
        <div className="operation-disclosure-body"><p>{t('Possible rewards depend on the contract. Blueprints are not guaranteed.', 'Les récompenses possibles dépendent du contrat. Les blueprints ne sont pas garantis.')}</p>
          {rewards.map((pool, index) => <details key={pool.poolId} className="operation-reward"><summary>{t('Reward group', 'Groupe de récompenses')} {index + 1} · {pool.blueprints.length} blueprints</summary><ul>{pool.blueprints.map((blueprint) => <li key={blueprint.id}>{canOpenBlueprints && blueprint.name && !blueprint.name.startsWith('BP_') ? <a href={`/item/${toSlug(blueprint.name)}`}>{blueprint.name}</a> : (blueprint.name && !blueprint.name.startsWith('BP_') ? blueprint.name : t('Unidentified blueprint', 'Blueprint non identifié'))}</li>)}</ul></details>)}
        </div>
      </details>}
    </div>
  </article>;
}

function OperationsExplorer({ data }: { data: MissionOperationsData }) {
  const { t } = useI18n();
  const selectionKey = `itemfab:operation-selection:${data.build.buildNumber}`;
  const [selectedId, setSelectedId] = useState(() => {
    const query = new URLSearchParams(window.location.search).get('operation');
    if (query) return query;
    try { return localStorage.getItem(selectionKey) ?? data.operations[0]?.id ?? ''; } catch { return data.operations[0]?.id ?? ''; }
  });
  const selected = data.operations.find((operation) => operation.id === selectedId) ?? data.operations[0];
  function select(id: string) {
    setSelectedId(id);
    try { localStorage.setItem(selectionKey, id); } catch { /* Selection works without storage. */ }
    const url = new URL(window.location.href);
    url.searchParams.set('operation', id);
    window.history.replaceState(window.history.state, '', url);
  }
  return <div className="operations-desk">
    <nav className="operation-picker" aria-label={t('Choose your operation', 'Choisir une opération')}>{data.operations.map((operation) => <button key={operation.id} type="button" aria-pressed={selected?.id === operation.id} onClick={() => select(operation.id)}><i className={`pi ${operationIcon(operation.id)}`} aria-hidden="true" /><span>{operation.title}</span></button>)}</nav>
    {selected ? <OperationDossier key={`${data.build.buildNumber}:${selected.id}`} operation={selected} buildNumber={data.build.buildNumber} /> : <SurfaceState title={t('No operations available', 'Aucune opération disponible')} />}
  </div>;
}

export function MissionOperationsPanel() {
  const { t } = useI18n();
  const { data, loading, error, retry } = useMissionSnapshot<MissionOperationsData>('operations');
  return <PageLayout width="wide">
    {loading ? <SurfaceState tone="loading" title={t('Loading operations…', 'Chargement des opérations…')} />
      : error || !data ? <SurfaceState tone="error" title={t('Operations unavailable', 'Opérations indisponibles')} actionLabel={t('Retry', 'Réessayer')} onAction={retry} />
        : <OperationsExplorer data={data} />}
  </PageLayout>;
}
