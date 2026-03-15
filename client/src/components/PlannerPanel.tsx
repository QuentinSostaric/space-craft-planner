import { useMemo, useCallback, useState } from 'react';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { useCraftSimulator } from '../hooks/useCraftSimulator';
import { getLocationsForResource } from '../data/farmLocations';
import { CategoryBadge } from './ui/Badge';
import { GameIcon } from './ui/GameIcon';
import type { GameIconName } from './ui/GameIcon';
import { ResourceIcon } from './ui/ResourceIcon';
import { Button } from './ui/Button';
import type { CraftGoal, AggregatedResource, FarmLocation, FarmActivityType, Lang } from '../types';
import { ACTIVITY_LABELS, EFFICIENCY_LABELS, QUALITY_PRESETS, QUALITY_PRESET_VALUE, QUALITY_PRESET_LABEL, qualityValueToPreset } from '../types';

const ACTIVITY_GAME_ICONS: Record<FarmActivityType, GameIconName> = {
  mining:  'mining-gadget',
  salvage: 'salvage',
  mission: 'computer',
  shop:    'shopping-cart',
};

function buildTextExport(goals: CraftGoal[], aggregated: AggregatedResource[], lang: Lang): string {
  const now = new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US');
  const lines: string[] = [];
  const h = (s: string) => `=== ${s} ===`;

  lines.push(lang === 'en' ? 'ITEM FABRICATOR — Farm Plan' : 'ITEM FABRICATOR — Plan de farm');
  lines.push(`${lang === 'en' ? 'Generated' : 'Généré le'}: ${now}`);
  lines.push('');

  lines.push(h(lang === 'en' ? 'GOALS' : 'OBJECTIFS'));
  for (const g of goals) {
    lines.push(`${g.quantity}× ${g.blueprintName}  (Score: ${g.qualityScore}/100)`);
  }
  lines.push('');

  lines.push(h(lang === 'en' ? 'RESOURCES NEEDED' : 'RESSOURCES NÉCESSAIRES'));
  for (const entry of aggregated) {
    const preset = qualityValueToPreset(entry.qualityValue);
    const label = QUALITY_PRESET_LABEL[preset][lang];
    lines.push(`  ${entry.resourceName} ${label} (${entry.qualityValue}) ×${entry.totalScu.toFixed(2)} SCU`);
  }
  lines.push('');

  const byAct = aggregated.reduce<Record<FarmActivityType, AggregatedResource[]>>(
    (acc, e) => { (acc[e.bestActivity] ??= []).push(e); return acc; },
    {} as Record<FarmActivityType, AggregatedResource[]>,
  );
  lines.push(h(lang === 'en' ? 'FARM PLAN' : 'PLAN DE FARM'));
  for (const [act, resources] of Object.entries(byAct)) {
    lines.push('');
    lines.push(`[${ACTIVITY_LABELS[act as FarmActivityType][lang].toUpperCase()}]`);
    for (const entry of resources) {
      const loc = entry.locations[0];
      if (loc) {
        const eff = EFFICIENCY_LABELS[loc.efficiency][lang];
        const preset = qualityValueToPreset(entry.qualityValue);
        const label = QUALITY_PRESET_LABEL[preset][lang];
        lines.push(`  • ${loc.name} (${eff}) — ${entry.resourceName} ${label} ×${entry.totalScu.toFixed(2)} SCU`);
        lines.push(`    ${loc.description[lang]}`);
      }
    }
  }
  return lines.join('\n');
}

