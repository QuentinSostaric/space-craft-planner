import { useId, useMemo, useState } from 'react';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { CategoryBadge } from './ui/Badge';
import {
  formatLocations,
  formatScaleLabel,
  formatStanding,
} from '../utils/crafting';
import type {
  MissionContract,
  MissionRewardFactionGroup,
  MissionRewardsData,
} from '../types';

function MissionsSummaryBanner({ summary }: { summary: MissionRewardsData['summary'] }) {
  const { t } = useI18n();
  if (!summary) return null;

  return (
    <div className="missions-banner">
      <span className="missions-banner__stat">
        <strong>{summary.blueprintRewardContractCount}</strong> {t('contracts', 'contrats')}
      </span>
      <span className="missions-banner__sep" aria-hidden="true">·</span>
      <span className="missions-banner__stat">
        <strong>{summary.factionGroupCount}</strong> {t('factions', 'factions')}
      </span>
      <span className="missions-banner__sep" aria-hidden="true">·</span>
      <span className="missions-banner__stat">
        <strong>{summary.uniqueBlueprintPoolCount}</strong> {t('blueprints', 'blueprints')}
      </span>
    </div>
  );
}

function MissionsFilterBar({
  locations,
  scales,
  selectedLocation,
  selectedScale,
  search,
  onLocationChange,
  onScaleChange,
  onSearchChange,
}: {
  locations: string[];
  scales: string[];
  selectedLocation: string;
  selectedScale: string;
  search: string;
  onLocationChange: (v: string) => void;
  onScaleChange: (v: string) => void;
  onSearchChange: (v: string) => void;
}) {
  const { lang, t } = useI18n();
  const searchId = useId();
  const locationId = useId();
  const scaleId = useId();

  return (
    <div className="missions-filters">
      <div className="missions-filters__field">
        <label className="sr-only" htmlFor={locationId}>{t('Location', 'Lieu')}</label>
        <select
          id={locationId}
          className="missions-filters__select"
          value={selectedLocation}
          onChange={(e) => onLocationChange(e.target.value)}
        >
          <option value="">{t('All locations', 'Tous les lieux')}</option>
          {locations.map((loc) => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </select>
      </div>
      <div className="missions-filters__field">
        <label className="sr-only" htmlFor={scaleId}>{t('Scale', 'Echelle')}</label>
        <select
          id={scaleId}
          className="missions-filters__select"
          value={selectedScale}
          onChange={(e) => onScaleChange(e.target.value)}
        >
          <option value="">{t('All scales', 'Toutes les echelles')}</option>
          {scales.map((s) => (
            <option key={s} value={s}>{formatScaleLabel(s, lang)}</option>
          ))}
        </select>
      </div>
      <div className="missions-filters__field missions-filters__field--grow">
        <label className="sr-only" htmlFor={searchId}>{t('Search', 'Rechercher')}</label>
        <input
          id={searchId}
          type="search"
          className="missions-filters__search"
          placeholder={t('Search contracts...', 'Rechercher des contrats...')}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
    </div>
  );
}

function ContractCard({
  contract,
  onBlueprintClick,
}: {
  contract: MissionContract;
  onBlueprintClick: (blueprintId: string) => void;
}) {
  const { lang } = useI18n();

  return (
    <div className="contract-card">
      <div className="contract-card__head">
        <span className="contract-card__name">
          {contract.contractDebugName ?? 'Unknown contract'}
        </span>
        <span className="contract-card__scale">
          {formatScaleLabel(contract.availability.derivedScale, lang)}
        </span>
      </div>
      <p className="contract-card__meta">
        {formatLocations(contract, lang)}
      </p>
      <p className="contract-card__meta">
        {formatStanding(contract, lang)}
      </p>
      {contract.rewardedBlueprints.length > 0 && (
        <div className="contract-card__rewards">
          {contract.rewardedBlueprints.map((bp) => (
            <button
              key={bp.id}
              className="contract-card__bp-chip"
              onClick={() => onBlueprintClick(bp.id)}
              title={`${bp.name}${bp.manufacturer ? ` (${bp.manufacturer})` : ''}`}
            >
              {bp.category && <CategoryBadge category={bp.category} iconOnly />}
              <span className="contract-card__bp-chip-name">{bp.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FactionAccordion({
  group,
  filteredContracts,
  onBlueprintClick,
}: {
  group: MissionRewardFactionGroup;
  filteredContracts: MissionContract[];
  onBlueprintClick: (blueprintId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const factionType = group.faction?.factionType ?? null;
  const scopeNames = group.reputationScopes
    .map((s) => s.displayName ?? s.scopeName)
    .filter(Boolean)
    .join(', ');

  return (
    <div className="faction-accordion">
      <button
        className="faction-accordion__header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="faction-accordion__chevron" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
        <span className="faction-accordion__name">{group.contractorDisplayName}</span>
        {factionType && (
          <span className={`faction-accordion__type faction-accordion__type--${factionType.toLowerCase()}`}>
            {factionType}
          </span>
        )}
        {scopeNames && (
          <span className="faction-accordion__scopes">{scopeNames}</span>
        )}
        <span className="faction-accordion__count">
          {filteredContracts.length}
        </span>
      </button>
      {open && (
        <div className="faction-accordion__body">
          {filteredContracts.map((contract) => (
            <ContractCard
              key={`${contract.contractFile ?? ''}-${contract.contractDebugName ?? ''}`}
              contract={contract}
              onBlueprintClick={onBlueprintClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function MissionsPanel() {
  const {
    missionRewards,
    missionRewardsLoading,
    missionRewardsError,
    blueprints,
    setActiveBlueprint,
    setActiveItemTab,
  } = useCraft();
  const { t } = useI18n();

  const [locationFilter, setLocationFilter] = useState('');
  const [scaleFilter, setScaleFilter] = useState('');
  const [search, setSearch] = useState('');

  const allLocations = useMemo(() => {
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

  const allScales = useMemo(() => {
    if (!missionRewards) return [];
    const set = new Set<string>();
    for (const group of missionRewards.factionGroups) {
      for (const contract of group.contracts) {
        set.add(contract.availability.derivedScale);
      }
    }
    return [...set].sort();
  }, [missionRewards]);

  const searchLower = search.toLowerCase().trim();

  const filteredGroups = useMemo(() => {
    if (!missionRewards) return [];

    return missionRewards.factionGroups
      .map((group) => {
        const contracts = group.contracts.filter((contract) => {
          if (locationFilter) {
            const locs = [
              ...contract.availability.localities,
              ...contract.availability.explicitLocations,
            ];
            if (!locs.includes(locationFilter)) return false;
          }

          if (scaleFilter && contract.availability.derivedScale !== scaleFilter) {
            return false;
          }

          if (searchLower) {
            const haystack = [
              contract.contractDebugName ?? '',
              contract.contractorDisplayName ?? '',
              ...contract.rewardedBlueprints.map((bp) => bp.name),
            ]
              .join(' ')
              .toLowerCase();
            if (!haystack.includes(searchLower)) return false;
          }

          return true;
        });

        return { group, contracts };
      })
      .filter(({ contracts }) => contracts.length > 0)
      .sort((a, b) => b.contracts.length - a.contracts.length);
  }, [missionRewards, locationFilter, scaleFilter, searchLower]);

  function handleBlueprintClick(blueprintId: string) {
    const bp = blueprints.find((b) => b.id === blueprintId);
    if (bp) {
      setActiveBlueprint(bp);
      setActiveItemTab('acquisition');
    }
  }

  if (missionRewardsLoading) {
    return (
      <section className="missions-panel missions-panel--loading">
        <p>{t('Loading mission rewards...', 'Chargement des recompenses de missions...')}</p>
      </section>
    );
  }

  if (missionRewardsError) {
    return (
      <section className="missions-panel missions-panel--error">
        <p>{missionRewardsError}</p>
      </section>
    );
  }

  if (!missionRewards || missionRewards.factionGroups.length === 0) {
    return (
      <section className="missions-panel missions-panel--empty">
        <div className="missions-panel__empty-state">
          <span className="missions-panel__empty-icon" aria-hidden="true">⚑</span>
          <h2>{t('No mission data', 'Aucune donnee de mission')}</h2>
          <p>{t('Mission rewards are not available for this dataset.', 'Les recompenses de missions ne sont pas disponibles pour ce dataset.')}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="missions-panel" aria-label={t('Missions browser', 'Explorateur de missions')}>
      <header className="missions-panel__header">
        <h2 className="missions-panel__title">{t('Missions', 'Missions')}</h2>
        <MissionsSummaryBanner summary={missionRewards.summary} />
      </header>

      <MissionsFilterBar
        locations={allLocations}
        scales={allScales}
        selectedLocation={locationFilter}
        selectedScale={scaleFilter}
        search={search}
        onLocationChange={setLocationFilter}
        onScaleChange={setScaleFilter}
        onSearchChange={setSearch}
      />

      <div className="missions-panel__body">
        {filteredGroups.length === 0 ? (
          <p className="missions-panel__no-results">
            {t('No contracts match your filters.', 'Aucun contrat ne correspond a vos filtres.')}
          </p>
        ) : (
          filteredGroups.map(({ group, contracts }) => (
            <FactionAccordion
              key={group.contractorDisplayName}
              group={group}
              filteredContracts={contracts}
              onBlueprintClick={handleBlueprintClick}
            />
          ))
        )}
      </div>
    </section>
  );
}
