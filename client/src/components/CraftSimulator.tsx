import { useMemo, useState } from 'react';
import { useCraft } from '../store/CraftContext';
import { useI18n, loc } from '../i18n/I18nContext';
import { useCraftSimulator, gppModifier } from '../hooks/useCraftSimulator';
import { CategoryBadge } from './ui/Badge';
import { Button } from './ui/Button';
import {
  QUALITY_PRESETS, QUALITY_PRESET_VALUE,
  GPP_TO_STAT, STAT_LABELS, STAT_LOWER_IS_BETTER,
  COMPARISON_COLORS,
  qualityValueToPreset, QUALITY_PRESET_LABEL,
} from '../types';
import type { MaterialSlot, ItemStats } from '../types';
import { ResourceIcon } from './ui/ResourceIcon';

// ─── Slot card with inline quality slider ─────────────────────────────────────
function SlotCard({ slot, qualityValue, onQualityChange }: {
  slot: MaterialSlot;
  qualityValue: number | undefined;
  onQualityChange: (v: number | undefined) => void;
}) {
  const { lang, t } = useI18n();
  const currentQ = qualityValue ?? 0;
  const isAssigned = qualityValue !== undefined;

  // Per-slot modifier percentages
  const modifiers = useMemo(() => {
    if (!isAssigned) return [];
    return slot.modifiers.map((mod) => {
      const statKey = GPP_TO_STAT[mod.gppId];
      if (!statKey) return null;
      const multiplier = gppModifier(mod.modAtMin, mod.modAtMax, qualityValue);
      const pct = (multiplier - 1) * 100;
      const label = STAT_LABELS[statKey]?.[lang] ?? String(statKey);
      const lowerIsBetter = STAT_LOWER_IS_BETTER.has(statKey);
      const isImproved = lowerIsBetter ? pct < 0 : pct > 0;
      return { statKey, label, pct, isImproved, isNeutral: Math.abs(pct) < 0.005 };
    }).filter(Boolean) as { statKey: string; label: string; pct: number; isImproved: boolean; isNeutral: boolean }[];
  }, [slot.modifiers, qualityValue, isAssigned, lang]);

  function handleSlider(v: number) {
    onQualityChange(v);
  }

  function handleNumInput(v: number) {
    onQualityChange(Math.max(0, Math.min(1000, v)));
  }

  return (
    <div className={['slot-card', isAssigned && 'slot-card--filled'].filter(Boolean).join(' ')}>
      <div className="slot-card__header">
        <ResourceIcon name={slot.requiredResource} size={20} />
        <h4 className="slot-card__name">{loc(slot.label, lang)}</h4>
        {slot.minQuality != null && slot.minQuality > 0 && (
          <span className="slot-card__min-q" title={t(`Min quality: ${slot.minQuality}`, `Qualité min: ${slot.minQuality}`)}>
            Min {slot.minQuality}
          </span>
        )}
      </div>

      <div className="slot-card__resource">
        <div className="slot-card__res-col">
          <span className="slot-card__label">{t('RESOURCE', 'RESSOURCE')}</span>
          <span className="slot-card__res-name">{slot.requiredResource}</span>
        </div>
        <div className="slot-card__res-col">
          <span className="slot-card__label">SCU</span>
          <span className="slot-card__res-val">{slot.quantityScu}</span>
        </div>
      </div>

      <div className="slot-card__quality">
        <div className="slot-card__quality-header">
          <span className="slot-card__label">{t('QUALITY ADJUSTMENT', 'AJUSTEMENT QUALITÉ')}</span>
          <span className="slot-card__quality-val">{currentQ}</span>
        </div>
        <div className="slot-card__quality-ctrl">
          <input
            type="range"
            className="slot-card__slider"
            min={0}
            max={1000}
            step={1}
            value={currentQ}
            onChange={(e) => handleSlider(Number(e.target.value))}
          />
          <input
            type="number"
            className="slot-card__num-input"
            min={0}
            max={1000}
            value={currentQ}
            onChange={(e) => handleNumInput(Number(e.target.value))}
          />
        </div>
      </div>

      {modifiers.length > 0 && (
        <div className="slot-card__modifiers">
          {modifiers.map((mod) => (
            <span
              key={mod.statKey}
              className={['slot-card__mod', !mod.isNeutral && (mod.isImproved ? 'slot-card__mod--better' : 'slot-card__mod--worse')].filter(Boolean).join(' ')}
            >
              {mod.label} <strong>{mod.pct > 0 ? '+' : ''}{mod.pct.toFixed(2)}%</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Quality score ring ───────────────────────────────────────────────────────
function QualityScore({ score }: { score: number }) {
  const { t } = useI18n();
  const tier = score >= 80 ? 'excellent' : score >= 50 ? 'good' : score >= 25 ? 'fair' : 'poor';
  const labels = {
    excellent: t('Excellent', 'Excellent'),
    good:      t('Good',      'Bon'),
    fair:      t('Fair',      'Moyen'),
    poor:      t('Poor',      'Insuffisant'),
  };
  return (
    <div className="quality-score" aria-label={`${t('Quality score', 'Score qualité')}: ${score}/100`}>
      <div className="quality-score__ring" style={{ '--score': score } as React.CSSProperties}>
        <svg viewBox="0 0 44 44" aria-hidden="true">
          <circle className="quality-score__track" cx="22" cy="22" r="18" />
          <circle
            className={`quality-score__fill quality-score__fill--${tier}`}
            cx="22" cy="22" r="18"
            strokeDasharray={`${(score / 100) * 113.1} 113.1`}
            strokeDashoffset="0"
          />
        </svg>
        <span className="quality-score__value">{score}</span>
      </div>
      <div className="quality-score__label">
        <span className="quality-score__title">{t('Quality score', 'Score qualité')}</span>
        <span className={`quality-score__tier quality-score__tier--${tier}`}>{labels[tier]}</span>
      </div>
    </div>
  );
}

// ─── Final combined modifiers ─────────────────────────────────────────────────
function CombinedModifiers({ blueprint, projectedStats }: {
  blueprint: { baseStats: Record<string, number> };
  projectedStats: ItemStats;
}) {
  const { lang, t } = useI18n();
  const statKeys = Object.keys(blueprint.baseStats) as (keyof ItemStats)[];

  const rows = statKeys.map((key) => {
    const base = blueprint.baseStats[key as string] ?? 0;
    const proj = projectedStats[key] ?? base;
    if (base === 0) return null;
    const pct = ((proj as number) / base - 1) * 100;
    const lowerIsBetter = STAT_LOWER_IS_BETTER.has(key);
    const isImproved = lowerIsBetter ? pct < 0 : pct > 0;
    const isNeutral = Math.abs(pct) < 0.005;
    const label = STAT_LABELS[key]?.[lang] ?? String(key);
    return { key, label, pct, isImproved, isNeutral };
  }).filter(Boolean) as { key: string; label: string; pct: number; isImproved: boolean; isNeutral: boolean }[];

  if (rows.length === 0) return null;

  return (
    <section className="combined-mods">
      <h3 className="combined-mods__title">
        <span aria-hidden="true">⚡</span> {t('Final Combined Modifiers', 'Modificateurs combinés')}
      </h3>
      <div className="combined-mods__list">
        {rows.map((row) => (
          <div key={row.key} className="combined-mods__row">
            <span className="combined-mods__stat">{row.label}</span>
            <span
              className={['combined-mods__val', !row.isNeutral && (row.isImproved ? 'combined-mods__val--better' : 'combined-mods__val--worse')].filter(Boolean).join(' ')}
            >
              {row.pct > 0 ? '+' : ''}{row.pct.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Resource summary ─────────────────────────────────────────────────────────
function ResourceSummary({ blueprint, slotAssignments }: {
  blueprint: { slots: MaterialSlot[] };
  slotAssignments: Record<string, number | undefined>;
}) {
  const { lang, t } = useI18n();

  const needed: Record<string, { resource: string; qualityLabel: string; totalScu: number }> = {};
  for (const slot of blueprint.slots) {
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
  if (entries.length === 0) return null;

  return (
    <section className="sim-resources">
      <h3 className="sim-resources__title">{t('Required Resources', 'Ressources nécessaires')}</h3>
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
    </section>
  );
}

// ─── Main simulator ───────────────────────────────────────────────────────────
export function CraftSimulator() {
  const {
    activeBlueprint, slotAssignments, assignQuality, clearAssignments,
    inventoryIds, toggleInventory, favoriteIds, toggleFavorite,
    addGoal, addToComparison, comparisonItems, openComparison,
  } = useCraft();
  const { t } = useI18n();
  const { qualityScore, projectedStats } = useCraftSimulator(activeBlueprint, slotAssignments);
  const [qty, setQty] = useState(1);

  function autoFill(mode: 'best' | 'worst') {
    if (!activeBlueprint) return;
    for (const slot of activeBlueprint.slots) {
      const minQ = slot.minQuality ?? 0;
      const valid = QUALITY_PRESETS.filter((p) => QUALITY_PRESET_VALUE[p] >= minQ);
      if (valid.length === 0) continue;
      const sorted = [...valid].sort((a, b) =>
        mode === 'best'
          ? QUALITY_PRESET_VALUE[b] - QUALITY_PRESET_VALUE[a]
          : QUALITY_PRESET_VALUE[a] - QUALITY_PRESET_VALUE[b],
      );
      assignQuality(slot.id, QUALITY_PRESET_VALUE[sorted[0]]);
    }
  }

  if (!activeBlueprint) {
    return (
      <section className="simulator simulator--empty" aria-label={t('Craft simulator', 'Simulateur de craft')}>
        <div className="simulator__empty-state">
          <span className="simulator__empty-icon" aria-hidden="true">◈</span>
          <h2 className="simulator__empty-title">
            {t('Select a blueprint', 'Sélectionner un blueprint')}
          </h2>
          <p className="simulator__empty-desc">
            {t(
              'Choose a blueprint from the explorer to start simulating a craft.',
              'Choisissez un blueprint dans l\'explorateur pour commencer à simuler un craft.',
            )}
          </p>
        </div>
      </section>
    );
  }

  const craftMins = Math.round(activeBlueprint.craftTimeSecs / 60);
  const isLooted = inventoryIds.includes(activeBlueprint.id);
  const isFavorite = favoriteIds.includes(activeBlueprint.id);
  const canAddToComparison = comparisonItems.length < 4;
  const nextColor = COMPARISON_COLORS[comparisonItems.length];

  return (
    <section className="simulator" aria-label={`${t('Simulator', 'Simulateur')} — ${activeBlueprint.name}`}>

      {/* ── Header ── */}
      <header className="simulator__header">
        <div className="simulator__meta">
          <CategoryBadge category={activeBlueprint.category} />
          <span className="simulator__craft-time">⏱ {craftMins}M</span>
        </div>
        <h2 className="simulator__bp-name">{activeBlueprint.name}</h2>
        <p className="simulator__bp-manufacturer">{activeBlueprint.manufacturer}</p>
        <div className="simulator__bp-actions">
          <button
            className={['sim-action-btn', isLooted && 'sim-action-btn--active'].filter(Boolean).join(' ')}
            onClick={() => toggleInventory(activeBlueprint.id)}
            aria-pressed={isLooted}
          >
            {isLooted ? <><span>◉</span> {t('Looted', 'Looté')}</> : <><span>◎</span> {t('Mark as looted', 'Marquer comme looté')}</>}
          </button>
          <button
            className={['sim-action-btn', isFavorite && 'sim-action-btn--fav sim-action-btn--active'].filter(Boolean).join(' ')}
            onClick={() => toggleFavorite(activeBlueprint.id)}
            aria-pressed={isFavorite}
          >
            {isFavorite ? '★' : '☆'} {isFavorite ? t('Favorited', 'Favori') : t('Favorite', 'Favori')}
          </button>
        </div>
      </header>

      {/* ── Quality score + controls ── */}
      <div className="simulator__score-row">
        <QualityScore score={qualityScore} />
        <div className="simulator__controls">
          <Button variant="ghost" size="sm" onClick={() => autoFill('best')}>
            {t('Best quality', 'Meilleure qualité')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => autoFill('worst')}>
            {t('Base quality', 'Qualité de base')}
          </Button>
          <Button variant="ghost" size="sm" onClick={clearAssignments}>
            {t('Clear', 'Effacer')}
          </Button>
        </div>
      </div>

      {/* ── Parts ── */}
      <h3 className="simulator__section-title">
        <span aria-hidden="true">⚙</span> {t('Parts', 'Composants')}
      </h3>

      <div className="simulator__slots">
        {activeBlueprint.slots.map((slot) => (
          <SlotCard
            key={slot.id}
            slot={slot}
            qualityValue={slotAssignments[slot.id]}
            onQualityChange={(v) => assignQuality(slot.id, v)}
          />
        ))}
      </div>

      {/* ── Final Combined Modifiers ── */}
      <CombinedModifiers blueprint={activeBlueprint} projectedStats={projectedStats} />

      {/* ── Required Resources ── */}
      <ResourceSummary blueprint={activeBlueprint} slotAssignments={slotAssignments} />

      {/* ── Actions ── */}
      <section className="simulator__actions">
        <div className="simulator__actions-row">
          <label htmlFor="sim-qty" className="simulator__qty-label">{t('Qty', 'Qté')}</label>
          <input
            id="sim-qty"
            type="number" min={1} max={99}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Math.min(99, Number(e.target.value))))}
            className="simulator__qty-input"
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
          style={{ position: 'relative', overflow: 'hidden' } as React.CSSProperties}
        >
          {canAddToComparison && (
            <span className="btn-compare__dot" style={{ background: nextColor }} aria-hidden="true" />
          )}
          ◈ {t('Compare', 'Comparer')}
          {!canAddToComparison && <span style={{ fontSize: '.7rem', marginLeft: 4, opacity: .6 }}>max 4</span>}
        </Button>
        {comparisonItems.length > 0 && (
          <button className="stats-panel__cmp-badge" onClick={openComparison}
            aria-label={`${t('Open comparison', 'Ouvrir la comparaison')} (${comparisonItems.length})`}>
            {comparisonItems.map((item) => (
              <span key={item.id} className="stats-panel__cmp-dot" style={{ background: item.color }} aria-hidden="true" />
            ))}
            <span>{comparisonItems.length} {t('in comparison', 'en comparaison')}</span>
          </button>
        )}
      </section>
    </section>
  );
}
