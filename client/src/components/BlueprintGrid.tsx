import { alpha, useTheme } from '@mui/material/styles';
import { memo, startTransition, useMemo, useState, type ReactNode } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import CheckIcon from '@mui/icons-material/Check';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardMedia from '@mui/material/CardMedia';
import CircularProgress from '@mui/material/CircularProgress';
import ToggleButton from '@mui/material/ToggleButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import GroupsIcon from '@mui/icons-material/Groups';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import StarIcon from '@mui/icons-material/Star';
import { useCraft } from '../store/CraftContext';
import { loc, useI18n } from '../i18n/I18nContext';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { CategoryBadge } from './ui/Badge';
import { GameIcon } from './ui/GameIcon';
import { RarityBadge } from './ui/RarityBadge';
import { StatBar } from './ui/StatBar';
import { MaterialChips } from './ui/MaterialChips';
import { CARD_STATS, computeStatMaxima, isResourceSlot } from '../utils/crafting';
import { BlueprintExplorer } from './BlueprintExplorer';
import { ShipComponentCard } from './ShipComponentCard';
import {
  buildShipComponentCardModel,
  isDisplayableShipComponent,
} from '../utils/shipComponents';
import { ENABLE_SHIP_COMPONENT_BLUEPRINTS } from '../utils/featureFlags';
import { STAT_UNITS } from '../types';
import type {
  AcquisitionGraphEntry,
  Blueprint,
  ItemCategory,
  NumericItemStatKey,
  Resource,
  ShipComponentEntry,
  StandingBucket,
} from '../types';
import type { GameIconName } from './ui/GameIcon';

const EMPTY_ID_SET: ReadonlySet<string> = new Set<string>();

const CAT_ICON: Record<ItemCategory, GameIconName> = {
  'fps-weapon':    'weapons',
  'fps-magazine':  'ammos',
  'fps-armor':     'armor',
  'fps-helmet':    'armor',
  'fps-undersuit': 'utilities',
  'fps-backpack':  'utilities',
};

/** Resolves the thumbnail URL and mode from the blueprint media fallback chain. */
function resolveThumb(bp: Blueprint): { url: string | null; mode: 'item' | 'logo' } {
  const m = bp.media;
  if (m?.primaryVisual?.imageUrl) return { url: m.primaryVisual.imageUrl, mode: 'item' };
  if (m?.manufacturerLogo?.imageUrl) return { url: m.manufacturerLogo.imageUrl, mode: 'logo' };
  return { url: null, mode: 'item' };
}

function getCraftTimeBucket(craftTimeSecs: number): string {
  if (craftTimeSecs <= 60) return '<=60';
  if (craftTimeSecs <= 120) return '61-120';
  if (craftTimeSecs <= 180) return '121-180';
  return '180+';
}

