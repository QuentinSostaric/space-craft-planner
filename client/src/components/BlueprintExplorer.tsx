import { alpha, useTheme } from '@mui/material/styles';
import { type ElementType, useCallback, useEffect, useMemo } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import FilterListOffOutlinedIcon from '@mui/icons-material/FilterListOffOutlined';
import StarIcon from '@mui/icons-material/Star';
import FlagIcon from '@mui/icons-material/Flag';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import { AppGlyph } from './ui/AppGlyph';
import { useCraft } from '../store/CraftContext';
import { loc, useI18n } from '../i18n/I18nContext';
import { ENABLE_SHIP_COMPONENT_BLUEPRINTS } from '../utils/featureFlags';
import {
  buildShipComponentCardModel,
  isDisplayableShipComponent,
} from '../utils/shipComponents';
import { isResourceSlot, ls, STANDING_OPTIONS } from '../utils/crafting';
import { CategoryBadge } from './ui/Badge';
import { DatasetTooOldNotice } from './ui/DatasetTooOldNotice';
import { PageStatCard } from './ui/PageStatCard';
import type {
  BlueprintSort,
  CategoryFilter,
  CraftTimeBucket,
  LegalityFilter,
  Lang,
  LibrarySegment,
  LocalizedString,
  RarityFilter,
  SlotCountFilter,
  StandingBucket,
} from '../types';

type LocalizedOption = { label: LocalizedString };

function getOptionText(option: LocalizedOption, lang: Lang): string {
  return loc(option.label, lang);
}

const CATEGORY_FILTERS: Array<{ value: CategoryFilter } & LocalizedOption> = [
  { value: 'all', label: ls('All', 'Tous', 'Alle') },
  { value: 'fps-weapon', label: ls('Weapons', 'Armes', 'Waffen') },
  { value: 'fps-armor', label: ls('Armor', 'Armures', 'Rüstungen') },
  { value: 'fps-helmet', label: ls('Helmets', 'Casques', 'Helme') },
  { value: 'fps-undersuit', label: ls('Undersuits', 'Combis', 'Unteranzüge') },
  { value: 'fps-backpack', label: ls('Backpacks', 'Sacs', 'Rucksäcke') },
  { value: 'fps-magazine', label: ls('Magazines', 'Chargeurs', 'Magazine') },
  { value: 'powerplant', label: ls('Power', 'Centrales', 'Kraftwerke') },
  { value: 'cooler', label: ls('Coolers', 'Refroid.', 'Kuhler') },
  { value: 'shield-generator', label: ls('Shields', 'Boucliers', 'Schilde') },
  { value: 'quantum-drive', label: ls('Quantum', 'Quantique', 'Quantum') },
  { value: 'radar', label: ls('Radars', 'Radars', 'Radare') },
  { value: 'fuel-nozzle', label: ls('Fuel', 'Carburant', 'Kraftstoff') },
  { value: 'ship-weapon', label: ls('Ship guns', 'Armes v.', 'Schiffswaffen') },
  { value: 'mining-laser', label: ls('Mining', 'Minage', 'Bergbau') },
  { value: 'salvage-head', label: ls('Salvage', 'Salvage', 'Bergung') },
  { value: 'tractor-beam', label: ls('Tractor', 'Tracteur', 'Traktor') },
];

const SEGMENTS: Array<{ value: LibrarySegment; icon: ElementType | null } & LocalizedOption> = [
  { value: 'all', label: ls('All', 'Tous', 'Alle'), icon: null },
  { value: 'inventory', label: ls('Inventory', 'Inventaire', 'Inventar'), icon: Inventory2Icon },
  { value: 'favorites', label: ls('Favs', 'Favoris', 'Favoriten'), icon: StarIcon },
  { value: 'obtainable', label: ls('Obtainable', 'Obtenables', 'Erhältlich'), icon: FlagIcon },
];

