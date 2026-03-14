import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { useCraftSimulator } from '../hooks/useCraftSimulator';
import { getLocationsForResource } from '../data/farmLocations';
import { CategoryBadge } from './ui/Badge';
import { GameIcon } from './ui/GameIcon';
import type { GameIconName } from './ui/GameIcon';
import { Button } from './ui/Button';
import type { CraftGoal, AggregatedResource, FarmLocation, FarmActivityType, Lang, Quality } from '../types';
import { ACTIVITY_LABELS, EFFICIENCY_LABELS, GAME_QUALITY_NAMES, QUALITY_ORDER } from '../types';

const ACTIVITY_GAME_ICONS: Record<FarmActivityType, GameIconName> = {
  mining:  'mining-gadget',
  salvage: 'salvage',
  mission: 'computer',
  shop:    'shopping-cart',
};

// ─── Export helpers ───────────────────────────────────────────────────────────
function buildTextExport(goals: CraftGoal[], aggregated: AggregatedResource[], lang: Lang): string {
  const now = new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US');
  const lines: string[] = [];
  const h = (s: string) => `=== ${s} ===`;

  lines.push(lang === 'en' ? 'SC CRAFT — Farm Plan' : 'SC CRAFT — Plan de farm');
  lines.push(`${lang === 'en' ? 'Generated' : 'Généré le'}: ${now}`);
  lines.push('');

  lines.push(h(lang === 'en' ? 'GOALS' : 'OBJECTIFS'));
  for (const g of goals) {
    lines.push(`${g.quantity}× ${g.blueprintName}  (${lang === 'en' ? 'Score' : 'Score'}: ${g.qualityScore}/100)`);
  }
  lines.push('');

  lines.push(h(lang === 'en' ? 'RESOURCES NEEDED' : 'RESSOURCES NÉCESSAIRES'));
  for (const entry of aggregated) {
    lines.push(`  ${entry.resourceName} ${GAME_QUALITY_NAMES[entry.quality]} (${entry.quality}) ×${entry.totalScu.toFixed(2)} SCU`);
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
        lines.push(`  • ${loc.name} (${eff}) — ${entry.resourceName} ${entry.quality} ×${entry.totalScu.toFixed(2)} SCU`);
        lines.push(`    ${loc.description[lang]}`);
      }
    }
  }
  return lines.join('\n');
}

// ─── Goal edit modal ──────────────────────────────────────────────────────────
const QUALITY_TIERS: Quality[] = ['CMR', 'CMP', 'CMS'];

