import { useCallback } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import { useI18n } from '../../i18n/I18nContext';

export type SectionId = 'stats' | 'craft' | 'sources' | 'acquisition' | 'dismantle';

interface SectionNavProps {
  sections: SectionId[];
  refs: Record<SectionId, React.RefObject<HTMLDivElement | null>>;
}

const SECTION_LABELS: Record<SectionId, { en: string; fr: string }> = {
  stats: { en: 'Stats', fr: 'Stats' },
  craft: { en: 'Craft', fr: 'Craft' },
  sources: { en: 'Sources', fr: 'Sources' },
  acquisition: { en: 'Acquisition', fr: 'Acquisition' },
  dismantle: { en: 'Dismantle', fr: 'Démontage' },
};

export function SectionNav({ sections, refs }: SectionNavProps) {
  const { t } = useI18n();

  const scrollTo = useCallback(
    (id: SectionId) => {
      refs[id]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [refs],
  );

  return (
    <Box
      component="nav"
      aria-label={t('Section navigation', 'Navigation des sections')}
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 5,
        display: 'flex',
        gap: 0.5,
        py: 1,
        px: 1,
        backgroundColor: 'rgba(17,24,39,0.85)',
        backdropFilter: 'blur(8px)',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      {sections.map((id) => (
        <Chip
          key={id}
          label={t(SECTION_LABELS[id].en, SECTION_LABELS[id].fr)}
          variant="outlined"
          size="small"
          onClick={() => scrollTo(id)}
          sx={{ fontSize: '0.65rem', height: 24, cursor: 'pointer' }}
        />
      ))}
    </Box>
  );
}
