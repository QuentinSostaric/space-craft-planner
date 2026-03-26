import { styled, keyframes } from '@mui/material/styles';
import { Box } from '@mui/material';

// ─── Animations ──────────────────────────────────────────────────────────────

const shimmerAnim = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const pulseAnim = keyframes`
  0% { filter: brightness(1) drop-shadow(0 0 0 rgba(129, 140, 248, 0)); }
  50% { filter: brightness(1.3) drop-shadow(0 0 8px rgba(129, 140, 248, 0.5)); }
  100% { filter: brightness(1) drop-shadow(0 0 0 rgba(129, 140, 248, 0)); }
`;

// ─── Icon registry ─────────────────────────────────────────────────────────────

export type GameIconName =
  | 'weapons' | 'ammos' | 'armor' | 'utilities'
  | 'shields' | 'missiles' | 'bombs' | 'engines' | 'gimbal'
  | 'turrets' | 'mounts' | 'thrusters' | 'power-plants' | 'coolers'
  | 'radars' | 'qeds' | 'emps'
  | 'mining-gadget' | 'mining-lasers' | 'salvage' | 'tractor-beams'
  | 'shopping-cart' | 'info' | 'add' | 'calculator' | 'computer'
  | 'hangar' | 'ships' | 'shop';

const SVG_ICONS = new Set<GameIconName>([
  'armor',
  'hangar',
  'mining-lasers',
  'ships',
  'shop',
  'utilities',
  'weapons',
]);

export const ICON_HUE_OFFSET: Partial<Record<GameIconName, number>> = {
  'weapons':      0,
  'ammos':        25,
  'armor':        260,
  'utilities':    130,
  'shields':      220,
  'thrusters':    -30,
  'power-plants': 40,
  'missiles':     -10,
  'mining-gadget':110,
  'salvage':      55,
  'shop':         200,
};

// ─── Styled Component ────────────────────────────────────────────────────────

const IconBase = styled('span', {
  shouldForwardProp: (prop) => !['size', 'shimmer', 'pulse', 'hue', 'url'].includes(prop as string),
})<{ size: number; shimmer?: boolean; pulse?: boolean; hue: number; url: string }>(
  ({ size, shimmer, pulse, hue, url, theme }) => {
    const animations = [
      shimmer && `${shimmerAnim} 3s infinite linear`,
      pulse && `${pulseAnim} 2s infinite ease-in-out`,
    ].filter(Boolean).join(', ');

    return {
      display: 'inline-block',
      width: size,
      height: size,
      backgroundColor: theme.palette.text.primary,
      maskImage: `url(${url})`,
      WebkitMaskImage: `url(${url})`,
      maskSize: 'contain',
      WebkitMaskSize: 'contain',
      maskRepeat: 'no-repeat',
      WebkitMaskRepeat: 'no-repeat',
      maskPosition: 'center',
      WebkitMaskPosition: 'center',
      filter: hue !== 0 ? `hue-rotate(${hue}deg)` : undefined,
      flexShrink: 0,

      ...(shimmer && {
        background: `linear-gradient(90deg,
          ${theme.palette.text.primary} 0%,
          ${theme.palette.primary.light} 50%,
          ${theme.palette.text.primary} 100%)`,
        backgroundSize: '200% 100%',
      }),

      animation: animations || undefined,
    };
  }
);

export interface GameIconProps {
  name: GameIconName;
  size?: number;
  shimmer?: boolean;
  pulse?: boolean;
  hue?: number;
  className?: string;
}

export function GameIcon({
  name,
  size = 20,
  shimmer = false,
  pulse = false,
  hue,
  className,
}: GameIconProps) {
  const ext  = SVG_ICONS.has(name) ? 'svg' : 'png';
  const url  = `/icons/game/${name}.${ext}`;
  const deg  = hue ?? ICON_HUE_OFFSET[name] ?? 0;

  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <IconBase
        size={size}
        shimmer={shimmer}
        pulse={pulse}
        hue={deg}
        url={url}
        className={className}
        aria-hidden="true"
      />
    </Box>
  );
}
