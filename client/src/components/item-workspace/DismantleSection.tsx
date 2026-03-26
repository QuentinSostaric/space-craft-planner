import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { useI18n } from '../../i18n/I18nContext';
import type { AggregatedResource, Blueprint, Resource } from '../../types';
import { formatResourceQuantity, summarizeAssignedQualities } from '../../utils/crafting';
import { DatasetTooOldNotice } from '../ui/DatasetTooOldNotice';
import { ResourceIcon } from '../ui/ResourceIcon';

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
    resources.find((resource) => resource.id === normalized)
    ?? resources.find((resource) => normalizeResourceKey(resource.name) === normalized)
    ?? null
  );
}

interface DismantleSectionProps {
  blueprint: Blueprint;
  allResources: Resource[];
  resources: AggregatedResource[];
  dismantleTimeSecs: number;
  efficiency: number;
}

export function DismantleSection({
  blueprint,
  allResources,
  resources,
  dismantleTimeSecs,
  efficiency,
}: DismantleSectionProps) {
  const { t, lang } = useI18n();
  const theme = useTheme();

  return (
    <Box
      component="section"
      aria-label={t('Dismantling', 'Demontage')}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}
    >
      <Typography variant="overline" sx={{ display: 'block' }}>
        {t('Dismantling', 'Demontage')}
      </Typography>

      {dismantleTimeSecs <= 0 ? (
        <DatasetTooOldNotice />
      ) : resources.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.disabled' }}>
          {t('No materials', 'Aucun materiau')}
        </Typography>
      ) : (
        <Box aria-label={blueprint.name} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {resources.map((resource) => {
            const recovered = Math.round(resource.totalScu * efficiency * 1000) / 1000;
            const resourceVisual = resolveResource(resource.resourceName, allResources);

            return (
              <Box
                key={resource.resourceName}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.25,
                  py: 1,
                  borderRadius: 1,
                  border: `1px solid ${theme.palette.ui.border}`,
                  background: `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.02)} 0%, ${theme.palette.ui.surface1} 100%)`,
                  flexWrap: { xs: 'wrap', sm: 'nowrap' },
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
                  {resourceVisual?.visual?.imageUrl ? (
                    <Box
                      component="img"
                      src={resourceVisual.visual.imageUrl}
                      alt={resource.resourceName}
                      loading="lazy"
                      sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <ResourceIcon name={resource.resourceName} size={18} />
                  )}
                </Box>

                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                    {resource.resourceName}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ display: 'block', color: 'text.secondary', fontSize: '0.7rem' }}
                  >
                    {summarizeAssignedQualities(
                      resource.assignedQualityValues,
                      resource.unassignedSlotCount,
                      lang,
                    )}
                  </Typography>
                </Box>

                <Box
                  sx={{
                    minWidth: { xs: 0, sm: 104 },
                    ml: { xs: 0, sm: 'auto' },
                    textAlign: { xs: 'left', sm: 'right' },
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      color: 'text.secondary',
                      fontSize: '0.65rem',
                      textTransform: 'uppercase',
                      letterSpacing: '.04em',
                    }}
                  >
                    {t('Recovered', 'Recupere')}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontFamily: "'Share Tech Mono', monospace", fontWeight: 700 }}
                  >
                    {formatResourceQuantity(recovered, resource.quantityUnit, lang)}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
        {Math.round(efficiency * 100)}% {t('recovery', 'recuperation')} | {t('same selected quality', 'meme qualite selectionnee')} | {dismantleTimeSecs}s {t('per job', 'par job')}
      </Typography>
    </Box>
  );
}
