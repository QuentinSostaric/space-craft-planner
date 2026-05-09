import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { useCraft } from '../store/CraftContext';
import { useCraftSimulator } from '../hooks/useCraftSimulator';
import { aggregateBlueprintResources, getAcquisitionEntry } from '../utils/crafting';
import { useI18n } from '../i18n/I18nContext';
import { ItemIdentity } from './item-workspace/ItemIdentity';
import { CraftSection } from './item-workspace/CraftSection';
import { MaterialSourcesSection } from './item-workspace/MaterialSourcesSection';
import { AcquisitionSection } from './item-workspace/AcquisitionSection';
import { DismantleSection } from './item-workspace/DismantleSection';
import { BlueprintOverview } from './item-workspace/BlueprintOverview';
import { missionPathFromSlug, missionSlugFromContract, navigateToPath } from '../utils/slug';

type WorkspaceTabId = 'craft' | 'materials' | 'missions';

function WorkspaceTabs({
  activeTab,
  onChange,
  hasResources,
}: {
  activeTab: WorkspaceTabId;
  onChange: (tab: WorkspaceTabId) => void;
  hasResources: boolean;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const tabs = [
    { id: 'craft', label: t('Craft', 'Craft'), disabled: false },
    { id: 'materials', label: t('Materials', 'Materiaux'), disabled: !hasResources },
    { id: 'missions', label: t('Missions', 'Missions'), disabled: false },
  ] satisfies Array<{ id: WorkspaceTabId; label: string; disabled: boolean }>;

  return (
    <Paper
      variant="outlined"
      sx={{
        position: { md: 'sticky' },
        top: { md: 0 },
        zIndex: 4,
        minWidth: 0,
        overflow: 'hidden',
        borderColor: theme.palette.ui.border,
        background: `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.98)}, ${alpha(theme.palette.background.default, 0.92)})`,
        backdropFilter: 'blur(10px)',
      }}
    >
      <Tabs
        value={activeTab}
        onChange={(_event, nextValue: WorkspaceTabId) => onChange(nextValue)}
        aria-label={t('Blueprint detail sections', 'Sections du detail blueprint')}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{
          minHeight: 46,
          '& .MuiTabs-flexContainer': {
            minHeight: 46,
          },
          '& .MuiTabs-indicator': {
            display: 'none',
          },
          '& .MuiTab-root': {
            minHeight: 46,
            px: { xs: 1.35, md: 2.6 },
            color: 'text.secondary',
            borderRight: `1px solid ${theme.palette.ui.border}`,
            borderBottom: '2px solid transparent',
            fontSize: { xs: '0.68rem', md: '0.72rem' },
            letterSpacing: '0.09em',
            '&:hover': {
              color: 'text.primary',
              backgroundColor: alpha(theme.palette.primary.main, 0.055),
            },
            '&.Mui-selected': {
              color: 'primary.light',
              borderBottomColor: theme.palette.primary.main,
              background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.11)}, transparent)`,
            },
            '&.Mui-disabled': {
              color: 'text.disabled',
              opacity: 0.38,
            },
          },
        }}
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.id}
            id={`blueprint-tab-${tab.id}`}
            aria-controls={`blueprint-tabpanel-${tab.id}`}
            value={tab.id}
            label={tab.label}
            disabled={tab.disabled}
          />
        ))}
      </Tabs>
    </Paper>
  );
}

function TabPanel({
  activeTab,
  tab,
  children,
}: {
  activeTab: WorkspaceTabId;
  tab: WorkspaceTabId;
  children: ReactNode;
}) {
  if (activeTab !== tab) {
    return null;
  }

  return (
    <Box
      id={`blueprint-tabpanel-${tab}`}
      role="tabpanel"
      aria-labelledby={`blueprint-tab-${tab}`}
      sx={{ minWidth: 0 }}
    >
      {children}
    </Box>
  );
}

export function ItemWorkspace() {
  const {
    activeDataset,
    activeBlueprint,
    setActiveBlueprint,
    slotAssignments,
    assignQuality,
    clearAssignments,
    inventoryIds,
    toggleInventory,
    favoriteIds,
    toggleFavorite,
    addGoal,
    addPlannerResourceRequirement,
    missionRewards,
    missionRewardsLoading,
    resourceDataLoading,
    ensureBlueprintDetailLoaded,
    ensureMissionRewardsLoaded,
    ensureResourceDataLoaded,
    ensureFactionContractsLoaded,
    factionContractsByFactionId,
    dismantlingData,
    materialSources,
  } = useCraft();
  const detailReady = Boolean(activeBlueprint?.detailsLoaded);
  const { qualityScore, projectedStats } = useCraftSimulator(
    detailReady ? activeBlueprint : null,
    slotAssignments,
  );
  const [qty, setQty] = useState(1);
  const [activeTab, setActiveTab] = useState<WorkspaceTabId>('craft');

  // Reset quantity when a different blueprint is selected
  useEffect(() => {
    setQty(1);
    setActiveTab('craft');
  }, [activeBlueprint?.id]);

  // Trigger lazy load of blueprint detail
  useEffect(() => {
    if (activeBlueprint && !activeBlueprint.detailsLoaded) {
      void ensureBlueprintDetailLoaded(activeBlueprint.id);
    }
  }, [activeBlueprint, ensureBlueprintDetailLoaded]);

  // Trigger lazy load of dataset chunks needed by the workspace
  useEffect(() => {
    if (activeBlueprint) {
      void ensureMissionRewardsLoaded();
      void ensureResourceDataLoaded();
    }
  // activeBlueprint?.id — re-fire only on blueprint change, not on detail hydration
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBlueprint?.id, ensureMissionRewardsLoaded, ensureResourceDataLoaded]);

  // Derived data
  const requiredResources = useMemo(
    () => detailReady && activeBlueprint ? aggregateBlueprintResources(activeBlueprint.slots, slotAssignments) : [],
    [activeBlueprint, detailReady, slotAssignments],
  );

  const acquisitionEntry = useMemo(
    () => activeBlueprint ? getAcquisitionEntry(missionRewards, activeBlueprint.id) : null,
    [activeBlueprint, missionRewards],
  );

  useEffect(() => {
    if (activeTab === 'materials' && requiredResources.length === 0) {
      setActiveTab(detailReady ? 'craft' : 'missions');
    }
  }, [activeTab, detailReady, requiredResources.length]);

  // Load faction contracts for factions referenced by this blueprint's acquisition entry
  useEffect(() => {
    if (!missionRewards || !acquisitionEntry) return;
    const nameToId = new Map(missionRewards.factionGroups.map((g) => [g.contractorDisplayName, g.id]));
    for (const faction of acquisitionEntry.factions) {
      const factionId = nameToId.get(faction.contractorDisplayName ?? '');
      if (factionId) void ensureFactionContractsLoaded(factionId);
    }
  }, [missionRewards, acquisitionEntry, ensureFactionContractsLoaded]);

  if (!activeBlueprint) return null;

  const isFavorite = favoriteIds.includes(activeBlueprint.id);
  const isLooted = inventoryIds.includes(activeBlueprint.id);

  const dismantleTimeSecs = dismantlingData?.dismantling?.blueprint?.dismantleTimeSecs ?? 0;
  const dismantleEfficiency = dismantlingData?.dismantling?.blueprint?.efficiency ?? 0.5;

  return (
    <Box
      component="section"
      aria-label={activeBlueprint.name}
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          md: 'minmax(300px, 340px) minmax(0, 1fr)',
          xl: 'minmax(320px, 360px) minmax(0, 1fr)',
        },
        alignItems: 'start',
        gap: { xs: 1.25, sm: 1.5, lg: 1.75 },
        p: { xs: 1, sm: 1.25, lg: 1.5 },
      }}
    >
      {/* Left column — sticky on desktop */}
      <Box
        sx={{
          minWidth: 0,
          position: { md: 'sticky' },
          top: { md: 10 },
          maxHeight: { md: 'calc(100dvh - 20px)' },
          overflowY: { md: 'auto' },
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          '&::-webkit-scrollbar': {
            width: 0,
            height: 0,
            display: 'none',
          },
          flexShrink: 0,
          alignSelf: { md: 'flex-start' },
        }}
      >
        <ItemIdentity
          blueprint={activeBlueprint}
          isFavorite={isFavorite}
          isLooted={isLooted}
          onBack={() => setActiveBlueprint(null)}
          onToggleFavorite={() => toggleFavorite(activeBlueprint.id)}
          onToggleInventory={() => toggleInventory(activeBlueprint.id)}
        />
      </Box>

      {/* Right column — scrollable */}
      <Box
        sx={{
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: { xs: 1.25, md: 1.5 },
        }}
      >
        <WorkspaceTabs
          activeTab={activeTab}
          onChange={setActiveTab}
          hasResources={requiredResources.length > 0}
        />

        <TabPanel activeTab={activeTab} tab="craft">
          <BlueprintOverview
            blueprint={activeBlueprint}
            detailReady={detailReady}
            qualityScore={qualityScore}
            projectedStats={projectedStats}
            acquisitionEntry={acquisitionEntry}
            acquisitionLoading={missionRewardsLoading}
            resources={requiredResources}
            resourceDataLoading={resourceDataLoading}
            dismantleTimeSecs={dismantleTimeSecs}
            dismantleEfficiency={dismantleEfficiency}
          />

          {detailReady ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.25, md: 1.5 }, mt: { xs: 1.25, md: 1.5 } }}>
              <CraftSection
                blueprint={activeBlueprint}
                slotAssignments={slotAssignments}
                assignQuality={assignQuality}
                clearAssignments={clearAssignments}
                qualityScore={qualityScore}
                projectedStats={projectedStats}
              />
              <DismantleSection
                blueprint={activeBlueprint}
                allResources={activeDataset.resources}
                resources={requiredResources}
                dismantleTimeSecs={dismantleTimeSecs}
                efficiency={dismantleEfficiency}
              />
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <LinearProgress />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Loading blueprint detail...
              </Typography>
            </Box>
          )}
        </TabPanel>

        <TabPanel activeTab={activeTab} tab="materials">
          <MaterialSourcesSection
            resources={requiredResources}
            allResources={activeDataset.resources}
            materialSources={materialSources}
            hasResourceData={activeDataset.hasResourceData}
            loading={resourceDataLoading}
            qty={qty}
            setQty={setQty}
            onAddGoal={() => addGoal(qualityScore, projectedStats, qty)}
            onAddResource={(resourceName, quantity, quantityUnit) => {
              addPlannerResourceRequirement(
                resourceName,
                quantity,
                quantityUnit === 'count' ? 'count' : 'scu',
              );
            }}
          />
        </TabPanel>

        <TabPanel activeTab={activeTab} tab="missions">
          <AcquisitionSection
            entry={acquisitionEntry}
            loading={missionRewardsLoading}
            missionRewards={missionRewards}
            factionContractsByFactionId={factionContractsByFactionId}
            onMissionClick={(contractDebugName, contractorDisplayName) => {
              const missionSlug = missionSlugFromContract(contractDebugName, contractorDisplayName);
              navigateToPath(missionPathFromSlug(missionSlug), { missionSlug, mainView: 'missions' });
              setActiveBlueprint(null);
            }}
            onBlueprintClick={(blueprintId) => {
              const blueprint = activeDataset.blueprints.find((candidate) => candidate.id === blueprintId);
              if (blueprint) {
                setActiveBlueprint(blueprint);
              }
            }}
          />
        </TabPanel>
      </Box>
    </Box>
  );
}
