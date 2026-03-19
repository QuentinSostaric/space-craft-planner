import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Paper from '@mui/material/Paper';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Drawer from '@mui/material/Drawer';
import SettingsIcon from '@mui/icons-material/Settings';
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
          <SettingsIcon sx={{ fontSize: '1.1rem' }} />
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

  const sidebarWidth = 280;

  if (datasetLoading && activeDataset.blueprints.length === 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
        <a className="skip-link" href="#main-content">
          {t('Skip to main content', 'Aller au contenu principal')}
        </a>
        <Header />
        <Box component="main" id="main-content" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, p: 4 }} aria-live="polite">
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
      </Box>
    );
  }

  if (datasetError && activeDataset.blueprints.length === 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
        <a className="skip-link" href="#main-content">
          {t('Skip to main content', 'Aller au contenu principal')}
        </a>
        <Header />
        <Box component="main" id="main-content" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, p: 4 }} aria-live="assertive">
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
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      <a className="skip-link" href="#main-content">
        {t('Skip to main content', 'Aller au contenu principal')}
      </a>
      <Header />
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Desktop sidebar */}
        <Box
          component="aside"
          sx={{
            display: { xs: 'none', md: 'block' },
            width: sidebarWidth,
            flexShrink: 0,
            borderRight: 1,
            borderColor: 'divider',
            height: '100%',
            overflowY: 'auto',
          }}
          aria-label={t('Blueprint filters', 'Filtres blueprints')}
        >
          <BlueprintExplorer />
        </Box>

        {/* Mobile sidebar (Drawer) */}
        <Drawer
          variant="temporary"
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: sidebarWidth },
          }}
          aria-label={t('Blueprint filters', 'Filtres blueprints')}
        >
          <BlueprintExplorer />
        </Drawer>

        <Box
          component="main"
          id="main-content"
          sx={{
            flex: 1,
            height: '100%',
            overflow: 'hidden',
          }}
          aria-label={t('Content', 'Contenu')}
        >
          <MainContent onToggleFilters={() => setFiltersOpen((v) => !v)} filtersOpen={filtersOpen} />
        </Box>
        <PlannerDrawer />
      </Box>
      <Footer />
      <ComparisonModal />
      <DatasetChangelog />
    </Box>
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
