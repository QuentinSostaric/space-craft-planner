import { useCallback, useEffect, useMemo, useState, type SyntheticEvent } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { useCraftSimulator } from '../hooks/useCraftSimulator';
import { CategoryBadge } from './ui/Badge';
import { ResourceIcon } from './ui/ResourceIcon';
import { Button } from './ui/Button';
import { tokens } from '../theme';
import type {
  AcquisitionGraphEntry,
  AggregatedResource,
  CraftGoal,
  Lang,
  MaterialSlot,
} from '../types';
import {
  aggregateGoalResources,
  clampQualityValue,
  formatScaleLabel,
  getAcquisitionEntry,
  summarizeAssignedQualities,
} from '../utils/crafting';

function buildTextExport(
  goals: CraftGoal[],
  aggregated: AggregatedResource[],
  goalSources: Array<{ blueprintName: string; acquisitionEntry: AcquisitionGraphEntry | null }>,
  lang: Lang,
  hasExplicitCraftResourceRewards: boolean,
): string {
  const now = new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US');
  const lines: string[] = [];
  const heading = (value: string) => `=== ${value} ===`;

  lines.push(lang === 'fr' ? 'ITEM FABRICATOR - Plan' : 'ITEM FABRICATOR - Plan');
  lines.push(`${lang === 'fr' ? 'Genere le' : 'Generated'}: ${now}`);
  lines.push('');

  lines.push(heading(lang === 'fr' ? 'OBJECTIFS' : 'GOALS'));
  for (const goal of goals) {
    lines.push(`${goal.quantity}x ${goal.blueprintName} (${lang === 'fr' ? 'Indice' : 'Index'}: ${goal.qualityScore}/100)`);
  }
  lines.push('');

  lines.push(heading(lang === 'fr' ? 'MATERIAUX REQUIS' : 'REQUIRED MATERIALS'));
  for (const entry of aggregated) {
    lines.push(
      `${entry.resourceName} - ${summarizeAssignedQualities(entry.assignedQualityValues, entry.unassignedSlotCount, lang)} - ${entry.totalScu.toFixed(2)} SCU`,
    );
  }
  lines.push('');

  lines.push(heading(lang === 'fr' ? 'SOURCES DE BLUEPRINTS' : 'BLUEPRINT SOURCES'));
  for (const goalSource of goalSources) {
    lines.push(goalSource.blueprintName);
    if (!goalSource.acquisitionEntry || goalSource.acquisitionEntry.contractCount === 0) {
      lines.push(lang === 'fr' ? '  Aucun contrat trouve dans le dataset.' : '  No matching contract found in the dataset.');
      continue;
    }

    for (const faction of goalSource.acquisitionEntry.factions) {
      for (const contract of faction.contracts) {
        lines.push(
          `  - ${contract.contractDebugName ?? 'Unknown'} | ${faction.contractorDisplayName ?? 'Unknown'} | ${formatScaleLabel(contract.availability.derivedScale, lang)}`,
        );
      }
    }
  }
  lines.push('');

  lines.push(heading(lang === 'fr' ? 'NOTES MATERIAUX' : 'MATERIAL NOTES'));
  lines.push(
    hasExplicitCraftResourceRewards
      ? (lang === 'fr'
        ? 'Des recompenses explicites en ressources de craft sont presentes dans les contrats.'
        : 'Explicit craft-resource contract rewards are present in this dataset.')
      : (lang === 'fr'
        ? 'Aucune recompense explicite en ressources de craft n a ete trouvee dans les contrats publies.'
        : 'No explicit craft-resource contract rewards were found in the published contracts.'),
  );

  return lines.join('\n');
}

