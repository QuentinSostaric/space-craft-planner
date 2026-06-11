import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import Badge from '@mui/material/Badge';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import useMediaQuery from '@mui/material/useMediaQuery';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import FlagIcon from '@mui/icons-material/Flag';
import AssignmentIcon from '@mui/icons-material/Assignment';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import DifferenceOutlinedIcon from '@mui/icons-material/DifferenceOutlined';
import { alpha, useTheme } from '@mui/material/styles';
import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { useCraft } from '../store/CraftContext';
import { FONT_BODY } from '../theme';
import { shouldHandleInternalLinkClick } from '../utils/spaLinks';

export type MainView =
  | 'blueprints'
  | 'missions'
  | 'resources'
  | 'organizations'
  | 'planner'
  | 'changelog'
  | 'account'
  | 'privacy';

const DESKTOP_WIDTH = 84;
const DESKTOP_ICON_SIZE = 20;
const MOBILE_ICON_SIZE = 20;
const DESKTOP_LABEL_FONT_SIZE = '0.6875rem'; // 11px — readable, not tiny
const MOBILE_LABEL_FONT_SIZE = '0.6875rem';

interface NavRailProps {
  mainView: MainView;
  onChangeView: (view: MainView) => void;
}

interface NavItemProps {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  href: string;
  onNavigate: () => void;
}

function NavItem({ active, label, icon, href, onNavigate }: NavItemProps) {
  return (
    <ButtonBase
      component="a"
      href={href}
      onClick={(event) => {
        if (!shouldHandleInternalLinkClick(event)) return;
        event.preventDefault();
        onNavigate();
      }}
      aria-current={active ? 'page' : undefined}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 0.55,
        width: '100%',
        minHeight: 70,
        px: 0.5,
        py: 0.85,
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
          borderRadius: '0 3px 3px 0',
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
          transform: `scale(${active ? 1.08 : 1})`,
      }}>
        {icon}
      </Box>
      <Typography
        sx={{
          fontFamily: FONT_BODY,
          fontWeight: 600,
          fontSize: DESKTOP_LABEL_FONT_SIZE,
          lineHeight: 1.2,
          textTransform: 'none',
          letterSpacing: '0.01em',
          textAlign: 'center',
          whiteSpace: 'normal',
          pointerEvents: 'none',
          width: '100%',
          maxWidth: 76,
          overflow: 'hidden',
          opacity: 1,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          transform: 'translateX(0)',
          transition: 'opacity 160ms ease, transform 180ms ease, max-width 180ms ease',
        }}
      >
        {label}
      </Typography>
    </ButtonBase>
  );
}

