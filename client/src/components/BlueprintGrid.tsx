import { useMemo } from 'react';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { CategoryBadge } from './ui/Badge';
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
    <article
      className={['bp-card bp-card--grid', isActive && 'bp-card--active', isInInventory && 'bp-card--owned']
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      aria-label={t(
        `Blueprint ${blueprint.name} by ${blueprint.manufacturer}`,
        `Blueprint ${blueprint.name} par ${blueprint.manufacturer}`,
      )}
    >
      <div className="bp-card__header">
        <CategoryBadge category={blueprint.category} />
        <div className="bp-card__badges">
          {isFavorite && (
            <span className="bp-card__fav-indicator" aria-label={t('Favorite', 'Favori')}>★</span>
          )}
          {isInInventory && (
            <span className="bp-card__inv-indicator" aria-label={t('In inventory', 'En inventaire')}>◉</span>
          )}
          {contractCount > 0 && (
            <span
              className="bp-card__mission-badge"
              title={t(`${contractCount} mission contracts`, `${contractCount} contrats de mission`)}
            >
              ⚑ {contractCount}
            </span>
          )}
        </div>
      </div>
      <h3 className="bp-card__name">{blueprint.name}</h3>
      <p className="bp-card__manufacturer">{blueprint.manufacturer}</p>
      <div className="bp-card__meta">
        <span className="bp-card__slots">
          {blueprint.slots.length} {t('material', 'matériau')}{blueprint.slots.length !== 1 ? 's' : ''}
        </span>
        {blueprint.craftTimeSecs > 0 && (
          <span className="bp-card__craft-time">
            {blueprint.craftTimeSecs >= 60
              ? `${Math.round(blueprint.craftTimeSecs / 60)} min`
              : `${blueprint.craftTimeSecs}s`}
          </span>
        )}
      </div>
    </article>
  );
}

export function BlueprintGrid() {
  const {
    activeBlueprint,
    setActiveBlueprint,
    categoryFilter,
    searchQuery,
    librarySegment,
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

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (bp) => bp.name.toLowerCase().includes(q) || bp.manufacturer.toLowerCase().includes(q),
      );
    }

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [allBlueprints, librarySegment, categoryFilter, searchQuery, favoriteIds, inventoryIds, obtainableIds]);

  function renderCard(blueprint: Blueprint) {
    return (
      <BlueprintCard
        key={blueprint.id}
        blueprint={blueprint}
        isActive={activeBlueprint?.id === blueprint.id}
        isFavorite={favoriteIds.includes(blueprint.id)}
        isInInventory={inventoryIds.includes(blueprint.id)}
        contractCount={contractCountMap.get(blueprint.id) ?? 0}
        onClick={() => setActiveBlueprint(activeBlueprint?.id === blueprint.id ? null : blueprint)}
      />
    );
  }

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
    <div className="bp-grid-container">
      <div className="bp-grid-header">
        <span className="bp-grid-count" aria-live="polite">
          {filteredBlueprints.length} {t('blueprints', 'blueprints')}
        </span>
      </div>
      {filteredBlueprints.length === 0 ? (
        <p className="bp-grid-empty" role="status">{emptyMessage}</p>
      ) : (
        <div className="bp-grid" role="list" aria-label={t('Blueprint list', 'Liste des blueprints')}>
          {filteredBlueprints.map(renderCard)}
        </div>
      )}
    </div>
  );
}
