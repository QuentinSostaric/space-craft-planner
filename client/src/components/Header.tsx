import { Box, Divider, IconButton, Typography, useMediaQuery, alpha, useTheme } from '../ui/system';
import { AppBar, Toolbar } from './ui/primitives';
import { AppAutocomplete, AppButton, AppSelect, AppToggleGroup } from './ui/controls';
import { AppTooltip } from './ui/overlays';
import { SearchIcon, DownloadOutlinedIcon, LightModeOutlinedIcon, DarkModeOutlinedIcon, SystemUpdateAltIcon, FiberManualRecordIcon, VisibilityOutlinedIcon } from '../ui/icons';
import { useEffect, useMemo, useState } from 'react';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { useThemeMode } from '../hooks/ThemeContext';
import { useAppUpdate } from '../hooks/useAppUpdate';
import { getDesktopInstallerUrl, isTauriRuntime } from '../services/apiBaseUrl';
import { FONT_MONO, FONT_BODY, FONT_HEADING, TEXT_LABEL, TEXT_LABEL_SM } from '../theme';
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
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.up('md'));
  const isLg = useMediaQuery(theme.breakpoints.up('lg'));
  const [searchValue, setSearchValue] = useState<GlobalSearchOption | string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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

  const searchSuggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return globalSearchOptions.slice(0, 40);
    return globalSearchOptions
      .filter((option) => `${option.label} ${option.description}`.toLowerCase().includes(q))
      .slice(0, 40);
  }, [globalSearchOptions, searchQuery]);

  const handleSearchSelect = (option: GlobalSearchOption) => {
    setSearchValue(null);
    setSearchQuery('');
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
          onClick={(e) => { e.preventDefault(); navigateToPath('/', { mainView: 'fabricator' }); }}
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

        {/* Global search — fills the center without displacing utility controls. */}
        <Box sx={{ flex: '1 1 220px', minWidth: { xs: 120, sm: 220 }, maxWidth: 540, mx: 'auto', position: 'relative' }}>
          <SearchIcon sx={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 17, color: 'text.disabled', zIndex: 1, pointerEvents: 'none' }} />
          <AppAutocomplete
            value={searchValue}
            suggestions={searchSuggestions}
            getOptionLabel={(option) => option.label}
            onValueChange={(value) => {
              setSearchValue(value);
              if (typeof value === 'string') setSearchQuery(value);
              else if (value) handleSearchSelect(value);
            }}
            onQueryChange={setSearchQuery}
            placeholder={isMd ? t('Search blueprints, resources, missions…', 'Rechercher blueprints, ressources, missions…') : t('Search…', 'Rechercher…')}
            ariaLabel={t('Global search', 'Recherche globale')}
            forceSelection
            sx={{ width: '100%' }}
            inputSx={{ width: '100%', height: { xs: 44, md: 38 }, pl: 4.25, backgroundColor: alpha(theme.palette.ui.surface2, 0.9), fontSize: '0.875rem' }}
            partSx={{
              root: { width: '100%' },
              panel: { maxWidth: 'calc(100vw - 24px)' },
              item: { minHeight: 44, py: 0.75 },
            }}
            itemTemplate={(option) => (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>{option.label}</Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: FONT_BODY, letterSpacing: 0 }}>{option.description}</Typography>
              </Box>
            )}
          />
        </Box>

        {/* Right-side tools */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.75, md: 1 }, flexShrink: 0 }}>

          {/* Channel remains available at every width; mobile uses a compact select. */}
          {isMd ? (
            <AppToggleGroup
              value={activeChannel}
              options={[
                {
                  value: 'live',
                  disabled: !availableChannels.has('live'),
                  label: (
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                      <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'success.main', flexShrink: 0 }} />
                      LIVE
                    </Box>
                  ),
                },
                { value: 'ptu', disabled: !availableChannels.has('ptu'), label: 'PTU' },
              ]}
              onValueChange={(value) => { void setActiveDatasetChannel(value); }}
              ariaLabel={t('Dataset channel', 'Canal du dataset')}
              partSx={{ button: { minHeight: 34, px: 1.25, fontFamily: FONT_MONO, fontSize: TEXT_LABEL } }}
            />
          ) : (
            <AppSelect
              value={activeChannel}
              options={[
                { label: 'LIVE', value: 'live', disabled: !availableChannels.has('live') },
                { label: 'PTU', value: 'ptu', disabled: !availableChannels.has('ptu') },
              ]}
              onValueChange={(value) => { if (value) void setActiveDatasetChannel(value); }}
              ariaLabel={t('Dataset channel', 'Canal du dataset')}
              sx={{ width: 92 }}
              partSx={{ root: { minHeight: 44 }, input: { fontFamily: FONT_MONO, fontSize: TEXT_LABEL, fontWeight: 700, px: 0.75 }, trigger: { width: 28 } }}
            />
          )}

          {/* LIVE: dataset freshness, demoted to a quiet version stamp + tooltip —
              it's trust information consulted rarely, not primary chrome. */}
          {activeChannel === 'live' && (
            <AppTooltip
              content={`${t('Game build', 'Build du jeu')} ${liveVersion ?? t('Latest', 'Dernier')}${liveDate ? ` · ${liveDate}` : ''}`}
            >
              <Box
                sx={{
                  display: { xs: 'none', md: 'inline-flex' },
                  alignItems: 'center',
                  gap: 0.75,
                  height: 34,
                  px: 0.75,
                  flexShrink: 0,
                  cursor: 'default',
                }}
                aria-label={`${t('Game build', 'Build du jeu')} ${liveVersion ?? t('Latest', 'Dernier')}${liveDate ? ` · ${liveDate}` : ''}`}
              >
                <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'success.main', flexShrink: 0 }} />
                <Typography component="span" sx={{ fontFamily: FONT_MONO, fontWeight: 600, fontSize: TEXT_LABEL, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                  {liveVersion ?? t('Latest', 'Dernier')}
                </Typography>
              </Box>
            </AppTooltip>
          )}

          {/* PTU: dataset selector */}
          {activeChannel === 'ptu' && ptuDatasets.length > 0 && (
            <AppSelect
              value={activeDataset.datasetId || (ptuDatasets[0]?.datasetId ?? '')}
              options={ptuDatasets.map((dataset) => {
                const date = formatDatasetBuildDate(dataset.buildDateStamp, dataset.importedAt, lang);
                return { label: `${dataset.version}${date ? ` · ${date}` : ''}`, value: dataset.datasetId };
              })}
              onValueChange={(value) => { if (value) void setActiveDatasetId(value); }}
              ariaLabel={t('PTU dataset', 'Dataset PTU')}
              sx={{ width: { xs: 92, md: 220 }, display: { xs: 'none', sm: 'inline-flex' } }}
              partSx={{ root: { minHeight: { xs: 44, md: 34 }, backgroundColor: 'ui.surface2' }, input: { fontFamily: FONT_MONO, fontSize: TEXT_LABEL, px: 1.25 } }}
            />
          )}

          {/* Desktop app download CTA — web only */}
          {!isDesktop && (
            <AppButton
              href={getDesktopInstallerUrl()}
              onClick={() => {
                trackEvent('download_clicked', { download_target: 'desktop_app' });
                trackEvent('desktop_latest_installer_clicked');
              }}
              size="sm"
              variant="secondary"
              startIcon={<DownloadOutlinedIcon sx={{ fontSize: 13 }} />}
              ariaLabel={t('Download desktop app', 'Telecharger l app desktop', 'Desktop-App herunterladen')}
              sx={{
                display: { xs: 'none', md: 'flex' },
                height: 28,
                fontSize: TEXT_LABEL,
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
            </AppButton>
          )}

          {/* Live watcher toggle — desktop only */}
          {isDesktop && (
            <AppTooltip
              content={
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
                    fontSize: TEXT_LABEL_SM,
                    letterSpacing: '0.06em',
                    color: watcher.running ? 'success.main' : 'text.secondary',
                    userSelect: 'none',
                  }}
                >
                  {watcher.running ? 'LIVE' : t('Watch', 'Watch')}
                </Typography>
              </Box>
            </AppTooltip>
          )}

          {/* Update available — desktop only */}
          {hasUpdate && (
            <AppTooltip content={t('Click to install update', 'Cliquer pour installer la mise à jour', 'Klicken zum Aktualisieren')}>
              <AppButton
                onClick={() => { void triggerUpdate(); }}
                size="sm"
                variant="ghost"
                icon={<SystemUpdateAltIcon sx={{ fontSize: 15 }} />}
                ariaLabel={t('Install update', 'Installer la mise à jour', 'Update installieren')}
                sx={{ minWidth: 44, minHeight: 44, fontFamily: FONT_MONO, fontWeight: 700, color: 'warning.main', borderColor: 'warning.main' }}
              >
                <Box component="span" sx={{ display: { xs: 'none', lg: 'inline' } }}>
                  {availableVersion ? `v${availableVersion}` : t('Update', 'Mise à jour', 'Update')}
                </Box>
              </AppButton>
            </AppTooltip>
          )}

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5, opacity: 0.4 }} />

          {/* Theme toggle */}
          <AppTooltip content={themeMode === 'dark' ? t('Light mode', 'Mode clair') : t('Dark mode', 'Mode sombre')}>
            <IconButton
              onClick={toggleTheme}
              size="small"
              aria-label={themeMode === 'dark' ? t('Switch to light mode', 'Passer en mode clair') : t('Switch to dark mode', 'Passer en mode sombre')}
              sx={{ width: 44, height: 44, borderRadius: 1, color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
            >
              {themeMode === 'dark' ? <LightModeOutlinedIcon sx={{ fontSize: 18 }} /> : <DarkModeOutlinedIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          </AppTooltip>

          {/* Language — button group on desktop, compact select on mobile */}
          {isMd ? (
            <AppToggleGroup
              value={lang}
              options={[
                { value: 'en', label: 'EN' },
                { value: 'fr', label: 'FR' },
                { value: 'de', label: 'DE' },
              ]}
              onValueChange={(value) => setLang(value)}
              ariaLabel={t('Language', 'Langue')}
              partSx={{ button: { minHeight: 34, px: 1, fontFamily: FONT_MONO, fontSize: TEXT_LABEL_SM, letterSpacing: '0.04em' } }}
            />
          ) : (
            <AppSelect
              value={lang}
              options={[
                { label: 'EN', value: 'en' },
                { label: 'FR', value: 'fr' },
                { label: 'DE', value: 'de' },
              ]}
              onValueChange={(value) => { if (value) setLang(value); }}
              ariaLabel={t('Language', 'Langue')}
              sx={{ width: 78 }}
              partSx={{ root: { minHeight: 44 }, input: { fontFamily: FONT_MONO, fontSize: TEXT_LABEL_SM, fontWeight: 700, px: 0.75 }, trigger: { width: 28 } }}
            />
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
