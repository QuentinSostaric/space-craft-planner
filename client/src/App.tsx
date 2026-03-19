import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import theme from './theme';
import { I18nProvider, useI18n } from './i18n/I18nContext';
import { CraftProvider } from './store/CraftContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { BlueprintExplorer } from './components/BlueprintExplorer';
import { BlueprintGrid } from './components/BlueprintGrid';
import { ItemWorkspace } from './components/ItemWorkspace';
import { MissionsPanel } from './components/MissionsPanel';
import { PlannerDrawer } from './components/PlannerDrawer';
import { ComparisonModal } from './components/ComparisonModal';
import { DatasetChangelog } from './components/DatasetChangelog';
import { Footer } from './components/Footer';
import { useCraft } from './store/CraftContext';
import { useEffect, useState } from 'react';

type MainView = 'blueprints' | 'missions';

function MainContent({ onToggleFilters, filtersOpen }: { onToggleFilters: () => void; filtersOpen: boolean }) {
  const { activeBlueprint, ensureMissionRewardsLoaded } = useCraft();
  const { t } = useI18n();
  const [mainView, setMainView] = useState<MainView>('blueprints');

  useEffect(() => {
    if (mainView === 'missions' || !activeBlueprint) {
      void ensureMissionRewardsLoaded();
    }
  }, [mainView, activeBlueprint, ensureMissionRewardsLoaded]);

  if (activeBlueprint) {
    return <ItemWorkspace />;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        {/* Mobile filter toggle */}
        <IconButton
          onClick={onToggleFilters}
          aria-expanded={filtersOpen}
          aria-label={t('Toggle filters', 'Afficher les filtres')}
          size="small"
          sx={{
            display: { xs: 'inline-flex', md: 'none' },
            mr: 1,
            ml: 1,
            ...(filtersOpen && { color: 'primary.main', backgroundColor: 'rgba(139, 92, 246, 0.1)' }),
          }}
        >
          ⚙
        </IconButton>

        <Tabs
          value={mainView}
          onChange={(_e, val) => {
            setMainView(val as MainView);
            if (val === 'missions') void ensureMissionRewardsLoaded();
          }}
          aria-label={t('Main view', 'Vue principale')}
          sx={{ minHeight: 40 }}
        >
          <Tab label={t('Blueprints', 'Blueprints')} value="blueprints" />
          <Tab label={t('Missions', 'Missions')} value="missions" />
        </Tabs>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {mainView === 'blueprints' ? (
          <BlueprintGrid />
        ) : (
          <MissionsPanel />
        )}
      </Box>
    </Box>
  );
}

function AppShell() {
  const { activeDataset, datasetLoading, datasetError } = useCraft();
  const { t } = useI18n();
  const [filtersOpen, setFiltersOpen] = useState(false);

  if (datasetLoading && activeDataset.blueprints.length === 0) {
    return (
      <div className="app">
        <a className="skip-link" href="#main-content">
          {t('Skip to main content', 'Aller au contenu principal')}
        </a>
        <Header />
        <main id="main-content" className="app-status" aria-live="polite">
          <div className="app-status__panel">
            <h2 className="app-status__title">
              {t('Loading published dataset', 'Chargement du dataset publié')}
            </h2>
            <p className="app-status__message">
              {t(
                'The app is connecting to the published MongoDB dataset.',
                'L\'application se connecte au dataset publié sur MongoDB.',
              )}
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (datasetError && activeDataset.blueprints.length === 0) {
    return (
      <div className="app">
        <a className="skip-link" href="#main-content">
          {t('Skip to main content', 'Aller au contenu principal')}
        </a>
        <Header />
        <main id="main-content" className="app-status" aria-live="assertive">
          <div className="app-status__panel app-status__panel--error">
            <h2 className="app-status__title">
              {t('Published dataset unavailable', 'Dataset publié indisponible')}
            </h2>
            <p className="app-status__message">{datasetError}</p>
            <p className="app-status__hint">
              {t(
                'This app no longer bundles local dataset snapshots. The runtime API must be available.',
                'Cette app n\'embarque plus de snapshots locaux. L\'API runtime doit être disponible.',
              )}
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">
        {t('Skip to main content', 'Aller au contenu principal')}
      </a>
      <Header />
      <div className="app__body">
        <main id="main-content" className="dashboard">
          <aside
            className={['dashboard__col dashboard__col--left', filtersOpen && 'dashboard__col--left--open'].filter(Boolean).join(' ')}
            aria-label={t('Blueprint filters', 'Filtres blueprints')}
          >
            <BlueprintExplorer />
          </aside>
          {/* Mobile backdrop */}
          {filtersOpen && (
            <div
              className="filters-backdrop"
              onClick={() => setFiltersOpen(false)}
              aria-hidden="true"
            />
          )}
          <section
            className="dashboard__col dashboard__col--center"
            aria-label={t('Content', 'Contenu')}
          >
            <MainContent onToggleFilters={() => setFiltersOpen((v) => !v)} filtersOpen={filtersOpen} />
          </section>
        </main>
        <PlannerDrawer />
      </div>
      <Footer />
      <ComparisonModal />
      <DatasetChangelog />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme />
        <I18nProvider>
          <CraftProvider>
            <AppShell />
          </CraftProvider>
        </I18nProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
