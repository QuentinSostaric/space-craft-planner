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
  const compact = variant !== 'reading';
  const reading = variant === 'reading';

  return (
    <Box component="header" className="workspace-page-header" aria-labelledby={titleId} sx={[{ display: 'flex', flexDirection: 'column', gap: compact ? 1 : 1.25, pb: 1.5, borderBottom: '1px solid', borderColor: 'ui.borderStrong' }, sx]}>
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
                mb: 0.25,
                color: 'text.secondary',
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
                ? { xs: '1.25rem', md: '1.4rem' }
                : reading
                  ? { xs: '1.4rem', md: '1.75rem' }
                  : { xs: '1.4rem', md: '1.65rem' },
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
                mt: 0.5,
                maxWidth: reading ? '68ch' : '76ch',
                lineHeight: reading ? 1.7 : 1.45,
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
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(145px, 100%), 1fr))',
            gap: 1,
          }}
        >
          {stats}
        </Box>
      )}
    </Box>
  );
}

export default PageHeader;
