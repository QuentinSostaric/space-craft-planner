import { useMemo } from 'react';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import { useCraft } from '../../store/CraftContext';
import { useI18n } from '../../i18n/I18nContext';
import { aggregateGoalResources } from '../../utils/crafting';
import { ResourceRow } from './ResourceRow';

export function ResourcesList() {
  const { goals, blueprints, resourceProgress } = useCraft();
  const { t } = useI18n();

  const aggregated = useMemo(
    () => aggregateGoalResources(goals, blueprints),
    [goals, blueprints],
  );

  const { totalRequired, totalCollected, globalPct } = useMemo(() => {
    const totalRequired = aggregated.reduce((sum, r) => sum + r.totalScu, 0);
    const totalCollected = aggregated.reduce((sum, r) => {
      const prog = resourceProgress[r.resourceName];
      return sum + Math.min(prog?.collected ?? 0, r.totalScu);
    }, 0);
    const globalPct = totalRequired > 0 ? (totalCollected / totalRequired) * 100 : 0;
    return { totalRequired, totalCollected, globalPct };
  }, [aggregated, resourceProgress]);

  return (
    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: { xs: 'visible', md: 'hidden' } }}>
      {/* Column header + global progress */}
      <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
          <Typography variant="overline" sx={{ display: 'block' }}>
            {t('Resources', 'Ressources')}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: "'Share Tech Mono', monospace" }}>
            {totalCollected.toFixed(2)} / {totalRequired.toFixed(2)} SCU
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={globalPct}
          sx={{ height: 4, borderRadius: 2 }}
        />
      </Box>

      {/* Resources list */}
      <Box sx={{ flex: { xs: '0 0 auto', md: 1 }, overflowY: { xs: 'visible', md: 'auto' }, p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {aggregated.length === 0 && (
          <Typography variant="body2" sx={{ color: 'text.disabled', fontSize: '0.78rem', py: 4, textAlign: 'center' }}>
            {t('Add goals to see required resources.', 'Ajoutez des objectifs pour voir les ressources requises.')}
          </Typography>
        )}
        {aggregated.map((resource) => (
          <ResourceRow key={resource.resourceName} resource={resource} />
        ))}
      </Box>
    </Box>
  );
}
