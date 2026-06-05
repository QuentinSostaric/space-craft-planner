import { ThemeProvider } from '@mui/material/styles';
import GlobalStyles from '@mui/material/GlobalStyles';
import CssBaseline from '@mui/material/CssBaseline';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import CircularProgress from '@mui/material/CircularProgress';
import Fade from '@mui/material/Fade';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { createAppTheme } from './theme';
import { useTheme } from './hooks/useTheme';
import { ThemeModeContext } from './hooks/ThemeContext';
import { I18nProvider, useI18n } from './i18n/I18nContext';
import { AuthProvider } from './auth/AuthContext';
import { AccountStateSync } from './auth/AccountStateSync';
import { useAuth } from './auth/AuthContext';
import { CraftProvider } from './store/CraftContext';
import { ScLogProvider } from './hooks/ScLogSyncContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { NavRail } from './components/NavRail';
import { Footer } from './components/Footer';
import { OnboardingDialog } from './components/OnboardingDialog';
import { AppUpdateSnackbar } from './components/AppUpdateSnackbar';
import { CookieConsentBanner } from './components/CookieConsentBanner';
import { AppUpdateContext, useAppUpdateState } from './hooks/useAppUpdate';
import { useCraft } from './store/CraftContext';
import { AnalyticsProvider, setAnalyticsContext, trackEvent, trackPageView } from './analytics/posthog';
import { AnalyticsIdentitySync } from './analytics/AnalyticsIdentitySync';
import { ServerFlagsProvider } from './hooks/ServerFlagsContext';
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { MainView } from './components/NavRail';
import { mainViewFromPathname, navigateToPath } from './utils/slug';

const LazyBlueprintsView = lazy(() =>
  import('./components/BlueprintGrid').then(({ BlueprintGrid }) => ({
    default: function BlueprintsView() {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
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
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
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
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
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
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
          <ResourcesPage />
          <Footer />
        </Box>
      );
    },
  })),
);

const LazyOrganizationsView = lazy(() =>
  import('./components/OrganizationsPage').then(({ OrganizationsPage }) => ({
    default: function OrganizationsView() {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
          <OrganizationsPage />
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
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
          <PlannerPage />
          <Footer />
        </Box>
      );
    },
  })),
);

const LazyAccountView = lazy(() =>
  import('./components/AccountPage').then(({ AccountPage }) => ({
    default: function AccountView() {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
          <AccountPage />
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

const LazyDatasetChangelogView = lazy(() =>
  import('./components/DatasetChangelogPage').then(({ DatasetChangelogPage }) => ({
    default: function ChangelogView() {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
          <DatasetChangelogPage />
          <Footer />
        </Box>
      );
    },
  })),
);

const LazyPrivacyView = lazy(() =>
  import('./components/PrivacyPolicyPage').then(({ PrivacyPolicyPage }) => ({
    default: function PrivacyView() {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
          <PrivacyPolicyPage />
          <Footer />
        </Box>
      );
    },
  })),
);

type ResolvedMainView =
  | 'blueprints'
  | 'workspace'
  | 'missions'
  | 'resources'
  | 'organizations'
  | 'planner'
  | 'changelog'
  | 'account'
  | 'privacy';

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

function OrganizationsFallback() {
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', backgroundColor: 'background.paper', p: 1.5 }}>
        <Stack spacing={1.25}>
          <Skeleton width={220} height={36} />
          <Skeleton width="72%" height={20} />
        </Stack>
      </Box>
      <Box sx={{ p: { xs: 1.25, sm: 2, md: 3 }, flex: 1 }}>
        <Stack spacing={1.5}>
          {Array.from({ length: 3 }).map((_, index) => (
            <Paper key={index} variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <Skeleton variant="rounded" width={52} height={52} />
                  <Box sx={{ flex: 1 }}>
                    <Skeleton width="32%" height={24} />
                    <Skeleton width="18%" height={18} />
                  </Box>
                </Stack>
                <Skeleton variant="rounded" height={54} />
                <Skeleton variant="rounded" height={220} />
              </Stack>
            </Paper>
          ))}
        </Stack>
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

function AccountFallback() {
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: { xs: 1.5, md: 3 }, flex: 1 }}>
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Skeleton width={120} height={20} sx={{ mb: 1.5 }} />
          <Skeleton width={180} height={42} sx={{ mb: 1.5 }} />
          <Skeleton width="72%" height={20} sx={{ mb: 3 }} />
          <Skeleton variant="rounded" height={220} />
        </Paper>
      </Box>
      <Footer />
    </Box>
  );
}

function ChangelogFallback() {
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: { xs: 1.5, md: 3 }, flex: 1 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} justifyContent="space-between">
            <Box sx={{ flex: 1 }}>
              <Skeleton width={160} height={20} />
              <Skeleton width={320} height={42} />
              <Skeleton width="56%" height={20} />
            </Box>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ width: { xs: '100%', lg: 640 } }}>
              <Skeleton variant="rounded" height={56} sx={{ flex: 1 }} />
              <Skeleton variant="rounded" height={56} sx={{ flex: 1 }} />
            </Stack>
          </Stack>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Skeleton variant="rounded" width={120} height={28} />
            <Skeleton variant="rounded" width={160} height={28} />
            <Skeleton variant="rounded" width={160} height={28} />
          </Stack>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, 1fr)' }, gap: 2 }}>
            <Skeleton variant="rounded" height={420} />
            <Skeleton variant="rounded" height={420} />
          </Box>
        </Stack>
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
    case 'organizations':
      return <OrganizationsFallback />;
    case 'planner':
      return <PlannerFallback />;
    case 'account':
      return <AccountFallback />;
    case 'changelog':
      return <ChangelogFallback />;
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

