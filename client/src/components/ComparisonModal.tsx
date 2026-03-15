import { useEffect, useRef, useMemo } from 'react';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { STAT_LABELS, STAT_PERCENT_KEYS, STAT_UNITS, STAT_LOWER_IS_BETTER } from '../types';
import type { ComparisonItem, ItemStats } from '../types';
import { aggregateBlueprintResources, summarizeAssignedQualities } from '../utils/crafting';
import { Button } from './ui/Button';
import { CategoryBadge } from './ui/Badge';

// ─── Radar Chart ─────────────────────────────────────────────────────────────
interface RadarChartProps {
  items: ComparisonItem[];
  statKeys: (keyof ItemStats)[];
  lang: 'en' | 'fr';
}

function RadarChart({ items, statKeys, lang }: RadarChartProps) {
  const n = statKeys.length;
  const cx = 150, cy = 150, r = 90;

  function polarToXY(value: number, index: number): [number, number] {
    const angle = (2 * Math.PI * index) / n - Math.PI / 2;
    return [cx + r * value * Math.cos(angle), cy + r * value * Math.sin(angle)];
  }

  function textAnchor(index: number): 'start' | 'end' | 'middle' {
    const angle = (2 * Math.PI * index) / n - Math.PI / 2;
    const x = Math.cos(angle);
    if (x > 0.3) return 'start';
    if (x < -0.3) return 'end';
    return 'middle';
  }

  function dominantBaseline(index: number): 'hanging' | 'auto' | 'middle' {
    const angle = (2 * Math.PI * index) / n - Math.PI / 2;
    const y = Math.sin(angle);
    if (y > 0.3) return 'hanging';
    if (y < -0.3) return 'auto';
    return 'middle';
  }

  const maxValues: Partial<Record<keyof ItemStats, number>> = {};
  for (const key of statKeys) {
    const vals = items.map((item) => item.projectedStats[key] ?? 0);
    maxValues[key] = Math.max(...vals, 0.001);
  }

  function normalize(item: ComparisonItem, key: keyof ItemStats): number {
    const val = item.projectedStats[key] ?? 0;
    const max = maxValues[key] ?? 1;
    const norm = val / max;
    return STAT_LOWER_IS_BETTER.has(key) ? 1 - norm * 0.8 : norm;
  }

  const gridRings = [0.25, 0.5, 0.75, 1];

  return (
    <svg
      viewBox="0 0 300 300"
      className="radar-chart"
      role="img"
      aria-label={
        lang === 'en'
          ? `Radar chart comparing ${items.length} item${items.length > 1 ? 's' : ''}`
          : `Radar comparant ${items.length} item${items.length > 1 ? 's' : ''}`
      }
    >
      <title>
        {lang === 'en' ? 'Stats comparison radar chart' : 'Radar de comparaison des statistiques'}
      </title>

      {gridRings.map((ring) => {
        const pts = statKeys.map((_, i) => polarToXY(ring, i).join(',')).join(' ');
        return (
          <polygon key={ring} points={pts} fill="none" stroke="rgba(99,102,241,0.15)" strokeWidth="1" />
        );
      })}

      {gridRings.map((ring) => {
        const [x, y] = polarToXY(ring, 0);
        return (
          <text key={`rl-${ring}`} x={x + 4} y={y} fontSize="7" fill="rgba(139,92,246,0.4)" dominantBaseline="middle">
            {Math.round(ring * 100)}%
          </text>
        );
      })}

      {statKeys.map((key, i) => {
        const [x, y] = polarToXY(1, i);
        return <line key={key} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(99,102,241,0.2)" strokeWidth="1" />;
      })}

      {statKeys.map((key, i) => {
        const [x, y] = polarToXY(1.32, i);
        return (
          <text
            key={`lbl-${key}`}
            x={x} y={y}
            fontSize="9"
            fontFamily="Khand, sans-serif"
            fontWeight="600"
            fill="rgba(221,228,245,0.7)"
            textAnchor={textAnchor(i)}
            dominantBaseline={dominantBaseline(i)}
          >
            {STAT_LABELS[key]?.[lang] ?? String(key)}
          </text>
        );
      })}

      {items.map((item) => {
        const pts = statKeys.map((key, i) => polarToXY(normalize(item, key), i).join(',')).join(' ');
        const [r2, g2, b2] = hexToRgb(item.color);
        return (
          <polygon key={`fill-${item.id}`} points={pts} fill={`rgba(${r2},${g2},${b2},0.12)`} stroke="none" />
        );
      })}

      {items.map((item) => {
        const pts = statKeys.map((key, i) => polarToXY(normalize(item, key), i).join(',')).join(' ');
        return (
          <polygon key={`stroke-${item.id}`} points={pts} fill="none" stroke={item.color} strokeWidth="1.8" strokeLinejoin="round" opacity="0.9" />
        );
      })}

      {items.map((item) =>
        statKeys.map((key, i) => {
          const [x, y] = polarToXY(normalize(item, key), i);
          return <circle key={`dot-${item.id}-${key}`} cx={x} cy={y} r="3" fill={item.color} stroke="var(--c-bg)" strokeWidth="1.5" />;
        }),
      )}
    </svg>
  );
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function formatStatDisplayValue(key: keyof ItemStats, value: number): number {
  const scaled = STAT_PERCENT_KEYS.has(key) ? value * 100 : value;
  return Number.isInteger(scaled) ? scaled : Math.round(scaled * 100) / 100;
}

// ─── Stat comparison table ────────────────────────────────────────────────────
function StatTable({ items, statKeys, lang }: { items: ComparisonItem[]; statKeys: (keyof ItemStats)[]; lang: 'en' | 'fr' }) {
  return (
    <div className="cmp-table" role="table" aria-label={lang === 'en' ? 'Stats comparison' : 'Comparaison des statistiques'}>
      <div className="cmp-table__row cmp-table__row--header" role="row">
        <div className="cmp-table__cell cmp-table__cell--stat" role="columnheader">Stat</div>
        {items.map((item) => (
          <div
            key={item.id}
            className="cmp-table__cell cmp-table__cell--item"
            role="columnheader"
            style={{ '--item-color': item.color } as React.CSSProperties}
          >
            <span className="cmp-table__item-dot" style={{ background: item.color }} aria-hidden="true" />
            <span className="cmp-table__item-name">{item.blueprintName}</span>
          </div>
        ))}
      </div>

      {statKeys.map((key) => {
        const vals = items.map((i) => i.projectedStats[key] ?? 0);
        const maxVal = Math.max(...vals);
        const minVal = Math.min(...vals);
        const isLower = STAT_LOWER_IS_BETTER.has(key);
        const bestVal = isLower ? minVal : maxVal;

        return (
          <div key={key} className="cmp-table__row" role="row">
            <div className="cmp-table__cell cmp-table__cell--stat" role="rowheader">
              <span className="cmp-table__stat-name">{STAT_LABELS[key]?.[lang] ?? String(key)}</span>
              <span className="cmp-table__stat-unit">{STAT_UNITS[key] ?? ''}</span>
            </div>
            {items.map((item) => {
              const val = item.projectedStats[key] ?? 0;
              const base = item.baseStats[key] ?? 0;
              const isBest = val === bestVal && vals.filter(v => v === bestVal).length < vals.length;
              const delta = val - base;
              const displayVal = formatStatDisplayValue(key, val);
              const displayDelta = formatStatDisplayValue(key, delta);
              return (
                <div
                  key={item.id}
                  className={['cmp-table__cell cmp-table__cell--val', isBest && 'cmp-table__cell--best'].filter(Boolean).join(' ')}
                  role="cell"
                  aria-label={`${STAT_LABELS[key]?.[lang] ?? key}: ${displayVal} ${STAT_UNITS[key] ?? ''}${isBest ? ` (${lang === 'en' ? 'best' : 'meilleur'})` : ''}`}
                >
                  <span className="cmp-table__val" style={{ color: isBest ? item.color : undefined }}>{displayVal}</span>
                  {delta !== 0 && (
                    <span className={['cmp-table__delta', delta > 0 ? 'cmp-table__delta--up' : 'cmp-table__delta--down'].join(' ')}>
                      {displayDelta > 0 ? '+' : ''}{displayDelta}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      <div className="cmp-table__row cmp-table__row--score" role="row">
        <div className="cmp-table__cell cmp-table__cell--stat" role="rowheader">
          {lang === 'en' ? 'Quality score' : 'Score qualité'}
        </div>
        {items.map((item) => {
          const maxScore = Math.max(...items.map(i => i.qualityScore));
          const isBest = item.qualityScore === maxScore;
          return (
            <div key={item.id} className={['cmp-table__cell cmp-table__cell--val', isBest && 'cmp-table__cell--best'].join(' ')} role="cell">
              <span className="cmp-table__val" style={{ color: isBest ? item.color : undefined }}>
                {item.qualityScore}<span className="cmp-table__stat-unit">/100</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Resource summary per item ────────────────────────────────────────────────
function ResourceSummary({ item, lang }: { item: ComparisonItem; lang: 'en' | 'fr' }) {
  const { blueprints } = useCraft();
  const bp = blueprints.find((blueprint) => blueprint.id === item.blueprintId);
  if (!bp) return null;

  const entries = aggregateBlueprintResources(bp.slots, item.slotAssignments);
  if (entries.length === 0) return <span className="cmp-mat__empty">—</span>;

  return (
    <ul className="cmp-mat-list" aria-label={`${lang === 'en' ? 'Resources for' : 'Ressources pour'} ${item.blueprintName}`}>
      {entries.map((entry) => (
        <li key={entry.resourceName} className="cmp-mat-item">
          <span className="cmp-mat-item__name">{entry.resourceName}</span>
          <span className="cmp-mat-item__quality">
            {summarizeAssignedQualities(entry.assignedQualityValues, entry.unassignedSlotCount, lang)}
          </span>
          <span className="cmp-mat-item__qty">×{entry.totalScu.toFixed(2)} SCU</span>
        </li>
      ))}
    </ul>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────
export function ComparisonModal() {
  const { comparisonItems, comparisonOpen, closeComparison, removeFromComparison, clearComparison } = useCraft();
  const { lang, t } = useI18n();
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (comparisonOpen) closeBtnRef.current?.focus();
  }, [comparisonOpen]);

  useEffect(() => {
    if (!comparisonOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { closeComparison(); return; }
      if (e.key === 'Tab') {
        const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [comparisonOpen, closeComparison]);

  const allStatKeys = useMemo(() => Array.from(
    new Set(
      comparisonItems.flatMap((item) => Object.keys(item.projectedStats) as (keyof ItemStats)[]),
    ),
  ), [comparisonItems]);

  if (!comparisonOpen) return null;

  return (
    <div
      className="cmp-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t('Item comparison', 'Comparaison d\'items')}
      onClick={(e) => { if (e.target === e.currentTarget) closeComparison(); }}
    >
      <div className="cmp-modal" ref={modalRef}>
        <header className="cmp-modal__header">
          <div>
            <h2 className="cmp-modal__title">{t('Compare', 'Comparer')}</h2>
            <p className="cmp-modal__subtitle">
              {comparisonItems.length} {t('item', 'item')}{comparisonItems.length !== 1 ? 's' : ''}
              {' · '}{t('max 4', 'max 4')}
            </p>
          </div>
          <div className="cmp-modal__header-actions">
            {comparisonItems.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearComparison}>
                {t('Clear all', 'Tout effacer')}
              </Button>
            )}
            <button
              ref={closeBtnRef}
              className="cmp-modal__close"
              onClick={closeComparison}
              aria-label={t('Close comparison', 'Fermer la comparaison')}
            >
              ✕
            </button>
          </div>
        </header>

        {comparisonItems.length === 0 ? (
          <div className="cmp-modal__empty">
            <span aria-hidden="true">◈</span>
            <p>{t('Add items to compare from the Stats panel.', 'Ajoutez des items à comparer depuis le panneau Stats.')}</p>
          </div>
        ) : (
          <div className="cmp-modal__body">
            <div className="cmp-chips">
              {comparisonItems.map((item) => (
                <div key={item.id} className="cmp-chip" style={{ '--chip-color': item.color } as React.CSSProperties}>
                  <span className="cmp-chip__dot" style={{ background: item.color }} aria-hidden="true" />
                  <CategoryBadge category={item.category} iconOnly />
                  <span className="cmp-chip__name">{item.blueprintName}</span>
                  <span className="cmp-chip__score">{item.qualityScore}/100</span>
                  <button
                    className="cmp-chip__remove"
                    onClick={() => removeFromComparison(item.id)}
                    aria-label={`${t('Remove', 'Retirer')} ${item.blueprintName}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {comparisonItems.length < 4 && (
                <div className="cmp-chip cmp-chip--add">
                  <span>{t('+ Add from Stats panel', '+ Ajouter depuis Stats')}</span>
                </div>
              )}
            </div>

            <div className="cmp-content">
              {allStatKeys.length >= 3 && (
                <div className="cmp-radar">
                  <h3 className="cmp-section-title">{t('Radar', 'Radar')}</h3>
                  <RadarChart items={comparisonItems} statKeys={allStatKeys} lang={lang} />
                </div>
              )}
              <div className="cmp-stats">
                <h3 className="cmp-section-title">{t('Stat breakdown', 'Détail des stats')}</h3>
                <StatTable items={comparisonItems} statKeys={allStatKeys} lang={lang} />
              </div>
            </div>

            <div className="cmp-materials">
              <h3 className="cmp-section-title">{t('Required resources', 'Ressources requises')}</h3>
              <div className="cmp-materials__grid">
                {comparisonItems.map((item) => (
                  <div key={item.id} className="cmp-materials__col">
                    <div className="cmp-materials__col-header" style={{ borderColor: item.color }}>
                      <span className="cmp-chip__dot" style={{ background: item.color }} aria-hidden="true" />
                      <span>{item.blueprintName}</span>
                    </div>
                    <ResourceSummary item={item} lang={lang} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
