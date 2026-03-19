import { useEffect, useMemo, useState } from 'react';
import MuiBadge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TimerIcon from '@mui/icons-material/Timer';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { useCraftSimulator } from '../hooks/useCraftSimulator';
import { CategoryBadge } from './ui/Badge';
import { Button } from './ui/Button';
import { COMPARISON_COLORS } from '../types';
import type { ItemTab } from '../types';
import {
  aggregateBlueprintResources,
  findMissionContractsForBlueprint,
} from '../utils/crafting';

// Sub-components
import { OverviewTab } from './item-workspace/OverviewTab';
import { CraftTab } from './item-workspace/CraftTab';
import { AcquisitionTab } from './item-workspace/AcquisitionTab';
import { DismantleTab } from './item-workspace/DismantleTab';

const TAB_ORDER: ItemTab[] = ['overview', 'craft', 'acquisition', 'dismantle'];

export function ItemWorkspace() {
  const {
    activeBlueprint,
    setActiveBlueprint,
    activeItemTab,
    setActiveItemTab,
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
  } = useCraft();
  const { t } = useI18n();
  const { qualityScore, projectedStats } = useCraftSimulator(activeBlueprint, slotAssignments);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (activeBlueprint) {
      void ensureMissionRewardsLoaded();
    }
  }, [activeBlueprint, ensureMissionRewardsLoaded]);

  const acquisitionContracts = useMemo(
    () => activeBlueprint ? findMissionContractsForBlueprint(missionRewards, activeBlueprint.id) : [],
    [activeBlueprint, missionRewards],
  );

  const requiredResources = useMemo(
    () => activeBlueprint ? aggregateBlueprintResources(activeBlueprint.slots, slotAssignments) : [],
    [activeBlueprint, slotAssignments],
  );

  // Determine visible tabs
  const visibleTabs = useMemo(() => {
    const tabs: ItemTab[] = ['overview', 'craft'];
    if (missionRewards && acquisitionContracts.length > 0) tabs.push('acquisition');
    if (dismantlingData) tabs.push('dismantle');
    return tabs;
  }, [missionRewards, acquisitionContracts.length, dismantlingData]);

  // Clamp active tab if current tab is not visible
  const effectiveTab = visibleTabs.includes(activeItemTab) ? activeItemTab : 'overview';

  if (!activeBlueprint) {
    return null;
  }

  const craftMinutes = Math.round(activeBlueprint.craftTimeSecs / 60);
  const isLooted = inventoryIds.includes(activeBlueprint.id);
  const isFavorite = favoriteIds.includes(activeBlueprint.id);
  const canAddToComparison = comparisonItems.length < 4;
  const nextColor = COMPARISON_COLORS[comparisonItems.length];

  const tabLabels: Record<ItemTab, string> = {
    overview: t('Overview', 'Apercu'),
    craft: t('Craft', 'Craft'),
    acquisition: t('Acquisition', 'Acquisition'),
    dismantle: t('Dismantle', 'Demontage'),
  };

  return (
    <Box
      component="section"
      aria-label={`${t('Item workspace', 'Espace item')} - ${activeBlueprint.name}`}
      sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      {/* Context bar */}
      <Box
        component="header"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <Button variant="ghost" size="sm" onClick={() => setActiveBlueprint(null)}>
          <ArrowBackIcon sx={{ fontSize: '1rem', mr: 0.5 }} /> {t('Library', 'Bibliothèque')}
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
          <CategoryBadge category={activeBlueprint.category} iconOnly />
          <Typography
            variant="h6"
            sx={{
              fontFamily: "'Khand', sans-serif",
              fontWeight: 700,
              fontSize: '1.1rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {activeBlueprint.name}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {activeBlueprint.manufacturer}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, ml: 1 }}>
            <TimerIcon sx={{ fontSize: '.8rem', color: 'text.disabled' }} />
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              {craftMinutes}m
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton
            onClick={() => toggleInventory(activeBlueprint.id)}
            aria-pressed={isLooted}
            size="small"
            sx={{
              fontSize: '.7rem',
              ...(isLooted && { color: 'primary.main', backgroundColor: 'rgba(139, 92, 246, 0.1)' }),
            }}
          >
            {isLooted ? <CheckCircleIcon sx={{ fontSize: '1.1rem' }} /> : <RadioButtonUncheckedIcon sx={{ fontSize: '1.1rem' }} />}
          </IconButton>
          <IconButton
            onClick={() => toggleFavorite(activeBlueprint.id)}
            aria-pressed={isFavorite}
            size="small"
            sx={{
              fontSize: '.85rem',
              ...(isFavorite && { color: 'warning.main' }),
            }}
          >
            {isFavorite ? <StarIcon sx={{ fontSize: '1.2rem' }} /> : <StarBorderIcon sx={{ fontSize: '1.2rem' }} />}
          </IconButton>
        </Box>
      </Box>

      {/* Tab bar */}
      <Tabs
        value={effectiveTab}
        onChange={(_e, val) => setActiveItemTab(val as ItemTab)}
        aria-label={t('Item sections', 'Sections item')}
        sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0, minHeight: 36 }}
      >
        {TAB_ORDER.filter((tab) => visibleTabs.includes(tab)).map((tab) => (
          <Tab
            key={tab}
            value={tab}
            label={
              tab === 'acquisition' && acquisitionContracts.length > 0 ? (
                <MuiBadge badgeContent={acquisitionContracts.length} color="primary" sx={{ '& .MuiBadge-badge': { fontSize: '.5rem', minWidth: 14, height: 14 } }}>
                  {tabLabels[tab]}
                </MuiBadge>
              ) : tabLabels[tab]
            }
            sx={{ minHeight: 36, py: 0.5 }}
          />
        ))}
      </Tabs>

      {/* Tab content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }} role="tabpanel">
        <Container maxWidth="md" disableGutters>
          {effectiveTab === 'overview' && (
            <OverviewTab
              blueprint={activeBlueprint}
              qualityScore={qualityScore}
              projectedStats={projectedStats}
              requiredResources={requiredResources}
              acquisitionContracts={acquisitionContracts}
              setActiveItemTab={setActiveItemTab}
              qty={qty}
              setQty={setQty}
              onAddGoal={() => addGoal(qualityScore, projectedStats, qty)}
              onAddToComparison={() => addToComparison(qualityScore, projectedStats)}
              canAddToComparison={canAddToComparison}
              nextComparisonColor={nextColor}
              comparisonCount={comparisonItems.length}
              onOpenComparison={openComparison}
            />
          )}

          {effectiveTab === 'craft' && (
            <CraftTab
              blueprint={activeBlueprint}
              slotAssignments={slotAssignments}
              assignQuality={assignQuality}
              clearAssignments={clearAssignments}
              qualityScore={qualityScore}
              projectedStats={projectedStats}
              requiredResources={requiredResources}
            />
          )}

          {effectiveTab === 'acquisition' && (
            <AcquisitionTab
              contracts={acquisitionContracts}
              loading={missionRewardsLoading}
            />
          )}

          {effectiveTab === 'dismantle' && (
            <DismantleTab
              dismantlingData={dismantlingData}
            />
          )}
        </Container>
      </Box>
    </Box>
  );
}
