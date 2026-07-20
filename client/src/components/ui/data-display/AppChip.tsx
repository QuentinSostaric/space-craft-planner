import type { MouseEventHandler, ReactNode } from 'react';
import { Box, ButtonBase, alpha, type SxValue, useTheme } from '../../../ui/system';

export type AppChipTone = 'default' | 'primary' | 'info' | 'success' | 'warning' | 'danger';
export type AppChipSize = 'sm' | 'md';

export interface AppChipProps {
  label?: ReactNode;
  icon?: ReactNode;
  tone?: AppChipTone;
  size?: AppChipSize | 'small' | 'medium';
  outlined?: boolean;
  variant?: 'filled' | 'outlined';
  color?: 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'success' | 'info';
  selected?: boolean;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  onRemove?: () => void;
  removeLabel?: string;
  ariaLabel?: string;
  className?: string;
  sx?: SxValue;
}

export function AppChip({
  label,
  icon,
  tone = 'default',
  size = 'md',
  outlined = false,
  variant,
  color,
  selected = false,
  disabled = false,
  onClick,
  onRemove,
  removeLabel = 'Remove',
  ariaLabel,
  className,
  sx,
}: AppChipProps) {
  const theme = useTheme();
  const resolvedTone = color === 'error'
    ? 'danger'
    : color === 'secondary'
      ? 'info'
      : color ?? tone;
  const resolvedOutlined = variant === 'outlined' || outlined;
  const chipColor = resolvedTone === 'default'
    ? theme.palette.text.secondary
    : resolvedTone === 'danger'
      ? theme.palette.error.main
      : theme.palette[resolvedTone].main;
  const interactive = Boolean(onClick);
  const compact = size === 'sm' || size === 'small';
  const height = compact ? 24 : 30;

  return (
    <Box
      component={interactive ? ButtonBase : 'span'}
      type={interactive ? 'button' : undefined}
      onClick={onClick}
      disabled={interactive ? disabled : undefined}
      aria-label={ariaLabel}
      className={className}
      sx={[
        {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.5,
          minWidth: 0,
          height,
          px: compact ? 1 : 1.25,
          borderRadius: 0.75,
          border: `1px solid ${resolvedOutlined ? alpha(chipColor, 0.5) : selected ? alpha(chipColor, 0.65) : 'transparent'}`,
          backgroundColor: resolvedOutlined ? 'transparent' : selected ? alpha(chipColor, 0.2) : alpha(chipColor, 0.12),
          color: chipColor,
          fontSize: compact ? '0.75rem' : '0.8125rem',
          fontWeight: 600,
          lineHeight: 1,
          whiteSpace: 'nowrap',
          opacity: disabled ? 0.5 : 1,
          cursor: interactive && !disabled ? 'pointer' : undefined,
          '&:hover': interactive && !disabled ? { backgroundColor: alpha(chipColor, 0.2), borderColor: alpha(chipColor, 0.55) } : undefined,
        },
        sx,
      ]}
    >
      {icon}
      {label != null && (
        <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </Box>
      )}
      {onRemove && (
        <ButtonBase
          type="button"
          aria-label={removeLabel}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
            marginRight: -0.5,
            borderRadius: '50%',
            color: 'inherit',
            '&:hover': { backgroundColor: alpha(chipColor, 0.18) },
          }}
        >
          <span aria-hidden="true">×</span>
        </ButtonBase>
      )}
    </Box>
  );
}

export default AppChip;