function MainContent({ mainView }: { mainView: MainView }) {
  const {
    activeBlueprint,
    activeChannel,
    ensureMissionRewardsLoaded,
    inventoryIds,
    goals,
    plannerTodoItems,
    plannerResourceRequirements,
  } = useCraft();
  const { lang } = useI18n();
  const ensureMissionRewardsLoadedRef = useRef(ensureMissionRewardsLoaded);
  const previousInventoryCountRef = useRef<number | null>(null);
  const previousPlannerGoalCountRef = useRef<number | null>(null);
  const previousPlannerTodoCountRef = useRef<number | null>(null);
  const previousPlannerResourceCountRef = useRef<number | null>(null);
  const previousChannelRef = useRef<string | null>(null);
  const previousLanguageRef = useRef<string | null>(null);
  useEffect(() => { ensureMissionRewardsLoadedRef.current = ensureMissionRewardsLoaded; });

  useEffect(() => {
    if (mainView === 'missions' || mainView === 'resources') {
      void ensureMissionRewardsLoadedRef.current();
    }
  }, [mainView]);

  const plannerResourceRequirementCount = Object.keys(plannerResourceRequirements).length;

  useEffect(() => {
    setAnalyticsContext({ language: lang, channel: String(activeChannel) });
  }, [activeChannel, lang]);

  useEffect(() => {
    if (previousLanguageRef.current !== null && previousLanguageRef.current !== lang) {
      trackEvent('language_changed', { language: lang, previous_language: previousLanguageRef.current });
    }
    previousLanguageRef.current = lang;
  }, [lang]);

  useEffect(() => {
    if (previousChannelRef.current !== null && previousChannelRef.current !== activeChannel) {
      trackEvent('channel_changed', { channel: String(activeChannel), previous_channel: previousChannelRef.current });
    }
    previousChannelRef.current = String(activeChannel);
  }, [activeChannel]);

  useEffect(() => {
    trackPageView(mainView);
    if (mainView === 'account') {
      trackEvent('account_page_opened');
    }
  }, [mainView]);

  useEffect(() => {
    if (!activeBlueprint) {
      return;
    }

    trackEvent('blueprint_opened', {
      blueprint_category: String(activeBlueprint.category ?? 'unknown'),
      blueprint_manufacturer: String(activeBlueprint.manufacturer ?? 'unknown'),
      blueprint_has_details: 'slots' in activeBlueprint,
    });
  }, [activeBlueprint]);

  useEffect(() => {
    const count = inventoryIds.length;
    if (previousInventoryCountRef.current !== null && previousInventoryCountRef.current !== count) {
      trackEvent(count > previousInventoryCountRef.current ? 'inventory_item_added' : 'inventory_item_removed', {
        inventory_count: count,
        inventory_delta: Math.abs(count - previousInventoryCountRef.current),
      });
    }
    previousInventoryCountRef.current = count;
  }, [inventoryIds.length]);

  useEffect(() => {
    const count = goals.length;
    if (previousPlannerGoalCountRef.current !== null && previousPlannerGoalCountRef.current !== count) {
      trackEvent(count > previousPlannerGoalCountRef.current ? 'planner_item_added' : 'planner_item_removed', {
        planner_source: 'goal',
        planner_count: count,
        planner_delta: Math.abs(count - previousPlannerGoalCountRef.current),
      });
    }
    previousPlannerGoalCountRef.current = count;
  }, [goals.length]);

  useEffect(() => {
    const count = plannerTodoItems.length;
    if (previousPlannerTodoCountRef.current !== null && previousPlannerTodoCountRef.current !== count) {
      trackEvent(count > previousPlannerTodoCountRef.current ? 'planner_item_added' : 'planner_item_removed', {
        planner_source: 'todo',
        planner_count: count,
        planner_delta: Math.abs(count - previousPlannerTodoCountRef.current),
      });
    }
    previousPlannerTodoCountRef.current = count;
  }, [plannerTodoItems.length]);

  useEffect(() => {
    const count = plannerResourceRequirementCount;
    if (previousPlannerResourceCountRef.current !== null && previousPlannerResourceCountRef.current !== count) {
      trackEvent(count > previousPlannerResourceCountRef.current ? 'planner_item_added' : 'planner_item_removed', {
        planner_source: 'resource_requirement',
        planner_count: count,
        planner_delta: Math.abs(count - previousPlannerResourceCountRef.current),
      });
    }
    previousPlannerResourceCountRef.current = count;
  }, [plannerResourceRequirementCount]);

  const resolvedView: ResolvedMainView =
    mainView === 'missions'
      ? 'missions'
      : mainView === 'resources'
        ? 'resources'
      : mainView === 'organizations'
        ? 'organizations'
      : mainView === 'planner'
        ? 'planner'
      : mainView === 'changelog'
        ? 'changelog'
      : mainView === 'account'
        ? 'account'
      : mainView === 'privacy'
        ? 'privacy'
        : activeBlueprint
          ? 'workspace'
          : 'blueprints';

  const SelectedView =
    resolvedView === 'missions'
      ? LazyMissionsView
      : resolvedView === 'resources'
        ? LazyResourcesView
      : resolvedView === 'organizations'
        ? LazyOrganizationsView
      : resolvedView === 'planner'
        ? LazyPlannerView
      : resolvedView === 'changelog'
        ? LazyDatasetChangelogView
      : resolvedView === 'account'
        ? LazyAccountView
      : resolvedView === 'privacy'
        ? LazyPrivacyView
        : resolvedView === 'workspace'
          ? LazyWorkspaceView
          : LazyBlueprintsView;

  return (
    <Suspense fallback={<MainContentFallback view={resolvedView} />}>
      <Fade in timeout={resolvedView === 'workspace' ? 200 : 180}>
        <Box sx={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: '100%' }}>
          <SelectedView />
        </Box>
      </Fade>
    </Suspense>
  );
}

