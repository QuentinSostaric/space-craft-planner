import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { CategoryBadge } from './ui/Badge';
import { tokens } from '../theme';
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

  return (
    <Box
      component="section"
      aria-label={t('Blueprint filters', 'Filtres blueprints')}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 1.5 }}
    >
      {/* Active blueprint indicator */}
      {activeBlueprint && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 0.5,
            backgroundColor: tokens.surface1,
            border: `1px solid ${tokens.violet}`,
            flexShrink: 0,
          }}
        >
          <CategoryBadge category={activeBlueprint.category} iconOnly />
          <Typography
            variant="body2"
            sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '.78rem' }}
          >
            {activeBlueprint.name}
          </Typography>
          <IconButton
            onClick={() => setActiveBlueprint(null)}
            aria-label={t('Back to library', 'Retour à la bibliothèque')}
            title={t('Back to library', 'Retour à la bibliothèque')}
            size="small"
            sx={{ fontSize: '.7rem', p: 0.5 }}
          >
            ✕
          </IconButton>
        </Box>
      )}

      {/* Search */}
      <TextField
        type="search"
        placeholder={t('Search blueprints...', 'Rechercher...')}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        label={t('Search blueprints', 'Rechercher des blueprints')}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start" sx={{ color: 'text.disabled' }}>
                ⌕
              </InputAdornment>
            ),
          },
          inputLabel: { shrink: true },
        }}
        fullWidth
        sx={{
          '& .MuiInputBase-root': { fontSize: '.82rem' },
          '& .MuiInputLabel-root': { fontSize: '.75rem' },
        }}
      />

      {/* Segmented control */}
      <ToggleButtonGroup
        value={librarySegment}
        exclusive
        onChange={(_e, val) => {
          if (val) setLibrarySegment(val as LibrarySegment);
        }}
        size="small"
        aria-label={t('Library filter', 'Filtre bibliotheque')}
        sx={{ display: 'flex', '& .MuiToggleButton-root': { flex: 1, fontSize: '.62rem', px: 0.5 } }}
      >
        {SEGMENTS.map((s) => (
          <ToggleButton key={s.value} value={s.value}>
            {lang === 'en' ? s.labelEn : s.labelFr}
            {s.value === 'inventory' && inventoryIds.length > 0 && (
              <Box component="span" sx={{ ml: 0.5, fontSize: '.55rem', opacity: 0.7 }}>
                {inventoryIds.length}
              </Box>
            )}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {/* Category filter chips */}
      <Box
        component="nav"
        aria-label={t('Category filter', 'Filtre categorie')}
        sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}
      >
        {CATEGORY_FILTERS.map(({ value, labelEn, labelFr }) => (
          <Chip
            key={value}
            label={lang === 'en' ? labelEn : labelFr}
            size="small"
            variant={categoryFilter === value ? 'filled' : 'outlined'}
            onClick={() => setCategoryFilter(value)}
            aria-pressed={categoryFilter === value}
            sx={{
              ...(categoryFilter === value && {
                backgroundColor: 'rgba(139, 92, 246, 0.15)',
                color: 'text.primary',
                borderColor: tokens.violet,
              }),
            }}
          />
        ))}
      </Box>
    </Box>
  );
}
