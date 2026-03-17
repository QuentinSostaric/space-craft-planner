import { useId, useMemo, useState } from 'react';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { CategoryBadge } from './ui/Badge';
import { buildBlueprintContractCountMap } from '../utils/crafting';
import type { Blueprint, CategoryFilter } from '../types';

type LibrarySegment = 'all' | 'inventory' | 'favorites' | 'obtainable';

const CATEGORY_FILTERS: { value: CategoryFilter; labelEn: string; labelFr: string }[] = [
  { value: 'all', labelEn: 'All', labelFr: 'Tous' },
  { value: 'fps-weapon', labelEn: 'Weapons', labelFr: 'Armes' },
  { value: 'fps-armor', labelEn: 'Armor', labelFr: 'Armures' },
  { value: 'fps-helmet', labelEn: 'Helmets', labelFr: 'Casques' },
  { value: 'fps-undersuit', labelEn: 'Undersuits', labelFr: 'Combis' },
  { value: 'fps-backpack', labelEn: 'Backpacks', labelFr: 'Sacs' },
  { value: 'fps-magazine', labelEn: 'Magazines', labelFr: 'Chargeurs' },
];

const SEGMENTS: { value: LibrarySegment; labelEn: string; labelFr: string }[] = [
  { value: 'all', labelEn: 'All', labelFr: 'Tous' },
  { value: 'inventory', labelEn: 'Inventory', labelFr: 'Inventaire' },
  { value: 'favorites', labelEn: '★ Favs', labelFr: '★ Favoris' },
  { value: 'obtainable', labelEn: '⚑ Obtainable', labelFr: '⚑ Obtenables' },
];

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
      className={['bp-card', isActive && 'bp-card--active', isInInventory && 'bp-card--owned']
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
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
        <CategoryBadge category={blueprint.category} iconOnly />
        {isFavorite && <span className="bp-card__fav-indicator" aria-label={t('Favorite', 'Favori')}>★</span>}
        {isInInventory && (
          <span className="bp-card__inv-indicator" aria-label={t('In inventory', 'En inventaire')}>
            ◉
          </span>
        )}
        {contractCount > 0 && (
          <span
            className="bp-card__mission-badge"
            aria-label={t(`${contractCount} mission contracts`, `${contractCount} contrats de mission`)}
            title={t(`${contractCount} mission contracts`, `${contractCount} contrats de mission`)}
          >
            ⚑ {contractCount}
          </span>
        )}
      </div>
      <h3 className="bp-card__name">{blueprint.name}</h3>
      <p className="bp-card__manufacturer">{blueprint.manufacturer}</p>
    </article>
  );
}

export function BlueprintExplorer() {
  const {
    activeBlueprint,
    setActiveBlueprint,
    categoryFilter,
    setCategoryFilter,
    favoriteIds,
    inventoryIds,
    blueprints: allBlueprints,
    missionRewards,
  } = useCraft();
  const { lang, t } = useI18n();

  const [segment, setSegment] = useState<LibrarySegment>('all');
  const [search, setSearch] = useState('');
  const searchId = useId();

  const contractCountMap = useMemo(
    () => buildBlueprintContractCountMap(missionRewards),
    [missionRewards],
  );

  // Build obtainable set
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

  // Unified filtered list
  const filteredBlueprints = useMemo(() => {
    let list = allBlueprints;

    // Segment filter
    if (segment === 'inventory') {
      list = list.filter((bp) => inventoryIds.includes(bp.id));
    } else if (segment === 'favorites') {
      list = list.filter((bp) => favoriteIds.includes(bp.id));
    } else if (segment === 'obtainable') {
      list = list.filter((bp) => obtainableIds.has(bp.id));
    }

    // Category filter
    if (categoryFilter !== 'all' && categoryFilter !== 'favorites' && categoryFilter !== 'obtainable') {
      list = list.filter((bp) => bp.category === categoryFilter);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (bp) => bp.name.toLowerCase().includes(q) || bp.manufacturer.toLowerCase().includes(q),
      );
    }

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [allBlueprints, segment, categoryFilter, search, favoriteIds, inventoryIds, obtainableIds]);

  function renderCard(blueprint: Blueprint) {
    return (
      <div key={blueprint.id} role="listitem">
        <BlueprintCard
          blueprint={blueprint}
          isActive={activeBlueprint?.id === blueprint.id}
          isFavorite={favoriteIds.includes(blueprint.id)}
          isInInventory={inventoryIds.includes(blueprint.id)}
          contractCount={contractCountMap.get(blueprint.id) ?? 0}
          onClick={() => setActiveBlueprint(activeBlueprint?.id === blueprint.id ? null : blueprint)}
        />
      </div>
    );
  }

  const emptyMessage = segment === 'inventory'
    ? (inventoryIds.length === 0
      ? t('No blueprints in inventory. Select a blueprint and click "Mark as looted".', 'Aucun blueprint dans l inventaire. Selectionnez un blueprint et cliquez sur "Marquer comme loote".')
      : t('No blueprints match your filters.', 'Aucun blueprint ne correspond aux filtres.'))
    : segment === 'favorites'
      ? t('No favorites yet. Star a blueprint to save it here.', 'Aucun favori pour le moment. Etoilez un blueprint pour le sauvegarder ici.')
      : segment === 'obtainable'
        ? t('No obtainable blueprints found.', 'Aucun blueprint obtenable trouve.')
        : t('No blueprints found.', 'Aucun blueprint trouve.');

  return (
    <section className="explorer" aria-label={t('Blueprint library', 'Bibliotheque de blueprints')}>
      {/* Search */}
      <div className="explorer__search">
        <label className="sr-only" htmlFor={searchId}>{t('Search blueprints', 'Rechercher des blueprints')}</label>
        <span className="explorer__search-icon" aria-hidden="true">⌕</span>
        <input
          id={searchId}
          type="search"
          className="explorer__search-input"
          placeholder={t('Search blueprints...', 'Rechercher...')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Segmented control */}
      <nav className="explorer__segments" role="group" aria-label={t('Library filter', 'Filtre bibliotheque')}>
        {SEGMENTS.map((s) => (
          <button
            key={s.value}
            className={['explorer__segment-btn', segment === s.value && 'explorer__segment-btn--active'].filter(Boolean).join(' ')}
            onClick={() => setSegment(s.value)}
            aria-pressed={segment === s.value}
          >
            {lang === 'en' ? s.labelEn : s.labelFr}
            {s.value === 'inventory' && inventoryIds.length > 0 && (
              <span className="explorer__segment-count">{inventoryIds.length}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Category filter chips */}
      <nav className="explorer__filters" aria-label={t('Category filter', 'Filtre categorie')}>
        {CATEGORY_FILTERS.map(({ value, labelEn, labelFr }) => (
          <button
            key={value}
            className={['explorer__filter-btn', categoryFilter === value && 'explorer__filter-btn--active'].filter(Boolean).join(' ')}
            onClick={() => setCategoryFilter(value)}
            aria-pressed={categoryFilter === value}
          >
            {lang === 'en' ? labelEn : labelFr}
          </button>
        ))}
      </nav>

      {/* List */}
      <div className="explorer__list" role="list" aria-label={t('Blueprint list', 'Liste des blueprints')}>
        {filteredBlueprints.length === 0 ? (
          <p className="explorer__empty" role="status">{emptyMessage}</p>
        ) : (
          filteredBlueprints.map(renderCard)
        )}
      </div>

      <div className="explorer__count" aria-live="polite">
        {filteredBlueprints.length} {t('blueprints', 'blueprints')}
      </div>
    </section>
  );
}
