import { useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { useCraftSimulator } from '../hooks/useCraftSimulator';
import { aggregateBlueprintResources, getAcquisitionEntry } from '../utils/crafting';
import { COMPARISON_COLORS } from '../types';
import { HeroSection } from './item-workspace/HeroSection';
import { StatsSection } from './item-workspace/StatsSection';
import { CraftSection } from './item-workspace/CraftSection';
import { MaterialSourcesSection } from './item-workspace/MaterialSourcesSection';
import { AcquisitionSection } from './item-workspace/AcquisitionSection';
import { DismantleSection } from './item-workspace/DismantleSection';
import { SectionNav } from './item-workspace/SectionNav';
import type { SectionId } from './item-workspace/SectionNav';
import { Footer } from './Footer';

export function ItemWorkspace() {
  const {
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
    addToComparison,
    comparisonItems,
    openComparison,
    missionRewards,
    missionRewardsLoading,
    ensureMissionRewardsLoaded,
    dismantlingData,
    materialSources,
  } = useCraft();
  const { t } = useI18n();
  const { qualityScore, projectedStats } = useCraftSimulator(activeBlueprint, slotAssignments);
  const [qty, setQty] = useState(1);

  // Trigger lazy load of mission rewards
  useEffect(() => {
    if (activeBlueprint) {
      void ensureMissionRewardsLoaded();
    }
  }, [activeBlueprint, ensureMissionRewardsLoaded]);

  // Section refs for scroll-to nav
  const statsRef = useRef<HTMLDivElement>(null);
  const craftRef = useRef<HTMLDivElement>(null);
  const sourcesRef = useRef<HTMLDivElement>(null);
  const acquisitionRef = useRef<HTMLDivElement>(null);
  const dismantleRef = useRef<HTMLDivElement>(null);

  const sectionRefs: Record<SectionId, React.RefObject<HTMLDivElement | null>> = {
    stats: statsRef,
    craft: craftRef,
    sources: sourcesRef,
    acquisition: acquisitionRef,
    dismantle: dismantleRef,
  };

  // Derived data
  const requiredResources = useMemo(
    () => activeBlueprint ? aggregateBlueprintResources(activeBlueprint.slots, slotAssignments) : [],
    [activeBlueprint, slotAssignments],
  );

  const acquisitionEntry = useMemo(
    () => activeBlueprint ? getAcquisitionEntry(missionRewards, activeBlueprint.id) : null,
    [activeBlueprint, missionRewards],
  );

  const visibleSections = useMemo<SectionId[]>(() => {
    const sections: SectionId[] = ['stats', 'craft', 'sources', 'acquisition'];
    if (dismantlingData) sections.push('dismantle');
    return sections;
  }, [dismantlingData]);

  if (!activeBlueprint) return null;

  const isFavorite = favoriteIds.includes(activeBlueprint.id);
  const isLooted = inventoryIds.includes(activeBlueprint.id);
  const canAddToComparison = comparisonItems.length < 4;
  const nextColor = COMPARISON_COLORS[comparisonItems.length];

  return (
    <Box
      component="section"
      aria-label={`${t('Item workspace', 'Espace item')} - ${activeBlueprint.name}`}
      sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
    >
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* Sticky section nav */}
        <SectionNav sections={visibleSections} refs={sectionRefs} />

        <Container maxWidth="md" sx={{ py: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Hero */}
          <HeroSection
            blueprint={activeBlueprint}
            isFavorite={isFavorite}
            isLooted={isLooted}
            onBack={() => setActiveBlueprint(null)}
            onToggleFavorite={() => toggleFavorite(activeBlueprint.id)}
            onToggleInventory={() => toggleInventory(activeBlueprint.id)}
            onAddGoal={() => addGoal(qualityScore, projectedStats, qty)}
            onAddToComparison={() => addToComparison(qualityScore, projectedStats)}
            canAddToComparison={canAddToComparison}
            nextComparisonColor={nextColor}
            comparisonCount={comparisonItems.length}
            onOpenComparison={openComparison}
            qty={qty}
            setQty={setQty}
          />

          {/* Stats */}
          <StatsSection
            blueprint={activeBlueprint}
            projectedStats={projectedStats}
            qualityScore={qualityScore}
            sectionRef={statsRef}
          />

          <Divider />

          {/* Craft Simulator */}
          <CraftSection
            blueprint={activeBlueprint}
            slotAssignments={slotAssignments}
            assignQuality={assignQuality}
            clearAssignments={clearAssignments}
            qualityScore={qualityScore}
            projectedStats={projectedStats}
            requiredResources={requiredResources}
            sectionRef={craftRef}
          />

          <Divider />

          {/* Material Sources */}
          <MaterialSourcesSection
            resources={requiredResources}
            materialSources={materialSources}
            sectionRef={sourcesRef}
          />

          <Divider />

          {/* Acquisition */}
          <AcquisitionSection
            entry={acquisitionEntry}
            loading={missionRewardsLoading}
            sectionRef={acquisitionRef}
          />

          {/* Dismantle (conditional) */}
          {dismantlingData && (
            <>
              <Divider />
              <DismantleSection
                dismantlingData={dismantlingData}
                sectionRef={dismantleRef}
              />
            </>
          )}
        </Container>

        <Footer />
      </Box>
    </Box>
  );
}
