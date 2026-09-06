import { ValueFeedback } from '../ui/ValueFeedback';
import { Box, Paper, Typography } from '../../ui/system';
import type { SxProps, Theme } from '../../ui/system';
import type { ReactNode } from 'react';
import { FONT_DISPLAY, FONT_MONO } from '../../theme';

/**
 * Bento card: the single panel shape of the Fabricator work grid.
 *
 * Header = accent tick + title (+ muted mono note), with a free-form `right`
 * slot for the hero number or inline controls. The accent also tints the card's
 * left edge, which is how a section's functional category is read at a glance.
 */
export function BentoPanel({
  id,
  accent,
  title,
  note,
  right,
  span,
  children,
  bodySx,
  sx,
  collapsible = false,
}: {
  id?: string;
  accent?: string;
  title: string;
  note?: string;
  right?: ReactNode;
  /** Column span inside the 12-column work grid (lg and up). */
  span?: number;
  children: ReactNode;
  bodySx?: SxProps<Theme>;
  sx?: SxProps<Theme>;
  /** Secondary work panels keep their summary visible and reveal detail on demand. */
  collapsible?: boolean;
}) {
  return (
    <Paper
      id={id}
      component={collapsible ? 'details' : 'div'}
      className={collapsible ? 'workspace-panel workspace-disclosure fabricator-panel-disclosure' : 'workspace-panel'}
      sx={[
        {
          borderRadius: '5px',
          backgroundColor: 'ui.surface',
          overflow: 'hidden',
          minWidth: 0,
          gridColumn: span ? { xs: 'span 12', lg: `span ${span}` } : 'span 12',
          ...(accent ? { boxShadow: `inset 2px 0 0 0 ${accent}` } : null),
        },
        sx,
      ]}
    >
      <BentoHeader accent={accent} title={title} note={note} right={right} summary={collapsible} />
      <Box sx={bodySx}>{children}</Box>
    </Paper>
  );
}

/** The bento header — accent tick, title, muted note, `right` slot. */
function BentoHeader({
  accent,
  title,
  note,
  right,
  sx,
  summary = false,
}: {
  accent?: string;
  title: string;
  note?: string;
  right?: ReactNode;
  sx?: SxProps<Theme>;
  summary?: boolean;
}) {
  return (
    <Box
      component={summary ? 'summary' : 'div'}
      sx={[
        {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.25,
          px: 1.5,
          py: 1.25,
          backgroundColor: 'ui.bgElev',
          borderBottom: (t: Theme) => `1px solid ${t.palette.ui.border}`,
        },
        sx,
      ]}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.125, minWidth: 0 }}>
          <Box
            aria-hidden
            sx={{
              width: 13,
              height: 2,
              flexShrink: 0,
              backgroundColor: accent ?? 'text.disabled',
            }}
          />
          <Typography
            component="h2"
            sx={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: '0.8125rem',
              lineHeight: 1.2,
              color: 'text.primary',
              whiteSpace: 'normal',
            }}
          >
            {title}
          </Typography>
          {note && (
            <Typography
              sx={{
                fontFamily: FONT_MONO,
                fontSize: '0.625rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'text.disabled',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: { xs: 'none', md: 'block' },
              }}
            >
              {note}
            </Typography>
          )}
        </Box>
      {right && (
        <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>{right}</Box>
      )}
    </Box>
  );
}

/** Hero number + unit, as rendered on the right of a bento header. */
export function BentoHero({ value, unit, color }: { value: ReactNode; unit?: string; color?: string }) {
  return (
    <Box sx={{ textAlign: 'right', lineHeight: 1 }}>
      <Typography
        component="div"
        sx={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 800,
          fontSize: '1.05rem',
          lineHeight: 1,
          letterSpacing: '-0.01em',
          fontVariantNumeric: 'tabular-nums',
          color: color ?? 'text.primary',
        }}
      >
        <ValueFeedback value={value} />
      </Typography>
      {unit && (
        <Typography
          component="div"
          sx={{
            fontFamily: FONT_MONO,
            fontSize: '0.5625rem',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'text.disabled',
            mt: 0.25,
          }}
        >
          {unit}
        </Typography>
      )}
    </Box>
  );
}

export default BentoPanel;
