import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import StarIcon from '@mui/icons-material/Star';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FlagIcon from '@mui/icons-material/Flag';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { CategoryBadge } from './ui/Badge';
import { tokens } from '../theme';
import { buildBlueprintContractCountMap } from '../utils/crafting';
import type { Blueprint } from '../types';

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

  return (
    <Card
      sx={{
        borderColor: isActive ? tokens.violet : isInInventory ? tokens.borderStrong : tokens.border,
        backgroundColor: isActive ? tokens.surface2 : tokens.surface1,
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
        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 }, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {/* Top row: category + status badges */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <CategoryBadge category={blueprint.category} />
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              {isFavorite && (
                <StarIcon sx={{ color: tokens.warning, fontSize: '.9rem' }} aria-label={t('Favorite', 'Favori')} />
              )}
              {isInInventory && (
                <CheckCircleIcon sx={{ color: tokens.violet, fontSize: '.8rem' }} aria-label={t('In inventory', 'En inventaire')} />
              )}
            </Box>
          </Box>

          {/* Primary: item name */}
          <Typography
            variant="body2"
            sx={{
              fontFamily: "'Khand', sans-serif",
              fontWeight: 700,
              fontSize: '.88rem',
              lineHeight: 1.2,
            }}
          >
            {blueprint.name}
          </Typography>

          {/* Secondary: manufacturer */}
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '.65rem' }}>
            {blueprint.manufacturer}
          </Typography>

          {/* Footer */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 'auto', pt: 0.5 }}>
            {contractCount > 0 ? (
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 0.25, color: 'warning.main' }}
                title={t(`${contractCount} mission contracts`, `${contractCount} contrats de mission`)}
              >
                <FlagIcon sx={{ fontSize: '.8rem' }} />
                <Typography variant="caption" sx={{ fontSize: '.6rem', fontWeight: 600 }}>
                  {contractCount} {t('mission', 'mission')}{contractCount > 1 ? 's' : ''}
                </Typography>
              </Box>
            ) : <span />}
            <Box sx={{ display: 'flex', gap: 1, fontSize: '.6rem', color: 'text.disabled' }}>
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
        </CardContent>
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
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' },
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
  );
}
