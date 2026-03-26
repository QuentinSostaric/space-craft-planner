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
import { aggregatePlannedResources, formatResourceQuantity } from '../utils/crafting';

export function PlannerPage() {
  const {
    goals,
    blueprints,
    plannerResourceRequirements,
    resourceProgress,
    resetResourceProgress,
  } = useCraft();
  const { t, lang } = useI18n();

  const aggregated = useMemo(
    () => aggregatePlannedResources(goals, blueprints, plannerResourceRequirements),
    [goals, blueprints, plannerResourceRequirements],
  );
  const hasPlannerContent = goals.length > 0 || aggregated.length > 0;

  const { scuRequired, countRequired, totalCollected, completedResourceCount, globalPct } = useMemo(() => {
    let scuRequired = 0;
    let countRequired = 0;
    let totalCollected = 0;
    let completedResourceCount = 0;
    let completionSum = 0;

    for (const resource of aggregated) {
      const collected = Math.min(
        resourceProgress[resource.resourceName]?.collected ?? 0,
        resource.totalScu,
      );
      const completion = resource.totalScu > 0 ? collected / resource.totalScu : 0;

      if (resource.quantityUnit === 'count') {
        countRequired += resource.totalScu;
      } else {
        scuRequired += resource.totalScu;
      }

      totalCollected += collected;
      completionSum += completion;

      if (completion >= 1 && resource.totalScu > 0) {
        completedResourceCount += 1;
      }
    }

    return {
      scuRequired,
      countRequired,
      totalCollected,
      completedResourceCount,
      globalPct: aggregated.length > 0 ? Math.round((completionSum / aggregated.length) * 100) : 0,
    };
  }, [aggregated, resourceProgress]);

  const handleCopyText = useCallback(() => {
    const lines = [
      'ITEM FABRICATOR - Plan',
      '',
      ...goals.map((goal) => `${goal.quantity}x ${goal.blueprintName} (${goal.qualityScore}/100)`),
      '',
      ...aggregated.map(
        (resource) =>
          `${resource.resourceName} - ${formatResourceQuantity(resource.totalScu, resource.quantityUnit, lang, 'long')}`,
      ),
    ];
    navigator.clipboard
      .writeText(lines.join('\n'))
      .catch((error) => console.warn('Clipboard write failed:', error));
  }, [aggregated, goals, lang]);

  const handleDownloadJSON = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      goals: goals.map((goal) => ({
        blueprintId: goal.blueprintId,
        blueprintName: goal.blueprintName,
        quantity: goal.quantity,
        qualityScore: goal.qualityScore,
      })),
      materials: aggregated.map((resource) => ({
        resourceName: resource.resourceName,
        totalQuantity: resource.totalScu,
        quantityUnit: resource.quantityUnit,
        manualRequired: plannerResourceRequirements[resource.resourceName]?.quantity ?? 0,
        collected: resourceProgress[resource.resourceName]?.collected ?? 0,
        method: resourceProgress[resource.resourceName]?.method ?? null,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    try {
      anchor.href = url;
      anchor.download = `item-fabricator-plan-${Date.now()}.json`;
      anchor.click();
    } finally {
      URL.revokeObjectURL(url);
    }
  }, [aggregated, goals, plannerResourceRequirements, resourceProgress]);

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: { xs: 'visible', md: 'hidden' },
      }}
    >
      <Box
        sx={{
          px: { xs: 1.25, md: 3 },
          py: { xs: 1.1, md: 1.5 },
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between',
          gap: 1,
          flexShrink: 0,
          backgroundColor: 'background.paper',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="h6">{t('Planner', 'Planificateur')}</Typography>
          {goals.length > 0 && (
            <Chip
              label={`${goals.length} ${t('goals', 'objectifs')}`}
              size="small"
              variant="outlined"
            />
          )}
          {scuRequired > 0 && (
            <Chip
              label={`${formatResourceQuantity(scuRequired, 'scu', lang, 'long')} ${t('required', 'requis')}`}
              size="small"
              variant="outlined"
            />
          )}
          {countRequired > 0 && (
            <Chip
              label={`${formatResourceQuantity(countRequired, 'count', lang, 'long')} ${t('required', 'requis')}`}
              size="small"
              variant="outlined"
            />
          )}
          {aggregated.length > 0 && (
            <Chip
              label={`${globalPct}% ${t('collected', 'collecte')} • ${completedResourceCount}/${aggregated.length}`}
              size="small"
              color="primary"
              variant="outlined"
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, width: { xs: '100%', sm: 'auto' } }}>
          <Button
            variant="outlined"
            size="small"
            onClick={handleCopyText}
            disabled={!hasPlannerContent}
            sx={{ flex: { xs: 1, sm: '0 0 auto' } }}
          >
            {t('Copy text', 'Copier texte')}
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={handleDownloadJSON}
            disabled={!hasPlannerContent}
            sx={{ flex: { xs: 1, sm: '0 0 auto' } }}
          >
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
              <StarCitizenLicensedIcon name="download" size={14} dimmed />
              <span>JSON</span>
            </Box>
          </Button>
        </Box>
      </Box>

      <Box
        sx={{
          flex: { xs: '0 0 auto', md: 1 },
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          minHeight: 0,
          overflow: { xs: 'visible', md: 'hidden' },
        }}
      >
        <GoalsList />
        <ResourcesList aggregated={aggregated} />
      </Box>

      <Box
        sx={{
          px: { xs: 1.25, md: 3 },
          py: 1,
          borderTop: 1,
          borderColor: 'divider',
          display: 'flex',
          justifyContent: { xs: 'stretch', md: 'flex-end' },
          flexShrink: 0,
          backgroundColor: 'background.paper',
        }}
      >
        <Button
          variant="outlined"
          color="error"
          size="small"
          onClick={resetResourceProgress}
          disabled={totalCollected === 0}
          sx={{ width: { xs: '100%', md: 'auto' } }}
        >
          {t('Reset progress', 'Reinitialiser la progression')}
        </Button>
      </Box>
    </Box>
  );
}
