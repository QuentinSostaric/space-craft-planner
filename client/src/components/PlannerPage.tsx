import { useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { GoalsList } from './planner/GoalsList';
import { ResourcesList } from './planner/ResourcesList';
import { aggregateGoalResources } from '../utils/crafting';

export function PlannerPage() {
  const {
    goals,
    blueprints,
    resourceProgress,
    resetResourceProgress,
  } = useCraft();
  const { lang, t } = useI18n();

  const aggregated = useMemo(() => aggregateGoalResources(goals, blueprints), [goals, blueprints]);

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
    navigator.clipboard.writeText(lines.join('\n')).catch(() => {});
  }, [goals, aggregated, lang]);

  const handleDownloadJSON = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      goals: goals.map((g) => ({ blueprintId: g.blueprintId, blueprintName: g.blueprintName, quantity: g.quantity, buildIndex: g.qualityScore })),
      materials: aggregated.map((r) => ({ resourceName: r.resourceName, totalScu: r.totalScu, collected: resourceProgress[r.resourceName]?.collected ?? 0, method: resourceProgress[r.resourceName]?.method ?? null })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `item-fabricator-plan-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  }, [goals, aggregated, resourceProgress]);

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
      {/* Page header */}
      <Box sx={{ px: { xs: 1.5, md: 3 }, py: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: 1, flexShrink: 0, backgroundColor: 'background.paper' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="h6">{t('Planner', 'Planificateur')}</Typography>
          {goals.length > 0 && (
            <Chip label={`${goals.length} ${t('goals', 'objectifs')}`} size="small" variant="outlined" />
          )}
          {totalRequired > 0 && (
            <Chip label={`${totalRequired.toFixed(1)} SCU ${t('required', 'requis')}`} size="small" variant="outlined" />
          )}
          {totalRequired > 0 && (
            <Chip label={`${globalPct}% ${t('collected', 'collecté')}`} size="small" color="primary" variant="outlined" />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
          <Button variant="outlined" size="small" onClick={handleCopyText} disabled={goals.length === 0}>
            {t('Copy text', 'Copier texte')}
          </Button>
          <Button variant="outlined" size="small" onClick={handleDownloadJSON} disabled={goals.length === 0}>
            JSON
          </Button>
        </Box>
      </Box>

      {/* Two-column body */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, minHeight: 0, overflow: { xs: 'auto', md: 'hidden' } }}>
        <GoalsList />
        <ResourcesList />
      </Box>

      {/* Footer */}
      <Box sx={{ px: 3, py: 1, borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: 'flex-end', flexShrink: 0, backgroundColor: 'background.paper' }}>
        <Button
          variant="outlined"
          color="error"
          size="small"
          onClick={resetResourceProgress}
          disabled={totalCollected === 0}
        >
          {t('Reset progress', 'Réinitialiser la progression')}
        </Button>
      </Box>
    </Box>
  );
}
