import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import SearchIcon from '@mui/icons-material/Search';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import { alpha } from '@mui/material/styles';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { useEffect, useMemo, useState } from 'react';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { useThemeMode } from '../hooks/ThemeContext';
import { useAppUpdate } from '../hooks/useAppUpdate';
import { getDesktopInstallerUrl, isTauriRuntime } from '../services/apiBaseUrl';
import { FONT_MONO, FONT_BODY, FONT_HEADING } from '../theme';
import {
  missionPathFromSlug,
  missionSlugFromContract,
  navigateToPath,
  resourcePathFromSlug,
} from '../utils/slug';
import { getMissionContractName, isPlaceholderResource } from '../utils/crafting';
import { useScLog } from '../hooks/ScLogSyncContext';

import { useAuth } from '../auth/AuthContext';
import { trackEvent } from '../analytics/posthog';
import type { Blueprint, MissionContract, MissionRewardFactionGroup, Resource } from '../types';

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
  return version.match(/^(\d+\.\d+(?:\.\d+)?)/)?.[1] ?? version;
}

export function Header() {
  const {
    activeDataset,
    availableDatasets,
    activeChannel,
    setActiveDatasetChannel,
    setActiveDatasetId,
    setActiveBlueprint,
    ensureMissionRewardsLoaded,
    ensureFactionContractsLoaded,
    factionContractsByFactionId,
  } = useCraft();
  const { lang, setLang, t } = useI18n();
  const { mode: themeMode, toggle: toggleTheme } = useThemeMode();
  const { status: updateStatus, triggerUpdate, availableVersion } = useAppUpdate();
  const { user } = useAuth();
  const isDesktop = isTauriRuntime();
  const hasUpdate = isDesktop && updateStatus === 'available';
  const isLg = useMediaQuery('(min-width:1120px)');

  const { watcher, sync } = useScLog();
  const [watcherError, setWatcherError] = useState<string | null>(null);

  const livePath = sync.installPaths?.live ?? null;
  const isLoggedIn = Boolean(user);
  const canWatch = isLoggedIn && Boolean(livePath);

  const handleWatcherToggle = async () => {
    setWatcherError(null);
    try {
      if (watcher.running) {
        watcher.stop();
        watcher.setAutoStart(false);
        trackEvent('log_watcher_stopped');
        trackEvent('log_sync_disabled');
      } else if (livePath) {
        await watcher.start(livePath);
        watcher.setAutoStart(true);
        trackEvent('log_watcher_started');
        trackEvent('log_sync_enabled');
      }
    } catch (err: unknown) {
      setWatcherError(err instanceof Error ? err.message : 'Failed to toggle watcher.');
      trackEvent('log_sync_error', {
        error_message: err instanceof Error ? err.message.slice(0, 240) : 'Failed to toggle watcher.',
      });
    }
  };

  const availableChannels = useMemo(
    () => new Set(availableDatasets.map((d) => d.channel)),
    [availableDatasets],
  );

  const ptuDatasets = useMemo(
    () => availableDatasets.filter((d) => d.channel === 'ptu'),
    [availableDatasets],
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

  const liveVersion = activeDataset.datasetId ? formatLiveDatasetVersion(activeDataset.version) : null;
  const liveDate = activeDataset.datasetId
    ? formatDatasetBuildDate(activeDataset.buildDateStamp, activeDataset.importedAt, lang)
    : null;

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
        {/* Brand */}
        <Box
          component="a"
          href="/"
          onClick={(e) => { e.preventDefault(); navigateToPath('/', { mainView: 'blueprints' }); }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            textDecoration: 'none',
            flexShrink: 0,
            borderRadius: 1,
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
                fontFamily: FONT_HEADING,
                fontWeight: 700,
                fontSize: '0.9375rem',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                lineHeight: 1,
                color: 'text.primary',
                userSelect: 'none',
              }}
            >
              ITEM{' '}
              <Box component="span" sx={{ color: 'primary.main' }}>
                FABRICATOR
              </Box>
            </Typography>
          )}
        </Box>

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

          {/* Channel toggle — visible on md+ */}
          <Box sx={{ display: { xs: 'none', md: 'flex' } }}>
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
          </Box>

          {/* LIVE: build version + date pill */}
          {activeChannel === 'live' && (
            <Box
              sx={{
                display: { xs: 'none', md: 'flex' },
                alignItems: 'center',
                gap: 0.75,
                height: 34,
                px: 1.5,
                borderRadius: 1.5,
                backgroundColor: 'ui.surface2',
                border: '1px solid',
                borderColor: 'ui.border',
                flexShrink: 0,
              }}
            >
              <Typography component="span" sx={{ fontFamily: FONT_MONO, fontSize: '0.6rem', fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>
                Build
              </Typography>
              <Typography component="span" sx={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: '0.78rem', color: 'text.primary', whiteSpace: 'nowrap' }}>
                {liveVersion ?? t('Latest', 'Dernier')}
              </Typography>
              {liveDate && (
                <Typography component="span" sx={{ fontFamily: FONT_MONO, fontSize: '0.7rem', color: 'primary.light', whiteSpace: 'nowrap', opacity: 0.85 }}>
                  · {liveDate}
                </Typography>
              )}
            </Box>
          )}

          {/* PTU: dataset selector */}
          {activeChannel === 'ptu' && ptuDatasets.length > 0 && (
            <Select
              size="small"
              value={activeDataset.datasetId || (ptuDatasets[0]?.datasetId ?? '')}
              onChange={(e) => void setActiveDatasetId(e.target.value)}
              displayEmpty
              aria-label={t('PTU dataset', 'Dataset PTU')}
              sx={{
                display: { xs: 'none', md: 'flex' },
                height: 34,
                minWidth: 180,
                maxWidth: 240,
                fontSize: '0.75rem',
                fontFamily: FONT_MONO,
                backgroundColor: 'ui.surface2',
                '& .MuiSelect-select': { py: '6px', px: 1.25 },
              }}
            >
              {ptuDatasets.map((ds) => {
                const date = formatDatasetBuildDate(ds.buildDateStamp, ds.importedAt, lang);
                return (
                  <MenuItem key={ds.datasetId} value={ds.datasetId} sx={{ fontSize: '0.75rem', fontFamily: FONT_MONO }}>
                    {ds.version}{date ? ` · ${date}` : ''}
                  </MenuItem>
                );
              })}
            </Select>
          )}

          {/* Desktop app download CTA — web only */}
          {!isDesktop && (
            <Button
              component="a"
            href={getDesktopInstallerUrl()}
            onClick={() => {
              trackEvent('download_clicked', { download_target: 'desktop_app' });
              trackEvent('desktop_latest_installer_clicked');
            }}
              size="small"
              variant="outlined"
              startIcon={<DownloadOutlinedIcon sx={{ fontSize: 13 }} />}
              aria-label={t('Download desktop app', 'Telecharger l app desktop', 'Desktop-App herunterladen')}
              sx={{
                display: { xs: 'none', md: 'flex' },
                height: 28,
                fontSize: '0.7rem',
                fontFamily: FONT_MONO,
                fontWeight: 700,
                letterSpacing: '0.04em',
                borderColor: 'divider',
                color: 'text.secondary',
                flexShrink: 0,
                '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
              }}
            >
              {t('Desktop app', 'App desktop', 'Desktop-App')}
            </Button>
          )}

          {/* Live watcher toggle — desktop only */}
          {isDesktop && (
            <Tooltip
              title={
                watcherError ?? (
                  !isLoggedIn
                    ? t('Login to watch LIVE logs', 'Connecte-toi pour surveiller les logs LIVE')
                    : !livePath
                      ? t('No LIVE installation detected', 'Aucune installation LIVE détectée')
                      : watcher.running
                        ? t('Click to stop watching LIVE logs', 'Cliquer pour arrêter la surveillance')
                        : t('Click to watch LIVE logs in real-time', 'Surveiller les logs LIVE en temps réel')
                )
              }
            >
              <Box
                component="button"
                onClick={() => { void handleWatcherToggle(); }}
                disabled={!canWatch && !watcher.running}
                aria-pressed={watcher.running}
                aria-label={t('Watch LIVE logs toggle', 'Basculer surveillance logs LIVE')}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  height: 28,
                  px: 1.25,
                  border: '1px solid',
                  borderColor: watcher.running ? 'success.main' : 'divider',
                  borderRadius: 1,
                  bgcolor: watcher.running
                    ? (th) => alpha(th.palette.success.main, 0.1)
                    : 'transparent',
                  cursor: canWatch || watcher.running ? 'pointer' : 'not-allowed',
                  opacity: !canWatch && !watcher.running ? 0.45 : 1,
                  transition: 'all 150ms ease',
                  '&:hover:not(:disabled)': {
                    borderColor: watcher.running ? 'success.light' : 'primary.main',
                    bgcolor: watcher.running
                      ? (th) => alpha(th.palette.success.main, 0.18)
                      : (th) => alpha(th.palette.primary.main, 0.08),
                  },
                }}
              >
                {watcher.running ? (
                  <FiberManualRecordIcon
                    sx={{
                      fontSize: 8,
                      color: 'success.main',
                      animation: 'if-pulse-ring 1.6s infinite',
                    }}
                  />
                ) : (
                  <VisibilityOutlinedIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                )}
                <Typography
                  sx={{
                    fontFamily: FONT_MONO,
                    fontWeight: 700,
                    fontSize: '0.68rem',
                    letterSpacing: '0.06em',
                    color: watcher.running ? 'success.main' : 'text.secondary',
                    userSelect: 'none',
                  }}
                >
                  {watcher.running ? 'LIVE' : t('Watch', 'Watch')}
                </Typography>
              </Box>
            </Tooltip>
          )}

          {/* Update available — desktop only */}
          {hasUpdate && (
            <Tooltip title={t('Click to install update', 'Cliquer pour installer la mise à jour', 'Klicken zum Aktualisieren')}>
              <Button
                onClick={() => { void triggerUpdate(); }}
                size="small"
                variant="outlined"
                color="warning"
                startIcon={<SystemUpdateAltIcon sx={{ fontSize: 13 }} />}
                sx={{
                  display: { xs: 'none', md: 'flex' },
                  height: 28,
                  fontSize: '0.7rem',
                  fontFamily: FONT_MONO,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  flexShrink: 0,
                }}
              >
                {availableVersion ? `v${availableVersion}` : t('Update', 'Mise à jour', 'Update')}
              </Button>
            </Tooltip>
          )}

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5, opacity: 0.4 }} />

          {/* Theme toggle */}
          <Tooltip title={themeMode === 'dark' ? t('Light mode', 'Mode clair') : t('Dark mode', 'Mode sombre')}>
            <IconButton
              onClick={toggleTheme}
              size="small"
              aria-label={themeMode === 'dark' ? t('Switch to light mode', 'Passer en mode clair') : t('Switch to dark mode', 'Passer en mode sombre')}
              sx={{ width: 34, height: 34, borderRadius: 1, color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
            >
              {themeMode === 'dark' ? <LightModeOutlinedIcon sx={{ fontSize: 18 }} /> : <DarkModeOutlinedIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          </Tooltip>

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
