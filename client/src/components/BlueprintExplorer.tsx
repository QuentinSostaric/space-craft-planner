import { useMemo, useState } from 'react';
import { useCraft, useFilteredBlueprints } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { CategoryBadge } from './ui/Badge';
import type { Blueprint, CategoryFilter } from '../types';

const CATEGORY_FILTERS: { value: CategoryFilter; labelEn: string; labelFr: string }[] = [
  { value: 'all',           labelEn: 'All',        labelFr: 'Tous' },
  { value: 'fps-weapon',    labelEn: 'Weapons',    labelFr: 'Armes' },
  { value: 'fps-armor',     labelEn: 'Armor',      labelFr: 'Armures' },
  { value: 'fps-helmet',    labelEn: 'Helmets',    labelFr: 'Casques' },
  { value: 'fps-undersuit', labelEn: 'Undersuits', labelFr: 'Combis' },
  { value: 'fps-backpack',  labelEn: 'Backpacks',  labelFr: 'Sacs' },
  { value: 'fps-magazine',  labelEn: 'Magazines',  labelFr: 'Chargeurs' },
];

function BlueprintCard({ blueprint, isActive, isFavorite, isInInventory, onClick }: {
  blueprint: Blueprint;
  isActive: boolean;
  isFavorite: boolean;
  isInInventory: boolean;
  onClick: () => void;
}) {
  return (
    <article
      className={['bp-card', isActive && 'bp-card--active', isInInventory && 'bp-card--owned'].filter(Boolean).join(' ')}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      aria-label={`Blueprint: ${blueprint.name} — ${blueprint.manufacturer}`}
    >
      <div className="bp-card__header">
        <CategoryBadge category={blueprint.category} iconOnly />
        {isFavorite && <span className="bp-card__fav-indicator" aria-label="Favoris">★</span>}
        {isInInventory && <span className="bp-card__inv-indicator" aria-label="En inventaire">◉</span>}
      </div>
      <h3 className="bp-card__name">{blueprint.name}</h3>
      <p className="bp-card__manufacturer">{blueprint.manufacturer}</p>
    </article>
  );
}

function SectionSearch({ value, onChange, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="explorer__section-search">
      <span className="explorer__section-search-icon" aria-hidden="true">⌕</span>
      <input
        type="search"
        className="explorer__section-search-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function CategoryFilterBar({ value, onChange, lang, includeFavorites }: {
  value: CategoryFilter;
  onChange: (v: CategoryFilter) => void;
  lang: string;
  includeFavorites?: boolean;
}) {
  const entries = includeFavorites
    ? [{ value: 'favorites' as CategoryFilter, labelEn: '★', labelFr: '★' }, ...CATEGORY_FILTERS]
    : CATEGORY_FILTERS;

  return (
    <nav className="explorer__filters" aria-label="Filters">
      {entries.map(({ value: v, labelEn, labelFr }) => (
        <button
          key={v}
          className={['explorer__filter-btn', value === v && 'explorer__filter-btn--active'].filter(Boolean).join(' ')}
          onClick={() => onChange(v)}
          aria-pressed={value === v}
        >
          {lang === 'en' ? labelEn : labelFr}
        </button>
      ))}
    </nav>
  );
}

function SectionHeader({ title, count, isOpen, onToggle, extra }: {
  title: string;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className={['explorer__section-header', isOpen && 'explorer__section-header--open'].filter(Boolean).join(' ')}>
      <button className="explorer__section-toggle" onClick={onToggle} aria-expanded={isOpen}>
        <span className="explorer__section-title">{title}</span>
        <span className="explorer__section-count">{count}</span>
        <span className={['explorer__chevron', isOpen && 'explorer__chevron--open'].filter(Boolean).join(' ')} aria-hidden="true">›</span>
      </button>
      {extra}
    </div>
  );
}

