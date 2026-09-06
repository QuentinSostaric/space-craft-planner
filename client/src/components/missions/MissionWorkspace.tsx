import { useEffect, useState, type ReactNode } from 'react';
import { Box } from '../../ui/system';
import { AppButton } from '../ui/controls';
import { PageLayout } from '../ui/page';
import { useI18n } from '../../i18n/I18nContext';
import { navigateToPath, missionSlugFromPathname } from '../../utils/slug';
import { shouldHandleInternalLinkClick } from '../../utils/spaLinks';
import { MissionProgressionPanel } from './MissionProgressionPanel';
import { MissionOperationsPanel } from './MissionOperationsPanel';
import { MissionContractDirectory } from './MissionContractDirectory';

type MissionView = 'catalog' | 'reputation' | 'operations' | 'directory';

function readView(): MissionView {
  if (missionSlugFromPathname(window.location.pathname)) return 'catalog';
  const value = new URLSearchParams(window.location.search).get('view');
  return value === 'reputation' || value === 'operations' || value === 'directory' ? value : 'catalog';
}

export function MissionWorkspace({ catalog }: { catalog: ReactNode }) {
  const { t } = useI18n();
  const [view, setView] = useState(readView);
  useEffect(() => {
    const sync = () => setView(readView());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  const views: { id: MissionView; label: string; icon: string }[] = [
    { id: 'catalog', label: t('Blueprint rewards', 'Récompenses blueprints'), icon: 'pi pi-box' },
    { id: 'directory', label: t('All contracts', 'Tous les contrats'), icon: 'pi pi-list' },
    { id: 'reputation', label: t('Reputation planner', 'Progression de réputation'), icon: 'pi pi-chart-line' },
    { id: 'operations', label: t('Operations & events', 'Opérations & événements'), icon: 'pi pi-flag' },
  ];
  return (
    <Box>
      <PageLayout sx={{ pb: 0 }}>
        <Box component="nav" aria-label={t('Mission tools', 'Outils de mission')} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {views.map((item) => (
            <AppButton key={item.id} href={`/missions?view=${item.id}`} variant={view === item.id ? 'primary' : 'secondary'}
              sx={{ flex: { xs: '1 1 calc(50% - 8px)', sm: '0 0 auto' }, maxWidth: { xs: 'calc(50% - 4px)', sm: 'none' }, minWidth: 0, whiteSpace: 'normal', textAlign: 'left', justifyContent: 'flex-start' }}
              ariaPressed={view === item.id} startIcon={<i aria-hidden="true" className={item.icon} />}
              onClick={(event) => {
                if (!shouldHandleInternalLinkClick(event)) return;
                event.preventDefault();
                navigateToPath(`/missions?view=${item.id}`, { mainView: 'missions' });
              }}>
              {item.label}
            </AppButton>
          ))}
        </Box>
      </PageLayout>
      {view === 'catalog' ? catalog : view === 'directory' ? <MissionContractDirectory /> : view === 'reputation' ? <MissionProgressionPanel /> : <MissionOperationsPanel />}
    </Box>
  );
}