const SORT_OPTIONS: Array<{ value: BlueprintSort } & LocalizedOption> = [
  { value: 'name-asc', label: ls('Name', 'Nom', 'Name') },
  { value: 'manufacturer-asc', label: ls('Manufacturer', 'Fabricant', 'Hersteller') },
  { value: 'craft-time-asc', label: ls('Craft time: fast', 'Craft: rapide', 'Fertigungszeit: schnell') },
  { value: 'craft-time-desc', label: ls('Craft time: long', 'Craft: long', 'Fertigungszeit: lang') },
  { value: 'slot-count-desc', label: ls('Slot count', 'Nombre de slots', 'Slot-Anzahl') },
  { value: 'rarity-desc', label: ls('Rarity', 'Rareté', 'Seltenheit') },
  { value: 'acquisition-desc', label: ls('Acquisition ease', "Facilité d'obtention", 'Erwerbsleichtigkeit') },
  { value: 'damage-desc', label: ls('Damage', 'Dégâts', 'Schaden') },
  { value: 'range-desc', label: ls('Range', 'Portée', 'Reichweite') },
  { value: 'rate-of-fire-desc', label: ls('Rate of fire', 'Cadence', 'Feuerrate') },
  { value: 'magazine-desc', label: ls('Magazine', 'Chargeur', 'Magazin') },
  { value: 'kinetic-desc', label: ls('Kinetic resist.', 'Résist. cinétique', 'Kinet. Resist.') },
  { value: 'energy-desc', label: ls('Energy resist.', 'Résist. énergie', 'Energie-Resist.') },
  { value: 'temp-max-desc', label: ls('Temp max', 'Temp max', 'Temp. Max') },
];

const RARITY_OPTIONS: Array<{ value: RarityFilter } & LocalizedOption> = [
  { value: 'all', label: ls('Any rarity', 'Toute rareté', 'Beliebige Seltenheit') },
  { value: 'legendary', label: ls('Legendary', 'Légendaire', 'Legendär') },
  { value: 'rare', label: ls('Rare', 'Rare', 'Selten') },
  { value: 'common', label: ls('Common', 'Commune', 'Gewöhnlich') },
  { value: 'unknown', label: ls('Unknown', 'Inconnue', 'Unbekannt') },
];

const SLOT_COUNT_OPTIONS: Array<{ value: SlotCountFilter } & LocalizedOption> = [
  { value: 'all', label: ls('Any slots', 'Tous les slots', 'Beliebige Slot-Anzahl') },
  { value: '1', label: ls('1 slot', '1 slot', '1 Slot') },
  { value: '2', label: ls('2 slots', '2 slots', '2 Slots') },
  { value: '3', label: ls('3 slots', '3 slots', '3 Slots') },
];

const CRAFT_TIME_OPTIONS: Array<{ value: CraftTimeBucket } & LocalizedOption> = [
  { value: 'all', label: ls('Any duration', 'Toute durée', 'Beliebige Dauer') },
  { value: '<=60', label: ls('≤ 1 min', '≤ 1 min', '≤ 1 Min') },
  { value: '61-120', label: ls('1-2 min', '1-2 min', '1-2 Min') },
  { value: '121-180', label: ls('2-3 min', '2-3 min', '2-3 Min') },
  { value: '180+', label: ls('3+ min', '3+ min', '3+ Min') },
];

function getStandingLabel(value: StandingBucket, lang: Lang): string {
  const option = STANDING_OPTIONS.find((entry) => entry.value === value);
  return option ? getOptionText(option, lang) : value;
}

function getActiveCount(flags: boolean[]): number {
  return flags.filter(Boolean).length;
}

const accordionCaretSummarySx = {
  '& .MuiAccordionSummary-expandIconWrapper': {
    transform: 'rotate(180deg)',
  },
  '& .MuiAccordionSummary-expandIconWrapper.Mui-expanded': {
    transform: 'rotate(0deg)',
  },
} as const;

