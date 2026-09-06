import { useEffect, useMemo, useState } from 'react';
import { Box, Paper, Typography } from '../../ui/system';
import { AppButton, AppTextField, AppToggleGroup } from '../ui/controls';
import { PageHeader } from '../ui/page';
import { useCraft } from '../../store/CraftContext';
import { loc, useI18n } from '../../i18n/I18nContext';
import { navigateToPath } from '../../utils/slug';
import { shouldHandleInternalLinkClick } from '../../utils/spaLinks';
import { CATEGORY_LABELS } from '../../types';
import { BlueprintThumbnail } from './BlueprintThumbnail';
import { CheckIcon, StarIcon } from '../../ui/icons';
import type { Blueprint, AcquisitionGraphEntry } from '../../types';
import './fabricator-focus.css';

/** Item selection leads; guidance and onward routes stay within reach. */
export function WorkbenchHome({ onSelect, suggestions }: {
  onSelect: (blueprint: Blueprint) => void;
  suggestions: AcquisitionGraphEntry[];
}) {
  const { blueprints, favoriteIds, inventoryIds, activeDataset } = useCraft();
  const { t, lang } = useI18n();
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(24);
  const [scope, setScope] = useState<'all' | 'favorites' | 'inventory'>('all');
  useEffect(() => setVisibleCount(24), [query, scope]);
  const favorites = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const inventory = useMemo(() => new Set(inventoryIds), [inventoryIds]);
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return blueprints.filter((bp) =>
      (scope === 'all' || (scope === 'favorites' ? favorites.has(bp.id) : inventory.has(bp.id))) &&
      (!q || `${bp.name} ${bp.manufacturer} ${bp.category}`.toLocaleLowerCase().includes(q)),
    );
  }, [blueprints, favorites, inventory, query, scope]);
  const modules = [
    { href: '/blueprints', title: t('Blueprints', 'Blueprints', 'Baupläne'), value: blueprints.length,
      description: t('Explore recipes & compare builds', 'Explorer les recettes et comparer les builds', 'Rezepte und Builds vergleichen') },
    { href: '/resources', title: t('Resources', 'Ressources', 'Ressourcen'), value: activeDataset.resources.length,
      description: t('Locate materials & supply sources', 'Localiser les matériaux et leurs sources', 'Materialien und Bezugsquellen finden') },
    { href: '/planner', title: t('Planner', 'Planificateur', 'Planer'), value: null,
      description: t('Prepare your next operation', 'Préparer votre prochaine opération', 'Den nächsten Einsatz vorbereiten') },
  ];
  return (
    <>
      <PageHeader
        title={t('Workbench', 'Atelier', 'Werkstatt')}
        description={t('Choose an item to simulate its quality and prepare its materials.', 'Choisissez un objet pour simuler sa qualité et préparer ses matériaux.', 'Objekt auswählen, Qualität simulieren und Materialien vorbereiten.')}
        actions={
          <nav className="workbench-shortcuts" aria-label={t('Production tools', 'Outils de production', 'Produktionswerkzeuge')}>
            {modules.map((module) => (
              <a key={module.href} href={module.href} title={module.description} onClick={(event) => {
                if (!shouldHandleInternalLinkClick(event)) return;
                event.preventDefault(); navigateToPath(module.href);
              }}>
                {module.value !== null && <strong>{module.value}</strong>}<span>{module.title}</span><span aria-hidden="true">↗</span>
              </a>
            ))}
          </nav>
        }
      />
      <Paper className="workbench-library" sx={{ minWidth: 0, overflow: 'hidden' }}>
        <Box className="workbench-library-toolbar">
          <Box className="workbench-library-heading">
            <Typography component="h2" sx={{ fontSize: '0.875rem', fontWeight: 700 }}>
              {t('Select a blueprint', 'Sélectionner un blueprint', 'Bauplan auswählen')}
            </Typography>
            <span className="workbench-result-count" aria-live="polite">{filtered.length} {t('results', 'résultats', 'Ergebnisse')}</span>
          </Box>
          <Box sx={{ flex: '1 1 260px', minWidth: 0 }}>
          <AppTextField id="workbench-search" type="search" value={query} onValueChange={setQuery}
            ariaLabel={t('Search the blueprint register', 'Rechercher dans le registre', 'Bauplanregister durchsuchen')}
            placeholder={t('Name, manufacturer, category…', 'Nom, fabricant, catégorie…', 'Name, Hersteller, Kategorie…')}
            sx={{ minHeight: 36, px: 1.25, width: '100%' }} />
          </Box>
          <AppToggleGroup value={scope} onValueChange={setScope}
            ariaLabel={t('Blueprint scope', 'Collection de blueprints', 'Bauplansammlung')}
            options={[
              { value: 'all', label: t('All', 'Tous', 'Alle') },
              { value: 'favorites', label: t('Favorites', 'Favoris', 'Favoriten') },
              { value: 'inventory', label: t('Inventory', 'Inventaire', 'Inventar') },
            ]} partSx={{ button: { minHeight: 32, px: 1.25, fontSize: '0.75rem' } }} />
        </Box>
        <div className="workbench-item-grid" role="list" aria-label={t('Blueprint register', 'Registre des blueprints', 'Bauplanregister')}>
          {filtered.slice(0, visibleCount).map((bp) => (
            <div role="listitem" key={bp.id}>
              <button type="button" className="workbench-item-choice" onClick={() => onSelect(bp)}
                aria-label={`${t('Simulate', 'Simuler', 'Simulieren')} ${bp.name}`}>
                <BlueprintThumbnail blueprint={bp} />
                <span className="workbench-item-identity">
                  <strong>{bp.name}</strong>
                  <span>{[bp.manufacturer, loc(CATEGORY_LABELS[bp.category], lang)].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="workbench-item-status">
                  {favorites.has(bp.id) && <span aria-label={t('Favorite', 'Favori', 'Favorit')} title={t('Favorite', 'Favori', 'Favorit')}><StarIcon sx={{ fontSize: 13 }} /></span>}
                  {inventory.has(bp.id) && <span aria-label={t('In inventory', 'En inventaire', 'Im Inventar')} title={t('In inventory', 'En inventaire', 'Im Inventar')}><CheckIcon sx={{ fontSize: 13 }} /></span>}
                  <span className="workbench-item-arrow" aria-hidden="true">↗</span>
                </span>
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="workbench-empty">
              {t('No blueprints in this selection. Try another collection or search.', 'Aucun blueprint dans cette sélection. Changez de collection ou de recherche.', 'Keine Baupläne gefunden. Andere Sammlung oder Suche versuchen.')}
            </div>
          )}
        </div>
        {filtered.length > visibleCount && (
          <Box sx={{ p: 1.25, borderTop: '1px solid', borderColor: 'divider' }}>
            <AppButton size="sm" variant="secondary" onClick={() => setVisibleCount((count) => count + 24)}>
              {t('Show more blueprints', 'Afficher plus de blueprints', 'Weitere Baupläne anzeigen')} ({filtered.length - visibleCount})
            </AppButton>
          </Box>
        )}
      </Paper>
      <div className="workbench-support">
        {suggestions.length > 0 && (
          <details className="workspace-disclosure fabricator-disclosure workbench-suggestions">
            <summary><strong>{t('Easiest confirmed drops', 'Drops confirmés les plus accessibles', 'Leichteste bestätigte Drops')}</strong>
              <span className="fabricator-disclosure-note">{suggestions.length} {t('blueprints', 'blueprints', 'Baupläne')}</span>
            </summary>
            <div className="workbench-item-grid">
              {suggestions.map((entry) => {
                const bp = blueprints.find((item) => item.id === entry.blueprint.id);
                return bp ? (
                  <button key={bp.id} type="button" className="workbench-item-choice" onClick={() => onSelect(bp)}>
                    <BlueprintThumbnail blueprint={bp} /><span className="workbench-item-identity"><strong>{bp.name}</strong><span>{bp.manufacturer}</span></span><span aria-hidden="true">↗</span>
                  </button>
                ) : null;
              })}
            </div>
          </details>
        )}
        <AppButton variant="ghost" size="sm" onClick={() => navigateToPath('/missions')} sx={{ justifySelf: 'start' }}>{t('Explore missions', 'Explorer les missions', 'Missionen erkunden')} ↗</AppButton>
        <details className="workspace-disclosure fabricator-disclosure workbench-guide">
          <summary><strong>{t('Production sequence', 'Séquence de production', 'Produktionsablauf')}</strong><span className="fabricator-disclosure-note">{t('Quality → acquisition → plan', 'Qualité → acquisition → plan', 'Qualität → Beschaffung → Plan')}</span></summary>
          <ol className="workbench-sequence">
            {[
              [t('Configure', 'Configurer', 'Konfigurieren'), t('Set material quality and inspect projected stats.', 'Réglez la qualité des matériaux et inspectez les statistiques projetées.', 'Materialqualität einstellen und Werte prüfen.')],
              [t('Acquire', 'Acquérir', 'Beschaffen'), t('Compare contracts, reputation and material sources.', 'Comparez les contrats, la réputation et les sources de matériaux.', 'Aufträge, Ruf und Materialquellen vergleichen.')],
              [t('Plan', 'Planifier', 'Planen'), t('Save your build and prepare your collection checklist.', 'Enregistrez votre build et préparez votre liste de collecte.', 'Build speichern und Sammelliste vorbereiten.')],
            ].map(([title, description]) => <li key={title}><strong>{title}</strong><span>{description}</span></li>)}
          </ol>
        </details>
      </div>
    </>
  );
}
