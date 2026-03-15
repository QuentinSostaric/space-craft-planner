import { useEffect, useRef } from 'react';
import type { MaterialSlot } from '../types';
import { QUALITY_PRESETS, QUALITY_PRESET_VALUE, QUALITY_PRESET_LABEL, qualityValueToPreset } from '../types';
import { useI18n, loc } from '../i18n/I18nContext';
import { MinQualityBadge } from './ui/Badge';
import { Button } from './ui/Button';
import { ResourceIcon } from './ui/ResourceIcon';

interface QualityPickerProps {
  slot: MaterialSlot;
  currentQuality: number | undefined;
  onSelect: (quality: number | undefined) => void;
  onClose: () => void;
}

export function QualityPicker({ slot, currentQuality, onSelect, onClose }: QualityPickerProps) {
  const { lang, t } = useI18n();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    firstFocusRef.current?.focus();

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
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
    return () => { document.removeEventListener('keydown', handleKey); prev?.focus(); };
  }, [onClose]);

  return (
    <div
      className="picker-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="picker-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="picker" ref={dialogRef}>
        <header className="picker__header">
          <div>
            <p className="picker__eyebrow">
              {t('Select quality', 'Sélectionner la qualité')}
            </p>
            <h2 id="picker-title" className="picker__title">
              {loc(slot.label, lang)}
            </h2>
            <p className="picker__desc">
              <ResourceIcon name={slot.requiredResource} size={20} />
              {' '}
              <strong>{slot.requiredResource}</strong>
              {' — '}
              {slot.quantityScu} SCU
            </p>
          </div>
          <button
            className="picker__close"
            onClick={onClose}
            aria-label={t('Close quality picker', 'Fermer le sélecteur de qualité')}
            ref={firstFocusRef}
          >
            ✕
          </button>
        </header>

        {slot.minQuality != null && slot.minQuality > 0 && (
          <p className="picker__min-quality">
            {t('Minimum required quality:', 'Qualité minimale requise :')}
            {' '}<MinQualityBadge minQuality={slot.minQuality} />
          </p>
        )}

        <div className="picker__groups">
          <div className="picker__group">
            <div className="picker__quality-row">
              {QUALITY_PRESETS.map((preset) => {
                const value = QUALITY_PRESET_VALUE[preset];
                const label = QUALITY_PRESET_LABEL[preset][lang];
                const isSelected = currentQuality !== undefined && qualityValueToPreset(currentQuality) === preset;
                const isDisabled = slot.minQuality != null && value < slot.minQuality;
                // t ∈ [0,1]: fraction of GPP bonus range achieved at this quality value
                const t2 = Math.max(0, Math.min(1, (value - 500) / 500));
                const potentialPct = Math.round(t2 * 100);

                return (
                  <button
                    key={preset}
                    className={[
                      'picker__mat-btn',
                      `picker__mat-btn--${preset}`,
                      isSelected && 'picker__mat-btn--selected',
                      isDisabled && 'picker__mat-btn--disabled',
                    ].filter(Boolean).join(' ')}
                    onClick={() => { if (!isDisabled) { onSelect(value); onClose(); } }}
                    disabled={isDisabled}
                    aria-pressed={isSelected}
                    aria-label={`${slot.requiredResource} ${label} (${value}) — ${potentialPct}% bonus potential`}
                  >
                    <div className="picker__mat-info">
                      <span className={`badge badge--quality badge--quality-${preset} badge--sm`}>{label}</span>
                    </div>
                    <span className="picker__mat-value">{value}</span>
                    <span className="picker__mat-factor">{potentialPct}%</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {currentQuality !== undefined && (
          <div className="picker__footer">
            <Button variant="ghost" size="sm" onClick={() => { onSelect(undefined); onClose(); }}>
              {t('Remove assignment', 'Retirer l\'assignation')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
