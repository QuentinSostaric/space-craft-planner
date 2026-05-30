import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
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

/**
 * Library/blueprint filter state.
 *
 * Extracted out of CraftContext so that changing a filter (or typing in the
 * search box) only re-renders components that actually read filters — not every
 * consumer of the much larger CraftContext (dataset, planner, comparison…).
 * FilterProvider is mounted *inside* CraftProvider, so filter updates never
 * re-render the data provider above it.
 */
export interface FilterState {
  categoryFilter: CategoryFilter;
  searchQuery: string;
  librarySegment: LibrarySegment;
  manufacturerFilter: string | null;
  shipComponentFamilyFilter: string | null;
  shipComponentProfileFilter: string | null;
  shipComponentSizeFilter: string | null;
  shipComponentGradeFilter: string | null;
  legalityFilter: LegalityFilter;
  locationFilter: string | null;
  materialFilter: string | null;
  rarityFilter: RarityFilter;
  slotCountFilter: SlotCountFilter;
  craftTimeFilter: CraftTimeBucket;
  weaponTypeFilter: string | null;
  ammoTypeFilter: string | null;
  ammoFlavorFilter: string | null;
  armorTypeFilter: string | null;
  armorSlotFilter: string | null;
  acquisitionEmployerFilter: string | null;
  acquisitionScaleFilter: string | null;
  acquisitionStandingFilter: StandingBucket;
  blueprintSort: BlueprintSort;
  setCategoryFilter: (cat: CategoryFilter) => void;
  setSearchQuery: (q: string) => void;
  setLibrarySegment: (segment: LibrarySegment) => void;
  setManufacturerFilter: (manufacturer: string | null) => void;
  setShipComponentFamilyFilter: (family: string | null) => void;
  setShipComponentProfileFilter: (profile: string | null) => void;
  setShipComponentSizeFilter: (size: string | null) => void;
  setShipComponentGradeFilter: (grade: string | null) => void;
  setLegalityFilter: (legality: LegalityFilter) => void;
  setLocationFilter: (location: string | null) => void;
  setMaterialFilter: (material: string | null) => void;
  setRarityFilter: (rarity: RarityFilter) => void;
  setSlotCountFilter: (count: SlotCountFilter) => void;
  setCraftTimeFilter: (bucket: CraftTimeBucket) => void;
  setWeaponTypeFilter: (weaponType: string | null) => void;
  setAmmoTypeFilter: (ammoType: string | null) => void;
  setAmmoFlavorFilter: (ammoFlavor: string | null) => void;
  setArmorTypeFilter: (armorType: string | null) => void;
  setArmorSlotFilter: (armorSlot: string | null) => void;
  setAcquisitionEmployerFilter: (employer: string | null) => void;
  setAcquisitionScaleFilter: (scale: string | null) => void;
  setAcquisitionStandingFilter: (bucket: StandingBucket) => void;
  setBlueprintSort: (sort: BlueprintSort) => void;
}

const FilterContext = createContext<FilterState | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [librarySegment, setLibrarySegment] = useState<LibrarySegment>('obtainable');
  const [manufacturerFilter, setManufacturerFilter] = useState<string | null>(null);
  const [shipComponentFamilyFilter, setShipComponentFamilyFilter] = useState<string | null>(null);
  const [shipComponentProfileFilter, setShipComponentProfileFilter] = useState<string | null>(null);
  const [shipComponentSizeFilter, setShipComponentSizeFilter] = useState<string | null>(null);
  const [shipComponentGradeFilter, setShipComponentGradeFilter] = useState<string | null>(null);
  const [legalityFilter, setLegalityFilter] = useState<LegalityFilter>('all');
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [materialFilter, setMaterialFilter] = useState<string | null>(null);
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>('all');
  const [slotCountFilter, setSlotCountFilter] = useState<SlotCountFilter>('all');
  const [craftTimeFilter, setCraftTimeFilter] = useState<CraftTimeBucket>('all');
  const [weaponTypeFilter, setWeaponTypeFilter] = useState<string | null>(null);
  const [ammoTypeFilter, setAmmoTypeFilter] = useState<string | null>(null);
  const [ammoFlavorFilter, setAmmoFlavorFilter] = useState<string | null>(null);
  const [armorTypeFilter, setArmorTypeFilter] = useState<string | null>(null);
  const [armorSlotFilter, setArmorSlotFilter] = useState<string | null>(null);
  const [acquisitionEmployerFilter, setAcquisitionEmployerFilter] = useState<string | null>(null);
  const [acquisitionScaleFilter, setAcquisitionScaleFilter] = useState<string | null>(null);
  const [acquisitionStandingFilter, setAcquisitionStandingFilter] = useState<StandingBucket>('all');
  const [blueprintSort, setBlueprintSort] = useState<BlueprintSort>('name-asc');

  // Setters from useState are stable, so the value only changes when an actual
  // filter value changes.
  const value = useMemo<FilterState>(
    () => ({
      categoryFilter,
      searchQuery,
      librarySegment,
      manufacturerFilter,
      shipComponentFamilyFilter,
      shipComponentProfileFilter,
      shipComponentSizeFilter,
      shipComponentGradeFilter,
      legalityFilter,
      locationFilter,
      materialFilter,
      rarityFilter,
      slotCountFilter,
      craftTimeFilter,
      weaponTypeFilter,
      ammoTypeFilter,
      ammoFlavorFilter,
      armorTypeFilter,
      armorSlotFilter,
      acquisitionEmployerFilter,
      acquisitionScaleFilter,
      acquisitionStandingFilter,
      blueprintSort,
      setCategoryFilter,
      setSearchQuery,
      setLibrarySegment,
      setManufacturerFilter,
      setShipComponentFamilyFilter,
      setShipComponentProfileFilter,
      setShipComponentSizeFilter,
      setShipComponentGradeFilter,
      setLegalityFilter,
      setLocationFilter,
      setMaterialFilter,
      setRarityFilter,
      setSlotCountFilter,
      setCraftTimeFilter,
      setWeaponTypeFilter,
      setAmmoTypeFilter,
      setAmmoFlavorFilter,
      setArmorTypeFilter,
      setArmorSlotFilter,
      setAcquisitionEmployerFilter,
      setAcquisitionScaleFilter,
      setAcquisitionStandingFilter,
      setBlueprintSort,
    }),
    [
      categoryFilter,
      searchQuery,
      librarySegment,
      manufacturerFilter,
      shipComponentFamilyFilter,
      shipComponentProfileFilter,
      shipComponentSizeFilter,
      shipComponentGradeFilter,
      legalityFilter,
      locationFilter,
      materialFilter,
      rarityFilter,
      slotCountFilter,
      craftTimeFilter,
      weaponTypeFilter,
      ammoTypeFilter,
      ammoFlavorFilter,
      armorTypeFilter,
      armorSlotFilter,
      acquisitionEmployerFilter,
      acquisitionScaleFilter,
      acquisitionStandingFilter,
      blueprintSort,
    ],
  );

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilters(): FilterState {
  const ctx = useContext(FilterContext);
  if (!ctx) {
    throw new Error('useFilters must be used inside FilterProvider');
  }
  return ctx;
}
