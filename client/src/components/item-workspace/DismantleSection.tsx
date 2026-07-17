import { Box, Paper, Typography, alpha, useTheme } from '../../ui/system';
import { Card, CardContent } from '../../ui/widgets';
import { useI18n } from '../../i18n/I18nContext';
import type { AggregatedResource, Blueprint, Resource } from '../../types';
import { formatResourceQuantity, summarizeAssignedQualities } from '../../utils/crafting';
import { DatasetTooOldNotice } from '../ui/DatasetTooOldNotice';
import { ResourceIcon } from '../ui/ResourceIcon';
import { FONT_HEADING, FONT_MONO } from '../../theme';

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

function DismantleFact({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        px: 1.25,
        py: 1,
        minWidth: 0,
        backgroundColor: (theme) => alpha(theme.palette.background.default, 0.2),
      }}
    >
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          color: 'text.secondary',
          mb: 0.4,
        }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {value}
      </Typography>
    </Paper>
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
      id="blueprint-dismantling"
      component="section"
      aria-label={t('Dismantling', 'Demontage')}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.35, scrollMarginTop: 18 }}
    >
      <Typography
        variant="overline"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          color: 'text.secondary',
          '&::before': {
            content: '""',
            display: 'block',
            width: 14,
            height: 2,
            flexShrink: 0,
            backgroundColor: (theme) => theme.palette.domain.red,
          },
        }}
      >
        {t('Dismantling', 'Demontage')}
      </Typography>

      {dismantleTimeSecs <= 0 ? (
        <DatasetTooOldNotice />
      ) : resources.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.disabled' }}>
          {t('No materials', 'Aucun materiau')}
        </Typography>
      ) : (
        <Box
          aria-label={blueprint.name}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' },
            gap: 1.25,
          }}
        >
          {resources.map((resource) => {
            const recovered = Math.round(resource.totalScu * efficiency * 1000) / 1000;
            const resourceVisual = resolveResource(resource.resourceName, allResources);

            return (
              <Card
                key={resource.resourceName}
                variant="outlined"
                sx={{
                  overflow: 'hidden',
                  background: `linear-gradient(180deg, ${alpha(resourceVisual?.color ?? theme.palette.primary.main, 0.055)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 42%)`,
                  borderColor: alpha(resourceVisual?.color ?? theme.palette.primary.main, 0.22),
                }}
              >
                <Box
                  sx={{
                    px: 1.35,
                    py: 1.1,
                    borderBottom: 1,
                    borderColor: 'divider',
                    background: `linear-gradient(180deg, ${alpha(
                      resourceVisual?.color ?? theme.palette.primary.main,
                      0.18,
                    )} 0%, ${alpha(theme.palette.background.paper, 0.92)} 100%)`,
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.25,
                      flexWrap: { xs: 'wrap', md: 'nowrap' },
                    }}
                  >
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: 1.5,
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: `1px solid ${theme.palette.ui.border}`,
                        backgroundColor: alpha(theme.palette.common.white, 0.04),
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
                        <ResourceIcon name={resource.resourceName} size={24} />
                      )}
                    </Box>

                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography
                        sx={{
                          fontFamily: FONT_HEADING,
                          fontWeight: 700,
                          fontSize: '1.25rem',
                          lineHeight: 1,
                        }}
                      >
                        {resource.resourceName}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{ color: 'text.secondary', mt: 0.5 }}
                      >
                        {summarizeAssignedQualities(
                          resource.assignedQualityValues,
                          resource.unassignedSlotCount,
                          lang,
                        )}
                      </Typography>
                    </Box>

                    <Paper
                      variant="outlined"
                      sx={{
                        px: 1.25,
                        py: 1,
                        minWidth: { xs: '100%', sm: 146 },
                        borderColor: alpha(resourceVisual?.color ?? theme.palette.primary.main, 0.28),
                        backgroundColor: alpha(theme.palette.background.default, 0.34),
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          color: 'text.secondary',
                          mb: 0.4,
                        }}
                      >
                        {t('Recovered', 'Recupere')}
                      </Typography>
                      <Typography
                        variant="body1"
                        sx={{ fontFamily: FONT_MONO, fontWeight: 700 }}
                      >
                        {formatResourceQuantity(recovered, resource.quantityUnit, lang)}
                      </Typography>
                    </Paper>
                  </Box>
                </Box>

                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                      gap: 1,
                    }}
                  >
                    <DismantleFact
                      label={t('Craft cost', 'Cout craft')}
                      value={formatResourceQuantity(resource.totalScu, resource.quantityUnit, lang)}
                    />
                    <DismantleFact
                      label={t('Recovery', 'Recuperation')}
                      value={`${Math.round(efficiency * 100)}%`}
                    />
                    <DismantleFact
                      label={t('Quality', 'Qualite')}
                      value={t('Same as selected', 'Identique a la selection')}
                    />
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