function GoalEditModal({ goal, onClose }: { goal: CraftGoal; onClose: () => void }) {
  const { blueprints, updateGoal } = useCraft();
  const { t } = useI18n();
  const blueprint = blueprints.find((candidate) => candidate.id === goal.blueprintId);
  const [assignments, setAssignments] = useState<Record<string, number | undefined>>({
    ...goal.slotAssignments,
  });

  const { qualityScore, projectedStats } = useCraftSimulator(blueprint ?? null, assignments);

  if (!blueprint) {
    return null;
  }

  function setSlotQuality(slotId: string, value: number | undefined) {
    setAssignments((previous) => ({ ...previous, [slotId]: clampQualityValue(value) }));
  }

  return (
    <Dialog
      open
      onClose={onClose}
      aria-label={t(`Edit goal ${goal.blueprintName}`, `Modifier l objectif ${goal.blueprintName}`)}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CategoryBadge category={blueprint.category} iconOnly />
          <Typography variant="h6" sx={{ fontFamily: "'Khand', sans-serif", fontWeight: 700, fontSize: '1.1rem' }}>
            {goal.blueprintName}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontFamily: "'Share Tech Mono', monospace" }}>
            {t('Build index', 'Indice de build')}: <strong>{qualityScore}</strong>/100
          </Typography>
          <IconButton onClick={onClose} aria-label={t('Close', 'Fermer')} size="small">
            ✕
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {blueprint.slots.map((slot: MaterialSlot) => {
            const assignedValue = assignments[slot.id];
            return (
              <Box key={slot.id} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ResourceIcon name={slot.requiredResource} size={16} />
                  <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>{slot.requiredResource}</Typography>
                  <Typography variant="caption" sx={{ fontFamily: "'Share Tech Mono', monospace", color: 'text.secondary' }}>
                    {slot.quantityScu.toFixed(2)} SCU
                  </Typography>
                  {slot.minQuality != null && slot.minQuality > 0 && (
                    <Chip label={`Min ${slot.minQuality}`} size="small" variant="outlined" sx={{ fontSize: '.6rem', height: 20, color: 'warning.main', borderColor: 'rgba(251,191,36,.25)' }} />
                  )}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <TextField
                    type="number"
                    size="small"
                    value={assignedValue ?? ''}
                    placeholder="0-1000"
                    onChange={(event) =>
                      setSlotQuality(
                        slot.id,
                        event.target.value === '' ? undefined : Number(event.target.value),
                      )
                    }
                    slotProps={{ htmlInput: { min: 0, max: 1000, style: { width: 60, textAlign: 'center', padding: '4px 6px' } } }}
                    aria-label={t(
                      `Assigned quality for ${slot.requiredResource}`,
                      `Qualite assignee pour ${slot.requiredResource}`,
                    )}
                    sx={{ width: 80 }}
                  />
                  <Button variant="ghost" size="sm" onClick={() => setSlotQuality(slot.id, slot.minQuality ?? 0)}>
                    {t('Min', 'Min')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSlotQuality(slot.id, 1000)}>
                    {t('Max', 'Max')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSlotQuality(slot.id, undefined)}>
                    {t('Clear', 'Effacer')}
                  </Button>
                </Box>
              </Box>
            );
          })}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t('Cancel', 'Annuler')}
        </Button>
        <Button
          variant="gradient"
          size="sm"
          onClick={() => {
            updateGoal(goal.id, assignments, qualityScore, projectedStats);
            onClose();
          }}
        >
          {t('Save changes', 'Enregistrer')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function GoalCard({
  goal,
  isActive,
  onRemove,
  onQtyChange,
  onEdit,
  onSelect,
}: {
  goal: CraftGoal;
  isActive: boolean;
  onRemove: () => void;
  onQtyChange: (quantity: number) => void;
  onEdit: () => void;
  onSelect: () => void;
}) {
  const { blueprints } = useCraft();
  const { t } = useI18n();
  const blueprint = blueprints.find((candidate) => candidate.id === goal.blueprintId);

  const stopPropagation = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  return (
    <Card
      sx={{
        cursor: 'pointer',
        borderColor: isActive ? tokens.violet : tokens.border,
        backgroundColor: isActive ? tokens.surface2 : tokens.surface1,
        '&:hover': { borderColor: tokens.borderStrong },
      }}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${t('Goal', 'Objectif')}: ${goal.blueprintName}`}
    >
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          {blueprint && <CategoryBadge category={blueprint.category} iconOnly />}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontFamily: "'Khand', sans-serif", fontWeight: 700, fontSize: '.85rem', lineHeight: 1.2 }}>
              {goal.blueprintName}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: "'Share Tech Mono', monospace", fontSize: '.62rem' }}>
              {t('Build index', 'Indice de build')}: <strong>{goal.qualityScore}</strong>/100
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.25 }}>
            <IconButton
              size="small"
              onClick={(event) => { stopPropagation(event); onEdit(); }}
              aria-label={`${t('Edit', 'Modifier')} ${goal.blueprintName}`}
              sx={{ fontSize: '.75rem' }}
            >
              ✎
            </IconButton>
            <IconButton
              size="small"
              onClick={(event) => { stopPropagation(event); onRemove(); }}
              aria-label={`${t('Remove', 'Supprimer')} ${goal.blueprintName}`}
              sx={{ fontSize: '.7rem', color: 'error.main' }}
            >
              ✕
            </IconButton>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '.65rem' }}>
            {t('Qty', 'Qte')}
          </Typography>
          <IconButton
            size="small"
            onClick={(event) => { stopPropagation(event); onQtyChange(Math.max(1, goal.quantity - 1)); }}
            aria-label={t('Decrease', 'Reduire')}
            sx={{ width: 22, height: 22, fontSize: '.7rem' }}
          >
            −
          </IconButton>
          <TextField
            type="number"
            size="small"
            value={goal.quantity}
            onClick={stopPropagation}
            onFocus={stopPropagation}
            onChange={(event) =>
              onQtyChange(Math.max(1, Math.min(99, Number(event.target.value) || 1)))
            }
            slotProps={{ htmlInput: { min: 1, max: 99, style: { width: 32, textAlign: 'center', padding: '2px 4px', fontSize: '.75rem' } } }}
            sx={{ width: 48 }}
          />
          <IconButton
            size="small"
            onClick={(event) => { stopPropagation(event); onQtyChange(Math.min(99, goal.quantity + 1)); }}
            aria-label={t('Increase', 'Augmenter')}
            sx={{ width: 22, height: 22, fontSize: '.7rem' }}
          >
            +
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  );
}

function RequiredMaterialsSection({ aggregated }: { aggregated: AggregatedResource[] }) {
  const { lang, t } = useI18n();

  if (aggregated.length === 0) {
    return <Typography variant="body2" sx={{ color: 'text.secondary', py: 1, fontSize: '.78rem' }}>{t('Add goals to see required materials.', 'Ajoutez des objectifs pour voir les materiaux requis.')}</Typography>;
  }

  return (
    <List dense disablePadding aria-label={t('Required materials', 'Materiaux requis')}>
      {aggregated.map((entry) => (
        <ListItem key={entry.resourceName} disableGutters sx={{ py: 0.5 }}>
          <ListItemIcon sx={{ minWidth: 28 }}>
            <ResourceIcon name={entry.resourceName} size={16} />
          </ListItemIcon>
          <ListItemText
            primary={entry.resourceName}
            secondary={summarizeAssignedQualities(entry.assignedQualityValues, entry.unassignedSlotCount, lang)}
            slotProps={{
              primary: { sx: { fontSize: '.78rem', fontWeight: 600 } },
              secondary: { sx: { fontSize: '.65rem' } },
            }}
          />
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.25 }}>
            {entry.minRequiredQuality != null && (
              <Chip label={`Min ${entry.minRequiredQuality}`} size="small" variant="outlined" sx={{ fontSize: '.55rem', height: 16, color: 'warning.main', borderColor: 'rgba(251,191,36,.25)' }} />
            )}
            <Typography variant="caption" sx={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '.65rem' }}>
              ×{entry.totalScu.toFixed(2)} SCU
            </Typography>
          </Box>
        </ListItem>
      ))}
    </List>
  );
}

function BlueprintSourcesSection({
  sources,
  loading,
  error,
}: {
  sources: Array<{ blueprintName: string; acquisitionEntry: AcquisitionGraphEntry | null }>;
  loading: boolean;
  error: string | null;
}) {
  const { lang, t } = useI18n();

  if (loading) {
    return <Typography variant="body2" sx={{ color: 'text.secondary', py: 1, fontSize: '.78rem' }}>{t('Loading mission reward data…', 'Chargement des donnees missions…')}</Typography>;
  }

  if (error) {
    return <Alert severity="error" variant="outlined" sx={{ fontSize: '.75rem' }}>{error}</Alert>;
  }

  if (sources.length === 0) {
    return <Typography variant="body2" sx={{ color: 'text.secondary', py: 1, fontSize: '.78rem' }}>{t('Add goals to inspect blueprint acquisition sources.', 'Ajoutez des objectifs pour consulter les sources des blueprints.')}</Typography>;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {sources.map((source) => {
        const count = source.acquisitionEntry?.contractCount ?? 0;
        return (
          <Paper key={source.blueprintName} elevation={0} sx={{ border: 1, borderColor: 'divider', p: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body2" sx={{ fontFamily: "'Khand', sans-serif", fontWeight: 700, fontSize: '.85rem' }}>
                {source.blueprintName}
              </Typography>
              <Chip
                label={`${count} ${t('contract', 'contrat')}${count > 1 ? 's' : ''}`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '.55rem', height: 18 }}
              />
            </Box>
            {count === 0 ? (
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '.75rem' }}>
                {t('No matching blueprint reward contract found in the published dataset.', 'Aucun contrat correspondant n a ete trouve dans le dataset publie.')}
              </Typography>
            ) : (
              <List dense disablePadding>
                {(source.acquisitionEntry?.factions ?? []).map((faction, fIdx) =>
                  faction.contracts.map((contract, cIdx) => (
                    <ListItem
                      key={`${fIdx}-${cIdx}`}
                      disableGutters
                      sx={{ flexDirection: 'column', alignItems: 'flex-start', py: 0.5, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '.75rem' }}>
                          {contract.contractDebugName ?? 'Unknown contract'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600, fontSize: '.6rem', textTransform: 'uppercase' }}>
                          {formatScaleLabel(contract.availability.derivedScale, lang)}
                        </Typography>
                      </Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '.62rem' }}>
                        {faction.contractorDisplayName ?? 'Unknown'}{' - '}
                        {contract.availability.localities.length > 0
                          ? contract.availability.localities.join(', ')
                          : contract.availability.explicitLocations.length > 0
                            ? contract.availability.explicitLocations.join(', ')
                            : t('No explicit location', 'Aucun lieu explicite')}
                      </Typography>
                      {contract.minimumRequiredStandings.length > 0 && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '.62rem' }}>
                          {contract.minimumRequiredStandings
                            .map((s) => [s.factionName, s.scopeName, s.standingName].filter(Boolean).join(' — '))
                            .join(' | ')}
                        </Typography>
                      )}
                    </ListItem>
                  )),
                )}
              </List>
            )}
          </Paper>
        );
      })}
    </Box>
  );
}

function ResourceAcquisitionNotes() {
  const { missionRewards, dismantlingData } = useCraft();
  const { t } = useI18n();
  const explicitCraftResourceRewards =
    missionRewards?.summary?.craftResourceRewardContractCount ?? 0;

  return (
    <Alert severity="info" variant="outlined" sx={{ '& .MuiAlert-message': { fontSize: '.72rem' } }}>
      <Typography variant="body2" sx={{ fontSize: '.72rem', mb: 0.5 }}>
        {explicitCraftResourceRewards > 0
          ? t(
              'This dataset includes explicit craft-resource contract rewards.',
              'Ce dataset inclut des recompenses explicites en ressources de craft.',
            )
          : t(
              'No explicit craft-resource contract rewards were found in the published contract data.',
              'Aucune recompense explicite en ressources de craft n a ete trouvee dans les contrats publies.',
            )}
      </Typography>
      {dismantlingData?.dismantling?.blueprint && (
        <Typography variant="body2" sx={{ fontSize: '.72rem', mb: 0.5 }}>
          {t(
            `Dismantling is available globally at ${Math.round(dismantlingData.dismantling.blueprint.efficiency * 100)}% efficiency and ${dismantlingData.dismantling.blueprint.dismantleTimeSecs}s per job.`,
            `Le demontage est disponible globalement a ${Math.round(dismantlingData.dismantling.blueprint.efficiency * 100)}% d efficacite et ${dismantlingData.dismantling.blueprint.dismantleTimeSecs}s par job.`,
          )}
        </Typography>
      )}
      {dismantlingData?.dismantling?.perItemYieldModel?.resolved === false && (
        <Typography variant="body2" sx={{ fontSize: '.72rem' }}>
          {t(
            'Exact dismantle yields per item remain unresolved in the current dataset.',
            'Les rendements exacts de demontage par item restent non resolus dans le dataset actuel.',
          )}
        </Typography>
      )}
    </Alert>
  );
}

export function PlannerPanel() {
  const {
    goals,
    removeGoal,
    updateGoalQuantity,
    selectGoalBlueprint,
    activeBlueprint,
    blueprints,
    activeChannel,
    missionRewards,
    missionRewardsLoading,
    missionRewardsError,
    ensureMissionRewardsLoaded,
  } = useCraft();
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const { lang, t } = useI18n();
  const editingGoal = goals.find((goal) => goal.id === editingGoalId) ?? null;

  useEffect(() => {
    if (goals.length > 0) {
      void ensureMissionRewardsLoaded();
    }
  }, [ensureMissionRewardsLoaded, goals.length]);

  const blueprintIds = useMemo(() => new Set(blueprints.map((blueprint) => blueprint.id)), [blueprints]);
  const aggregated = useMemo(() => aggregateGoalResources(goals, blueprints), [blueprints, goals]);

  const unavailableGoalCount = useMemo(
    () => goals.filter((goal) => !blueprintIds.has(goal.blueprintId)).length,
    [blueprintIds, goals],
  );

  const goalSources = useMemo(() => {
    const seen = new Set<string>();

    return goals
      .filter((goal) => {
        if (seen.has(goal.blueprintId)) {
          return false;
        }
        seen.add(goal.blueprintId);
        return true;
      })
      .map((goal) => ({
        blueprintName: goal.blueprintName,
        acquisitionEntry: getAcquisitionEntry(missionRewards, goal.blueprintId),
      }))
      .sort((left, right) => left.blueprintName.localeCompare(right.blueprintName));
  }, [goals, missionRewards]);

  const handleCopyText = useCallback(() => {
    const text = buildTextExport(
      goals,
      aggregated,
      goalSources,
      lang,
      (missionRewards?.summary?.craftResourceRewardContractCount ?? 0) > 0,
    );
    navigator.clipboard.writeText(text).catch(() => {});
  }, [aggregated, goalSources, goals, lang, missionRewards?.summary?.craftResourceRewardContractCount]);

  const handleDownloadJSON = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      goals: goals.map((goal) => ({
        blueprintId: goal.blueprintId,
        blueprintName: goal.blueprintName,
        quantity: goal.quantity,
        buildIndex: goal.qualityScore,
      })),
      materials: aggregated.map((entry) => ({
        resourceName: entry.resourceName,
        totalScu: entry.totalScu,
        minRequiredQuality: entry.minRequiredQuality,
        assignedQualityValues: entry.assignedQualityValues,
        unassignedSlotCount: entry.unassignedSlotCount,
      })),
      blueprintSources: goalSources.map((source) => ({
        blueprintName: source.blueprintName,
        contractCount: source.acquisitionEntry?.contractCount ?? 0,
        factions: (source.acquisitionEntry?.factions ?? []).map((faction) => ({
          contractorDisplayName: faction.contractorDisplayName,
          factionDisplayName: faction.faction?.displayName ?? null,
          contracts: faction.contracts.map((contract) => ({
            contractDebugName: contract.contractDebugName,
            availability: contract.availability,
            minimumRequiredStandings: contract.minimumRequiredStandings,
          })),
        })),
      })),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `item-fabricator-plan-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [aggregated, goalSources, goals]);

  const goalWord = lang === 'en'
    ? `${goals.length} goal${goals.length !== 1 ? 's' : ''}`
    : `${goals.length} objectif${goals.length !== 1 ? 's' : ''}`;

  return (
    <Box component="section" aria-label={t('Resource planner', 'Planificateur de ressources')} sx={{ p: 2 }}>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2, fontSize: '.75rem' }}>
        {goalWord} · {aggregated.length} {t('material', 'materiau')}{aggregated.length !== 1 ? 'x' : ''}
      </Typography>

      {/* Goals */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="h6" sx={{ fontFamily: "'Khand', sans-serif", fontWeight: 700, fontSize: '.9rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            {t('Goals', 'Objectifs')}
          </Typography>
          {goals.length > 0 && (
            <Chip label={goals.length} size="small" sx={{ height: 18, fontSize: '.6rem' }} />
          )}
        </Box>
        {goals.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '.78rem' }}>
            {t(
              'No goals yet. Simulate a craft and click "Add to Planner".',
              'Aucun objectif pour le moment. Simulez un craft puis cliquez sur "Ajouter au planificateur".',
            )}
          </Typography>
        ) : (
          <>
            {unavailableGoalCount > 0 && (
              <Alert severity="warning" variant="outlined" sx={{ mb: 1, fontSize: '.72rem' }}>
                {t(
                  `${unavailableGoalCount} saved goal(s) are not available in the current ${activeChannel.toUpperCase()} dataset.`,
                  `${unavailableGoalCount} objectif(s) enregistres ne sont pas disponibles dans le dataset ${activeChannel.toUpperCase()} actif.`,
                )}
              </Alert>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {goals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  isActive={activeBlueprint?.id === goal.blueprintId}
                  onRemove={() => removeGoal(goal.id)}
                  onQtyChange={(quantity) => updateGoalQuantity(goal.id, quantity)}
                  onEdit={() => setEditingGoalId(goal.id)}
                  onSelect={() => selectGoalBlueprint(goal.id)}
                />
              ))}
            </Box>
          </>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Required Materials */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontFamily: "'Khand', sans-serif", fontWeight: 700, fontSize: '.9rem', textTransform: 'uppercase', letterSpacing: '.06em', mb: 1 }}>
          {t('Required Materials', 'Materiaux requis')}
        </Typography>
        <RequiredMaterialsSection aggregated={aggregated} />
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Blueprint Sources */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontFamily: "'Khand', sans-serif", fontWeight: 700, fontSize: '.9rem', textTransform: 'uppercase', letterSpacing: '.06em', mb: 1 }}>
          {t('Blueprint Sources', 'Sources des blueprints')}
        </Typography>
        <BlueprintSourcesSection
          sources={goalSources}
          loading={missionRewardsLoading}
          error={missionRewardsError}
        />
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Notes */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontFamily: "'Khand', sans-serif", fontWeight: 700, fontSize: '.9rem', textTransform: 'uppercase', letterSpacing: '.06em', mb: 1 }}>
          {t('Resource Acquisition Notes', 'Notes d acquisition des ressources')}
        </Typography>
        <ResourceAcquisitionNotes />
      </Box>

      {/* Export */}
      {goals.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Box>
            <Typography variant="h6" sx={{ fontFamily: "'Khand', sans-serif", fontWeight: 700, fontSize: '.9rem', textTransform: 'uppercase', letterSpacing: '.06em', mb: 1 }}>
              {t('Export', 'Export')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="ghost" size="sm" onClick={handleCopyText}>
                {t('Copy as text', 'Copier en texte')}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDownloadJSON}>
                {t('Download JSON', 'Telecharger JSON')}
              </Button>
            </Box>
          </Box>
        </>
      )}

      {editingGoal && <GoalEditModal goal={editingGoal} onClose={() => setEditingGoalId(null)} />}
    </Box>
  );
}