function GoalEditModal({ goal, onClose }: { goal: CraftGoal; onClose: () => void }) {
  const { blueprints, updateGoal } = useCraft();
  const { t } = useI18n();
  const bp = blueprints.find((blueprint) => blueprint.id === goal.blueprintId);
  const [assignments, setAssignments] = useState<Record<string, Quality | undefined>>({ ...goal.slotAssignments });
  const overlayRef = useRef<HTMLDivElement>(null);

  const { qualityScore, projectedStats } = useCraftSimulator(bp ?? null, assignments);

  // Focus trap & Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSave = () => {
    updateGoal(goal.id, assignments, qualityScore, projectedStats);
    onClose();
  };

  if (!bp) return null;

  return (
    <div
      className="goal-edit-overlay"
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
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
            const assigned = assignments[slot.id];
            return (
              <div key={slot.id} className="goal-edit__slot">
                <div className="goal-edit__slot-info">
                  <span className="goal-edit__slot-resource">{slot.requiredResource}</span>
                  <span className="goal-edit__slot-scu">{slot.quantityScu.toFixed(2)} SCU</span>
                </div>
                <div className="goal-edit__quality-btns" role="group" aria-label={`${t('Quality for', 'Qualité pour')} ${slot.requiredResource}`}>
                  <button
                    className={['goal-edit__q-btn', !assigned && 'goal-edit__q-btn--active goal-edit__q-btn--none'].filter(Boolean).join(' ')}
                    onClick={() => setAssignments((prev) => ({ ...prev, [slot.id]: undefined }))}
                    aria-pressed={!assigned}
                  >
                    —
                  </button>
                  {QUALITY_TIERS.map((q) => {
                    const isLocked = slot.minQuality != null && QUALITY_ORDER[q] < QUALITY_ORDER[slot.minQuality];
                    return (
                      <button
                        key={q}
                        className={[
                          'goal-edit__q-btn',
                          `goal-edit__q-btn--${q.toLowerCase()}`,
                          assigned === q && 'goal-edit__q-btn--active',
                        ].filter(Boolean).join(' ')}
                        onClick={() => !isLocked && setAssignments((prev) => ({ ...prev, [slot.id]: q }))}
                        disabled={isLocked}
                        aria-pressed={assigned === q}
                        title={isLocked ? t(`Min quality: ${slot.minQuality}`, `Qualité min: ${slot.minQuality}`) : undefined}
                      >
                        {q}
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
function GoalCard({ goal, onRemove, onQtyChange, onEdit }: {
  goal: CraftGoal;
  onRemove: () => void;
  onQtyChange: (qty: number) => void;
  onEdit: () => void;
}) {
  const { blueprints } = useCraft();
  const { t } = useI18n();
  const bp = blueprints.find((blueprint) => blueprint.id === goal.blueprintId);

  return (
    <article className="goal-card" aria-label={`${t('Goal', 'Objectif')}: ${goal.blueprintName}`}>
      <div className="goal-card__header">
        {bp && <CategoryBadge category={bp.category} iconOnly />}
        <div className="goal-card__info">
          <h4 className="goal-card__name">{goal.blueprintName}</h4>
          <span className="goal-card__score">
            {t('Score', 'Score')}: <strong>{goal.qualityScore}</strong>/100
          </span>
        </div>
        <div className="goal-card__actions">
          <button
            className="goal-card__edit"
            onClick={onEdit}
            aria-label={`${t('Edit', 'Modifier')} ${goal.blueprintName}`}
          >✎</button>
          <button
            className="goal-card__remove"
            onClick={onRemove}
            aria-label={`${t('Remove', 'Supprimer')} ${goal.blueprintName}`}
          >✕</button>
        </div>
      </div>

      <div className="goal-card__qty">
        <label htmlFor={`qty-${goal.id}`} className="goal-card__qty-label">
          {t('Qty', 'Qté')}
        </label>
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
            <GameIcon name={ACTIVITY_GAME_ICONS[activity]} size={20} shimmer />
            {ACTIVITY_LABELS[activity][lang]}
          </h4>

          <ul className="farm-plan__mats">
            {resources.map((e, i) => (
              <li key={i} className="farm-plan__mat-item">
                <span className="farm-plan__mat-name">
                  {e.resourceName}
                  <span className="farm-plan__mat-quality"> {GAME_QUALITY_NAMES[e.quality]} ({e.quality})</span>
                </span>
                <span className="farm-plan__mat-qty">×{e.totalScu.toFixed(2)} SCU</span>
              </li>
            ))}
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

// ─── Main drawer ──────────────────────────────────────────────────────────────
export function PlannerDrawer() {
  const { plannerOpen, closePlanner, goals, removeGoal, updateGoalQuantity, blueprints, activeChannel } = useCraft();
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const editingGoal = goals.find((g) => g.id === editingGoalId) ?? null;
  const { lang, t } = useI18n();
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const blueprintIds = useMemo(() => new Set(blueprints.map((blueprint) => blueprint.id)), [blueprints]);

  useEffect(() => { if (plannerOpen) closeBtnRef.current?.focus(); }, [plannerOpen]);
  useEffect(() => {
    if (!plannerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closePlanner(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [plannerOpen, closePlanner]);

  const aggregated = useMemo<AggregatedResource[]>(() => {
    // key: "resourceName|quality"
    const totals: Record<string, { resourceName: string; quality: string; totalScu: number }> = {};

    for (const goal of goals) {
      const bp = blueprints.find((blueprint) => blueprint.id === goal.blueprintId);
      if (!bp) continue;
      for (const slot of bp.slots) {
        const quality = goal.slotAssignments[slot.id];
        if (!quality) continue;
        const key = `${slot.requiredResource}|${quality}`;
        if (totals[key]) {
          totals[key].totalScu += slot.quantityScu * goal.quantity;
        } else {
          totals[key] = { resourceName: slot.requiredResource, quality, totalScu: slot.quantityScu * goal.quantity };
        }
      }
    }

    return Object.values(totals).map((entry) => {
      const quality = entry.quality as Quality;
      const locations = getLocationsForResource(entry.resourceName);
      return {
        resourceName: entry.resourceName,
        quality,
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
        quality: e.quality,
        totalScu: e.totalScu,
        bestLocation: e.locations[0]?.name ?? 'N/A',
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sc-craft-plan-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [goals, aggregated]);

  const goalWord = lang === 'en'
    ? `${goals.length} goal${goals.length !== 1 ? 's' : ''}`
    : `${goals.length} objectif${goals.length !== 1 ? 's' : ''}`;

  return (
    <>
      <div
        className={['planner-backdrop', plannerOpen && 'planner-backdrop--open'].filter(Boolean).join(' ')}
        onClick={closePlanner}
        aria-hidden="true"
      />
      <div
        className={['planner-drawer', plannerOpen && 'planner-drawer--open'].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-label={t('Resource planner', 'Planificateur de ressources')}
      >
        <header className="planner-drawer__header">
          <div>
            <h2 className="planner-drawer__title">{t('Planner', 'Planificateur')}</h2>
            <p className="planner-drawer__subtitle">
              {goalWord} · {aggregated.length} {t('resource', 'ressource')}{aggregated.length !== 1 && lang === 'fr' ? 's' : aggregated.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button ref={closeBtnRef} className="planner-drawer__close" onClick={closePlanner} aria-label={t('Close', 'Fermer')}>✕</button>
        </header>

        <div className="planner-drawer__body">
          {/* Goals */}
          <section>
            <h3 className="planner-drawer__section-title">
              {t('Goals', 'Objectifs')}
              {goals.length > 0 && <span className="planner-drawer__count">{goals.length}</span>}
            </h3>
            {goals.length === 0 ? (
              <p className="planner__empty">{t('No goals yet. Simulate a craft and click "Add to Planner".', 'Aucun objectif. Simulez un craft et cliquez sur "Ajouter au Planificateur".')}</p>
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
                  {goals.map((g) => (
                    <GoalCard key={g.id} goal={g} onRemove={() => removeGoal(g.id)} onQtyChange={(qty) => updateGoalQuantity(g.id, qty)} onEdit={() => setEditingGoalId(g.id)} />
                  ))}
                </div>
              </>
            )}
          </section>

          {/* Farm plan */}
          <section>
            <h3 className="planner-drawer__section-title">{t('Farm Plan', 'Plan de farm')}</h3>
            <FarmPlanSection aggregated={aggregated} />
          </section>

          {/* Export */}
          {goals.length > 0 && (
            <section className="planner-export">
              <h3 className="planner-drawer__section-title">{t('Export', 'Export')}</h3>
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
      </div>
      {editingGoal && (
        <GoalEditModal goal={editingGoal} onClose={() => setEditingGoalId(null)} />
      )}
    </>
  );
}