function getStandingBucket(value: number | null | undefined): StandingBucket {
  if (value == null || value <= 0) return 'none';
  if (value <= 999) return '1-999';
  if (value <= 4999) return '1000-4999';
  if (value <= 14999) return '5000-14999';
  return '15000+';
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
  organizationShareAction,
  extraQuickActions,
  statMaxima,
  resources,
  priority = false,
  onSelect,
  onToggleFavorite,
  onToggleInventory,
}: {
  blueprint: Blueprint;
  activeBlueprintId: string | null;
  isFavorite: boolean;
  isInInventory: boolean;
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
  statMaxima: Map<ItemCategory, Map<NumericItemStatKey, number>>;
  resources: Resource[];
  priority?: boolean;
  onSelect: (bp: Blueprint | null) => void;
  onToggleFavorite: (blueprintId: string) => void;
  onToggleInventory: (blueprintId: string) => void;
}) {
  const isActive = activeBlueprintId === blueprint.id;
  const { t, lang } = useI18n();
  const theme = useTheme();
  const { url: thumbUrl, mode: thumbMode } = resolveThumb(blueprint);
  const [imgError, setImgError] = useState(false);
  const showImage = thumbUrl && !imgError;

  const cardStats = CARD_STATS[blueprint.category] ?? [];
  const categoryMax = statMaxima.get(blueprint.category);
  const quickActionBaseSx = {
    width: '100%',
    minWidth: 0,
    minHeight: { xs: 38, sm: 40 },
    gap: { xs: 0.5, sm: 0.625 },
    px: { xs: 0.9, sm: 1.05 },
    py: { xs: 0.65, sm: 0.8 },
    justifyContent: 'flex-start',
    textTransform: 'none',
    fontSize: { xs: '0.72rem', sm: '0.78rem' },
    fontWeight: 600,
    lineHeight: 1.15,
    borderColor: 'divider',
    backgroundColor: alpha(theme.palette.background.default, 0.22),
    color: 'text.secondary',
    '& .MuiSvgIcon-root': {
      fontSize: { xs: '0.95rem', sm: '1rem' },
      flexShrink: 0,
    },
    '& .MuiAvatar-root': {
      width: { xs: 16, sm: 18 },
      height: { xs: 16, sm: 18 },
      flexShrink: 0,
    },
    '& .quick-action-label': {
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    '&:hover': {
      borderColor: 'primary.main',
      backgroundColor: alpha(theme.palette.primary.main, 0.08),
      color: 'text.primary',
    },
  } as const;

  return (
    <Card
      role="listitem"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderColor: isActive ? 'primary.main' : (isInInventory ? 'primary.light' : 'divider'),
        backgroundColor: isActive ? alpha(theme.palette.primary.main, 0.05) : 'background.paper',
        transition: 'all 200ms ease',
        '&:hover': {
          borderColor: 'primary.main',
          transform: 'translateY(-4px)',
          boxShadow: theme.palette.mode === 'dark' 
            ? `0 12px 32px ${alpha('#000', 0.5)}`
            : `0 12px 32px ${alpha(theme.palette.primary.main, 0.12)}`,
        },
      }}
    >
      <CardActionArea
        onClick={() => onSelect(isActive ? null : blueprint)}
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
            height: { xs: 132, sm: 152, md: 160 },
            backgroundColor: theme.palette.mode === 'dark' ? alpha('#000', 0.2) : alpha(theme.palette.primary.main, 0.02),
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
          <Box sx={{ width: '100%', height: '100%', p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
          {/* Name & Manufacturer */}
          <Box>
            <Typography
              sx={{
                fontFamily: "'Khand', sans-serif",
                fontWeight: 700,
                fontSize: '1.1rem',
                lineHeight: 1.1,
                color: 'text.primary',
                textTransform: 'uppercase',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                minHeight: '2.2em',
              }}
            >
              {blueprint.name}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: 'secondary.main',
                fontSize: '0.75rem',
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
              {blueprint.manufacturer} // {blueprint.category.replace('fps-', '')}
            </Typography>
          </Box>

          {/* Stat bars */}
          {cardStats.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {cardStats.map(({ key, label }) => {
                const val = blueprint.baseStats[key];
                if (typeof val !== 'number') return null;

                const max = categoryMax?.get(key) ?? Math.abs(val);
                const unit = STAT_UNITS[key] ?? '';
                const displayVal = unit === '%'
                  ? `${Math.round(val * 100)}%`
                  : `${Math.round(val)}${unit ? ` ${unit}` : ''}`;

                let fill = 0;
                if (key === 'temperatureMin') {
                  fill = ((val + 100) / 150) * 100;
                } else if (key === 'temperatureMax') {
                  fill = (val / 150) * 100;
                } else {
                  fill = max > 0 ? (Math.abs(val) / max) * 100 : 0;
                }

                return (
                  <StatBar
                    key={key}
                    label={loc(label, lang)}
                    value={displayVal}
                    fill={fill}
                  />
                );
              })}
            </Box>
          )}

          {/* Materials */}
          <Box sx={{ mt: 'auto', pt: 1 }}>
            {blueprint.slots.length > 0 && (
              <MaterialChips slots={blueprint.slots} resources={resources} />
            )}
          </Box>
        </Box>
      </CardActionArea>

      <Box
        sx={{
          px: { xs: 1.15, sm: 1.4 },
          pb: { xs: 1.15, sm: 1.4 },
          pt: 0.75,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 132px), 1fr))',
          gap: 0.75,
          borderTop: `1px solid ${theme.palette.divider}`,
          backgroundColor: alpha(theme.palette.background.default, 0.08),
        }}
      >
        <Tooltip
          title={
            isFavorite
              ? t('Remove from favorites', 'Retirer des favoris', 'Aus Favoriten entfernen')
              : t('Add to favorites', 'Ajouter aux favoris', 'Zu Favoriten hinzufugen')
          }
        >
          <ToggleButton
            value="favorite"
            size="small"
            selected={isFavorite}
            aria-pressed={isFavorite}
            aria-label={
              isFavorite
                ? t('Remove from favorites', 'Retirer des favoris', 'Aus Favoriten entfernen')
                : t('Add to favorites', 'Ajouter aux favoris', 'Zu Favoriten hinzufugen')
            }
            onClick={() => onToggleFavorite(blueprint.id)}
            sx={{
              ...quickActionBaseSx,
              ...(isFavorite && {
                color: 'warning.main',
                borderColor: 'warning.main',
                backgroundColor: alpha(theme.palette.warning.main, 0.12),
              }),
            }}
          >
            {isFavorite ? <StarIcon /> : <StarBorderIcon />}
            <Box component="span" className="quick-action-label">
              {t('Favorite', 'Favori', 'Favorit')}
            </Box>
          </ToggleButton>
        </Tooltip>
        <Tooltip
          title={
            isInInventory
              ? t('Remove from inventory', 'Retirer de l\'inventaire', 'Aus Inventar entfernen')
              : t('Add to inventory', 'Ajouter a l\'inventaire', 'Zum Inventar hinzufugen')
          }
        >
          <ToggleButton
            value="inventory"
            size="small"
            selected={isInInventory}
            aria-pressed={isInInventory}
            aria-label={
              isInInventory
                ? t('Remove from inventory', 'Retirer de l\'inventaire', 'Aus Inventar entfernen')
                : t('Add to inventory', 'Ajouter a l\'inventaire', 'Zum Inventar hinzufugen')
            }
            onClick={() => onToggleInventory(blueprint.id)}
            sx={{
              ...quickActionBaseSx,
              ...(isInInventory && {
                color: 'primary.main',
                borderColor: 'primary.main',
                backgroundColor: alpha(theme.palette.primary.main, 0.12),
              }),
            }}
          >
            {isInInventory ? <CheckIcon /> : <Inventory2OutlinedIcon />}
            <Box component="span" className="quick-action-label">
              {t('Inventory', 'Inventaire', 'Inventar')}
            </Box>
          </ToggleButton>
        </Tooltip>
        {organizationShareAction && (
          <Tooltip title={organizationShareAction.tooltip}>
            <span style={{ display: 'flex', width: '100%', minWidth: 0 }}>
              <ToggleButton
                value="organization-share"
                size="small"
                selected={organizationShareAction.selected}
                aria-pressed={organizationShareAction.selected}
                aria-label={organizationShareAction.ariaLabel}
                disabled={organizationShareAction.disabled || organizationShareAction.busy}
                onClick={() => organizationShareAction.onToggle(blueprint.id)}
                sx={{
                  ...quickActionBaseSx,
                  ...(organizationShareAction.selected && {
                    color: 'primary.main',
                    borderColor: 'primary.main',
                    backgroundColor: alpha(theme.palette.primary.main, 0.12),
                  }),
                }}
              >
                {organizationShareAction.busy ? (
                  <CircularProgress size={16} color="inherit" />
                ) : organizationShareAction.selected ? (
                  <GroupsIcon />
                ) : (
                  <GroupsOutlinedIcon />
                )}
                <Box component="span" className="quick-action-label">
                  {organizationShareAction.label}
                </Box>
              </ToggleButton>
            </span>
          </Tooltip>
        )}
        {(extraQuickActions ?? []).map((action) => (
          <Tooltip key={action.key} title={action.tooltip}>
            <span style={{ display: 'flex', width: '100%', minWidth: 0 }}>
              <ToggleButton
                value={action.key}
                size="small"
                selected={Boolean(action.selected)}
                aria-pressed={Boolean(action.selected)}
                aria-label={action.ariaLabel}
                disabled={action.disabled || action.busy}
                onClick={() => action.onClick(blueprint.id)}
                sx={{
                  ...quickActionBaseSx,
                  ...(action.selected && {
                    color: 'primary.main',
                    borderColor: 'primary.main',
                    backgroundColor: alpha(theme.palette.primary.main, 0.12),
                  }),
                }}
              >
                {action.busy ? (
                  <CircularProgress size={16} color="inherit" />
                ) : action.avatarSrc ? (
                  <Avatar
                    src={action.avatarSrc}
                    alt={action.avatarAlt ?? action.label}
                    sx={{ width: { xs: 16, sm: 18 }, height: { xs: 16, sm: 18 } }}
                  >
                    {(action.avatarAlt ?? action.label).charAt(0).toUpperCase()}
                  </Avatar>
                ) : (
                  action.icon
                )}
                <Box component="span" className="quick-action-label">
                  {action.label}
                </Box>
              </ToggleButton>
            </span>
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
  prev.organizationShareAction?.selected === next.organizationShareAction?.selected &&
  prev.organizationShareAction?.busy === next.organizationShareAction?.busy &&
  prev.organizationShareAction?.disabled === next.organizationShareAction?.disabled &&
  prev.organizationShareAction?.label === next.organizationShareAction?.label &&
  prev.organizationShareAction?.ariaLabel === next.organizationShareAction?.ariaLabel &&
  prev.organizationShareAction?.tooltip === next.organizationShareAction?.tooltip &&
  prev.extraQuickActions === next.extraQuickActions &&
  prev.statMaxima === next.statMaxima &&
  prev.resources === next.resources &&
  prev.priority === next.priority &&
  prev.onToggleFavorite === next.onToggleFavorite &&
  prev.onToggleInventory === next.onToggleInventory
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

  const resources = activeDataset.resources;
  const allShipComponents = activeDataset.shipComponents?.entries ?? [];
  const statMaxima = useMemo(() => computeStatMaxima(allBlueprints), [allBlueprints]);
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
      list = list.filter((bp) => String(bp.slots.length) === slotCountFilter);
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
          return right.slots.length - left.slots.length || compareText(left.name, right.name);
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

  const { scrollContainerRef, sentinelRef, visibleCount, initialCount } =
    useInfiniteScroll(filteredBlueprints, { getColumns: blueprintGetColumns });

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

  return (
    <Box
      ref={scrollContainerRef}
      sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'auto' }}
    >
      <Box sx={{ p: { xs: 1.25, sm: 1.5, md: 2 }, borderBottom: 1, borderColor: 'divider', backgroundColor: 'background.paper' }}>
        <Typography
          sx={{
            fontFamily: "'Khand', sans-serif",
            fontWeight: 700,
            fontSize: { xs: '1.9rem', md: '2.2rem' },
            textTransform: 'uppercase',
            lineHeight: 1,
          }}
        >
          {t('Blueprints', 'Blueprints')}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75 }}>
          {t(
            'Browse craftable items, simulate quality builds and plan your material runs.',
            'Parcourez les objets craftables, simulez des builds qualite et planifiez vos collectes de materiaux.',
          )}
        </Typography>
      </Box>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', backgroundColor: 'background.paper' }}>
        <BlueprintExplorer />
      </Box>

      {/* Scroll container — IntersectionObserver root. Requires the flex:1/minHeight:0 chain
          from App.tsx's <Box component="main"> to remain intact so this Box — not the parent —
          is the actual scrolling ancestor. If the layout breaks, the sentinel never fires. */}
      <Box sx={{ p: { xs: 1.25, sm: 2, md: 3 } }}>
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }} aria-live="polite">
            {filteredBlueprints.length} {t('blueprints', 'blueprints')}
            {!shipComponentFiltersBlocked ? ` • ${filteredShipComponents.length} ${t('ship components', 'composants de vaisseau')}` : ''}
          </Typography>
        </Box>
        {isCompletelyEmpty ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <Typography sx={{ color: 'text.secondary', mb: 1 }} role="status">
              {emptyMessage}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {hasVisibleBlueprints && (
              <Box>
                <Typography
                  sx={{
                    mb: 1.5,
                    color: 'text.secondary',
                    fontFamily: "'Khand', sans-serif",
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  {t('Blueprints', 'Blueprints')}
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
                  aria-label={t('Blueprint list', 'Liste des blueprints')}
                >
                  {filteredBlueprints.slice(0, visibleCount).map((blueprint, index) => (
                    <BlueprintCard
                      key={blueprint.id}
                      blueprint={blueprint}
                      activeBlueprintId={activeBlueprint?.id ?? null}
                      isFavorite={favoriteIdSet.has(blueprint.id)}
                      isInInventory={inventoryIdSet.has(blueprint.id)}
                      statMaxima={statMaxima}
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
                    fontFamily: "'Khand', sans-serif",
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
                {/* TODO: Ship components do not have infinite scroll yet. When ENABLE_SHIP_COMPONENT_BLUEPRINTS
                    is enabled, apply the same visibleCount/sentinel pattern used for blueprints above. */}
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
      </Box>
    </Box>
  );
}