export function BlueprintExplorer() {
  const {
    activeBlueprint, setActiveBlueprint,
    categoryFilter, setCategoryFilter,
    favoriteIds,
    inventoryIds,
    blueprints: allBlueprints,
    appMode,
  } = useCraft();
  const { lang, t } = useI18n();

  // Per-section state
  const [allOpen, setAllOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(true);

  // Per-section searches
  const [inventorySearch, setInventorySearch] = useState('');
  const [blueprintSearch, setBlueprintSearch] = useState('');

  // Per-section category filters (inventory has its own, blueprints uses context)
  const [inventoryCatFilter, setInventoryCatFilter] = useState<CategoryFilter>('all');

  // Blueprints section: context category filter + local search
  const filteredByCategory = useFilteredBlueprints();
  const filteredBlueprints = useMemo(() => {
    if (!blueprintSearch.trim()) return filteredByCategory;
    const q = blueprintSearch.toLowerCase();
    return filteredByCategory.filter(
      (bp) => bp.name.toLowerCase().includes(q) || bp.manufacturer.toLowerCase().includes(q),
    );
  }, [filteredByCategory, blueprintSearch]);

  // Inventory section: filter by inventoryIds + category + search + favorites
  const inventoryBlueprints = useMemo(() => {
    let list = allBlueprints.filter((bp) => inventoryIds.includes(bp.id));
    if (inventoryCatFilter === 'favorites') {
      list = list.filter((bp) => favoriteIds.includes(bp.id));
    } else if (inventoryCatFilter !== 'all') {
      list = list.filter((bp) => bp.category === inventoryCatFilter);
    }
    if (inventorySearch.trim()) {
      const q = inventorySearch.toLowerCase();
      list = list.filter(
        (bp) => bp.name.toLowerCase().includes(q) || bp.manufacturer.toLowerCase().includes(q),
      );
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [allBlueprints, inventoryIds, inventoryCatFilter, favoriteIds, inventorySearch]);

  function renderCard(bp: Blueprint) {
    return (
      <div key={bp.id} role="listitem">
        <BlueprintCard
          blueprint={bp}
          isActive={activeBlueprint?.id === bp.id}
          isFavorite={favoriteIds.includes(bp.id)}
          isInInventory={inventoryIds.includes(bp.id)}
          onClick={() => setActiveBlueprint(activeBlueprint?.id === bp.id ? null : bp)}
        />
      </div>
    );
  }

  return (
    <section className="explorer" aria-label={t('Blueprint explorer', 'Explorateur de blueprints')}>

      {/* ── Section 1: My Inventory (top, compact by default) ── */}
      <div className={['explorer__section', inventoryOpen && 'explorer__section--compact'].filter(Boolean).join(' ')}>
        <SectionHeader
          title={t('My Inventory', 'Mon Inventaire')}
          count={inventoryIds.length}
          isOpen={inventoryOpen}
          onToggle={() => setInventoryOpen((v) => !v)}
        />
        {inventoryOpen && (
          <>
            <SectionSearch
              value={inventorySearch}
              onChange={setInventorySearch}
              placeholder={t('Search inventory…', 'Rechercher…')}
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
                        'Aucun blueprint. Sélectionnez un blueprint et cliquez sur "Marquer comme looté".',
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

      {/* ── Section 2: All Blueprints (collapsed by default, hidden in dismantle mode) ── */}
      {appMode === 'craft' && (
        <div className={['explorer__section', allOpen && 'explorer__section--open'].filter(Boolean).join(' ')}>
          <SectionHeader
            title={t('Blueprints', 'Blueprints')}
            count={filteredBlueprints.length}
            isOpen={allOpen}
            onToggle={() => setAllOpen((v) => !v)}
          />
          {allOpen && (
            <>
              <SectionSearch
                value={blueprintSearch}
                onChange={setBlueprintSearch}
                placeholder={t('Search blueprints…', 'Rechercher…')}
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
                      ? t('No favorites yet. Star a blueprint to save it here.', 'Aucun favori. Étoilez un blueprint pour le sauvegarder ici.')
                      : t('No blueprints found.', 'Aucun blueprint trouvé.')}
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
