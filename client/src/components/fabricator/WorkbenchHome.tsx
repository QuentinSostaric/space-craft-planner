import { useEffect, useMemo, useState } from 'react';
import { Box, Paper, Typography } from '../../ui/system';
import { AppButton, AppTextField, AppToggleGroup } from '../ui/controls';
import { PageHeader } from '../ui/page';
import { useCraft } from '../../store/CraftContext';
import { loc, useI18n } from '../../i18n/I18nContext';
import { FONT_MONO } from '../../theme';
import { navigateToPath } from '../../utils/slug';
import { shouldHandleInternalLinkClick } from '../../utils/spaLinks';
import { CATEGORY_LABELS } from '../../types';
import type { Blueprint, AcquisitionGraphEntry } from '../../types';

/** The start of a craft: personal library, live data and clear onward routes. */
export function WorkbenchHome({
  onSelect,
  suggestions,
}: {
  onSelect: (blueprint: Blueprint) => void;
  suggestions: AcquisitionGraphEntry[];
}) {
  const { blueprints, favoriteIds, inventoryIds, plannerTodoItems, activeDataset } = useCraft();
  const { t, lang } = useI18n();
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(80);
  const [scope, setScope] = useState<'all' | 'favorites' | 'inventory'>('all');
  useEffect(() => setVisibleCount(80), [query, scope]);
  const favorites = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const inventory = useMemo(() => new Set(inventoryIds), [inventoryIds]);
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return blueprints.filter(
      (bp) =>
        (scope === 'all' ||
          (scope === 'favorites' ? favorites.has(bp.id) : inventory.has(bp.id))) &&
        (!q || `${bp.name} ${bp.manufacturer} ${bp.category}`.toLocaleLowerCase().includes(q)),
    );
  }, [blueprints, favorites, inventory, query, scope]);
  const openTasks = plannerTodoItems.filter((task) => !task.completed).length;
  const modules = [
    {
      href: '/blueprints',
      number: '01',
      title: t('Blueprints', 'Blueprints', 'Baupläne'),
      value: blueprints.length,
      description: t(
        'Explore recipes & compare builds',
        'Explorer les recettes et comparer les builds',
        'Rezepte und Builds vergleichen',
      ),
    },
    {
      href: '/resources',
      number: '02',
      title: t('Resources', 'Ressources', 'Ressourcen'),
      value: activeDataset.resources.length,
      description: t(
        'Locate materials & supply sources',
        'Localiser les matériaux et leurs sources',
        'Materialien und Bezugsquellen finden',
      ),
    },
    {
      href: '/planner',
      number: '03',
      title: t('Open tasks', 'Tâches ouvertes', 'Offene Aufgaben'),
      value: openTasks,
      description: t(
        'Prepare your next operation',
        'Préparer votre prochaine opération',
        'Den nächsten Einsatz vorbereiten',
      ),
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow={t('Production workspace', 'Poste de production', 'Produktionsarbeitsplatz')}
        title={t(
          'Your next craft starts here.',
          'Votre prochain craft commence ici.',
          'Hier beginnt dein nächster Craft.',
        )}
        description={t(
          'Select a blueprint. Tune quality, find materials and prepare your acquisition route.',
          'Sélectionnez un blueprint. Réglez la qualité, trouvez les matériaux et préparez votre parcours d’acquisition.',
          'Bauplan auswählen, Qualität einstellen, Materialien finden und Beschaffung planen.',
        )}
        actions={
          <AppButton
            variant="secondary"
            size="sm"
            onClick={() => document.getElementById('workbench-search')?.focus()}
          >
            {t('Select a blueprint', 'Sélectionner un blueprint', 'Bauplan auswählen')} ↗
          </AppButton>
        }
      />
      <Box
        className="workbench-modules"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
          gap: 1,
        }}
      >
        {modules.map((module) => (
          <Paper
            key={module.href}
            component="a"
            href={module.href}
            onClick={(event) => {
              if (!shouldHandleInternalLinkClick(event)) return;
              event.preventDefault();
              navigateToPath(module.href);
            }}
            sx={{
              p: 1.5,
              color: 'text.primary',
              textDecoration: 'none',
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 0.5,
              '&:hover': { borderColor: 'primary.main', backgroundColor: 'ui.surface2' },
            }}
          >
            <Typography
              sx={{ fontFamily: FONT_MONO, fontSize: '0.6875rem', color: 'text.secondary' }}
            >
              {module.number} / {module.title}
            </Typography>
            <Typography
              sx={{
                fontFamily: FONT_MONO,
                fontWeight: 700,
                fontSize: '1.25rem',
                gridRow: 'span 2',
              }}
            >
              {module.value}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
              {module.description} ↗
            </Typography>
          </Paper>
        ))}
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 300px' },
          gap: 'var(--workspace-gap)',
          alignItems: 'start',
        }}
      >
        <Paper sx={{ minWidth: 0, overflow: 'hidden' }}>
          <Box
            sx={{
              p: 1.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1.5,
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography component="h2" sx={{ fontSize: '0.875rem', fontWeight: 700 }}>
              {t('Blueprint register', 'Registre des blueprints', 'Bauplanregister')}
            </Typography>
            <AppToggleGroup
              value={scope}
              onValueChange={setScope}
              ariaLabel={t('Blueprint scope', 'Collection de blueprints', 'Bauplansammlung')}
              options={[
                { value: 'all', label: t('All', 'Tous', 'Alle') },
                { value: 'favorites', label: t('Favorites', 'Favoris', 'Favoriten') },
                { value: 'inventory', label: t('Inventory', 'Inventaire', 'Inventar') },
              ]}
              partSx={{ button: { minHeight: 32, px: 1.25, fontSize: '0.75rem' } }}
            />
          </Box>
          <Box sx={{ p: 1.5 }}>
            <AppTextField
              id="workbench-search"
              type="search"
              sx={{ minHeight: 36, px: 1.25, width: '100%' }}
              value={query}
              onValueChange={setQuery}
              ariaLabel={t(
                'Search the blueprint register',
                'Rechercher dans le registre',
                'Bauplanregister durchsuchen',
              )}
              placeholder={t(
                'Name, manufacturer, category…',
                'Nom, fabricant, catégorie…',
                'Name, Hersteller, Kategorie…',
              )}
            />
          </Box>
          <Box sx={{ px: 1.5, pb: 1, display: 'flex', justifyContent: 'space-between', gap: 1 }}>
            <Typography
              aria-live="polite"
              sx={{ fontFamily: FONT_MONO, fontSize: '0.6875rem', color: 'text.secondary' }}
            >
              {filtered.length} {t('results', 'résultats', 'Ergebnisse')}
            </Typography>
            <Typography sx={{ fontSize: '0.6875rem', color: 'text.disabled' }}>
              {t('Select to simulate', 'Sélectionner pour simuler', 'Zur Simulation auswählen')}
            </Typography>
          </Box>
          <Box className="workbench-register" sx={{ maxHeight: 520, overflowY: 'auto' }}>
            {filtered.slice(0, visibleCount).map((bp) => (
              <Box
                key={bp.id}
                component="button"
                type="button"
                onClick={() => onSelect(bp)}
                className="workbench-register-row"
                sx={{
                  width: '100%',
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  gap: 1,
                  p: 1.5,
                  textAlign: 'left',
                  color: 'text.primary',
                  backgroundColor: 'transparent',
                  border: 0,
                  borderTop: '1px solid',
                  borderColor: 'divider',
                  cursor: 'pointer',
                  font: 'inherit',
                  '&:hover': { backgroundColor: 'ui.surface2' },
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    sx={{ fontSize: '0.8125rem', fontWeight: 600, overflowWrap: 'anywhere' }}
                  >
                    {bp.name}
                  </Typography>
                  <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
                    {[bp.manufacturer, loc(CATEGORY_LABELS[bp.category], lang)]
                      .filter(Boolean)
                      .join(' / ')}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    fontFamily: FONT_MONO,
                    fontSize: '0.6875rem',
                    color: 'primary.main',
                  }}
                >
                  {favorites.has(bp.id) && (
                    <span aria-label={t('Favorite', 'Favori', 'Favorit')}>★</span>
                  )}
                  {inventory.has(bp.id) && (
                    <span aria-label={t('In inventory', 'En inventaire', 'Im Inventar')}>✓</span>
                  )}
                  <span aria-hidden="true">↗</span>
                </Box>
              </Box>
            ))}
            {filtered.length === 0 && (
              <Box sx={{ p: 3, color: 'text.secondary' }}>
                {t(
                  'No blueprints in this selection. Try another collection or search.',
                  'Aucun blueprint dans cette sélection. Changez de collection ou de recherche.',
                  'Keine Baupläne gefunden. Andere Sammlung oder Suche versuchen.',
                )}
              </Box>
            )}
          </Box>
          {filtered.length > visibleCount && (
            <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
              <AppButton
                size="sm"
                variant="secondary"
                onClick={() => setVisibleCount((count) => count + 80)}
              >
                {t(
                  'Show more blueprints',
                  'Afficher plus de blueprints',
                  'Weitere Baupläne anzeigen',
                )}{' '}
                ({filtered.length - visibleCount}) ↗
              </AppButton>
            </Box>
          )}
        </Paper>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Paper sx={{ p: 2, borderTop: '2px solid', borderColor: 'brand.accentBorder' }}>
            <Typography component="h2" sx={{ fontSize: '0.875rem', fontWeight: 700, mb: 2 }}>
              {t('Production sequence', 'Séquence de production', 'Produktionsablauf')}
            </Typography>
            {[
              [
                t('Configure', 'Configurer', 'Konfigurieren'),
                t(
                  'Set material quality and inspect projected stats.',
                  'Réglez la qualité des matériaux et inspectez les statistiques projetées.',
                  'Materialqualität einstellen und Werte prüfen.',
                ),
              ],
              [
                t('Acquire', 'Acquérir', 'Beschaffen'),
                t(
                  'Compare contracts, reputation and material sources.',
                  'Comparez les contrats, la réputation et les sources de matériaux.',
                  'Aufträge, Ruf und Materialquellen vergleichen.',
                ),
              ],
              [
                t('Plan', 'Planifier', 'Planen'),
                t(
                  'Save your build and prepare your collection checklist.',
                  'Enregistrez votre build et préparez votre liste de collecte.',
                  'Build speichern und Sammelliste vorbereiten.',
                ),
              ],
            ].map(([title, description], index) => (
              <Box key={title} sx={{ display: 'flex', gap: 1.5, mb: index < 2 ? 2 : 0 }}>
                <Typography
                  sx={{ fontFamily: FONT_MONO, color: 'primary.main', fontSize: '0.6875rem' }}
                >
                  0{index + 1}
                </Typography>
                <Box>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.8125rem' }}>{title}</Typography>
                  <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem', mt: 0.25 }}>
                    {description}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Paper>
          {suggestions.length > 0 && (
            <Paper sx={{ p: 1.5 }}>
              <Typography component="h2" sx={{ fontWeight: 700, fontSize: '0.8125rem', mb: 1 }}>
                {t(
                  'Easiest confirmed drops',
                  'Drops confirmés les plus accessibles',
                  'Leichteste bestätigte Drops',
                )}
              </Typography>
              {suggestions.map((entry) => {
                const bp = blueprints.find((item) => item.id === entry.blueprint.id);
                return bp ? (
                  <AppButton
                    key={bp.id}
                    variant="ghost"
                    size="sm"
                    onClick={() => onSelect(bp)}
                    sx={{
                      width: '100%',
                      justifyContent: 'space-between',
                      textAlign: 'left',
                      my: 0.25,
                    }}
                  >
                    {bp.name} ↗
                  </AppButton>
                ) : null;
              })}
            </Paper>
          )}
          <AppButton variant="secondary" onClick={() => navigateToPath('/missions')}>
            {t('Explore missions', 'Explorer les missions', 'Missionen erkunden')} ↗
          </AppButton>
        </Box>
      </Box>
    </>
  );
}
