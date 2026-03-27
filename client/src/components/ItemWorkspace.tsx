import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import { useCraft } from '../store/CraftContext';
import { useCraftSimulator } from '../hooks/useCraftSimulator';
import { aggregateBlueprintResources, getAcquisitionEntry } from '../utils/crafting';
import { ItemIdentity } from './item-workspace/ItemIdentity';
import { CraftSection } from './item-workspace/CraftSection';
import { MaterialSourcesSection } from './item-workspace/MaterialSourcesSection';
import { AcquisitionSection } from './item-workspace/AcquisitionSection';
import { DismantleSection } from './item-workspace/DismantleSection';
import { missionPathFromSlug, missionSlugFromContract, navigateToPath } from '../utils/slug';

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
    dismantlingData,
    materialSources,
  } = useCraft();
  const detailReady = Boolean(activeBlueprint?.detailsLoaded);
  const { qualityScore, projectedStats } = useCraftSimulator(
    detailReady ? activeBlueprint : null,
    slotAssignments,
  );
  const [qty, setQty] = useState(1);

  // Reset quantity when a different blueprint is selected
  useEffect(() => { setQty(1); }, [activeBlueprint?.id]);

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
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        alignItems: { md: 'flex-start' },
        gap: { xs: 2, md: 3 },
        p: { xs: 1.25, sm: 1.5, md: 2 },
      }}
    >
      {/* Left column — sticky on desktop */}
      <Box
        sx={{
          width: { xs: '100%', md: '36%' },
          position: { md: 'sticky' },
          top: { md: 16 },
          maxHeight: { md: '100vh' },
          overflowY: { md: 'auto' },
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
          width: { xs: '100%', md: '64%' },
          display: 'flex',
          flexDirection: 'column',
          gap: { xs: 2, md: 3 },
        }}
      >
        {detailReady ? (
          <CraftSection
            blueprint={activeBlueprint}
            slotAssignments={slotAssignments}
            assignQuality={assignQuality}
            clearAssignments={clearAssignments}
            qualityScore={qualityScore}
            projectedStats={projectedStats}
          />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <LinearProgress />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Loading blueprint detail...
            </Typography>
          </Box>
        )}

        <Divider />

        <AcquisitionSection
          entry={acquisitionEntry}
          loading={missionRewardsLoading}
          missionRewards={missionRewards}
          onMissionClick={(contractDebugName, contractorDisplayName) => {
            const missionSlug = missionSlugFromContract(contractDebugName, contractorDisplayName);
            navigateToPath(missionPathFromSlug(missionSlug), { missionSlug, mainView: 'missions' });
            setActiveBlueprint(null);
          }}
        />

        <Divider />

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

        {detailReady && (
          <>
          <Divider />
          <DismantleSection
            blueprint={activeBlueprint}
            allResources={activeDataset.resources}
            resources={requiredResources}
            dismantleTimeSecs={dismantleTimeSecs}
            efficiency={dismantleEfficiency}
          />
          </>
        )}
      </Box>
    </Box>
  );
}
