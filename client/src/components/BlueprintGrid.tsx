import { alpha, useTheme } from '@mui/material/styles';
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
  statMaxima: Map<ItemCategory, Map<NumericItemStatKey, number>>;
  resources: Resource[];
  onClick: () => void;
}) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const { url: thumbUrl, mode: thumbMode } = resolveThumb(blueprint);
  const [imgError, setImgError] = useState(false);
  const showImage = thumbUrl && !imgError;

  const cardStats = CARD_STATS[blueprint.category] ?? [];
  const categoryMax = statMaxima.get(blueprint.category);

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
        cursor: 'pointer',
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
        onClick={onClick}
        aria-pressed={isActive}
        aria-label={t(
          `${blueprint.rarity ? blueprint.rarity + ' ' : ''}Blueprint ${blueprint.name} by ${blueprint.manufacturer}`,
          `Blueprint ${blueprint.rarity ? blueprint.rarity + ' ' : ''}${blueprint.name} par ${blueprint.manufacturer}`,
        )}
        sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
      >
        {/* Top Section: Image with overlays */}
        <Box
          sx={{
            position: 'relative',
            height: 160,
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

          {/* Status Icons Overlay */}
          <Box sx={{ position: 'absolute', top: 12, right: 12, zIndex: 1, display: 'flex', gap: 0.5 }}>
            {isFavorite && (
              <StarIcon
                sx={{
                  color: 'warning.main',
                  fontSize: '1.2rem',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                }}
                aria-label={t('Favorite', 'Favori')}
              />
            )}
            {isInInventory && (
              <CheckCircleIcon
                sx={{
                  color: 'primary.main',
                  fontSize: '1.1rem',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                }}
                aria-label={t('In inventory', 'En inventaire')}
              />
            )}
          </Box>

          {/* Large Image / Icon */}
          <Box sx={{ width: '100%', height: '100%', p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {showImage ? (
              <CardMedia
                component="img"
                image={thumbUrl}
                alt=""
                loading="lazy"
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
                    label={lang === 'fr' ? label.fr : label.en}
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

    // Library Segment
    if (librarySegment === 'inventory') {
      list = list.filter((bp) => inventoryIds.includes(bp.id));
    } else if (librarySegment === 'favorites') {
      list = list.filter((bp) => favoriteIds.includes(bp.id));
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

    // Legality
    if (legalityBlueprintIds) {
      list = list.filter((bp) => legalityBlueprintIds.has(bp.id));
    }

    // Location
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
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', backgroundColor: 'background.paper' }}>
        <BlueprintExplorer />
      </Box>

      <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }} aria-live="polite">
            {filteredBlueprints.length} {t('blueprints', 'blueprints')}
          </Typography>
        </Box>
        {filteredBlueprints.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <Typography sx={{ color: 'text.secondary', mb: 1 }} role="status">
              {emptyMessage}
            </Typography>
          </Box>
        ) : (
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
              gap: 3,
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