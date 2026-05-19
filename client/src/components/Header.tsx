import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import SearchIcon from '@mui/icons-material/Search';
import { alpha } from '@mui/material/styles';
import { useEffect, useMemo } from 'react';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { FONT_MONO } from '../theme';
import {
  missionPathFromSlug,
  missionSlugFromContract,
  navigateToPath,
  resourcePathFromSlug,
} from '../utils/slug';
import { getMissionContractName, isPlaceholderResource } from '../utils/crafting';
import type { Blueprint, MissionContract, MissionRewardFactionGroup, Resource } from '../types';

const DISPLAY_APP_VERSION = __APP_VERSION__.replace(/\.0$/, '');

const MONTH_NAMES = {
  en: [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ],
  fr: [
    'janvier',
    'fevrier',
    'mars',
    'avril',
    'mai',
    'juin',
    'juillet',
    'aout',
    'septembre',
    'octobre',
    'novembre',
    'decembre',
  ],
  de: [
    'Januar',
    'Februar',
    'Marz',
    'April',
    'Mai',
    'Juni',
    'Juli',
    'August',
    'September',
    'Oktober',
    'November',
    'Dezember',
  ],
} as const;

const MANIFEST_MONTH_INDEX = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
} as const;

type GlobalSearchOption =
  | { kind: 'blueprint'; key: string; label: string; description: string; blueprint: Blueprint }
  | { kind: 'resource'; key: string; label: string; description: string; resource: Resource }
  | {
      kind: 'mission';
      key: string;
      label: string;
      description: string;
      contract: MissionContract;
      group: MissionRewardFactionGroup;
    };

function getDatasetBuildDateParts(
  buildDateStamp: string | null,
  importedAt: string | null,
): { day: number; monthIndex: number; year: number } | null {
  if (buildDateStamp) {
    const normalizedStamp = buildDateStamp.trim();

    const manifestMatch = normalizedStamp.match(/^[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})$/);
    if (manifestMatch) {
      const monthIndex = MANIFEST_MONTH_INDEX[manifestMatch[1].toLowerCase() as keyof typeof MANIFEST_MONTH_INDEX];
      if (monthIndex != null) {
        return {
          day: Number(manifestMatch[2]),
          monthIndex,
          year: Number(manifestMatch[3]),
        };
      }
    }

    const isoDateMatch = normalizedStamp.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoDateMatch) {
      return {
        day: Number(isoDateMatch[3]),
        monthIndex: Number(isoDateMatch[2]) - 1,
        year: Number(isoDateMatch[1]),
      };
    }
  }

  if (!importedAt) {
    return null;
  }

  const importedAtDate = new Date(importedAt);
  if (Number.isNaN(importedAtDate.getTime())) {
    return null;
  }

  return {
    day: importedAtDate.getUTCDate(),
    monthIndex: importedAtDate.getUTCMonth(),
    year: importedAtDate.getUTCFullYear(),
  };
}

function formatDatasetBuildDate(
  buildDateStamp: string | null,
  importedAt: string | null,
  lang: 'en' | 'fr' | 'de',
) {
  const dateParts = getDatasetBuildDateParts(buildDateStamp, importedAt);
  if (!dateParts) {
    return null;
  }

  const { day, monthIndex, year } = dateParts;
  const month = MONTH_NAMES[lang][monthIndex];

  if (lang === 'en') {
    return `${month} ${day}, ${year}`;
  }

  if (lang === 'de') {
    return `${day}. ${month} ${year}`;
  }

  return `${day} ${month} ${year}`;
}

function formatLiveDatasetVersion(version: string): string {
  const match = version.match(/^(\d+\.\d+)/);
  return match?.[1] ?? version;
}

