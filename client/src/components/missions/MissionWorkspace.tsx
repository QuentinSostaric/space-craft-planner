import { useEffect, useState, type ReactNode } from 'react';
import { AppButton } from '../ui/controls';
import { PageHeader, PageLayout } from '../ui/page';
import { useI18n } from '../../i18n/I18nContext';
import { navigateToPath, missionSlugFromPathname } from '../../utils/slug';
import { shouldHandleInternalLinkClick } from '../../utils/spaLinks';
import { MissionProgressionPanel } from './MissionProgressionPanel';
import { MissionOperationsPanel } from './MissionOperationsPanel';
import { MissionOperationShelf } from './MissionOperationShelf';
import { MissionContractDirectory } from './MissionContractDirectory';

function readRoute() {
  const params = new URLSearchParams(window.location.search);
  return { contract: missionSlugFromPathname(window.location.pathname), operation: params.get('operation'), legacy: params.get('view') };
}

export function BackToMissions() {
  const { t } = useI18n();
  return <AppButton sx={{ alignSelf: 'flex-start' }} href="/missions" size="sm" variant="ghost" startIcon={<i className="pi pi-arrow-left" aria-hidden="true" />} onClick={(event) => {
    if (!shouldHandleInternalLinkClick(event)) return;
    event.preventDefault(); navigateToPath('/missions', { mainView: 'missions' });
  }}>{t('Back to missions', 'Retour aux missions')}</AppButton>;
}

export function MissionWorkspace({ catalog }: { catalog: ReactNode }) {
  const { t } = useI18n();
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const sync = () => setRoute(readRoute());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  if (route.contract) return <>{catalog}</>;
  // Preserve shared planner/directory links, without making them competing home tabs.
  if (route.legacy === 'reputation' || route.legacy === 'directory') return <><PageLayout sx={{ pb: 0 }}><BackToMissions /></PageLayout>{route.legacy === 'reputation' ? <MissionProgressionPanel /> : <MissionContractDirectory />}</>;
  if (route.operation) return <><PageLayout sx={{ pb: 0 }}><BackToMissions /></PageLayout><MissionOperationsPanel operationId={route.operation} /></>;
  return <>
    <PageLayout width="wide" sx={{ pb: 0 }}>
      <PageHeader title={t('Missions', 'Missions')} description={t('Find a quest, unlock an operation and earn your next blueprints.', 'Trouvez une quête, débloquez une opération et obtenez vos prochains blueprints.')} />
      <MissionOperationShelf />
    </PageLayout>
    {catalog}
  </>;
}
