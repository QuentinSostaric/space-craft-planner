import { useState } from 'react';
import type { Blueprint } from '../../types';
import { GameIcon, type GameIconName } from '../ui/GameIcon';

const CATEGORY_ICON: Partial<Record<Blueprint['category'], GameIconName>> = {
  'fps-weapon': 'weapons', 'ship-weapon': 'weapons', 'fps-magazine': 'ammos',
  'fps-armor': 'armor', 'fps-helmet': 'armor', powerplant: 'power-plants',
  cooler: 'coolers', 'shield-generator': 'shields', 'quantum-drive': 'engines',
  radar: 'radars', 'mining-laser': 'mining-lasers', 'salvage-head': 'salvage',
  'tractor-beam': 'tractor-beams',
};

/** Use the item's actual render; a manufacturer mark is not an item preview. */
export function BlueprintThumbnail({ blueprint }: { blueprint: Blueprint }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const logo = blueprint.media?.manufacturerLogo?.imageUrl;
  const primary = blueprint.media?.primaryVisual?.imageUrl;
  const url = blueprint.media?.image?.imageUrl ?? (primary !== logo ? primary : null);
  return (
    <span className="workbench-item-art" aria-hidden="true">
      {url && url !== failedUrl ? (
        <img src={url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailedUrl(url)} />
      ) : <GameIcon name={CATEGORY_ICON[blueprint.category] ?? 'utilities'} size={32} shimmer={false} />}
    </span>
  );
}