// ─── Goal edit modal ──────────────────────────────────────────────────────────
function GoalEditModal({ goal, onClose }: { goal: CraftGoal; onClose: () => void }) {
  const { blueprints, updateGoal } = useCraft();
  const { lang, t } = useI18n();
  const bp = blueprints.find((blueprint) => blueprint.id === goal.blueprintId);
  const [assignments, setAssignments] = useState<Record<string, number | undefined>>({ ...goal.slotAssignments });

  const { qualityScore, projectedStats } = useCraftSimulator(bp ?? null, assignments);

  const handleSave = () => {
    updateGoal(goal.id, assignments, qualityScore, projectedStats);
    onClose();
  };

  if (!bp) return null;

  return (
    <div
      className="goal-edit-overlay"
      onClick={(e) => { if (e.currentTarget === e.target) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={t(`Edit goal: ${goal.blueprintName}`, `Modifier: ${goal.blueprintName}`)}
    >
      <div className="goal-edit-modal">
        <header className="goal-edit-modal__header">
          <div className="goal-edit-modal__title-row">
            <CategoryBadge category={bp.category} iconOnly />
            <h3 className="goal-edit-modal__title">{goal.blueprintName}</h3>
          </div>
          <div className="goal-edit-modal__score">
            {t('Score', 'Score')}: <strong>{qualityScore}</strong>/100
          </div>
          <button className="goal-edit-modal__close" onClick={onClose} aria-label={t('Cancel', 'Annuler')}>✕</button>
        </header>

        <div className="goal-edit-modal__slots">
          {bp.slots.map((slot) => {
            const assignedValue = assignments[slot.id];
            return (
              <div key={slot.id} className="goal-edit__slot">
                <div className="goal-edit__slot-info">
                  <ResourceIcon name={slot.requiredResource} size={16} />
                  <span className="goal-edit__slot-resource">{slot.requiredResource}</span>
                  <span className="goal-edit__slot-scu">{slot.quantityScu.toFixed(2)} SCU</span>
                </div>
                <div className="goal-edit__quality-btns" role="group" aria-label={`${t('Quality for', 'Qualité pour')} ${slot.requiredResource}`}>
                  <button
                    className={['goal-edit__q-btn', assignedValue === undefined && 'goal-edit__q-btn--active goal-edit__q-btn--none'].filter(Boolean).join(' ')}
                    onClick={() => setAssignments((prev) => ({ ...prev, [slot.id]: undefined }))}
                    aria-pressed={assignedValue === undefined}
                  >
                    —
                  </button>
                  {QUALITY_PRESETS.map((preset) => {
                    const value = QUALITY_PRESET_VALUE[preset];
                    const label = QUALITY_PRESET_LABEL[preset][lang];
                    const isLocked = slot.minQuality != null && value < slot.minQuality;
                    const isActive = assignedValue === value;
                    return (
                      <button
                        key={preset}
                        className={['goal-edit__q-btn', `goal-edit__q-btn--${preset}`, isActive && 'goal-edit__q-btn--active'].filter(Boolean).join(' ')}
                        onClick={() => !isLocked && setAssignments((prev) => ({ ...prev, [slot.id]: value }))}
                        disabled={isLocked}
                        aria-pressed={isActive}
                        title={isLocked ? t(`Min quality: ${slot.minQuality}`, `Qualité min: ${slot.minQuality}`) : undefined}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <footer className="goal-edit-modal__footer">
          <Button variant="ghost" size="sm" onClick={onClose}>{t('Cancel', 'Annuler')}</Button>
          <Button variant="gradient" size="sm" onClick={handleSave}>{t('Save changes', 'Enregistrer')}</Button>
        </footer>
      </div>
    </div>
  );
}

// ─── Goal card ────────────────────────────────────────────────────────────────
function GoalCard({ goal, onRemove, onQtyChange, onEdit, onSelect, isActive }: {
  goal: CraftGoal;
  onRemove: () => void;
  onQtyChange: (qty: number) => void;
  onEdit: () => void;
  onSelect: () => void;
  isActive: boolean;
}) {
  const { blueprints } = useCraft();
  const { t } = useI18n();
  const bp = blueprints.find((blueprint) => blueprint.id === goal.blueprintId);

  return (
    <article
      className={['goal-card', isActive && 'goal-card--active'].filter(Boolean).join(' ')}
      aria-label={`${t('Goal', 'Objectif')}: ${goal.blueprintName}`}
      onClick={onSelect}
      style={{ cursor: 'pointer' }}
    >
      <div className="goal-card__header">
        {bp && <CategoryBadge category={bp.category} iconOnly />}
        <div className="goal-card__info">
          <h4 className="goal-card__name">{goal.blueprintName}</h4>
          <span className="goal-card__score">
            {t('Score', 'Score')}: <strong>{goal.qualityScore}</strong>/100
          </span>
        </div>
        <div className="goal-card__actions">
          <button className="goal-card__edit" onClick={onEdit} aria-label={`${t('Edit', 'Modifier')} ${goal.blueprintName}`}>✎</button>
          <button className="goal-card__remove" onClick={onRemove} aria-label={`${t('Remove', 'Supprimer')} ${goal.blueprintName}`}>✕</button>
        </div>
      </div>

      <div className="goal-card__qty">
        <label htmlFor={`qty-${goal.id}`} className="goal-card__qty-label">{t('Qty', 'Qté')}</label>
        <div className="goal-card__qty-ctrl">
          <button className="goal-card__qty-btn" onClick={() => onQtyChange(Math.max(1, goal.quantity - 1))} aria-label={t('Decrease', 'Réduire')}>−</button>
          <input
            id={`qty-${goal.id}`}
            type="number" min={1} max={99}
            value={goal.quantity}
            onChange={(e) => onQtyChange(Math.max(1, Math.min(99, Number(e.target.value))))}
            className="goal-card__qty-input"
          />
          <button className="goal-card__qty-btn" onClick={() => onQtyChange(Math.min(99, goal.quantity + 1))} aria-label={t('Increase', 'Augmenter')}>+</button>
        </div>
      </div>
    </article>
  );
}

// ─── Farm plan ────────────────────────────────────────────────────────────────
function FarmPlanSection({ aggregated }: { aggregated: AggregatedResource[] }) {
  const { lang, t } = useI18n();
  const effOrder = { high: 0, medium: 1, low: 2 };
  if (aggregated.length === 0) {
    return <p className="planner__empty">{t('Add goals to generate a farm plan.', 'Ajoutez des objectifs pour générer un plan de farm.')}</p>;
  }

  const byActivity = aggregated.reduce<Record<FarmActivityType, AggregatedResource[]>>(
    (acc, e) => { (acc[e.bestActivity] ??= []).push(e); return acc; },
    {} as Record<FarmActivityType, AggregatedResource[]>,
  );

  const groups = Object.entries(byActivity).map(([activity, resources]) => {
    const locIds = new Set<string>();
    const locs: FarmLocation[] = [];
    for (const res of resources) {
      for (const loc of res.locations) {
        if (loc.type === activity && !locIds.has(loc.id)) { locIds.add(loc.id); locs.push(loc); }
      }
    }
    locs.sort((a, b) => effOrder[a.efficiency] - effOrder[b.efficiency]);
    return { activity: activity as FarmActivityType, resources, locations: locs };
  });

  return (
    <div className="farm-plan">
      {groups.map(({ activity, resources, locations }) => (
        <section key={activity} className="farm-plan__activity">
          <h4 className="farm-plan__activity-title">
            <GameIcon name={ACTIVITY_GAME_ICONS[activity]} size={20} />
            {ACTIVITY_LABELS[activity][lang]}
          </h4>
          <ul className="farm-plan__mats">
            {resources.map((e, i) => {
              const preset = qualityValueToPreset(e.qualityValue);
              const label = QUALITY_PRESET_LABEL[preset][lang];
              return (
                <li key={i} className="farm-plan__mat-item">
                  <ResourceIcon name={e.resourceName} size={14} />
                  <span className="farm-plan__mat-name">
                    {e.resourceName}
                    <span className="farm-plan__mat-quality"> {label}</span>
                  </span>
                  <span className="farm-plan__mat-qty">×{e.totalScu.toFixed(2)} SCU</span>
                </li>
              );
            })}
          </ul>
          {locations.length > 0 && (
            <ul className="farm-plan__locs">
              {locations.map((loc) => (
                <li key={loc.id} className="farm-plan__loc">
                  <div className="farm-plan__loc-header">
                    <span className="farm-plan__loc-name">{loc.name}</span>
                    <span className={`farm-plan__loc-eff farm-plan__loc-eff--${loc.efficiency}`}>
                      {EFFICIENCY_LABELS[loc.efficiency][lang]}
                    </span>
                  </div>
                  <span className="farm-plan__loc-body">{loc.system}{loc.body ? ` · ${loc.body}` : ''}</span>
                  <p className="farm-plan__loc-desc">{loc.description[lang]}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────
export function PlannerPanel() {
  const { goals, removeGoal, updateGoalQuantity, selectGoalBlueprint, activeBlueprint, blueprints, activeChannel } = useCraft();
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const editingGoal = goals.find((g) => g.id === editingGoalId) ?? null;
  const { lang, t } = useI18n();

  const blueprintIds = useMemo(() => new Set(blueprints.map((bp) => bp.id)), [blueprints]);

  const aggregated = useMemo<AggregatedResource[]>(() => {
    const totals: Record<string, { resourceName: string; qualityValue: number; totalScu: number }> = {};
    for (const goal of goals) {
      const bp = blueprints.find((blueprint) => blueprint.id === goal.blueprintId);
      if (!bp) continue;
      for (const slot of bp.slots) {
        const qualityValue = goal.slotAssignments[slot.id];
        if (qualityValue === undefined) continue;
        const key = `${slot.requiredResource}|${qualityValue}`;
        if (totals[key]) {
          totals[key].totalScu += slot.quantityScu * goal.quantity;
        } else {
          totals[key] = { resourceName: slot.requiredResource, qualityValue, totalScu: slot.quantityScu * goal.quantity };
        }
      }
    }
    return Object.values(totals).map((entry) => {
      const locations = getLocationsForResource(entry.resourceName);
      return {
        resourceName: entry.resourceName,
        qualityValue: entry.qualityValue,
        totalScu: entry.totalScu,
        locations,
        bestActivity: locations[0]?.type ?? 'shop',
      } satisfies AggregatedResource;
    }).sort((a, b) => b.totalScu - a.totalScu);
  }, [blueprints, goals]);

  const unavailableGoalCount = useMemo(
    () => goals.filter((goal) => !blueprintIds.has(goal.blueprintId)).length,
    [blueprintIds, goals],
  );

  const handleCopyText = useCallback(() => {
    const text = buildTextExport(goals, aggregated, lang);
    navigator.clipboard.writeText(text).catch(() => {});
  }, [goals, aggregated, lang]);

  const handleDownloadJSON = useCallback(() => {
    const data = {
      exportedAt: new Date().toISOString(),
      goals: goals.map((g) => ({ name: g.blueprintName, quantity: g.quantity, qualityScore: g.qualityScore })),
      resources: aggregated.map((e) => ({
        name: e.resourceName,
        qualityValue: e.qualityValue,
        totalScu: e.totalScu,
        bestLocation: e.locations[0]?.name ?? 'N/A',
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `item-fabricator-plan-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [goals, aggregated]);

  const goalWord = lang === 'en'
    ? `${goals.length} goal${goals.length !== 1 ? 's' : ''}`
    : `${goals.length} objectif${goals.length !== 1 ? 's' : ''}`;

  return (
    <aside className="planner-panel" aria-label={t('Resource planner', 'Planificateur de ressources')}>
      <header className="planner-panel__header">
        <h2 className="planner-panel__title">{t('Planner', 'Planificateur')}</h2>
        <p className="planner-panel__subtitle">
          {goalWord} · {aggregated.length} {t('resource', 'ressource')}{aggregated.length !== 1 ? 's' : ''}
        </p>
      </header>

      <div className="planner-panel__body">
        {/* Goals */}
        <section className="planner-panel__section">
          <h3 className="planner-panel__section-title">
            {t('Goals', 'Objectifs')}
            {goals.length > 0 && <span className="planner-panel__count">{goals.length}</span>}
          </h3>
          {goals.length === 0 ? (
            <p className="planner__empty">
              {t(
                'No goals yet. Simulate a craft and click "Add to Planner".',
                'Aucun objectif. Simulez un craft et cliquez sur "Ajouter au Planificateur".',
              )}
            </p>
          ) : (
            <>
              {unavailableGoalCount > 0 && (
                <p className="planner__notice">
                  {t(
                    `${unavailableGoalCount} saved goal(s) are not available in the current ${activeChannel.toUpperCase()} dataset.`,
                    `${unavailableGoalCount} objectif(s) enregistrés ne sont pas disponibles dans le dataset ${activeChannel.toUpperCase()} actif.`,
                  )}
                </p>
              )}
              <div className="goal-list">
                {goals.map((g) => (
                  <GoalCard
                    key={g.id}
                    goal={g}
                    isActive={activeBlueprint?.id === g.blueprintId}
                    onRemove={() => removeGoal(g.id)}
                    onQtyChange={(qty) => updateGoalQuantity(g.id, qty)}
                    onEdit={() => setEditingGoalId(g.id)}
                    onSelect={() => selectGoalBlueprint(g.id)}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        {/* Farm plan */}
        <section className="planner-panel__section">
          <h3 className="planner-panel__section-title">{t('Farm Plan', 'Plan de farm')}</h3>
          <FarmPlanSection aggregated={aggregated} />
        </section>

        {/* Export */}
        {goals.length > 0 && (
          <section className="planner-panel__section planner-export">
            <h3 className="planner-panel__section-title">{t('Export', 'Export')}</h3>
            <div className="planner-export__btns">
              <Button variant="ghost" size="sm" onClick={handleCopyText} icon="📋">
                {t('Copy as text', 'Copier en texte')}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDownloadJSON} icon="⬇">
                {t('Download JSON', 'Télécharger JSON')}
              </Button>
            </div>
          </section>
        )}
      </div>

      {editingGoal && (
        <GoalEditModal goal={editingGoal} onClose={() => setEditingGoalId(null)} />
      )}
    </aside>
  );
}
