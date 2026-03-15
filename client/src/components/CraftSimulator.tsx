import { useEffect, useMemo, useState } from 'react';
import { useCraft } from '../store/CraftContext';
import { useI18n, loc } from '../i18n/I18nContext';
import { useCraftSimulator, gppModifier } from '../hooks/useCraftSimulator';
import { CategoryBadge } from './ui/Badge';
import { Button } from './ui/Button';
import {
  COMPARISON_COLORS,
  GPP_LABELS,
  STAT_LABELS,
  STAT_LOWER_IS_BETTER,
} from '../types';
import type { AggregatedResource, ItemStats, MaterialSlot, MissionContract } from '../types';
import {
  aggregateBlueprintResources,
  clampQualityValue,
  findMissionContractsForBlueprint,
  formatLocations,
  formatScaleLabel,
  formatStanding,
  summarizeAssignedQualities,
} from '../utils/crafting';
import { ResourceIcon } from './ui/ResourceIcon';

function SlotCard({
  slot,
  qualityValue,
  onQualityChange,
}: {
  slot: MaterialSlot;
  qualityValue: number | undefined;
  onQualityChange: (value: number | undefined) => void;
}) {
  const { lang, t } = useI18n();
  const currentQuality = qualityValue ?? 0;
  const isAssigned = qualityValue !== undefined;

  const modifiers = useMemo(() => {
    if (!isAssigned || qualityValue === undefined) {
      return [];
    }

    return slot.modifiers
      .map((modifier) => {
        const label = GPP_LABELS[modifier.gppId]?.[lang] ?? modifier.gppId;
        const multiplier = gppModifier(modifier.modAtMin, modifier.modAtMax, qualityValue);
        const pct = (multiplier - 1) * 100;
        const lowerIsBetter = modifier.gppId.includes('Recoil');
        const isImproved = lowerIsBetter ? pct < 0 : pct > 0;

        return {
          gppId: modifier.gppId,
          label,
          pct,
          isImproved,
          isNeutral: Math.abs(pct) < 0.005,
        };
      })
      .filter(Boolean);
  }, [isAssigned, lang, qualityValue, slot.modifiers]);

  return (
    <div className={['slot-card', isAssigned && 'slot-card--filled'].filter(Boolean).join(' ')}>
      <div className="slot-card__header">
        <ResourceIcon name={slot.requiredResource} size={20} />
        <h4 className="slot-card__name">{loc(slot.label, lang)}</h4>
        {slot.minQuality != null && slot.minQuality > 0 && (
          <span
            className="slot-card__min-q"
            title={t(`Minimum quality ${slot.minQuality}`, `Qualite minimale ${slot.minQuality}`)}
          >
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
          <span className="slot-card__label">{t('ASSIGNED QUALITY', 'QUALITE ASSIGNEE')}</span>
          <span className="slot-card__quality-val">
            {isAssigned ? Math.round(currentQuality) : t('None', 'Aucune')}
          </span>
        </div>
        <div className="slot-card__quality-ctrl">
          <input
            type="range"
            className="slot-card__slider"
            min={0}
            max={1000}
            step={1}
            value={currentQuality}
            onChange={(event) => onQualityChange(clampQualityValue(Number(event.target.value)))}
            aria-label={t(
              `Quality slider for ${slot.requiredResource}`,
              `Curseur de qualite pour ${slot.requiredResource}`,
            )}
          />
          <input
            type="number"
            className="slot-card__num-input"
            min={0}
            max={1000}
            value={currentQuality}
            onChange={(event) => onQualityChange(clampQualityValue(Number(event.target.value)))}
            aria-label={t(
              `Quality value for ${slot.requiredResource}`,
              `Valeur de qualite pour ${slot.requiredResource}`,
            )}
          />
          <button
            className="slot-card__clear-btn"
            onClick={() => onQualityChange(undefined)}
            aria-label={t(
              `Clear quality for ${slot.requiredResource}`,
              `Effacer la qualite pour ${slot.requiredResource}`,
            )}
          >
            {t('Clear', 'Effacer')}
          </button>
        </div>
      </div>

      {modifiers.length > 0 && (
        <div className="slot-card__modifiers">
          {modifiers.map((modifier) => (
            <span
              key={modifier.gppId}
              className={[
                'slot-card__mod',
                !modifier.isNeutral &&
                  (modifier.isImproved ? 'slot-card__mod--better' : 'slot-card__mod--worse'),
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {modifier.label} <strong>{modifier.pct > 0 ? '+' : ''}{modifier.pct.toFixed(2)}%</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function QualityScore({ score }: { score: number }) {
  const { t } = useI18n();
  const tier = score >= 80 ? 'excellent' : score >= 50 ? 'good' : score >= 25 ? 'fair' : 'poor';
  const labels = {
    excellent: t('Excellent', 'Excellent'),
    good: t('Good', 'Bon'),
    fair: t('Fair', 'Moyen'),
    poor: t('Poor', 'Faible'),
  };

  return (
    <div className="quality-score" aria-label={`${t('Build index', 'Indice de build')}: ${score}/100`}>
      <div className="quality-score__ring" style={{ '--score': score } as React.CSSProperties}>
        <svg viewBox="0 0 44 44" aria-hidden="true">
          <circle className="quality-score__track" cx="22" cy="22" r="18" />
          <circle
            className={`quality-score__fill quality-score__fill--${tier}`}
            cx="22"
            cy="22"
            r="18"
            strokeDasharray={`${(score / 100) * 113.1} 113.1`}
            strokeDashoffset="0"
          />
        </svg>
        <span className="quality-score__value">{score}</span>
      </div>
      <div className="quality-score__label">
        <span className="quality-score__title">{t('Build index', 'Indice de build')}</span>
        <span className={`quality-score__tier quality-score__tier--${tier}`}>{labels[tier]}</span>
      </div>
    </div>
  );
}

function CombinedModifiers({
  blueprint,
  projectedStats,
}: {
  blueprint: { baseStats: ItemStats };
  projectedStats: ItemStats;
}) {
  const { lang, t } = useI18n();
  const statKeys = Object.keys(blueprint.baseStats) as (keyof ItemStats)[];

  const rows = statKeys
    .map((key) => {
      const base = blueprint.baseStats[key] ?? 0;
      const projected = projectedStats[key] ?? base;
      if (base === 0) {
        return null;
      }

      const pct = ((projected as number) / base - 1) * 100;
      const isImproved = STAT_LOWER_IS_BETTER.has(key) ? pct < 0 : pct > 0;

      return {
        key,
        label: STAT_LABELS[key]?.[lang] ?? String(key),
        pct,
        isImproved,
        isNeutral: Math.abs(pct) < 0.005,
      };
    })
    .filter(Boolean) as Array<{
      key: keyof ItemStats;
      label: string;
      pct: number;
      isImproved: boolean;
      isNeutral: boolean;
    }>;

  if (rows.length === 0) {
    return null;
  }

  return (
    <section className="combined-mods">
      <h3 className="combined-mods__title">
        <span aria-hidden="true">⚡</span> {t('Final Combined Modifiers', 'Modificateurs combines')}
      </h3>
      <div className="combined-mods__list">
        {rows.map((row) => (
          <div key={row.key} className="combined-mods__row">
            <span className="combined-mods__stat">{row.label}</span>
            <span
              className={[
                'combined-mods__val',
                !row.isNeutral &&
                  (row.isImproved ? 'combined-mods__val--better' : 'combined-mods__val--worse'),
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {row.pct > 0 ? '+' : ''}
              {row.pct.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ResourceSummary({ entries }: { entries: AggregatedResource[] }) {
  const { lang, t } = useI18n();

  if (entries.length === 0) {
    return null;
  }

  return (
    <section className="sim-resources">
      <h3 className="sim-resources__title">{t('Required Resources', 'Ressources necessaires')}</h3>
      <ul className="res-list" aria-label={t('Required resources', 'Ressources necessaires')}>
        {entries.map((entry) => (
          <li key={entry.resourceName} className="res-item">
            <ResourceIcon name={entry.resourceName} size={16} />
            <span className="res-item__name">{entry.resourceName}</span>
            <span className="res-item__quality">
              {summarizeAssignedQualities(entry.assignedQualityValues, entry.unassignedSlotCount, lang)}
            </span>
            <span className="res-item__qty">×{entry.totalScu.toFixed(2)} SCU</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AcquisitionSources({
  contracts,
  loading,
}: {
  contracts: MissionContract[];
  loading: boolean;
}) {
  const { lang, t } = useI18n();
  const [open, setOpen] = useState(contracts.length > 0);

  useEffect(() => {
    setOpen(contracts.length > 0);
  }, [contracts.length]);

  if (loading) {
    return (
      <div className="acq-sources">
        <p className="acq-sources__loading">{t('Loading mission data...', 'Chargement des missions...')}</p>
      </div>
    );
  }

  return (
    <div className="acq-sources">
      <button
        className="acq-sources__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="acq-sources__toggle-icon" aria-hidden="true">{open ? '▾' : '▸'}</span>
        <span className="acq-sources__toggle-label">
          {t('Mission Sources', 'Sources de missions')}
        </span>
        <span className="acq-sources__toggle-count">
          {contracts.length > 0
            ? `${contracts.length} ${t('contract', 'contrat')}${contracts.length > 1 ? 's' : ''}`
            : t('None', 'Aucune')}
        </span>
      </button>
      {open && (
        <div className="acq-sources__body">
          {contracts.length === 0 ? (
            <p className="acq-sources__empty">
              {t(
                'No known contract reward for this blueprint.',
                'Aucune recompense de contrat connue pour ce blueprint.',
              )}
            </p>
          ) : (
            <ul className="acq-sources__list">
              {contracts.map((contract) => (
                <li
                  key={`${contract.contractFile ?? ''}-${contract.contractDebugName ?? ''}`}
                  className="acq-sources__item"
                >
                  <div className="acq-sources__item-head">
                    <span className="acq-sources__item-name">
                      {contract.contractDebugName ?? 'Unknown contract'}
                    </span>
                    <span className="acq-sources__item-scale">
                      {formatScaleLabel(contract.availability.derivedScale, lang)}
                    </span>
                  </div>
                  <p className="acq-sources__item-meta">
                    {contract.contractorDisplayName ?? contract.faction?.displayName ?? 'Unknown'}
                    {' - '}
                    {formatLocations(contract, lang)}
                  </p>
                  <p className="acq-sources__item-meta">{formatStanding(contract, lang)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function CraftSimulator() {
  const {
    activeBlueprint,
    slotAssignments,
    assignQuality,
    clearAssignments,
    inventoryIds,
    toggleInventory,
    favoriteIds,
    toggleFavorite,
    addGoal,
    addToComparison,
    comparisonItems,
    openComparison,
    missionRewards,
    missionRewardsLoading,
    ensureMissionRewardsLoaded,
  } = useCraft();
  const { t } = useI18n();
  const { qualityScore, projectedStats } = useCraftSimulator(activeBlueprint, slotAssignments);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (activeBlueprint) {
      void ensureMissionRewardsLoaded();
    }
  }, [activeBlueprint, ensureMissionRewardsLoaded]);

  const acquisitionContracts = useMemo(
    () => activeBlueprint ? findMissionContractsForBlueprint(missionRewards, activeBlueprint.id) : [],
    [activeBlueprint, missionRewards],
  );

  const requiredResources = useMemo(
    () =>
      activeBlueprint
        ? aggregateBlueprintResources(activeBlueprint.slots, slotAssignments)
        : [],
    [activeBlueprint, slotAssignments],
  );

  function fillSlots(mode: 'max' | 'minimum') {
    if (!activeBlueprint) {
      return;
    }

    for (const slot of activeBlueprint.slots) {
      assignQuality(slot.id, mode === 'max' ? 1000 : (slot.minQuality ?? 0));
    }
  }

  if (!activeBlueprint) {
    return (
      <section className="simulator simulator--empty" aria-label={t('Craft simulator', 'Simulateur de craft')}>
        <div className="simulator__empty-state">
          <span className="simulator__empty-icon" aria-hidden="true">◇</span>
          <h2 className="simulator__empty-title">{t('Select a blueprint', 'Selectionner un blueprint')}</h2>
          <p className="simulator__empty-desc">
            {t(
              'Choose a blueprint from the explorer to start simulating a craft.',
              'Choisissez un blueprint dans l explorateur pour commencer a simuler un craft.',
            )}
          </p>
        </div>
      </section>
    );
  }

  const craftMinutes = Math.round(activeBlueprint.craftTimeSecs / 60);
  const isLooted = inventoryIds.includes(activeBlueprint.id);
  const isFavorite = favoriteIds.includes(activeBlueprint.id);
  const canAddToComparison = comparisonItems.length < 4;
  const nextColor = COMPARISON_COLORS[comparisonItems.length];

  return (
    <section className="simulator" aria-label={`${t('Simulator', 'Simulateur')} - ${activeBlueprint.name}`}>
      <header className="simulator__header">
        <div className="simulator__meta">
          <CategoryBadge category={activeBlueprint.category} />
          <span className="simulator__craft-time">⏱ {craftMinutes}m</span>
        </div>
        <h2 className="simulator__bp-name">{activeBlueprint.name}</h2>
        <p className="simulator__bp-manufacturer">{activeBlueprint.manufacturer}</p>
        <div className="simulator__bp-actions">
          <button
            className={['sim-action-btn', isLooted && 'sim-action-btn--active'].filter(Boolean).join(' ')}
            onClick={() => toggleInventory(activeBlueprint.id)}
            aria-pressed={isLooted}
          >
            {isLooted ? (
              <>
                <span>◉</span> {t('Looted', 'Loote')}
              </>
            ) : (
              <>
                <span>◎</span> {t('Mark as looted', 'Marquer comme loote')}
              </>
            )}
          </button>
          <button
            className={[
              'sim-action-btn',
              isFavorite && 'sim-action-btn--fav sim-action-btn--active',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => toggleFavorite(activeBlueprint.id)}
            aria-pressed={isFavorite}
          >
            {isFavorite ? '★' : '☆'} {isFavorite ? t('Favorited', 'Favori') : t('Favorite', 'Favori')}
          </button>
        </div>
        <AcquisitionSources contracts={acquisitionContracts} loading={missionRewardsLoading} />
      </header>

      <div className="simulator__score-row">
        <QualityScore score={qualityScore} />
        <div className="simulator__controls">
          <Button variant="ghost" size="sm" onClick={() => fillSlots('max')}>
            {t('Max quality', 'Qualite max')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => fillSlots('minimum')}>
            {t('Minimum valid', 'Minimum valide')}
          </Button>
          <Button variant="ghost" size="sm" onClick={clearAssignments}>
            {t('Clear', 'Effacer')}
          </Button>
        </div>
      </div>

      <h3 className="simulator__section-title">
        <span aria-hidden="true">⚙</span> {t('Parts', 'Composants')}
      </h3>

      <div className="simulator__slots">
        {activeBlueprint.slots.map((slot) => (
          <SlotCard
            key={slot.id}
            slot={slot}
            qualityValue={slotAssignments[slot.id]}
            onQualityChange={(value) => assignQuality(slot.id, value)}
          />
        ))}
      </div>

      <CombinedModifiers blueprint={activeBlueprint} projectedStats={projectedStats} />
      <ResourceSummary entries={requiredResources} />

      <section className="simulator__actions">
        <div className="simulator__actions-row">
          <label htmlFor="sim-qty" className="simulator__qty-label">
            {t('Qty', 'Qte')}
          </label>
          <input
            id="sim-qty"
            type="number"
            min={1}
            max={99}
            value={qty}
            onChange={(event) =>
              setQty(Math.max(1, Math.min(99, Number(event.target.value) || 1)))
            }
            className="simulator__qty-input"
          />
        </div>
        <Button variant="gradient" size="md" fullWidth onClick={() => addGoal(qualityScore, projectedStats, qty)}>
          📋 {t('Add to Planner', 'Ajouter au planificateur')}
        </Button>
        <Button
          variant="secondary"
          size="md"
          fullWidth
          onClick={() => addToComparison(qualityScore, projectedStats)}
          disabled={!canAddToComparison}
          style={{ position: 'relative', overflow: 'hidden' } as React.CSSProperties}
        >
          {canAddToComparison && (
            <span className="btn-compare__dot" style={{ background: nextColor }} aria-hidden="true" />
          )}
          ◇ {t('Compare', 'Comparer')}
          {!canAddToComparison && (
            <span style={{ fontSize: '.7rem', marginLeft: 4, opacity: 0.6 }}>max 4</span>
          )}
        </Button>
        {comparisonItems.length > 0 && (
          <button
            className="stats-panel__cmp-badge"
            onClick={openComparison}
            aria-label={`${t('Open comparison', 'Ouvrir la comparaison')} (${comparisonItems.length})`}
          >
            {comparisonItems.map((item) => (
              <span
                key={item.id}
                className="stats-panel__cmp-dot"
                style={{ background: item.color }}
                aria-hidden="true"
              />
            ))}
            <span>{comparisonItems.length} {t('in comparison', 'en comparaison')}</span>
          </button>
        )}
      </section>
    </section>
  );
}
