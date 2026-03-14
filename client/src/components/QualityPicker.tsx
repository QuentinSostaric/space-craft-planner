import { useEffect, useRef } from 'react';
import type { MaterialSlot, Quality } from '../types';
import { QUALITY_ORDER, QUALITY_NUMERIC, GAME_QUALITY_NAMES } from '../types';
import { useI18n, loc } from '../i18n/I18nContext';
import { QualityBadge } from './ui/Badge';
import { Button } from './ui/Button';

const QUALITIES: Quality[] = ['CMR', 'CMP', 'CMS'];

interface QualityPickerProps {
  slot: MaterialSlot;
  currentQuality: Quality | undefined;
  onSelect: (quality: Quality | undefined) => void;
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

  const minOrder = slot.minQuality ? QUALITY_ORDER[slot.minQuality] : 1;
  const validQualities = QUALITIES.filter((q) => QUALITY_ORDER[q] >= minOrder);

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
              {t('Select quality tier', 'Sélectionner la qualité')}
            </p>
            <h2 id="picker-title" className="picker__title">
              {loc(slot.label, lang)}
            </h2>
            <p className="picker__desc">
              <span className="picker__resource-label">
                {t('Required resource', 'Ressource requise')}:
              </span>
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

        {slot.minQuality && (
          <p className="picker__min-quality">
            {t('Minimum required quality:', 'Qualité minimale requise :')}
            {' '}<QualityBadge quality={slot.minQuality} />
          </p>
        )}

        <div className="picker__groups">
          <div className="picker__group">
            <div className="picker__quality-row">
              {validQualities.map((quality) => {
                const isSelected = quality === currentQuality;
                // lerp ∈ [0,1], 0=CMS, 1=CMR — used to show "bonus potential"
                const lerp = (QUALITY_NUMERIC[quality] - 500) / 500;
                const potentialPct = Math.round(lerp * 100);

                return (
                  <button
                    key={quality}
                    className={['picker__mat-btn', isSelected && 'picker__mat-btn--selected'].filter(Boolean).join(' ')}
                    onClick={() => { onSelect(quality); onClose(); }}
                    aria-pressed={isSelected}
                    aria-label={`${slot.requiredResource} ${GAME_QUALITY_NAMES[quality]} (${quality}) — ${potentialPct}% bonus potential`}
                  >
                    <div className="picker__mat-info">
                      <QualityBadge quality={quality} size="sm" />
                      <span className="picker__mat-game-name">{GAME_QUALITY_NAMES[quality]}</span>
                    </div>
                    <span className="picker__mat-factor">{potentialPct}%</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {currentQuality && (
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
