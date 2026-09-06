import { useState } from 'react';
import type { MissionOperation } from '../../types/missionOperations';
import { useI18n } from '../../i18n/I18nContext';
import { operationImages, qvLaserImage, orisonStepImages, type OperationImage } from './operationImages';

export function operationIcon(id: string) {
  return ({ 'qv-breaker': 'pi-bolt', 'siege-of-orison': 'pi-building', 'tactical-strike-groups': 'pi-shield', 'asd-onyx': 'pi-sitemap', 'storm-breaker': 'pi-sun', hathor: 'pi-key', jumptown: 'pi-box' } as Record<string, string>)[id] ?? 'pi-compass';
}

function LocationImage({ reference, title, icon }: { reference?: OperationImage; title: string; icon: string }) {
  const { t, lang } = useI18n();
  const [failed, setFailed] = useState(false);
  return <figure className="operation-scene">
    {reference && !failed ? <img className="operation-photo" src={reference.url} alt={lang === 'fr' ? reference.description.fr : reference.description.en} style={{ objectPosition: reference.position ?? 'center' }} onError={() => setFailed(true)} decoding="async" referrerPolicy="no-referrer" />
      : <div className="operation-photo-fallback"><i className={`pi ${icon}`} aria-hidden="true" /></div>}
    {reference && !failed && <a className="operation-photo-credit" href={reference.source} target="_blank" rel="noopener noreferrer" aria-label={`${t('Image credit', 'Crédit image')} : ${reference.credit}`}>{reference.credit}</a>}
    <figcaption className="operation-photo-label"><span>{failed ? t('Image unavailable', 'Image indisponible') : t('Location reference', 'Repère visuel')}</span><strong>{reference?.place ?? title}</strong></figcaption>
  </figure>;
}

export function OperationScene({ operation, activeStep, complete }: { operation: MissionOperation; activeStep: number; complete: boolean }) {
  const stepId = operation.steps[activeStep]?.id;
  const reference = operation.id === 'qv-breaker' && (complete || activeStep >= 4) ? qvLaserImage : (operation.id === 'siege-of-orison' ? orisonStepImages[stepId] : undefined) ?? operationImages[operation.id];
  return <LocationImage key={reference?.url ?? operation.id} reference={reference} title={operation.title} icon={operationIcon(operation.id)} />;
}
