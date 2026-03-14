import type { ReactNode } from 'react';
import type { Quality, ItemCategory } from '../../types';
import { CATEGORY_LABELS } from '../../types';
import { useI18n } from '../../i18n/I18nContext';
import { GameIcon } from './GameIcon';
import type { GameIconName } from './GameIcon';

// ─── Quality badge ────────────────────────────────────────────────────────────
interface QualityBadgeProps { quality: Quality; size?: 'sm' | 'md' }

export function QualityBadge({ quality, size = 'md' }: QualityBadgeProps) {
  const GAME_NAMES: Record<Quality, string> = { CMR: 'Powder', CMP: 'Scraps', CMS: 'Chunks' };
  return (
    <span
      className={`badge badge--quality badge--quality-${quality.toLowerCase()} badge--${size}`}
      aria-label={`${quality} — ${GAME_NAMES[quality]}`}
    >
      {quality}
    </span>
  );
}

// ─── Category badge ───────────────────────────────────────────────────────────
const CAT_GAME_ICON: Record<ItemCategory, GameIconName> = {
  'fps-weapon':    'weapons',
  'fps-magazine':  'ammos',
  'fps-armor':     'armor',
  'fps-helmet':    'armor',     // même fichier, hue différent (260°)
  'fps-undersuit': 'utilities',
  'fps-backpack':  'utilities', // même fichier, hue différent (160°)
};

/** Hue-rotate par catégorie pour distinguer celles qui partagent le même fichier */
const CAT_HUE: Partial<Record<ItemCategory, number>> = {
  'fps-helmet':    220,  // bleu-acier (vs 260° pour armor)
  'fps-backpack':  160,  // teal (vs 130° pour undersuit)
};

interface CategoryBadgeProps { category: ItemCategory; iconOnly?: boolean; shimmer?: boolean }

export function CategoryBadge({ category, iconOnly = false, shimmer = false }: CategoryBadgeProps) {
  const { lang } = useI18n();
  const label = CATEGORY_LABELS[category][lang];
  return (
    <span className={`badge badge--category badge--category-${category}`} aria-label={label}>
      <GameIcon
        name={CAT_GAME_ICON[category]}
        size={14}
        shimmer={shimmer}
        hue={CAT_HUE[category]}
      />
      {!iconOnly && <span>{label}</span>}
    </span>
  );
}

// ─── Generic badge ────────────────────────────────────────────────────────────
interface BadgeProps { children: ReactNode; variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' }

export function Badge({ children, variant = 'default' }: BadgeProps) {
  return <span className={`badge badge--${variant}`}>{children}</span>;
}
