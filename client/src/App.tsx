import { ThemeProvider } from '@mui/material/styles';
import GlobalStyles from '@mui/material/GlobalStyles';
import CssBaseline from '@mui/material/CssBaseline';
import Fade from '@mui/material/Fade';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { createAppTheme } from './theme';
import { useTheme } from './hooks/useTheme';
import { I18nProvider, useI18n } from './i18n/I18nContext';
import { CraftProvider } from './store/CraftContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { NavRail } from './components/NavRail';
import { BlueprintGrid } from './components/BlueprintGrid';
import { ItemWorkspace } from './components/ItemWorkspace';
import { MissionsPanel } from './components/MissionsPanel';
import { PlannerPage } from './components/PlannerPage';
import { ComparisonModal } from './components/ComparisonModal';
import { DatasetChangelog } from './components/DatasetChangelog';
import { Footer } from './components/Footer';
import { useCraft } from './store/CraftContext';
import { LS_KEYS } from './types';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import type { MainView } from './components/NavRail';
import { mainViewFromPathname, navigateToPath } from './utils/slug';

function MainContent({ mainView }: { mainView: MainView }) {
  const { activeBlueprint, ensureMissionRewardsLoaded } = useCraft();

  useEffect(() => {
    if (mainView === 'missions' || !activeBlueprint) {
      void ensureMissionRewardsLoaded();
    }
  }, [mainView, activeBlueprint, ensureMissionRewardsLoaded]);

  if (mainView === 'missions') {
    return (
      <Fade in timeout={180}>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <MissionsPanel />
          <Footer />
        </Box>
      </Fade>
    );
  }

  if (mainView === 'planner') {
    return (
      <Fade in timeout={180}>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <PlannerPage />
          <Footer />
        </Box>
      </Fade>
    );
  }

  if (activeBlueprint) {
    return (
      <Fade in timeout={200}>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <ItemWorkspace />
          <Footer />
        </Box>
      </Fade>
    );
  }

  return (
    <Fade in timeout={180}>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <BlueprintGrid />
        <Footer />
      </Box>
    </Fade>
  );
}

function AppShell() {
  const { activeDataset, datasetLoading, datasetError, ensureMissionRewardsLoaded } = useCraft();
  const { t } = useI18n();
  const [themeMode] = useTheme();
  const theme = useMemo(() => createAppTheme(themeMode), [themeMode]);
  const isCompactLayout = useMediaQuery(theme.breakpoints.down('md'));

  const [mainView, setMainView] = useState<MainView>(() => mainViewFromPathname(window.location.pathname));
  const [navCollapsed, setNavCollapsed] = useState(() => {
    try { return localStorage.getItem(LS_KEYS.NAV_COLLAPSED) === 'true'; } catch { return false; }
  });
  const [isPending, startTransition] = useTransition();

  const toggleNavCollapsed = useCallback(() => {
    setNavCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(LS_KEYS.NAV_COLLAPSED, String(next)); } catch { /* noop */ }
      return next;
    });
  }, []);

  useEffect(() => {
    const syncViewFromPath = () => {
      const nextView = mainViewFromPathname(window.location.pathname);
      startTransition(() => {
        setMainView(nextView);
      });
      if (nextView === 'missions') {
        void ensureMissionRewardsLoaded();
      }
    };

    syncViewFromPath();
    window.addEventListener('popstate', syncViewFromPath);
    return () => window.removeEventListener('popstate', syncViewFromPath);
  }, [ensureMissionRewardsLoaded]);

  const handleChangeView = useCallback((view: MainView) => {
    const path = view === 'missions' ? '/missions' : view === 'planner' ? '/planner' : '/';
    navigateToPath(path, { mainView: view });
  }, []);

  if (datasetLoading && activeDataset.blueprints.length === 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header />
        <LinearProgress sx={{ height: 2 }} />
        <Box component="main" id="main-content" sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, p: 4 }} aria-live="polite">
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', maxWidth: 480 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
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
      </Box>
    );
  }

  if (datasetError && activeDataset.blueprints.length === 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header />
        <Box component="main" id="main-content" sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, p: 4 }} aria-live="assertive">
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', maxWidth: 480, borderColor: 'error.main' }}>
              <Typography variant="h6" sx={{ mb: 1, color: 'error.main' }}>
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
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
      {isPending && <LinearProgress sx={{ height: 2 }} />}
      <Box
        sx={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          flexDirection: { xs: 'column', md: 'row' },
          overflow: isCompactLayout ? 'visible' : 'hidden',
        }}
      >
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
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
          aria-label={t('Content', 'Contenu')}
        >
          <MainContent mainView={mainView} />
        </Box>
      </Box>
      <ComparisonModal />
      <DatasetChangelog />
    </Box>
  );
}

function AppContent() {
  const [themeMode] = useTheme();
  const theme = useMemo(() => createAppTheme(themeMode), [themeMode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      <GlobalStyles styles={{
        'html, body': { height: '100%', margin: 0, padding: 0 },
        '#root': { height: '100%', display: 'flex', flexDirection: 'column' },
      }} />
      <I18nProvider>
        <CraftProvider>
          <AppShell />
        </CraftProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
