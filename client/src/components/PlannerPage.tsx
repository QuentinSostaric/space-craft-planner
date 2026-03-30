import { useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { GoalsList } from './planner/GoalsList';
import { PlannerTodoBoard } from './planner/PlannerTodoBoard';
import { ResourcesList } from './planner/ResourcesList';
import { StarCitizenLicensedIcon } from './ui/StarCitizenLicensedIcon';
import { aggregatePlannedResources, formatResourceQuantity } from '../utils/crafting';

function SummaryMetric({
  eyebrow,
  label,
  value,
  emphasis = 'default',
}: {
  eyebrow: string;
  label: string;
  value: string;
  emphasis?: 'default' | 'primary';
}) {
  return (
    <Box
      sx={{
        p: 1.25,
        border: 1,
        borderColor: emphasis === 'primary' ? 'primary.main' : 'divider',
        borderRadius: 1.5,
        backgroundColor: emphasis === 'primary' ? (theme) => alpha(theme.palette.primary.main, 0.08) : 'background.paper',
        minHeight: 88,
      }}
    >
      <Typography
        variant="overline"
        sx={{ display: 'block', color: emphasis === 'primary' ? 'primary.main' : 'text.secondary', letterSpacing: '0.14em' }}
      >
        {eyebrow}
      </Typography>
      <Typography sx={{ fontFamily: "'Khand', sans-serif", fontWeight: 700, fontSize: '1.6rem', lineHeight: 0.95 }}>
        {value}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
    </Box>
  );
}

export function PlannerPage() {
  const theme = useTheme();
  const {
    goals,
    blueprints,
    plannerTodoItems,
    plannerResourceRequirements,
    resourceProgress,
    resetResourceProgress,
  } = useCraft();
  const { t, lang } = useI18n();

  const aggregated = useMemo(
    () => aggregatePlannedResources(goals, blueprints, plannerResourceRequirements),
    [goals, blueprints, plannerResourceRequirements],
  );
  const hasPlannerContent =
    goals.length > 0 ||
    plannerTodoItems.length > 0 ||
    aggregated.length > 0;

  const {
    scuRequired,
    countRequired,
    totalCollected,
    completedResourceCount,
    globalPct,
    openTodoCount,
    completedTodoCount,
    blueprintMissionCount,
  } = useMemo(() => {
    let nextScuRequired = 0;
    let nextCountRequired = 0;
    let nextTotalCollected = 0;
    let nextCompletedResourceCount = 0;
    let completionSum = 0;

    for (const resource of aggregated) {
      const collected = Math.min(
        resourceProgress[resource.resourceName]?.collected ?? 0,
        resource.totalScu,
      );
      const completion = resource.totalScu > 0 ? collected / resource.totalScu : 0;

      if (resource.quantityUnit === 'count') {
        nextCountRequired += resource.totalScu;
      } else {
        nextScuRequired += resource.totalScu;
      }

      nextTotalCollected += collected;
      completionSum += completion;

      if (completion >= 1 && resource.totalScu > 0) {
        nextCompletedResourceCount += 1;
      }
    }

    return {
      scuRequired: nextScuRequired,
      countRequired: nextCountRequired,
      totalCollected: nextTotalCollected,
      completedResourceCount: nextCompletedResourceCount,
      globalPct: aggregated.length > 0 ? Math.round((completionSum / aggregated.length) * 100) : 0,
      openTodoCount: plannerTodoItems.filter((item) => !item.completed).length,
      completedTodoCount: plannerTodoItems.filter((item) => item.completed).length,
      blueprintMissionCount: plannerTodoItems.filter((item) => item.source === 'mission-blueprint').length,
    };
  }, [aggregated, plannerTodoItems, resourceProgress]);

  const handleCopyText = useCallback(() => {
    const lines = [
      'ITEM FABRICATOR - Planner',
      '',
      '[Open tasks]',
      ...plannerTodoItems
        .filter((item) => !item.completed)
        .map((item) => `- ${item.title}${item.relatedBlueprintName ? ` (${item.relatedBlueprintName})` : ''}`),
      '',
      '[Goals]',
      ...goals.map((goal) => `${goal.quantity}x ${goal.blueprintName} (${goal.qualityScore}/100)`),
      '',
      '[Resources]',
      ...aggregated.map(
        (resource) =>
          `${resource.resourceName} - ${formatResourceQuantity(resource.totalScu, resource.quantityUnit, lang, 'long')}`,
      ),
    ];
    navigator.clipboard
      .writeText(lines.join('\n'))
      .catch((error) => console.warn('Clipboard write failed:', error));
  }, [aggregated, goals, lang, plannerTodoItems]);

  const handleDownloadJSON = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      tasks: plannerTodoItems,
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
      anchor.download = `item-fabricator-planner-${Date.now()}.json`;
      anchor.click();
    } finally {
      URL.revokeObjectURL(url);
    }
  }, [aggregated, goals, plannerResourceRequirements, plannerTodoItems, resourceProgress]);

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          height: '100%',
          overflowY: 'auto',
          px: { xs: 1.25, md: 2.5 },
          py: { xs: 1.25, md: 2 },
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <Paper
          variant="outlined"
          sx={{
            p: { xs: 1.5, md: 2.25 },
            borderColor: alpha(theme.palette.primary.main, 0.2),
            background:
              theme.palette.mode === 'dark'
                ? `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 22%, ${theme.palette.background.paper} 100%)`
                : theme.palette.background.paper,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Box sx={{ maxWidth: 760 }}>
              <Typography
                variant="overline"
                sx={{ color: 'primary.main', letterSpacing: '0.16em' }}
              >
                {t('Planner', 'Planificateur')}
              </Typography>
              <Typography
                variant="h3"
                sx={{
                  fontFamily: "'Khand', sans-serif",
                  fontSize: { xs: '2rem', md: '2.6rem' },
                  lineHeight: 0.92,
                }}
              >
                {t('Craft operations center', 'Centre d operations de craft')}
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary', mt: 0.75 }}>
                {t(
                  'Plan production goals, track manual tasks, prepare blueprint missions and monitor material readiness from a single cockpit.',
                  'Planifiez la production, les tâches manuelles, les missions blueprint et la préparation des matériaux depuis un seul cockpit.',
                )}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignSelf: 'flex-start' }}>
              <Button
                variant="outlined"
                size="small"
                onClick={handleCopyText}
                disabled={!hasPlannerContent}
              >
                {t('Copy summary', 'Copier le résumé')}
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={handleDownloadJSON}
                disabled={!hasPlannerContent}
              >
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                  <StarCitizenLicensedIcon name="download" size={14} dimmed />
                  <span>JSON</span>
                </Box>
              </Button>
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

          <Box
            sx={{
              mt: 2,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(5, minmax(0, 1fr))' },
              gap: 1,
            }}
          >
            <SummaryMetric
              eyebrow={t('Tasks', 'Tâches')}
              label={t('Open items to handle', 'Éléments ouverts à traiter')}
              value={String(openTodoCount)}
              emphasis="primary"
            />
            <SummaryMetric
              eyebrow={t('Done', 'Terminé')}
              label={t('Completed tasks', 'Tâches terminées')}
              value={String(completedTodoCount)}
            />
            <SummaryMetric
              eyebrow={t('Goals', 'Objectifs')}
              label={t('Blueprint builds queued', 'Blueprints en file')}
              value={String(goals.length)}
            />
            <SummaryMetric
              eyebrow={t('Missions', 'Missions')}
              label={t('Blueprint mission tasks', 'Tâches de mission blueprint')}
              value={String(blueprintMissionCount)}
            />
            <SummaryMetric
              eyebrow={t('Resources', 'Ressources')}
              label={
                aggregated.length > 0
                  ? `${completedResourceCount}/${aggregated.length} ${t('completed', 'complétées')}`
                  : t('No resource checklist yet', 'Aucune checklist ressource')
              }
              value={`${globalPct}%`}
              emphasis={aggregated.length > 0 ? 'primary' : 'default'}
            />
          </Box>

          <Box
            sx={{
              mt: 1.5,
              display: 'flex',
              gap: 1.5,
              flexWrap: 'wrap',
              color: 'text.secondary',
            }}
          >
            <Typography variant="body2">
              {scuRequired > 0
                ? `${formatResourceQuantity(scuRequired, 'scu', lang, 'long')} ${t('required', 'requis')}`
                : t('No SCU requirement yet', 'Aucun besoin SCU pour le moment')}
            </Typography>
            <Typography variant="body2">
              {countRequired > 0
                ? `${formatResourceQuantity(countRequired, 'count', lang, 'long')} ${t('required', 'requis')}`
                : t('No item-count requirement yet', 'Aucun besoin en quantité pour le moment')}
            </Typography>
          </Box>
        </Paper>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.35fr) minmax(320px, 0.92fr)' },
            gap: 2,
            minHeight: { lg: 0 },
            alignItems: 'start',
          }}
        >
          <PlannerTodoBoard />

          <Box
            sx={{
              display: 'grid',
              gridTemplateRows: { xs: 'auto auto', lg: 'minmax(240px, auto) minmax(280px, 1fr)' },
              gap: 2,
              minHeight: { lg: 0 },
            }}
          >
            <GoalsList />
            <ResourcesList aggregated={aggregated} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
