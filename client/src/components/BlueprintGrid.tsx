import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import StarIcon from '@mui/icons-material/Star';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FlagIcon from '@mui/icons-material/Flag';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { CategoryBadge } from './ui/Badge';
import { GameIcon } from './ui/GameIcon';
import { tokens } from '../theme';
import { buildBlueprintContractCountMap } from '../utils/crafting';
import { BlueprintExplorer } from './BlueprintExplorer';
import type { Blueprint, ItemCategory } from '../types';
import type { GameIconName } from './ui/GameIcon';

const THUMB_SIZE = 80;

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
  contractCount,
  onClick,
}: {
  blueprint: Blueprint;
  isActive: boolean;
  isFavorite: boolean;
  isInInventory: boolean;
  contractCount: number;
  onClick: () => void;
}) {
  const { t } = useI18n();
  const { url: thumbUrl, mode: thumbMode } = resolveThumb(blueprint);
  const [imgError, setImgError] = useState(false);
  const showImage = thumbUrl && !imgError;

  const mfrLogoUrl = blueprint.media?.manufacturerLogo?.imageUrl ?? null;
  // Show inline manufacturer logo only when primaryVisual is present (not when logo IS the thumbnail)
  const showInlineMfrLogo = thumbMode === 'item' && showImage && mfrLogoUrl;

  return (
    <Card
      sx={{
        borderColor: isActive ? tokens.violet : isInInventory ? tokens.borderStrong : tokens.border,
        backgroundColor: isActive ? tokens.surface2 : tokens.surface1,
        transition: 'border-color 150ms, background-color 150ms',
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
          `Blueprint ${blueprint.name} by ${blueprint.manufacturer}`,
          `Blueprint ${blueprint.name} par ${blueprint.manufacturer}`,
        )}
        sx={{ height: '100%' }}
      >
        <Box sx={{ display: 'flex', height: THUMB_SIZE }}>
          {/* Thumbnail zone */}
          <Box
            sx={{
              width: THUMB_SIZE,
              minWidth: THUMB_SIZE,
              height: THUMB_SIZE,
              backgroundColor: tokens.bgSubtle,
              borderRight: `1px solid ${tokens.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              transition: 'filter 150ms',
              '&:hover': { filter: 'brightness(1.1)' },
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
                  objectFit: thumbMode === 'item' ? 'contain' : 'contain',
                  p: thumbMode === 'logo' ? '12px' : '4px',
                }}
              />
            ) : (
              /* Fallback: category icon */
              <GameIcon
                name={CAT_ICON[blueprint.category]}
                size={32}
                shimmer={false}
              />
            )}
          </Box>

          {/* Content zone */}
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              p: '8px 10px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: '2px',
            }}
          >
            {/* Row 1: category + status icons */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <CategoryBadge category={blueprint.category} />
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                {isFavorite && (
                  <StarIcon sx={{ color: tokens.warning, fontSize: '.8rem' }} aria-label={t('Favorite', 'Favori')} />
                )}
                {isInInventory && (
                  <CheckCircleIcon sx={{ color: tokens.violet, fontSize: '.75rem' }} aria-label={t('In inventory', 'En inventaire')} />
                )}
              </Box>
            </Box>

            {/* Row 2: item name */}
            <Typography
              variant="body2"
              sx={{
                fontFamily: "'Khand', sans-serif",
                fontWeight: 700,
                fontSize: '.88rem',
                lineHeight: 1.2,
                color: 'text.primary',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {blueprint.name}
            </Typography>

            {/* Row 3: manufacturer (with optional inline logo) */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
              {showInlineMfrLogo && (
                <Box
                  component="img"
                  src={mfrLogoUrl}
                  alt=""
                  loading="lazy"
                  sx={{
                    width: 14,
                    height: 14,
                    objectFit: 'contain',
                    flexShrink: 0,
                    opacity: 0.7,
                  }}
                />
              )}
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  fontSize: '.6rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {blueprint.manufacturer}
              </Typography>
            </Box>

            {/* Row 4: footer meta */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 'auto' }}>
              {contractCount > 0 ? (
                <Box
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.25, color: 'warning.main' }}
                  title={t(`${contractCount} mission contracts`, `${contractCount} contrats de mission`)}
                >
                  <FlagIcon sx={{ fontSize: '.7rem' }} />
                  <Typography variant="caption" sx={{ fontSize: '.55rem', fontWeight: 600 }}>
                    {contractCount}
                  </Typography>
                </Box>
              ) : <span />}
              <Box sx={{ display: 'flex', gap: 0.75, fontSize: '.55rem', color: 'text.disabled' }}>
                <span>{blueprint.slots.length} {t('mat.', 'mat.')}</span>
                {blueprint.craftTimeSecs > 0 && (
                  <span>
                    {blueprint.craftTimeSecs >= 60
                      ? `${Math.round(blueprint.craftTimeSecs / 60)} min`
                      : `${blueprint.craftTimeSecs}s`}
                  </span>
                )}
              </Box>
            </Box>
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
  } = useCraft();
  const { t } = useI18n();

  const contractCountMap = useMemo(
    () => buildBlueprintContractCountMap(missionRewards),
    [missionRewards],
  );

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
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
              gap: 1,
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
                contractCount={contractCountMap.get(blueprint.id) ?? 0}
                onClick={() => setActiveBlueprint(activeBlueprint?.id === blueprint.id ? null : blueprint)}
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
