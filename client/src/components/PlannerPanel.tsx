import { useCallback, useEffect, useMemo, useState, type SyntheticEvent } from 'react';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { useCraftSimulator } from '../hooks/useCraftSimulator';
import { CategoryBadge } from './ui/Badge';
import { ResourceIcon } from './ui/ResourceIcon';
import { Button } from './ui/Button';
import type {
  AggregatedResource,
  CraftGoal,
  Lang,
  MaterialSlot,
  MissionContract,
} from '../types';
import {
  aggregateGoalResources,
  clampQualityValue,
  findMissionContractsForBlueprint,
  formatLocations,
  formatScaleLabel,
  formatStanding,
  summarizeAssignedQualities,
} from '../utils/crafting';

function buildTextExport(
  goals: CraftGoal[],
  aggregated: AggregatedResource[],
  goalSources: Array<{ blueprintName: string; contracts: MissionContract[] }>,
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
    if (goalSource.contracts.length === 0) {
      lines.push(lang === 'fr' ? '  Aucun contrat trouve dans le dataset.' : '  No matching contract found in the dataset.');
      continue;
    }

    for (const contract of goalSource.contracts) {
      lines.push(
        `  - ${contract.contractDebugName ?? 'Unknown'} | ${contract.contractorDisplayName ?? 'Unknown'} | ${formatScaleLabel(contract.availability.derivedScale, lang)}`,
      );
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
    <div
      className="goal-edit-overlay"
      onClick={(event) => {
        if (event.currentTarget === event.target) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t(`Edit goal ${goal.blueprintName}`, `Modifier l objectif ${goal.blueprintName}`)}
    >
      <div className="goal-edit-modal">
        <header className="goal-edit-modal__header">
          <div className="goal-edit-modal__title-row">
            <CategoryBadge category={blueprint.category} iconOnly />
            <h3 className="goal-edit-modal__title">{goal.blueprintName}</h3>
          </div>
          <div className="goal-edit-modal__score">
            {t('Build index', 'Indice de build')}: <strong>{qualityScore}</strong>/100
          </div>
          <button className="goal-edit-modal__close" onClick={onClose} aria-label={t('Close', 'Fermer')}>
            ✕
          </button>
        </header>

        <div className="goal-edit-modal__slots">
          {blueprint.slots.map((slot: MaterialSlot) => {
            const assignedValue = assignments[slot.id];
            return (
              <div key={slot.id} className="goal-edit__slot">
                <div className="goal-edit__slot-info">
                  <ResourceIcon name={slot.requiredResource} size={16} />
                  <span className="goal-edit__slot-resource">{slot.requiredResource}</span>
                  <span className="goal-edit__slot-scu">{slot.quantityScu.toFixed(2)} SCU</span>
                  {slot.minQuality != null && slot.minQuality > 0 && (
                    <span className="goal-edit__slot-min">Min {slot.minQuality}</span>
                  )}
                </div>
                <div className="goal-edit__slot-controls">
                  <input
                    className="goal-edit__slot-input"
                    type="number"
                    min={0}
                    max={1000}
                    value={assignedValue ?? ''}
                    placeholder="0-1000"
                    onChange={(event) =>
                      setSlotQuality(
                        slot.id,
                        event.target.value === '' ? undefined : Number(event.target.value),
                      )
                    }
                    aria-label={t(
                      `Assigned quality for ${slot.requiredResource}`,
                      `Qualite assignee pour ${slot.requiredResource}`,
                    )}
                  />
                  <button
                    className="goal-edit__slot-btn"
                    onClick={() => setSlotQuality(slot.id, slot.minQuality ?? 0)}
                  >
                    {t('Min', 'Min')}
                  </button>
                  <button className="goal-edit__slot-btn" onClick={() => setSlotQuality(slot.id, 1000)}>
                    {t('Max', 'Max')}
                  </button>
                  <button className="goal-edit__slot-btn" onClick={() => setSlotQuality(slot.id, undefined)}>
                    {t('Clear', 'Effacer')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <footer className="goal-edit-modal__footer">
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
        </footer>
      </div>
    </div>
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
    <article
      className={['goal-card', isActive && 'goal-card--active'].filter(Boolean).join(' ')}
      aria-label={`${t('Goal', 'Objectif')}: ${goal.blueprintName}`}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="goal-card__header">
        {blueprint && <CategoryBadge category={blueprint.category} iconOnly />}
        <div className="goal-card__info">
          <h4 className="goal-card__name">{goal.blueprintName}</h4>
          <span className="goal-card__score">
            {t('Build index', 'Indice de build')}: <strong>{goal.qualityScore}</strong>/100
          </span>
        </div>
        <div className="goal-card__actions">
          <button
            className="goal-card__edit"
            onClick={(event) => {
              stopPropagation(event);
              onEdit();
            }}
            aria-label={`${t('Edit', 'Modifier')} ${goal.blueprintName}`}
          >
            ✎
          </button>
          <button
            className="goal-card__remove"
            onClick={(event) => {
              stopPropagation(event);
              onRemove();
            }}
            aria-label={`${t('Remove', 'Supprimer')} ${goal.blueprintName}`}
          >
            ✕
          </button>
        </div>
      </div>

      <div className="goal-card__qty">
        <label htmlFor={`qty-${goal.id}`} className="goal-card__qty-label">
          {t('Qty', 'Qte')}
        </label>
        <div className="goal-card__qty-ctrl">
          <button
            className="goal-card__qty-btn"
            onClick={(event) => {
              stopPropagation(event);
              onQtyChange(Math.max(1, goal.quantity - 1));
            }}
            aria-label={t('Decrease', 'Reduire')}
          >
            −
          </button>
          <input
            id={`qty-${goal.id}`}
            type="number"
            min={1}
            max={99}
            value={goal.quantity}
            onClick={stopPropagation}
            onFocus={stopPropagation}
            onChange={(event) =>
              onQtyChange(Math.max(1, Math.min(99, Number(event.target.value) || 1)))
            }
            className="goal-card__qty-input"
          />
          <button
            className="goal-card__qty-btn"
            onClick={(event) => {
              stopPropagation(event);
              onQtyChange(Math.min(99, goal.quantity + 1));
            }}
            aria-label={t('Increase', 'Augmenter')}
          >
            +
          </button>
        </div>
      </div>
    </article>
  );
}

function RequiredMaterialsSection({ aggregated }: { aggregated: AggregatedResource[] }) {
  const { lang, t } = useI18n();

  if (aggregated.length === 0) {
    return <p className="planner__empty">{t('Add goals to see required materials.', 'Ajoutez des objectifs pour voir les materiaux requis.')}</p>;
  }

  return (
    <ul className="planner-materials" aria-label={t('Required materials', 'Materiaux requis')}>
      {aggregated.map((entry) => (
        <li key={entry.resourceName} className="planner-materials__item">
          <div className="planner-materials__main">
            <ResourceIcon name={entry.resourceName} size={16} />
            <span className="planner-materials__name">{entry.resourceName}</span>
            <span className="planner-materials__quality">
              {summarizeAssignedQualities(entry.assignedQualityValues, entry.unassignedSlotCount, lang)}
            </span>
          </div>
          <div className="planner-materials__meta">
            {entry.minRequiredQuality != null && (
              <span className="planner-materials__min">Min {entry.minRequiredQuality}</span>
            )}
            <span className="planner-materials__qty">×{entry.totalScu.toFixed(2)} SCU</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function BlueprintSourcesSection({
  sources,
  loading,
  error,
}: {
  sources: Array<{ blueprintName: string; contracts: MissionContract[] }>;
  loading: boolean;
  error: string | null;
}) {
  const { lang, t } = useI18n();

  if (loading) {
    return <p className="planner__empty">{t('Loading mission reward data…', 'Chargement des donnees missions…')}</p>;
  }

  if (error) {
    return <p className="planner__notice planner__notice--danger">{error}</p>;
  }

  if (sources.length === 0) {
    return <p className="planner__empty">{t('Add goals to inspect blueprint acquisition sources.', 'Ajoutez des objectifs pour consulter les sources des blueprints.')}</p>;
  }

  return (
    <div className="planner-sources">
      {sources.map((source) => (
        <article key={source.blueprintName} className="planner-sources__card">
          <div className="planner-sources__header">
            <h4 className="planner-sources__title">{source.blueprintName}</h4>
            <span className="planner-sources__count">
              {source.contracts.length} {t('contract', 'contrat')}{source.contracts.length > 1 ? 's' : ''}
            </span>
          </div>
          {source.contracts.length === 0 ? (
            <p className="planner__empty">{t('No matching blueprint reward contract found in the published dataset.', 'Aucun contrat correspondant n a ete trouve dans le dataset publie.')}</p>
          ) : (
            <ul className="planner-sources__list">
              {source.contracts.map((contract) => (
                <li
                  key={`${contract.contractFile ?? ''}-${contract.contractDebugName ?? ''}`}
                  className="planner-sources__item"
                >
                  <div className="planner-sources__item-head">
                    <span className="planner-sources__item-name">{contract.contractDebugName ?? 'Unknown contract'}</span>
                    <span className="planner-sources__item-scale">
                      {formatScaleLabel(contract.availability.derivedScale, lang)}
                    </span>
                  </div>
                  <p className="planner-sources__item-meta">
                    {(contract.contractorDisplayName ?? contract.faction?.displayName ?? 'Unknown')}
                    {' - '}
                    {formatLocations(contract, lang)}
                  </p>
                  <p className="planner-sources__item-meta">{formatStanding(contract, lang)}</p>
                </li>
              ))}
            </ul>
          )}
        </article>
      ))}
    </div>
  );
}

function ResourceAcquisitionNotes() {
  const { missionRewards, dismantlingData } = useCraft();
  const { t } = useI18n();
  const explicitCraftResourceRewards =
    missionRewards?.summary?.craftResourceRewardContractCount ?? 0;

  return (
    <div className="planner-notes">
      <p className="planner-notes__line">
        {explicitCraftResourceRewards > 0
          ? t(
              'This dataset includes explicit craft-resource contract rewards.',
              'Ce dataset inclut des recompenses explicites en ressources de craft.',
            )
          : t(
              'No explicit craft-resource contract rewards were found in the published contract data.',
              'Aucune recompense explicite en ressources de craft n a ete trouvee dans les contrats publies.',
            )}
      </p>
      {dismantlingData?.dismantling?.blueprint && (
        <p className="planner-notes__line">
          {t(
            `Dismantling is available globally at ${Math.round(dismantlingData.dismantling.blueprint.efficiency * 100)}% efficiency and ${dismantlingData.dismantling.blueprint.dismantleTimeSecs}s per job.`,
            `Le demontage est disponible globalement a ${Math.round(dismantlingData.dismantling.blueprint.efficiency * 100)}% d efficacite et ${dismantlingData.dismantling.blueprint.dismantleTimeSecs}s par job.`,
          )}
        </p>
      )}
      {dismantlingData?.dismantling?.perItemYieldModel?.resolved === false && (
        <p className="planner-notes__line">
          {t(
            'Exact dismantle yields per item remain unresolved in the current dataset.',
            'Les rendements exacts de demontage par item restent non resolus dans le dataset actuel.',
          )}
        </p>
      )}
    </div>
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
        contracts: findMissionContractsForBlueprint(missionRewards, goal.blueprintId),
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
        contracts: source.contracts.map((contract) => ({
          contractDebugName: contract.contractDebugName,
          contractorDisplayName: contract.contractorDisplayName,
          factionDisplayName: contract.faction?.displayName ?? null,
          availability: contract.availability,
          minimumRequiredStandings: contract.minimumRequiredStandings,
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
    <div className="planner-panel" aria-label={t('Resource planner', 'Planificateur de ressources')}>
      <header className="planner-panel__header">
        <p className="planner-panel__subtitle">
          {goalWord} · {aggregated.length} {t('material', 'materiau')}{aggregated.length !== 1 ? 'x' : ''}
        </p>
      </header>

      <div className="planner-panel__body">
        <section className="planner-panel__section">
          <h3 className="planner-panel__section-title">
            {t('Goals', 'Objectifs')}
            {goals.length > 0 && <span className="planner-panel__count">{goals.length}</span>}
          </h3>
          {goals.length === 0 ? (
            <p className="planner__empty">
              {t(
                'No goals yet. Simulate a craft and click "Add to Planner".',
                'Aucun objectif pour le moment. Simulez un craft puis cliquez sur "Ajouter au planificateur".',
              )}
            </p>
          ) : (
            <>
              {unavailableGoalCount > 0 && (
                <p className="planner__notice">
                  {t(
                    `${unavailableGoalCount} saved goal(s) are not available in the current ${activeChannel.toUpperCase()} dataset.`,
                    `${unavailableGoalCount} objectif(s) enregistres ne sont pas disponibles dans le dataset ${activeChannel.toUpperCase()} actif.`,
                  )}
                </p>
              )}
              <div className="goal-list">
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
              </div>
            </>
          )}
        </section>

        <section className="planner-panel__section">
          <h3 className="planner-panel__section-title">{t('Required Materials', 'Materiaux requis')}</h3>
          <RequiredMaterialsSection aggregated={aggregated} />
        </section>

        <section className="planner-panel__section">
          <h3 className="planner-panel__section-title">{t('Blueprint Sources', 'Sources des blueprints')}</h3>
          <BlueprintSourcesSection
            sources={goalSources}
            loading={missionRewardsLoading}
            error={missionRewardsError}
          />
        </section>

        <section className="planner-panel__section">
          <h3 className="planner-panel__section-title">{t('Resource Acquisition Notes', 'Notes d acquisition des ressources')}</h3>
          <ResourceAcquisitionNotes />
        </section>

        {goals.length > 0 && (
          <section className="planner-panel__section planner-export">
            <h3 className="planner-panel__section-title">{t('Export', 'Export')}</h3>
            <div className="planner-export__btns">
              <Button variant="ghost" size="sm" onClick={handleCopyText}>
                {t('Copy as text', 'Copier en texte')}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDownloadJSON}>
                {t('Download JSON', 'Telecharger JSON')}
              </Button>
            </div>
          </section>
        )}
      </div>

      {editingGoal && <GoalEditModal goal={editingGoal} onClose={() => setEditingGoalId(null)} />}
    </div>
  );
}
