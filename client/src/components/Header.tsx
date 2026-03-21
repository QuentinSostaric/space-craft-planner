import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { alpha, useTheme as useMuiTheme } from '@mui/material/styles';
import ChangeHistoryIcon from '@mui/icons-material/ChangeHistory';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { useTheme } from '../hooks/useTheme';
import { GameIcon } from './ui/GameIcon';
import { StarCitizenLicensedIcon } from './ui/StarCitizenLicensedIcon';

export function Header() {
  const {
    activeDataset,
    availableDatasets,
    activeChannel,
    datasetLoading,
    setActiveDatasetChannel,
    setActiveDatasetId,
    changelogOpen,
    setChangelogOpen,
  } = useCraft();
  const { lang, setLang, t } = useI18n();
  const [themeMode, setThemeMode] = useTheme();
  const theme = useMuiTheme();
  const isCompactLayout = useMediaQuery(theme.breakpoints.down('md'));

  const availableChannels = new Set(availableDatasets.map((dataset) => dataset.channel));
  const channelDatasets = availableDatasets
    .filter((dataset) => dataset.channel === activeChannel)
    .sort((a, b) => {
      const dateA = Date.parse(a.updatedAt ?? a.importedAt ?? '') || 0;
      const dateB = Date.parse(b.updatedAt ?? b.importedAt ?? '') || 0;
      if (dateA !== dateB) return dateB - dateA;
      const buildA = Number(a.buildNumber ?? 0);
      const buildB = Number(b.buildNumber ?? 0);
      if (buildA !== buildB) return buildB - buildA;
      return b.version.localeCompare(a.version, undefined, { numeric: true, sensitivity: 'base' });
    });
  const hasChangelog = activeDataset.channel === 'ptu' && Boolean(activeDataset.changelog);

  return (
    <AppBar
      position="static"
      sx={{
        position: 'relative',
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
          px: { xs: 1.5, sm: 2.5, lg: 3 },
          py: { xs: 1, md: 1.25 },
          gap: { xs: 1.25, md: 2 },
          flexWrap: 'wrap',
          alignItems: { xs: 'stretch', md: 'center' },
          justifyContent: 'space-between',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            minWidth: 0,
            width: { xs: '100%', md: 'auto' },
            flex: { md: '1 1 auto' },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.25, md: 2 }, minWidth: 0 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: { xs: 32, md: 36 },
                height: { xs: 32, md: 36 },
                borderRadius: 1,
                backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.1),
                color: 'primary.main',
                flexShrink: 0,
              }}
            >
              <GameIcon name="calculator" size={isCompactLayout ? 20 : 24} />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <Typography
                variant="h6"
                sx={{
                  letterSpacing: '-0.01em',
                  fontSize: { xs: '1.05rem', sm: '1.15rem', md: '1.3rem' },
                  lineHeight: 0.95,
                  color: 'text.primary',
                  whiteSpace: 'nowrap',
                }}
              >
                Item
                <Box component="span" sx={{ color: 'primary.main', ml: 0.5 }}>
                  Fabricator
                </Box>
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  fontSize: { xs: '0.56rem', md: '0.6rem' },
                  color: 'text.disabled',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                Build {activeDataset.version}
              </Typography>
            </Box>
          </Box>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              flexShrink: 0,
              borderLeft: { xs: 'none', md: (theme) => `1px solid ${theme.palette.divider}` },
              pl: { xs: 0, md: 1.5 },
            }}
          >
            {hasChangelog && (
              <IconButton
                onClick={() => setChangelogOpen(!changelogOpen)}
                aria-pressed={changelogOpen}
                title={t('PTU Changelog', 'Changelog PTU')}
                size="small"
                sx={{
                  ...(changelogOpen && {
                    color: 'primary.main',
                    backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.1),
                  }),
                }}
              >
                <ChangeHistoryIcon sx={{ fontSize: '1.25rem' }} />
              </IconButton>
            )}

            <IconButton
              onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
              title={themeMode === 'dark' ? t('Light theme', 'Theme clair') : t('Dark theme', 'Theme sombre')}
              size="small"
            >
              {themeMode === 'dark' ? <LightModeIcon sx={{ fontSize: '1.25rem' }} /> : <DarkModeIcon sx={{ fontSize: '1.25rem' }} />}
            </IconButton>

            <ToggleButtonGroup
              value={lang}
              exclusive
              onChange={(_e, val) => {
                if (val) setLang(val);
              }}
              size="small"
              aria-label={t('Language', 'Langue')}
              sx={{ height: 32, ml: 0.5 }}
            >
              <ToggleButton value="en" sx={{ px: { xs: 0.85, md: 1 }, fontSize: '0.7rem', fontWeight: 700 }}>
                EN
              </ToggleButton>
              <ToggleButton value="fr" sx={{ px: { xs: 0.85, md: 1 }, fontSize: '0.7rem', fontWeight: 700 }}>
                FR
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            width: { xs: '100%', md: 'auto' },
            flexWrap: 'wrap',
            justifyContent: { xs: 'stretch', md: 'flex-end' },
            position: 'relative',
            zIndex: 1,
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
            disabled={datasetLoading}
            sx={{
              height: 32,
              flexShrink: 0,
              '& .MuiToggleButton-root': {
                px: 1.25,
                fontSize: '0.7rem',
                fontWeight: 700,
              },
            }}
          >
            <ToggleButton value="live" disabled={!availableChannels.has('live')}>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                <StarCitizenLicensedIcon name="live" size={14} />
                <span>LIVE</span>
              </Box>
            </ToggleButton>
            <ToggleButton value="ptu" disabled={!availableChannels.has('ptu')}>
              PTU
            </ToggleButton>
          </ToggleButtonGroup>

          <FormControl
            size="small"
            disabled={datasetLoading || channelDatasets.length === 0}
            sx={{
              minWidth: { xs: 0, md: 240 },
              flex: { xs: '1 1 180px', md: '0 1 280px' },
              '& .MuiInputBase-root': { height: 32, fontSize: '0.75rem' },
            }}
          >
            <Select
              value={channelDatasets.some((dataset) => dataset.datasetId === activeDataset.datasetId) ? activeDataset.datasetId : ''}
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
                const dataset = channelDatasets.find((entry) => entry.datasetId === selected);
                if (!dataset) {
                  return t('Select dataset', 'Selectionner un dataset');
                }

                return dataset.buildNumber
                  ? `${dataset.version} • #${dataset.buildNumber}`
                  : dataset.label;
              }}
            >
              {channelDatasets.map((dataset) => (
                <MenuItem key={dataset.datasetId} value={dataset.datasetId}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.78rem', lineHeight: 1.1 }}>
                      {dataset.buildNumber ? `#${dataset.buildNumber}` : dataset.label}
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
