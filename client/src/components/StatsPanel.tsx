import { useState } from 'react';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { useCraftSimulator } from '../hooks/useCraftSimulator';
import { STAT_LABELS, STAT_UNITS, STAT_LOWER_IS_BETTER, COMPARISON_COLORS, qualityValueToPreset, QUALITY_PRESET_LABEL } from '../types';
import type { ItemStats } from '../types';
import { Button } from './ui/Button';
import { ResourceIcon } from './ui/ResourceIcon';

interface StatBarProps {
  label: string;
  unit: string;
  baseValue: number;
  projValue: number;
  lowerIsBetter: boolean;
  maxValue: number;
}

function StatBar({ label, unit, baseValue, projValue, lowerIsBetter, maxValue }: StatBarProps) {
  const basePct = Math.min((baseValue / maxValue) * 100, 100);
  const projPct = Math.min((projValue / maxValue) * 100, 100);
  const delta = projValue - baseValue;
  const isImproved = lowerIsBetter ? delta < 0 : delta > 0;
  const isNeutral = delta === 0;
  const diffLabel = isNeutral
    ? null
    : `${delta > 0 ? '+' : ''}${Math.abs(delta) < 1 ? delta.toFixed(2) : Math.round(delta)} ${unit}`;

  return (
    <div className="stat-bar" role="group" aria-label={`${label}: ${baseValue} → ${projValue} ${unit}`}>
      <div className="stat-bar__header">
        <span className="stat-bar__label">{label}</span>
        {diffLabel && (
          <span className={['stat-bar__delta', isImproved ? 'stat-bar__delta--better' : 'stat-bar__delta--worse'].join(' ')}>
            {diffLabel}
          </span>
        )}
      </div>
      <div className="stat-bar__rows" aria-hidden="true">
        <div className="stat-bar__row">
          <span className="stat-bar__row-lbl">Base</span>
          <div className="stat-bar__track">
            <div className="stat-bar__fill stat-bar__fill--base" style={{ width: `${basePct}%` }} />
          </div>
          <span className="stat-bar__row-val">{baseValue} {unit}</span>
        </div>
        <div className="stat-bar__row">
          <span className="stat-bar__row-lbl">Craft</span>
          <div className="stat-bar__track">
            <div
              className={['stat-bar__fill', isImproved ? 'stat-bar__fill--better' : isNeutral ? 'stat-bar__fill--proj' : 'stat-bar__fill--worse'].join(' ')}
              style={{ width: `${projPct}%` }}
            />
          </div>
          <span className={['stat-bar__row-val', !isNeutral && (isImproved ? 'stat-bar__row-val--better' : 'stat-bar__row-val--worse')].filter(Boolean).join(' ')}>
            {projValue} {unit}
          </span>
        </div>
      </div>
    </div>
  );
}

function ResourceSummary() {
  const { activeBlueprint, slotAssignments } = useCraft();
  const { lang, t } = useI18n();
  if (!activeBlueprint) return null;

  // Aggregate: resource name + quality value → total SCU
  const needed: Record<string, { resource: string; qualityLabel: string; totalScu: number }> = {};
  for (const slot of activeBlueprint.slots) {
    const qualityValue = slotAssignments[slot.id];
    if (qualityValue == null || qualityValue === 0) continue;
    const key = `${slot.requiredResource}|${qualityValue}`;
    if (needed[key]) {
      needed[key].totalScu += slot.quantityScu;
    } else {
      const preset = qualityValueToPreset(qualityValue);
      needed[key] = {
        resource: slot.requiredResource,
        qualityLabel: QUALITY_PRESET_LABEL[preset][lang],
        totalScu: slot.quantityScu,
      };
    }
  }

  const entries = Object.values(needed);
  if (entries.length === 0) return (
    <p className="stats-panel__res-empty">
      {t('Assign quality to slots to see required resources.', 'Assignez une qualité aux slots pour voir les ressources nécessaires.')}
    </p>
  );

  return (
    <ul className="res-list" aria-label={t('Required resources', 'Ressources nécessaires')}>
      {entries.map((info, i) => (
        <li key={i} className="res-item">
          <ResourceIcon name={info.resource} size={16} />
          <span className="res-item__name">{info.resource}</span>
          <span className="res-item__quality">{info.qualityLabel}</span>
          <span className="res-item__qty">×{info.totalScu.toFixed(2)} SCU</span>
        </li>
      ))}
    </ul>
  );
}

