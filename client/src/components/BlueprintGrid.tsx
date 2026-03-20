import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import StarIcon from '@mui/icons-material/Star';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { CategoryBadge } from './ui/Badge';
import { GameIcon } from './ui/GameIcon';
import { RarityBadge } from './ui/RarityBadge';
import { StatBar } from './ui/StatBar';
import { MaterialChips } from './ui/MaterialChips';
import { tokens } from '../theme';
import { CARD_STATS, computeStatMaxima } from '../utils/crafting';
import { BlueprintExplorer } from './BlueprintExplorer';
import { STAT_UNITS } from '../types';
import type { Blueprint, ItemCategory, NumericItemStatKey, Resource } from '../types';
import type { GameIconName } from './ui/GameIcon';

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

function BlueprintCard({
  blueprint,
  isActive,
  isFavorite,
  isInInventory,
  statMaxima,
  resources,
  onClick,
}: {
  blueprint: Blueprint;
  isActive: boolean;
  isFavorite: boolean;
  isInInventory: boolean;
  statMaxima: Map<NumericItemStatKey, number>;
  resources: Resource[];
  onClick: () => void;
}) {
  const { t, lang } = useI18n();
  const { url: thumbUrl, mode: thumbMode } = resolveThumb(blueprint);
  const [imgError, setImgError] = useState(false);
  const showImage = thumbUrl && !imgError;

  const cardStats = CARD_STATS[blueprint.category] ?? [];

  return (
    <Card
      role="listitem"
      sx={{
        borderColor: isActive ? tokens.violet : isInInventory ? tokens.borderStrong : tokens.border,
        backgroundColor: isActive ? tokens.surface2 : tokens.surface1,
        transition: 'border-color 150ms, background-color 150ms',
        cursor: 'pointer',
        '&:hover': {
          borderColor: isActive ? tokens.violet : tokens.borderStrong,
          backgroundColor: tokens.surface2,
        },
      }}
    >
      <CardActionArea
        onClick={onClick}
        aria-pressed={isActive}
        aria-label={t(
          `${blueprint.rarity ? blueprint.rarity + ' ' : ''}Blueprint ${blueprint.name} by ${blueprint.manufacturer}`,
          `Blueprint ${blueprint.rarity ? blueprint.rarity + ' ' : ''}${blueprint.name} par ${blueprint.manufacturer}`,
        )}
        sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
      >
        <Box sx={{ p: '10px 12px', display: 'flex', flexDirection: 'column', gap: 1 }}>
          {/* Row 1: Rarity badge + status icons */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {blueprint.rarity ? (
              <RarityBadge rarity={blueprint.rarity} />
            ) : (
              <CategoryBadge category={blueprint.category} />
            )}
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              {isFavorite && (
                <StarIcon sx={{ color: tokens.warning, fontSize: '.8rem' }} aria-label={t('Favorite', 'Favori')} />
              )}
              {isInInventory && (
                <CheckCircleIcon sx={{ color: tokens.violet, fontSize: '.75rem' }} aria-label={t('In inventory', 'En inventaire')} />
              )}
            </Box>
          </Box>

          {/* Row 2: Thumbnail + name */}
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <Box
              sx={{
                width: 64,
                minWidth: 64,
                height: 64,
                backgroundColor: tokens.bgSubtle,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                border: `1px solid ${tokens.border}`,
              }}
            >
              {showImage ? (
                <CardMedia
                  component="img"
                  image={thumbUrl}
                  alt=""
                  loading="lazy"
                  onError={() => setImgError(true)}
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    p: thumbMode === 'logo' ? '8px' : '2px',
                  }}
                />
              ) : (
                <GameIcon name={CAT_ICON[blueprint.category]} size={28} shimmer={false} />
              )}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                sx={{
                  fontFamily: "'Khand', sans-serif",
                  fontWeight: 700,
                  fontSize: '.95rem',
                  lineHeight: 1.2,
                  color: tokens.text,
                  textTransform: 'uppercase',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {blueprint.name}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: tokens.blueLight,
                  fontSize: '.6rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {blueprint.manufacturer} // {blueprint.category.replace('fps-', '')}
              </Typography>
            </Box>
          </Box>

          {/* Row 3: Stat bars */}
          {cardStats.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {cardStats.map(({ key, label }) => {
                const val = blueprint.baseStats[key];
                if (typeof val !== 'number' || val === 0) return null;
                const max = statMaxima.get(key) ?? val;
                const unit = STAT_UNITS[key] ?? '';
                const displayVal = unit === '%'
                  ? `${Math.round(val * 100)}%`
                  : `${Math.round(val)}${unit ? ` ${unit}` : ''}`;
                const fill = max > 0 ? (val / max) * 100 : 0;
                return (
                  <StatBar
                    key={key}
                    label={lang === 'fr' ? label.fr : label.en}
                    value={displayVal}
                    fill={fill}
                  />
                );
              })}
              {/* Ammo type chip for magazines */}
              {blueprint.category === 'fps-magazine' && blueprint.baseStats.ammoType && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      width: 80,
                      flexShrink: 0,
                      fontSize: '.6rem',
                      color: tokens.textMuted,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}
                  >
                    {lang === 'fr' ? 'Munition' : 'Ammo'}
                  </Typography>
                  <Box
                    sx={{
                      backgroundColor: tokens.surface2,
                      px: 0.75,
                      py: 0.25,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ fontSize: '.55rem', color: tokens.textMuted, textTransform: 'uppercase' }}
                    >
                      {blueprint.baseStats.ammoType}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          )}

          {/* Row 4: Materials */}
          {blueprint.slots.length > 0 && (
            <MaterialChips slots={blueprint.slots} resources={resources} />
          )}
        </Box>
      </CardActionArea>
    </Card>
  );
}

