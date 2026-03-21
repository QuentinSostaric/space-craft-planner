import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import theme from './theme';
import { I18nProvider, useI18n } from './i18n/I18nContext';
import { CraftProvider } from './store/CraftContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { NavRail } from './components/NavRail';
import { BlueprintGrid } from './components/BlueprintGrid';
import { ItemWorkspace } from './components/ItemWorkspace';
import { MissionsPanel } from './components/MissionsPanel';
import { PlannerDrawer } from './components/PlannerDrawer';
import { ComparisonModal } from './components/ComparisonModal';
import { DatasetChangelog } from './components/DatasetChangelog';
import { Footer } from './components/Footer';
import { useCraft } from './store/CraftContext';
import { LS_KEYS } from './types';
import { useCallback, useEffect, useState } from 'react';
import type { MainView } from './components/NavRail';

function MainContent({ mainView }: { mainView: MainView }) {
  const { activeBlueprint, ensureMissionRewardsLoaded } = useCraft();

  useEffect(() => {
    if (mainView === 'missions' || !activeBlueprint) {
      void ensureMissionRewardsLoaded();
    }
  }, [mainView, activeBlueprint, ensureMissionRewardsLoaded]);

  if (activeBlueprint) {
    return <ItemWorkspace />;
  }

  return (
    <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
      {mainView === 'blueprints' ? (
        <BlueprintGrid />
      ) : (
        <MissionsPanel />
      )}
      <Footer />
    </Box>
  );
}

function AppShell() {
  const { activeDataset, datasetLoading, datasetError, ensureMissionRewardsLoaded } = useCraft();
  const { t } = useI18n();

  const [mainView, setMainView] = useState<MainView>('blueprints');
  const [navCollapsed, setNavCollapsed] = useState(() => {
    try { return localStorage.getItem(LS_KEYS.NAV_COLLAPSED) === 'true'; } catch { return false; }
  });

  const toggleNavCollapsed = useCallback(() => {
    setNavCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(LS_KEYS.NAV_COLLAPSED, String(next)); } catch { /* noop */ }
      return next;
    });
  }, []);

  const handleChangeView = useCallback((view: MainView) => {
    setMainView(view);
    if (view === 'missions') void ensureMissionRewardsLoaded();
  }, [ensureMissionRewardsLoaded]);

  if (datasetLoading && activeDataset.blueprints.length === 0) {
    return (
      <>
        <a className="skip-link" href="#main-content">
          {t('Skip to main content', 'Aller au contenu principal')}
        </a>
        <Header />
        <Box component="main" id="main-content" sx={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, p: 4 }} aria-live="polite">
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', maxWidth: 480 }}>
              <Typography variant="h6" sx={{ fontFamily: "'Khand', sans-serif", fontWeight: 700, mb: 1 }}>
                {t('Loading published dataset', 'Chargement du dataset publie')}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {t(
                  'The app is connecting to the published MongoDB dataset.',
                  'L\'application se connecte au dataset publie sur MongoDB.',
                )}
              </Typography>
            </Paper>
          </Box>
          <Footer />
        </Box>
      </>
    );
  }

  if (datasetError && activeDataset.blueprints.length === 0) {
    return (
      <>
        <a className="skip-link" href="#main-content">
          {t('Skip to main content', 'Aller au contenu principal')}
        </a>
        <Header />
        <Box component="main" id="main-content" sx={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, p: 4 }} aria-live="assertive">
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', maxWidth: 480, borderColor: 'error.main' }}>
              <Typography variant="h6" sx={{ fontFamily: "'Khand', sans-serif", fontWeight: 700, mb: 1, color: 'error.main' }}>
                {t('Published dataset unavailable', 'Dataset publie indisponible')}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>{datasetError}</Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                {t(
                  'This app no longer bundles local dataset snapshots. The runtime API must be available.',
                  'Cette app n\'embarque plus de snapshots locaux. L\'API runtime doit etre disponible.',
                )}
              </Typography>
            </Paper>
          </Box>
          <Footer />
        </Box>
      </>
    );
  }

  return (
    <>
      <a className="skip-link" href="#main-content">
        {t('Skip to main content', 'Aller au contenu principal')}
      </a>
      <Header />
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <NavRail
          mainView={mainView}
          onChangeView={handleChangeView}
          collapsed={navCollapsed}
          onToggleCollapsed={toggleNavCollapsed}
        />
        <Box
          component="main"
          id="main-content"
          sx={{
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
          aria-label={t('Content', 'Contenu')}
        >
          <MainContent mainView={mainView} />
        </Box>
        <PlannerDrawer />
      </Box>
      <ComparisonModal />
      <DatasetChangelog />
    </>
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
