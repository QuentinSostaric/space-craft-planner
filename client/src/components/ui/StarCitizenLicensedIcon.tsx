import Box from '@mui/material/Box';
import { alpha, useTheme } from '@mui/material/styles';

export type StarCitizenLicensedIconName =
  | 'asteroid'
  | 'moon'
  | 'planet'
  | 'jump-point'
  | 'live'
  | 'chevron-left'
  | 'chevron-right'
  | 'download';

const ICON_PATHS: Record<StarCitizenLicensedIconName, string> = {
  asteroid: '/icons/star-citizen-licensed/cc-by-3.0/asteroidnav.svg',
  moon: '/icons/star-citizen-licensed/cc-by-3.0/moonnav.svg',
  planet: '/icons/star-citizen-licensed/cc-by-3.0/planetnav.svg',
  'jump-point': '/icons/star-citizen-licensed/cc-by-3.0/jumppointnav.svg',
  live: '/icons/star-citizen-licensed/cc-by-sa-3.0/icon-live.svg',
  'chevron-left': '/icons/star-citizen-licensed/cc-by-3.0/chevron-left.svg',
  'chevron-right': '/icons/star-citizen-licensed/cc-by-3.0/chevron-right.svg',
  download: '/icons/star-citizen-licensed/cc-by-3.0/download.svg',
};

const SYSTEM_NAMES = new Set(['stanton', 'pyro', 'nyx']);
const MOON_NAMES = new Set([
  'aberdeen',
  'arial',
  'calliope',
  'cellin',
  'clio',
  'daymar',
  'euterpe',
  'ita',
  'lyria',
  'magda',
  'wala',
  'yela',
]);

export interface StarCitizenLicensedIconProps {
  name: StarCitizenLicensedIconName;
  size?: number;
  dimmed?: boolean;
  rotateDeg?: number;
  className?: string;
}

export function StarCitizenLicensedIcon({
  name,
  size = 16,
  dimmed = false,
  rotateDeg = 0,
  className,
}: StarCitizenLicensedIconProps) {
  const theme = useTheme();

  return (
    <Box
      component="img"
      src={ICON_PATHS[name]}
      alt=""
      aria-hidden="true"
      className={className}
      sx={{
        width: size,
        height: size,
        objectFit: 'contain',
        flexShrink: 0,
        opacity: dimmed ? 0.75 : 1,
        filter:
          theme.palette.mode === 'dark'
            ? `drop-shadow(0 0 6px ${alpha(theme.palette.primary.main, 0.16)})`
            : 'none',
        transform: rotateDeg ? `rotate(${rotateDeg}deg)` : undefined,
      }}
    />
  );
}

export function getLocationIconName(location: string | null | undefined): StarCitizenLicensedIconName | null {
  if (!location) {
    return null;
  }

  const normalized = location.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (SYSTEM_NAMES.has(normalized)) {
    return 'jump-point';
  }

  if (MOON_NAMES.has(normalized)) {
    return 'moon';
  }

  return 'planet';
}

export function getMaterialProviderIconName(
  providerType: string | null | undefined,
  displayName: string | null | undefined,
  system: string | null | undefined,
): StarCitizenLicensedIconName | null {
  if (providerType === 'asteroid-hotspot') {
    return 'asteroid';
  }

  if (providerType === 'body-provider') {
    return getLocationIconName(displayName) ?? getLocationIconName(system) ?? 'planet';
  }

  return getLocationIconName(displayName) ?? getLocationIconName(system);
}
