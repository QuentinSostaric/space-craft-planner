import { useTheme, alpha } from '../../ui/system';
import { AppChip } from './data-display/AppChip';
import type { ReactNode } from 'react';
import type { ItemCategory } from '../../types';
import { CATEGORY_LABELS } from '../../types';
import { loc, useI18n } from '../../i18n/I18nContext';
import { GameIcon } from './GameIcon';
import type { GameIconName } from './GameIcon';
import { FONT_MONO, TEXT_LABEL} from '../../theme';

// ─── Quality badge ────────────────────────────────────────────────────────────
interface QualityBadgeProps { qualityValue: number; size?: 'sm' | 'md' }

export function QualityBadge({ qualityValue, size = 'md' }: QualityBadgeProps) {
  const { t } = useI18n();
  const label = `Q${Math.round(qualityValue)}`;
  return (
    <AppChip
      label={label}
      size="sm"
      outlined
      ariaLabel={`${t('Quality', 'Qualite')} ${Math.round(qualityValue)}`}
      sx={{
        fontFamily: FONT_MONO,
        fontSize: TEXT_LABEL,
        height: size === 'sm' ? 20 : 24,
        px: size === 'sm' ? 0.5 : 1,
        borderColor: 'divider',
        color: 'text.secondary',
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
    <AppChip
      label={label}
      size="sm"
      outlined
      ariaLabel={`${t('Minimum quality', 'Qualite minimale')} ${Math.round(minQuality)}`}
      sx={{
        fontFamily: FONT_MONO,
        fontSize: TEXT_LABEL,
        height: size === 'sm' ? 20 : 24,
        px: size === 'sm' ? 0.5 : 1,
        borderColor: 'divider',
        color: 'text.secondary',
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
  powerplant:      'power-plants',
  cooler:          'coolers',
  'shield-generator': 'shields',
  'quantum-drive': 'engines',
  radar:           'radars',
  'fuel-nozzle':   'utilities',
  'ship-weapon':   'weapons',
  'mining-laser':  'mining-lasers',
  'salvage-head':  'salvage',
  'tractor-beam':  'tractor-beams',
};

const CAT_HUE: Partial<Record<ItemCategory, number>> = {
  'fps-helmet':    220,
  'fps-backpack':  160,
  powerplant:      40,
  cooler:          190,
  'shield-generator': 220,
  'quantum-drive': 280,
  radar:           120,
  'fuel-nozzle':   205,
  'ship-weapon':   0,
  'mining-laser':  110,
  'salvage-head':  55,
  'tractor-beam':  150,
};

interface CategoryBadgeProps { category: ItemCategory; iconOnly?: boolean; shimmer?: boolean }

export function CategoryBadge({ category, iconOnly = false, shimmer = false }: CategoryBadgeProps) {
  const { lang } = useI18n();
  const theme = useTheme();
  const fallbackLabel = String(category).replace(/[-_]+/g, ' ');
  const label = loc(CATEGORY_LABELS[category], lang) || fallbackLabel;
  const iconName = CAT_GAME_ICON[category] ?? 'utilities';
  return (
    <AppChip
      icon={
        <GameIcon
          name={iconName}
          size={14}
          shimmer={shimmer}
          hue={CAT_HUE[category]}
        />
      }
      label={!iconOnly ? label : undefined}
      size="sm"
      outlined
      ariaLabel={label}
      sx={{
        borderColor: 'divider',
        color: 'text.secondary',
        height: 24,
        backgroundColor: alpha(theme.palette.text.primary, 0.02),
        '& > :first-child': {
          marginLeft: 4,
          marginRight: iconOnly ? 4 : 0,
        },
        ...(iconOnly && {
          width: 24,
          padding: 0,
          '& > span': { display: 'none' },
        }),
      }}
    />
  );
}

// ─── Generic badge ────────────────────────────────────────────────────────────
interface BadgeProps { children: ReactNode; variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' }

export function Badge({ children, variant = 'default' }: BadgeProps) {
  const theme = useTheme();
  
  const colors = {
    default: { color: theme.palette.text.secondary, border: theme.palette.divider },
    success: { color: theme.palette.success.main, border: alpha(theme.palette.success.main, 0.2) },
    warning: { color: theme.palette.warning.main, border: alpha(theme.palette.warning.main, 0.2) },
    danger:  { color: theme.palette.error.main, border: alpha(theme.palette.error.main, 0.2) },
    info:    { color: theme.palette.info.main, border: alpha(theme.palette.info.main, 0.2) },
  };

  const current = colors[variant];

  return (
    <AppChip
      label={children}
      size="sm"
      outlined
      sx={{
        color: current.color,
        borderColor: current.border,
        backgroundColor: alpha(current.color, 0.03),
        fontWeight: 600,
        fontSize: TEXT_LABEL,
        height: 22,
      }}
    />
  );
}
