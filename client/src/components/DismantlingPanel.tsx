import { Box, Paper, Typography, Stack, useTheme } from '../ui/system';
import { AppChip } from './ui/data-display/AppChip';
import { Panel } from './ui/Panel';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { CategoryBadge } from './ui/Badge';
import { DatasetTooOldNotice } from './ui/DatasetTooOldNotice';
import { FONT_MONO, TEXT_LABEL} from '../theme';

function ConfidenceBadge({ level }: { level: string }) {
  const color = level === 'high' ? 'success' : level === 'medium' ? 'warning' : 'error';
  
  return (
    <AppChip
      label={level.toUpperCase()} 
      size="sm"
      color={color}
      variant="outlined"
      sx={{
        fontFamily: FONT_MONO,
        fontSize: TEXT_LABEL,
        height: 20,
      }}

    />
  );
}

export function DismantlingPanel() {
  const { dismantlingData, activeBlueprint } = useCraft();
  const { t } = useI18n();
  const theme = useTheme();
  const dismantling = dismantlingData?.dismantling ?? null;

  if (!dismantlingData || !dismantling?.blueprint || !dismantling.globalParams) {
    return (
      <Box sx={{p: 4, textAlign: 'center' }}>
        <DatasetTooOldNotice />
      </Box>
    );
  }

  const { fabricator, meta } = dismantlingData;
  const dismantleBlueprint = dismantling.blueprint;
  const globalParams = dismantling.globalParams;
  const perItemYieldModel = dismantling.perItemYieldModel ?? null;
  const observedFields = perItemYieldModel?.observedRuntimeFields ?? [];

  return (
    <Panel component="section" title={t('Dismantling', 'Demontage')} titleComponent="h2" variant="raised">

      {activeBlueprint ? (
        <Paper sx={{
          p: 2, 
          backgroundColor: theme.palette.ui.surface2, 
          borderColor: theme.palette.ui.borderStrong 
        }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <CategoryBadge category={activeBlueprint.category} />
            <Box>
              <Typography variant="subtitle1" sx={{fontWeight: 700, lineHeight: 1.2 }}>
                {activeBlueprint.name}
              </Typography>
              <Typography variant="caption" sx={{color: 'text.secondary' }}>
                {activeBlueprint.manufacturer}
              </Typography>
            </Box>
          </Stack>
        </Paper>
      ) : (
        <Paper sx={{p: 4, textAlign: 'center', borderStyle: 'dashed', backgroundColor: 'transparent' }}>
          <Typography variant="h4" sx={{color: 'text.disabled', mb: 1 }}>◇</Typography>
          <Typography variant="body2" sx={{color: 'text.secondary' }}>
            {t(
              'Select an item from your inventory to inspect the dismantling process metadata.',
              'Selectionnez un item de votre inventaire pour consulter les metadonnees de demontage.',
            )}
          </Typography>
        </Paper>
      )}

      <Box sx={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 1.5 }}>
        {[
          { label: t('Efficiency', 'Efficacite'), value: `${Math.round(dismantleBlueprint.efficiency * 100)}%` },
          { label: t('Time', 'Temps'), value: `${dismantleBlueprint.dismantleTimeSecs}s` },
          { label: t('Output Quality', 'Qualite de sortie'), value: globalParams.defaultCompositionQuality },
          { label: t('Fabricator SCU', 'SCU fabricateur'), value: fabricator?.inventoryOccupancyScu ?? '—' },
        ].map((stat) => (
          <Paper key={stat.label} sx={{
            p: 1.5, 
            textAlign: 'center', 
            backgroundColor: theme.palette.ui.surface1 
          }}>
            <Typography variant="caption" sx={{display: 'block', color: 'text.secondary', mb: 0.5, fontSize: TEXT_LABEL }}>
              {stat.label}
            </Typography>
            <Typography variant="h6" sx={{fontWeight: 700, color: 'secondary.light' }}>
              {stat.value}
            </Typography>
          </Paper>
        ))}
      </Box>

      {fabricator?.queues?.length ? (
        <Box>
          <Typography variant="overline" sx={{color: 'primary.main', fontWeight: 700 }}>
            {t('Available Queues', 'Files disponibles')}
          </Typography>
          <Stack spacing={0.5} sx={{mt: 1 }}>
            {fabricator.queues.map((queue) => (
              <Box key={queue.debugName} sx={{
                display: 'flex', 
                justifyContent: 'space-between', 
                p: 1, 
                borderBottom: (theme) => `1px solid ${theme.palette.divider}` 
              }}>
                <Typography variant="body2" sx={{fontWeight: 600 }}>{queue.debugName}</Typography>
                <Typography variant="caption" sx={{fontFamily: FONT_MONO }}>
                  {queue.maxJobsInProgress}/{queue.maxJobsWaiting}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      ) : null}

      <Box>
        <Typography variant="overline" sx={{color: 'primary.main', fontWeight: 700 }}>
          {t('Per-item Yields', 'Rendements par item')}
        </Typography>
        <Paper sx={{p: 2, mt: 1, backgroundColor: theme.palette.ui.surface1 }}>
          {perItemYieldModel?.resolved ? (
            <Typography variant="body2">
              {t(
                'This dataset includes a resolved per-item dismantle yield table.',
                'Ce dataset inclut une table resolue des rendements par item.',
              )}
            </Typography>
          ) : (
            <Stack spacing={1.5}>
              <Typography variant="body2" sx={{color: 'text.secondary', fontStyle: 'italic' }}>
                {perItemYieldModel?.reason ?? t(
                  'The current dataset does not expose an authoritative per-item dismantle yield table.',
                  'Le dataset actuel n expose pas de table fiable des rendements par item.',
                )}
              </Typography>
              {observedFields.length > 0 && (
                <Box>
                  <Typography variant="caption" sx={{color: 'text.secondary', display: 'block', mb: 0.5 }}>
                    {t('Observed runtime result fields:', 'Champs observes dans les resultats runtime :')}
                  </Typography>
                  <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {observedFields.map((field) => (
                      <AppChip key={field} label={field} size="sm" outlined sx={{ fontSize: TEXT_LABEL }} />
                    ))}
                  </Box>
                </Box>
              )}
            </Stack>
          )}
        </Paper>
      </Box>

      <Box>
        <Typography variant="overline" sx={{color: 'primary.main', fontWeight: 700 }}>
          {t('Data Confidence', 'Fiabilite des donnees')}
        </Typography>
        <Paper sx={{p: 2, mt: 1, backgroundColor: theme.palette.ui.surface1 }}>
          <Stack spacing={1.5}>
            {[
              { label: t('Global Process', 'Processus global'), level: meta?.confidence?.globalProcess },
              { label: t('UI Result Shape', 'Structure UI'), level: meta?.confidence?.uiResultShape },
              { label: t('Per-Item Yields', 'Rendement par item'), level: meta?.confidence?.perItemYieldTable },
            ].map((conf) => (
              <Box key={conf.label} sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2">{conf.label}</Typography>
                <ConfidenceBadge level={conf.level ?? 'unknown'} />
              </Box>
            ))}
          </Stack>
        </Paper>
      </Box>
    </Panel>
  );
}
