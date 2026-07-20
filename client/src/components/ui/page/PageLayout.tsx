import type { ReactNode } from 'react';
import { Box, type SxValue } from '../../../ui/system';

export type PageLayoutWidth = 'wide' | 'content' | 'reading' | 'full';

export interface PageLayoutProps {
  children: ReactNode;
  width?: PageLayoutWidth;
  component?: React.ElementType;
  sx?: SxValue;
}

const MAX_WIDTH: Record<PageLayoutWidth, string | number> = {
  wide: 1600,
  content: 1200,
  reading: 760,
  full: 'none',
};

export function PageLayout({
  children,
  width = 'wide',
  component = 'div',
  sx,
}: PageLayoutProps) {
  return (
    <Box
      component={component}
      sx={[
        {
          width: '100%',
          maxWidth: MAX_WIDTH[width],
          mx: 'auto',
          px: { xs: 2, sm: 3, lg: 4 },
          py: { xs: 2.5, sm: 3, lg: 4 },
          display: 'flex',
          flexDirection: 'column',
          gap: { xs: 2, md: 2.5 },
          flex: '0 0 auto',
        },
        sx,
      ]}
    >
      {children}
    </Box>
  );
}

export default PageLayout;
