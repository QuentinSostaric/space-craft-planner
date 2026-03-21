import { ThemeProvider } from '@mui/material/styles';
import GlobalStyles from '@mui/material/GlobalStyles';
import CssBaseline from '@mui/material/CssBaseline';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Fade from '@mui/material/Fade';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { createAppTheme } from './theme';
import { useTheme } from './hooks/useTheme';
import { I18nProvider, useI18n } from './i18n/I18nContext';
import { CraftProvider } from './store/CraftContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { NavRail } from './components/NavRail';
import { Footer } from './components/Footer';
import { useCraft } from './store/CraftContext';
import { LS_KEYS } from './types';
import { Suspense, lazy, useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import type { MainView } from './components/NavRail';
import { mainViewFromPathname, navigateToPath } from './utils/slug';

const LazyBlueprintsView = lazy(() =>
  import('./components/BlueprintGrid').then(({ BlueprintGrid }) => ({
    default: function BlueprintsView() {
      return (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <BlueprintGrid />
          <Footer />
        </Box>
      );
    },
  })),
);

const LazyWorkspaceView = lazy(() =>
  import('./components/ItemWorkspace').then(({ ItemWorkspace }) => ({
    default: function WorkspaceView() {
      return (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <ItemWorkspace />
          <Footer />
        </Box>
      );
    },
  })),
);

const LazyMissionsView = lazy(() =>
  import('./components/MissionsPanel').then(({ MissionsPanel }) => ({
    default: function MissionsView() {
      return (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <MissionsPanel />
          <Footer />
        </Box>
      );
    },
  })),
);

const LazyResourcesView = lazy(() =>
  import('./components/ResourcesPage').then(({ ResourcesPage }) => ({
    default: function ResourcesView() {
      return (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <ResourcesPage />
          <Footer />
        </Box>
      );
    },
  })),
);

const LazyPlannerView = lazy(() =>
  import('./components/PlannerPage').then(({ PlannerPage }) => ({
    default: function PlannerView() {
      return (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <PlannerPage />
          <Footer />
        </Box>
      );
    },
  })),
);

const LazyComparisonModal = lazy(() =>
  import('./components/ComparisonModal').then(({ ComparisonModal }) => ({
    default: ComparisonModal,
  })),
);

const LazyDatasetChangelog = lazy(() =>
  import('./components/DatasetChangelog').then(({ DatasetChangelog }) => ({
    default: DatasetChangelog,
  })),
);

type ResolvedMainView = 'blueprints' | 'workspace' | 'missions' | 'resources' | 'planner';

function BlueprintGridFallback() {
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', backgroundColor: 'background.paper', p: { xs: 1.25, sm: 1.5 } }}>
        <Stack spacing={1.25}>
          <Skeleton variant="rounded" height={36} />
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Skeleton variant="rounded" width={120} height={32} />
            <Skeleton variant="rounded" width={120} height={32} />
            <Skeleton variant="rounded" width={120} height={32} />
          </Stack>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Skeleton variant="rounded" width={96} height={28} />
            <Skeleton variant="rounded" width={110} height={28} />
            <Skeleton variant="rounded" width={140} height={28} />
            <Skeleton variant="rounded" width={100} height={28} />
          </Stack>
        </Stack>
      </Box>
      <Box sx={{ p: { xs: 1.25, sm: 2, md: 3 }, flex: 1 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
              lg: 'repeat(4, 1fr)',
              xl: 'repeat(5, 1fr)',
            },
            gap: { xs: 1.5, sm: 2, lg: 3 },
          }}
        >
          {Array.from({ length: 8 }).map((_, index) => (
            <Paper key={index} variant="outlined" sx={{ p: 2 }}>
              <Skeleton variant="rounded" height={152} sx={{ mb: 2 }} />
              <Skeleton width="72%" height={32} />
              <Skeleton width="48%" height={20} sx={{ mb: 1.5 }} />
              <Stack spacing={1}>
                <Skeleton height={18} />
                <Skeleton height={18} />
              </Stack>
              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 2 }}>
                <Skeleton variant="rounded" width={96} height={24} />
                <Skeleton variant="rounded" width={88} height={24} />
              </Stack>
            </Paper>
          ))}
        </Box>
      </Box>
      <Footer />
    </Box>
  );
}

