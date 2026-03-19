import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import MuiBadge from '@mui/material/Badge';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { useTheme } from '../hooks/useTheme';
import { GameIcon } from './ui/GameIcon';
import { tokens } from '../theme';

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
  const [theme, setTheme] = useTheme();

  const showChannelToggle = availableDatasets.length > 1;
  const hasChangelog = activeDataset.channel === 'ptu' && Boolean(activeDataset.changelog);

  return (
    <AppBar
      position="relative"
      sx={{
        zIndex: 10,
        '&::after': {
          content: '""',
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 2,
          background: tokens.gradient,
          opacity: 0.5,
        },
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between', gap: 2, px: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <GameIcon name="calculator" size={22} className="header__logo-icon" />
          <Typography
            variant="h6"
            sx={{
              fontFamily: "'Khand', sans-serif",
              fontWeight: 700,
              letterSpacing: '-0.02em',
              textTransform: 'uppercase',
              fontSize: '1.5rem',
              lineHeight: 1,
            }}
          >
            Item
            <Box
              component="span"
              sx={{
                background: tokens.gradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Fabricator
            </Box>
          </Typography>
          <Typography
            variant="caption"
            sx={{
              fontSize: '.65rem',
              color: 'text.disabled',
              letterSpacing: '.12em',
              textTransform: 'uppercase',
              fontWeight: 600,
              fontFamily: "'Khand', sans-serif",
            }}
          >
            {activeDataset.version}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
              sx={{ height: 28 }}
            >
              {availableDatasets.map((dataset) => (
                <ToggleButton
                  key={dataset.channel}
                  value={dataset.channel}
                  sx={{ px: 1.5, py: 0.25 }}
                >
                  {dataset.channel.toUpperCase()}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          )}

          {hasChangelog && (
            <IconButton
              onClick={() => setChangelogOpen(!changelogOpen)}
              aria-pressed={changelogOpen}
              aria-label={t('Toggle changelog', 'Afficher le changelog')}
              title={t('PTU Changelog', 'Changelog PTU')}
              size="small"
              sx={{
                ...(changelogOpen && {
                  color: 'primary.main',
                  backgroundColor: 'rgba(139, 92, 246, 0.15)',
                }),
              }}
            >
              Δ
            </IconButton>
          )}

          <IconButton
            onClick={openPlanner}
            aria-label={t(`Open planner (${goals.length} goals)`, `Ouvrir le planificateur (${goals.length} objectifs)`)}
            title={t('Planner', 'Planificateur')}
            size="small"
          >
            <MuiBadge
              badgeContent={goals.length}
              color="primary"
              invisible={goals.length === 0}
              sx={{ '& .MuiBadge-badge': { fontSize: '.55rem', minWidth: 16, height: 16 } }}
            >
              <span style={{ fontSize: '1.1rem' }}>🎯</span>
            </MuiBadge>
          </IconButton>

          <IconButton
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={
              theme === 'dark'
                ? t('Switch to light theme', 'Passer au theme clair')
                : t('Switch to dark theme', 'Passer au theme sombre')
            }
            title={theme === 'dark' ? t('Light theme', 'Theme clair') : t('Dark theme', 'Theme sombre')}
            size="small"
          >
            {theme === 'dark' ? '☀' : '☾'}
          </IconButton>

          <ToggleButtonGroup
            value={lang}
            exclusive
            onChange={(_e, val) => {
              if (val) setLang(val);
            }}
            size="small"
            aria-label={t('Language', 'Langue')}
            sx={{ height: 28 }}
          >
            <ToggleButton value="en" sx={{ px: 1, py: 0.25 }}>EN</ToggleButton>
            <ToggleButton value="fr" sx={{ px: 1, py: 0.25 }}>FR</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
