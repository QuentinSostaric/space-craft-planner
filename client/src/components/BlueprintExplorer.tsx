import { useCraft, useFilteredBlueprints } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { CategoryBadge } from './ui/Badge';
import type { Blueprint, CategoryFilter } from '../types';

const FILTER_ENTRIES: { value: CategoryFilter; labelEn: string; labelFr: string }[] = [
  { value: 'all',           labelEn: 'All',          labelFr: 'Tous' },
  { value: 'favorites',     labelEn: '★ Favorites',  labelFr: '★ Favoris' },
  { value: 'fps-weapon',    labelEn: 'FPS Weapons',  labelFr: 'Armes FPS' },
  { value: 'fps-armor',     labelEn: 'FPS Armor',    labelFr: 'Armures FPS' },
  { value: 'fps-helmet',    labelEn: 'Helmets',      labelFr: 'Casques' },
  { value: 'fps-undersuit', labelEn: 'Undersuits',   labelFr: 'Combinaisons' },
  { value: 'fps-backpack',  labelEn: 'Backpacks',    labelFr: 'Sacs à dos' },
  { value: 'fps-magazine',  labelEn: 'Magazines',    labelFr: 'Chargeurs' },
];

function BlueprintCard({ blueprint, isActive, isFavorite, onClick, onToggleFavorite }: {
  blueprint: Blueprint;
  isActive: boolean;
  isFavorite: boolean;
  onClick: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
}) {
  const { t } = useI18n();

  return (
    <article
      className={['bp-card', isActive && 'bp-card--active'].filter(Boolean).join(' ')}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      aria-label={`Blueprint: ${blueprint.name} — ${blueprint.manufacturer}`}
    >
      <div className="bp-card__header">
        <div className="bp-card__badges">
          <CategoryBadge category={blueprint.category} iconOnly />
        </div>
        <div className="bp-card__header-right">
          <span className="bp-card__slots">
            {blueprint.slots.length} slot{blueprint.slots.length !== 1 ? 's' : ''}
          </span>
          <button
            className={['bp-card__fav', isFavorite && 'bp-card__fav--active'].filter(Boolean).join(' ')}
            onClick={onToggleFavorite}
            aria-label={isFavorite
              ? t(`Remove ${blueprint.name} from favorites`, `Retirer ${blueprint.name} des favoris`)
              : t(`Add ${blueprint.name} to favorites`, `Ajouter ${blueprint.name} aux favoris`)}
            aria-pressed={isFavorite}
          >
            {isFavorite ? '★' : '☆'}
          </button>
        </div>
      </div>

      <h3 className="bp-card__name">{blueprint.name}</h3>
      <p className="bp-card__manufacturer">{blueprint.manufacturer}</p>

      {isActive && (
        <div className="bp-card__active-indicator" aria-hidden="true">
          <span>{t('Selected', 'Sélectionné')}</span>
          <span>→</span>
        </div>
      )}
    </article>
  );
}

export function BlueprintExplorer() {
  const {
    activeBlueprint, setActiveBlueprint,
    categoryFilter, setCategoryFilter,
    searchQuery, setSearchQuery,
    favoriteIds, toggleFavorite,
  } = useCraft();
  const { lang, t } = useI18n();
  const blueprints = useFilteredBlueprints();

  return (
    <section className="explorer" aria-label={t('Blueprint explorer', 'Explorateur de blueprints')}>
      {/* Search */}
      <div className="explorer__search">
        <label htmlFor="bp-search" className="sr-only">
          {t('Search blueprints', 'Rechercher un blueprint')}
        </label>
        <span className="explorer__search-icon" aria-hidden="true">⌕</span>
        <input
          id="bp-search"
          type="search"
          className="explorer__search-input"
          placeholder={t('Search…', 'Rechercher…')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Filters */}
      <nav className="explorer__filters" aria-label={t('Filters', 'Filtres')}>
        {FILTER_ENTRIES.map(({ value, labelEn, labelFr }) => (
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

      {/* Blueprint list */}
      <div className="explorer__list" role="list" aria-label={t('Blueprint list', 'Liste des blueprints')}>
        {blueprints.length === 0 ? (
          <p className="explorer__empty" role="status">
            {categoryFilter === 'favorites'
              ? t('No favorites yet. Star a blueprint to save it here.', 'Aucun favori. Étoilez un blueprint pour le sauvegarder ici.')
              : t('No blueprints found.', 'Aucun blueprint trouvé.')}
          </p>
        ) : (
          blueprints.map((bp) => (
            <div key={bp.id} role="listitem">
              <BlueprintCard
                blueprint={bp}
                isActive={activeBlueprint?.id === bp.id}
                isFavorite={favoriteIds.includes(bp.id)}
                onClick={() => setActiveBlueprint(activeBlueprint?.id === bp.id ? null : bp)}
                onToggleFavorite={(e) => { e.stopPropagation(); toggleFavorite(bp.id); }}
              />
            </div>
          ))
        )}
      </div>
    </section>
  );
}