function MobileNavItem({
  active,
  label,
  icon,
  href,
  onNavigate,
}: Omit<NavItemProps, 'collapsed'>) {
  return (
    <ButtonBase
      component="a"
      href={href}
      onClick={(event) => {
        if (!shouldHandleInternalLinkClick(event)) return;
        event.preventDefault();
        onNavigate();
      }}
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
        // The bar sits at the bottom of the screen, so the active indicator
        // hugs its top edge.
        '&::after': {
          content: '""',
          position: 'absolute',
          left: 8,
          right: 8,
          top: 0,
          height: 2,
          borderRadius: '0 0 2px 2px',
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
          fontFamily: FONT_BODY,
          fontWeight: 600,
          fontSize: MOBILE_LABEL_FONT_SIZE,
          lineHeight: 1.1,
          letterSpacing: '0.01em',
          textTransform: 'none',
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

export function NavRail({ mainView, onChangeView }: NavRailProps) {
  const { t } = useI18n();
  const { user, account } = useAuth();
  const { plannerTodoItems } = useCraft();
  const theme = useTheme();
  const isCompactLayout = useMediaQuery(theme.breakpoints.down('md'));
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);
  // Only open tasks: an actionable number, unlike the old goals+tasks+resources
  // aggregate whose meaning was impossible to read from the badge alone.
  const plannerBadgeCount = useMemo(
    () => plannerTodoItems.filter((todo) => !todo.completed).length,
    [plannerTodoItems],
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
  const goToChangelog = useCallback(() => onChangeView('changelog'), [onChangeView]);
  const goToAccount = useCallback(() => onChangeView('account'), [onChangeView]);
  const canAccessOrganizations = Boolean(user);
  const accountIcon = useCallback(
    (size: number) =>
      (
        <Badge
          badgeContent={pendingIncomingCraftRequestCount}
          color="error"
          invisible={pendingIncomingCraftRequestCount === 0}
          sx={{ '& .MuiBadge-badge': { fontSize: '0.6875rem', fontWeight: 700 } }}
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
  // Bottom bar keeps the 4 core destinations + account; secondary views live in
  // the "More" overflow menu so each tab keeps a comfortable touch target.
  const mobileItems = [
    {
      key: 'blueprints',
      active: mainView === 'blueprints',
      label: t('Blueprints', 'Blueprints'),
      icon: <DescriptionOutlinedIcon sx={{ fontSize: MOBILE_ICON_SIZE }} />,
      href: '/',
      onNavigate: goToBlueprints,
    },
    {
      key: 'missions',
      active: mainView === 'missions',
      label: t('Missions', 'Missions'),
      icon: <FlagIcon sx={{ fontSize: MOBILE_ICON_SIZE }} />,
      href: '/missions',
      onNavigate: goToMissions,
    },
    {
      key: 'resources',
      active: mainView === 'resources',
      label: t('Resources', 'Ressources'),
      icon: <ScienceOutlinedIcon sx={{ fontSize: MOBILE_ICON_SIZE }} />,
      href: '/resources',
      onNavigate: goToResources,
    },
    {
      key: 'planner',
      active: mainView === 'planner',
      label: t('Planner', 'Planificateur'),
      icon: (
        <Badge
          badgeContent={plannerBadgeCount}
          color="primary"
          invisible={plannerBadgeCount === 0}
          sx={{ '& .MuiBadge-badge': { fontSize: '0.6875rem', fontWeight: 700 } }}
        >
          <AssignmentIcon sx={{ fontSize: MOBILE_ICON_SIZE }} />
        </Badge>
      ),
      href: '/planner',
      onNavigate: goToPlanner,
    },
  ];

  const moreItems = [
    {
      key: 'account',
      active: mainView === 'account',
      label: t('Account', 'Compte', 'Konto'),
      icon: accountIcon(MOBILE_ICON_SIZE),
      onNavigate: goToAccount,
    },
    {
      key: 'changelog',
      active: mainView === 'changelog',
      label: t('Changelog', 'Changelog'),
      icon: <DifferenceOutlinedIcon sx={{ fontSize: MOBILE_ICON_SIZE }} />,
      onNavigate: goToChangelog,
    },
    ...(canAccessOrganizations
      ? [{
          key: 'organizations',
          active: mainView === 'organizations',
          label: t('Organizations', 'Organisations', 'Organisationen'),
          icon: <GroupsOutlinedIcon sx={{ fontSize: MOBILE_ICON_SIZE }} />,
          onNavigate: goToOrganizations,
        }]
      : []),
  ];
  const moreActive = moreItems.some((item) => item.active);

  if (isCompactLayout) {
    return (
      <Box
        component="nav"
        aria-label={t('Main navigation', 'Navigation principale')}
        sx={{
          width: '100%',
          backgroundColor: 'background.paper',
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
          display: 'grid',
          gridTemplateColumns: `repeat(${mobileItems.length + 1}, minmax(0, 1fr))`,
          pb: 'env(safe-area-inset-bottom)',
        }}
      >
        <Box sx={{ display: 'contents' }}>
          {mobileItems.map((item) => (
            <MobileNavItem
              key={item.key}
              active={item.active}
              label={item.label}
              icon={item.icon}
              href={item.href}
              onNavigate={item.onNavigate}
            />
          ))}
          <ButtonBase
            onClick={(event) => setMoreAnchor(event.currentTarget)}
            aria-haspopup="menu"
            aria-expanded={moreAnchor ? 'true' : undefined}
            aria-label={t('More', 'Plus', 'Mehr')}
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
              color: moreActive ? 'primary.main' : 'text.secondary',
              backgroundColor: moreActive ? (theme) => alpha(theme.palette.primary.main, 0.08) : 'transparent',
              '&::after': {
                content: '""',
                position: 'absolute',
                left: 8,
                right: 8,
                top: 0,
                height: 2,
                borderRadius: '0 0 2px 2px',
                backgroundColor: 'primary.main',
                opacity: moreActive ? 1 : 0,
                transition: 'opacity 160ms ease',
              },
            }}
          >
            <Badge
              variant="dot"
              color="error"
              invisible={pendingIncomingCraftRequestCount === 0}
            >
              <MoreHorizIcon sx={{ fontSize: MOBILE_ICON_SIZE }} />
            </Badge>
            <Typography
              sx={{
                fontFamily: FONT_BODY,
                fontWeight: 600,
                fontSize: MOBILE_LABEL_FONT_SIZE,
                lineHeight: 1.1,
                letterSpacing: '0.01em',
              }}
            >
              {t('More', 'Plus', 'Mehr')}
            </Typography>
          </ButtonBase>
          <Menu
            anchorEl={moreAnchor}
            open={Boolean(moreAnchor)}
            onClose={() => setMoreAnchor(null)}
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          >
            {moreItems.map((item) => (
              <MenuItem
                key={item.key}
                selected={item.active}
                onClick={() => {
                  setMoreAnchor(null);
                  item.onNavigate();
                }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText>{item.label}</ListItemText>
              </MenuItem>
            ))}
          </Menu>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      component="nav"
      aria-label={t('Main navigation', 'Navigation principale')}
      sx={{
        width: DESKTOP_WIDTH,
        minWidth: DESKTOP_WIDTH,
        alignSelf: 'stretch',
        minHeight: 'inherit',
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
          label={t('Blueprints', 'Blueprints')}
          icon={<DescriptionOutlinedIcon sx={{ fontSize: DESKTOP_ICON_SIZE }} />}
          href="/"
          onNavigate={goToBlueprints}
        />
        <NavItem
          active={mainView === 'missions'}
          label={t('Missions', 'Missions')}
          icon={<FlagIcon sx={{ fontSize: DESKTOP_ICON_SIZE }} />}
          href="/missions"
          onNavigate={goToMissions}
        />
        <NavItem
          active={mainView === 'resources'}
          label={t('Resources', 'Ressources')}
          icon={<ScienceOutlinedIcon sx={{ fontSize: DESKTOP_ICON_SIZE }} />}
          href="/resources"
          onNavigate={goToResources}
        />
        <NavItem
          active={mainView === 'changelog'}
          label={t('Changelog', 'Changelog')}
          icon={<DifferenceOutlinedIcon sx={{ fontSize: DESKTOP_ICON_SIZE }} />}
          href="/changelog"
          onNavigate={goToChangelog}
        />
        {canAccessOrganizations && (
          <NavItem
            active={mainView === 'organizations'}
            label={t('Organizations', 'Organisations', 'Organisationen')}
            icon={<GroupsOutlinedIcon sx={{ fontSize: DESKTOP_ICON_SIZE }} />}
            href="/organizations"
            onNavigate={goToOrganizations}
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
            label={t('Planner', 'Planificateur')}
            icon={
              <Badge
                badgeContent={plannerBadgeCount}
                color="primary"
                invisible={plannerBadgeCount === 0}
                sx={{ '& .MuiBadge-badge': { fontSize: '0.6875rem', fontWeight: 700 } }}
              >
                <AssignmentIcon sx={{ fontSize: DESKTOP_ICON_SIZE }} />
              </Badge>
            }
            href="/planner"
            onNavigate={goToPlanner}
          />
          <NavItem
            active={mainView === 'account'}
            label={t('Account', 'Compte', 'Konto')}
            icon={accountIcon(DESKTOP_ICON_SIZE)}
            href="/account"
            onNavigate={goToAccount}
          />
        </Box>
      </Box>
    </Box>
  );
}