// Shared layout for the app shell (header / nav rail / main grid). Defined at
// module scope so the object identity is stable across renders and the layout
// is declared once instead of being duplicated across every loading/error/ready
// branch of AppShell.
const APP_SHELL_GRID_SX = {
  display: 'grid',
  gridTemplateAreas: { xs: '"header" "rail" "main"', md: '"header header" "rail main"' },
  gridTemplateColumns: { xs: '1fr', md: '84px 1fr' },
  gridTemplateRows: { xs: 'auto auto 1fr', md: 'auto 1fr' },
  height: '100dvh',
  overflow: 'hidden',
} as const;

const APP_SHELL_MAIN_SX = {
  gridArea: 'main',
  overflowY: 'auto',
  overflowX: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
} as const;

// Views not listed here (blueprints, privacy) navigate to the site root, matching
// the previous nested-ternary behaviour.
const MAIN_VIEW_PATHS: Partial<Record<MainView, string>> = {
  missions: '/missions',
  resources: '/resources',
  organizations: '/organizations',
  planner: '/planner',
  changelog: '/changelog',
  account: '/account',
};

function AppShell() {
  const {
    activeDataset,
    datasetLoading,
    datasetError,
    ensureMissionRewardsLoaded,
    comparisonOpen,
  } = useCraft();
  const { user, loading: authLoading } = useAuth();
  const { t } = useI18n();

  const [mainView, setMainView] = useState<MainView>(() => mainViewFromPathname(window.location.pathname));
  const [isPending, startTransition] = useTransition();
  const ensureMissionRewardsLoadedRef = useRef(ensureMissionRewardsLoaded);
  useEffect(() => { ensureMissionRewardsLoadedRef.current = ensureMissionRewardsLoaded; });

  useEffect(() => {
    const syncViewFromPath = () => {
      const nextView = mainViewFromPathname(window.location.pathname);
      startTransition(() => {
        setMainView(nextView);
      });
      if (nextView === 'missions' || nextView === 'resources') {
        void ensureMissionRewardsLoadedRef.current();
      }
    };

    syncViewFromPath();
    window.addEventListener('popstate', syncViewFromPath);
    return () => window.removeEventListener('popstate', syncViewFromPath);
  }, []);

  useEffect(() => {
    if (!authLoading && !user && mainView === 'organizations' && window.location.pathname.startsWith('/organizations')) {
      navigateToPath('/account', { mainView: 'account' });
    }
  }, [authLoading, mainView, user]);

  const guardedMainView: MainView =
    !authLoading && !user && mainView === 'organizations'
      ? 'account'
      : mainView;

  const handleChangeView = useCallback((view: MainView) => {
    const nextView = !user && view === 'organizations' ? 'account' : view;
    const path = MAIN_VIEW_PATHS[nextView] ?? '/';
    navigateToPath(path, { mainView: nextView });
  }, [user]);

  if (datasetLoading && activeDataset.blueprints.length === 0) {
    return (
      <Box sx={APP_SHELL_GRID_SX}>
        <Box sx={{ gridArea: 'header' }}>
          <Header />
          <LinearProgress sx={{ height: 2 }} />
        </Box>
        <Box component="main" id="main-content" sx={APP_SHELL_MAIN_SX}>
          <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, p: 4 }} aria-live="polite">
              <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', maxWidth: 480 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  {t('Loading published dataset', 'Chargement du dataset publie')}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {t(
                    'The app is connecting to the published dataset API.',
                    'L\'application se connecte a l API du dataset publie.',
                  )}
                </Typography>
              </Paper>
            </Box>
            <Footer />
          </Box>
        </Box>
      </Box>
    );
  }

  // Dataset switch in progress — old data present but new one loading
  if (datasetLoading && activeDataset.blueprints.length > 0) {
    return (
      <Box sx={APP_SHELL_GRID_SX}>
        <Box sx={{ gridArea: 'header' }}>
          <Header />
          <LinearProgress sx={{ height: 2 }} />
        </Box>
        <Box component="nav" sx={{ gridArea: 'rail', display: 'flex', minWidth: 0 }}>
          <NavRail mainView={guardedMainView} onChangeView={handleChangeView} />
        </Box>
        <Box
          component="main"
          id="main-content"
          sx={APP_SHELL_MAIN_SX}
          aria-live="polite"
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
              <Fade in timeout={300}>
                <Box sx={{ textAlign: 'center' }}>
                  <CircularProgress
                    size={56}
                    thickness={2}
                    sx={{ mb: 3, color: 'primary.main' }}
                  />
                  <Typography variant="h6" sx={{ mb: 0.75 }}>
                    {t('Loading new dataset', 'Chargement du dataset')}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {t('Please wait…', 'Veuillez patienter…')}
                  </Typography>
                </Box>
              </Fade>
            </Box>
            <Footer />
          </Box>
        </Box>
      </Box>
    );
  }
  if (datasetError && activeDataset.blueprints.length === 0) {
    return (
      <Box sx={APP_SHELL_GRID_SX}>
        <Box sx={{ gridArea: 'header' }}>
          <Header />
        </Box>
        <Box component="main" id="main-content" sx={APP_SHELL_MAIN_SX}>
          <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, p: 4 }} aria-live="assertive">
              <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', maxWidth: 480, borderColor: 'error.main' }}>
                <Typography variant="h6" sx={{ mb: 1, color: 'error.main' }}>
                  {t('Published dataset unavailable', 'Dataset publie indisponible')}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>{datasetError}</Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                  {t(
                    'This app reads published datasets through the runtime API. The API must be available.',
                    'Cette app lit les datasets publies via l API runtime. L API doit etre disponible.',
                  )}
                </Typography>
              </Paper>
            </Box>
            <Footer />
          </Box>
        </Box>
      </Box>
    );
  }
  return (
    <Box
      sx={APP_SHELL_GRID_SX}
    >
      <Box sx={{ gridArea: 'header' }}>
        <Header />
        {isPending && <LinearProgress sx={{ height: 2 }} />}
      </Box>
      <Box component="nav" sx={{ gridArea: 'rail', display: 'flex', minWidth: 0 }}>
        <NavRail
          mainView={guardedMainView}
          onChangeView={handleChangeView}
        />
      </Box>
      <Box
        component="main"
        id="main-content"
        sx={{
          gridArea: 'main',
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
        aria-label={t('Content', 'Contenu')}
      >
        <MainContent mainView={guardedMainView} />
      </Box>
      {comparisonOpen && (
        <Suspense fallback={<ComparisonModalFallback />}>
          <LazyComparisonModal />
        </Suspense>
      )}
    </Box>
  );
}

function AppUpdateProviderInner() {
  const updateState = useAppUpdateState();
  return (
    <AppUpdateContext.Provider value={updateState}>
      <AccountStateSync />
      <AppShell />
      <OnboardingDialog />
      <AppUpdateSnackbar />
      <CookieConsentBanner />
    </AppUpdateContext.Provider>
  );
}

function AppContentInner() {
  const [themeMode, setThemeMode] = useTheme();
  const theme = useMemo(() => createAppTheme(themeMode), [themeMode]);
  const themeModeCtx = useMemo(
    () => ({ mode: themeMode, setMode: setThemeMode, toggle: () => setThemeMode(themeMode === 'dark' ? 'light' : 'dark') }),
    [themeMode, setThemeMode],
  );

  return (
    <ThemeModeContext.Provider value={themeModeCtx}>
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      <GlobalStyles styles={{
        html: { height: '100%' },
        body: {
          height: '100dvh',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        },
        '#root': {
          flex: 1,
          minHeight: 0,
          height: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        },
        '*': {
          scrollbarWidth: 'thin',
          scrollbarColor: `${theme.palette.ui.borderStrong} ${theme.palette.ui.surface1}`,
        },
        '*::-webkit-scrollbar': {
          width: '10px',
          height: '10px',
        },
        '*::-webkit-scrollbar-track': {
          backgroundColor: theme.palette.ui.surface1,
        },
        '*::-webkit-scrollbar-thumb': {
          backgroundColor: theme.palette.ui.borderStrong,
          borderRadius: '999px',
          border: `2px solid ${theme.palette.ui.surface1}`,
        },
        '*::-webkit-scrollbar-thumb:hover': {
          backgroundColor: theme.palette.primary.main,
        },
        '*::-webkit-scrollbar-corner': {
          backgroundColor: theme.palette.ui.surface1,
        },
      }} />
      <I18nProvider>
        <AuthProvider>
          <AnalyticsIdentitySync />
          <ServerFlagsProvider>
            <CraftProvider>
              <ScLogProvider>
                <AppUpdateProviderInner />
              </ScLogProvider>
            </CraftProvider>
          </ServerFlagsProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

function AppContent() {
  return (
    <AnalyticsProvider>
      <AppContentInner />
    </AnalyticsProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
