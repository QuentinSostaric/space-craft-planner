import { useMemo, useState } from 'react';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { CategoryBadge } from './ui/Badge';
import { ResourceIcon } from './ui/ResourceIcon';

function ConfidenceBadge({ level }: { level: string }) {
  const cls = `dismantle__confidence dismantle__confidence--${level}`;
  return <span className={cls}>{level}</span>;
}

export function DismantlingPanel() {
  const { dismantlingData, activeBlueprint } = useCraft();
  const { t } = useI18n();
  const [inputQty, setInputQty] = useState(1);

  if (!dismantlingData) {
    return (
      <div className="dismantle dismantle--empty">
        <p>{t('No dismantling data available for this dataset.', 'Aucune donnée de démontage disponible pour ce dataset.')}</p>
      </div>
    );
  }

  const { fabricator, dismantling, meta } = dismantlingData;
  const { blueprint: dismantleBp, globalParams } = dismantling;
  const efficiency = dismantleBp.efficiency;

  // Calculate per-item yield estimate based on slot SCU totals
  const itemYield = useMemo(() => {
    if (!activeBlueprint) return null;
    let totalInputScu = 0;
    const resources: Record<string, number> = {};
    for (const slot of activeBlueprint.slots) {
      totalInputScu += slot.quantityScu;
      resources[slot.requiredResource] = (resources[slot.requiredResource] ?? 0) + slot.quantityScu;
    }
    const totalOutputScu = totalInputScu * efficiency;
    return {
      totalInputScu,
      totalOutputScu,
      resources: Object.entries(resources).map(([name, scu]) => ({
        name,
        inputScu: scu,
        outputScu: scu * efficiency,
      })),
    };
  }, [activeBlueprint, efficiency]);

  return (
    <div className="dismantle">
      <h2 className="dismantle__title">{t('Dismantling', 'Démontage')}</h2>

      {/* Selected item header */}
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
          <span className="dismantle__empty-icon" aria-hidden="true">◈</span>
          <p>{t(
            'Select an item from your inventory to see its dismantling details.',
            'Sélectionnez un item de votre inventaire pour voir ses détails de démontage.',
          )}</p>
        </div>
      )}

      {/* Global stats grid */}
      <section className="dismantle__stats" aria-label={t('Dismantling stats', 'Stats de démontage')}>
        <div className="dismantle__stat">
          <span className="dismantle__stat-label">{t('Efficiency', 'Efficacité')}</span>
          <span className="dismantle__stat-value">{Math.round(efficiency * 100)}%</span>
        </div>
        <div className="dismantle__stat">
          <span className="dismantle__stat-label">{t('Time', 'Temps')}</span>
          <span className="dismantle__stat-value">{dismantleBp.dismantleTimeSecs}s</span>
        </div>
        <div className="dismantle__stat">
          <span className="dismantle__stat-label">{t('Output Quality', 'Qualité sortie')}</span>
          <span className="dismantle__stat-value">{globalParams.defaultCompositionQuality}</span>
        </div>
        <div className="dismantle__stat">
          <span className="dismantle__stat-label">{t('Fabricator SCU', 'SCU Fabricateur')}</span>
          <span className="dismantle__stat-value">{fabricator.inventoryOccupancyScu}</span>
        </div>
      </section>

      {/* Per-item yield estimate */}
      {activeBlueprint && itemYield && (
        <section className="dismantle__yield">
          <h3 className="dismantle__section-title">{t('Estimated Yield', 'Rendement estimé')}</h3>
          <div className="dismantle__calc-row">
            <label htmlFor="dismantle-qty" className="dismantle__calc-label">
              {t('Qty', 'Qté')}
            </label>
            <input
              id="dismantle-qty"
              type="number"
              min={1} max={99}
              value={inputQty}
              onChange={(e) => setInputQty(Math.max(1, Math.min(99, Number(e.target.value))))}
              className="dismantle__calc-input"
            />
          </div>
          <ul className="dismantle__yield-list">
            {itemYield.resources.map((res) => (
              <li key={res.name} className="dismantle__yield-item">
                <ResourceIcon name={res.name} size={16} />
                <span className="dismantle__yield-name">{res.name}</span>
                <span className="dismantle__yield-arrow" aria-hidden="true">&rarr;</span>
                <span className="dismantle__yield-scu">{(res.outputScu * inputQty).toFixed(2)} SCU</span>
              </li>
            ))}
          </ul>
          <div className="dismantle__calc-result">
            <span className="dismantle__calc-label">{t('Total Output', 'Sortie totale')}</span>
            <span className="dismantle__calc-value">{(itemYield.totalOutputScu * inputQty).toFixed(2)} SCU</span>
          </div>
          <p className="dismantle__calc-formula">
            {(itemYield.totalInputScu * inputQty).toFixed(2)} SCU &times; {Math.round(efficiency * 100)}% = {(itemYield.totalOutputScu * inputQty).toFixed(2)} SCU
          </p>
        </section>
      )}

      {/* Confidence & info */}
      <section className="dismantle__info">
        <h3 className="dismantle__section-title">{t('Data Confidence', 'Fiabilité des données')}</h3>
        <div className="dismantle__confidence-grid">
          <div className="dismantle__confidence-item">
            <span className="dismantle__confidence-label">{t('Global Process', 'Processus global')}</span>
            <ConfidenceBadge level={meta.confidence.globalProcess} />
          </div>
          <div className="dismantle__confidence-item">
            <span className="dismantle__confidence-label">{t('UI Result Shape', 'Structure UI')}</span>
            <ConfidenceBadge level={meta.confidence.uiResultShape} />
          </div>
          <div className="dismantle__confidence-item">
            <span className="dismantle__confidence-label">{t('Per-Item Yields', 'Rendement par objet')}</span>
            <ConfidenceBadge level={meta.confidence.perItemYieldTable} />
          </div>
        </div>
        <p className="dismantle__notice">
          {t(
            'Per-item yields are estimated from crafting blueprint SCU totals and global efficiency. Actual in-game yields may differ.',
            'Les rendements par objet sont estimés à partir des SCU des blueprints de craft et de l\'efficacité globale. Les rendements en jeu peuvent différer.',
          )}
        </p>
      </section>
    </div>
  );
}
