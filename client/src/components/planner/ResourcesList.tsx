import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useLocalPersist } from '../../hooks/useLocalPersist';
import { useCraft } from '../../store/CraftContext';
import { useI18n } from '../../i18n/I18nContext';
import { LS_KEYS } from '../../types';
import { areStringArraysEqual, moveIdBefore, synchronizeOrderedIds } from '../../utils/reorder';
import { formatResourceQuantity } from '../../utils/crafting';
import { StarCitizenLicensedIcon } from '../ui/StarCitizenLicensedIcon';
import type { AggregatedResource } from '../../types';
import { ResourceRow } from './ResourceRow';
import { alpha, useTheme } from '@mui/material/styles';

export function ResourcesList({ aggregated }: { aggregated: AggregatedResource[] }) {
  const { plannerResourceRequirements, resourceProgress } = useCraft();
  const { t, lang } = useI18n();
  const theme = useTheme();
  const [resourceOrder, setResourceOrder] = useLocalPersist<string[]>(LS_KEYS.PLANNER_RESOURCE_ORDER, []);
  const [draggedResourceName, setDraggedResourceName] = useState<string | null>(null);
  const [dropResourceName, setDropResourceName] = useState<string | null>(null);
  const resourceNames = useMemo(
    () => aggregated.map((resource) => resource.resourceName),
    [aggregated],
  );

  useEffect(() => {
    setResourceOrder((previous) => {
      const next = synchronizeOrderedIds(previous, resourceNames);
      return areStringArraysEqual(previous, next) ? previous : next;
    });
  }, [resourceNames, setResourceOrder]);

  const orderedResources = useMemo(() => {
    const resourceByName = new Map(aggregated.map((resource) => [resource.resourceName, resource]));
    return synchronizeOrderedIds(resourceOrder, resourceNames)
      .map((resourceName) => resourceByName.get(resourceName))
      .filter((resource): resource is NonNullable<typeof resource> => Boolean(resource));
  }, [aggregated, resourceNames, resourceOrder]);

  const { scuCollected, scuRequired, countCollected, countRequired, globalPct } = useMemo(() => {
    let scuCollected = 0;
    let scuRequired = 0;
    let countCollected = 0;
    let countRequired = 0;
    let completionSum = 0;

    for (const resource of orderedResources) {
      const collected = Math.min(resourceProgress[resource.resourceName]?.collected ?? 0, resource.totalScu);
      const completion = resource.totalScu > 0 ? collected / resource.totalScu : 0;

      if (resource.quantityUnit === 'count') {
        countCollected += collected;
        countRequired += resource.totalScu;
      } else {
        scuCollected += collected;
        scuRequired += resource.totalScu;
      }

      completionSum += completion;
    }

    return {
      scuCollected,
      scuRequired,
      countCollected,
      countRequired,
      globalPct: orderedResources.length > 0 ? (completionSum / orderedResources.length) * 100 : 0,
    };
  }, [orderedResources, resourceProgress]);

  const handleDragStart = useCallback(
    (resourceName: string) => (event: DragEvent<HTMLElement>) => {
      setDraggedResourceName(resourceName);
      setDropResourceName(resourceName);
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', resourceName);

      const previewElement = event.currentTarget.closest('[data-resource-row="true"]');
      if (previewElement instanceof HTMLElement) {
        const rect = previewElement.getBoundingClientRect();
        event.dataTransfer.setDragImage(
          previewElement,
          event.clientX - rect.left,
          event.clientY - rect.top,
        );
      }
    },
    [],
  );

  const handleDragOver = useCallback(
    (resourceName: string) => (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      const currentDraggedResourceName =
        draggedResourceName ?? event.dataTransfer.getData('text/plain');
      if (!currentDraggedResourceName || currentDraggedResourceName === resourceName) {
        return;
      }
      event.dataTransfer.dropEffect = 'move';
      setDropResourceName(resourceName);
      setResourceOrder((previous) => {
        const synced = synchronizeOrderedIds(previous, resourceNames);
        const next = moveIdBefore(synced, currentDraggedResourceName, resourceName);
        return areStringArraysEqual(synced, next) ? synced : next;
      });
    },
    [draggedResourceName, resourceNames, setResourceOrder],
  );

  const handleDrop = useCallback(
    (resourceName: string) => (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      const currentDraggedResourceName = draggedResourceName ?? event.dataTransfer.getData('text/plain');
      if (!currentDraggedResourceName || currentDraggedResourceName === resourceName) {
        setDraggedResourceName(null);
        setDropResourceName(null);
        return;
      }

      setResourceOrder((previous) => {
        const synced = synchronizeOrderedIds(previous, resourceNames);
        const next = moveIdBefore(synced, currentDraggedResourceName, resourceName);
        return areStringArraysEqual(synced, next) ? synced : next;
      });
      setDraggedResourceName(null);
      setDropResourceName(null);
    },
    [draggedResourceName, resourceNames, setResourceOrder],
  );

  const handleDragEnd = useCallback(() => {
    setDraggedResourceName(null);
    setDropResourceName(null);
  }, []);

  return (
    <Paper
      variant="outlined"
      sx={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
        borderColor: alpha(theme.palette.primary.main, 0.16),
      }}
    >
      <Box sx={{ px: 1.5, py: 1.25, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
          <Box>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
              <StarCitizenLicensedIcon name="asteroid" size={14} dimmed />
              <Typography variant="overline" sx={{ display: 'block', color: 'primary.main' }}>
                {t('Resources', 'Ressources')}
              </Typography>
            </Box>
            <Typography sx={{ fontFamily: "'Khand', sans-serif", fontWeight: 700, fontSize: '1.25rem', lineHeight: 0.95 }}>
              {t('Material checklist', 'Checklist matériaux')}
            </Typography>
          </Box>
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', fontFamily: "'Share Tech Mono', monospace" }}
          >
            {[
              scuRequired > 0
                ? `${formatResourceQuantity(scuCollected, 'scu', lang)} / ${formatResourceQuantity(scuRequired, 'scu', lang)}`
                : null,
              countRequired > 0
                ? `${formatResourceQuantity(countCollected, 'count', lang)} / ${formatResourceQuantity(countRequired, 'count', lang)}`
                : null,
            ]
              .filter(Boolean)
              .join(' • ') || t('No totals', 'Pas de total')}
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={globalPct}
          sx={{ height: 6, borderRadius: 999 }}
        />
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          p: 1.25,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        {orderedResources.length === 0 && (
          <Typography
            variant="body2"
            sx={{ color: 'text.disabled', fontSize: '0.78rem', py: 2.5, textAlign: 'center' }}
          >
            {t(
              'Add goals or materials to see required resources.',
              'Ajoutez des objectifs ou des matériaux pour voir les ressources requises.',
            )}
          </Typography>
        )}
        {orderedResources.map((resource) => (
          <ResourceRow
            key={resource.resourceName}
            resource={resource}
            progress={resourceProgress[resource.resourceName]}
            manualRequired={plannerResourceRequirements[resource.resourceName]?.quantity ?? 0}
            isDragging={draggedResourceName === resource.resourceName}
            isDropTarget={dropResourceName === resource.resourceName && draggedResourceName !== resource.resourceName}
            onDragOver={handleDragOver(resource.resourceName)}
            onDrop={handleDrop(resource.resourceName)}
            dragHandleProps={{
              draggable: true,
              onDragStart: handleDragStart(resource.resourceName),
              onDragEnd: handleDragEnd,
            }}
          />
        ))}
      </Box>
    </Paper>
  );
}
