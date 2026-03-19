import { useId } from 'react';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { CategoryBadge } from './ui/Badge';
import type { CategoryFilter, LibrarySegment } from '../types';

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

export function BlueprintExplorer() {
  const {
    activeBlueprint,
    setActiveBlueprint,
    categoryFilter,
    setCategoryFilter,
    searchQuery,
    setSearchQuery,
    librarySegment,
    setLibrarySegment,
    inventoryIds,
  } = useCraft();
  const { lang, t } = useI18n();
  const searchId = useId();

  return (
    <section className="explorer" aria-label={t('Blueprint filters', 'Filtres blueprints')}>
      {/* Active blueprint indicator */}
      {activeBlueprint && (
        <div className="explorer__active-bp">
          <CategoryBadge category={activeBlueprint.category} iconOnly />
          <span className="explorer__active-bp-name">{activeBlueprint.name}</span>
          <button
            className="explorer__active-bp-close"
            onClick={() => setActiveBlueprint(null)}
            aria-label={t('Back to library', 'Retour à la bibliothèque')}
            title={t('Back to library', 'Retour à la bibliothèque')}
          >
            ✕
          </button>
        </div>
      )}
      {/* Search */}
      <div className="explorer__search">
        <label className="sr-only" htmlFor={searchId}>{t('Search blueprints', 'Rechercher des blueprints')}</label>
        <span className="explorer__search-icon" aria-hidden="true">⌕</span>
        <input
          id={searchId}
          type="search"
          className="explorer__search-input"
          placeholder={t('Search blueprints...', 'Rechercher...')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Segmented control */}
      <nav className="explorer__segments" role="group" aria-label={t('Library filter', 'Filtre bibliotheque')}>
        {SEGMENTS.map((s) => (
          <button
            key={s.value}
            className={['explorer__segment-btn', librarySegment === s.value && 'explorer__segment-btn--active'].filter(Boolean).join(' ')}
            onClick={() => setLibrarySegment(s.value)}
            aria-pressed={librarySegment === s.value}
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
    </section>
  );
}
