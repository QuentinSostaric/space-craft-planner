import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { CategoryBadge } from './ui/Badge';

function ConfidenceBadge({ level }: { level: string }) {
  return <span className={`dismantle__confidence dismantle__confidence--${level}`}>{level}</span>;
}

export function DismantlingPanel() {
  const { dismantlingData, activeBlueprint } = useCraft();
  const { t } = useI18n();
  const dismantling = dismantlingData?.dismantling ?? null;

  if (!dismantlingData || !dismantling?.blueprint || !dismantling.globalParams) {
    return (
      <div className="dismantle dismantle--empty">
        <p>{t('No dismantling data available for this dataset.', 'Aucune donnee de demontage disponible pour ce dataset.')}</p>
      </div>
    );
  }

  const { fabricator, meta } = dismantlingData;
  const dismantleBlueprint = dismantling.blueprint;
  const globalParams = dismantling.globalParams;
  const perItemYieldModel = dismantling.perItemYieldModel ?? null;
  const observedFields = perItemYieldModel?.observedRuntimeFields ?? [];

  return (
    <div className="dismantle">
      <h2 className="dismantle__title">{t('Dismantling', 'Demontage')}</h2>

      {activeBlueprint ? (
        <header className="dismantle__item-header">
          <CategoryBadge category={activeBlueprint.category} />
          <div className="dismantle__item-info">
            <h3 className="dismantle__item-name">{activeBlueprint.name}</h3>
            <p className="dismantle__item-manufacturer">{activeBlueprint.manufacturer}</p>
          </div>
        </header>
      ) : (
        <div className="dismantle__empty-select">
          <span className="dismantle__empty-icon" aria-hidden="true">◇</span>
          <p>{t(
            'Select an item from your inventory to inspect the dismantling process metadata.',
            'Selectionnez un item de votre inventaire pour consulter les metadonnees de demontage.',
          )}</p>
        </div>
      )}

      <section className="dismantle__stats" aria-label={t('Dismantling stats', 'Stats de demontage')}>
        <div className="dismantle__stat">
          <span className="dismantle__stat-label">{t('Efficiency', 'Efficacite')}</span>
          <span className="dismantle__stat-value">{Math.round(dismantleBlueprint.efficiency * 100)}%</span>
        </div>
        <div className="dismantle__stat">
          <span className="dismantle__stat-label">{t('Time', 'Temps')}</span>
          <span className="dismantle__stat-value">{dismantleBlueprint.dismantleTimeSecs}s</span>
        </div>
        <div className="dismantle__stat">
          <span className="dismantle__stat-label">{t('Output Quality', 'Qualite de sortie')}</span>
          <span className="dismantle__stat-value">{globalParams.defaultCompositionQuality}</span>
        </div>
        <div className="dismantle__stat">
          <span className="dismantle__stat-label">{t('Fabricator SCU', 'SCU fabricateur')}</span>
          <span className="dismantle__stat-value">{fabricator?.inventoryOccupancyScu ?? '—'}</span>
        </div>
      </section>

      {fabricator?.queues?.length ? (
        <section className="dismantle__info">
          <h3 className="dismantle__section-title">{t('Available Queues', 'Files disponibles')}</h3>
          <ul className="dismantle__field-list">
            {fabricator.queues.map((queue) => (
              <li key={queue.debugName} className="dismantle__field-item">
                <span className="dismantle__field-name">{queue.debugName}</span>
                <span className="dismantle__field-meta">
                  {queue.maxJobsInProgress}/{queue.maxJobsWaiting}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="dismantle__info">
        <h3 className="dismantle__section-title">{t('Per-item Yields', 'Rendements par item')}</h3>
        {perItemYieldModel?.resolved ? (
          <p className="dismantle__notice">
            {t(
              'This dataset includes a resolved per-item dismantle yield table.',
              'Ce dataset inclut une table resolue des rendements par item.',
            )}
          </p>
        ) : (
          <>
            <p className="dismantle__notice">
              {perItemYieldModel?.reason ?? t(
                'The current dataset does not expose an authoritative per-item dismantle yield table.',
                'Le dataset actuel n expose pas de table fiable des rendements par item.',
              )}
            </p>
            {observedFields.length > 0 && (
              <>
                <p className="dismantle__notice">
                  {t('Observed runtime result fields:', 'Champs observes dans les resultats runtime :')}
                </p>
                <ul className="dismantle__field-list">
                  {observedFields.map((field) => (
                    <li key={field} className="dismantle__field-item">
                      <span className="dismantle__field-name">{field}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </section>

      <section className="dismantle__info">
        <h3 className="dismantle__section-title">{t('Data Confidence', 'Fiabilite des donnees')}</h3>
        <div className="dismantle__confidence-grid">
          <div className="dismantle__confidence-item">
            <span className="dismantle__confidence-label">{t('Global Process', 'Processus global')}</span>
            <ConfidenceBadge level={meta?.confidence?.globalProcess ?? 'unknown'} />
          </div>
          <div className="dismantle__confidence-item">
            <span className="dismantle__confidence-label">{t('UI Result Shape', 'Structure UI')}</span>
            <ConfidenceBadge level={meta?.confidence?.uiResultShape ?? 'unknown'} />
          </div>
          <div className="dismantle__confidence-item">
            <span className="dismantle__confidence-label">{t('Per-Item Yields', 'Rendement par item')}</span>
            <ConfidenceBadge level={meta?.confidence?.perItemYieldTable ?? 'unknown'} />
          </div>
        </div>
      </section>
    </div>
  );
}
