import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import Badge from '@mui/material/Badge';
import useMediaQuery from '@mui/material/useMediaQuery';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import FlagIcon from '@mui/icons-material/Flag';
import AssignmentIcon from '@mui/icons-material/Assignment';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import { alpha, useTheme } from '@mui/material/styles';
import { useCallback, useMemo } from 'react';
import { StarCitizenLicensedIcon } from './ui/StarCitizenLicensedIcon';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { useCraft } from '../store/CraftContext';

export type MainView =
  | 'blueprints'
  | 'missions'
  | 'resources'
  | 'organizations'
  | 'planner'
  | 'account';

const EXPANDED_WIDTH = 200;
const COLLAPSED_WIDTH = 64;
const DESKTOP_ICON_SIZE = 20;
const MOBILE_ICON_SIZE = 20;
const DESKTOP_LABEL_FONT_SIZE = '0.8rem';
const MOBILE_LABEL_FONT_SIZE = '0.7rem';

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
    <ButtonBase
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 2,
        width: '100%',
        height: 46,
        px: 2,
        position: 'relative',
        transition: 'background-color 160ms ease, color 160ms ease',
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
        zIndex: 1,
      }}
    >
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        width: 24, 
        height: 24,
        flexShrink: 0,
        transition: 'transform 180ms ease',
        transform: `translateX(${collapsed ? '4px' : '0px'}) scale(${active ? 1.1 : 1})`,
      }}>
        {icon}
      </Box>
      <Typography
        aria-hidden={collapsed}
        sx={{
          fontFamily: "'Khand', sans-serif",
          fontWeight: 700,
          fontSize: DESKTOP_LABEL_FONT_SIZE,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          width: collapsed ? 0 : 'auto',
          maxWidth: collapsed ? 0 : 160,
          overflow: 'hidden',
          opacity: collapsed ? 0 : 1,
          transform: `translateX(${collapsed ? '-8px' : '0px'})`,
          transition: 'opacity 160ms ease, transform 180ms ease, max-width 180ms ease',
        }}
      >
        {label}
      </Typography>
    </ButtonBase>
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