export function StatsPanel() {
  const { activeBlueprint, slotAssignments, addGoal, addToComparison, comparisonItems, openComparison } = useCraft();
  const { lang, t } = useI18n();
  const { projectedStats, qualityScore } = useCraftSimulator(activeBlueprint, slotAssignments);
  const [qty, setQty] = useState(1);

  if (!activeBlueprint) {
    return (
      <aside className="stats-panel stats-panel--empty" aria-label={t('Stats panel', 'Panneau de statistiques')}>
        <div className="stats-panel__empty">
          <span aria-hidden="true">◈</span>
          <p>{t('Stats will appear here once a blueprint is selected.', 'Les statistiques s\'afficheront ici une fois un blueprint sélectionné.')}</p>
        </div>
      </aside>
    );
  }

  const statKeys = Object.keys(activeBlueprint.baseStats) as (keyof ItemStats)[];
  const maxValues: Partial<Record<keyof ItemStats, number>> = {};
  for (const key of statKeys) {
    const base = activeBlueprint.baseStats[key as string] ?? 0;
    const proj = projectedStats[key] ?? 0;
    maxValues[key] = Math.max(base, proj) * 1.1;
  }

  const canAddToComparison = comparisonItems.length < 4;
  const nextColor = COMPARISON_COLORS[comparisonItems.length];

  return (
    <aside className="stats-panel" aria-label={`${t('Stats', 'Statistiques')} — ${activeBlueprint.name}`}>
      <div className="stats-panel__titlebar">
        <h2 className="stats-panel__title">{t('Stats', 'Statistiques')}</h2>
        {comparisonItems.length > 0 && (
          <button
            className="stats-panel__cmp-badge"
            onClick={openComparison}
            aria-label={`${t('Open comparison', 'Ouvrir la comparaison')} (${comparisonItems.length} items)`}
          >
            {comparisonItems.map((item) => (
              <span key={item.id} className="stats-panel__cmp-dot" style={{ background: item.color }} aria-hidden="true" />
            ))}
            <span>{comparisonItems.length}</span>
          </button>
        )}
      </div>

      {/* Stat bars */}
      <section className="stats-panel__stats" aria-label={t('Stats comparison', 'Comparaison des statistiques')}>
        {statKeys.map((key) => {
          const base = activeBlueprint.baseStats[key as string] ?? 0;
          const proj = projectedStats[key] ?? base;
          const label = STAT_LABELS[key]?.[lang] ?? String(key);
          const unit = STAT_UNITS[key] ?? '';
          return (
            <StatBar
              key={key}
              label={label}
              unit={unit}
              baseValue={base}
              projValue={typeof proj === 'number' ? proj : base}
              lowerIsBetter={STAT_LOWER_IS_BETTER.has(key)}
              maxValue={maxValues[key] ?? 1}
            />
          );
        })}
      </section>

      {/* Resources */}
      <section className="stats-panel__resources">
        <h3 className="stats-panel__section-title">{t('Required resources', 'Ressources nécessaires')}</h3>
        <ResourceSummary />
      </section>

      {/* Actions */}
      <section className="stats-panel__goal">
        <h3 className="stats-panel__section-title">{t('Actions', 'Actions')}</h3>

        <div className="stats-panel__goal-row">
          <label htmlFor="goal-qty" className="stats-panel__qty-label">
            {t('Qty', 'Qté')}
          </label>
          <input
            id="goal-qty"
            type="number"
            min={1} max={99}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Math.min(99, Number(e.target.value))))}
            className="stats-panel__qty-input"
            aria-label={t('Number of copies to craft', 'Nombre d\'exemplaires à crafter')}
          />
        </div>
        <Button
          variant="gradient" size="md" fullWidth
          onClick={() => addGoal(qualityScore, projectedStats, qty)}
        >
          📋 {t('Add to Planner', 'Ajouter au Planificateur')}
        </Button>

        <Button
          variant="secondary" size="md" fullWidth
          onClick={() => addToComparison(qualityScore, projectedStats)}
          disabled={!canAddToComparison}
          aria-label={
            canAddToComparison
              ? t('Add current build to comparison', 'Ajouter ce build à la comparaison')
              : t('Comparison full (max 4)', 'Comparaison complète (max 4)')
          }
          style={{ marginTop: 'var(--sp-2)', position: 'relative', overflow: 'hidden' } as React.CSSProperties}
        >
          {canAddToComparison && (
            <span
              className="btn-compare__dot"
              style={{ background: nextColor }}
              aria-hidden="true"
            />
          )}
          ◈ {t('Compare', 'Comparer')}
          {!canAddToComparison && <span style={{ fontSize: '.7rem', marginLeft: 4, opacity: .6 }}>max 4</span>}
        </Button>
      </section>
    </aside>
  );
}