const SHIP_COMPONENT_FAMILY_OPTIONS: Record<string, LocalizedOption> = {
  scanner: { label: ls('Scanners', 'Scanners', 'Scanner') },
  'refueling-nozzle': {
    label: ls('Refueling nozzles', 'Becs de ravitaillement', 'Betankungsdusen'),
  },
  'fuel-pod': { label: ls('Fuel pods', 'Pods carburant', 'Treibstofftanks') },
  'salvage-head': { label: ls('Salvage heads', 'Tetes de salvage', 'Bergungskopfe') },
  'salvage-modifier': {
    label: ls('Salvage modifiers', 'Modules salvage', 'Bergungsmodule'),
  },
  'mining-laser': { label: ls('Mining lasers', 'Lasers de minage', 'Bergbaulaser') },
  'mining-module': { label: ls('Mining modules', 'Modules de minage', 'Bergbaumodule') },
  powerplant: { label: ls('Power plants', 'Centrales', 'Kraftwerke') },
  cooler: { label: ls('Coolers', 'Refroidisseurs', 'Kuhler') },
  'shield-generator': {
    label: ls('Shield generators', 'Generateurs de bouclier', 'Schildgeneratoren'),
  },
  'quantum-drive': { label: ls('Quantum drives', 'Moteurs quantiques', 'Quantenantriebe') },
  radar: { label: ls('Radars', 'Radars', 'Radare') },
  'ship-weapon': { label: ls('Ship weapons', 'Armes de vaisseau', 'Schiffswaffen') },
  'missile-rack': { label: ls('Missile racks', 'Racks missiles', 'Raketenhalterungen') },
  emp: { label: ls('EMPs', 'EMPs', 'EMPs') },
  'qed-qid': { label: ls('QED / QID', 'QED / QID', 'QED / QID') },
  'jump-drive': { label: ls('Jump drives', 'Moteurs de saut', 'Sprungantriebe') },
  thruster: { label: ls('Thrusters', 'Propulseurs', 'Triebwerke') },
  'fuel-tank': { label: ls('Fuel tanks', 'Reservoirs', 'Treibstofftanks') },
  'fuel-intake': { label: ls('Fuel intakes', 'Prises carburant', 'Treibstoffaufnahmen') },
  battery: { label: ls('Batteries', 'Batteries', 'Batterien') },
  computer: { label: ls('Computers', 'Ordinateurs', 'Computer') },
};

