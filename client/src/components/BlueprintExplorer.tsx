import { useMemo } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import StarIcon from '@mui/icons-material/Star';
import FlagIcon from '@mui/icons-material/Flag';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { CategoryBadge } from './ui/Badge';
import { tokens } from '../theme';
import type { CategoryFilter, LegalityFilter, LibrarySegment } from '../types';

const CATEGORY_FILTERS: { value: CategoryFilter; labelEn: string; labelFr: string }[] = [
  { value: 'all', labelEn: 'All', labelFr: 'Tous' },
  { value: 'fps-weapon', labelEn: 'Weapons', labelFr: 'Armes' },
  { value: 'fps-armor', labelEn: 'Armor', labelFr: 'Armures' },
  { value: 'fps-helmet', labelEn: 'Helmets', labelFr: 'Casques' },
  { value: 'fps-undersuit', labelEn: 'Undersuits', labelFr: 'Combis' },
  { value: 'fps-backpack', labelEn: 'Backpacks', labelFr: 'Sacs' },
  { value: 'fps-magazine', labelEn: 'Magazines', labelFr: 'Chargeurs' },
];

const SEGMENTS: { value: LibrarySegment; labelEn: string; labelFr: string; icon: any }[] = [
  { value: 'all', labelEn: 'All', labelFr: 'Tous', icon: null },
  { value: 'inventory', labelEn: 'Inventory', labelFr: 'Inventaire', icon: null },
  { value: 'favorites', labelEn: 'Favs', labelFr: 'Favoris', icon: StarIcon },
  { value: 'obtainable', labelEn: 'Obtainable', labelFr: 'Obtenables', icon: FlagIcon },
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
    manufacturerFilter,
    setManufacturerFilter,
    legalityFilter,
    setLegalityFilter,
    locationFilter,
    setLocationFilter,
    inventoryIds,
    blueprints,
    missionRewards,
  } = useCraft();
  const { lang, t } = useI18n();

  // Derive unique manufacturers from loaded blueprints
  const manufacturers = useMemo(() => {
    const set = new Set<string>();
    for (const bp of blueprints) {
      if (bp.manufacturer) set.add(bp.manufacturer);
    }
    return [...set].sort();
  }, [blueprints]);

  // Derive unique locations from mission rewards
  const locations = useMemo(() => {
    if (!missionRewards) return [];
    const set = new Set<string>();
    for (const group of missionRewards.factionGroups) {
      for (const contract of group.contracts) {
        for (const loc of contract.availability.localities) set.add(loc);
        for (const loc of contract.availability.explicitLocations) set.add(loc);
      }
    }
    return [...set].sort();
  }, [missionRewards]);

  const hasActiveFilters =
    manufacturerFilter !== null ||
    legalityFilter !== 'all' ||
    locationFilter !== null;

  return (
    <Stack
      component="section"
      aria-label={t('Blueprint filters', 'Filtres blueprints')}
      spacing={1.5}
      sx={{ p: 1.5, overflow: 'auto', flex: 1 }}
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
            aria-label={t('Back to library', 'Retour a la bibliotheque')}
            title={t('Back to library', 'Retour a la bibliotheque')}
            size="small"
            sx={{ fontSize: '.7rem', p: 0.5 }}
          >
            <CloseIcon sx={{ fontSize: '1rem' }} />
          </IconButton>
        </Box>
      )}

      {/* Search */}
      <TextField
        type="search"
        size="small"
        placeholder={t('Search blueprints...', 'Rechercher...')}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        label={t('Search', 'Recherche')}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start" sx={{ color: 'text.disabled' }}>
                <SearchIcon sx={{ fontSize: '1.1rem' }} />
              </InputAdornment>
            ),
          },
          inputLabel: { shrink: true },
        }}
        fullWidth
        sx={{
          '& .MuiInputBase-root': { fontSize: '.8rem' },
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
        sx={{ display: 'flex', '& .MuiToggleButton-root': { flex: 1, fontSize: '.6rem', px: 0.5, py: 0.5 } }}
      >
        {SEGMENTS.map((s) => (
          <ToggleButton key={s.value} value={s.value}>
            {s.icon && <s.icon sx={{ fontSize: '.8rem', mr: 0.5 }} />}
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
              fontSize: '.65rem',
              height: 24,
              ...(categoryFilter === value && {
                backgroundColor: 'rgba(139, 92, 246, 0.15)',
                color: 'text.primary',
                borderColor: tokens.violet,
              }),
            }}
          />
        ))}
      </Box>

      <Divider />

      {/* Advanced filters section */}
      <Typography
        variant="overline"
        sx={{ fontSize: '.6rem', color: 'text.secondary', letterSpacing: '.1em', lineHeight: 1 }}
      >
        {t('Filters', 'Filtres')}
        {hasActiveFilters && (
          <Chip
            label={t('Clear', 'Effacer')}
            size="small"
            variant="outlined"
            onClick={() => {
              setManufacturerFilter(null);
              setLegalityFilter('all');
              setLocationFilter(null);
            }}
            sx={{ ml: 1, fontSize: '.55rem', height: 18 }}
          />
        )}
      </Typography>

      {/* Manufacturer filter */}
      <Autocomplete
        size="small"
        options={manufacturers}
        value={manufacturerFilter}
        onChange={(_e, val) => setManufacturerFilter(val)}
        renderInput={(params) => (
          <TextField
            {...params}
            label={t('Manufacturer', 'Fabricant')}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{
              '& .MuiInputBase-root': { fontSize: '.78rem' },
              '& .MuiInputLabel-root': { fontSize: '.72rem' },
            }}
          />
        )}
        slotProps={{
          listbox: { sx: { fontSize: '.78rem' } },
          clearIndicator: { sx: { fontSize: '.7rem' } },
        }}
        clearOnEscape
      />

      {/* Legality filter */}
      <Box>
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', fontSize: '.62rem', mb: 0.5, display: 'block' }}
        >
          {t('Faction legality', 'Legalite faction')}
        </Typography>
        <ToggleButtonGroup
          value={legalityFilter}
          exclusive
          onChange={(_e, val) => {
            if (val) setLegalityFilter(val as LegalityFilter);
          }}
          size="small"
          aria-label={t('Legality filter', 'Filtre legalite')}
          sx={{ display: 'flex', '& .MuiToggleButton-root': { flex: 1, fontSize: '.6rem', px: 0.5, py: 0.4 } }}
        >
          <ToggleButton value="all">{t('All', 'Tous')}</ToggleButton>
          <ToggleButton value="lawful" sx={{ '&.Mui-selected': { color: tokens.success } }}>
            {t('Lawful', 'Legal')}
          </ToggleButton>
          <ToggleButton value="unlawful" sx={{ '&.Mui-selected': { color: tokens.danger } }}>
            {t('Unlawful', 'Illegal')}
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Location filter */}
      {locations.length > 0 && (
        <Autocomplete
          size="small"
          options={locations}
          value={locationFilter}
          onChange={(_e, val) => setLocationFilter(val)}
          renderInput={(params) => (
            <TextField
              {...params}
              label={t('Obtainable at', 'Obtenable a')}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{
                '& .MuiInputBase-root': { fontSize: '.78rem' },
                '& .MuiInputLabel-root': { fontSize: '.72rem' },
              }}
            />
          )}
          slotProps={{
            listbox: { sx: { fontSize: '.78rem' } },
            clearIndicator: { sx: { fontSize: '.7rem' } },
          }}
          clearOnEscape
        />
      )}
    </Stack>
  );
}
