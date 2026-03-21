import { alpha, useTheme } from '@mui/material/styles';
import { useMemo } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import StarIcon from '@mui/icons-material/Star';
import FlagIcon from '@mui/icons-material/Flag';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { CategoryBadge } from './ui/Badge';
import type {
  BlueprintSort,
  CategoryFilter,
  CraftTimeBucket,
  LegalityFilter,
  LibrarySegment,
  RarityFilter,
  SlotCountFilter,
  StandingBucket,
} from '../types';

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

const SORT_OPTIONS: { value: BlueprintSort; labelEn: string; labelFr: string }[] = [
  { value: 'name-asc', labelEn: 'Name', labelFr: 'Nom' },
  { value: 'manufacturer-asc', labelEn: 'Manufacturer', labelFr: 'Fabricant' },
  { value: 'craft-time-asc', labelEn: 'Craft time: fast', labelFr: 'Craft: rapide' },
  { value: 'craft-time-desc', labelEn: 'Craft time: long', labelFr: 'Craft: long' },
  { value: 'slot-count-desc', labelEn: 'Slot count', labelFr: 'Nombre de slots' },
  { value: 'rarity-desc', labelEn: 'Rarity', labelFr: 'Rareté' },
  { value: 'acquisition-desc', labelEn: 'Acquisition ease', labelFr: 'Facilité d’obtention' },
  { value: 'damage-desc', labelEn: 'Damage', labelFr: 'Dégâts' },
  { value: 'range-desc', labelEn: 'Range', labelFr: 'Portée' },
  { value: 'rate-of-fire-desc', labelEn: 'Rate of fire', labelFr: 'Cadence' },
  { value: 'magazine-desc', labelEn: 'Magazine', labelFr: 'Chargeur' },
  { value: 'kinetic-desc', labelEn: 'Kinetic resist.', labelFr: 'Résist. cinétique' },
  { value: 'energy-desc', labelEn: 'Energy resist.', labelFr: 'Résist. énergie' },
  { value: 'temp-max-desc', labelEn: 'Temp max', labelFr: 'Temp max' },
];

const RARITY_OPTIONS: { value: RarityFilter; labelEn: string; labelFr: string }[] = [
  { value: 'all', labelEn: 'Any rarity', labelFr: 'Toute rareté' },
  { value: 'legendary', labelEn: 'Legendary', labelFr: 'Légendaire' },
  { value: 'rare', labelEn: 'Rare', labelFr: 'Rare' },
  { value: 'common', labelEn: 'Common', labelFr: 'Commune' },
  { value: 'unknown', labelEn: 'Unknown', labelFr: 'Inconnue' },
];

const SLOT_COUNT_OPTIONS: { value: SlotCountFilter; labelEn: string; labelFr: string }[] = [
  { value: 'all', labelEn: 'Any slots', labelFr: 'Tous les slots' },
  { value: '1', labelEn: '1 slot', labelFr: '1 slot' },
  { value: '2', labelEn: '2 slots', labelFr: '2 slots' },
  { value: '3', labelEn: '3 slots', labelFr: '3 slots' },
];

const CRAFT_TIME_OPTIONS: { value: CraftTimeBucket; labelEn: string; labelFr: string }[] = [
  { value: 'all', labelEn: 'Any duration', labelFr: 'Toute durée' },
  { value: '<=60', labelEn: '≤ 1 min', labelFr: '≤ 1 min' },
  { value: '61-120', labelEn: '1-2 min', labelFr: '1-2 min' },
  { value: '121-180', labelEn: '2-3 min', labelFr: '2-3 min' },
  { value: '180+', labelEn: '3+ min', labelFr: '3+ min' },
];

const STANDING_OPTIONS: { value: StandingBucket; labelEn: string; labelFr: string }[] = [
  { value: 'all', labelEn: 'Any standing', labelFr: 'Toute réputation' },
  { value: 'none', labelEn: 'No standing gate', labelFr: 'Sans prérequis' },
  { value: '1-999', labelEn: '1-999', labelFr: '1-999' },
  { value: '1000-4999', labelEn: '1k-4.9k', labelFr: '1k-4,9k' },
  { value: '5000-14999', labelEn: '5k-14.9k', labelFr: '5k-14,9k' },
  { value: '15000+', labelEn: '15k+', labelFr: '15k+' },
];

