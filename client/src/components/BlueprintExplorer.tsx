import { alpha, useTheme } from '@mui/material/styles';
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
  const theme = useTheme();

  // ... (rest of manufacturers and locations logic remains same)

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
    <Box
      component="section"
      aria-label={t('Blueprint filters', 'Filtres blueprints')}
      sx={{
        p: 1.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}
    >
      {/* First row: Search + Segmented Control + Active Item Indicator */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          type="search"
          size="small"
          placeholder={t('Search blueprints...', 'Rechercher...')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start" sx={{ color: 'text.disabled' }}>
                  <SearchIcon sx={{ fontSize: '1.1rem' }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            flex: { xs: '1 1 100%', sm: '1 1 200px' },
            '& .MuiInputBase-root': { fontSize: '.8rem', height: 32 },
          }}
        />

        <ToggleButtonGroup
          value={librarySegment}
          exclusive
          onChange={(_e, val) => {
            if (val) setLibrarySegment(val as LibrarySegment);
          }}
          size="small"
          aria-label={t('Library filter', 'Filtre bibliotheque')}
          sx={{ height: 32, '& .MuiToggleButton-root': { fontSize: '.65rem', px: 1.5 } }}
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

        {activeBlueprint && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1,
              height: 32,
              backgroundColor: 'background.paper',
              border: (theme) => `1px solid ${theme.palette.primary.main}`,
              borderRadius: 1,
            }}
          >
            <CategoryBadge category={activeBlueprint.category} iconOnly />
            <Typography
              variant="body2"
              sx={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '.75rem' }}
            >
              {activeBlueprint.name}
            </Typography>
            <IconButton
              onClick={() => setActiveBlueprint(null)}
              aria-label={t('Back to library', 'Retour a la bibliotheque')}
              size="small"
              sx={{ p: 0.25 }}
            >
              <CloseIcon sx={{ fontSize: '.9rem' }} />
            </IconButton>
          </Box>
        )}
      </Box>

      {/* Second row: Categories + Advanced Filters Toggle/Indicator */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Box
          component="nav"
          aria-label={t('Category filter', 'Filtre categorie')}
          sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, flex: 1 }}
        >
          {CATEGORY_FILTERS.map(({ value, labelEn, labelFr }) => (
            <Chip
              key={value}
              label={lang === 'en' ? labelEn : labelFr}
              size="small"
              variant={categoryFilter === value ? 'filled' : 'outlined'}
              onClick={() => setCategoryFilter(value)}
              sx={{
                fontSize: '.65rem',
                height: 24,
                ...(categoryFilter === value && {
                  backgroundColor: alpha(theme.palette.primary.main, 0.15),
                  color: 'text.primary',
                  borderColor: 'primary.main',
                }),
              }}
            />
          ))}
        </Box>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, display: { xs: 'none', md: 'block' } }} />

        <Stack direction="row" spacing={1} alignItems="center">
          <Autocomplete
            size="small"
            options={manufacturers}
            value={manufacturerFilter}
            onChange={(_e, val) => setManufacturerFilter(val)}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder={t('Manufacturer', 'Fabricant')}
                sx={{ width: 150, '& .MuiInputBase-root': { fontSize: '.75rem', height: 28 } }}
              />
            )}
            slotProps={{ listbox: { sx: { fontSize: '.75rem' } } }}
          />

          <ToggleButtonGroup
            value={legalityFilter}
            exclusive
            onChange={(_e, val) => {
              if (val) setLegalityFilter(val as LegalityFilter);
            }}
            size="small"
            sx={{ height: 28, '& .MuiToggleButton-root': { fontSize: '.6rem', px: 1 } }}
          >
            <ToggleButton value="all">{t('All', 'Tous')}</ToggleButton>
            <ToggleButton value="lawful">{t('Lawful', 'Legal')}</ToggleButton>
            <ToggleButton value="unlawful">{t('Unlawful', 'Illegal')}</ToggleButton>
          </ToggleButtonGroup>

          {locations.length > 0 && (
            <Autocomplete
              size="small"
              options={locations}
              value={locationFilter}
              onChange={(_e, val) => setLocationFilter(val)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder={t('Location', 'Lieu')}
                  sx={{ width: 150, '& .MuiInputBase-root': { fontSize: '.75rem', height: 28 } }}
                />
              )}
              slotProps={{ listbox: { sx: { fontSize: '.75rem' } } }}
            />
          )}

          {hasActiveFilters && (
            <IconButton
              size="small"
              onClick={() => {
                setManufacturerFilter(null);
                setLegalityFilter('all');
                setLocationFilter(null);
              }}
              title={t('Clear filters', 'Effacer les filtres')}
            >
              <CloseIcon sx={{ fontSize: '1rem' }} />
            </IconButton>
          )}
        </Stack>
      </Box>
    </Box>
  );
}