export function BlueprintGrid() {
  const {
    activeBlueprint,
    setActiveBlueprint,
    categoryFilter,
    searchQuery,
    librarySegment,
    manufacturerFilter,
    legalityFilter,
    locationFilter,
    favoriteIds,
    inventoryIds,
    blueprints: allBlueprints,
    missionRewards,
    activeDataset,
  } = useCraft();
  const { t } = useI18n();


  const resources = activeDataset.resources;
  const statMaxima = useMemo(() => computeStatMaxima(allBlueprints), [allBlueprints]);

  const obtainableIds = useMemo(() => {
    const ids = new Set<string>();
    if (missionRewards) {
      for (const group of missionRewards.factionGroups) {
        for (const contract of group.contracts) {
          for (const bp of contract.rewardedBlueprints) {
            ids.add(bp.id);
          }
        }
      }
    }
    return ids;
  }, [missionRewards]);

  // Build legality-based blueprint id set: blueprints obtainable via lawful/unlawful contracts
  const legalityBlueprintIds = useMemo(() => {
    if (legalityFilter === 'all' || !missionRewards) return null;
    const ids = new Set<string>();
    for (const group of missionRewards.factionGroups) {
      const factionType = group.faction?.factionType?.toLowerCase() ?? '';
      if (factionType !== legalityFilter) continue;
      for (const contract of group.contracts) {
        for (const bp of contract.rewardedBlueprints) {
          ids.add(bp.id);
        }
      }
    }
    return ids;
  }, [legalityFilter, missionRewards]);

  // Build location-based blueprint id set: blueprints obtainable at a specific location
  const locationBlueprintIds = useMemo(() => {
    if (!locationFilter || !missionRewards) return null;
    const ids = new Set<string>();
    for (const group of missionRewards.factionGroups) {
      for (const contract of group.contracts) {
        const locs = [
          ...contract.availability.localities,
          ...contract.availability.explicitLocations,
        ];
        if (!locs.includes(locationFilter)) continue;
        for (const bp of contract.rewardedBlueprints) {
          ids.add(bp.id);
        }
      }
    }
    return ids;
  }, [locationFilter, missionRewards]);

  const filteredBlueprints = useMemo(() => {
    let list = allBlueprints;

    // Segment filter
    if (librarySegment === 'inventory') {
      list = list.filter((bp) => inventoryIds.includes(bp.id));
    } else if (librarySegment === 'favorites') {
      list = list.filter((bp) => favoriteIds.includes(bp.id));
    } else if (librarySegment === 'obtainable') {
      list = list.filter((bp) => obtainableIds.has(bp.id));
    }

    // Category filter
    if (categoryFilter !== 'all' && categoryFilter !== 'favorites' && categoryFilter !== 'obtainable') {
      list = list.filter((bp) => bp.category === categoryFilter);
    }

    // Manufacturer filter
    if (manufacturerFilter) {
      list = list.filter((bp) => bp.manufacturer === manufacturerFilter);
    }

    // Legality filter
    if (legalityBlueprintIds) {
      list = list.filter((bp) => legalityBlueprintIds.has(bp.id));
    }

    // Location filter
    if (locationBlueprintIds) {
      list = list.filter((bp) => locationBlueprintIds.has(bp.id));
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (bp) => bp.name.toLowerCase().includes(q) || bp.manufacturer.toLowerCase().includes(q),
      );
    }

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [allBlueprints, librarySegment, categoryFilter, searchQuery, favoriteIds, inventoryIds, obtainableIds, manufacturerFilter, legalityBlueprintIds, locationBlueprintIds]);

  const emptyMessage = librarySegment === 'inventory'
    ? (inventoryIds.length === 0
      ? t('No blueprints in inventory.', 'Aucun blueprint dans l\'inventaire.')
      : t('No blueprints match your filters.', 'Aucun blueprint ne correspond aux filtres.'))
    : librarySegment === 'favorites'
      ? t('No favorites yet. Star a blueprint to save it here.', 'Aucun favori pour le moment.')
      : librarySegment === 'obtainable'
        ? t('No obtainable blueprints found.', 'Aucun blueprint obtenable trouvé.')
        : t('No blueprints found.', 'Aucun blueprint trouvé.');

  return (
    <Box>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', backgroundColor: 'background.paper' }}>
        <BlueprintExplorer />
      </Box>

      <Box sx={{ p: 2 }}>
        <Box sx={{ mb: 1 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }} aria-live="polite">
            {filteredBlueprints.length} {t('blueprints', 'blueprints')}
          </Typography>
        </Box>
        {filteredBlueprints.length === 0 ? (
          <Typography sx={{ color: 'text.secondary', py: 3, textAlign: 'center' }} role="status">
            {emptyMessage}
          </Typography>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(3, 1fr)',
                lg: 'repeat(4, 1fr)',
              },
              gap: 1,
              '@media (min-width: 480px) and (max-width: 599px)': {
                gridTemplateColumns: 'repeat(2, 1fr)',
              },
            }}
            role="list"
            aria-label={t('Blueprint list', 'Liste des blueprints')}
          >
            {filteredBlueprints.map((blueprint) => (
              <BlueprintCard
                key={blueprint.id}
                blueprint={blueprint}
                isActive={activeBlueprint?.id === blueprint.id}
                isFavorite={favoriteIds.includes(blueprint.id)}
                isInInventory={inventoryIds.includes(blueprint.id)}
                statMaxima={statMaxima}
                resources={resources}
                onClick={() => setActiveBlueprint(activeBlueprint?.id === blueprint.id ? null : blueprint)}
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