function MobileNavItem({
  active,
  label,
  icon,
  onClick,
}: Omit<NavItemProps, 'collapsed'>) {
  return (
    <ButtonBase
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      sx={{
        minWidth: 0,
        minHeight: 58,
        px: 0.5,
        py: 0.75,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 0.45,
        position: 'relative',
        color: active ? 'primary.main' : 'text.secondary',
        backgroundColor: active ? (theme) => alpha(theme.palette.primary.main, 0.08) : 'transparent',
        '&::after': {
          content: '""',
          position: 'absolute',
          left: 8,
          right: 8,
          bottom: 0,
          height: 2,
          borderRadius: '2px 2px 0 0',
          backgroundColor: 'primary.main',
          opacity: active ? 1 : 0,
          transform: active ? 'scaleX(1)' : 'scaleX(0.6)',
          transition: 'opacity 160ms ease, transform 160ms ease',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 20 }}>
        {icon}
      </Box>
      <Typography
        sx={{
          fontFamily: "'Khand', sans-serif",
          fontWeight: 700,
          fontSize: MOBILE_LABEL_FONT_SIZE,
          lineHeight: 0.9,
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
          textAlign: 'center',
          maxWidth: '100%',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </Typography>
    </ButtonBase>
  );
}

export function NavRail({ mainView, onChangeView, collapsed, onToggleCollapsed }: NavRailProps) {
  const { t } = useI18n();
  const { user, account } = useAuth();
  const { goals, plannerResourceRequirements, plannerTodoItems } = useCraft();
  const theme = useTheme();
  const isCompactLayout = useMediaQuery(theme.breakpoints.down('md'));
  const plannerBadgeCount = useMemo(
    () =>
      goals.length
      + plannerTodoItems.filter((todo) => !todo.completed).length
      + Object.values(plannerResourceRequirements).filter((requirement) => Number(requirement?.quantity ?? 0) > 0).length,
    [goals.length, plannerResourceRequirements, plannerTodoItems],
  );
  const pendingIncomingCraftRequestCount = useMemo(
    () =>
      (account?.incomingCraftRequests ?? []).filter((request) => request.status === 'pending').length,
    [account?.incomingCraftRequests],
  );

  const goToBlueprints = useCallback(() => onChangeView('blueprints'), [onChangeView]);
  const goToMissions = useCallback(() => onChangeView('missions'), [onChangeView]);
  const goToResources = useCallback(() => onChangeView('resources'), [onChangeView]);
  const goToOrganizations = useCallback(() => onChangeView('organizations'), [onChangeView]);
  const goToPlanner = useCallback(() => onChangeView('planner'), [onChangeView]);
  const goToAccount = useCallback(() => onChangeView('account'), [onChangeView]);
  const canAccessOrganizations = Boolean(user);
  const accountIcon = useCallback(
    (size: number) =>
      (
        <Badge
          badgeContent={pendingIncomingCraftRequestCount}
          color="error"
          invisible={pendingIncomingCraftRequestCount === 0}
          sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', fontWeight: 700 } }}
        >
          {user ? (
            <Avatar
              src={user.avatarUrl ?? undefined}
              alt={user.displayName}
              sx={{
                width: size,
                height: size,
                fontSize: Math.max(11, Math.round(size * 0.48)),
                border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.22)}`,
                backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.12),
                color: 'primary.main',
              }}
            >
              {user.displayName.charAt(0).toUpperCase()}
            </Avatar>
          ) : (
            <PersonOutlineOutlinedIcon sx={{ fontSize: `${size}px` }} />
          )}
        </Badge>
      ),
    [pendingIncomingCraftRequestCount, user],
  );
  const mobileItems = [
    {
      key: 'blueprints',
      active: mainView === 'blueprints',
      label: t('Blueprints', 'Blueprints'),
      icon: <DescriptionOutlinedIcon sx={{ fontSize: MOBILE_ICON_SIZE }} />,
      onClick: goToBlueprints,
    },
    {
      key: 'missions',
      active: mainView === 'missions',
      label: t('Missions', 'Missions'),
      icon: <FlagIcon sx={{ fontSize: MOBILE_ICON_SIZE }} />,
      onClick: goToMissions,
    },
    {
      key: 'resources',
      active: mainView === 'resources',
      label: t('Resources', 'Ressources'),
      icon: <ScienceOutlinedIcon sx={{ fontSize: MOBILE_ICON_SIZE }} />,
      onClick: goToResources,
    },
    ...(canAccessOrganizations
      ? [{
          key: 'organizations',
          active: mainView === 'organizations',
          label: t('Organizations', 'Organisations', 'Organisationen'),
          icon: <GroupsOutlinedIcon sx={{ fontSize: MOBILE_ICON_SIZE }} />,
          onClick: goToOrganizations,
        }]
      : []),
    {
      key: 'planner',
      active: mainView === 'planner',
      label: t('Planner', 'Planificateur'),
      icon: (
        <Badge
          badgeContent={plannerBadgeCount}
          color="primary"
          invisible={plannerBadgeCount === 0}
          sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', fontWeight: 700 } }}
        >
          <AssignmentIcon sx={{ fontSize: MOBILE_ICON_SIZE }} />
        </Badge>
      ),
      onClick: goToPlanner,
    },
    {
      key: 'account',
      active: mainView === 'account',
      label: t('Account', 'Compte', 'Konto'),
      icon: accountIcon(MOBILE_ICON_SIZE),
      onClick: goToAccount,
    },
  ];

  if (isCompactLayout) {
    return (
      <Box
        component="nav"
        aria-label={t('Main navigation', 'Navigation principale')}
        sx={{
          width: '100%',
          backgroundColor: 'background.paper',
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
          display: 'grid',
          gridTemplateColumns: `repeat(${mobileItems.length}, minmax(0, 1fr))`,
        }}
      >
        <Box sx={{ display: 'contents' }}>
          {mobileItems.map((item) => (
            <MobileNavItem
              key={item.key}
              active={item.active}
              label={item.label}
              icon={item.icon}
              onClick={item.onClick}
            />
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <Box
      component="nav"
      aria-label={t('Main navigation', 'Navigation principale')}
      sx={{
        width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
        minWidth: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
        alignSelf: 'stretch',
        height: '100%',
        maxHeight: '100%',
        backgroundColor: 'background.paper',
        borderRight: (theme) => `1px solid ${theme.palette.divider}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 5,
        flexShrink: 0,
        contain: 'layout paint',
      }}
    >
      {/* Nav items */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
          py: 2,
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        <NavItem
          active={mainView === 'blueprints'}
          collapsed={collapsed}
          label={t('Blueprints', 'Blueprints')}
          icon={<DescriptionOutlinedIcon sx={{ fontSize: DESKTOP_ICON_SIZE }} />}
          onClick={goToBlueprints}
        />
        <NavItem
          active={mainView === 'missions'}
          collapsed={collapsed}
          label={t('Missions', 'Missions')}
          icon={<FlagIcon sx={{ fontSize: DESKTOP_ICON_SIZE }} />}
          onClick={goToMissions}
        />
        <NavItem
          active={mainView === 'resources'}
          collapsed={collapsed}
          label={t('Resources', 'Ressources')}
          icon={<ScienceOutlinedIcon sx={{ fontSize: DESKTOP_ICON_SIZE }} />}
          onClick={goToResources}
        />
        {canAccessOrganizations && (
          <NavItem
            active={mainView === 'organizations'}
            collapsed={collapsed}
            label={t('Organizations', 'Organisations', 'Organisationen')}
            icon={<GroupsOutlinedIcon sx={{ fontSize: DESKTOP_ICON_SIZE }} />}
            onClick={goToOrganizations}
          />
        )}
        <Box
          sx={{
            mt: 'auto',
            position: 'sticky',
            bottom: 0,
            pt: 1,
            backgroundColor: 'background.paper',
            zIndex: 1,
          }}
        >
          <NavItem
            active={mainView === 'planner'}
            collapsed={collapsed}
            label={t('Planner', 'Planificateur')}
            icon={
              <Badge
                badgeContent={plannerBadgeCount}
                color="primary"
                invisible={plannerBadgeCount === 0}
                sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', fontWeight: 700 } }}
              >
                <AssignmentIcon sx={{ fontSize: DESKTOP_ICON_SIZE }} />
              </Badge>
            }
            onClick={goToPlanner}
          />
          <NavItem
            active={mainView === 'account'}
            collapsed={collapsed}
            label={t('Account', 'Compte', 'Konto')}
            icon={accountIcon(DESKTOP_ICON_SIZE)}
            onClick={goToAccount}
          />
        </Box>
      </Box>

      {/* Toggle button at the bottom */}
      <Box sx={{
        p: 1.5,
        borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        display: 'flex',
        justifyContent: collapsed ? 'center' : 'flex-end',
        flexShrink: 0,
        backgroundColor: 'background.paper',
      }}>
        <IconButton
          onClick={onToggleCollapsed}
          aria-label={collapsed
            ? t('Expand navigation', 'Etendre la navigation')
            : t('Collapse navigation', 'Reduire la navigation')
          }
          size="small"
          sx={{
            transition: 'transform 250ms cubic-bezier(0.4, 0, 0.2, 1)',
            transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
          }}
        >
          <StarCitizenLicensedIcon
            name="chevron-right"
            size={16}
            dimmed
          />
        </IconButton>
      </Box>
    </Box>
  );
}
