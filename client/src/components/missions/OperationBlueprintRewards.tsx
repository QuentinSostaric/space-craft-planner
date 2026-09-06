import { useState } from 'react';
import type { MissionOperation } from '../../types/missionOperations';
import { useCraft } from '../../store/CraftContext';
import { useI18n } from '../../i18n/I18nContext';
import { AppButton } from '../ui/controls';
import { toSlug } from '../../utils/slug';

function RewardArtwork({ url }: { url?: string | null }) {
  const [failed, setFailed] = useState(false);
  return <div className="operation-blueprint-art">{url && !failed ? <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} /> : <i className="pi pi-box" aria-hidden="true" />}</div>;
}

export function OperationBlueprintRewards({ operation, buildNumber }: { operation: MissionOperation; buildNumber: string }) {
  const { t } = useI18n();
  const { activeDataset, blueprints = [] } = useCraft();
  const [expanded, setExpanded] = useState(false);
  const sameBuild = String(activeDataset.buildNumber) === String(buildNumber) && activeDataset.channel === 'live';
  const items = [...new Map(operation.contracts.flatMap((contract) => contract.blueprintRewards.flatMap((pool) => pool.blueprints)).map((blueprint) => [blueprint.id, blueprint])).values()];
  return <section className="operation-blueprints" aria-label={t('Blueprint rewards', 'Récompenses blueprints')}>
    <div className="mission-section-heading"><h2>{t('Blueprint rewards', 'Récompenses blueprints')}</h2>{items.length > 0 && <span>{items.length} {t('possible', 'possibles')}</span>}</div>
    {items.length === 0 ? <p>{t('No blueprint reward confirmed for this operation.', 'Aucune récompense blueprint confirmée pour cette opération.')}</p> : <>
      <p>{t('Possible drops depend on the contract. Each blueprint is not guaranteed.', 'Les récompenses possibles dépendent du contrat. Chaque blueprint n’est pas garanti.')}</p>
      <div className="operation-blueprint-grid">{items.slice(0, expanded ? undefined : 6).map((item) => {
        const name = item.name && !item.name.startsWith('BP_') ? item.name : t('Unidentified blueprint', 'Blueprint non identifié');
        const blueprint = sameBuild ? blueprints.find((candidate) => candidate.id === item.id || candidate.name === item.name) : undefined;
        const media = blueprint?.media;
        const url = media?.image?.imageUrl ?? (media?.primaryVisual?.imageUrl !== media?.manufacturerLogo?.imageUrl ? media?.primaryVisual?.imageUrl : null);
        const content = <><RewardArtwork url={url} /><span>{name}</span></>;
        return item.name && !item.name.startsWith('BP_') && sameBuild ? <a className="operation-blueprint" key={item.id} href={`/item/${toSlug(blueprint?.name ?? item.name)}`}>{content}</a> : <div className="operation-blueprint" key={item.id}>{content}</div>;
      })}</div>
      {items.length > 6 && <AppButton size="sm" variant="ghost" onClick={() => setExpanded(!expanded)}>{expanded ? t('Show less', 'Réduire') : `${t('Show all blueprints', 'Voir tous les blueprints')} (${items.length})`}</AppButton>}
      {!sameBuild && <p>{t('Blueprint links are unavailable for the selected game version.', 'Les liens vers les blueprints sont indisponibles pour la version du jeu sélectionnée.')}</p>}
    </>}
  </section>;
}
