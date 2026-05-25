import { alpha, useTheme } from '@mui/material/styles';
import { memo, startTransition, useMemo, useState, type ReactNode } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CheckIcon from '@mui/icons-material/Check';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardMedia from '@mui/material/CardMedia';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import GroupsIcon from '@mui/icons-material/Groups';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import LayersIcon from '@mui/icons-material/Layers';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import StarIcon from '@mui/icons-material/Star';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';

import { useCraft, DEFAULT_INVENTORY_IDS } from '../store/CraftContext';
import { loc, useI18n } from '../i18n/I18nContext';
import { getMainContentScrollRoot, useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { CategoryBadge } from './ui/Badge';
import { GameIcon } from './ui/GameIcon';
import { RarityBadge } from './ui/RarityBadge';
import { MaterialChips } from './ui/MaterialChips';
import { getStandingBucket, isResourceSlot, ls } from '../utils/crafting';
import { BlueprintExplorer } from './BlueprintExplorer';
import { ShipComponentCard } from './ShipComponentCard';
import { useAuth } from '../auth/AuthContext';
import { isTauriRuntime } from '../services/apiBaseUrl';
import { navigateToPath } from '../utils/slug';
import { SyncBlueprintsButton } from './ScLogSyncDialog';
import Button from '@mui/material/Button';
import SyncIcon from '@mui/icons-material/Sync';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import {
  buildShipComponentCardModel,
  isDisplayableShipComponent,
} from '../utils/shipComponents';
import { ENABLE_SHIP_COMPONENT_BLUEPRINTS } from '../utils/featureFlags';
import type {
  AcquisitionGraphEntry,
  Blueprint,
  ItemCategory,
  Resource,
  ShipComponentEntry,
} from '../types';
import type { GameIconName } from './ui/GameIcon';
import { FONT_HEADING } from '../theme';
import { toSlug } from '../utils/slug';
import { shouldHandleInternalLinkClick } from '../utils/spaLinks';

const EMPTY_ID_SET: ReadonlySet<string> = new Set<string>();

const CAT_ICON: Record<ItemCategory, GameIconName> = {
  'fps-weapon':    'weapons',
  'fps-magazine':  'ammos',
  'fps-armor':     'armor',
  'fps-helmet':    'armor',
  'fps-undersuit': 'utilities',
  'fps-backpack':  'utilities',
  powerplant:      'power-plants',
  cooler:          'coolers',
  'shield-generator': 'shields',
  'quantum-drive': 'engines',
  radar:           'radars',
  'fuel-nozzle':   'utilities',
  'ship-weapon':   'weapons',
  'mining-laser':  'mining-lasers',
  'salvage-head':  'salvage',
  'tractor-beam':  'tractor-beams',
};

const CAT_LABEL: Record<ItemCategory, ReturnType<typeof ls>> = {
  'fps-weapon': ls('Weapon', 'Arme', 'Waffe'),
  'fps-magazine': ls('Magazine', 'Chargeur', 'Magazin'),
  'fps-armor': ls('Armor', 'Armure', 'Rüstung'),
  'fps-helmet': ls('Helmet', 'Casque', 'Helm'),
  'fps-undersuit': ls('Undersuit', 'Combi', 'Unteranzug'),
  'fps-backpack': ls('Backpack', 'Sac', 'Rucksack'),
  powerplant: ls('Power', 'Centrale', 'Kraftwerk'),
  cooler: ls('Cooler', 'Refroid.', 'Kühler'),
  'shield-generator': ls('Shield', 'Bouclier', 'Schild'),
  'quantum-drive': ls('Quantum', 'Quantique', 'Quantum'),
  radar: ls('Radar', 'Radar', 'Radar'),
  'fuel-nozzle': ls('Fuel nozzle', 'Bec carburant', 'Betankungsduse'),
  'ship-weapon': ls('Ship gun', 'Arme v.', 'Schiffswaffe'),
  'mining-laser': ls('Mining', 'Minage', 'Bergbau'),
  'salvage-head': ls('Salvage', 'Salvage', 'Bergung'),
  'tractor-beam': ls('Tractor', 'Tracteur', 'Traktor'),
};

/** Resolves the thumbnail URL and mode from the blueprint media fallback chain. */
function resolveThumb(bp: Blueprint): { url: string | null; mode: 'item' | 'logo' } {
  const m = bp.media;
  if (m?.primaryVisual?.imageUrl) return { url: m.primaryVisual.imageUrl, mode: 'item' };
  if (m?.manufacturerLogo?.imageUrl) return { url: m.manufacturerLogo.imageUrl, mode: 'logo' };
  return { url: null, mode: 'item' };
}

function formatCraftTime(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function getCraftTimeBucket(craftTimeSecs: number): string {
  if (craftTimeSecs <= 60) return '<=60';
  if (craftTimeSecs <= 120) return '61-120';
  if (craftTimeSecs <= 180) return '121-180';
  return '180+';
}

function getRarityRank(rarity?: Blueprint['rarity']): number {
  if (rarity === 'legendary') return 3;
  if (rarity === 'rare') return 2;
  if (rarity === 'common') return 1;
  return 0;
}

/** Column mapping for the blueprint grid (5-column max). */
function blueprintGetColumns(containerWidth: number): number {
  if (containerWidth >= 1536) return 5; // xl
  if (containerWidth >= 1200) return 4; // lg
  if (containerWidth >= 900)  return 3; // md
  if (containerWidth >= 600)  return 2; // sm
  return 1;
}

function getBlueprintSearchHaystack(blueprint: Blueprint): string {
  const factText = (blueprint.identity?.descriptionFacts ?? [])
    .flatMap((fact) => [fact.label, fact.value])
    .filter(Boolean)
    .join(' ');

  return [
    blueprint.name,
    blueprint.manufacturer,
    blueprint.category,
    blueprint.identity?.shortName,
    blueprint.identity?.descriptionBody,
    factText,
    blueprint.baseStats.weaponType,
    blueprint.baseStats.ammoType,
    blueprint.baseStats.ammoFlavor,
    blueprint.baseStats.armorType,
    blueprint.baseStats.armorSlot,
    ...(blueprint.requiredResourceIds ?? []),
    ...blueprint.slots.map((slot) => slot.requirementName || slot.requiredResource),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getShipComponentSearchHaystack(component: ShipComponentEntry): string {
  const factText = (component.descriptionFacts ?? [])
    .flatMap((fact) => [fact.label, fact.value])
    .filter(Boolean)
    .join(' ');
  const model = buildShipComponentCardModel(component);
  const metricText = [...model.heroMetrics, ...model.chipMetrics, ...model.detailMetrics]
    .map((metric) => metric.value)
    .join(' ');

  return [
    component.name,
    component.manufacturer,
    component.family,
    component.category,
    component.displayType,
    component.shortName,
    component.descriptionBody,
    factText,
    model.profileKey,
    metricText,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function compareText(left: string | null | undefined, right: string | null | undefined): number {
  return String(left ?? '').localeCompare(String(right ?? ''), undefined, { numeric: true, sensitivity: 'base' });
}

function compareNumberDesc(left: number | null | undefined, right: number | null | undefined): number {
  const leftValue = left ?? Number.NEGATIVE_INFINITY;
  const rightValue = right ?? Number.NEGATIVE_INFINITY;
  if (leftValue === rightValue) {
    return 0;
  }
  return rightValue - leftValue;
}

function QuickActionBtn({
  active,
  label,
  icon,
  onClick,
  color,
}: {
  active?: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  color?: string;
}) {
  const theme = useTheme();
  const resolvedColor = color ?? theme.palette.primary.main;
  return (
    <Box
      component="button"
      onClick={(e: { stopPropagation: () => void }) => { e.stopPropagation(); onClick(); }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.75,
        border: '1px solid',
        borderColor: active ? alpha(resolvedColor, 0.6) : 'divider',
        bgcolor: active ? alpha(resolvedColor, 0.13) : 'transparent',
        color: active ? resolvedColor : 'text.secondary',
        borderRadius: 1,
        px: 1.25,
        py: 0.75,
        fontSize: '0.72rem',
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
        flex: 1,
        minHeight: 32,
        transition: 'all 120ms ease',
        '&:hover': {
          bgcolor: active ? alpha(resolvedColor, 0.18) : alpha(theme.palette.text.primary, 0.04),
          color: active ? resolvedColor : 'text.primary',
          borderColor: active ? alpha(resolvedColor, 0.8) : 'text.secondary',
        },
        '& .MuiSvgIcon-root': { fontSize: '14px !important' },
      }}
    >
      {icon}
      {label}
    </Box>
  );
}

export interface BlueprintCardQuickAction {
  key: string;
  label: string;
  ariaLabel: string;
  tooltip: string;
  onClick: (blueprintId: string) => void;
  selected?: boolean;
  busy?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  avatarSrc?: string | null;
  avatarAlt?: string;
}

export const BlueprintCard = memo(function BlueprintCard({
  blueprint,
  activeBlueprintId,
  isFavorite,
  isInInventory,
  isObtainable,
  organizationShareAction,
  extraQuickActions,
  resources,
  priority = false,
  onSelect,
  onToggleFavorite,
  onToggleInventory,
  onAddToPlanner,
}: {
  blueprint: Blueprint;
  activeBlueprintId: string | null;
  isFavorite: boolean;
  isInInventory: boolean;
  isObtainable?: boolean;
  organizationShareAction?: {
    selected: boolean;
    busy?: boolean;
    disabled?: boolean;
    label: string;
    ariaLabel: string;
    tooltip: string;
    onToggle: (blueprintId: string) => void;
  } | null;
  extraQuickActions?: BlueprintCardQuickAction[];
  resources: Resource[];
  priority?: boolean;
  onSelect: (bp: Blueprint | null) => void;
  onToggleFavorite: (blueprintId: string) => void;
  onToggleInventory?: (blueprintId: string) => void;
  onAddToPlanner?: (blueprintId: string) => void;
}) {
  const isActive = activeBlueprintId === blueprint.id;
  const { t, lang } = useI18n();
  const theme = useTheme();
  const { url: thumbUrl, mode: thumbMode } = resolveThumb(blueprint);
  const [imgError, setImgError] = useState(false);
  const showImage = thumbUrl && !imgError;
  const blueprintHref = `/item/${toSlug(blueprint.name)}`;
  const cardHref = isActive ? '/' : blueprintHref;

  return (
    <Card
      role="listitem"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderColor: isActive ? 'primary.main' : (isInInventory ? alpha(theme.palette.primary.main, 0.42) : 'ui.border'),
        backgroundColor: 'ui.surface',
        transition: 'border-color 180ms ease, transform 180ms ease, box-shadow 180ms ease',
        overflow: 'hidden',
        borderRadius: 2,
        '&:hover': {
          borderColor: 'brand.accentBorder',
          transform: 'translateY(-2px)',
          boxShadow: `0 6px 18px ${alpha('#000', theme.palette.mode === 'dark' ? 0.35 : 0.08)}`,
        },
      }}
    >
      <CardActionArea
        component="a"
        href={cardHref}
        onClick={(event) => {
          if (!shouldHandleInternalLinkClick(event)) return;
          event.preventDefault();
          onSelect(isActive ? null : blueprint);
        }}
        aria-pressed={isActive}
        aria-label={t(
          `${blueprint.rarity ? blueprint.rarity + ' ' : ''}Blueprint ${blueprint.name} by ${blueprint.manufacturer}`,
          `Blueprint ${blueprint.rarity ? blueprint.rarity + ' ' : ''}${blueprint.name} par ${blueprint.manufacturer}`,
          `${blueprint.rarity ? blueprint.rarity + ' ' : ''}Bauplan ${blueprint.name} von ${blueprint.manufacturer}`,
        )}
        sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
      >
        {/* Top Section: Image with overlays */}
        <Box
          sx={{
            position: 'relative',
            height: { xs: 124, sm: 132, md: 142 },
            backgroundColor: theme.palette.mode === 'dark' ? alpha('#020817', 0.46) : alpha(theme.palette.primary.main, 0.02),
            backgroundImage:
              theme.palette.mode === 'dark'
                ? `linear-gradient(${alpha(theme.palette.primary.main, 0.075)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.075)} 1px, transparent 1px)`
                : 'none',
            backgroundSize: '28px 28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          {/* Rarity / Category Badge Overlay */}
          <Box sx={{ position: 'absolute', top: 12, left: 12, zIndex: 1 }}>
            {blueprint.rarity ? (
              <RarityBadge rarity={blueprint.rarity} />
            ) : (
              <CategoryBadge category={blueprint.category} />
            )}
          </Box>

          {/* Large Image / Icon */}
          <Box sx={{ width: '100%', height: '100%', p: { xs: 1.5, md: 1.75 }, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {showImage ? (
              <CardMedia
                component="img"
                image={thumbUrl}
                alt=""
                loading={priority ? 'eager' : 'lazy'}
                fetchPriority={priority ? 'high' : 'auto'}
                decoding={priority ? 'sync' : 'async'}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                sx={{
                  maxHeight: '100%',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  filter: thumbMode === 'item' ? (theme.palette.mode === 'dark' ? 'drop-shadow(0 8px 16px rgba(0,0,0,0.6))' : 'drop-shadow(0 8px 16px rgba(0,0,0,0.1))') : 'none',
                  p: thumbMode === 'logo' ? 2 : 0,
                  transition: 'transform 300ms ease',
                  '.MuiCardActionArea-root:hover &': {
                    transform: 'scale(1.05)',
                  }
                }}
              />
            ) : (
              <GameIcon name={CAT_ICON[blueprint.category]} size={56} shimmer={false} />
            )}
          </Box>
        </Box>

        {/* Bottom Section: Content */}
        <Box sx={{ p: { xs: 1.5, md: 1.65 }, display: 'flex', flexDirection: 'column', gap: 1.35, flex: 1 }}>
          {/* Name & Manufacturer */}
          <Box>
            <Typography
              sx={{
                fontFamily: FONT_HEADING,
                fontWeight: 700,
                fontSize: { xs: '1rem', md: '1.05rem' },
                lineHeight: 1.1,
                color: 'text.primary',
                textTransform: 'uppercase',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                minHeight: '2.1em',
              }}
            >
              {blueprint.name}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: 'secondary.main',
                fontSize: '0.68rem',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontWeight: 600,
                mt: 0.5,
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {blueprint.manufacturer} // {loc(CAT_LABEL[blueprint.category], lang)}
            </Typography>
          </Box>

          {/* Footer badges */}
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center', mt: 0.5 }}>
            <Chip
              icon={<AccessTimeIcon />}
              label={formatCraftTime(blueprint.craftTimeSecs)}
              size="small"
              variant="outlined"
              sx={{ height: 20, '& .MuiChip-label': { fontSize: '0.68rem', px: 0.75 }, '& .MuiChip-icon': { fontSize: '0.75rem', ml: '5px' }, color: 'text.secondary', borderColor: 'ui.border' }}
            />
            <Chip
              icon={<LayersIcon />}
              label={`${blueprint.slotCount ?? blueprint.slots.length} slots`}
              size="small"
              variant="outlined"
              sx={{ height: 20, '& .MuiChip-label': { fontSize: '0.68rem', px: 0.75 }, '& .MuiChip-icon': { fontSize: '0.75rem', ml: '5px' }, color: 'text.secondary', borderColor: 'ui.border' }}
            />
            {isObtainable && (
              <Chip
                icon={<TravelExploreIcon />}
                label="Mission"
                size="small"
                color="secondary"
                variant="outlined"
                sx={{ height: 20, '& .MuiChip-label': { fontSize: '0.68rem', px: 0.75 }, '& .MuiChip-icon': { fontSize: '0.75rem', ml: '5px' } }}
              />
            )}
          </Box>

          {/* Materials */}
          <Box sx={{ mt: 'auto', pt: 0.75 }}>
            <MaterialChips
              slots={blueprint.slots}
              resources={resources}
              resourceIds={blueprint.requiredResourceIds}
            />
          </Box>
        </Box>
      </CardActionArea>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${3 + (organizationShareAction ? 1 : 0) + (extraQuickActions?.length ?? 0)}, minmax(0, 1fr))`,
          gap: 0.75,
          px: 1.25,
          py: 1.125,
          borderTop: `1px solid ${theme.palette.divider}`,
          backgroundColor: alpha(theme.palette.background.default, 0.08),
        }}
      >
        <QuickActionBtn
          active={isFavorite}
          onClick={() => onToggleFavorite(blueprint.id)}
          label={t('Favori', 'Favori', 'Favorit')}
          icon={isFavorite ? <StarIcon /> : <StarBorderIcon />}
          color={isFavorite ? theme.palette.warning.main : undefined}
        />
        {onToggleInventory && (
          <QuickActionBtn
            active={isInInventory}
            onClick={() => onToggleInventory(blueprint.id)}
            label={t('Inventaire', 'Inventaire', 'Inventar')}
            icon={isInInventory ? <CheckIcon /> : <Inventory2OutlinedIcon />}
          />
        )}
        <QuickActionBtn
          onClick={() => onAddToPlanner?.(blueprint.id)}
          label={t('Planner', 'Planner', 'Planner')}
          icon={<PlaylistAddIcon />}
        />
        {organizationShareAction && (
          <Tooltip title={organizationShareAction.tooltip}>
            <Box sx={{ display: 'flex', flex: 1 }}>
              <QuickActionBtn
                active={organizationShareAction.selected}
                onClick={() => organizationShareAction.onToggle(blueprint.id)}
                label={organizationShareAction.label}
                icon={
                  organizationShareAction.busy ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : organizationShareAction.selected ? (
                    <GroupsIcon />
                  ) : (
                    <GroupsOutlinedIcon />
                  )
                }
              />
            </Box>
          </Tooltip>
        )}
        {(extraQuickActions ?? []).map((action) => (
          <Tooltip key={action.key} title={action.tooltip}>
            <Box sx={{ display: 'flex', flex: 1 }}>
              <QuickActionBtn
                active={Boolean(action.selected)}
                onClick={() => action.onClick(blueprint.id)}
                label={action.label}
                icon={
                  action.busy ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : action.avatarSrc ? (
                    <Avatar
                      src={action.avatarSrc}
                      alt={action.avatarAlt ?? action.label}
                      sx={{ width: 14, height: 14 }}
                    >
                      {(action.avatarAlt ?? action.label).charAt(0).toUpperCase()}
                    </Avatar>
                  ) : (
                    action.icon
                  )
                }
              />
            </Box>
          </Tooltip>
        ))}
      </Box>
    </Card>
  );
}, (prev, next) =>
  prev.blueprint === next.blueprint &&
  prev.activeBlueprintId === next.activeBlueprintId &&
  prev.isFavorite === next.isFavorite &&
  prev.isInInventory === next.isInInventory &&
  prev.isObtainable === next.isObtainable &&
  prev.organizationShareAction?.selected === next.organizationShareAction?.selected &&
  prev.organizationShareAction?.busy === next.organizationShareAction?.busy &&
  prev.organizationShareAction?.disabled === next.organizationShareAction?.disabled &&
  prev.organizationShareAction?.label === next.organizationShareAction?.label &&
  prev.organizationShareAction?.ariaLabel === next.organizationShareAction?.ariaLabel &&
  prev.organizationShareAction?.tooltip === next.organizationShareAction?.tooltip &&
  prev.extraQuickActions === next.extraQuickActions &&
  prev.resources === next.resources &&
  prev.priority === next.priority &&
  prev.onToggleFavorite === next.onToggleFavorite &&
  (prev.onToggleInventory === next.onToggleInventory || (!prev.onToggleInventory && !next.onToggleInventory)) &&
  prev.onAddToPlanner === next.onAddToPlanner
);

export function BlueprintGrid() {
  const {
    activeBlueprint,
    setActiveBlueprint,
    categoryFilter,
    searchQuery,
    librarySegment,
    manufacturerFilter,
    shipComponentFamilyFilter,
    shipComponentProfileFilter,
    shipComponentSizeFilter,
    shipComponentGradeFilter,
    legalityFilter,
    locationFilter,
    materialFilter,
    rarityFilter,
    slotCountFilter,
    craftTimeFilter,
    weaponTypeFilter,
    ammoTypeFilter,
    ammoFlavorFilter,
    armorTypeFilter,
    armorSlotFilter,
    acquisitionEmployerFilter,
    acquisitionScaleFilter,
    acquisitionStandingFilter,
    blueprintSort,
    favoriteIds,
    inventoryIds,
    toggleFavorite,
    toggleInventory,
    blueprints: allBlueprints,
    missionRewards,
    missionRewardsLoading,
    activeDataset,
  } = useCraft();
  const { t } = useI18n();
  const { user } = useAuth();
  const isDesktop = isTauriRuntime();

  const defaultInventoryIdSet = useMemo(() => new Set<string>(DEFAULT_INVENTORY_IDS), []);
  const hasOnlyDefaultInventory = useMemo(
    () => inventoryIds.length === 0 || inventoryIds.every((id) => defaultInventoryIdSet.has(id)),
    [inventoryIds, defaultInventoryIdSet],
  );

  const resources = activeDataset.resources;
  const allShipComponents = activeDataset.shipComponents?.entries ?? [];
  const favoriteIdSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const inventoryIdSet = useMemo(() => new Set(inventoryIds), [inventoryIds]);

  // Stabilized sets for the filteredBlueprints memo: only change when the
  // corresponding library segment is active, preventing a full grid reset
  // (and scroll position loss) when toggling a favorite/inventory item while
  // viewing a different segment.
  const filterFavoriteIdSet = useMemo(
    () => (librarySegment === 'favorites' ? favoriteIdSet : EMPTY_ID_SET),
    [librarySegment, favoriteIdSet],
  );
  const filterInventoryIdSet = useMemo(
    () => (librarySegment === 'inventory' ? inventoryIdSet : EMPTY_ID_SET),
    [librarySegment, inventoryIdSet],
  );
  const acquisitionByBlueprintId = useMemo(() => {
    const map = new Map<string, AcquisitionGraphEntry>();
    for (const entry of missionRewards?.blueprintAcquisitionGraph ?? []) {
      map.set(entry.blueprint.id, entry);
    }
    return map;
  }, [missionRewards]);

  const obtainableIds = useMemo(() => {
    const ids = new Set<string>();
    for (const entry of missionRewards?.blueprintAcquisitionGraph ?? []) {
      ids.add(entry.blueprint.id);
    }
    return ids;
  }, [missionRewards]);

  // Build legality-based blueprint id set from acquisition graph (slim chunk)
  const legalityBlueprintIds = useMemo(() => {
    if (legalityFilter === 'all' || !missionRewards) return null;
    const ids = new Set<string>();
    for (const entry of missionRewards.blueprintAcquisitionGraph) {
      const hasMatch = entry.factions.some(
        (f) => f.faction?.factionType?.toLowerCase() === legalityFilter,
      );
      if (hasMatch) ids.add(entry.blueprint.id);
    }
    return ids;
  }, [legalityFilter, missionRewards]);

  // Build location-based blueprint id set from acquisition graph (slim chunk)
  const locationBlueprintIds = useMemo(() => {
    if (!locationFilter || !missionRewards) return null;
    const ids = new Set<string>();
    for (const entry of missionRewards.blueprintAcquisitionGraph) {
      if (entry.localities.includes(locationFilter)) ids.add(entry.blueprint.id);
    }
    return ids;
  }, [locationFilter, missionRewards]);

  const manufacturerCanonicalMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of activeDataset.manufacturers ?? []) {
      if (!entry?.manufacturer) continue;
      map.set(entry.manufacturer, entry.canonicalManufacturer ?? entry.manufacturer);
    }
    return map;
  }, [activeDataset.manufacturers]);

  const filteredBlueprints = useMemo(() => {
    let list = allBlueprints;

    // Library Segment
    if (librarySegment === 'inventory') {
      list = list.filter((bp) => filterInventoryIdSet.has(bp.id));
    } else if (librarySegment === 'favorites') {
      list = list.filter((bp) => filterFavoriteIdSet.has(bp.id));
    } else if (librarySegment === 'obtainable') {
      list = list.filter((bp) => obtainableIds.has(bp.id));
    }

    // Category
    if (categoryFilter !== 'all') {
      list = list.filter((bp) => bp.category === categoryFilter);
    }

    // Manufacturer
    if (manufacturerFilter) {
      list = list.filter((bp) => bp.manufacturer === manufacturerFilter);
    }

    if (materialFilter) {
      list = list.filter((bp) =>
        (bp.requiredResourceIds?.includes(materialFilter) ?? false) ||
        bp.slots.some((slot) => isResourceSlot(slot) && slot.requiredResource === materialFilter),
      );
    }

    // Legality
    if (legalityBlueprintIds) {
      list = list.filter((bp) => legalityBlueprintIds.has(bp.id));
    }

    // Location
    if (locationBlueprintIds) {
      list = list.filter((bp) => locationBlueprintIds.has(bp.id));
    }

    if (rarityFilter !== 'all') {
      list = list.filter((bp) =>
        rarityFilter === 'unknown' ? !bp.rarity : bp.rarity === rarityFilter,
      );
    }

    if (slotCountFilter !== 'all') {
      list = list.filter((bp) => String(bp.slotCount ?? bp.slots.length) === slotCountFilter);
    }

    if (craftTimeFilter !== 'all') {
      list = list.filter((bp) => getCraftTimeBucket(bp.craftTimeSecs) === craftTimeFilter);
    }

    if (weaponTypeFilter) {
      list = list.filter((bp) => bp.baseStats.weaponType === weaponTypeFilter);
    }

    if (ammoTypeFilter) {
      list = list.filter((bp) => bp.baseStats.ammoType === ammoTypeFilter);
    }

    if (ammoFlavorFilter) {
      list = list.filter((bp) => bp.baseStats.ammoFlavor === ammoFlavorFilter);
    }

    if (armorTypeFilter) {
      list = list.filter((bp) => bp.baseStats.armorType === armorTypeFilter);
    }

    if (armorSlotFilter) {
      list = list.filter((bp) => bp.baseStats.armorSlot === armorSlotFilter);
    }

    if (acquisitionEmployerFilter || acquisitionScaleFilter || acquisitionStandingFilter !== 'all') {
      list = list.filter((bp) => {
        const entry = acquisitionByBlueprintId.get(bp.id);
        if (!entry) return false;
        if (
          acquisitionEmployerFilter &&
          !entry.factions.some((faction) => faction.contractorDisplayName === acquisitionEmployerFilter)
        ) {
          return false;
        }
        if (acquisitionScaleFilter && !entry.derivedScales.includes(acquisitionScaleFilter)) {
          return false;
        }
        if (acquisitionStandingFilter !== 'all' && getStandingBucket(entry.maxReputation) !== acquisitionStandingFilter) {
          return false;
        }
        return true;
      });
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((bp) => getBlueprintSearchHaystack(bp).includes(q));
    }

    return list.sort((left, right) => {
      const leftAcquisition = acquisitionByBlueprintId.get(left.id);
      const rightAcquisition = acquisitionByBlueprintId.get(right.id);

      switch (blueprintSort) {
        case 'manufacturer-asc':
          return compareText(left.manufacturer, right.manufacturer) || compareText(left.name, right.name);
        case 'craft-time-asc':
          return left.craftTimeSecs - right.craftTimeSecs || compareText(left.name, right.name);
        case 'craft-time-desc':
          return right.craftTimeSecs - left.craftTimeSecs || compareText(left.name, right.name);
        case 'slot-count-desc':
          return (right.slotCount ?? right.slots.length) - (left.slotCount ?? left.slots.length) || compareText(left.name, right.name);
        case 'rarity-desc':
          return getRarityRank(right.rarity) - getRarityRank(left.rarity) || compareText(left.name, right.name);
        case 'acquisition-desc':
          return compareNumberDesc(leftAcquisition?.dropScore, rightAcquisition?.dropScore) || compareText(left.name, right.name);
        case 'damage-desc':
          return compareNumberDesc(left.baseStats.damage, right.baseStats.damage) || compareText(left.name, right.name);
        case 'range-desc':
          return compareNumberDesc(left.baseStats.effectiveRange, right.baseStats.effectiveRange) || compareText(left.name, right.name);
        case 'rate-of-fire-desc':
          return compareNumberDesc(left.baseStats.rateOfFire, right.baseStats.rateOfFire) || compareText(left.name, right.name);
        case 'magazine-desc':
          return compareNumberDesc(left.baseStats.magazineSize, right.baseStats.magazineSize) || compareText(left.name, right.name);
        case 'kinetic-desc':
          return compareNumberDesc(left.baseStats.damageResistanceKinetic, right.baseStats.damageResistanceKinetic) || compareText(left.name, right.name);
        case 'energy-desc':
          return compareNumberDesc(left.baseStats.damageResistanceEnergy, right.baseStats.damageResistanceEnergy) || compareText(left.name, right.name);
        case 'temp-max-desc':
          return compareNumberDesc(left.baseStats.temperatureMax, right.baseStats.temperatureMax) || compareText(left.name, right.name);
        case 'name-asc':
        default:
          return compareText(left.name, right.name);
      }
    });
  }, [
    acquisitionByBlueprintId,
    acquisitionEmployerFilter,
    acquisitionScaleFilter,
    acquisitionStandingFilter,
    allBlueprints,
    ammoFlavorFilter,
    ammoTypeFilter,
    armorSlotFilter,
    armorTypeFilter,
    blueprintSort,
    categoryFilter,
    craftTimeFilter,
    filterFavoriteIdSet,
    filterInventoryIdSet,
    legalityBlueprintIds,
    librarySegment,
    locationBlueprintIds,
    manufacturerFilter,
    materialFilter,
    obtainableIds,
    rarityFilter,
    searchQuery,
    slotCountFilter,
    weaponTypeFilter,
  ]);

  const { sentinelRef, visibleCount, initialCount } =
    useInfiniteScroll(filteredBlueprints, {
      getColumns: blueprintGetColumns,
      getScrollRoot: getMainContentScrollRoot,
    });

  const shipComponentFiltersBlocked =
    !ENABLE_SHIP_COMPONENT_BLUEPRINTS;

  const filteredShipComponents = useMemo(() => {
    if (shipComponentFiltersBlocked) {
      return [];
    }

    let list = allShipComponents.filter(isDisplayableShipComponent);

    if (manufacturerFilter) {
      const selectedCanonical =
        manufacturerCanonicalMap.get(manufacturerFilter) ?? manufacturerFilter;
      list = list.filter((component) => {
        const componentManufacturer = component.manufacturer;
        if (!componentManufacturer) {
          return false;
        }

        const componentCanonical =
          manufacturerCanonicalMap.get(componentManufacturer) ?? componentManufacturer;
        return (
          componentManufacturer === manufacturerFilter ||
          componentCanonical === selectedCanonical
        );
      });
    }

    if (shipComponentFamilyFilter) {
      list = list.filter((component) => component.family === shipComponentFamilyFilter);
    }

    if (shipComponentProfileFilter) {
      list = list.filter((component) => {
        const model = buildShipComponentCardModel(component);
        return model.profileKey === shipComponentProfileFilter;
      });
    }

    if (shipComponentSizeFilter) {
      list = list.filter(
        (component) =>
          String(component.identity?.attachDef?.size ?? '') === shipComponentSizeFilter,
      );
    }

    if (shipComponentGradeFilter) {
      list = list.filter(
        (component) =>
          String(component.identity?.attachDef?.grade ?? '') === shipComponentGradeFilter,
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((component) => getShipComponentSearchHaystack(component).includes(q));
    }

    return list.sort(
      (left, right) =>
        compareText(left.manufacturer, right.manufacturer) ||
        compareText(left.name, right.name) ||
        compareText(left.family, right.family),
    );
  }, [
    allShipComponents,
    manufacturerCanonicalMap,
    manufacturerFilter,
    searchQuery,
    shipComponentFamilyFilter,
    shipComponentFiltersBlocked,
    shipComponentGradeFilter,
    shipComponentProfileFilter,
    shipComponentSizeFilter,
  ]);

  const emptyMessage = librarySegment === 'inventory'
    ? (inventoryIds.length === 0
      ? t('No blueprints in inventory.', 'Aucun blueprint dans l\'inventaire.')
      : t('No blueprints match your filters.', 'Aucun blueprint ne correspond aux filtres.'))
    : librarySegment === 'favorites'
      ? t('No favorites yet. Star a blueprint to save it here.', 'Aucun favori pour le moment.')
      : librarySegment === 'obtainable'
        ? (missionRewardsLoading
          ? t('Loading obtainable blueprints...', 'Chargement des blueprints obtenables...')
          : t('No obtainable blueprints found.', 'Aucun blueprint obtenable trouvé.'))
        : t('No blueprints found.', 'Aucun blueprint trouvé.');

  const hasVisibleBlueprints = filteredBlueprints.length > 0;
  const hasVisibleShipComponents = filteredShipComponents.length > 0;
  const isCompletelyEmpty = !hasVisibleBlueprints && !hasVisibleShipComponents;

  const GUTTER = { xs: 2, sm: 3, lg: 4 } as const;
  const MAX_W = 1600;

  return (
    <Box sx={{ flex: '1 0 auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          maxWidth: MAX_W,
          mx: 'auto',
          width: '100%',
          animation: 'if-fade-in 280ms ease both',
        }}
      >
        {/* ── View header ── */}
        <Box sx={{ px: GUTTER, pt: { xs: 2, sm: 2.5, lg: 3 }, pb: 0 }}>
          <Typography
            sx={{
              fontFamily: FONT_HEADING,
              fontWeight: 700,
              fontSize: { xs: '1.45rem', md: '1.7rem' },
              textTransform: 'uppercase',
              lineHeight: 1,
            }}
          >
            {t('Blueprints', 'Blueprints')}
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: 'text.secondary', mt: 0.5, fontWeight: 500, fontSize: { xs: '0.82rem', md: '0.875rem' } }}
          >
            {t(
              'Browse craftable items, simulate quality builds and plan your material runs.',
              'Parcourez les objets craftables, simulez des builds qualite et planifiez vos collectes de materiaux.',
            )}
          </Typography>
        </Box>

        {/* ── Explorer (toolbar + filters) — same horizontal gutter ── */}
        <Box sx={{ px: GUTTER }}>
          <BlueprintExplorer />
        </Box>

        {/* ── Result count ── */}
        <Box sx={{ px: GUTTER, mb: 1.25, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }} aria-live="polite">
            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{filteredBlueprints.length}</strong>{' '}
            {t('blueprints', 'blueprints')}
            {!shipComponentFiltersBlocked ? ` • ${filteredShipComponents.length} ${t('ship components', 'composants de vaisseau')}` : ''}
          </Typography>
        </Box>

        {/* ── Grid area — IntersectionObserver root ── */}
        <Box sx={{ px: GUTTER, pb: 4 }}>
          {isCompletelyEmpty ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <Typography sx={{ color: 'text.secondary', mb: 1 }} role="status">
                {emptyMessage}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {hasVisibleBlueprints && (
                <Box>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                      gap: { xs: 1.25, sm: 1.5, lg: 1.75 },
                    }}
                    role="list"
                    aria-label={t('Blueprint list', 'Liste des blueprints')}
                  >
                    {filteredBlueprints.slice(0, visibleCount).map((blueprint, index) => (
                      <BlueprintCard
                        key={blueprint.id}
                        blueprint={blueprint}
                        activeBlueprintId={activeBlueprint?.id ?? null}
                        isFavorite={favoriteIdSet.has(blueprint.id)}
                        isInInventory={inventoryIdSet.has(blueprint.id)}
                        isObtainable={obtainableIds.has(blueprint.id)}
                        resources={resources}
                        priority={index < initialCount}
                        onSelect={(bp) => startTransition(() => setActiveBlueprint(bp))}
                        onToggleFavorite={toggleFavorite}
                        onToggleInventory={toggleInventory}
                      />
                    ))}
                  </Box>
                  {/* Sentinel: triggers next batch when it enters the scroll container */}
                  {visibleCount < filteredBlueprints.length && (
                    <div ref={sentinelRef} style={{ height: 1 }} aria-hidden="true" />
                  )}
                </Box>
              )}

              {hasVisibleShipComponents && (
                <Box>
                  <Typography
                    sx={{
                      mb: 0.75,
                      color: 'text.secondary',
                      fontFamily: FONT_HEADING,
                      fontSize: '1.15rem',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {t('Ship Components', 'Composants de vaisseau')}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1.5, color: 'text.secondary' }}>
                    {t(
                      'Prepared card profiles for future blueprint support. These entries are currently informational.',
                      'Cartes preparees pour les futurs blueprints. Ces entrees sont actuellement informatives.',
                    )}
                  </Typography>
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
                    role="list"
                    aria-label={t('Ship component list', 'Liste des composants de vaisseau')}
                  >
                    {filteredShipComponents.map((component, index) => (
                      <ShipComponentCard
                        key={component.id}
                        component={component}
                        priority={index < 6}
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}

          {/* ── Inventory sync CTA — shown when inventory has only default blueprints ── */}
          {librarySegment === 'inventory' && hasOnlyDefaultInventory && (
            <Box
              sx={{
                mt: 3,
                py: { xs: 4, md: 5 },
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1.5,
                border: '1px dashed',
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <Typography variant="subtitle1" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                {t('Sync your game inventory', 'Synchronisez votre inventaire de jeu')}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.disabled', maxWidth: 440 }}>
                {isDesktop && Boolean(user)
                  ? t(
                      'Scan your Star Citizen game logs to automatically detect all blueprints you own.',
                      'Analysez vos logs Star Citizen pour détecter automatiquement tous vos blueprints.',
                    )
                  : isDesktop && !user
                    ? t(
                        'Connect your Discord account on the Account page to enable game log sync.',
                        'Connectez votre compte Discord sur la page Compte pour activer la synchronisation.',
                      )
                    : t(
                        'Install the desktop app to sync blueprints directly from your Star Citizen logs.',
                        'Installez l\'application de bureau pour synchroniser depuis vos logs Star Citizen.',
                      )}
              </Typography>
              {isDesktop && Boolean(user) ? (
                <SyncBlueprintsButton variant="contained" size="small" />
              ) : isDesktop && !user ? (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<SyncIcon sx={{ fontSize: 14 }} />}
                  onClick={() => navigateToPath('/account', { mainView: 'account' })}
                  sx={{ fontWeight: 700 }}
                >
                  {t('Go to Account', 'Aller sur le Compte')}
                </Button>
              ) : (
                <Button
                  component="a"
                  href="/api/desktop/latest-installer"
                  variant="contained"
                  size="small"
                  startIcon={<DownloadOutlinedIcon sx={{ fontSize: 14 }} />}
                  sx={{ fontWeight: 700 }}
                >
                  {t('Download desktop app', 'Télécharger l\'app bureau')}
                </Button>
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
