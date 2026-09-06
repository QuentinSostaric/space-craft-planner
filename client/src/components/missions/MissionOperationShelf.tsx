import { useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { useMissionSnapshot } from '../../hooks/useMissionSnapshot';
import type { MissionOperationsData, MissionOperation } from '../../types/missionOperations';
import { SurfaceState } from '../ui/feedback';
import { navigateToPath } from '../../utils/slug';
import { shouldHandleInternalLinkClick } from '../../utils/spaLinks';
import { operationImages } from './operationImages';
import { operationIcon } from './OperationScene';
import './mission-operations.css';

function OperationCard({ operation }: { operation: MissionOperation }) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  const reference = operationImages[operation.id];
  const href = `/missions?operation=${encodeURIComponent(operation.id)}`;
  const count = new Set(operation.contracts.flatMap((contract) => contract.blueprintRewards.flatMap((pool) => pool.blueprints.map((blueprint) => blueprint.id)))).size;
  return <div className="mission-operation-card">
    <a href={href} aria-label={`${t('Open operation', 'Voir l’opération')} : ${operation.title}`} onClick={(event) => {
      if (!shouldHandleInternalLinkClick(event)) return;
      event.preventDefault(); navigateToPath(href, { mainView: 'missions' });
    }}>
      <div className="mission-operation-card-image">{reference && !failed ? <img src={reference.url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : <i className={`pi ${operationIcon(operation.id)}`} aria-hidden="true" />}<span>{operation.systems.join(' / ')}</span></div>
      <strong>{operation.title}</strong><span className="mission-operation-card-meta">{count ? `${count} blueprints` : t('View operation', 'Voir l’opération')}<i className="pi pi-arrow-up-right" aria-hidden="true" /></span>
    </a>
    {reference && !failed && <a className="mission-operation-credit" href={reference.source} target="_blank" rel="noopener noreferrer" aria-label={`${t('Image credit', 'Crédit image')} : ${operation.title} · ${reference.credit}`}>{reference.credit}</a>}
  </div>;
}

export function MissionOperationShelf() {
  const { t } = useI18n();
  const { data, loading, error, retry } = useMissionSnapshot<MissionOperationsData>('operations');
  return <section className="mission-operation-shelf" aria-label={t('Operations & events', 'Opérations & événements')}>
    <div className="mission-section-heading"><h2>{t('Operations & events', 'Opérations & événements')}</h2><span>{t('Unlocks, blueprints & walkthroughs', 'Déblocage, blueprints & parcours')}</span></div>
    {loading ? <SurfaceState tone="loading" title={t('Loading operations…', 'Chargement des opérations…')} /> : error || !data ? <SurfaceState tone="error" title={t('Operations unavailable', 'Opérations indisponibles')} actionLabel={t('Retry', 'Réessayer')} onAction={retry} /> : <div className="mission-operation-shelf-cards">{data.operations.map((operation) => <OperationCard key={operation.id} operation={operation} />)}</div>}
  </section>;
}
