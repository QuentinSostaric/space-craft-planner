import type { CSSProperties } from 'react';

/**
 * Affiche l'icône d'une ressource SC (minerai, métal…) avec le même
 * système de masque iridescent que GameIcon.
 * Les PNG sont blancs sur fond transparent — parfaits pour le masque CSS.
 */

/** Décalage de teinte iridescente par ressource (hue-rotate en degrés).
 *  Chaque minerai a sa signature colorimétrique. */
export const RESOURCE_HUE: Record<string, number> = {
  agricium:      90,   // lime-vert
  aluminum:     200,   // argent-cyan
  aslarite:     340,   // rose
  beryl:        150,   // émeraude
  carbon:        70,   // jaune-charbon
  copper:        25,   // cuivre chaud
  corundum:     270,   // saphir
  gold:          40,   // or-ambre
  hephaestanite: 15,   // rouge-forge
  iron:           0,   // ambre métallique (base)
  laranite:     300,   // violet-mauve
  lindinium:    170,   // teal
  ouratite:      60,   // vert-jaune
  quartz:       320,   // quartz-rose
  riccite:      240,   // indigo
  savrilium:    280,   // violet
  silicon:      130,   // vert-teal
  stileron:     120,   // vert
  taranite:     180,   // bleu-teal
  tin:          210,   // gris-bleu
  titanium:     220,   // acier-bleu
  torite:       350,   // rouge-cramoisi
  tungsten:     260,   // bleu-violet
};

export interface ResourceIconProps {
  /** Nom de la ressource tel qu'il vient des données (e.g. "Iron", "Titanium").
   *  Converti en minuscules pour construire le chemin du fichier. */
  name: string;
  /** Hauteur en px. La largeur suit le ratio naturel. */
  size?: number;
  /** Animation shimmer iridescente. */
  shimmer?: boolean;
  /** Pulsation lumineuse pour état actif/sélectionné. */
  pulse?: boolean;
  className?: string;
}

export function ResourceIcon({ name, size = 20, shimmer = false, pulse = false, className }: ResourceIconProps) {
  const id  = name.toLowerCase().trim();
  const hue = RESOURCE_HUE[id] ?? 0;
  const url = `/icons/resources/${id}.png`;

  const style: CSSProperties = {
    '--gi-url':  `url(${url})`,
    '--gi-size': `${size}px`,
    '--gi-hue':  `${hue}deg`,
  } as CSSProperties;

  return (
    <span
      className={[
        'game-icon',                           // réutilise le système CSS .game-icon
        shimmer && 'game-icon--shimmer',
        pulse   && 'game-icon--pulse',
        className,
      ].filter(Boolean).join(' ')}
      style={style}
      aria-hidden="true"
    />
  );
}
