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
import { FONT_MONO, FONT_BODY } from '../theme';
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
  en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  fr: ['janv','févr','mars','avr','mai','juin','juil','août','sept','oct','nov','déc'],
  de: ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'],
} as const;

const MANIFEST_MONTH_INDEX = {
  jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11,
} as const;

type GlobalSearchOption =
  | { kind: 'blueprint'; key: string; label: string; description: string; blueprint: Blueprint }
  | { kind: 'resource'; key: string; label: string; description: string; resource: Resource }
  | { kind: 'mission'; key: string; label: string; description: string; contract: MissionContract; group: MissionRewardFactionGroup };

function getDatasetBuildDateParts(
  buildDateStamp: string | null,
  importedAt: string | null,
): { day: number; monthIndex: number; year: number } | null {
  if (buildDateStamp) {
    const s = buildDateStamp.trim();
    const m1 = s.match(/^[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})$/);
    if (m1) {
      const mi = MANIFEST_MONTH_INDEX[m1[1].toLowerCase() as keyof typeof MANIFEST_MONTH_INDEX];
      if (mi != null) return { day: Number(m1[2]), monthIndex: mi, year: Number(m1[3]) };
    }
    const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m2) return { day: Number(m2[3]), monthIndex: Number(m2[2]) - 1, year: Number(m2[1]) };
  }
  if (!importedAt) return null;
  const d = new Date(importedAt);
  if (Number.isNaN(d.getTime())) return null;
  return { day: d.getUTCDate(), monthIndex: d.getUTCMonth(), year: d.getUTCFullYear() };
}

function formatDatasetBuildDate(
  buildDateStamp: string | null,
  importedAt: string | null,
  lang: 'en' | 'fr' | 'de',
) {
  const parts = getDatasetBuildDateParts(buildDateStamp, importedAt);
  if (!parts) return null;
  const { day, monthIndex, year } = parts;
  const month = MONTH_NAMES[lang][monthIndex];
  if (lang === 'en') return `${month} ${day}, ${year}`;
  if (lang === 'de') return `${day}. ${month} ${year}`;
  return `${day} ${month} ${year}`;
}

