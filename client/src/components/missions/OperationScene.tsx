import type { MissionOperation } from '../../types/missionOperations';
import { useI18n } from '../../i18n/I18nContext';

export function operationIcon(id: string) {
  return ({ 'qv-breaker': 'pi-bolt', 'siege-of-orison': 'pi-building', 'tactical-strike-groups': 'pi-shield', 'asd-onyx': 'pi-sitemap', 'storm-breaker': 'pi-sun', hathor: 'pi-key', jumptown: 'pi-box' } as Record<string, string>)[id] ?? 'pi-compass';
}

/** Illustrative equipment silhouettes, never a geographic map. */
export function OperationScene({ operation, checked, activeStep, onSelect }: { operation: MissionOperation; checked: string[]; activeStep: number; onSelect: (index: number) => void }) {
  const { t, lang } = useI18n();
  const id = operation.id;
  const landmarks: Record<string, string[]> = {
    'qv-breaker': ['Central Core → Operations', t('Optics → laser', 'Optique → laser'), t('Fractured asteroid', 'Astéroïde fracturé')],
    'siege-of-orison': ['Arrival Center', 'Solanki → Hartmoore', 'Admin Center / Mendo Ren'],
    'tactical-strike-groups': [t('Fighter screen', 'Défense aérienne'), 'Tranquility / Core', 'Gabe Windell'],
    'asd-onyx': ['Research', 'Engineering', 'Site-B / Hyperion'],
    'storm-breaker': ['Farro / IKTI', 'Lazarus / Apex', 'RAIN'],
    hathor: [t('Activation card', 'Carte d’activation'), t('Mining laser', 'Laser de minage'), t('PAF + OLP · either order', 'PAF + OLP · ordre libre')],
    jumptown: [t('Production site', 'Site de production'), t('Load cargo', 'Charger la cargaison'), t('Deliver & collect payment', 'Livrer & encaisser')],
  };
  return <div className={`operation-scene scene-${id}`}>
    <div className="operation-scene-caption"><span><i className={`pi ${operationIcon(id)}`} aria-hidden="true" /> {operation.systems.join(' / ')}</span><span>{t('Operation schematic', 'Schéma de l’opération')}</span></div>
    <svg viewBox="0 0 720 220" aria-hidden="true" className="operation-art">
      <defs><pattern id={`grid-${id}`} width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="currentColor" opacity=".12" /></pattern></defs>
      <rect width="720" height="220" fill={`url(#grid-${id})`} />
      {id === 'qv-breaker' ? <g><path d="M100 70L160 40 220 70V150L160 180 100 150Z M100 95H220 M100 125H220 M160 40V180 M70 95H100 M70 125H100 M220 95H260V125H220" /><path className="scene-beam" d="M260 110H535" /><path d="M545 45L595 30 653 66 675 130 635 180 575 188 540 150 552 110 532 80Z M596 35L582 86 620 110 590 151 600 185 M540 150L590 151 M620 110L665 125" /><circle cx="160" cy="110" r="20" /></g>
      : id === 'siege-of-orison' ? <g>{[100, 290, 480, 640].map((x, i) => <g key={x} transform={`translate(${x} ${i % 2 ? 115 : 85})`}><path d="M-55 20L0 40 55 20 0 0Z M-30 10V-35H-5V0 M5 0V-55H30V10 M-40 30L0 60 40 30" /><circle r="70" strokeDasharray="3 8" opacity=".3" /></g>)}<path className="scene-beam" d="M145 105L245 130M335 130L435 105M525 105L595 130" /></g>
      : id === 'tactical-strike-groups' ? <g><path d="M310 60L360 30 410 60V155L360 190 310 155Z M270 85H450V130H270Z M345 65H375V150H345Z" />{[110, 190, 530, 610].map((x, i) => <path key={x} d={`M${x} ${i % 2 ? 70 : 150}l-25 25 25-8 25 8Z`} />)}<circle className="scene-orbit" cx="360" cy="110" r="95" strokeDasharray="80 30 5 25" /></g>
      : id === 'asd-onyx' ? <g>{[120, 300, 520].map((x, i) => <g key={x} transform={`translate(${x} 110)`}><path d="M-40-45H40V45H-40Z M-30-30H30 M-30 30H30" /><path d={i === 2 ? 'M-12-20V0L-25 20H25L12 0V-20Z' : 'M-20-10H20M-20 0H20M-20 10H10'} /></g>)}<path className="scene-beam" d="M160 110H260M340 110H480M560 110H630V55H520V65" /><circle cx="520" cy="110" r="75" strokeDasharray="4 7" /></g>
      : id === 'storm-breaker' ? <g><path d="M50 180Q180 130 280 180T500 180T700 180 M240 170Q260 110 330 140Q290 60 375 45Q465 30 490 155L530 180 M350 85L390 100 435 75 M365 110L410 125 445 110" /><circle cx="570" cy="55" r="30" /><path className="scene-beam" d="M100 165V95M160 160V85M580 165V105M640 165V95" /></g>
      : id === 'hathor' ? <g><circle cx="140" cy="110" r="45" /><path d="M140 65V155M95 110H185 M185 110H340L490 55H580V95H490L340 110 490 150H580V190H490Z" /><path className="scene-beam" d="M185 110H340" /></g>
      : <g><path d="M70 145V70H210V145Z M90 70V40H125V70 M80 100H200 M270 150V100H350V150Z M290 100V150 M270 120H350 M480 140L550 65 620 140 550 120Z" /><path className="scene-beam" d="M215 120H265M360 120H475" /></g>}
    </svg>
    <div className="scene-landmarks">{(landmarks[id] ?? [operation.title]).map((label) => <span key={label}>{label}</span>)}</div>
    <div className="scene-markers">{operation.steps.map((step, index) => <button key={step.id} onClick={() => onSelect(index)} aria-label={`${t('Show objective', 'Afficher l’objectif')} ${typeof step.title === 'string' ? step.title : lang === 'fr' ? step.title.fr : step.title.en}`} aria-pressed={activeStep === index} data-complete={checked.includes(step.id)}>{checked.includes(step.id) ? <i className="pi pi-check" aria-hidden="true" /> : index + 1}</button>)}</div>
  </div>;
}
