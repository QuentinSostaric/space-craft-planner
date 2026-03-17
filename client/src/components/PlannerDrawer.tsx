import { useEffect } from 'react';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { PlannerPanel } from './PlannerPanel';

export function PlannerDrawer() {
  const { plannerOpen, closePlanner } = useCraft();
  const { t } = useI18n();

  // Close on Escape
  useEffect(() => {
    if (!plannerOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closePlanner();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [plannerOpen, closePlanner]);

  return (
    <>
      {/* Backdrop */}
      {plannerOpen && (
        <div
          className="drawer-backdrop"
          onClick={closePlanner}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <aside
        className={['planner-drawer', plannerOpen && 'planner-drawer--open'].filter(Boolean).join(' ')}
        aria-label={t('Planner', 'Planificateur')}
        aria-hidden={!plannerOpen}
      >
        <div className="planner-drawer__header">
          <h2 className="planner-drawer__title">{t('Planner', 'Planificateur')}</h2>
          <button
            className="planner-drawer__close"
            onClick={closePlanner}
            aria-label={t('Close planner', 'Fermer le planificateur')}
          >
            ✕
          </button>
        </div>
        <div className="planner-drawer__body">
          <PlannerPanel />
        </div>
      </aside>
    </>
  );
}
