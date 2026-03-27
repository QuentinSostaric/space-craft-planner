import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import FormControl from '@mui/material/FormControl';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { alpha } from '@mui/material/styles';
import { useMemo } from 'react';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { navigateToPath } from '../utils/slug';

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

export function Header() {
  const {
    activeDataset,
    availableDatasets,
    activeChannel,
    setActiveDatasetChannel,
    setActiveDatasetId,
  } = useCraft();
  const { lang, setLang, t } = useI18n();
  const isHeaderStacked = useMediaQuery('(max-width:430px)');
  const isNarrowHeader = useMediaQuery('(max-width:720px)');

  const availableChannels = useMemo(
    () => new Set(availableDatasets.map((dataset) => dataset.channel)),
    [availableDatasets, activeChannel, activeDataset],
  );
  const channelDatasets = useMemo(
    () =>
      availableDatasets
        .filter((dataset) => dataset.channel === activeChannel)
        .sort((a, b) => {
          const dateA = Date.parse(a.updatedAt ?? a.importedAt ?? '') || 0;
          const dateB = Date.parse(b.updatedAt ?? b.importedAt ?? '') || 0;
          if (dateA !== dateB) return dateB - dateA;
          const buildA = Number(a.buildNumber ?? 0);
          const buildB = Number(b.buildNumber ?? 0);
          if (buildA !== buildB) return buildB - buildA;
          return b.version.localeCompare(a.version, undefined, { numeric: true, sensitivity: 'base' });
        }),
    [availableDatasets, activeChannel, activeDataset],
  );
  const effectiveChannelDatasets = useMemo(
    () =>
      channelDatasets.length > 0
        ? channelDatasets
        : activeDataset.datasetId && activeDataset.channel === activeChannel
          ? [
              {
                channel: activeDataset.channel,
                datasetId: activeDataset.datasetId,
                label: activeDataset.label,
                version: activeDataset.version,
                branch: activeDataset.branch,
                buildNumber: activeDataset.buildNumber,
                buildDateStamp: activeDataset.buildDateStamp,
                buildTimeStamp: activeDataset.buildTimeStamp,
                published: activeDataset.published,
                blueprintCount: activeDataset.blueprintCount,
                resourceCount: activeDataset.resourceCount,
                hasDismantling: activeDataset.hasDismantling,
                hasMissionRewards: activeDataset.hasMissionRewards,
                missionRewardContractCount: 0,
                missionRewardFactionGroupCount: 0,
                importedAt: activeDataset.importedAt,
                updatedAt: activeDataset.updatedAt,
                hasChangelog: activeDataset.hasChangelog,
                hasResourceData: activeDataset.hasResourceData,
                hasShipComponents: activeDataset.hasShipComponents,
              },
            ]
          : [],
    [availableDatasets, activeChannel, activeDataset, channelDatasets],
  );
  const formatDatasetLabel = useMemo(
    () => (dataset: {
      version: string;
      label: string;
      buildDateStamp: string | null;
      importedAt: string | null;
    }) => {
      const formattedDate = formatDatasetBuildDate(dataset.buildDateStamp, dataset.importedAt, lang);
      return formattedDate ? `${dataset.version} • ${formattedDate}` : dataset.label;
    },
    [lang],
  );

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
          py: { xs: 0.75, md: 1.25 },
          gap: { xs: 0.5, md: 2 },
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
          <ButtonBase
            onClick={() => navigateToPath('/')}
            sx={{
              borderRadius: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.25,
              flexShrink: 0,
            }}
          >
            <Box
              component="img"
              src="/logo.svg"
              alt="Item Fabricator"
              sx={{ height: { xs: 32, md: 44 }, width: 'auto', display: 'block', flexShrink: 0 }}
            />
            <Typography
              variant="caption"
              sx={{
                fontSize: { xs: '0.54rem', md: '0.6rem' },
                color: 'text.disabled',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                display: { xs: 'none', md: 'block' },
              }}
            >
              v{__APP_VERSION__}
            </Typography>
          </ButtonBase>

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

          <FormControl
            size="small"
            disabled={effectiveChannelDatasets.length === 0}
            sx={{
              minWidth: 0,
              width: isHeaderStacked ? 'calc(100% - 96px)' : isNarrowHeader ? 'min(100%, 208px)' : 'clamp(200px, 26vw, 280px)',
              flex: isHeaderStacked ? '1 1 auto' : '0 1 auto',
              '& .MuiInputBase-root': { height: 32, fontSize: { xs: '0.7rem', md: '0.75rem' } },
            }}
          >
            <Select
              value={effectiveChannelDatasets.some((dataset) => dataset.datasetId === activeDataset.datasetId) ? activeDataset.datasetId : ''}
              displayEmpty
              inputProps={{ 'aria-label': t('Dataset build', 'Build du dataset') }}
              MenuProps={{
                slotProps: {
                  paper: {
                    sx: {
                      zIndex: (theme) => theme.zIndex.modal + 10,
                    },
                  },
                },
              }}
              onChange={(event) => {
                const datasetId = event.target.value;
                if (datasetId) {
                  void setActiveDatasetId(datasetId);
                }
              }}
              sx={{
                backgroundColor: (theme) => alpha(theme.palette.background.default, 0.2),
              }}
              renderValue={(selected) => {
                const dataset = effectiveChannelDatasets.find((entry) => entry.datasetId === selected);
                if (!dataset) {
                  return t('Select dataset', 'Selectionner un dataset');
                }

                return formatDatasetLabel(dataset);
              }}
            >
              {effectiveChannelDatasets.map((dataset) => (
                <MenuItem key={dataset.datasetId} value={dataset.datasetId}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.78rem', lineHeight: 1.1 }}>
                      {formatDatasetBuildDate(dataset.buildDateStamp, dataset.importedAt, lang) ?? dataset.label}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.1 }}>
                      {dataset.version}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