function formatLiveDatasetVersion(version: string): string {
  return version.match(/^(\d+\.\d+)/)?.[1] ?? version;
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
  const isMd = useMediaQuery('(min-width:768px)');
  const isLg = useMediaQuery('(min-width:1120px)');

  const availableChannels = useMemo(
    () => new Set(availableDatasets.map((d) => d.channel)),
    [availableDatasets],
  );

  const formatDatasetLabel = useMemo(
    () => (dataset: { version: string; label: string; buildDateStamp: string | null; importedAt: string | null }) => {
      if (activeChannel === 'live') return formatLiveDatasetVersion(dataset.version);
      const d = formatDatasetBuildDate(dataset.buildDateStamp, dataset.importedAt, lang);
      return d ? `${dataset.version} · ${d}` : dataset.label;
    },
    [activeChannel, lang],
  );

  useEffect(() => {
    if (activeDataset.datasetId) void ensureMissionRewardsLoaded();
  }, [activeDataset.datasetId, ensureMissionRewardsLoaded]);

  useEffect(() => {
    const groups = activeDataset.missionRewards?.factionGroups ?? [];
    for (const group of groups) {
      if (!group.id || (group.contracts?.length ?? 0) > 0 || Object.prototype.hasOwnProperty.call(factionContractsByFactionId, group.id)) continue;
      void ensureFactionContractsLoaded(group.id);
    }
  }, [activeDataset.missionRewards?.factionGroups, ensureFactionContractsLoaded, factionContractsByFactionId]);

  const globalSearchOptions = useMemo<GlobalSearchOption[]>(() => {
    const bps: GlobalSearchOption[] = activeDataset.blueprints.map((bp) => ({
      kind: 'blueprint', key: `blueprint:${bp.id}`, label: bp.name,
      description: [bp.manufacturer, bp.category].filter(Boolean).join(' / '), blueprint: bp,
    }));
    const res: GlobalSearchOption[] = activeDataset.resources
      .filter((r) => !isPlaceholderResource(r))
      .map((r) => ({ kind: 'resource', key: `resource:${r.id}`, label: r.name, description: t('Resource', 'Ressource', 'Ressource'), resource: r }));
    const missions: GlobalSearchOption[] = [];
    for (const group of activeDataset.missionRewards?.factionGroups ?? []) {
      for (const contract of factionContractsByFactionId[group.id] ?? group.contracts ?? []) {
        const k = [group.id, contract.contractFile, contract.handlerDebugName, contract.contractDebugName, missions.length].filter(Boolean).join(':');
        missions.push({ kind: 'mission', key: `mission:${k}`, label: getMissionContractName(contract), description: group.contractorDisplayName, contract, group });
      }
    }
    return [...bps, ...res, ...missions];
  }, [activeDataset.blueprints, activeDataset.missionRewards?.factionGroups, activeDataset.resources, factionContractsByFactionId, t]);

  const handleSearchSelect = (_event: unknown, option: GlobalSearchOption | null) => {
    if (!option) return;
    if (option.kind === 'blueprint') { setActiveBlueprint(option.blueprint); return; }
    if (option.kind === 'resource') {
      navigateToPath(resourcePathFromSlug(option.resource.id), { mainView: 'resources', resourceId: option.resource.id });
      return;
    }
    const slug = missionSlugFromContract(option.contract.contractDebugName, option.group.contractorDisplayName);
    navigateToPath(missionPathFromSlug(slug), { mainView: 'missions', missionSlug: slug });
  };

  return (
    <AppBar position="relative" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
      <Toolbar
        sx={{
          px: { xs: 1.5, sm: 2, lg: 2.5 },
          minHeight: { xs: 56, md: 56 },
          gap: { xs: 1, md: 1.5 },
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {/* Brand mark — visible on desktop only (NavRail has it on mobile) */}
        {isMd && (
          <Box
            component="a"
            href="/"
            onClick={(e) => { e.preventDefault(); navigateToPath('/', { mainView: 'blueprints' }); }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              textDecoration: 'none',
              color: 'text.primary',
              flexShrink: 0,
              borderRadius: 1.5,
              px: 0.75,
              py: 0.5,
              mx: -0.75,
              transition: 'background-color 120ms ease',
              '&:hover': { backgroundColor: 'ui.surface2' },
            }}
          >
            <Box
              component="img"
              src="/brand-mark.svg"
              alt="Item Fabricator"
              sx={{ width: 26, height: 32, objectFit: 'contain', display: 'block', flexShrink: 0 }}
            />
            {isLg && (
              <Typography
                sx={{
                  fontFamily: FONT_BODY,
                  fontWeight: 700,
                  fontSize: '0.9375rem',
                  letterSpacing: '-0.01em',
                  color: 'text.primary',
                  '& em': { fontStyle: 'normal', fontWeight: 500, color: 'text.secondary' },
                }}
              >
                Item<em>Fab</em>
              </Typography>
            )}
          </Box>
        )}

        {/* Global search — fills center */}
        <Autocomplete
          size="small"
          blurOnSelect
          clearOnBlur
          options={globalSearchOptions}
          getOptionLabel={(o) => o.label}
          getOptionKey={(o) => o.key}
          groupBy={(o) => o.kind === 'blueprint' ? t('Blueprints', 'Blueprints') : o.kind === 'resource' ? t('Resources', 'Ressources') : t('Missions', 'Missions')}
          filterOptions={(options, state) => {
            const q = state.inputValue.trim().toLowerCase();
            if (!q) return options;
            return options.filter((o) => `${o.label} ${o.description}`.toLowerCase().includes(q));
          }}
          onChange={handleSearchSelect}
          sx={{
            flex: '1 1 auto',
            maxWidth: 540,
            mx: 'auto',
            '& .MuiInputBase-root': {
              height: 38,
              backgroundColor: (th) => alpha(th.palette.ui.surface2, 0.9),
              borderRadius: 1.5,
            },
            '& .MuiAutocomplete-input': { fontSize: '0.875rem' },
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder={t('Search blueprints, resources, missions…', 'Rechercher blueprints, ressources, missions…')}
              inputProps={{ ...params.inputProps, 'aria-label': t('Global search', 'Recherche globale') }}
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 17, color: 'text.disabled' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <>
                    {params.InputProps.endAdornment}
                    {isLg && (
                      <Box
                        component="kbd"
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          height: 20,
                          px: '6px',
                          borderRadius: '4px',
                          backgroundColor: 'background.default',
                          border: '1px solid',
                          borderColor: 'ui.borderStrong',
                          fontFamily: FONT_MONO,
                          fontSize: '10.5px',
                          color: 'text.disabled',
                          flexShrink: 0,
                          mr: 0.5,
                        }}
                      >
                        ⌘ K
                      </Box>
                    )}
                  </>
                ),
              }}
            />
          )}
          renderOption={(props, option) => {
            const { key, ...rest } = props;
            return (
              <Box key={option.key} component="li" {...rest} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>{option.label}</Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: FONT_BODY, letterSpacing: 0 }}>{option.description}</Typography>
              </Box>
            );
          }}
        />

        {/* Right-side tools */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, md: 1 }, flexShrink: 0 }}>
          {/* Channel toggle */}
          {isMd && (
            <ToggleButtonGroup
              value={activeChannel}
              exclusive
              onChange={(_e, val) => { if (val) void setActiveDatasetChannel(val); }}
              size="small"
              aria-label={t('Dataset channel', 'Canal du dataset')}
              sx={{ height: 34 }}
            >
              <ToggleButton
                value="live"
                disabled={!availableChannels.has('live')}
                sx={{ px: 1.25, fontSize: '0.7rem', fontWeight: 700, fontFamily: FONT_MONO, gap: 0.75 }}
              >
                <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'success.main', display: 'inline-block', animation: 'if-pulse-ring 1.6s infinite', flexShrink: 0 }} />
                LIVE
              </ToggleButton>
              <ToggleButton value="ptu" disabled={!availableChannels.has('ptu')} sx={{ px: 1.25, fontSize: '0.7rem', fontWeight: 700, fontFamily: FONT_MONO }}>
                PTU
              </ToggleButton>
            </ToggleButtonGroup>
          )}

          {/* Dataset build pill */}
          {isMd && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                height: 34,
                px: 1.5,
                borderRadius: 1.5,
                backgroundColor: 'ui.surface2',
                border: '1px solid',
                borderColor: 'ui.border',
                fontSize: '0.75rem',
                color: 'text.secondary',
                fontFamily: FONT_BODY,
                flexShrink: 0,
                maxWidth: activeChannel === 'live' ? 90 : 200,
                overflow: 'hidden',
              }}
            >
              <Typography component="span" sx={{ fontFamily: FONT_MONO, fontSize: '0.625rem', fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
                Build
              </Typography>
              <Typography component="span" noWrap sx={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: '0.75rem', color: 'text.primary' }}>
                {activeDataset.datasetId ? formatDatasetLabel(activeDataset) : t('Latest', 'Dernier')}
              </Typography>
              <Typography component="span" sx={{ display: { xs: 'none', xl: 'block' }, fontFamily: FONT_MONO, fontSize: '0.625rem', color: 'text.disabled', flexShrink: 0 }}>
                v{DISPLAY_APP_VERSION}
              </Typography>
            </Box>
          )}

          {/* Language toggle */}
          <ToggleButtonGroup
            value={lang}
            exclusive
            onChange={(_e, val) => { if (val) setLang(val); }}
            size="small"
            aria-label={t('Language', 'Langue')}
            sx={{
              height: 34,
              '& .MuiToggleButton-root': { px: { xs: 0.75, md: 1 }, fontSize: '0.6875rem', fontWeight: 700, fontFamily: FONT_MONO, letterSpacing: '0.04em', minWidth: { xs: 30, md: 38 } },
            }}
          >
            <ToggleButton value="en">EN</ToggleButton>
            <ToggleButton value="fr">FR</ToggleButton>
            <ToggleButton value="de">DE</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
