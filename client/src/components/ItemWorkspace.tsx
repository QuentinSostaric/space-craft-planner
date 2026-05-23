import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
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
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import StarIcon from '@mui/icons-material/Star';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import KeyboardBackspaceIcon from '@mui/icons-material/KeyboardBackspace';
import { useCraft } from '../store/CraftContext';
import { useCraftSimulator } from '../hooks/useCraftSimulator';
import { aggregateBlueprintResources, getAcquisitionEntry } from '../utils/crafting';
import { useI18n } from '../i18n/I18nContext';
import { CraftSection } from './item-workspace/CraftSection';
import { MaterialSourcesSection } from './item-workspace/MaterialSourcesSection';
import { AcquisitionSection } from './item-workspace/AcquisitionSection';
import { DismantleSection } from './item-workspace/DismantleSection';
import { BlueprintOverview } from './item-workspace/BlueprintOverview';
import { FONT_BODY, FONT_MONO } from '../theme';
import { missionPathFromSlug, missionSlugFromContract, navigateToPath } from '../utils/slug';

type WorkspaceTabId = 'fabrication' | 'missions' | 'dismantle';

function RarityChip({ rarity }: { rarity: string | null | undefined }) {
  const rarityMap: Record<string, { label: string; color: string }> = {
    legendary: { label: 'Légendaire', color: '#F4B740' },
    rare: { label: 'Rare', color: '#818CF8' },
    common: { label: 'Commune', color: '#94A3B8' },
  };
  const info = rarity ? rarityMap[rarity] : null;
  if (!info) return null;
  const glyph = rarity === 'legendary' ? '◆◆◆' : rarity === 'rare' ? '◆◆' : '◆';
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1,
        py: 0.25,
        borderRadius: 1,
        border: `1px solid ${alpha(info.color, 0.45)}`,
        backgroundColor: alpha(info.color, 0.1),
        color: info.color,
        fontSize: '0.75rem',
        fontWeight: 600,
        fontFamily: FONT_BODY,
      }}
    >
      <Box component="span" sx={{ fontFamily: FONT_MONO, fontSize: '0.625rem' }} aria-hidden="true">{glyph}</Box>
      {info.label}
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
        gap: { xs: 1.25, md: 1.5 },
        p: { xs: 1, sm: 1.5, lg: 2 },
        maxWidth: 1600,
        mx: 'auto',
        animation: 'if-fade-in 240ms cubic-bezier(0.22,1,0.36,1) both',
      }}
    >
      {/* Breadcrumb */}
      <Breadcrumbs
        aria-label="breadcrumb"
        sx={{ fontSize: '0.75rem', color: 'text.disabled' }}
      >
        <Box
          component="a"
          href="#"
          onClick={(e) => { e.preventDefault(); setActiveBlueprint(null); }}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            color: 'text.disabled',
            textDecoration: 'none',
            fontSize: '0.75rem',
            px: 0.5,
            py: 0.25,
            borderRadius: 0.5,
            transition: 'color 120ms ease, background-color 120ms ease',
            '&:hover': { color: 'text.primary', backgroundColor: 'ui.surface2' },
          }}
        >
          <KeyboardBackspaceIcon sx={{ fontSize: 14 }} />
          {t('Blueprints', 'Blueprints')}
        </Box>
        <Typography sx={{ fontSize: '0.75rem', color: 'text.primary', fontWeight: 550 }}>
          {activeBlueprint.name}
        </Typography>
      </Breadcrumbs>

      {/* Hero Panel */}
      <Paper
        elevation={0}
        sx={{
          overflow: 'hidden',
          backgroundColor: 'ui.surface',
          borderColor: 'ui.border',
        }}
      >
        {/* Hero body */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '180px 1fr', md: '200px 1fr' },
            gap: { xs: 2, sm: 2.5 },
            p: { xs: 2, sm: 2.5 },
          }}
        >
          {/* Thumbnail */}
          <Box
            sx={{
              width: '100%',
              aspectRatio: '1',
              borderRadius: 1.5,
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
                sx={{ width: '100%', height: '100%', objectFit: 'contain', p: 1 }}
              />
            ) : (
              <Inventory2OutlinedIcon sx={{ fontSize: 64, opacity: 0.35 }} />
            )}
          </Box>

          {/* Info */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {/* Badges row */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
              <RarityChip rarity={activeBlueprint.rarity} />
              {activeBlueprint.category && (
                <Chip
                  label={activeBlueprint.category}
                  size="small"
                  variant="outlined"
                  sx={{ borderRadius: 1, fontSize: '0.6875rem', height: 22 }}
                />
              )}
            </Box>

            {/* Name */}
            <Box>
              <Typography
                component="h1"
                sx={{
                  fontFamily: FONT_BODY,
                  fontWeight: 700,
                  fontSize: { xs: '1.5rem', md: '1.75rem' },
                  letterSpacing: '-0.022em',
                  lineHeight: 1.1,
                  color: 'text.primary',
                  mb: 0.5,
                }}
              >
                {activeBlueprint.name}
              </Typography>
              <Typography
                sx={{
                  fontFamily: FONT_MONO,
                  fontSize: '0.6875rem',
                  color: 'text.disabled',
                  letterSpacing: '0.02em',
                }}
              >
                {activeBlueprint.manufacturer} · ID {activeBlueprint.id.toUpperCase()}
              </Typography>
            </Box>

            {/* Description */}
            <Typography
              sx={{
                color: 'text.secondary',
                fontSize: '0.875rem',
                maxWidth: '60ch',
                lineHeight: 1.6,
              }}
            >
              {t(
                'Crafting blueprint. The final quality depends on the materials placed in each slot. A quality of 500 is considered standard: below that, the item receives a penalty; above, a bonus.',
                "Plan de fabrication. La qualité finale dépend des matériaux placés dans chaque slot. Une qualité de 500 est considérée standard : en dessous, malus ; au-dessus, bonus.",
              )}
            </Typography>

            {/* Action buttons */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
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
                  sx={{ height: 34, borderColor: isFavorite ? (th) => alpha(th.palette.warning.main, 0.5) : undefined, color: isFavorite ? 'warning.main' : undefined }}
                >
                  {t('Favourite', 'Favori')}
                </Button>
              </Tooltip>
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
              px: { xs: 1, sm: 2 },
              minHeight: 46,
              '& .MuiTab-root': {
                minHeight: 46,
                mr: 1,
                px: { xs: 1, sm: 0.5 },
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
          {/* Quick overview stats visible above the fold */}
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
            <Box sx={{ mt: { xs: 1.25, md: 1.5 } }}>
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
            <Box sx={{ mt: { xs: 1.25, md: 1.5 } }}>
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
