import { styled, keyframes } from '@mui/material/styles';
import { Box } from '@mui/material';

/**
 * Displays a resource icon (ore, metal…) using the same
 * iridescent mask system as GameIcon.
 * PNGs are white on transparent background — ideal for CSS masking.
 */

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

// ─── Hue registry ────────────────────────────────────────────────────────────

/** Iridescent hue offset per resource (hue-rotate in degrees). */
export const RESOURCE_HUE: Readonly<Record<string, number>> = Object.freeze({
  agricium:      90,   // lime-green
  aluminum:     200,   // silver-cyan
  aslarite:     340,   // rose
  beryl:        150,   // emerald
  carbon:        70,   // yellow-charcoal
  copper:        25,   // warm copper
  corundum:     270,   // sapphire
  gold:          40,   // gold-amber
  hephaestanite: 15,   // forge-red
  iron:           0,   // metallic amber (base)
  laranite:     300,   // violet-mauve
  lindinium:    170,   // teal
  ouratite:      60,   // yellow-green
  quartz:       320,   // rose-quartz
  riccite:      240,   // indigo
  savrilium:    280,   // violet
  silicon:      130,   // green-teal
  stileron:     120,   // green
  taranite:     180,   // blue-teal
  tin:          210,   // grey-blue
  titanium:     220,   // steel-blue
  torite:       350,   // crimson-red
  tungsten:     260,   // blue-violet
});

// ─── Styled component ────────────────────────────────────────────────────────

const IconBase = styled('span', {
  shouldForwardProp: (prop) =>
    !['size', 'shimmer', 'pulse', 'dimmed', 'hue', 'url'].includes(prop as string),
})<{ size: number; shimmer?: boolean; pulse?: boolean; dimmed?: boolean; hue: number; url: string }>(
  ({ size, shimmer, pulse, dimmed, hue, url, theme }) => ({
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
    filter: `hue-rotate(${hue}deg)`,
    flexShrink: 0,
    opacity: dimmed ? 0.4 : 1,
    transition: 'opacity 0.2s',

    ...(shimmer && {
      background: `linear-gradient(90deg,
        ${theme.palette.text.primary} 0%,
        ${theme.palette.primary.light} 50%,
        ${theme.palette.text.primary} 100%)`,
      backgroundSize: '200% 100%',
      animation: `${shimmerAnim} 3s infinite linear`,
    }),

    ...(pulse && {
      animation: `${pulseAnim} 2s infinite ease-in-out`,
    }),
  })
);

// ─── Public API ──────────────────────────────────────────────────────────────

export interface ResourceIconProps {
  /** Resource name as it comes from the data (e.g. "Iron", "Titanium").
   *  Lowercased to build the file path. */
  name: string;
  /** Height in px. Width follows the natural ratio. */
  size?: number;
  /** Iridescent shimmer animation. */
  shimmer?: boolean;
  /** Luminous pulse for active/selected state. */
  pulse?: boolean;
  /** Dimmed/inactive appearance. */
  dimmed?: boolean;
  className?: string;
}

export function ResourceIcon({
  name,
  size = 20,
  shimmer = false,
  pulse = false,
  dimmed = false,
  className,
}: ResourceIconProps) {
  const id  = name.toLowerCase().trim();
  const hue = RESOURCE_HUE[id] ?? 0;
  const url = `/icons/resources/${id}.png`;

  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <IconBase
        size={size}
        shimmer={shimmer}
        pulse={pulse}
        dimmed={dimmed}
        hue={hue}
        url={url}
        className={className}
        aria-hidden="true"
      />
    </Box>
  );
}