function WorkspaceFallback() {
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          p: { xs: 1.25, sm: 2, md: 3 },
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: '360px minmax(0, 1fr)' },
          gap: { xs: 2, md: 3 },
          flex: 1,
        }}
      >
        <Stack spacing={2}>
          <Skeleton variant="rounded" width={124} height={32} />
          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Skeleton width="28%" height={18} sx={{ mb: 1.5 }} />
            <Skeleton width="76%" height={54} sx={{ mb: 1.25 }} />
            <Skeleton width="34%" height={24} sx={{ mb: 2 }} />
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <Skeleton variant="rounded" width={140} height={36} />
              <Skeleton variant="rounded" width={140} height={36} />
            </Stack>
            <Skeleton variant="rounded" height={220} />
          </Paper>
          <Paper variant="outlined" sx={{ p: 2.25 }}>
            <Skeleton width="26%" height={18} sx={{ mb: 1.5 }} />
            <Skeleton height={18} sx={{ mb: 1 }} />
            <Skeleton height={18} sx={{ mb: 1 }} />
            <Skeleton width="84%" height={18} />
          </Paper>
        </Stack>

        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 2.25 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
              <Skeleton variant="rounded" height={88} sx={{ flex: 1 }} />
              <Skeleton variant="rounded" height={88} sx={{ flex: 1 }} />
              <Skeleton variant="rounded" height={88} sx={{ flex: 1 }} />
            </Stack>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2.25 }}>
            <Skeleton width="18%" height={18} sx={{ mb: 1.5 }} />
            <Stack spacing={1.25}>
              <Skeleton variant="rounded" height={120} />
              <Skeleton variant="rounded" height={120} />
            </Stack>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2.25 }}>
            <Skeleton width="22%" height={18} sx={{ mb: 1.5 }} />
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
              <Skeleton variant="rounded" height={180} sx={{ flex: 1 }} />
              <Skeleton variant="rounded" height={180} sx={{ flex: 1 }} />
            </Stack>
          </Paper>
        </Stack>
      </Box>
      <Footer />
    </Box>
  );
}

function MissionsFallback() {
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', backgroundColor: 'background.paper', p: 1.5 }}>
        <Stack spacing={1.25}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
            <Skeleton variant="rounded" height={32} sx={{ flex: 1 }} />
            <Skeleton variant="rounded" width={180} height={32} />
            <Skeleton variant="rounded" width={220} height={32} />
          </Stack>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Skeleton variant="rounded" width={160} height={32} />
            <Skeleton variant="rounded" width={160} height={32} />
            <Skeleton variant="rounded" width={160} height={32} />
            <Skeleton variant="rounded" width={160} height={32} />
          </Stack>
          <Skeleton variant="rounded" height={44} />
        </Stack>
      </Box>
      <Box sx={{ p: { xs: 1.25, sm: 2, md: 3 }, flex: 1 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' },
            gap: { xs: 1.25, sm: 1.5, md: 2 },
          }}
        >
          {Array.from({ length: 8 }).map((_, index) => (
            <Paper key={index} variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1.25}>
                <Stack direction="row" justifyContent="space-between">
                  <Skeleton variant="rounded" width={110} height={24} />
                  <Skeleton variant="circular" width={12} height={12} />
                </Stack>
                <Skeleton width="74%" height={28} />
                <Skeleton width="56%" height={18} />
                <Skeleton height={18} />
                <Skeleton height={18} />
                <Stack direction="row" spacing={0.75}>
                  <Skeleton variant="rounded" width={96} height={24} />
                  <Skeleton variant="rounded" width={84} height={24} />
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Box>
      </Box>
      <Footer />
    </Box>
  );
}

function ResourcesFallback() {
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', backgroundColor: 'background.paper', p: 1.5 }}>
        <Stack spacing={1.25}>
          <Skeleton width={180} height={36} />
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Skeleton variant="rounded" width={120} height={70} />
            <Skeleton variant="rounded" width={120} height={70} />
            <Skeleton variant="rounded" width={120} height={70} />
            <Skeleton variant="rounded" width={120} height={70} />
          </Stack>
        </Stack>
      </Box>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', backgroundColor: 'background.paper', p: 1.5 }}>
        <Stack spacing={1.25}>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1}>
            <Skeleton variant="rounded" height={38} sx={{ flex: 1 }} />
            <Skeleton variant="rounded" width={220} height={38} />
          </Stack>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Skeleton variant="rounded" width={92} height={32} />
            <Skeleton variant="rounded" width={92} height={32} />
            <Skeleton variant="rounded" width={92} height={32} />
            <Skeleton variant="rounded" width={92} height={32} />
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
            <Skeleton variant="rounded" height={40} sx={{ flex: 1 }} />
            <Skeleton variant="rounded" height={40} sx={{ flex: 1 }} />
            <Skeleton variant="rounded" height={40} sx={{ flex: 1 }} />
            <Skeleton variant="rounded" height={40} sx={{ flex: 1 }} />
          </Stack>
        </Stack>
      </Box>
      <Box sx={{ p: { xs: 1.25, sm: 2, md: 3 }, flex: 1 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)', xl: 'repeat(4, 1fr)' },
            gap: { xs: 1.25, sm: 1.5, xl: 2 },
          }}
        >
          {Array.from({ length: 8 }).map((_, index) => (
            <Paper key={index} variant="outlined" sx={{ p: 2 }}>
              <Skeleton variant="rounded" height={164} sx={{ mb: 2 }} />
              <Skeleton width="56%" height={28} />
              <Skeleton height={18} sx={{ mb: 1.5 }} />
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <Skeleton variant="rounded" width={92} height={56} />
                <Skeleton variant="rounded" width={92} height={56} />
                <Skeleton variant="rounded" width={92} height={56} />
              </Stack>
            </Paper>
          ))}
        </Box>
      </Box>
      <Footer />
    </Box>
  );
}

