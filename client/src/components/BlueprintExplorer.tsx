import { useId, useMemo, useState } from 'react';
import { useCraft, useFilteredBlueprints } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { CategoryBadge } from './ui/Badge';
import { buildBlueprintContractCountMap } from '../utils/crafting';
import type { Blueprint, CategoryFilter } from '../types';

const CATEGORY_FILTERS: { value: CategoryFilter; labelEn: string; labelFr: string }[] = [
  { value: 'all', labelEn: 'All', labelFr: 'Tous' },
  { value: 'fps-weapon', labelEn: 'Weapons', labelFr: 'Armes' },
  { value: 'fps-armor', labelEn: 'Armor', labelFr: 'Armures' },
  { value: 'fps-helmet', labelEn: 'Helmets', labelFr: 'Casques' },
  { value: 'fps-undersuit', labelEn: 'Undersuits', labelFr: 'Combis' },
  { value: 'fps-backpack', labelEn: 'Backpacks', labelFr: 'Sacs' },
  { value: 'fps-magazine', labelEn: 'Magazines', labelFr: 'Chargeurs' },
  { value: 'obtainable', labelEn: 'Obtainable', labelFr: 'Obtenables' },
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

function SectionSearch({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  const inputId = useId();

  return (
    <div className="explorer__section-search">
      <label className="sr-only" htmlFor={inputId}>{label}</label>
      <span className="explorer__section-search-icon" aria-hidden="true">⌕</span>
      <input
        id={inputId}
        type="search"
        className="explorer__section-search-input"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function CategoryFilterBar({
  value,
  onChange,
  lang,
  includeFavorites,
}: {
  value: CategoryFilter;
  onChange: (value: CategoryFilter) => void;
  lang: string;
  includeFavorites?: boolean;
}) {
  const { t } = useI18n();
  const entries = includeFavorites
    ? [{ value: 'favorites' as CategoryFilter, labelEn: '★', labelFr: '★' }, ...CATEGORY_FILTERS]
    : CATEGORY_FILTERS;

  return (
    <nav className="explorer__filters" aria-label={t('Filters', 'Filtres')}>
      {entries.map(({ value: nextValue, labelEn, labelFr }) => (
        <button
          key={nextValue}
          className={[
            'explorer__filter-btn',
            value === nextValue && 'explorer__filter-btn--active',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => onChange(nextValue)}
          aria-pressed={value === nextValue}
        >
          {lang === 'en' ? labelEn : labelFr}
        </button>
      ))}
    </nav>
  );
}

function SectionHeader({
  title,
  count,
  isOpen,
  onToggle,
}: {
  title: string;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={['explorer__section-header', isOpen && 'explorer__section-header--open']
      .filter(Boolean)
      .join(' ')}>
      <button className="explorer__section-toggle" onClick={onToggle} aria-expanded={isOpen}>
        <span className="explorer__section-title">{title}</span>
        <span className="explorer__section-count">{count}</span>
        <span
          className={['explorer__chevron', isOpen && 'explorer__chevron--open']
            .filter(Boolean)
            .join(' ')}
          aria-hidden="true"
        >
          ›
        </span>
      </button>
    </div>
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
    appMode,
    missionRewards,
  } = useCraft();
  const { lang, t } = useI18n();

  const [allOpen, setAllOpen] = useState(true);
  const [inventoryOpen, setInventoryOpen] = useState(true);
  const [inventorySearch, setInventorySearch] = useState('');
  const [blueprintSearch, setBlueprintSearch] = useState('');
  const [inventoryCatFilter, setInventoryCatFilter] = useState<CategoryFilter>('all');

  const contractCountMap = useMemo(
    () => buildBlueprintContractCountMap(missionRewards),
    [missionRewards],
  );

  const filteredByCategory = useFilteredBlueprints();
  const filteredBlueprints = useMemo(() => {
    if (!blueprintSearch.trim()) {
      return filteredByCategory;
    }

    const query = blueprintSearch.toLowerCase();
    return filteredByCategory.filter(
      (blueprint) =>
        blueprint.name.toLowerCase().includes(query) ||
        blueprint.manufacturer.toLowerCase().includes(query),
    );
  }, [filteredByCategory, blueprintSearch]);

  const inventoryBlueprints = useMemo(() => {
    let blueprints = allBlueprints.filter((blueprint) => inventoryIds.includes(blueprint.id));

    if (inventoryCatFilter === 'favorites') {
      blueprints = blueprints.filter((blueprint) => favoriteIds.includes(blueprint.id));
    } else if (inventoryCatFilter !== 'all') {
      blueprints = blueprints.filter((blueprint) => blueprint.category === inventoryCatFilter);
    }

    if (inventorySearch.trim()) {
      const query = inventorySearch.toLowerCase();
      blueprints = blueprints.filter(
        (blueprint) =>
          blueprint.name.toLowerCase().includes(query) ||
          blueprint.manufacturer.toLowerCase().includes(query),
      );
    }

    return blueprints.sort((left, right) => left.name.localeCompare(right.name));
  }, [allBlueprints, favoriteIds, inventoryCatFilter, inventoryIds, inventorySearch]);

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

  return (
    <section className="explorer" aria-label={t('Blueprint explorer', 'Explorateur de blueprints')}>
      <div className={['explorer__section', inventoryOpen && 'explorer__section--compact']
        .filter(Boolean)
        .join(' ')}>
        <SectionHeader
          title={t('My Inventory', 'Mon inventaire')}
          count={inventoryIds.length}
          isOpen={inventoryOpen}
          onToggle={() => setInventoryOpen((value) => !value)}
        />
        {inventoryOpen && (
          <>
            <SectionSearch
              value={inventorySearch}
              onChange={setInventorySearch}
              placeholder={t('Search inventory…', 'Rechercher…')}
              label={t('Search inventory', 'Rechercher dans l inventaire')}
            />
            <CategoryFilterBar
              value={inventoryCatFilter}
              onChange={setInventoryCatFilter}
              lang={lang}
              includeFavorites
            />
            <div className="explorer__list explorer__list--inventory" role="list" aria-label={t('Inventory', 'Inventaire')}>
              {inventoryBlueprints.length === 0 ? (
                <p className="explorer__empty" role="status">
                  {inventoryIds.length === 0
                    ? t(
                        'No blueprints in inventory. Select a blueprint and click "Mark as looted".',
                        'Aucun blueprint dans l inventaire. Selectionnez un blueprint et cliquez sur "Marquer comme loote".',
                      )
                    : t('No blueprints match your filters.', 'Aucun blueprint ne correspond aux filtres.')}
                </p>
              ) : (
                inventoryBlueprints.map(renderCard)
              )}
            </div>
          </>
        )}
      </div>

      {(appMode === 'craft' || appMode === 'missions') && (
        <div className={['explorer__section', allOpen && 'explorer__section--open']
          .filter(Boolean)
          .join(' ')}>
          <SectionHeader
            title={t('Blueprints', 'Blueprints')}
            count={filteredBlueprints.length}
            isOpen={allOpen}
            onToggle={() => setAllOpen((value) => !value)}
          />
          {allOpen && (
            <>
              <SectionSearch
                value={blueprintSearch}
                onChange={setBlueprintSearch}
                placeholder={t('Search blueprints…', 'Rechercher…')}
                label={t('Search blueprints', 'Rechercher des blueprints')}
              />
              <CategoryFilterBar
                value={categoryFilter}
                onChange={setCategoryFilter}
                lang={lang}
                includeFavorites
              />
              <div className="explorer__list" role="list" aria-label={t('Blueprint list', 'Liste des blueprints')}>
                {filteredBlueprints.length === 0 ? (
                  <p className="explorer__empty" role="status">
                    {categoryFilter === 'favorites'
                      ? t(
                          'No favorites yet. Star a blueprint to save it here.',
                          'Aucun favori pour le moment. Etoilez un blueprint pour le sauvegarder ici.',
                        )
                      : categoryFilter === 'obtainable'
                        ? t(
                            'No obtainable blueprints found. Mission rewards may not be loaded yet.',
                            'Aucun blueprint obtenable trouve. Les recompenses de mission ne sont peut-etre pas encore chargees.',
                          )
                        : t('No blueprints found.', 'Aucun blueprint trouve.')}
                  </p>
                ) : (
                  filteredBlueprints.map(renderCard)
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
