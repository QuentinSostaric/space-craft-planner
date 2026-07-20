import { useId, type ReactNode } from 'react';
import { Box, Typography, type SxValue } from '../../../ui/system';
import { FONT_DISPLAY, FONT_MONO, TEXT_LABEL_SM } from '../../../theme';

export type PageHeaderVariant = 'default' | 'compact' | 'reading';

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  stats?: ReactNode;
  variant?: PageHeaderVariant;
  headingId?: string;
  sx?: SxValue;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  meta,
  actions,
  stats,
  variant = 'default',
  headingId,
  sx,
}: PageHeaderProps) {
  const generatedId = useId();
  const titleId = headingId ?? `page-title-${generatedId}`;
  const compact = variant === 'compact';
  const reading = variant === 'reading';

  return (
    <Box component="header" aria-labelledby={titleId} sx={[{ display: 'flex', flexDirection: 'column', gap: compact ? 1 : 1.5 }, sx]}>
      <Box
        sx={{
          display: 'flex',
          alignItems: reading ? 'flex-start' : 'center',
          justifyContent: 'space-between',
          flexDirection: { xs: 'column', sm: reading ? 'column' : 'row' },
          gap: 1.5,
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          {eyebrow != null && (
            <Typography
              variant="overline"
              sx={{
                display: 'block',
                mb: 0.5,
                color: 'primary.main',
                fontFamily: FONT_MONO,
                fontSize: TEXT_LABEL_SM,
                letterSpacing: '0.1em',
              }}
            >
              {eyebrow}
            </Typography>
          )}
          <Typography
            id={titleId}
            component="h1"
            sx={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 750,
              fontSize: compact
                ? { xs: '1.65rem', md: '1.9rem' }
                : reading
                  ? { xs: '1.8rem', md: '2.1rem' }
                  : { xs: '1.9rem', md: '2.2rem' },
              lineHeight: 1.08,
              letterSpacing: '-0.018em',
              color: 'text.primary',
            }}
          >
            {title}
          </Typography>
          {description != null && (
            <Typography
              component="div"
              variant="body2"
              sx={{
                color: 'text.secondary',
                mt: 0.75,
                maxWidth: reading ? '68ch' : '76ch',
                lineHeight: reading ? 1.7 : 1.55,
              }}
            >
              {description}
            </Typography>
          )}
          {meta != null && (
            <Typography component="div" variant="caption" sx={{ color: 'text.disabled', mt: 0.75 }}>
              {meta}
            </Typography>
          )}
        </Box>
        {actions != null && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', flexShrink: 0 }}>
            {actions}
          </Box>
        )}
      </Box>
      {stats != null && (
        <Box
          aria-label="Page summary"
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 1.5,
          }}
        >
          {stats}
        </Box>
      )}
    </Box>
  );
}

export default PageHeader;
