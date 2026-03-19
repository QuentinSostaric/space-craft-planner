import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FlagIcon from '@mui/icons-material/Flag';
import { GameIcon } from './ui/GameIcon';
import { useI18n } from '../i18n/I18nContext';
import { tokens } from '../theme';

export type MainView = 'blueprints' | 'missions';

const EXPANDED_WIDTH = 140;
const COLLAPSED_WIDTH = 36;

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
        gap: 1,
        width: '100%',
        px: collapsed ? '7px' : '10px',
        py: '8px',
        boxSizing: 'border-box',
        borderLeft: `2px solid ${active ? tokens.violet : 'transparent'}`,
        backgroundColor: active ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
        transition: 'background-color 150ms, border-color 150ms',
        '&:hover': {
          backgroundColor: active
            ? 'rgba(139, 92, 246, 0.2)'
            : 'rgba(139, 92, 246, 0.08)',
        },
        '&:focus-visible': {
          outline: `2px solid ${tokens.violet}`,
          outlineOffset: -2,
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, flexShrink: 0, opacity: active ? 1 : 0.5 }}>
        {icon}
      </Box>
      {!collapsed && (
        <Typography
          sx={{
            fontFamily: "'Khand', sans-serif",
            fontWeight: 700,
            fontSize: '.7rem',
            textTransform: 'uppercase',
            letterSpacing: '.06em',
            color: active ? tokens.text : tokens.textDim,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label}
        </Typography>
      )}
    </Box>
  );

  if (collapsed) {
    return (
      <Tooltip title={label} placement="right">
        {button}
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
        height: '100%',
        backgroundColor: tokens.bgSubtle,
        borderRight: `1px solid ${tokens.border}`,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 150ms ease, min-width 150ms ease',
        overflow: 'hidden',
      }}
    >
      {/* Toggle button */}
      <Box sx={{ display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end', p: 0.5 }}>
        <IconButton
          onClick={onToggleCollapsed}
          aria-label={collapsed
            ? t('Expand navigation', 'Etendre la navigation')
            : t('Collapse navigation', 'Reduire la navigation')
          }
          size="small"
          sx={{ width: 24, height: 24 }}
        >
          {collapsed
            ? <ChevronRightIcon sx={{ fontSize: '.9rem' }} />
            : <ChevronLeftIcon sx={{ fontSize: '.9rem' }} />
          }
        </IconButton>
      </Box>

      {/* Nav items */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <NavItem
          active={mainView === 'blueprints'}
          collapsed={collapsed}
          label={t('Blueprints', 'Blueprints')}
          icon={<GameIcon name="calculator" size={16} />}
          onClick={() => onChangeView('blueprints')}
        />
        <NavItem
          active={mainView === 'missions'}
          collapsed={collapsed}
          label={t('Missions', 'Missions')}
          icon={<FlagIcon sx={{ fontSize: '1rem', color: mainView === 'missions' ? tokens.text : tokens.textDim }} />}
          onClick={() => onChangeView('missions')}
        />
      </Box>
    </Box>
  );
}
