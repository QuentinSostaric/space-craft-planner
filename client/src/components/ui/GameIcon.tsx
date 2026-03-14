import type { CSSProperties } from 'react';

// ─── Icon registry ─────────────────────────────────────────────────────────────
export type GameIconName =
  // FPS gear (notre mapping catégorie)
  | 'weapons'       // fps-weapon
  | 'ammos'         // fps-magazine
  | 'armor'         // fps-armor + fps-helmet
  | 'utilities'     // fps-undersuit + fps-backpack
  // Ship components
  | 'shields' | 'missiles' | 'bombs' | 'engines' | 'gimbal'
  | 'turrets' | 'mounts' | 'thrusters' | 'power-plants' | 'coolers'
  | 'radars' | 'qeds' | 'emps'
  // Activités de farm
  | 'mining-gadget' | 'mining-lasers' | 'salvage' | 'tractor-beams'
  // UI
  | 'shopping-cart' | 'info' | 'add' | 'calculator' | 'computer'
  | 'hangar' | 'ships' | 'shop';

/** Icones disponibles au format SVG (le reste est PNG) */
const SVG_ICONS = new Set<GameIconName>(['mining-lasers', 'hangar', 'ships', 'shop']);

/** Variantes de gradient iridescent par icone (hue-rotate offset en degrés).
 *  Permet de différencier visuellement les catégories qui partagent le même fichier. */
export const ICON_HUE_OFFSET: Partial<Record<GameIconName, number>> = {
  'weapons':      0,    // amber → violet → blue (base)
  'ammos':        25,   // décalé chaud (orange-cuivré)
  'armor':        260,  // décalé vers le bleu-acier
  'utilities':    130,  // teal-vert pour utilities
  'shields':      220,  // bleu profond
  'thrusters':    -30,  // chaud orange
  'power-plants': 40,   // jaune-or
  'missiles':     -10,  // rouge-orange
  'mining-gadget':110,  // vert-teal
  'salvage':      55,   // jaune-vert
  'shop':         200,  // cyan
};

export interface GameIconProps {
  name: GameIconName;
  /** Hauteur en px. La largeur suit le ratio naturel de l'icone (contain). */
  size?: number;
  /** Active l'animation de déplacement du gradient iridescent. */
  shimmer?: boolean;
  /** Pulse lumineux — pour états actifs/sélectionnés. */
  pulse?: boolean;
  /** Applique un hue-rotate personnalisé (écrase ICON_HUE_OFFSET). */
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

  const style: CSSProperties = {
    '--gi-url':  `url(${url})`,
    '--gi-size': `${size}px`,
    '--gi-hue':  `${deg}deg`,
  } as CSSProperties;

  return (
    <span
      className={[
        'game-icon',
        shimmer && 'game-icon--shimmer',
        pulse   && 'game-icon--pulse',
        className,
      ].filter(Boolean).join(' ')}
      style={style}
      aria-hidden="true"
    />
  );
}
