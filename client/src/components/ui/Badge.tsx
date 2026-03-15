import type { ReactNode } from 'react';
import type { ItemCategory } from '../../types';
import { CATEGORY_LABELS, QUALITY_PRESET_LABEL, qualityValueToPreset } from '../../types';
import { useI18n } from '../../i18n/I18nContext';
import { GameIcon } from './GameIcon';
import type { GameIconName } from './GameIcon';

// ─── Quality badge ────────────────────────────────────────────────────────────
interface QualityBadgeProps { qualityValue: number; size?: 'sm' | 'md' }

export function QualityBadge({ qualityValue, size = 'md' }: QualityBadgeProps) {
  const { lang } = useI18n();
  const preset = qualityValueToPreset(qualityValue);
  const label = QUALITY_PRESET_LABEL[preset][lang];
  return (
    <span
      className={`badge badge--quality badge--quality-${preset} badge--${size}`}
      aria-label={`${label} (${qualityValue})`}
    >
      {label}
    </span>
  );
}

/** Show a minimum quality requirement as a badge */
interface MinQualityBadgeProps { minQuality: number; size?: 'sm' | 'md' }

export function MinQualityBadge({ minQuality, size = 'md' }: MinQualityBadgeProps) {
  const { lang } = useI18n();
  const preset = qualityValueToPreset(minQuality);
  const label = QUALITY_PRESET_LABEL[preset][lang];
  return (
    <span
      className={`badge badge--quality badge--quality-${preset} badge--${size}`}
      aria-label={`Min: ${label} (${minQuality})`}
    >
      {label}+
    </span>
  );
}

// ─── Category badge ───────────────────────────────────────────────────────────
const CAT_GAME_ICON: Record<ItemCategory, GameIconName> = {
  'fps-weapon':    'weapons',
  'fps-magazine':  'ammos',
  'fps-armor':     'armor',
  'fps-helmet':    'armor',
  'fps-undersuit': 'utilities',
  'fps-backpack':  'utilities',
};

const CAT_HUE: Partial<Record<ItemCategory, number>> = {
  'fps-helmet':    220,
  'fps-backpack':  160,
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