function humanizeToken(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function getShipComponentFamilyLabel(value: string, lang: Lang): string {
  const option = SHIP_COMPONENT_FAMILY_OPTIONS[value];
  return option ? getOptionText(option, lang) : humanizeToken(value);
}

export function BlueprintExplorer() {
  const {
    activeBlueprint,
    activeDataset,
    setActiveBlueprint,
    categoryFilter,
    setCategoryFilter,
    searchQuery,
    setSearchQuery,
    librarySegment,
    setLibrarySegment,
    manufacturerFilter,
    setManufacturerFilter,
    shipComponentFamilyFilter,
    setShipComponentFamilyFilter,
    shipComponentProfileFilter,
    setShipComponentProfileFilter,
    shipComponentSizeFilter,
    setShipComponentSizeFilter,
    shipComponentGradeFilter,
    setShipComponentGradeFilter,
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
    missionRewardsLoading,
    ensureMissionRewardsLoaded,
    ensureShipComponentsLoaded,
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
        if (isResourceSlot(slot) && slot.requiredResource) {
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

  const shipComponents = useMemo(
    () =>
      ENABLE_SHIP_COMPONENT_BLUEPRINTS
        ? (activeDataset.shipComponents?.entries ?? []).filter(isDisplayableShipComponent)
        : [],
    [activeDataset.shipComponents],
  );

  const shipComponentFamilies = useMemo(() => {
    const set = new Set<string>();
    for (const component of shipComponents) {
      if (component.family) {
        set.add(component.family);
      }
    }

    return [...set].sort((left, right) =>
      getShipComponentFamilyLabel(left, lang).localeCompare(
        getShipComponentFamilyLabel(right, lang),
        undefined,
        { sensitivity: 'base' },
      ),
    );
  }, [lang, shipComponents]);

  const shipComponentProfiles = useMemo(() => {
    const map = new Map<string, string>();
    for (const component of shipComponents) {
      const model = buildShipComponentCardModel(component);
      map.set(
        model.profileKey,
        lang === 'fr'
          ? model.profile.label.fr
          : lang === 'de'
            ? (model.profile.label.de ?? model.profile.label.en)
            : model.profile.label.en,
      );
    }

    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }));
  }, [lang, shipComponents]);

  const shipComponentSizes = useMemo(() => {
    const set = new Set<string>();
    for (const component of shipComponents) {
      const size = component.identity?.attachDef?.size;
      if (size != null) {
        set.add(String(size));
      }
    }

    return [...set].sort((left, right) => Number(left) - Number(right));
  }, [shipComponents]);

  const shipComponentGrades = useMemo(() => {
    const set = new Set<string>();
    for (const component of shipComponents) {
      const grade = component.identity?.attachDef?.grade;
      if (grade != null) {
        set.add(String(grade));
      }
    }

    return [...set].sort((left, right) => Number(left) - Number(right));
  }, [shipComponents]);

  const shipComponentFiltersEnabled =
    ENABLE_SHIP_COMPONENT_BLUEPRINTS && shipComponents.length > 0;

  const locations = useMemo(() => {
    if (!missionRewards) return [];
    const set = new Set<string>();
    for (const entry of missionRewards.blueprintAcquisitionGraph) {
      for (const loc of entry.localities) set.add(loc);
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

  const blueprintStats = useMemo(
    () => ({
      blueprintCount: blueprints.length,
      manufacturerCount: manufacturers.length,
      missionLinkedCount: missionRewards?.blueprintAcquisitionGraph.length ?? 0,
      materialCount: materials.length,
    }),
    [blueprints.length, manufacturers.length, materials.length, missionRewards?.blueprintAcquisitionGraph.length ?? 0],
  );

  const hasActiveFilters =
    categoryFilter !== 'all' ||
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
    acquisitionStandingFilter !== 'all' ||
    (shipComponentFiltersEnabled &&
      (shipComponentFamilyFilter !== null ||
        shipComponentProfileFilter !== null ||
        shipComponentSizeFilter !== null ||
        shipComponentGradeFilter !== null));

  const basicFilterCount = getActiveCount([
    categoryFilter !== 'all',
    manufacturerFilter !== null,
    materialFilter !== null,
    legalityFilter !== 'all',
    locationFilter !== null,
  ]);

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
    shipComponentFiltersEnabled && shipComponentFamilyFilter !== null,
    shipComponentFiltersEnabled && shipComponentProfileFilter !== null,
    shipComponentFiltersEnabled && shipComponentSizeFilter !== null,
    shipComponentFiltersEnabled && shipComponentGradeFilter !== null,
  ]);

  const clearAllFilters = useCallback(() => {
    setCategoryFilter('all');
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
    setShipComponentFamilyFilter(null);
    setShipComponentProfileFilter(null);
    setShipComponentSizeFilter(null);
    setShipComponentGradeFilter(null);
  }, [
    setAcquisitionEmployerFilter,
    setAcquisitionScaleFilter,
    setAcquisitionStandingFilter,
    setAmmoFlavorFilter,
    setAmmoTypeFilter,
    setArmorSlotFilter,
    setArmorTypeFilter,
    setCategoryFilter,
    setCraftTimeFilter,
    setLegalityFilter,
    setLocationFilter,
    setManufacturerFilter,
    setMaterialFilter,
    setRarityFilter,
    setShipComponentFamilyFilter,
    setShipComponentGradeFilter,
    setShipComponentProfileFilter,
    setShipComponentSizeFilter,
    setSlotCountFilter,
    setWeaponTypeFilter,
  ]);

  const requiresMissionRewards =
    librarySegment === 'obtainable' ||
    legalityFilter !== 'all' ||
    locationFilter !== null ||
    acquisitionEmployerFilter !== null ||
    acquisitionScaleFilter !== null ||
    acquisitionStandingFilter !== 'all' ||
    blueprintSort === 'acquisition-desc';

  useEffect(() => {
    if (requiresMissionRewards) {
      void ensureMissionRewardsLoaded();
    }
  }, [ensureMissionRewardsLoaded, requiresMissionRewards]);

  useEffect(() => {
    if (ENABLE_SHIP_COMPONENT_BLUEPRINTS && activeDataset.hasShipComponents) {
      void ensureShipComponentsLoaded();
    }
  }, [activeDataset.hasShipComponents, ensureShipComponentsLoaded]);

  return (
    <Box
      component="section"
      aria-label={t('Blueprint filters', 'Filtres blueprints')}
      sx={{
        p: { xs: 1, md: 1.15 },
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' },
          gap: 0.75,
          '& .MuiPaper-root': {
            minHeight: { xs: 46, md: 50 },
            px: { xs: 1, md: 1.1 },
            py: { xs: 0.75, md: 0.85 },
          },
          '& .MuiTypography-caption': {
            fontSize: { xs: '0.54rem', md: '0.58rem' },
            letterSpacing: '0.08em',
            mb: 0.25,
          },
        }}
      >
        <PageStatCard
          label={t('Blueprints', 'Blueprints')}
          value={String(blueprintStats.blueprintCount)}
        />
        <PageStatCard
          label={t('Manufacturers', 'Fabricants')}
          value={String(blueprintStats.manufacturerCount)}
        />
        <PageStatCard
          label={t('Mission-linked', 'Liees aux missions')}
          value={String(blueprintStats.missionLinkedCount)}
        />
        <PageStatCard
          label={t('Required materials', 'Materiaux requis')}
          value={String(blueprintStats.materialCount)}
        />
      </Box>
      {requiresMissionRewards && !missionRewardsLoading && !missionRewards && !activeDataset.hasMissionRewards && (
        <DatasetTooOldNotice variant="caption" />
      )}

      <Paper
        variant="outlined"
        sx={{
          p: { xs: 1, md: 1.15 },
          borderColor: alpha(theme.palette.primary.main, 0.14),
          backgroundColor: alpha(theme.palette.background.default, 0.24),
        }}
      >
        <Stack spacing={0.85}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                md: 'minmax(260px, 1fr) auto minmax(170px, 220px) auto',
              },
              gap: 0.75,
              alignItems: 'center',
            }}
          >
            <TextField
              type="search"
              size="small"
              label={t('Search', 'Recherche', 'Suche')}
              placeholder={t('Search blueprints...', 'Rechercher des blueprints...', 'Blueprints suchen...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start" sx={{ color: 'text.disabled' }}>
                      <AppGlyph name="search" size={18} />
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
                    {getOptionText(segment, lang)}
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
                minWidth: { xs: '100%', sm: 190 },
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
                    {getOptionText(option, lang)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {hasActiveFilters && (
              <Button
                variant="outlined"
                startIcon={<FilterListOffOutlinedIcon />}
                onClick={clearAllFilters}
                sx={{
                  minHeight: 32,
                  whiteSpace: 'nowrap',
                  px: 1.25,
                  fontSize: '.68rem',
                }}
              >
                {t('Reset', 'Reinitialiser', 'Zurucksetzen')}
              </Button>
            )}

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

          {(
            <Accordion
              disableGutters
              elevation={0}
              sx={{
                backgroundColor: 'transparent',
                border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                '&::before': { display: 'none' },
              }}
            >
          <AccordionSummary
            expandIcon={<AppGlyph name="caret-up" size={18} />}
            sx={{ minHeight: 40, ...accordionCaretSummarySx }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {t('Filters', 'Filtres')}
              </Typography>
              {basicFilterCount > 0 && (
                <Chip
                  size="small"
                  label={`${basicFilterCount} ${t('active', 'actifs')}`}
                  color="primary"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '.62rem' }}
                />
              )}
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
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
                {CATEGORY_FILTERS.map(({ value, ...option }) => (
                  <Chip
                    key={value}
                    label={getOptionText(option, lang)}
                    size="small"
                    variant={categoryFilter === value ? 'filled' : 'outlined'}
                    onClick={() => setCategoryFilter(value)}
                    sx={{
                      fontSize: '.65rem',
                      height: 26,
                      maxWidth: 'calc(50% - 4px)',
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

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 1, alignItems: 'center' }}>
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
                    placeholder={t('Required material', 'Materiau requis')}
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
                  width: '100%',
                  '& .MuiToggleButton-root': {
                    fontSize: '.56rem',
                    px: 0.5,
                    flex: 1,
                    lineHeight: 1.1,
                  },
                }}
              >
                <ToggleButton value="all">{t('All', 'Tous')}</ToggleButton>
                <ToggleButton value="lawful">{t('Lawful', 'Legal')}</ToggleButton>
                <ToggleButton value="unlawful">{t('Unlawful', 'Illegal')}</ToggleButton>
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

            </Box>
          </AccordionDetails>
        </Accordion>
      )}

      <Box
        sx={{
          display: 'none',
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

      </Box>

      <Accordion
        disableGutters
        elevation={0}
        sx={{
          backgroundColor: 'transparent',
          border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
          '&::before': { display: 'none' },
        }}
      >
        <AccordionSummary
          expandIcon={<AppGlyph name="caret-up" size={18} />}
          sx={{
            minHeight: 42,
            '& .MuiAccordionSummary-content': {
              my: 0.75,
            },
            ...accordionCaretSummarySx,
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
              renderInput={(params) => <TextField {...params} label={t('Weapon type', "Type d'arme")} placeholder={t('Weapon type', "Type d'arme")} />}
              slotProps={{ listbox: { sx: { fontSize: '.75rem' } } }}
            />
            <Autocomplete
              size="small"
              options={ammoTypes}
              value={ammoTypeFilter}
              onChange={(_e, val) => setAmmoTypeFilter(val)}
              renderInput={(params) => <TextField {...params} label={t('Ammo type', 'Type de munition')} placeholder={t('Ammo type', 'Type de munition')} />}
              slotProps={{ listbox: { sx: { fontSize: '.75rem' } } }}
            />
            <Autocomplete
              size="small"
              options={ammoFlavors}
              value={ammoFlavorFilter}
              onChange={(_e, val) => setAmmoFlavorFilter(val)}
              renderInput={(params) => <TextField {...params} label={t('Ammo flavor', 'Famille de munition')} placeholder={t('Ammo flavor', 'Famille de munition')} />}
              slotProps={{ listbox: { sx: { fontSize: '.75rem' } } }}
            />
            <Autocomplete
              size="small"
              options={armorTypes}
              value={armorTypeFilter}
              onChange={(_e, val) => setArmorTypeFilter(val)}
              renderInput={(params) => <TextField {...params} label={t('Armor type', "Type d'armure")} placeholder={t('Armor type', "Type d'armure")} />}
              slotProps={{ listbox: { sx: { fontSize: '.75rem' } } }}
            />
            <Autocomplete
              size="small"
              options={armorSlots}
              value={armorSlotFilter}
              onChange={(_e, val) => setArmorSlotFilter(val)}
              renderInput={(params) => <TextField {...params} label={t('Armor slot', "Emplacement d'armure")} placeholder={t('Armor slot', "Emplacement d'armure")} />}
              slotProps={{ listbox: { sx: { fontSize: '.75rem' } } }}
            />
            {shipComponentFiltersEnabled && (
              <Autocomplete
                size="small"
                options={shipComponentFamilies}
                value={shipComponentFamilyFilter}
                onChange={(_e, val) => setShipComponentFamilyFilter(val)}
                getOptionLabel={(value) => getShipComponentFamilyLabel(value, lang)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t('Ship component family', 'Famille de composant')}
                    placeholder={t('Ship component family', 'Famille de composant')}
                  />
                )}
                slotProps={{ listbox: { sx: { fontSize: '.75rem' } } }}
              />
            )}
            {shipComponentFiltersEnabled && (
              <Autocomplete
                size="small"
                options={shipComponentProfiles}
                value={
                  shipComponentProfiles.find((option) => option.value === shipComponentProfileFilter) ?? null
                }
                onChange={(_e, val) => setShipComponentProfileFilter(val?.value ?? null)}
                getOptionLabel={(option) => option.label}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t('Ship component profile', 'Profil de composant')}
                    placeholder={t('Ship component profile', 'Profil de composant')}
                  />
                )}
                slotProps={{ listbox: { sx: { fontSize: '.75rem' } } }}
              />
            )}
            {shipComponentFiltersEnabled && (
              <Autocomplete
                size="small"
                options={shipComponentSizes}
                value={shipComponentSizeFilter}
                onChange={(_e, val) => setShipComponentSizeFilter(val)}
                getOptionLabel={(value) => `S${value}`}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t('Ship component size', 'Taille composant')}
                    placeholder={t('Ship component size', 'Taille composant')}
                  />
                )}
                slotProps={{ listbox: { sx: { fontSize: '.75rem' } } }}
              />
            )}
            {shipComponentFiltersEnabled && (
              <Autocomplete
                size="small"
                options={shipComponentGrades}
                value={shipComponentGradeFilter}
                onChange={(_e, val) => setShipComponentGradeFilter(val)}
                getOptionLabel={(value) => `Grade ${value}`}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t('Ship component grade', 'Grade composant')}
                    placeholder={t('Ship component grade', 'Grade composant')}
                  />
                )}
                slotProps={{ listbox: { sx: { fontSize: '.75rem' } } }}
              />
            )}
            <FormControl size="small">
              <Select value={rarityFilter} onChange={(event) => setRarityFilter(event.target.value as RarityFilter)}>
                {RARITY_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {getOptionText(option, lang)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small">
              <Select value={slotCountFilter} onChange={(event) => setSlotCountFilter(event.target.value as SlotCountFilter)}>
                {SLOT_COUNT_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {getOptionText(option, lang)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small">
              <Select value={craftTimeFilter} onChange={(event) => setCraftTimeFilter(event.target.value as CraftTimeBucket)}>
                {CRAFT_TIME_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {getOptionText(option, lang)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Autocomplete
              size="small"
              options={acquisitionEmployers}
              value={acquisitionEmployerFilter}
              onChange={(_e, val) => setAcquisitionEmployerFilter(val)}
              renderInput={(params) => <TextField {...params} label={t('Mission employer', 'Employeur de mission')} placeholder={t('Mission employer', 'Employeur de mission')} />}
              slotProps={{ listbox: { sx: { fontSize: '.75rem' } } }}
            />
            <Autocomplete
              size="small"
              options={acquisitionScales}
              value={acquisitionScaleFilter}
              onChange={(_e, val) => setAcquisitionScaleFilter(val)}
              getOptionLabel={(value) => value}
              renderInput={(params) => <TextField {...params} label={t('Acquisition scale', "Portée d'acquisition")} placeholder={t('Acquisition scale', "Portée d'acquisition")} />}
              slotProps={{ listbox: { sx: { fontSize: '.75rem' } } }}
            />
            <FormControl size="small">
              <Select
                value={acquisitionStandingFilter}
                onChange={(event) => setAcquisitionStandingFilter(event.target.value as StandingBucket)}
              >
                {STANDING_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {getOptionText(option, lang)}
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
              {shipComponentFiltersEnabled && shipComponentFamilyFilter && (
                <Chip
                  label={`${t('Component family', 'Famille composant')}: ${getShipComponentFamilyLabel(shipComponentFamilyFilter, lang)}`}
                  size="small"
                />
              )}
              {shipComponentFiltersEnabled && shipComponentProfileFilter && (
                <Chip
                  label={`${t('Component profile', 'Profil composant')}: ${shipComponentProfiles.find((option) => option.value === shipComponentProfileFilter)?.label ?? humanizeToken(shipComponentProfileFilter)}`}
                  size="small"
                />
              )}
              {shipComponentFiltersEnabled && shipComponentSizeFilter && (
                <Chip
                  label={`${t('Component size', 'Taille composant')}: S${shipComponentSizeFilter}`}
                  size="small"
                />
              )}
              {shipComponentFiltersEnabled && shipComponentGradeFilter && (
                <Chip
                  label={`${t('Component grade', 'Grade composant')}: ${shipComponentGradeFilter}`}
                  size="small"
                />
              )}
              {rarityFilter !== 'all' && <Chip label={`${t('Rarity', 'Rareté')}: ${getOptionText(RARITY_OPTIONS.find((option) => option.value === rarityFilter) ?? RARITY_OPTIONS[0], lang)}`} size="small" />}
              {slotCountFilter !== 'all' && <Chip label={`${t('Slots', 'Slots')}: ${slotCountFilter}`} size="small" />}
              {craftTimeFilter !== 'all' && <Chip label={`${t('Craft time', 'Temps de craft')}: ${craftTimeFilter}`} size="small" />}
              {acquisitionEmployerFilter && <Chip label={`${t('Employer', 'Employeur')}: ${acquisitionEmployerFilter}`} size="small" />}
              {acquisitionScaleFilter && <Chip label={`${t('Scale', 'Portée')}: ${acquisitionScaleFilter}`} size="small" />}
              {acquisitionStandingFilter !== 'all' && <Chip label={`${t('Standing', 'Réputation')}: ${getStandingLabel(acquisitionStandingFilter, lang)}`} size="small" />}
            </Stack>
          )}
        </AccordionDetails>
      </Accordion>
        </Stack>
      </Paper>
    </Box>
  );
}
