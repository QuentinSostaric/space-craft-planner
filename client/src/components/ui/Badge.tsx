import type { ReactNode } from 'react';
import Chip from '@mui/material/Chip';
import type { ItemCategory } from '../../types';
import { CATEGORY_LABELS } from '../../types';
import { useI18n } from '../../i18n/I18nContext';
import { GameIcon } from './GameIcon';
import type { GameIconName } from './GameIcon';
import { tokens } from '../../theme';

// ─── Quality badge ────────────────────────────────────────────────────────────
interface QualityBadgeProps { qualityValue: number; size?: 'sm' | 'md' }

export function QualityBadge({ qualityValue, size = 'md' }: QualityBadgeProps) {
  const { t } = useI18n();
  const label = `Q${Math.round(qualityValue)}`;
  return (
    <Chip
      label={label}
      size="small"
      variant="outlined"
      aria-label={`${t('Quality', 'Qualite')} ${Math.round(qualityValue)}`}
      sx={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: size === 'sm' ? '.62rem' : '.65rem',
        height: size === 'sm' ? 20 : 24,
        px: size === 'sm' ? 0.5 : 1,
      }}
    />
  );
}

/** Show a minimum quality requirement as a badge */
interface MinQualityBadgeProps { minQuality: number; size?: 'sm' | 'md' }

export function MinQualityBadge({ minQuality, size = 'md' }: MinQualityBadgeProps) {
  const { t } = useI18n();
  const label = `>= ${Math.round(minQuality)}`;
  return (
    <Chip
      label={label}
      size="small"
      variant="outlined"
      aria-label={`${t('Minimum quality', 'Qualite minimale')} ${Math.round(minQuality)}`}
      sx={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: size === 'sm' ? '.62rem' : '.65rem',
        height: size === 'sm' ? 20 : 24,
        px: size === 'sm' ? 0.5 : 1,
      }}
    />
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
const VARIANT_COLORS: Record<string, { color: string; borderColor: string }> = {
  default: { color: tokens.textMuted, borderColor: tokens.border },
  success: { color: tokens.success, borderColor: 'rgba(52,211,153,.25)' },
  warning: { color: tokens.warning, borderColor: 'rgba(251,191,36,.25)' },
  danger:  { color: tokens.danger, borderColor: 'rgba(248,113,113,.25)' },
  info:    { color: tokens.info, borderColor: 'rgba(96,165,250,.25)' },
};

interface BadgeProps { children: ReactNode; variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' }

export function Badge({ children, variant = 'default' }: BadgeProps) {
  const colors = VARIANT_COLORS[variant];
  return (
    <Chip
      label={children}
      size="small"
      variant="outlined"
      sx={{
        color: colors.color,
        borderColor: colors.borderColor,
        backgroundColor: 'transparent',
      }}
    />
  );
}