function PlannerFallback() {
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Box
        sx={{
          px: 3,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          flexWrap: 'wrap',
        }}
      >
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
          <Skeleton width={120} height={30} />
          <Skeleton variant="rounded" width={96} height={24} />
          <Skeleton variant="rounded" width={120} height={24} />
        </Stack>
        <Stack direction="row" spacing={1}>
          <Skeleton variant="rounded" width={108} height={32} />
          <Skeleton variant="rounded" width={84} height={32} />
        </Stack>
      </Box>
      <Box
        sx={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '320px minmax(0, 1fr)' },
          minHeight: 0,
        }}
      >
        <Box sx={{ p: 2, borderRight: { lg: 1 }, borderColor: 'divider' }}>
          <Stack spacing={1.25}>
            <Skeleton width="34%" height={22} />
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} variant="rounded" height={92} />
            ))}
          </Stack>
        </Box>
        <Box sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Skeleton width="28%" height={22} />
            <Skeleton variant="rounded" height={220} />
            <Skeleton variant="rounded" height={180} />
          </Stack>
        </Box>
      </Box>
      <Footer />
    </Box>
  );
}

function MainContentFallback({ view }: { view: ResolvedMainView }) {
  switch (view) {
    case 'missions':
      return <MissionsFallback />;
    case 'resources':
      return <ResourcesFallback />;
    case 'planner':
      return <PlannerFallback />;
    case 'workspace':
      return <WorkspaceFallback />;
    case 'blueprints':
    default:
      return <BlueprintGridFallback />;
  }
}

function ComparisonModalFallback() {
  return (
    <Dialog open fullWidth maxWidth="lg" aria-label="Loading comparison">
      <DialogTitle>
        <Skeleton width={180} height={28} />
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Skeleton variant="rounded" width={120} height={28} />
            <Skeleton variant="rounded" width={120} height={28} />
          </Stack>
          <Skeleton variant="rounded" height={260} />
          <Skeleton variant="rounded" height={220} />
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

function DatasetChangelogFallback() {
  return (
    <Dialog open fullWidth maxWidth="md" aria-label="Loading changelog">
      <DialogTitle>
        <Skeleton width={220} height={28} />
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Skeleton variant="rounded" width={96} height={28} />
            <Skeleton variant="rounded" width={96} height={28} />
            <Skeleton variant="rounded" width={96} height={28} />
          </Stack>
          <Skeleton variant="rounded" height={200} />
          <Skeleton variant="rounded" height={200} />
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

function MainContent({ mainView }: { mainView: MainView }) {
  const { activeBlueprint, ensureMissionRewardsLoaded } = useCraft();

  useEffect(() => {
    if (mainView === 'missions' || mainView === 'resources' || !activeBlueprint) {
      void ensureMissionRewardsLoaded();
    }
  }, [mainView, activeBlueprint, ensureMissionRewardsLoaded]);

  const resolvedView: ResolvedMainView =
    mainView === 'missions'
      ? 'missions'
      : mainView === 'resources'
        ? 'resources'
      : mainView === 'planner'
        ? 'planner'
        : activeBlueprint
          ? 'workspace'
          : 'blueprints';

  const SelectedView =
    resolvedView === 'missions'
      ? LazyMissionsView
      : resolvedView === 'resources'
        ? LazyResourcesView
      : resolvedView === 'planner'
        ? LazyPlannerView
        : resolvedView === 'workspace'
          ? LazyWorkspaceView
          : LazyBlueprintsView;

  return (
    <Suspense fallback={<MainContentFallback view={resolvedView} />}>
      <Fade in timeout={resolvedView === 'workspace' ? 200 : 180}>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <SelectedView />
        </Box>
      </Fade>
    </Suspense>
  );
}

function AppShell() {
  const {
    activeDataset,
    datasetLoading,
    datasetError,
    ensureMissionRewardsLoaded,
    comparisonOpen,
    changelogOpen,
  } = useCraft();
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
      if (nextView === 'missions' || nextView === 'resources') {
        void ensureMissionRewardsLoaded();
      }
    };

    syncViewFromPath();
    window.addEventListener('popstate', syncViewFromPath);
    return () => window.removeEventListener('popstate', syncViewFromPath);
  }, [ensureMissionRewardsLoaded]);

  const handleChangeView = useCallback((view: MainView) => {
    const path =
      view === 'missions'
        ? '/missions'
        : view === 'resources'
          ? '/resources'
          : view === 'planner'
            ? '/planner'
            : '/';
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
      {comparisonOpen && (
        <Suspense fallback={<ComparisonModalFallback />}>
          <LazyComparisonModal />
        </Suspense>
      )}
      {changelogOpen && (
        <Suspense fallback={<DatasetChangelogFallback />}>
          <LazyDatasetChangelog />
        </Suspense>
      )}
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
