import { useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { GoalsList } from './planner/GoalsList';
import { ResourcesList } from './planner/ResourcesList';
import { StarCitizenLicensedIcon } from './ui/StarCitizenLicensedIcon';
import { aggregatePlannedResources } from '../utils/crafting';

export function PlannerPage() {
  const {
    goals,
    blueprints,
    plannerResourceRequirements,
    resourceProgress,
    resetResourceProgress,
  } = useCraft();
  const { t } = useI18n();

  const aggregated = useMemo(
    () => aggregatePlannedResources(goals, blueprints, plannerResourceRequirements),
    [goals, blueprints, plannerResourceRequirements],
  );
  const hasPlannerContent = goals.length > 0 || aggregated.length > 0;

  // NOTE: This computation duplicates the same logic in ResourcesList.tsx (totalRequired,
  // totalCollected, globalPct). Both derive from the same aggregated + resourceProgress data.
  // Lifting the computation to PlannerPage and passing values down as props would eliminate the
  // duplication, but that would require restructuring both components. Left as-is for now.
  const { totalRequired, totalCollected, globalPct } = useMemo(() => {
    const totalRequired = aggregated.reduce((sum, r) => sum + r.totalScu, 0);
    const totalCollected = aggregated.reduce((sum, r) => {
      const prog = resourceProgress[r.resourceName];
      return sum + Math.min(prog?.collected ?? 0, r.totalScu);
    }, 0);
    const globalPct = totalRequired > 0 ? Math.round((totalCollected / totalRequired) * 100) : 0;
    return { totalRequired, totalCollected, globalPct };
  }, [aggregated, resourceProgress]);

  const handleCopyText = useCallback(() => {
    const lines = [
      'ITEM FABRICATOR — Plan',
      '',
      ...goals.map((g) => `${g.quantity}× ${g.blueprintName} (${g.qualityScore}/100)`),
      '',
      ...aggregated.map((r) => `${r.resourceName} — ${r.totalScu.toFixed(2)} SCU`),
    ];
    navigator.clipboard.writeText(lines.join('\n')).catch((err) => console.warn('Clipboard write failed:', err));
  }, [goals, aggregated]);

  const handleDownloadJSON = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      goals: goals.map((g) => ({ blueprintId: g.blueprintId, blueprintName: g.blueprintName, quantity: g.quantity, qualityScore: g.qualityScore })),
      materials: aggregated.map((r) => ({
        resourceName: r.resourceName,
        totalScu: r.totalScu,
        manualRequired: plannerResourceRequirements[r.resourceName] ?? 0,
        collected: resourceProgress[r.resourceName]?.collected ?? 0,
        method: resourceProgress[r.resourceName]?.method ?? null,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    try {
      a.href = url;
      a.download = `item-fabricator-plan-${Date.now()}.json`;
      a.click();
    } finally {
      URL.revokeObjectURL(url);
    }
  }, [goals, aggregated, plannerResourceRequirements, resourceProgress]);

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: { xs: 'visible', md: 'hidden' } }}>
      {/* Page header */}
      <Box sx={{ px: { xs: 1.25, md: 3 }, py: { xs: 1.1, md: 1.5 }, borderBottom: 1, borderColor: 'divider', display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', gap: 1, flexShrink: 0, backgroundColor: 'background.paper' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="h6">{t('Planner', 'Planificateur')}</Typography>
          {goals.length > 0 && (
            <Chip label={`${goals.length} ${t('goals', 'objectifs')}`} size="small" variant="outlined" />
          )}
          {totalRequired > 0 && (
            <Chip label={`${totalRequired.toFixed(2)} SCU ${t('required', 'requis')}`} size="small" variant="outlined" />
          )}
          {totalRequired > 0 && (
            <Chip label={`${globalPct}% ${t('collected', 'collecté')}`} size="small" color="primary" variant="outlined" />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, width: { xs: '100%', sm: 'auto' } }}>
          <Button variant="outlined" size="small" onClick={handleCopyText} disabled={!hasPlannerContent} sx={{ flex: { xs: 1, sm: '0 0 auto' } }}>
            {t('Copy text', 'Copier texte')}
          </Button>
          <Button variant="outlined" size="small" onClick={handleDownloadJSON} disabled={!hasPlannerContent} sx={{ flex: { xs: 1, sm: '0 0 auto' } }}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
              <StarCitizenLicensedIcon name="download" size={14} dimmed />
              <span>JSON</span>
            </Box>
          </Button>
        </Box>
      </Box>

      {/* Two-column body */}
      <Box sx={{ flex: { xs: '0 0 auto', md: 1 }, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, minHeight: 0, overflow: { xs: 'visible', md: 'hidden' } }}>
        <GoalsList />
        <ResourcesList aggregated={aggregated} />
      </Box>

      {/* Footer */}
      <Box sx={{ px: { xs: 1.25, md: 3 }, py: 1, borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: { xs: 'stretch', md: 'flex-end' }, flexShrink: 0, backgroundColor: 'background.paper' }}>
        <Button
          variant="outlined"
          color="error"
          size="small"
          onClick={resetResourceProgress}
          disabled={totalCollected === 0}
          sx={{ width: { xs: '100%', md: 'auto' } }}
        >
          {t('Reset progress', 'Réinitialiser la progression')}
        </Button>
      </Box>
    </Box>
  );
}
