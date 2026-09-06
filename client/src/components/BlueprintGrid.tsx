import { Box, Typography, alpha, useTheme } from '../ui/system';
import { Avatar, Card, CardActionArea, CardMedia } from './ui/primitives';
import { AppButton } from './ui/controls';
import { AppTooltip } from './ui/overlays';
import { AppProgressSpinner } from './ui/feedback';
import { CheckIcon, AccessTimeIcon, GroupsIcon, GroupsOutlinedIcon, Inventory2OutlinedIcon, PlaylistAddIcon, StarBorderIcon, StarIcon, TravelExploreIcon, SyncIcon, DownloadOutlinedIcon } from '../ui/icons';
import { memo, startTransition, useCallback, useDeferredValue, useMemo, useState, type ReactNode } from 'react';

import { useCraft, DEFAULT_INVENTORY_IDS } from '../store/CraftContext';
import { useFilters } from '../store/FilterContext';
import { loc, useI18n } from '../i18n/I18nContext';
import { getMainContentScrollRoot, useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { GameIcon } from './ui/GameIcon';
import { RarityBadge } from './ui/RarityBadge';
import { MaterialChips } from './ui/MaterialChips';
import { getObtainableBlueprintIds, getStandingBucket, isResourceSlot, ls } from '../utils/crafting';
import { BlueprintExplorer } from './BlueprintExplorer';
import { ShipComponentCard } from './ShipComponentCard';
import { SurfaceState } from './ui/feedback';
import { PageHeader, PageLayout } from './ui/page';
import { useAuth } from '../auth/AuthContext';
import { isTauriRuntime } from '../services/apiBaseUrl';
import { navigateToPath } from '../utils/slug';
import { SyncBlueprintsButton } from './ScLogSyncDialog';
import {
  buildShipComponentCardModel,
  isDisplayableShipComponent,
} from '../utils/shipComponents';
import { useFlag } from '../hooks/useFeatureFlag';
import type {
  AcquisitionGraphEntry,
  Blueprint,
  ItemCategory,
  Resource,
  ShipComponentEntry,
} from '../types';
import type { GameIconName } from './ui/GameIcon';
import { FONT_HEADING, FONT_MONO, TEXT_LABEL } from '../theme';
import { toSlug } from '../utils/slug';
import { shouldHandleInternalLinkClick } from '../utils/spaLinks';
import { trackEvent } from '../analytics/posthog';
import './fabricator/fabricator-focus.css';

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
  if (m?.image?.imageUrl) return { url: m.image.imageUrl, mode: 'item' };
  if (m?.primaryVisual?.imageUrl) return { url: m.primaryVisual.imageUrl, mode: m.primaryVisual.imageUrl === m.manufacturerLogo?.imageUrl ? 'logo' : 'item' };
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

// Search haystacks are derived from immutable dataset entities, so cache them by
// object identity. Without this, every (deferred) keystroke rebuilds the haystack
// string — with several array allocations — for the entire catalog.
const blueprintHaystackCache = new WeakMap<Blueprint, string>();
const shipComponentHaystackCache = new WeakMap<ShipComponentEntry, string>();

function getBlueprintSearchHaystack(blueprint: Blueprint): string {
  const cached = blueprintHaystackCache.get(blueprint);
  if (cached !== undefined) {
    return cached;
  }

  const factText = (blueprint.identity?.descriptionFacts ?? [])
    .flatMap((fact) => [fact.label, fact.value])
    .filter(Boolean)
    .join(' ');

  const haystack = [
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

  blueprintHaystackCache.set(blueprint, haystack);
  return haystack;
}

function getShipComponentSearchHaystack(component: ShipComponentEntry): string {
  const cached = shipComponentHaystackCache.get(component);
  if (cached !== undefined) {
    return cached;
  }

  const factText = (component.descriptionFacts ?? [])
    .flatMap((fact) => [fact.label, fact.value])
    .filter(Boolean)
    .join(' ');
  const model = buildShipComponentCardModel(component);
  const metricText = [...model.heroMetrics, ...model.chipMetrics, ...model.detailMetrics]
    .map((metric) => metric.value)
    .join(' ');

  const haystack = [
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

  shipComponentHaystackCache.set(component, haystack);
  return haystack;
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
  disabled = false,
  ariaLabel,
}: {
  active?: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  color?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const theme = useTheme();
  const resolvedColor = color ?? theme.palette.primary.main;
  return (
    <Box
      component="button"
      type="button"
      disabled={disabled}
      aria-label={ariaLabel ?? label}
      aria-pressed={active}
      onClick={(e: { stopPropagation: () => void }) => { e.stopPropagation(); onClick(); }}
      sx={{
        '& svg': { fontSize: 14 },
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
        fontSize: TEXT_LABEL,
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
        '&:disabled': { cursor: 'not-allowed', opacity: 0.55 },
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
  isActive,
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
  isActive: boolean;
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
  const { t, lang } = useI18n();
  const theme = useTheme();
  const { url: thumbUrl, mode: thumbMode } = resolveThumb(blueprint);
  const [imgError, setImgError] = useState(false);
  const showImage = thumbUrl && !imgError;
  const blueprintHref = `/item/${toSlug(blueprint.name)}`;
  const cardHref = blueprintHref;

  return (
    <Card
      className="blueprint-card"
      role="listitem"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        // CSS-level virtualization: the browser skips layout/paint for cards
        // scrolled off-screen. contain-intrinsic-size reserves an estimated box
        // so the scrollbar stays stable ('auto' reuses the last measured size).
        contentVisibility: 'auto',
        containIntrinsicSize: 'auto 340px',
        borderColor: isActive ? 'primary.main' : (isInInventory ? alpha(theme.palette.primary.main, 0.42) : 'ui.border'),
        backgroundColor: 'ui.surface',
        transition: 'border-color 180ms ease, transform 180ms ease, box-shadow 180ms ease',
        overflow: 'hidden',
        borderRadius: '5px',
        '&:hover': {
          borderColor: 'brand.accentBorder',
          transform: 'none',
          boxShadow: `0 6px 18px ${alpha('#000', theme.palette.mode === 'dark' ? 0.35 : 0.08)}`,
        },
      }}
    >
      <CardActionArea
        className="blueprint-card-link"
        component="a"
        href={cardHref}
        onClick={(event) => {
          if (!shouldHandleInternalLinkClick(event)) return;
          event.preventDefault();
          onSelect(blueprint);
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
          className="blueprint-card-preview"
          sx={{
            position: 'relative',
            height: 'var(--workspace-preview-height)',
            backgroundColor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.default, 0.46) : alpha(theme.palette.primary.main, 0.02),
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
          {/* Top-left slot is reserved for rarity only, so its position stays learnable.
              The category is already shown in the meta line under the name. */}
          {blueprint.rarity && (
            <Box sx={{ position: 'absolute', top: 12, left: 12, zIndex: 1 }}>
              <RarityBadge rarity={blueprint.rarity} />
            </Box>
          )}

          {(isFavorite || isInInventory) && (
            <span className="blueprint-card-state">
              {isFavorite && <span aria-label={t('Favorite', 'Favori', 'Favorit')} title={t('Favorite', 'Favori', 'Favorit')}><StarIcon sx={{ fontSize: 13, color: 'warning.main' }} /></span>}
              {isInInventory && <span aria-label={t('In inventory', 'En inventaire', 'Im Inventar')} title={t('In inventory', 'En inventaire', 'Im Inventar')}><CheckIcon sx={{ fontSize: 13 }} /></span>}
            </span>
          )}

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
                  '.blueprint-card-link:hover &': {
                    transform: 'scale(1.05)',
                  },
                }}
              />
            ) : (
              <GameIcon name={CAT_ICON[blueprint.category]} size={56} shimmer={false} />
            )}
          </Box>
        </Box>

        {/* Bottom Section: Content */}
        <Box className="blueprint-card-details" sx={{ p: { xs: 1.5, md: 1.65 }, display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
          {/* Name & Manufacturer */}
          <Box>
            <Typography
              sx={{
                fontFamily: FONT_HEADING,
                fontWeight: 700,
                fontSize: { xs: '1rem', md: '1.05rem' },
                lineHeight: 1.2,
                color: 'text.primary',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                minHeight: '1.2em',
              }}
            >
              {blueprint.name}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: 'secondary.main',
                fontSize: TEXT_LABEL,
                fontWeight: 500,
                letterSpacing: 0,
                mt: 0.5,
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {blueprint.manufacturer} · {loc(CAT_LABEL[blueprint.category], lang)}
            </Typography>
          </Box>

          {/* Meta line — plain mono text, no chips: only badges that carry state earn a border */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mt: 0.5, color: 'text.secondary', minWidth: 0 }}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
              <AccessTimeIcon sx={{ fontSize: 13, flexShrink: 0 }} />
              <Typography
                component="span"
                sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL, lineHeight: 1, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
              >
                {formatCraftTime(blueprint.craftTimeSecs)} · {blueprint.slotCount ?? blueprint.slots.length} {t('slots', 'slots')}
              </Typography>
            </Box>
            {isObtainable && (
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: 'secondary.main' }}>
                <TravelExploreIcon sx={{ fontSize: 13, flexShrink: 0 }} />
                <Typography component="span" sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL, lineHeight: 1, whiteSpace: 'nowrap' }}>
                  Mission
                </Typography>
              </Box>
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
        className="blueprint-card-actions"
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${2 + (onToggleInventory ? 1 : 0) + (organizationShareAction ? 1 : 0) + (extraQuickActions?.length ?? 0)}, minmax(0, 1fr))`,
          gap: 0.75,
          px: 1.25,
          py: 1.125,
          borderTop: `1px solid ${theme.palette.divider}`,
          backgroundColor: alpha(theme.palette.background.default, 0.08),
          // On pointer devices the quick actions only appear on hover/focus to keep
          // the resting grid quiet; space stays reserved so the layout never shifts.
          // Touch devices (no hover) always show them.
          '@media (hover: hover) and (pointer: fine)': {
            opacity: 0,
            transition: 'opacity 160ms ease',
            '.blueprint-card:hover &, .blueprint-card:focus-within &': { opacity: 1 },
          },
        }}
      >
        <QuickActionBtn
          active={isFavorite}
          onClick={() => onToggleFavorite(blueprint.id)}
          label={t('Favorite', 'Favori', 'Favorit')}
          icon={isFavorite ? <StarIcon /> : <StarBorderIcon />}
          color={isFavorite ? theme.palette.warning.main : undefined}
        />
        {onToggleInventory && (
          <QuickActionBtn
            active={isInInventory}
            onClick={() => onToggleInventory(blueprint.id)}
            label={t('Inventory', 'Inventaire', 'Inventar')}
            icon={isInInventory ? <CheckIcon /> : <Inventory2OutlinedIcon />}
          />
        )}
        <QuickActionBtn
          onClick={() => onAddToPlanner ? onAddToPlanner(blueprint.id) : onSelect(blueprint)}
          label={onAddToPlanner ? t('Planner', 'Planner', 'Planner') : t('Simulate', 'Simuler', 'Simulieren')}
          icon={onAddToPlanner ? <PlaylistAddIcon /> : <GameIcon name="calculator" size={14} shimmer={false} />}
        />
        {organizationShareAction && (
          <AppTooltip content={organizationShareAction.tooltip}>
            <Box sx={{ display: 'flex', flex: 1 }}>
              <QuickActionBtn
                active={organizationShareAction.selected}
                disabled={organizationShareAction.disabled || organizationShareAction.busy}
                onClick={() => organizationShareAction.onToggle(blueprint.id)}
                label={organizationShareAction.label}
                ariaLabel={organizationShareAction.ariaLabel}
                icon={
                  organizationShareAction.busy ? (
                    <AppProgressSpinner size={14} strokeWidth={4} />
                  ) : organizationShareAction.selected ? (
                    <GroupsIcon />
                  ) : (
                    <GroupsOutlinedIcon />
                  )
                }
              />
            </Box>
          </AppTooltip>
        )}
        {(extraQuickActions ?? []).map((action) => (
          <AppTooltip key={action.key} content={action.tooltip}>
            <Box sx={{ display: 'flex', flex: 1 }}>
              <QuickActionBtn
                active={Boolean(action.selected)}
                disabled={action.disabled || action.busy}
                onClick={() => action.onClick(blueprint.id)}
                label={action.label}
                ariaLabel={action.ariaLabel}
                icon={
                  action.busy ? (
                    <AppProgressSpinner size={14} strokeWidth={4} />
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
          </AppTooltip>
        ))}
      </Box>
    </Card>
  );
}, (prev, next) =>
  prev.blueprint === next.blueprint &&
  prev.isActive === next.isActive &&
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
  const [catalogueView, setCatalogueView] = useState<'rows' | 'cards'>('rows');
  const shipComponentBlueprintsEnabled = useFlag('ship-component-blueprints');
  const {
    activeBlueprint,
    setActiveBlueprint,
    favoriteIds,
    inventoryIds,
    toggleFavorite,
    toggleInventory,
    blueprints: allBlueprints,
    missionRewards,
    missionRewardsLoading,
    activeDataset,
  } = useCraft();
  const {
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
    setSearchQuery,
  } = useFilters();
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

  // Defer the (potentially large) blueprint/ship-component filtering off the
  // keystroke path: the search input stays responsive while the expensive
  // filter+sort runs at lower priority on the deferred query.
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Stable callbacks so the memoised BlueprintCard isn't invalidated on every
  // grid render (e.g. each keystroke). The inventory handler only changes when
  // the inventory set itself changes.
  const handleSelectBlueprint = useCallback(
    (bp: Blueprint | null) => startTransition(() => setActiveBlueprint(bp)),
    [setActiveBlueprint],
  );
  const handleToggleInventory = useCallback(
    (blueprintId: string) => {
      trackEvent('blueprint_inventory_cta_clicked', {
        action: inventoryIdSet.has(blueprintId) ? 'remove' : 'add',
      });
      toggleInventory(blueprintId);
    },
    [inventoryIdSet, toggleInventory],
  );

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
    return getObtainableBlueprintIds(missionRewards);
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
      const normalizedMaterial = materialFilter
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      list = list.filter((bp) =>
        (bp.requiredResourceIds?.includes(normalizedMaterial) ?? false) ||
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
    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase();
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
    deferredSearchQuery,
    slotCountFilter,
    weaponTypeFilter,
  ]);

  const { sentinelRef, visibleCount, initialCount } =
    useInfiniteScroll(filteredBlueprints, {
      getColumns: blueprintGetColumns,
      getScrollRoot: getMainContentScrollRoot,
    });

  const shipComponentFiltersBlocked =
    !shipComponentBlueprintsEnabled;

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

    if (deferredSearchQuery.trim()) {
      const q = deferredSearchQuery.toLowerCase();
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
    deferredSearchQuery,
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
  const normalizedSearchQuery = searchQuery.trim();
  const emptyDescription = normalizedSearchQuery
    ? t(
      `No results match “${normalizedSearchQuery}”.`,
      `Aucun résultat ne correspond à « ${normalizedSearchQuery} ».`,
    )
    : undefined;

  const hasVisibleBlueprints = filteredBlueprints.length > 0;
  const hasVisibleShipComponents = filteredShipComponents.length > 0;
  const isCompletelyEmpty = !hasVisibleBlueprints && !hasVisibleShipComponents;

  return (
    <PageLayout
      width="wide"
      sx={{ flex: '1 0 auto', minHeight: 0, animation: 'if-fade-in 280ms ease both' }}
    >
      <PageHeader
        title={t('Blueprints', 'Blueprints')}
        eyebrow={t('01 / Production library', '01 / Bibliothèque de production', '01 / Produktionsbibliothek')}
        description={t(
          'Browse craftable items, simulate quality builds and plan your material runs.',
          'Parcourez les objets craftables, simulez des builds qualite et planifiez vos collectes de materiaux.',
        )}
      />

      <BlueprintExplorer />

      {/* Counts and presentation are one toolbar, directly above the results. */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }} aria-live="polite">
            <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{filteredBlueprints.length}</strong>{' '}
            {t('blueprints', 'blueprints')}
            {!shipComponentFiltersBlocked ? ` • ${filteredShipComponents.length} ${t('ship components', 'composants de vaisseau')}` : ''}
        </Typography>
        <Box role="group" aria-label={t('Catalogue presentation', 'Présentation du catalogue', 'Katalogdarstellung')} sx={{ display: 'flex', gap: 0.75 }}>
        <AppButton size="sm" variant={catalogueView === 'rows' ? 'primary' : 'secondary'} ariaPressed={catalogueView === 'rows'} onClick={() => setCatalogueView('rows')}>{t('Register', 'Registre', 'Register')}</AppButton>
        <AppButton size="sm" variant={catalogueView === 'cards' ? 'primary' : 'secondary'} ariaPressed={catalogueView === 'cards'} onClick={() => setCatalogueView('cards')}>{t('Cards', 'Cartes', 'Karten')}</AppButton>
      </Box>
      </Box>

      {/* ── Grid area — IntersectionObserver root ── */}
      <Box sx={{ pb: 4 }}>
        {isCompletelyEmpty ? (
          <SurfaceState
            title={emptyMessage}
            description={emptyDescription}
            actionLabel={normalizedSearchQuery ? t('Clear search', 'Effacer la recherche') : undefined}
            onAction={normalizedSearchQuery ? () => setSearchQuery('') : undefined}
          />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {hasVisibleBlueprints && (
                <Box>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: catalogueView === 'rows' ? 'repeat(auto-fill, minmax(min(470px, 100%), 1fr))' : 'repeat(auto-fill, minmax(min(var(--workspace-card-width), 100%), 1fr))',
                      gap: 'var(--workspace-gap)',
                    }}
                    role="list"
                    aria-label={t('Blueprint list', 'Liste des blueprints')}
                    className={catalogueView === 'rows' ? 'workspace-blueprint-register' : undefined}
                  >
                    {filteredBlueprints.slice(0, visibleCount).map((blueprint, index) => (
                      <BlueprintCard
                        key={blueprint.id}
                        blueprint={blueprint}
                        isActive={activeBlueprint?.id === blueprint.id}
                        isFavorite={favoriteIdSet.has(blueprint.id)}
                        isInInventory={inventoryIdSet.has(blueprint.id)}
                        isObtainable={obtainableIds.has(blueprint.id)}
                        resources={resources}
                        priority={index < initialCount}
                        onSelect={handleSelectBlueprint}
                        onToggleFavorite={toggleFavorite}
                        onToggleInventory={handleToggleInventory}
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
                      letterSpacing: '-0.008em',
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
                <AppButton
                  variant="primary"
                  size="sm"
                  startIcon={<SyncIcon sx={{ fontSize: 14 }} />}
                  onClick={() => navigateToPath('/account', { mainView: 'account' })}
                  sx={{ fontWeight: 700 }}
                >
                  {t('Go to Account', 'Aller sur le Compte')}
                </AppButton>
              ) : (
                <AppButton
                  href="/api/desktop/latest-installer"
                  variant="primary"
                  size="sm"
                  startIcon={<DownloadOutlinedIcon sx={{ fontSize: 14 }} />}
                  sx={{ fontWeight: 700 }}
                >
                  {t('Download desktop app', 'Télécharger l\'app bureau')}
                </AppButton>
              )}
            </Box>
        )}
      </Box>
    </PageLayout>
  );
}
