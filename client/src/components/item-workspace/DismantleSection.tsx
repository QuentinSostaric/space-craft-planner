import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useI18n } from '../../i18n/I18nContext';
import { tokens } from '../../theme';
import type { DismantlingData } from '../../types';

const CONFIDENCE_COLORS: Record<string, string> = {
  high: tokens.success,
  medium: tokens.warning,
  low: tokens.danger,
};

interface DismantleSectionProps {
  dismantlingData: DismantlingData;
  sectionRef: React.RefObject<HTMLDivElement | null>;
}

export function DismantleSection({ dismantlingData, sectionRef }: DismantleSectionProps) {
  const { t } = useI18n();
  const dismantling = dismantlingData.dismantling;

  if (!dismantling?.blueprint || !dismantling.globalParams) {
    return (
      <Box ref={sectionRef} component="section" sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
        <Typography variant="overline" sx={{ display: 'block', mb: 1 }}>{t('Dismantling', 'Démontage')}</Typography>
        <Typography>{t('No dismantling data available for this dataset.', 'Aucune donnee de demontage disponible pour ce dataset.')}</Typography>
      </Box>
    );
  }

  const { fabricator, meta } = dismantlingData;
  const dismantleBlueprint = dismantling.blueprint;
  const globalParams = dismantling.globalParams;
  const perItemYieldModel = dismantling.perItemYieldModel ?? null;
  const observedFields = perItemYieldModel?.observedRuntimeFields ?? [];

  const stats = [
    { label: t('Efficiency', 'Efficacite'), value: `${Math.round(dismantleBlueprint.efficiency * 100)}%` },
    { label: t('Time', 'Temps'), value: `${dismantleBlueprint.dismantleTimeSecs}s` },
    { label: t('Default quality', 'Qualite par defaut'), value: String(globalParams.defaultCompositionQuality) },
    { label: t('Quality multiplier', 'Multiplicateur qualite'), value: `×${globalParams.refiningQualityUnitMultiplier}` },
  ];

  return (
    <Box ref={sectionRef} component="section" aria-label={t('Dismantling', 'Démontage')} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="overline" sx={{ display: 'block' }}>
        {t('Dismantling', 'Démontage')}
      </Typography>

      {/* Stats grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
        {stats.map((s) => (
          <Paper key={s.label} variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '.08em', display: 'block' }}>
              {s.label}
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: "'Share Tech Mono', monospace", fontWeight: 700, fontSize: '0.875rem' }}>
              {s.value}
            </Typography>
          </Paper>
        ))}
      </Box>

      {fabricator && (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: "'Khand', sans-serif", mb: 0.5, fontSize: '0.85rem' }}>
            {t('Fabricator', 'Fabricateur')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.75rem', mb: 0.5 }}>
            {fabricator.displayName} — {fabricator.inventoryOccupancyScu} SCU
          </Typography>
          {fabricator.queues.length > 0 && (
            <List dense disablePadding>
              {fabricator.queues.map((q) => (
                <ListItem key={q.debugName} disablePadding sx={{ py: 0.25 }}>
                  <ListItemText
                    primary={`${q.debugName}: ${q.maxJobsInProgress} ${t('active', 'actifs')}, ${q.maxJobsWaiting} ${t('queued', 'en attente')}`}
                    slotProps={{ primary: { variant: 'caption', sx: { fontSize: '0.75rem' } } }}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      )}

      {perItemYieldModel && (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: "'Khand', sans-serif", mb: 0.5, fontSize: '0.85rem' }}>
            {t('Per-item yield model', 'Modele de rendement par item')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
            {perItemYieldModel.resolved
              ? t('Resolved', 'Resolu')
              : t('Unresolved — yields cannot be predicted per item yet.', 'Non resolu — les rendements par item ne sont pas encore previsibles.')}
          </Typography>
          {perItemYieldModel.reason && (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>{perItemYieldModel.reason}</Typography>
          )}
          {observedFields.length > 0 && (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem', display: 'block' }}>
              {t('Observed fields', 'Champs observes')}: {observedFields.join(', ')}
            </Typography>
          )}
        </Box>
      )}

      {meta?.confidence && (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: "'Khand', sans-serif", mb: 0.5, fontSize: '0.85rem' }}>
            {t('Extraction confidence', 'Confiance extraction')}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 0.5, alignItems: 'center' }}>
            {([
              [t('Global process', 'Processus global'), meta.confidence.globalProcess],
              [t('UI shape', 'Forme UI'), meta.confidence.uiResultShape],
              [t('Per-item table', 'Table par item'), meta.confidence.perItemYieldTable],
            ] as [string, string][]).map(([label, level]) => (
              <Box key={label} sx={{ display: 'contents' }}>
                <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>{label}</Typography>
                <Chip
                  label={level}
                  size="small"
                  sx={{
                    fontSize: '0.75rem', height: 20,
                    color: CONFIDENCE_COLORS[level] ?? 'text.secondary',
                    borderColor: CONFIDENCE_COLORS[level] ?? tokens.border,
                  }}
                  variant="outlined"
                />
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