export function Header() {
  const {
    activeDataset,
    availableDatasets,
    activeChannel,
    setActiveDatasetChannel,
    setActiveBlueprint,
    ensureMissionRewardsLoaded,
    ensureFactionContractsLoaded,
    factionContractsByFactionId,
  } = useCraft();
  const { lang, setLang, t } = useI18n();
  const isHeaderStacked = useMediaQuery('(max-width:430px)');
  const isWideHeader = useMediaQuery('(min-width:1120px)');

  const availableChannels = useMemo(
    () => new Set(availableDatasets.map((dataset) => dataset.channel)),
    [availableDatasets, activeChannel, activeDataset],
  );
  const formatDatasetLabel = useMemo(
    () => (dataset: {
      version: string;
      label: string;
      buildDateStamp: string | null;
      importedAt: string | null;
    }) => {
      if (activeChannel === 'live') {
        return formatLiveDatasetVersion(dataset.version);
      }

      const formattedDate = formatDatasetBuildDate(dataset.buildDateStamp, dataset.importedAt, lang);
      return formattedDate ? `${dataset.version} • ${formattedDate}` : dataset.label;
    },
    [activeChannel, lang],
  );
  useEffect(() => {
    if (activeDataset.datasetId) {
      void ensureMissionRewardsLoaded();
    }
  }, [activeDataset.datasetId, ensureMissionRewardsLoaded]);

  useEffect(() => {
    const factionGroups = activeDataset.missionRewards?.factionGroups ?? [];
    for (const group of factionGroups) {
      if (
        !group.id ||
        (group.contracts?.length ?? 0) > 0 ||
        Object.prototype.hasOwnProperty.call(factionContractsByFactionId, group.id)
      ) {
        continue;
      }

      void ensureFactionContractsLoaded(group.id);
    }
  }, [activeDataset.missionRewards?.factionGroups, ensureFactionContractsLoaded, factionContractsByFactionId]);

  const globalSearchOptions = useMemo<GlobalSearchOption[]>(() => {
    const blueprintOptions: GlobalSearchOption[] = activeDataset.blueprints.map((blueprint) => ({
      kind: 'blueprint',
      key: `blueprint:${blueprint.id}`,
      label: blueprint.name,
      description: [blueprint.manufacturer, blueprint.category].filter(Boolean).join(' / '),
      blueprint,
    }));

    const resourceOptions: GlobalSearchOption[] = activeDataset.resources
      .filter((resource) => !isPlaceholderResource(resource))
      .map((resource) => ({
        kind: 'resource',
        key: `resource:${resource.id}`,
        label: resource.name,
        description: t('Resource', 'Ressource', 'Ressource'),
        resource,
      }));

    const missionOptions: GlobalSearchOption[] = [];
    for (const group of activeDataset.missionRewards?.factionGroups ?? []) {
      for (const contract of factionContractsByFactionId[group.id] ?? group.contracts ?? []) {
        const missionKey = [
          group.id,
          contract.contractFile,
          contract.handlerDebugName,
          contract.contractDebugName,
          missionOptions.length,
        ].filter(Boolean).join(':');
        missionOptions.push({
          kind: 'mission',
          key: `mission:${missionKey}`,
          label: getMissionContractName(contract),
          description: group.contractorDisplayName,
          contract,
          group,
        });
      }
    }

    return [...blueprintOptions, ...resourceOptions, ...missionOptions];
  }, [
    activeDataset.blueprints,
    activeDataset.missionRewards?.factionGroups,
    activeDataset.resources,
    factionContractsByFactionId,
    t,
  ]);

  const handleSearchSelect = (_event: unknown, option: GlobalSearchOption | null) => {
    if (!option) return;

    if (option.kind === 'blueprint') {
      setActiveBlueprint(option.blueprint);
      return;
    }

    if (option.kind === 'resource') {
      navigateToPath(resourcePathFromSlug(option.resource.id), {
        mainView: 'resources',
        resourceId: option.resource.id,
      });
      return;
    }

    const missionSlug = missionSlugFromContract(option.contract.contractDebugName, option.group.contractorDisplayName);
    navigateToPath(missionPathFromSlug(missionSlug), {
      mainView: 'missions',
      missionSlug,
    });
  };

  return (
    <AppBar
      position="relative"
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        boxShadow: 'none',
        '&::after': {
          content: '""',
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '1px',
          background: (theme) => `linear-gradient(to right, ${theme.palette.brand.violet}, ${theme.palette.brand.blue})`,
          opacity: 0.3,
          pointerEvents: 'none',
        },
      }}
    >
      <Toolbar
        sx={{
          px: { xs: 1, sm: 2.5, lg: 3 },
          py: { xs: 0.75, md: 1 },
          minHeight: { xs: 64, md: 74 },
          gap: { xs: 0.75, md: 1.5, lg: 2 },
          flexWrap: isHeaderStacked ? 'wrap' : 'nowrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: { xs: 0.5, md: 1.5 },
            minWidth: 0,
            width: isHeaderStacked ? '100%' : 'auto',
            flex: '1 1 auto',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: { xs: 1, md: 2 },
              minWidth: 0,
              flex: '1 1 auto',
            }}
          >
            <Box
              component="img"
              src="/logo.svg"
              alt="Item Fabricator"
              sx={{
                width: { xs: 0, sm: 210, lg: 244 },
                height: { xs: 0, sm: 38, lg: 42 },
                display: { xs: 'none', sm: 'block' },
                objectFit: 'contain',
                objectPosition: 'left center',
                flexShrink: 0,
              }}
            />

            <Autocomplete
              size="small"
              blurOnSelect
              clearOnBlur
              options={globalSearchOptions}
              getOptionLabel={(option) => option.label}
              getOptionKey={(option) => option.key}
              groupBy={(option) =>
                option.kind === 'blueprint'
                  ? t('Blueprints', 'Blueprints')
                  : option.kind === 'resource'
                    ? t('Resources', 'Ressources')
                    : t('Missions', 'Missions')
              }
              filterOptions={(options, state) => {
                const query = state.inputValue.trim().toLowerCase();
                if (!query) return options;
                return options
                  .filter((option) =>
                    `${option.label} ${option.description}`.toLowerCase().includes(query),
                  );
              }}
              onChange={handleSearchSelect}
              sx={{
                width: {
                  xs: '100%',
                  sm: 'min(48vw, 420px)',
                  lg: isWideHeader ? 'clamp(360px, 34vw, 560px)' : 'min(38vw, 420px)',
                },
                minWidth: { sm: 240 },
                flex: { xs: '1 1 auto', md: '0 1 auto' },
                '& .MuiInputBase-root': {
                  height: 38,
                  backgroundColor: (theme) => alpha(theme.palette.background.default, 0.22),
                  borderRadius: 1,
                },
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder={t('Search blueprints, resources, missions...', 'Rechercher blueprints, ressources, missions...')}
                  inputProps={{
                    ...params.inputProps,
                    'aria-label': t('Global search', 'Recherche globale'),
                  }}
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                      </InputAdornment>
                    ),
                  }}
                />
              )}
              renderOption={(props, option) => {
                const { key, ...optionProps } = props;
                return (
                  <Box
                    key={option.key}
                    component="li"
                    {...optionProps}
                    sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.15 }}>
                      {option.label}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.15 }}>
                      {option.description}
                    </Typography>
                  </Box>
                );
              }}
            />
          </Box>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              flexShrink: 0,
              borderLeft: { xs: 'none', lg: (theme) => `1px solid ${theme.palette.divider}` },
              pl: { xs: 0, lg: 1.5 },
            }}
          >
            <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: FONT_MONO, display: { xs: 'none', xl: 'block' } }}>
              v{DISPLAY_APP_VERSION}
            </Typography>
            <ToggleButtonGroup
              value={lang}
              exclusive
              onChange={(_e, val) => {
                if (val) setLang(val);
              }}
              size="small"
              aria-label={t('Language', 'Langue')}
              sx={{ height: 32, ml: { xs: 0.25, sm: 0.5 } }}
            >
              <ToggleButton value="en" sx={{ px: { xs: 0.55, md: 1 }, fontSize: '0.66rem', fontWeight: 700, minWidth: { xs: 32, md: 40 } }}>
                EN
              </ToggleButton>
              <ToggleButton value="fr" sx={{ px: { xs: 0.55, md: 1 }, fontSize: '0.66rem', fontWeight: 700, minWidth: { xs: 32, md: 40 } }}>
                FR
              </ToggleButton>
              <ToggleButton value="de" sx={{ px: { xs: 0.55, md: 1 }, fontSize: '0.66rem', fontWeight: 700, minWidth: { xs: 32, md: 40 } }}>
                DE
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 0.75, md: 1 },
            width: isHeaderStacked ? '100%' : 'auto',
            flexWrap: 'nowrap',
            justifyContent: isHeaderStacked ? 'stretch' : 'flex-end',
            position: 'relative',
            zIndex: 1,
            flexShrink: 0,
            flexDirection: 'row',
            alignSelf: 'center',
          }}
        >
          <ToggleButtonGroup
            value={activeChannel}
            exclusive
            onChange={(_e, val) => {
              if (val) void setActiveDatasetChannel(val);
            }}
            size="small"
            aria-label={t('Dataset channel', 'Canal du dataset')}
            sx={{
              height: 32,
              flexShrink: 0,
              width: 'auto',
              '& .MuiToggleButton-root': {
                px: { xs: 0.5, md: 1.25 },
                fontSize: { xs: '0.64rem', md: '0.7rem' },
                fontWeight: 700,
              },
            }}
          >
            <ToggleButton value="live" disabled={!availableChannels.has('live')}>
              LIVE
            </ToggleButton>
            <ToggleButton value="ptu" disabled={!availableChannels.has('ptu')}>
              PTU
            </ToggleButton>
          </ToggleButtonGroup>

          <Box
            aria-label={t('Dataset build', 'Build du dataset')}
            sx={{
              minWidth: 0,
              width: isHeaderStacked
                ? 'calc(100% - 96px)'
                : activeChannel === 'live'
                  ? 82
                  : 'clamp(190px, 24vw, 270px)',
              flex: isHeaderStacked ? '1 1 auto' : '0 1 auto',
              height: 32,
              px: 1.25,
              display: 'flex',
              alignItems: 'center',
              borderRadius: 1,
              backgroundColor: (theme) => alpha(theme.palette.background.default, 0.2),
              border: 1,
              borderColor: (theme) => alpha(theme.palette.divider, 0.72),
            }}
          >
            <Typography
              variant="caption"
              noWrap
              sx={{ minWidth: 0, color: 'text.secondary', fontWeight: 700, fontSize: { xs: '0.7rem', md: '0.75rem' } }}
            >
              {activeDataset.datasetId ? formatDatasetLabel(activeDataset) : t('Latest dataset', 'Dernier dataset')}
            </Typography>
          </Box>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
