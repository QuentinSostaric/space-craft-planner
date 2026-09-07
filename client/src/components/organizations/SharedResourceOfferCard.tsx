import { Box, Paper, Typography } from '../../ui/system';
import { useI18n } from '../../i18n/I18nContext';
import { formatQualityLabel, formatResourceQuantity } from '../../utils/crafting';
import { AppButton } from '../ui/controls';
import { AppChip } from '../ui/data-display/AppChip';
import { ResourceIcon } from '../ui/ResourceIcon';
import { SharedOfferOwnerIdentity } from './SharedOfferOwner';
import type { SharedResourceOfferCardProps } from './sharedOfferTypes';
export type { SharedResourceOfferCardProps, SharedOfferOwner } from './sharedOfferTypes';

export function SharedResourceOfferCard({ entry, resource, owner, contextLabel, onOpenResource, onContact, contactLabel, extraAction, selectionPreview = false }: SharedResourceOfferCardProps) {
  const { t, lang } = useI18n();
  return <Paper component="article" aria-label={`${entry.resourceName} · ${owner.displayName || owner.handle}`} sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, height: '100%' }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box sx={{ p: 1.5, display: 'flex', backgroundColor: 'background.default', borderRadius: 1 }}><ResourceIcon name={resource?.name ?? entry.resourceName} size={32} /></Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography component="h3" sx={{ fontSize: '1.05rem', fontWeight: 700, overflowWrap: 'anywhere' }}>{entry.resourceName}</Typography>
        {contextLabel && <Typography variant="caption" sx={{ color: 'text.secondary' }}>{contextLabel}</Typography>}
      </Box>
    </Box>
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      <AppChip label={formatResourceQuantity(entry.quantity, entry.quantityUnit, lang, 'long')} />
      <AppChip label={entry.quality == null ? t('Quality unspecified', 'Qualité non précisée', 'Qualität nicht angegeben') : formatQualityLabel(entry.quality, lang)} outlined />
    </Box>
    <Box sx={{ pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}><SharedOfferOwnerIdentity owner={owner} /></Box>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 'auto' }}>
      {selectionPreview ? null : onContact ? <AppButton variant="secondary" onClick={onContact} sx={{ minHeight: 44 }}>{contactLabel ?? t('View RSI profile', 'Voir le profil RSI', 'RSI-Profil ansehen')}</AppButton>
        : <AppButton variant="secondary" href={`https://robertsspaceindustries.com/citizens/${encodeURIComponent(owner.handle)}`} target="_blank" rel="noopener noreferrer" sx={{ minHeight: 44 }}>{t('View RSI profile', 'Voir le profil RSI', 'RSI-Profil ansehen')}</AppButton>}
      {onOpenResource && <AppButton variant="ghost" size="sm" onClick={onOpenResource}>{t('Resource details', 'Détails de la ressource', 'Ressourcendetails')}</AppButton>}
      {extraAction}
    </Box>
  </Paper>;
}
