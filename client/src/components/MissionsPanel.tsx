import { useMemo, useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import SearchIcon from '@mui/icons-material/Search';
import PlaceIcon from '@mui/icons-material/Place';
import StarIcon from '@mui/icons-material/Star';
import FlagIcon from '@mui/icons-material/Flag';
import GavelIcon from '@mui/icons-material/Gavel';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { CategoryBadge } from './ui/Badge';
import { tokens } from '../theme';
import {
  formatContractName,
  formatLocations,
  formatScaleLabel,
  formatStanding,
} from '../utils/crafting';
import type {
  MissionContract,
  MissionRewardFactionGroup,
} from '../types';

// ─── Filter bar ──────────────────────────────────────────────────────────────

function MissionsFilterBar({
  locations,
  scales,
  contractors,
  selectedLocation: locationFilter,
  selectedScale: scaleFilter,
  selectedLegality: legalityFilter,
  selectedContractor: contractorFilter,
  search,
  onLocationChange,
  onScaleChange,
  onLegalityChange,
  onContractorChange,
  onSearchChange,
}: {
  locations: string[];
  scales: string[];
  contractors: string[];
  selectedLocation: string | null;
  selectedScale: string | null;
  selectedLegality: string;
  selectedContractor: string | null;
  search: string;
  onLocationChange: (v: string | null) => void;
  onScaleChange: (v: string | null) => void;
  onLegalityChange: (v: string) => void;
  onContractorChange: (v: string | null) => void;
  onSearchChange: (v: string) => void;
}) {
  const { t } = useI18n();

  const hasActiveFilters =
    locationFilter !== null ||
    scaleFilter !== null ||
    contractorFilter !== null ||
    legalityFilter !== 'all';

  return (
    <Box
      component="section"
      aria-label={t('Mission filters', 'Filtres missions')}
      sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}
    >
      {/* Row 1: Search */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          type="search"
          size="small"
          placeholder={t('Search contracts...', 'Rechercher des contrats...')}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
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
          value={legalityFilter}
          exclusive
          onChange={(_e, val) => {
            if (val) onLegalityChange(val);
          }}
          size="small"
          aria-label={t('Legality filter', 'Filtre legalite')}
          sx={{ height: 32, '& .MuiToggleButton-root': { fontSize: '.65rem', px: 1.5 } }}
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

      {/* Row 2: Advanced filters */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Autocomplete
            size="small"
            options={contractors}
            value={contractorFilter}
            onChange={(_e, val) => onContractorChange(val)}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder={t('Contractor', 'Contractant')}
                sx={{ width: 160, '& .MuiInputBase-root': { fontSize: '.75rem', height: 28 } }}
              />
            )}
            slotProps={{ listbox: { sx: { fontSize: '.75rem' } } }}
          />

          <Autocomplete
            size="small"
            options={locations}
            value={locationFilter}
            onChange={(_e, val) => onLocationChange(val)}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder={t('Location', 'Lieu')}
                sx={{ width: 150, '& .MuiInputBase-root': { fontSize: '.75rem', height: 28 } }}
              />
            )}
            slotProps={{ listbox: { sx: { fontSize: '.75rem' } } }}
          />

          <Autocomplete
            size="small"
            options={scales}
            getOptionLabel={(s) => formatScaleLabel(s, 'en')}
            value={scaleFilter}
            onChange={(_e, val) => onScaleChange(val)}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder={t('Scale', 'Echelle')}
                sx={{ width: 150, '& .MuiInputBase-root': { fontSize: '.75rem', height: 28 } }}
              />
            )}
            slotProps={{ listbox: { sx: { fontSize: '.75rem' } } }}
          />

          {hasActiveFilters && (
            <Chip
              label={t('Clear', 'Effacer')}
              size="small"
              variant="outlined"
              onDelete={() => {
                onLocationChange(null);
                onScaleChange(null);
                onContractorChange(null);
                onLegalityChange('all');
              }}
              sx={{ height: 24, fontSize: '.6rem' }}
            />
          )}
        </Stack>
      </Box>
    </Box>
  );
}

// ─── Contract card ───────────────────────────────────────────────────────────

