import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { useI18n } from '../../../i18n/I18nContext';
import { summarizeAssignedQualities } from '../../../utils/crafting';
import type { AggregatedResource, Resource } from '../../../types';
import { ResourceIcon } from '../../ui/ResourceIcon';
import { FONT_HEADING, FONT_MONO, TEXT_LABEL} from '../../../theme';

function normalizeResourceKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function resolveResource(resourceName: string, resources: Resource[]) {
  const normalized = normalizeResourceKey(resourceName);
  return (
    resources.find((resource) => resource.id === normalized) ??
    resources.find((resource) => normalizeResourceKey(resource.name) === normalized) ??
    null
  );
}

function formatScu(totalScu: number) {
  if (totalScu >= 10) {
    return totalScu.toFixed(0);
  }

  if (totalScu >= 1) {
    return totalScu.toFixed(1);
  }

  return totalScu.toFixed(2);
}

export function ResourceSummary({
  entries,
  resources,
}: {
  entries: AggregatedResource[];
  resources: Resource[];
}) {
  const { lang, t } = useI18n();
  const theme = useTheme();

  if (entries.length === 0) {
    return null;
  }

  return (
    <Box component="section">
      <Typography
        variant="body2"
        sx={{ fontWeight: 700, fontFamily: FONT_HEADING, mb: 0.75, fontSize: '.85rem' }}
      >
        {t('Required Resources', 'Ressources necessaires')}
      </Typography>

      <Stack spacing={1} aria-label={t('Required resources', 'Ressources necessaires')}>
        {entries.map((entry) => {
          const resource = resolveResource(entry.resourceName, resources);

          return (
            <Box
              key={entry.resourceName}
              sx={{
                display: 'grid',
                gridTemplateColumns: '44px minmax(0, 1fr) auto',
                gap: 1,
                alignItems: 'center',
                p: 1,
                borderRadius: 1.5,
                border: `1px solid ${theme.palette.ui.border}`,
                backgroundColor: alpha(theme.palette.ui.surface2, 0.88),
              }}
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 1.25,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `1px solid ${theme.palette.ui.border}`,
                  backgroundColor: alpha(theme.palette.common.white, 0.03),
                  flexShrink: 0,
                }}
              >
                {resource?.visual?.imageUrl ? (
                  <Box
                    component="img"
                    src={resource.visual.imageUrl}
                    alt={entry.resourceName}
                    loading="lazy"
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <ResourceIcon name={entry.resourceName} size={18} />
                )}
              </Box>

              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontSize: '0.82rem', fontWeight: 700 }} noWrap>
                  {entry.resourceName}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ display: 'block', color: 'text.secondary', fontSize: TEXT_LABEL }}
                >
                  {summarizeAssignedQualities(
                    entry.assignedQualityValues,
                    entry.unassignedSlotCount,
                    lang,
                  )}
                </Typography>
              </Box>

              <Typography
                variant="caption"
                sx={{
                  fontFamily: FONT_MONO,
                  fontSize: TEXT_LABEL,
                  ml: 0.5,
                  flexShrink: 0,
                  color: 'text.primary',
                }}
              >
                {formatScu(entry.totalScu)} SCU
              </Typography>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
