import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FlagIcon from '@mui/icons-material/Flag';
import { alpha } from '@mui/material/styles';
import { GameIcon } from './ui/GameIcon';
import { useI18n } from '../i18n/I18nContext';

export type MainView = 'blueprints' | 'missions';

const EXPANDED_WIDTH = 200;
const COLLAPSED_WIDTH = 64;

interface NavRailProps {
  mainView: MainView;
  onChangeView: (view: MainView) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

interface NavItemProps {
  active: boolean;
  collapsed: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

function NavItem({ active, collapsed, label, icon, onClick }: NavItemProps) {
  const button = (
    <Box
      component="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      sx={{
        all: 'unset',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: 2,
        width: '100%',
        height: 48,
        px: collapsed ? 0 : 2,
        position: 'relative',
        transition: 'all 200ms ease',
        color: active ? 'primary.main' : 'text.secondary',
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          top: '20%',
          bottom: '20%',
          width: 3,
          backgroundColor: 'primary.main',
          borderRadius: '0 4px 4px 0',
          transform: active ? 'scaleX(1)' : 'scaleX(0)',
          transformOrigin: 'left',
          transition: 'transform 200ms ease',
        },
        backgroundColor: active ? (theme) => alpha(theme.palette.primary.main, 0.08) : 'transparent',
        '&:hover': {
          backgroundColor: active
            ? (theme) => alpha(theme.palette.primary.main, 0.12)
            : (theme) => alpha(theme.palette.text.primary, 0.04),
          color: active ? 'primary.main' : 'text.primary',
        },
      }}
    >
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        width: 24, 
        height: 24,
        flexShrink: 0,
        transition: 'transform 200ms ease',
        transform: active ? 'scale(1.1)' : 'scale(1)',
      }}>
        {icon}
      </Box>
      {!collapsed && (
        <Typography
          sx={{
            fontFamily: "'Khand', sans-serif",
            fontWeight: 700,
            fontSize: '0.85rem',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          {label}
        </Typography>
      )}
    </Box>
  );

  if (collapsed) {
    return (
      <Tooltip title={label} placement="right" arrow>
        <Box sx={{ width: '100%' }}>{button}</Box>
      </Tooltip>
    );
  }

  return button;
}

export function NavRail({ mainView, onChangeView, collapsed, onToggleCollapsed }: NavRailProps) {
  const { t } = useI18n();

  return (
    <Box
      component="nav"
      aria-label={t('Main navigation', 'Navigation principale')}
      sx={{
        width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
        minWidth: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
        alignSelf: 'stretch',
        backgroundColor: 'background.paper',
        borderRight: (theme) => `1px solid ${theme.palette.divider}`,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 250ms cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        zIndex: 5,
      }}
    >
      {/* Nav items */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, py: 2, flex: 1 }}>
        <NavItem
          active={mainView === 'blueprints'}
          collapsed={collapsed}
          label={t('Blueprints', 'Blueprints')}
          icon={<GameIcon name="calculator" size={20} />}
          onClick={() => onChangeView('blueprints')}
        />
        <NavItem
          active={mainView === 'missions'}
          collapsed={collapsed}
          label={t('Missions', 'Missions')}
          icon={<FlagIcon sx={{ fontSize: '1.2rem' }} />}
          onClick={() => onChangeView('missions')}
        />
      </Box>

      {/* Toggle button at the bottom */}
      <Box sx={{ 
        p: 1.5, 
        borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        display: 'flex',
        justifyContent: collapsed ? 'center' : 'flex-end'
      }}>
        <IconButton
          onClick={onToggleCollapsed}
          aria-label={collapsed
            ? t('Expand navigation', 'Etendre la navigation')
            : t('Collapse navigation', 'Reduire la navigation')
          }
          size="small"
        >
          {collapsed
            ? <ChevronRightIcon />
            : <ChevronLeftIcon />
          }
        </IconButton>
      </Box>
    </Box>
  );
}
