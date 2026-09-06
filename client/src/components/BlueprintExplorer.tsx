import { Box, Collapse, IconButton, Stack, Typography, alpha, useTheme } from '../ui/system';
import { AppButton, AppSelect, AppTextField, AppToggleGroup } from './ui/controls';
import { CloseIcon, FilterListOffOutlinedIcon, TuneIcon, StarIcon, FlagIcon, Inventory2Icon, ExpandMoreIcon } from '../ui/icons';
import { type ElementType, useCallback, useEffect, useMemo, useState } from 'react';
import { Panel } from './ui/Panel';
import { useCraft } from '../store/CraftContext';
import { useFilters } from '../store/FilterContext';
import { loc, useI18n } from '../i18n/I18nContext';
import { useAuth } from '../auth/AuthContext';
import { isTauriRuntime } from '../services/apiBaseUrl';
import { SyncBlueprintsButton } from './ScLogSyncDialog';
import { useFlag } from '../hooks/useFeatureFlag';
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
  Lang,
  LibrarySegment,
  LocalizedString,
  RarityFilter,
  SlotCountFilter,
  StandingBucket,
} from '../types';
import { TEXT_LABEL, TEXT_LABEL_SM } from '../theme';
import { ResponsiveFilters } from './ui/page';
import { AppChip } from './ui/data-display/AppChip';

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
  const shipComponentBlueprintsEnabled = useFlag('ship-component-blueprints');
  const {
    activeBlueprint,
    activeDataset,
    setActiveBlueprint,
    inventoryIds,
    blueprints,
    missionRewards,
    missionRewardsLoading,
    ensureMissionRewardsLoaded,
    ensureShipComponentsLoaded,
  } = useCraft();
  const {
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
  } = useFilters();
  const { lang, t } = useI18n();
  const theme = useTheme();
  const { user } = useAuth();
  const isDesktop = isTauriRuntime();

  const [advancedOpen, setAdvancedOpen] = useState(false);

  const showSyncButton = isDesktop && Boolean(user);

  const manufacturers = useMemo(() => {
    const set = new Set<string>();
    for (const bp of blueprints) {
      if (bp.manufacturer) set.add(bp.manufacturer);
    }
    return [...set].sort();
  }, [blueprints]);

  const materials = useMemo(() => {
    const resources = activeDataset.resources;
    const set = new Set<string>();
    for (const bp of blueprints) {
      for (const id of bp.requiredResourceIds ?? []) {
        const res = resources.find((r) => r.id === id);
        set.add(res?.name ?? id);
      }
      for (const slot of bp.slots) {
        if (isResourceSlot(slot) && slot.requiredResource) {
          set.add(slot.requiredResource);
        }
      }
    }
    return [...set].sort();
  }, [blueprints, activeDataset.resources]);

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
      shipComponentBlueprintsEnabled
        ? (activeDataset.shipComponents?.entries ?? []).filter(isDisplayableShipComponent)
        : [],
    [activeDataset.shipComponents, shipComponentBlueprintsEnabled],
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
    shipComponentBlueprintsEnabled && shipComponents.length > 0;

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
    if (shipComponentBlueprintsEnabled && activeDataset.hasShipComponents) {
      void ensureShipComponentsLoaded();
    }
  }, [activeDataset.hasShipComponents, ensureShipComponentsLoaded, shipComponentBlueprintsEnabled]);

  /* ─────────────────────────────────────────────────────────── render ── */
  return (
    <Box
      component="section"
      aria-label={t('Blueprint filters', 'Filtres blueprints')}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        py: 1.5,
      }}
    >
      {/* ── Page stat cards ── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
          gap: 0.75,
          '& > *': {
            minHeight: { xs: 46, md: 50 },
            px: { xs: 1, md: 1.1 },
            py: { xs: 0.75, md: 0.85 },
            borderColor: (theme) => alpha(theme.palette.primary.main, 0.13),
            background: (theme) =>
              `linear-gradient(180deg, ${alpha(theme.palette.ui.surface2, 0.4)} 0%, ${alpha(theme.palette.background.default, 0.26)} 100%)`,
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 0.65,
            '&::before': {
              content: '""',
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 2,
              backgroundColor: 'primary.main',
              opacity: 0.55,
            },
          },
          '& > * > span:first-of-type': {
            fontSize: { xs: TEXT_LABEL, md: TEXT_LABEL },
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
          domain="blue"
        />
        <PageStatCard
          label={t('Required materials', 'Materiaux requis')}
          value={String(blueprintStats.materialCount)}
          domain="green"
        />
      </Box>

      {requiresMissionRewards && !missionRewardsLoading && !missionRewards && !activeDataset.hasMissionRewards && (
        <DatasetTooOldNotice variant="caption" />
      )}

      <ResponsiveFilters
        title={t('Blueprint filters and sorting', 'Filtres et tri des blueprints')}
        triggerLabel={t('Filters and sort', 'Filtres et tri')}
        closeLabel={t('Show results', 'Afficher les résultats')}
        dismissLabel={t('Close filters', 'Fermer les filtres')}
        summary={
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {librarySegment === 'all' ? t('All blueprints', 'Tous les blueprints', 'Alle Baupläne') : getOptionText(SEGMENTS.find((segment) => segment.value === librarySegment)!, lang)}
            {hasActiveFilters ? ` · ${t('Filters active', 'Filtres actifs', 'Filter aktiv')}` : ''}
          </Typography>
        }
        actions={hasActiveFilters ? (
          <AppButton variant="secondary" size="sm" onClick={clearAllFilters}>
            {t('Reset', 'Reinitialiser', 'Zurucksetzen')}
          </AppButton>
        ) : undefined}
      >
      {/* ── Primary toolbar ── */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1,
          alignItems: 'center',
          px: 1.5,
          py: 1,
          bgcolor: 'ui.surface',
          border: `1px solid ${theme.palette.ui.border}`,
          borderRadius: 1,
        }}
      >
        {/* Search */}
        <AppTextField
          type="search"
          placeholder={t('Search blueprints...', 'Rechercher des blueprints...', 'Blueprints suchen...')}
          value={searchQuery}
          onValueChange={setSearchQuery}
          ariaLabel={t('Search blueprints', 'Rechercher des blueprints')}
          fieldSx={{
            flex: '1 1 auto',
            maxWidth: 360,
            minWidth: 140,
          }}
          sx={{ fontSize: '.8rem' }}
        />

        {/* Library segment toggle */}
        <AppToggleGroup
          value={librarySegment}
          options={SEGMENTS.map((segment) => ({
            value: segment.value,
            label: (
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                {segment.icon && <segment.icon sx={{ fontSize: '.75rem', flexShrink: 0 }} />}
                <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {getOptionText(segment, lang)}
                </Box>
                {segment.value === 'inventory' && inventoryIds.length > 0 && (
                  <Box component="span" sx={{ fontSize: '.75rem', opacity: 0.7, flexShrink: 0 }}>
                    {inventoryIds.length}
                  </Box>
                )}
              </Box>
            ),
          }))}
          onValueChange={(value) => setLibrarySegment(value)}
          ariaLabel={t('Library filter', 'Filtre bibliotheque')}
          sx={{ flexShrink: 0 }}
          partSx={{ button: { fontSize: '.75rem', px: { xs: 0.75, sm: 1.25 }, minHeight: 32, lineHeight: 1.1 } }}
        />

        {/* Sync button — desktop + logged in */}
        {showSyncButton && (
          <SyncBlueprintsButton
            onSuccess={() => setLibrarySegment('inventory')}
          />
        )}

        {/* Spacer */}
        <Box sx={{ flex: '1 1 auto' }} />

        {/* Sort select */}
        <AppSelect
          value={blueprintSort}
          options={SORT_OPTIONS.map((option) => ({ value: option.value, label: getOptionText(option, lang) }))}
          onValueChange={(value) => { if (value) setBlueprintSort(value); }}
          ariaLabel={t('Sort blueprints', 'Trier les blueprints')}
          fieldSx={{ minWidth: 160, flexShrink: 0 }}
        />

        {/* Filtres avancés toggle */}
        <AppButton
          size="sm"
          variant="secondary"
          ariaPressed={advancedOpen}
          onClick={() => setAdvancedOpen((o) => !o)}
          sx={{
            flexShrink: 0,
            minHeight: 32,
            fontSize: '.75rem',
            px: 1.25,
            gap: 0.6,
            borderColor: advancedFilterCount > 0 ? 'primary.main' : 'divider',
            color: advancedFilterCount > 0 ? 'primary.main' : 'text.secondary',
          }}
        >
          <TuneIcon sx={{ fontSize: '0.9rem !important' }} />
          {t('Advanced filters', 'Filtres avancés')}
          {advancedFilterCount > 0 && (
            <Box
              component="span"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 18,
                height: 18,
                borderRadius: '50%',
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                fontSize: TEXT_LABEL_SM,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {advancedFilterCount}
            </Box>
          )}
          <ExpandMoreIcon
            sx={{
              fontSize: '0.9rem !important',
              transition: 'transform 200ms ease',
              transform: advancedOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </AppButton>

        {/* Reset all filters */}
        {hasActiveFilters && (
          <AppButton
            variant="secondary"
            startIcon={<FilterListOffOutlinedIcon />}
            onClick={clearAllFilters}
            size="sm"
            sx={{
              minHeight: 32,
              whiteSpace: 'nowrap',
              px: 1.25,
              fontSize: '.75rem',
              flexShrink: 0,
            }}
          >
            {t('Reset', 'Reinitialiser', 'Zurucksetzen')}
          </AppButton>
        )}

        {/* Active blueprint pill */}
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
              minWidth: 0,
              flexShrink: 1,
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

      {/* ── Category chip strip ── */}
      <Box
        component="nav"
        aria-label={t('Category filter', 'Filtre categorie')}
        sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}
      >
        {CATEGORY_FILTERS.map(({ value, ...option }) => (
          <AppChip
            key={value}
            label={getOptionText(option, lang)}
            size="sm"
            tone="primary"
            outlined={categoryFilter !== value}
            selected={categoryFilter === value}
            ariaLabel={`${t('Filter by', 'Filtrer par')} ${getOptionText(option, lang)}`}
            onClick={() => setCategoryFilter(value)}
            sx={{ maxWidth: 180 }}
          />
        ))}
      </Box>

      {/* ── Advanced filters panel (collapsible) ── */}
      <Collapse in={advancedOpen} unmountOnExit>
        <Panel
          eyebrow={t('Advanced filters', 'Filtres avancés')}
          title={t(
            'Refine by manufacturer, material, rarity, legality…',
            'Affiner par fabricant, matériau, rareté, légalité…',
          )}
          noPad={false}
          dense
        >
          {/* Basic filters row: manufacturer + material + legality + location */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(4, minmax(0, 1fr))',
              },
              gap: 1,
              mb: 1.5,
            }}
          >
            <AppSelect
              label={t('Manufacturer', 'Fabricant')}
              value={manufacturerFilter}
              options={manufacturers.map((option) => ({ label: option, value: option }))}
              onValueChange={setManufacturerFilter}
              clearable
              filterable
              placeholder={t('Manufacturer', 'Fabricant')}
            />
            <AppSelect
              label={t('Required material', 'Materiau requis')}
              value={materialFilter}
              options={materials.map((option) => ({ label: option, value: option }))}
              onValueChange={setMaterialFilter}
              clearable
              filterable
              placeholder={t('Required material', 'Materiau requis')}
            />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: TEXT_LABEL, ml: 0.25 }}>
                {t('Legality', 'Légalité')}
              </Typography>
              <AppToggleGroup
                value={legalityFilter}
                options={[
                  { value: 'all', label: t('All', 'Tous') },
                  { value: 'lawful', label: t('Lawful', 'Legal') },
                  { value: 'unlawful', label: t('Unlawful', 'Illegal') },
                ]}
                onValueChange={(value) => setLegalityFilter(value)}
                ariaLabel={t('Legality filter', 'Filtre légalité')}
                sx={{ width: '100%' }}
                partSx={{ root: { width: '100%' }, button: { flex: 1, fontSize: '.75rem', px: 0.5, minHeight: 36, lineHeight: 1.1 } }}
              />
            </Box>
            <AppSelect
              label={t('Mission location', 'Lieu de mission')}
              value={locationFilter}
              options={locations.map((option) => ({ label: option, value: option }))}
              onValueChange={setLocationFilter}
              clearable
              filterable
              placeholder={t('Mission location', 'Lieu de mission')}
            />
          </Box>

          {/* Advanced stat filters grid */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(3, minmax(0, 1fr))',
                xl: 'repeat(4, minmax(0, 1fr))',
              },
              gap: 1,
            }}
          >
            <AppSelect
              label={t('Weapon type', "Type d'arme")}
              value={weaponTypeFilter}
              options={weaponTypes.map((option) => ({ label: option, value: option }))}
              onValueChange={setWeaponTypeFilter}
              clearable
              filterable
              placeholder={t('Weapon type', "Type d'arme")}
            />
            <AppSelect
              label={t('Ammo type', 'Type de munition')}
              value={ammoTypeFilter}
              options={ammoTypes.map((option) => ({ label: option, value: option }))}
              onValueChange={setAmmoTypeFilter}
              clearable
              filterable
              placeholder={t('Ammo type', 'Type de munition')}
            />
            <AppSelect
              label={t('Ammo flavor', 'Famille de munition')}
              value={ammoFlavorFilter}
              options={ammoFlavors.map((option) => ({ label: option, value: option }))}
              onValueChange={setAmmoFlavorFilter}
              clearable
              filterable
              placeholder={t('Ammo flavor', 'Famille de munition')}
            />
            <AppSelect
              label={t('Armor type', "Type d'armure")}
              value={armorTypeFilter}
              options={armorTypes.map((option) => ({ label: option, value: option }))}
              onValueChange={setArmorTypeFilter}
              clearable
              filterable
              placeholder={t('Armor type', "Type d'armure")}
            />
            <AppSelect
              label={t('Armor slot', "Emplacement d'armure")}
              value={armorSlotFilter}
              options={armorSlots.map((option) => ({ label: option, value: option }))}
              onValueChange={setArmorSlotFilter}
              clearable
              filterable
              placeholder={t('Armor slot', "Emplacement d'armure")}
            />
            {shipComponentFiltersEnabled && (
              <AppSelect
                label={t('Ship component family', 'Famille de composant')}
                value={shipComponentFamilyFilter}
                options={shipComponentFamilies.map((value) => ({ label: getShipComponentFamilyLabel(value, lang), value }))}
                onValueChange={setShipComponentFamilyFilter}
                clearable
                filterable
                placeholder={t('Ship component family', 'Famille de composant')}
              />
            )}
            {shipComponentFiltersEnabled && (
              <AppSelect
                label={t('Ship component profile', 'Profil de composant')}
                value={shipComponentProfileFilter}
                options={shipComponentProfiles.map((option) => ({ label: option.label, value: option.value }))}
                onValueChange={(value) => setShipComponentProfileFilter(value ?? null)}
                clearable
                filterable
                placeholder={t('Ship component profile', 'Profil de composant')}
              />
            )}
            {shipComponentFiltersEnabled && (
              <AppSelect
                label={t('Ship component size', 'Taille composant')}
                value={shipComponentSizeFilter}
                options={shipComponentSizes.map((value) => ({ label: `S${value}`, value }))}
                onValueChange={setShipComponentSizeFilter}
                clearable
                filterable
                placeholder={t('Ship component size', 'Taille composant')}
              />
            )}
            {shipComponentFiltersEnabled && (
              <AppSelect
                label={t('Ship component grade', 'Grade composant')}
                value={shipComponentGradeFilter}
                options={shipComponentGrades.map((value) => ({ label: `Grade ${value}`, value }))}
                onValueChange={setShipComponentGradeFilter}
                clearable
                filterable
                placeholder={t('Ship component grade', 'Grade composant')}
              />
            )}
            <AppSelect
              value={rarityFilter}
              options={RARITY_OPTIONS.map((option) => ({ value: option.value, label: getOptionText(option, lang) }))}
              onValueChange={(value) => { if (value) setRarityFilter(value); }}
              ariaLabel={t('Rarity filter', 'Filtre rareté')}
            />
            <AppSelect
              value={slotCountFilter}
              options={SLOT_COUNT_OPTIONS.map((option) => ({ value: option.value, label: getOptionText(option, lang) }))}
              onValueChange={(value) => { if (value) setSlotCountFilter(value); }}
              ariaLabel={t('Slot count filter', 'Filtre nombre de slots')}
            />
            <AppSelect
              value={craftTimeFilter}
              options={CRAFT_TIME_OPTIONS.map((option) => ({ value: option.value, label: getOptionText(option, lang) }))}
              onValueChange={(value) => { if (value) setCraftTimeFilter(value); }}
              ariaLabel={t('Craft time filter', 'Filtre temps de craft')}
            />
            <AppSelect
              label={t('Mission employer', 'Employeur de mission')}
              value={acquisitionEmployerFilter}
              options={acquisitionEmployers.map((option) => ({ label: option, value: option }))}
              onValueChange={setAcquisitionEmployerFilter}
              clearable
              filterable
              placeholder={t('Mission employer', 'Employeur de mission')}
            />
            <AppSelect
              label={t('Acquisition scale', "Portée d'acquisition")}
              value={acquisitionScaleFilter}
              options={acquisitionScales.map((option) => ({ label: option, value: option }))}
              onValueChange={setAcquisitionScaleFilter}
              clearable
              filterable
              placeholder={t('Acquisition scale', "Portée d'acquisition")}
            />
            <AppSelect
              value={acquisitionStandingFilter}
              options={STANDING_OPTIONS.map((option) => ({ value: option.value, label: getOptionText(option, lang) }))}
              onValueChange={(value) => { if (value) setAcquisitionStandingFilter(value); }}
              ariaLabel={t('Acquisition standing filter', 'Filtre réputation acquisition')}
            />
          </Box>

          {/* Active advanced filter chips */}
          {(advancedFilterCount > 0 || rarityFilter !== 'all') && (
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1.25 }}>
              {weaponTypeFilter && <AppChip label={`${t('Weapon', 'Arme')}: ${weaponTypeFilter}`} size="small" />}
              {ammoTypeFilter && <AppChip label={`${t('Ammo', 'Munitions')}: ${ammoTypeFilter}`} size="small" />}
              {ammoFlavorFilter && <AppChip label={`${t('Flavor', 'Famille')}: ${ammoFlavorFilter}`} size="small" />}
              {armorTypeFilter && <AppChip label={`${t('Armor', 'Armure')}: ${armorTypeFilter}`} size="small" />}
              {armorSlotFilter && <AppChip label={`${t('Slot', 'Slot')}: ${armorSlotFilter}`} size="small" />}
              {shipComponentFiltersEnabled && shipComponentFamilyFilter && (
                <AppChip
                  label={`${t('Component family', 'Famille composant')}: ${getShipComponentFamilyLabel(shipComponentFamilyFilter, lang)}`}
                  size="small"
                />
              )}
              {shipComponentFiltersEnabled && shipComponentProfileFilter && (
                <AppChip
                  label={`${t('Component profile', 'Profil composant')}: ${shipComponentProfiles.find((option) => option.value === shipComponentProfileFilter)?.label ?? humanizeToken(shipComponentProfileFilter)}`}
                  size="small"
                />
              )}
              {shipComponentFiltersEnabled && shipComponentSizeFilter && (
                <AppChip
                  label={`${t('Component size', 'Taille composant')}: S${shipComponentSizeFilter}`}
                  size="small"
                />
              )}
              {shipComponentFiltersEnabled && shipComponentGradeFilter && (
                <AppChip
                  label={`${t('Component grade', 'Grade composant')}: ${shipComponentGradeFilter}`}
                  size="small"
                />
              )}
              {rarityFilter !== 'all' && <AppChip label={`${t('Rarity', 'Rareté')}: ${getOptionText(RARITY_OPTIONS.find((option) => option.value === rarityFilter) ?? RARITY_OPTIONS[0], lang)}`} size="small" />}
              {slotCountFilter !== 'all' && <AppChip label={`${t('Slots', 'Slots')}: ${slotCountFilter}`} size="small" />}
              {craftTimeFilter !== 'all' && <AppChip label={`${t('Craft time', 'Temps de craft')}: ${craftTimeFilter}`} size="small" />}
              {acquisitionEmployerFilter && <AppChip label={`${t('Employer', 'Employeur')}: ${acquisitionEmployerFilter}`} size="small" />}
              {acquisitionScaleFilter && <AppChip label={`${t('Scale', 'Portée')}: ${acquisitionScaleFilter}`} size="small" />}
              {acquisitionStandingFilter !== 'all' && <AppChip label={`${t('Standing', 'Réputation')}: ${getStandingLabel(acquisitionStandingFilter, lang)}`} size="small" />}
            </Stack>
          )}
        </Panel>
      </Collapse>
      </ResponsiveFilters>
    </Box>
  );
}
