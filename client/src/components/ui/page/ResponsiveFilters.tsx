import { useState, type ReactNode } from 'react';
import { Box, type SxValue } from '../../../ui/system';
import { AppButton } from '../controls/AppButton';
import { AppDialog } from '../overlays/AppDialog';

export interface ResponsiveFiltersProps {
  children: ReactNode;
  title: string;
  triggerLabel: string;
  closeLabel: string;
  dismissLabel?: string;
  summary?: ReactNode;
  actions?: ReactNode;
  sx?: SxValue;
}

export function ResponsiveFilters({
  children,
  title,
  triggerLabel,
  closeLabel,
  dismissLabel = 'Close',
  summary,
  actions,
  sx,
}: ResponsiveFiltersProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Box sx={[{ display: { xs: 'none', md: 'block' } }, sx]}>
        {children}
      </Box>
      <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <AppButton variant="secondary" size="sm" onClick={() => setOpen(true)} ariaLabel={triggerLabel}>
          {triggerLabel}
        </AppButton>
        {summary != null && <Box sx={{ minWidth: 0, flex: 1 }}>{summary}</Box>}
      </Box>
      <AppDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        closeLabel={dismissLabel}
        width="min(34rem, calc(100vw - 1.5rem))"
        footer={
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            {actions}
            <AppButton variant="primary" onClick={() => setOpen(false)}>
              {closeLabel}
            </AppButton>
          </Box>
        }
        partSx={{ content: { overflow: 'visible' } }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>{children}</Box>
      </AppDialog>
    </>
  );
}

export default ResponsiveFilters;
