import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { CategoryBadge } from './ui/Badge';
import { tokens } from '../theme';

function ConfidenceBadge({ level }: { level: string }) {
  const color = level === 'high' ? 'success' : level === 'medium' ? 'warning' : 'error';
  
  return (
    <Chip 
      label={level.toUpperCase()} 
      size="small" 
      color={color}
      variant="outlined"
      sx={{
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: '0.7rem',
        height: 20,
      }}

    />
  );
}

export function DismantlingPanel() {
  const { dismantlingData, activeBlueprint } = useCraft();
  const { t } = useI18n();
  const dismantling = dismantlingData?.dismantling ?? null;

  if (!dismantlingData || !dismantling?.blueprint || !dismantling.globalParams) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t('No dismantling data available for this dataset.', 'Aucune donnee de demontage disponible pour ce dataset.')}
        </Typography>
      </Box>
    );
  }

  const { fabricator, meta } = dismantlingData;
  const dismantleBlueprint = dismantling.blueprint;
  const globalParams = dismantling.globalParams;
  const perItemYieldModel = dismantling.perItemYieldModel ?? null;
  const observedFields = perItemYieldModel?.observedRuntimeFields ?? [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, p: 1 }}>
      <Typography variant="h5" sx={{ mb: 1, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {t('Dismantling', 'Demontage')}
      </Typography>

      {activeBlueprint ? (
        <Paper variant="outlined" sx={{ p: 2, backgroundColor: tokens.surface2, borderColor: tokens.borderStrong }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <CategoryBadge category={activeBlueprint.category} />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                {activeBlueprint.name}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase' }}>
                {activeBlueprint.manufacturer}
              </Typography>
            </Box>
          </Stack>
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderStyle: 'dashed', backgroundColor: 'transparent' }}>
          <Typography variant="h4" sx={{ color: 'text.disabled', mb: 1 }}>◇</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t(
              'Select an item from your inventory to inspect the dismantling process metadata.',
              'Selectionnez un item de votre inventaire pour consulter les metadonnees de demontage.',
            )}
          </Typography>
        </Paper>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 1.5 }}>
        {[
          { label: t('Efficiency', 'Efficacite'), value: `${Math.round(dismantleBlueprint.efficiency * 100)}%` },
          { label: t('Time', 'Temps'), value: `${dismantleBlueprint.dismantleTimeSecs}s` },
          { label: t('Output Quality', 'Qualite de sortie'), value: globalParams.defaultCompositionQuality },
          { label: t('Fabricator SCU', 'SCU fabricateur'), value: fabricator?.inventoryOccupancyScu ?? '—' },
        ].map((stat) => (
          <Paper key={stat.label} variant="outlined" sx={{ p: 1.5, textAlign: 'center', backgroundColor: tokens.surface1 }}>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', textTransform: 'uppercase', mb: 0.5, fontSize: '0.7rem' }}>
              {stat.label}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, color: tokens.blueLight }}>
              {stat.value}
            </Typography>
          </Paper>
        ))}
      </Box>

      {fabricator?.queues?.length ? (
        <Box>
          <Typography variant="overline" sx={{ color: tokens.violet, fontWeight: 700 }}>
            {t('Available Queues', 'Files disponibles')}
          </Typography>
          <Stack spacing={0.5} sx={{ mt: 1 }}>
            {fabricator.queues.map((queue) => (
              <Box key={queue.debugName} sx={{ display: 'flex', justifyContent: 'space-between', p: 1, borderBottom: `1px solid ${tokens.border}` }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{queue.debugName}</Typography>
                <Typography variant="caption" sx={{ fontFamily: "'Share Tech Mono', monospace" }}>
                  {queue.maxJobsInProgress}/{queue.maxJobsWaiting}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      ) : null}

      <Box>
        <Typography variant="overline" sx={{ color: tokens.violet, fontWeight: 700 }}>
          {t('Per-item Yields', 'Rendements par item')}
        </Typography>
        <Paper variant="outlined" sx={{ p: 2, mt: 1, backgroundColor: tokens.surface1 }}>
          {perItemYieldModel?.resolved ? (
            <Typography variant="body2">
              {t(
                'This dataset includes a resolved per-item dismantle yield table.',
                'Ce dataset inclut une table resolue des rendements par item.',
              )}
            </Typography>
          ) : (
            <Stack spacing={1.5}>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                {perItemYieldModel?.reason ?? t(
                  'The current dataset does not expose an authoritative per-item dismantle yield table.',
                  'Le dataset actuel n expose pas de table fiable des rendements par item.',
                )}
              </Typography>
              {observedFields.length > 0 && (
                <Box>
                  <Typography variant="caption" sx={{ textTransform: 'uppercase', color: tokens.textDim, display: 'block', mb: 0.5 }}>
                    {t('Observed runtime result fields:', 'Champs observes dans les resultats runtime :')}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {observedFields.map((field) => (
                      <Chip key={field} label={field} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                    ))}
                  </Box>
                </Box>
              )}
            </Stack>
          )}
        </Paper>
      </Box>

      <Box>
        <Typography variant="overline" sx={{ color: tokens.violet, fontWeight: 700 }}>
          {t('Data Confidence', 'Fiabilite des donnees')}
        </Typography>
        <Paper variant="outlined" sx={{ p: 2, mt: 1, backgroundColor: tokens.surface1 }}>
          <Stack spacing={1.5}>
            {[
              { label: t('Global Process', 'Processus global'), level: meta?.confidence?.globalProcess },
              { label: t('UI Result Shape', 'Structure UI'), level: meta?.confidence?.uiResultShape },
              { label: t('Per-Item Yields', 'Rendement par item'), level: meta?.confidence?.perItemYieldTable },
            ].map((conf) => (
              <Box key={conf.label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2">{conf.label}</Typography>
                <ConfidenceBadge level={conf.level ?? 'unknown'} />
              </Box>
            ))}
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
