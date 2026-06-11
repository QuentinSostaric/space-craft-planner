import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PlaylistAddOutlinedIcon from '@mui/icons-material/PlaylistAddOutlined';
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import StarIcon from '@mui/icons-material/Star';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import { useCraft } from '../store/CraftContext';
import { useCraftSimulator } from '../hooks/useCraftSimulator';
import { aggregateBlueprintResources, getAcquisitionEntry } from '../utils/crafting';
import { useI18n } from '../i18n/I18nContext';
import { CraftSection } from './item-workspace/CraftSection';
import { MaterialSourcesSection } from './item-workspace/MaterialSourcesSection';
import { AcquisitionSection } from './item-workspace/AcquisitionSection';
import { DismantleSection } from './item-workspace/DismantleSection';
import { BlueprintOverview } from './item-workspace/BlueprintOverview';
import { RarityBadge } from './ui/RarityBadge';
import { FONT_BODY, FONT_MONO, TEXT_LABEL_SM, TEXT_LABEL} from '../theme';
import { missionPathFromSlug, missionSlugFromContract, navigateToPath } from '../utils/slug';

type WorkspaceTabId = 'fabrication' | 'missions' | 'dismantle';

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
  const [activeTab, setActiveTab] = useState<WorkspaceTabId>('fabrication');
  const { t } = useI18n();
  const theme = useTheme();

  useEffect(() => {
    setQty(1);
    setActiveTab('fabrication');
  }, [activeBlueprint?.id]);

  useEffect(() => {
    if (activeBlueprint && !activeBlueprint.detailsLoaded) {
      void ensureBlueprintDetailLoaded(activeBlueprint.id);
    }
  }, [activeBlueprint, ensureBlueprintDetailLoaded]);

  useEffect(() => {
    if (activeBlueprint) {
      void ensureMissionRewardsLoaded();
      void ensureResourceDataLoaded();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBlueprint?.id, ensureMissionRewardsLoaded, ensureResourceDataLoaded]);

  const requiredResources = useMemo(
    () => detailReady && activeBlueprint ? aggregateBlueprintResources(activeBlueprint.slots, slotAssignments) : [],
    [activeBlueprint, detailReady, slotAssignments],
  );

  const acquisitionEntry = useMemo(
    () => activeBlueprint ? getAcquisitionEntry(missionRewards, activeBlueprint.id) : null,
    [activeBlueprint, missionRewards],
  );

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

  const tabs = [
    { id: 'fabrication' as WorkspaceTabId, label: t('Fabrication', 'Fabrication'), icon: <BuildOutlinedIcon sx={{ fontSize: 16 }} /> },
    { id: 'missions' as WorkspaceTabId, label: t('Missions', 'Missions'), icon: <FlagOutlinedIcon sx={{ fontSize: 16 }} /> },
    { id: 'dismantle' as WorkspaceTabId, label: t('Dismantling', 'Démantèlement'), icon: <DeleteOutlineIcon sx={{ fontSize: 16 }} /> },
  ];

  return (
    <Box
      component="section"
      aria-label={activeBlueprint.name}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2.5,
        p: { xs: 2, sm: 3, lg: 4 },
        maxWidth: 1600,
        mx: 'auto',
        width: '100%',
        animation: 'if-fade-in 240ms cubic-bezier(0.22,1,0.36,1) both',
      }}
    >
      {/* Breadcrumb */}
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 0.5 }}>
        <Link
          component="button"
          onClick={() => setActiveBlueprint(null)}
          underline="hover"
          sx={{
            color: 'text.disabled',
            fontSize: TEXT_LABEL,
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            p: 0,
          }}
        >
          {t('Blueprints', 'Blueprints')}
        </Link>
        <Typography sx={{ color: 'text.primary', fontSize: TEXT_LABEL, fontWeight: 550 }}>
          {activeBlueprint.name}
        </Typography>
      </Breadcrumbs>

      {/* Hero Panel */}
      <Paper
        variant="outlined"
        elevation={0}
        sx={{
          overflow: 'hidden',
          bgcolor: 'ui.surface',
          borderColor: 'ui.border',
        }}
      >
        {/* Hero body: 2-col grid (200px image | 1fr info) */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '200px 1fr' },
            gap: 2.5,
            p: { xs: 2, sm: 2.5 },
          }}
        >
          {/* Square image box */}
          <Box
            sx={{
              width: { xs: '100%', sm: 200 },
              height: { xs: 'auto', sm: 200 },
              aspectRatio: '1',
              backgroundColor: 'background.default',
              border: '1px solid',
              borderColor: 'ui.border',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'text.disabled',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {activeBlueprint.media?.primaryVisual?.imageUrl ? (
              <Box
                component="img"
                src={activeBlueprint.media.primaryVisual.imageUrl}
                alt={activeBlueprint.name}
                sx={{ width: '100%', height: '100%', objectFit: 'contain', p: 1.5 }}
              />
            ) : (
              <Inventory2OutlinedIcon sx={{ fontSize: 64, opacity: 0.35 }} />
            )}
          </Box>

          {/* Info column */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {/* Badges row */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
              {activeBlueprint.rarity && <RarityBadge rarity={activeBlueprint.rarity} />}
              {activeBlueprint.category && (
                <Chip
                  label={activeBlueprint.category}
                  size="small"
                  variant="outlined"
                  sx={{ borderRadius: 1, fontSize: TEXT_LABEL_SM, height: 22 }}
                />
              )}
              {acquisitionEntry && (
                <Chip
                  label={t('Mission-linked', 'Mission liée')}
                  size="small"
                  variant="outlined"
                  icon={<FlagOutlinedIcon sx={{ fontSize: '0.85rem !important' }} />}
                  sx={{
                    height: 22,
                    borderRadius: 1,
                    fontSize: TEXT_LABEL_SM,
                    color: 'primary.main',
                    borderColor: (th) => alpha(th.palette.primary.main, 0.45),
                    backgroundColor: (th) => alpha(th.palette.primary.main, 0.08),
                    '& .MuiChip-icon': { color: 'primary.main' },
                  }}
                />
              )}
              {activeBlueprint.slots && activeBlueprint.slots.length > 0 && (
                <Chip
                  label={`${activeBlueprint.slots.length} ${t('slots', 'slots')}`}
                  size="small"
                  variant="outlined"
                  sx={{ height: 22, borderRadius: 1, fontSize: TEXT_LABEL_SM }}
                />
              )}
            </Box>

            {/* Title */}
            <Typography
              component="h1"
              sx={{
                fontFamily: FONT_BODY,
                fontWeight: 700,
                fontSize: { xs: '1.5rem', md: '1.875rem' },
                letterSpacing: '-0.022em',
                lineHeight: 1.1,
                color: 'text.primary',
              }}
            >
              {activeBlueprint.name}
            </Typography>

            {/* Mono ID line */}
            <Typography
              sx={{
                fontFamily: FONT_MONO,
                fontSize: TEXT_LABEL_SM,
                color: 'text.disabled',
                letterSpacing: '0.02em',
                mt: -0.5,
              }}
            >
              {activeBlueprint.manufacturer} · ID {activeBlueprint.id.toUpperCase()}
            </Typography>

            {/* Description */}
            {activeBlueprint.identity?.description && (
              <Typography
                sx={{
                  color: 'text.secondary',
                  fontSize: '0.875rem',
                  maxWidth: '60ch',
                  lineHeight: 1.6,
                }}
              >
                {activeBlueprint.identity.description}
              </Typography>
            )}

            {/* Action buttons */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 'auto', pt: 0.5 }}>
              <Button
                variant="contained"
                size="small"
                startIcon={<Inventory2OutlinedIcon sx={{ fontSize: 15 }} />}
                onClick={() => toggleInventory(activeBlueprint.id)}
                sx={{ height: 34 }}
              >
                {isLooted ? t('In inventory', "Dans l'inventaire") : t('Add to inventory', "Ajouter à l'inventaire")}
              </Button>
              <Tooltip title={isFavorite ? t('Remove from favourites', 'Retirer des favoris') : t('Add to favourites', 'Ajouter aux favoris')}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={isFavorite ? <StarIcon sx={{ fontSize: 15, color: 'warning.main' }} /> : <StarOutlineIcon sx={{ fontSize: 15 }} />}
                  onClick={() => toggleFavorite(activeBlueprint.id)}
                  sx={{
                    height: 34,
                    borderColor: isFavorite ? (th) => alpha(th.palette.warning.main, 0.5) : undefined,
                    color: isFavorite ? 'warning.main' : undefined,
                  }}
                >
                  {t('Favourite', 'Favori')}
                </Button>
              </Tooltip>
              <Button
                variant="outlined"
                size="small"
                startIcon={<PlaylistAddOutlinedIcon sx={{ fontSize: 15 }} />}
                onClick={() => addGoal(qualityScore, projectedStats, qty)}
                sx={{ height: 34 }}
              >
                {t('Add to planner', 'Ajouter au planificateur')}
              </Button>
            </Box>
          </Box>
        </Box>

        {/* Tabs row — attached to bottom of hero panel */}
        <Box sx={{ borderTop: `1px solid ${theme.palette.divider}` }}>
          <Tabs
            value={activeTab}
            onChange={(_e, v: WorkspaceTabId) => setActiveTab(v)}
            aria-label={t('Blueprint sections', 'Sections du blueprint')}
            sx={{
              px: { xs: 1.25, sm: 2.5 },
              minHeight: 46,
              '& .MuiTab-root': {
                minHeight: 46,
                mr: 0.5,
                px: { xs: 1, sm: 1.5 },
              },
            }}
          >
            {tabs.map((tab) => (
              <Tab
                key={tab.id}
                id={`ws-tab-${tab.id}`}
                aria-controls={`ws-panel-${tab.id}`}
                value={tab.id}
                icon={tab.icon}
                iconPosition="start"
                label={tab.label}
                sx={{ gap: 0.75 }}
              />
            ))}
          </Tabs>
        </Box>
      </Paper>

      {/* Tab panels */}
      {activeTab === 'fabrication' && (
        <Box role="tabpanel" id="ws-panel-fabrication" aria-labelledby="ws-tab-fabrication">
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
            <Box sx={{ mt: { xs: 1.5, md: 2 } }}>
              <CraftSection
                blueprint={activeBlueprint}
                slotAssignments={slotAssignments}
                assignQuality={assignQuality}
                clearAssignments={clearAssignments}
                qualityScore={qualityScore}
                projectedStats={projectedStats}
              />
            </Box>
          ) : (
            <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <LinearProgress />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {t('Loading blueprint details…', 'Chargement des détails du blueprint…')}
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {activeTab === 'missions' && (
        <Box role="tabpanel" id="ws-panel-missions" aria-labelledby="ws-tab-missions">
          <AcquisitionSection
            entry={acquisitionEntry}
            loading={missionRewardsLoading}
            missionRewards={missionRewards}
            factionContractsByFactionId={factionContractsByFactionId}
            onMissionClick={(contractDebugName, contractorDisplayName) => {
              const slug = missionSlugFromContract(contractDebugName, contractorDisplayName);
              navigateToPath(missionPathFromSlug(slug), { missionSlug: slug, mainView: 'missions' });
              setActiveBlueprint(null);
            }}
            onBlueprintClick={(blueprintId) => {
              const bp = activeDataset.blueprints.find((b) => b.id === blueprintId);
              if (bp) setActiveBlueprint(bp);
            }}
          />
        </Box>
      )}

      {activeTab === 'dismantle' && (
        <Box role="tabpanel" id="ws-panel-dismantle" aria-labelledby="ws-tab-dismantle">
          {detailReady ? (
            <DismantleSection
              blueprint={activeBlueprint}
              allResources={activeDataset.resources}
              resources={requiredResources}
              dismantleTimeSecs={dismantleTimeSecs}
              efficiency={dismantleEfficiency}
            />
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 2 }}>
              <LinearProgress />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {t('Loading blueprint details…', 'Chargement des détails du blueprint…')}
              </Typography>
            </Box>
          )}
          {detailReady && requiredResources.length > 0 && (
            <Box sx={{ mt: { xs: 1.5, md: 2 } }}>
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
                  addPlannerResourceRequirement(resourceName, quantity, quantityUnit === 'count' ? 'count' : 'scu');
                }}
              />
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