function getStandingLabel(value: StandingBucket, lang: 'en' | 'fr'): string {
  const option = STANDING_OPTIONS.find((entry) => entry.value === value);
  return option ? (lang === 'fr' ? option.labelFr : option.labelEn) : value;
}

function getActiveCount(flags: boolean[]): number {
  return flags.filter(Boolean).length;
}

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
    materialFilter,
    setMaterialFilter,
    rarityFilter,
    setRarityFilter,
    slotCountFilter,
    setSlotCountFilter,
    craftTimeFilter,
    setCraftTimeFilter,
    weaponTypeFilter,
    setWeaponTypeFilter,
    ammoTypeFilter,
    setAmmoTypeFilter,
    ammoFlavorFilter,
    setAmmoFlavorFilter,
    armorTypeFilter,
    setArmorTypeFilter,
    armorSlotFilter,
    setArmorSlotFilter,
    acquisitionEmployerFilter,
    setAcquisitionEmployerFilter,
    acquisitionScaleFilter,
    setAcquisitionScaleFilter,
    acquisitionStandingFilter,
    setAcquisitionStandingFilter,
    blueprintSort,
    setBlueprintSort,
    inventoryIds,
    blueprints,
    missionRewards,
  } = useCraft();
  const { lang, t } = useI18n();
  const theme = useTheme();

  const manufacturers = useMemo(() => {
    const set = new Set<string>();
    for (const bp of blueprints) {
      if (bp.manufacturer) set.add(bp.manufacturer);
    }
    return [...set].sort();
  }, [blueprints]);

  const materials = useMemo(() => {
    const set = new Set<string>();
    for (const bp of blueprints) {
      for (const slot of bp.slots) {
        if (slot.requiredResource) {
          set.add(slot.requiredResource);
        }
      }
    }
    return [...set].sort();
  }, [blueprints]);

  const weaponTypes = useMemo(() => {
    const set = new Set<string>();
    for (const bp of blueprints) {
      if (bp.baseStats.weaponType) set.add(bp.baseStats.weaponType);
    }
    return [...set].sort();
  }, [blueprints]);

  const ammoTypes = useMemo(() => {
    const set = new Set<string>();
    for (const bp of blueprints) {
      if (bp.baseStats.ammoType) set.add(bp.baseStats.ammoType);
    }
    return [...set].sort();
  }, [blueprints]);

  const ammoFlavors = useMemo(() => {
    const set = new Set<string>();
    for (const bp of blueprints) {
      if (bp.baseStats.ammoFlavor) set.add(bp.baseStats.ammoFlavor);
    }
    return [...set].sort();
  }, [blueprints]);

  const armorTypes = useMemo(() => {
    const set = new Set<string>();
    for (const bp of blueprints) {
      if (bp.baseStats.armorType) set.add(bp.baseStats.armorType);
    }
    return [...set].sort();
  }, [blueprints]);

  const armorSlots = useMemo(() => {
    const set = new Set<string>();
    for (const bp of blueprints) {
      if (bp.baseStats.armorSlot) set.add(bp.baseStats.armorSlot);
    }
    return [...set].sort();
  }, [blueprints]);

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

  const acquisitionEmployers = useMemo(() => {
    if (!missionRewards) return [];
    const set = new Set<string>();
    for (const entry of missionRewards.blueprintAcquisitionGraph) {
      for (const faction of entry.factions) {
        if (faction.contractorDisplayName) {
          set.add(faction.contractorDisplayName);
        }
      }
    }
    return [...set].sort();
  }, [missionRewards]);

  const acquisitionScales = useMemo(() => {
    if (!missionRewards) return [];
    const set = new Set<string>();
    for (const entry of missionRewards.blueprintAcquisitionGraph) {
      for (const scale of entry.derivedScales) {
        set.add(scale);
      }
    }
    return [...set].sort();
  }, [missionRewards]);

  const hasActiveFilters =
    manufacturerFilter !== null ||
    legalityFilter !== 'all' ||
    locationFilter !== null ||
    materialFilter !== null ||
    rarityFilter !== 'all' ||
    slotCountFilter !== 'all' ||
    craftTimeFilter !== 'all' ||
    weaponTypeFilter !== null ||
    ammoTypeFilter !== null ||
    ammoFlavorFilter !== null ||
    armorTypeFilter !== null ||
    armorSlotFilter !== null ||
    acquisitionEmployerFilter !== null ||
    acquisitionScaleFilter !== null ||
    acquisitionStandingFilter !== 'all';

  const advancedFilterCount = getActiveCount([
    weaponTypeFilter !== null,
    ammoTypeFilter !== null,
    ammoFlavorFilter !== null,
    armorTypeFilter !== null,
    armorSlotFilter !== null,
    rarityFilter !== 'all',
    slotCountFilter !== 'all',
    craftTimeFilter !== 'all',
    acquisitionEmployerFilter !== null,
    acquisitionScaleFilter !== null,
    acquisitionStandingFilter !== 'all',
  ]);

  const clearAllFilters = () => {
    setManufacturerFilter(null);
    setLegalityFilter('all');
    setLocationFilter(null);
    setMaterialFilter(null);
    setRarityFilter('all');
    setSlotCountFilter('all');
    setCraftTimeFilter('all');
    setWeaponTypeFilter(null);
    setAmmoTypeFilter(null);
    setAmmoFlavorFilter(null);
    setArmorTypeFilter(null);
    setArmorSlotFilter(null);
    setAcquisitionEmployerFilter(null);
    setAcquisitionScaleFilter(null);
    setAcquisitionStandingFilter('all');
  };

  return (
    <Box
      component="section"
      aria-label={t('Blueprint filters', 'Filtres blueprints')}
      sx={{
        p: { xs: 1.1, sm: 1.25, md: 1.5 },
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: 'minmax(260px, 1fr) auto minmax(190px, 220px)',
          },
          gap: 1,
          alignItems: 'center',
        }}
      >
        <TextField
          type="search"
          size="small"
          placeholder={t('Search blueprints...', 'Rechercher des blueprints...')}
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
            minWidth: 0,
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
          sx={{
            width: { xs: '100%', sm: 'auto' },
            display: { xs: 'grid', sm: 'inline-flex' },
            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'none' },
            gridAutoRows: { xs: 'minmax(34px, auto)', sm: 'auto' },
            '& .MuiToggleButton-root': {
              fontSize: { xs: '.58rem', sm: '.65rem' },
              px: { xs: 0.75, sm: 1.25 },
              minWidth: 0,
              minHeight: 34,
              lineHeight: 1.1,
              whiteSpace: 'normal',
              textAlign: 'center',
            },
          }}
        >
          {SEGMENTS.map((segment) => (
            <ToggleButton
              key={segment.value}
              value={segment.value}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.5,
              }}
            >
              {segment.icon && <segment.icon sx={{ fontSize: '.72rem', flexShrink: 0 }} />}
              <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {lang === 'en' ? segment.labelEn : segment.labelFr}
              </Box>
              {segment.value === 'inventory' && inventoryIds.length > 0 && (
                <Box component="span" sx={{ fontSize: '.52rem', opacity: 0.7, flexShrink: 0 }}>
                  {inventoryIds.length}
                </Box>
              )}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <FormControl
          size="small"
          sx={{
            minWidth: { xs: '100%', sm: 220 },
            width: '100%',
            '& .MuiInputBase-root': { height: 32, fontSize: '.75rem' },
          }}
        >
          <Select
            value={blueprintSort}
            onChange={(event) => setBlueprintSort(event.target.value as BlueprintSort)}
            displayEmpty
            inputProps={{ 'aria-label': t('Sort blueprints', 'Trier les blueprints') }}
          >
            {SORT_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {lang === 'fr' ? option.labelFr : option.labelEn}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

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
              width: { xs: '100%', md: 'auto' },
              minWidth: 0,
            }}
          >
            <CategoryBadge category={activeBlueprint.category} iconOnly />
            <Typography
              variant="body2"
              sx={{
                maxWidth: 180,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: '.75rem',
              }}
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

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Box
          component="nav"
          aria-label={t('Category filter', 'Filtre categorie')}
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 0.5,
            flex: 1,
            minWidth: 0,
          }}
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
                height: 26,
                maxWidth: { xs: 'calc(50% - 4px)', sm: 'none' },
                '& .MuiChip-label': {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                },
                ...(categoryFilter === value && {
                  backgroundColor: alpha(theme.palette.primary.main, 0.15),
                  color: 'text.primary',
                  borderColor: 'primary.main',
                }),
              }}
            />
          ))}
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: 'repeat(2, minmax(0, 1fr))',
            xl: 'repeat(5, minmax(0, 1fr)) auto',
          },
          gap: 1,
          alignItems: 'center',
        }}
      >
        <Autocomplete
          size="small"
          options={manufacturers}
          value={manufacturerFilter}
          onChange={(_e, val) => setManufacturerFilter(val)}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder={t('Manufacturer', 'Fabricant')}
              sx={{ '& .MuiInputBase-root': { fontSize: '.75rem', height: 32 } }}
            />
          )}
          sx={{ minWidth: 0 }}
          slotProps={{ listbox: { sx: { fontSize: '.75rem' } } }}
        />

        <Autocomplete
          size="small"
          options={materials}
          value={materialFilter}
          onChange={(_e, val) => setMaterialFilter(val)}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder={t('Required material', 'Matériau requis')}
              sx={{ '& .MuiInputBase-root': { fontSize: '.75rem', height: 32 } }}
            />
          )}
          sx={{ minWidth: 0 }}
          slotProps={{ listbox: { sx: { fontSize: '.75rem' } } }}
        />

        <ToggleButtonGroup
          value={legalityFilter}
          exclusive
          onChange={(_e, val) => {
            if (val) setLegalityFilter(val as LegalityFilter);
          }}
          size="small"
          sx={{
            height: 32,
            width: { xs: '100%', md: 'auto' },
            '& .MuiToggleButton-root': {
              fontSize: { xs: '.56rem', md: '.6rem' },
              px: { xs: 0.5, md: 1 },
              flex: { xs: 1, md: '0 0 auto' },
              lineHeight: 1.1,
            },
          }}
        >
          <ToggleButton value="all">{t('All', 'Tous')}</ToggleButton>
          <ToggleButton value="lawful">{t('Lawful', 'Légal')}</ToggleButton>
          <ToggleButton value="unlawful">{t('Unlawful', 'Illégal')}</ToggleButton>
        </ToggleButtonGroup>

        <Autocomplete
          size="small"
          options={locations}
          value={locationFilter}
          onChange={(_e, val) => setLocationFilter(val)}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder={t('Mission location', 'Lieu de mission')}
                sx={{ '& .MuiInputBase-root': { fontSize: '.75rem', height: 32 } }}
              />
            )}
          sx={{ minWidth: 0 }}
          slotProps={{ listbox: { sx: { fontSize: '.75rem' } } }}
        />

        {hasActiveFilters && (
          <Chip
            label={t('Clear filters', 'Effacer les filtres')}
            onDelete={clearAllFilters}
            size="small"
            variant="outlined"
            sx={{
              height: 28,
              fontSize: '.7rem',
              justifySelf: { xs: 'start', xl: 'end' },
              alignSelf: 'center',
            }}
          />
        )}
      </Box>

      <Accordion
        disableGutters
        elevation={0}
        sx={{
          backgroundColor: 'transparent',
          border: (theme) => `1px solid ${theme.palette.divider}`,
          '&::before': { display: 'none' },
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{
            minHeight: 42,
            '& .MuiAccordionSummary-content': {
              my: 0.75,
            },
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {t('Advanced filters', 'Filtres avancés')}
            </Typography>
            {advancedFilterCount > 0 && (
              <Chip
                label={`${advancedFilterCount} ${t('active', 'actifs')}`}
                size="small"
                color="primary"
                variant="outlined"
                sx={{ height: 20, fontSize: '.65rem' }}
              />
            )}
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {t('Weapon, armor, rarity, acquisition', 'Armes, armures, rareté, acquisition')}
            </Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: 1 }}>
            <Autocomplete
              size="small"
              options={weaponTypes}
              value={weaponTypeFilter}
              onChange={(_e, val) => setWeaponTypeFilter(val)}
              renderInput={(params) => <TextField {...params} placeholder={t('Weapon type', 'Type d’arme')} />}
              slotProps={{ listbox: { sx: { fontSize: '.75rem' } } }}
            />
            <Autocomplete
              size="small"
              options={ammoTypes}
              value={ammoTypeFilter}
              onChange={(_e, val) => setAmmoTypeFilter(val)}
              renderInput={(params) => <TextField {...params} placeholder={t('Ammo type', 'Type de munition')} />}
              slotProps={{ listbox: { sx: { fontSize: '.75rem' } } }}
            />
            <Autocomplete
              size="small"
              options={ammoFlavors}
              value={ammoFlavorFilter}
              onChange={(_e, val) => setAmmoFlavorFilter(val)}
              renderInput={(params) => <TextField {...params} placeholder={t('Ammo flavor', 'Famille de munition')} />}
              slotProps={{ listbox: { sx: { fontSize: '.75rem' } } }}
            />
            <Autocomplete
              size="small"
              options={armorTypes}
              value={armorTypeFilter}
              onChange={(_e, val) => setArmorTypeFilter(val)}
              renderInput={(params) => <TextField {...params} placeholder={t('Armor type', 'Type d’armure')} />}
              slotProps={{ listbox: { sx: { fontSize: '.75rem' } } }}
            />
            <Autocomplete
              size="small"
              options={armorSlots}
              value={armorSlotFilter}
              onChange={(_e, val) => setArmorSlotFilter(val)}
              renderInput={(params) => <TextField {...params} placeholder={t('Armor slot', 'Emplacement d’armure')} />}
              slotProps={{ listbox: { sx: { fontSize: '.75rem' } } }}
            />
            <FormControl size="small">
              <Select value={rarityFilter} onChange={(event) => setRarityFilter(event.target.value as RarityFilter)}>
                {RARITY_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {lang === 'fr' ? option.labelFr : option.labelEn}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small">
              <Select value={slotCountFilter} onChange={(event) => setSlotCountFilter(event.target.value as SlotCountFilter)}>
                {SLOT_COUNT_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {lang === 'fr' ? option.labelFr : option.labelEn}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small">
              <Select value={craftTimeFilter} onChange={(event) => setCraftTimeFilter(event.target.value as CraftTimeBucket)}>
                {CRAFT_TIME_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {lang === 'fr' ? option.labelFr : option.labelEn}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Autocomplete
              size="small"
              options={acquisitionEmployers}
              value={acquisitionEmployerFilter}
              onChange={(_e, val) => setAcquisitionEmployerFilter(val)}
              renderInput={(params) => <TextField {...params} placeholder={t('Mission employer', 'Employeur de mission')} />}
              slotProps={{ listbox: { sx: { fontSize: '.75rem' } } }}
            />
            <Autocomplete
              size="small"
              options={acquisitionScales}
              value={acquisitionScaleFilter}
              onChange={(_e, val) => setAcquisitionScaleFilter(val)}
              getOptionLabel={(value) => value}
              renderInput={(params) => <TextField {...params} placeholder={t('Acquisition scale', 'Portée d’acquisition')} />}
              slotProps={{ listbox: { sx: { fontSize: '.75rem' } } }}
            />
            <FormControl size="small">
              <Select
                value={acquisitionStandingFilter}
                onChange={(event) => setAcquisitionStandingFilter(event.target.value as StandingBucket)}
              >
                {STANDING_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {lang === 'fr' ? option.labelFr : option.labelEn}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {(advancedFilterCount > 0 || rarityFilter !== 'all') && (
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1.25 }}>
              {weaponTypeFilter && <Chip label={`${t('Weapon', 'Arme')}: ${weaponTypeFilter}`} size="small" />}
              {ammoTypeFilter && <Chip label={`${t('Ammo', 'Munitions')}: ${ammoTypeFilter}`} size="small" />}
              {ammoFlavorFilter && <Chip label={`${t('Flavor', 'Famille')}: ${ammoFlavorFilter}`} size="small" />}
              {armorTypeFilter && <Chip label={`${t('Armor', 'Armure')}: ${armorTypeFilter}`} size="small" />}
              {armorSlotFilter && <Chip label={`${t('Slot', 'Slot')}: ${armorSlotFilter}`} size="small" />}
              {rarityFilter !== 'all' && <Chip label={`${t('Rarity', 'Rareté')}: ${lang === 'fr' ? RARITY_OPTIONS.find((option) => option.value === rarityFilter)?.labelFr : RARITY_OPTIONS.find((option) => option.value === rarityFilter)?.labelEn}`} size="small" />}
              {slotCountFilter !== 'all' && <Chip label={`${t('Slots', 'Slots')}: ${slotCountFilter}`} size="small" />}
              {craftTimeFilter !== 'all' && <Chip label={`${t('Craft time', 'Temps de craft')}: ${craftTimeFilter}`} size="small" />}
              {acquisitionEmployerFilter && <Chip label={`${t('Employer', 'Employeur')}: ${acquisitionEmployerFilter}`} size="small" />}
              {acquisitionScaleFilter && <Chip label={`${t('Scale', 'Portée')}: ${acquisitionScaleFilter}`} size="small" />}
              {acquisitionStandingFilter !== 'all' && <Chip label={`${t('Standing', 'Réputation')}: ${getStandingLabel(acquisitionStandingFilter, lang)}`} size="small" />}
            </Stack>
          )}
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
