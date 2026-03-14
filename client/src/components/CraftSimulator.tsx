import { useState } from 'react';
import { useCraft } from '../store/CraftContext';
import { useI18n, loc } from '../i18n/I18nContext';
import { useCraftSimulator } from '../hooks/useCraftSimulator';
import { QualityPicker } from './QualityPicker';
import { QualityBadge, CategoryBadge } from './ui/Badge';
import { Button } from './ui/Button';
import { QUALITY_ORDER, GAME_QUALITY_NAMES } from '../types';
import type { MaterialSlot, Quality } from '../types';
import { ResourceIcon } from './ui/ResourceIcon';

const QUALITY_OPTIONS: Quality[] = ['CMR', 'CMP', 'CMS'];

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

function SlotButton({ slot, assignedQuality, onOpenPicker }: {
  slot: MaterialSlot;
  assignedQuality: Quality | undefined;
  onOpenPicker: (slot: MaterialSlot) => void;
}) {
  const { lang, t } = useI18n();
  const isEmpty = !assignedQuality;

  return (
    <button
      className={['slot-btn', !isEmpty && 'slot-btn--filled', isEmpty && 'slot-btn--empty'].filter(Boolean).join(' ')}
      onClick={() => onOpenPicker(slot)}
      aria-label={`${t('Slot', 'Slot')} ${loc(slot.label, lang)}: ${slot.requiredResource}${assignedQuality ? ` — ${GAME_QUALITY_NAMES[assignedQuality]} (${assignedQuality})` : ` — ${t('empty', 'vide')}`}`}
    >
      <div className="slot-btn__top">
        <span className="slot-btn__label">{loc(slot.label, lang)}</span>
        {slot.minQuality && <QualityBadge quality={slot.minQuality} size="sm" />}
      </div>

      <div className="slot-btn__content">
        {assignedQuality ? (
          <>
            <ResourceIcon name={slot.requiredResource} size={18} shimmer />
            <span className="slot-btn__mat-name">{slot.requiredResource}</span>
            <QualityBadge quality={assignedQuality} size="sm" />
          </>
        ) : (
          <>
            <ResourceIcon name={slot.requiredResource} size={18} className="game-icon--dim" />
            <span className="slot-btn__resource-hint">{slot.requiredResource}</span>
            <span className="slot-btn__placeholder" aria-hidden="true">
              + {t('Assign', 'Assigner')}
            </span>
          </>
        )}
      </div>

      <div className="slot-btn__stat">
        <span className="slot-btn__stat-label">{slot.quantityScu} SCU</span>
      </div>
    </button>
  );
}

export function CraftSimulator() {
  const { activeBlueprint, slotAssignments, assignQuality, clearAssignments } = useCraft();
  const { t } = useI18n();
  const { qualityScore } = useCraftSimulator(activeBlueprint, slotAssignments);
  const [pickerSlot, setPickerSlot] = useState<MaterialSlot | null>(null);

  function autoFill(mode: 'best' | 'worst') {
    if (!activeBlueprint) return;
    for (const slot of activeBlueprint.slots) {
      const minOrder = slot.minQuality ? QUALITY_ORDER[slot.minQuality] : 1;
      const valid = QUALITY_OPTIONS.filter((q) => QUALITY_ORDER[q] >= minOrder);
      if (valid.length === 0) continue;
      valid.sort((a, b) =>
        mode === 'best'
          ? QUALITY_ORDER[b] - QUALITY_ORDER[a]
          : QUALITY_ORDER[a] - QUALITY_ORDER[b],
      );
      assignQuality(slot.id, valid[0]);
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

  return (
    <section className="simulator" aria-label={`${t('Simulator', 'Simulateur')} — ${activeBlueprint.name}`}>
      {/* Blueprint header */}
      <header className="simulator__header">
        <div className="simulator__bp-info">
          <div className="simulator__bp-badges">
            <CategoryBadge category={activeBlueprint.category} />
          </div>
          <h2 className="simulator__bp-name">{activeBlueprint.name}</h2>
          <p className="simulator__bp-manufacturer">
            {activeBlueprint.manufacturer}
            <span className="simulator__craft-time">
              {' · '}{craftMins} {t('min to craft', 'min de craft')}
            </span>
          </p>
        </div>
        <QualityScore score={qualityScore} />
      </header>

      {/* Auto-fill controls */}
      <div className="simulator__controls">
        <Button
          variant="ghost" size="sm"
          onClick={() => autoFill('best')}
          aria-label={t('Fill all slots with best quality (CMR)', 'Remplir tous les slots avec la meilleure qualité (CMR)')}
        >
          ★ {t('Best quality', 'Meilleure qualité')}
        </Button>
        <Button
          variant="ghost" size="sm"
          onClick={() => autoFill('worst')}
          aria-label={t('Fill all slots with base quality (CMS)', 'Remplir tous les slots avec la qualité de base (CMS)')}
        >
          {t('Base quality', 'Qualité de base')}
        </Button>
        <Button
          variant="ghost" size="sm"
          onClick={clearAssignments}
          aria-label={t('Clear all slots', 'Vider tous les slots')}
        >
          {t('Clear', 'Effacer')}
        </Button>
      </div>

      {/* Slots */}
      <div className="simulator__slots" role="group" aria-label={t('Material slots', 'Slots de matériaux')}>
        {activeBlueprint.slots.map((slot) => (
          <SlotButton
            key={slot.id}
            slot={slot}
            assignedQuality={slotAssignments[slot.id]}
            onOpenPicker={setPickerSlot}
          />
        ))}
      </div>

      {/* Quality picker modal */}
      {pickerSlot && (
        <QualityPicker
          slot={pickerSlot}
          currentQuality={slotAssignments[pickerSlot.id]}
          onSelect={(q) => assignQuality(pickerSlot.id, q)}
          onClose={() => setPickerSlot(null)}
        />
      )}
    </section>
  );
}
