import { useMemo, useState } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import SearchIcon from '@mui/icons-material/Search';
import PlaceIcon from '@mui/icons-material/Place';
import StarIcon from '@mui/icons-material/Star';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FlagIcon from '@mui/icons-material/Flag';
import type { SelectChangeEvent } from '@mui/material/Select';
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
  MissionRewardsData,
} from '../types';

function MissionsSummaryBanner({ summary }: { summary: MissionRewardsData['summary'] }) {
  const { t } = useI18n();
  if (!summary) return null;

  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', fontSize: '.75rem', color: 'text.secondary' }}>
      <span><strong>{summary.blueprintRewardContractCount}</strong> {t('contracts', 'contrats')}</span>
      <span aria-hidden="true">·</span>
      <span><strong>{summary.factionGroupCount}</strong> {t('factions', 'factions')}</span>
      <span aria-hidden="true">·</span>
      <span><strong>{summary.uniqueBlueprintPoolCount}</strong> {t('blueprints', 'blueprints')}</span>
    </Box>
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

  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel>{t('Location', 'Lieu')}</InputLabel>
        <Select
          value={selectedLocation}
          onChange={(e: SelectChangeEvent) => onLocationChange(e.target.value)}
          label={t('Location', 'Lieu')}
          sx={{ fontSize: '.78rem' }}
        >
          <MenuItem value="">{t('All locations', 'Tous les lieux')}</MenuItem>
          {locations.map((loc) => (
            <MenuItem key={loc} value={loc}>{loc}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel>{t('Scale', 'Echelle')}</InputLabel>
        <Select
          value={selectedScale}
          onChange={(e: SelectChangeEvent) => onScaleChange(e.target.value)}
          label={t('Scale', 'Echelle')}
          sx={{ fontSize: '.78rem' }}
        >
          <MenuItem value="">{t('All scales', 'Toutes les echelles')}</MenuItem>
          {scales.map((s) => (
            <MenuItem key={s} value={s}>{formatScaleLabel(s, lang)}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <TextField
        type="search"
        size="small"
        placeholder={t('Search contracts...', 'Rechercher des contrats...')}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        label={t('Search', 'Rechercher')}
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
        sx={{ flex: 1, minWidth: 140, '& .MuiInputBase-root': { fontSize: '.78rem' } }}
      />
    </Box>
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
  const hasStanding = contract.minimumRequiredStandings.length > 0;

  return (
    <Card sx={{ mb: 1, backgroundColor: tokens.surface1 }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        {/* Blueprint rewards */}
        {contract.rewardedBlueprints.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
            {contract.rewardedBlueprints.map((bp) => (
              <Chip
                key={bp.id}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {bp.category && <CategoryBadge category={bp.category} iconOnly />}
                    <span>{bp.name}</span>
                  </Box>
                }
                size="small"
                variant="outlined"
                onClick={() => onBlueprintClick(bp.id)}
                title={bp.manufacturer ? `${bp.name} (${bp.manufacturer})` : bp.name}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Box>
        )}

        {/* Contract name + scale */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '.78rem' }}>
            {formatContractName(contract.contractDebugName)}
          </Typography>
          <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600, fontSize: '.62rem', textTransform: 'uppercase' }}>
            {formatScaleLabel(contract.availability.derivedScale, lang)}
          </Typography>
        </Box>

        {/* Location + standing */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, fontSize: '.68rem', color: 'text.secondary' }}>
          <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            <PlaceIcon sx={{ fontSize: '.8rem' }} /> {formatLocations(contract, lang)}
          </Box>
          {hasStanding && (
            <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
              <StarIcon sx={{ fontSize: '.8rem' }} /> {formatStanding(contract, lang)}
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
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
  const factionType = group.faction?.factionType ?? null;
  const scopeNames = group.reputationScopes
    .map((s) => s.displayName ?? s.scopeName)
    .filter(Boolean)
    .join(', ');

  return (
    <Accordion>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon sx={{ fontSize: '1.2rem' }} />}
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: "'Khand', sans-serif" }}>
            {group.contractorDisplayName}
          </Typography>
          {scopeNames && (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '.62rem' }}>
              {scopeNames}
            </Typography>
          )}
          {factionType && (
            <Chip
              label={factionType}
              size="small"
              variant="outlined"
              sx={{ ml: 'auto', fontSize: '.55rem', height: 18 }}
            />
          )}
          <Typography
            variant="caption"
            sx={{ ml: factionType ? 1 : 'auto', fontFamily: "'Share Tech Mono', monospace", fontWeight: 600 }}
          >
            {filteredContracts.length}
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 1 }}>
        {filteredContracts.map((contract) => (
          <ContractCard
            key={`${contract.contractFile ?? ''}-${contract.contractDebugName ?? ''}`}
            contract={contract}
            onBlueprintClick={onBlueprintClick}
          />
        ))}
      </AccordionDetails>
    </Accordion>
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
          {t('Mission rewards are not available for this dataset.', 'Les recompenses de missions ne sont pas disponibles pour ce dataset.')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      component="section"
      aria-label={t('Missions browser', 'Explorateur de missions')}
      sx={{ p: 2 }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography
          variant="h6"
          sx={{ fontFamily: "'Khand', sans-serif", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}
        >
          {t('Missions', 'Missions')}
        </Typography>
        <MissionsSummaryBanner summary={missionRewards.summary} />
      </Box>

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

      <Box>
        {filteredGroups.length === 0 ? (
          <Typography sx={{ color: 'text.secondary', py: 3, textAlign: 'center' }}>
            {t('No contracts match your filters.', 'Aucun contrat ne correspond a vos filtres.')}
          </Typography>
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
      </Box>
    </Box>
  );
}
