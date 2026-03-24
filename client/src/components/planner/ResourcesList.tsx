import { useMemo } from 'react';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import { useCraft } from '../../store/CraftContext';
import { useI18n } from '../../i18n/I18nContext';
import { StarCitizenLicensedIcon } from '../ui/StarCitizenLicensedIcon';
import type { AggregatedResource } from '../../types';
import { ResourceRow } from './ResourceRow';

export function ResourcesList({ aggregated }: { aggregated: AggregatedResource[] }) {
  const { plannerResourceRequirements, resourceProgress } = useCraft();
  const { t } = useI18n();

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
    <Box sx={{ flex: { xs: '0 0 auto', md: 1 }, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: { xs: 'visible', md: 'hidden' } }}>
      {/* Column header + global progress */}
      <Box sx={{ px: 1.25, py: 1, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
            <StarCitizenLicensedIcon name="asteroid" size={14} dimmed />
            <Typography variant="overline" sx={{ display: 'block' }}>
              {t('Resources', 'Ressources')}
            </Typography>
          </Box>
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
      <Box sx={{ flex: { xs: '0 0 auto', md: 1 }, overflowY: { xs: 'visible', md: 'auto' }, p: 1.25, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {aggregated.length === 0 && (
          <Typography variant="body2" sx={{ color: 'text.disabled', fontSize: '0.78rem', py: 2.5, textAlign: 'center' }}>
            {t('Add goals or materials to see required resources.', 'Ajoutez des objectifs ou des materiaux pour voir les ressources requises.')}
          </Typography>
        )}
        {aggregated.map((resource) => (
          <ResourceRow
            key={resource.resourceName}
            resource={resource}
            progress={resourceProgress[resource.resourceName]}
            manualRequired={plannerResourceRequirements[resource.resourceName] ?? 0}
          />
        ))}
      </Box>
    </Box>
  );
}