function ContractCard({
  contract,
  group,
  onBlueprintClick,
}: {
  contract: MissionContract;
  group: MissionRewardFactionGroup;
  onBlueprintClick: (blueprintId: string) => void;
}) {
  const { lang } = useI18n();
  const hasStanding = contract.minimumRequiredStandings.length > 0;
  const factionType = group.faction?.factionType?.toLowerCase() ?? '';
  const isUnlawful = factionType === 'unlawful';

  return (
    <Card
      sx={{
        borderColor: tokens.border,
        backgroundColor: tokens.surface1,
        transition: 'border-color 150ms, background-color 150ms',
        '&:hover': {
          borderColor: tokens.borderStrong,
          backgroundColor: tokens.surface2,
        },
      }}
    >
      <Box sx={{ display: 'flex', minHeight: 80 }}>
        {/* Left indicator zone */}
        <Box
          sx={{
            width: 6,
            minWidth: 6,
            backgroundColor: isUnlawful ? tokens.danger : tokens.success,
            opacity: 0.6,
          }}
          title={factionType || undefined}
        />

        {/* Content zone */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            p: '8px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          {/* Row 1: Contractor + scale */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <GavelIcon sx={{ fontSize: '.75rem', color: 'text.disabled' }} />
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  fontSize: '.6rem',
                  fontWeight: 600,
                }}
              >
                {group.contractorDisplayName}
              </Typography>
            </Box>
            <Chip
              label={formatScaleLabel(contract.availability.derivedScale, lang)}
              size="small"
              variant="outlined"
              sx={{
                height: 18,
                fontSize: '.5rem',
                borderColor: tokens.border,
                color: tokens.violet,
              }}
            />
          </Box>

          {/* Row 2: Contract name */}
          <Typography
            variant="body2"
            sx={{
              fontFamily: "'Khand', sans-serif",
              fontWeight: 700,
              fontSize: '.85rem',
              lineHeight: 1.2,
              color: 'text.primary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {formatContractName(contract.contractDebugName)}
          </Typography>

          {/* Row 3: Location + standing */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
              <PlaceIcon sx={{ fontSize: '.65rem', color: 'text.disabled' }} />
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '.55rem' }}>
                {formatLocations(contract, lang)}
              </Typography>
            </Box>
            {hasStanding && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <StarIcon sx={{ fontSize: '.65rem', color: 'text.disabled' }} />
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '.55rem' }}>
                  {formatStanding(contract, lang)}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Row 4: Blueprint reward chips */}
          {contract.rewardedBlueprints.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 'auto', pt: '2px' }}>
              {contract.rewardedBlueprints.map((bp) => (
                <Chip
                  key={bp.id}
                  label={bp.name}
                  icon={bp.category ? <CategoryBadge category={bp.category} iconOnly /> : undefined}
                  size="small"
                  variant="outlined"
                  onClick={(e) => {
                    e.stopPropagation();
                    onBlueprintClick(bp.id);
                  }}
                  sx={{
                    cursor: 'pointer',
                    height: 20,
                    fontSize: '.55rem',
                    '& .MuiChip-icon': { ml: '4px', mr: '-2px' },
                  }}
                />
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Card>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────

interface FlatContract {
  contract: MissionContract;
  group: MissionRewardFactionGroup;
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

  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [scaleFilter, setScaleFilter] = useState<string | null>(null);
  const [legalityFilter, setLegalityFilter] = useState('all');
  const [contractorFilter, setContractorFilter] = useState<string | null>(null);
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

  const allContractors = useMemo(() => {
    if (!missionRewards) return [];
    return missionRewards.factionGroups
      .map((g) => g.contractorDisplayName)
      .sort();
  }, [missionRewards]);

  const searchLower = search.toLowerCase().trim();

  const filteredContracts = useMemo<FlatContract[]>(() => {
    if (!missionRewards) return [];

    const results: FlatContract[] = [];

    for (const group of missionRewards.factionGroups) {
      // Legality filter at faction group level
      if (legalityFilter !== 'all') {
        const factionType = group.faction?.factionType?.toLowerCase() ?? '';
        if (factionType !== legalityFilter) continue;
      }

      // Contractor filter
      if (contractorFilter && group.contractorDisplayName !== contractorFilter) continue;

      for (const contract of group.contracts) {
        if (locationFilter) {
          const locs = [
            ...contract.availability.localities,
            ...contract.availability.explicitLocations,
          ];
          if (!locs.includes(locationFilter)) continue;
        }

        if (scaleFilter && contract.availability.derivedScale !== scaleFilter) continue;

        if (searchLower) {
          const haystack = [
            contract.contractDebugName ?? '',
            contract.contractorDisplayName ?? '',
            group.contractorDisplayName,
            ...contract.rewardedBlueprints.map((bp) => bp.name),
          ]
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(searchLower)) continue;
        }

        results.push({ contract, group });
      }
    }

    return results.sort((a, b) => {
      const nameA = formatContractName(a.contract.contractDebugName);
      const nameB = formatContractName(b.contract.contractDebugName);
      return nameA.localeCompare(nameB);
    });
  }, [missionRewards, locationFilter, scaleFilter, legalityFilter, contractorFilter, searchLower]);

  function handleBlueprintClick(blueprintId: string) {
    const bp = blueprints.find((b) => b.id === blueprintId);
    if (bp) {
      setActiveBlueprint(bp);
      setActiveItemTab('acquisition');
    }
  }

  if (missionRewardsLoading) {
    return (
      <Box sx={{ p: 3, color: 'text.secondary' }}>
        <Typography>{t('Loading mission rewards...', 'Chargement des recompenses de missions...')}</Typography>
      </Box>
    );
  }

  if (missionRewardsError) {
    return (
      <Box sx={{ p: 3, color: 'error.main' }}>
        <Typography>{missionRewardsError}</Typography>
      </Box>
    );
  }

  if (!missionRewards || missionRewards.factionGroups.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
        <FlagIcon sx={{ mb: 1, opacity: 0.4, fontSize: '3rem' }} />
        <Typography variant="h6">{t('No mission data', 'Aucune donnee de mission')}</Typography>
        <Typography variant="body2">
          {t(
            'Mission rewards are not available for this dataset.',
            'Les recompenses de missions ne sont pas disponibles pour ce dataset.',
          )}
        </Typography>
      </Box>
    );
  }

  const summary = missionRewards.summary;

  return (
    <Box>
      {/* Filter bar */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', backgroundColor: 'background.paper' }}>
        <MissionsFilterBar
          locations={allLocations}
          scales={allScales}
          contractors={allContractors}
          selectedLocation={locationFilter}
          selectedScale={scaleFilter}
          selectedLegality={legalityFilter}
          selectedContractor={contractorFilter}
          search={search}
          onLocationChange={setLocationFilter}
          onScaleChange={setScaleFilter}
          onLegalityChange={setLegalityFilter}
          onContractorChange={setContractorFilter}
          onSearchChange={setSearch}
        />
      </Box>

      {/* Content */}
      <Box sx={{ p: 2 }}>
        {/* Summary + count */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }} aria-live="polite">
            {filteredContracts.length} {t('contracts', 'contrats')}
          </Typography>
          {summary && (
            <Box sx={{ display: 'flex', gap: 1.5, fontSize: '.65rem', color: 'text.disabled' }}>
              <span>{summary.factionGroupCount} {t('factions', 'factions')}</span>
              <span>{summary.uniqueBlueprintPoolCount} {t('blueprints', 'blueprints')}</span>
            </Box>
          )}
        </Box>

        {/* Contract grid */}
        {filteredContracts.length === 0 ? (
          <Typography sx={{ color: 'text.secondary', py: 3, textAlign: 'center' }} role="status">
            {t('No contracts match your filters.', 'Aucun contrat ne correspond a vos filtres.')}
          </Typography>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
              gap: 1,
            }}
            role="list"
            aria-label={t('Contract list', 'Liste des contrats')}
          >
            {filteredContracts.map(({ contract, group }) => (
              <ContractCard
                key={`${contract.contractFile ?? ''}-${contract.contractDebugName ?? ''}`}
                contract={contract}
                group={group}
                onBlueprintClick={handleBlueprintClick}
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
