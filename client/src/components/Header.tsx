import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import MuiBadge from '@mui/material/Badge';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import ChangeHistoryIcon from '@mui/icons-material/ChangeHistory';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { useTheme } from '../hooks/useTheme';
import { GameIcon } from './ui/GameIcon';

export function Header() {
  const {
    activeDataset,
    availableDatasets,
    activeChannel,
    datasetLoading,
    setActiveDatasetChannel,
    goals,
    openPlanner,
    changelogOpen,
    setChangelogOpen,
  } = useCraft();
  const { lang, setLang, t } = useI18n();
  const [themeMode, setThemeMode] = useTheme();

  const showChannelToggle = availableDatasets.length > 1;
  const hasChangelog = activeDataset.channel === 'ptu' && Boolean(activeDataset.changelog);

  return (
    <AppBar
      position="relative"
      sx={{
        zIndex: 10,
        boxShadow: 'none',
        '&::after': {
          content: '""',
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 1,
          background: (theme) => `linear-gradient(to right, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
          opacity: 0.3,
        },
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between', gap: 2, px: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: 1,
            backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.1),
            color: 'primary.main'
          }}>
            <GameIcon name="calculator" size={24} />
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography
              variant="h6"
              sx={{
                fontFamily: "'Khand', sans-serif",
                fontWeight: 700,
                letterSpacing: '-0.01em',
                textTransform: 'uppercase',
                fontSize: '1.3rem',
                lineHeight: 0.9,
                color: 'text.primary'
              }}
            >
              Item
              <Box
                component="span"
                sx={{
                  color: 'primary.main',
                  ml: 0.5
                }}
              >
                Fabricator
              </Box>
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontSize: '0.6rem',
                color: 'text.disabled',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                fontWeight: 600,
                fontFamily: "'Share Tech Mono', monospace",
              }}
            >
              Build {activeDataset.version}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {showChannelToggle && (
            <ToggleButtonGroup
              value={activeChannel}
              exclusive
              onChange={(_e, val) => {
                if (val) void setActiveDatasetChannel(val);
              }}
              size="small"
              aria-label={t('Dataset channel', 'Canal du dataset')}
              disabled={datasetLoading}
              sx={{ height: 32 }}
            >
              {availableDatasets.map((dataset) => (
                <ToggleButton
                  key={dataset.channel}
                  value={dataset.channel}
                  sx={{ px: 1.5, fontSize: '0.7rem', fontWeight: 700 }}
                >
                  {dataset.channel.toUpperCase()}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, borderLeft: (theme) => `1px solid ${theme.palette.divider}`, pl: 1.5 }}>
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
              onClick={openPlanner}
              title={t('Planner', 'Planificateur')}
              size="small"
            >
              <MuiBadge
                badgeContent={goals.length}
                color="primary"
                invisible={goals.length === 0}
                sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', fontWeight: 700 } }}
              >
                <TrackChangesIcon sx={{ fontSize: '1.25rem' }} />
              </MuiBadge>
            </IconButton>

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
              sx={{ height: 32, ml: 1 }}
            >
              <ToggleButton value="en" sx={{ px: 1, fontSize: '0.7rem', fontWeight: 700 }}>EN</ToggleButton>
              <ToggleButton value="fr" sx={{ px: 1, fontSize: '0.7rem', fontWeight: 700 }}>FR</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
