import { Box, Paper, Typography } from '../../ui/system';
import { HandymanOutlinedIcon } from '../../ui/icons';
import { loc, useI18n } from '../../i18n/I18nContext';
import { CATEGORY_LABELS } from '../../types';
import { sanitizeExternalHttpsUrl } from '../../utils/urlSafety';
import { AppButton } from '../ui/controls';
import { AppChip } from '../ui/data-display/AppChip';
import { SharedOfferOwnerIdentity } from './SharedOfferOwner';
import type { SharedBlueprintOfferCardProps } from './sharedOfferTypes';
export type { SharedBlueprintOfferCardProps, SharedOfferOwner } from './sharedOfferTypes';

export function SharedBlueprintOfferCard({ blueprint, owner, contextLabel, requestState = 'available', busy = false, onRequest, onOpenBlueprint, onManageSharing, onViewRequests, extraAction, selectionPreview = false }: SharedBlueprintOfferCardProps) {
  const { t, lang } = useI18n();
  const image = sanitizeExternalHttpsUrl(blueprint.media?.image?.imageUrl ?? blueprint.media?.primaryVisual?.imageUrl ?? blueprint.media?.manufacturerLogo?.imageUrl);
  const hasOpenRequest = requestState === 'pending' || requestState === 'accepted';
  return <Paper component="article" aria-label={`${blueprint.name} · ${owner.displayName || owner.handle}`} sx={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
    <Box sx={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'background.default', borderBottom: '1px solid', borderColor: 'divider' }}>
      {image ? <Box component="img" src={image} alt="" loading="lazy" sx={{ width: '100%', height: '100%', objectFit: 'contain', p: 1.5 }} /> : <HandymanOutlinedIcon sx={{ fontSize: 38, color: 'text.secondary' }} />}
    </Box>
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1 }}>
      <Box>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>{loc(CATEGORY_LABELS[blueprint.category], lang)}{blueprint.manufacturer ? ` · ${blueprint.manufacturer}` : ''}</Typography>
        <Typography component="h3" sx={{ fontSize: '1.05rem', fontWeight: 700, mt: .5, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{blueprint.name}</Typography>
        {contextLabel && <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: .5 }}>{contextLabel}</Typography>}
      </Box>
      <Box sx={{ pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}><SharedOfferOwnerIdentity owner={owner} /></Box>
      <Box sx={{ mt: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {selectionPreview ? null : requestState === 'self' ? <>
          <AppChip label={t('Your shared blueprint', 'Votre blueprint partagé', 'Dein geteilter Blueprint')} size="sm" outlined sx={{ alignSelf: 'flex-start' }} />
          {onManageSharing && <AppButton variant="secondary" onClick={onManageSharing} sx={{ minHeight: 44 }}>{t('Manage my sharing', 'Gérer mes partages', 'Meine Freigaben verwalten')}</AppButton>}
        </> : <>
          <AppButton variant={hasOpenRequest ? 'secondary' : 'primary'} icon={<HandymanOutlinedIcon fontSize="small" />} disabled={busy || requestState !== 'available' || !onRequest} loading={busy} onClick={onRequest} ariaLabel={requestState === 'available' ? t(`Request ${blueprint.name} from ${owner.displayName || owner.handle}`, `Demander ${blueprint.name} à ${owner.displayName || owner.handle}`, `${blueprint.name} bei ${owner.displayName || owner.handle} anfragen`) : undefined} sx={{ minHeight: 44, ...(hasOpenRequest ? { '&:disabled': { opacity: 1, color: 'text.secondary', backgroundColor: 'ui.surface2', borderColor: 'divider' } } : {}) }}>
            {requestState === 'accepted' ? t('Request accepted', 'Demande acceptée', 'Anfrage angenommen') : requestState === 'pending' ? t('Request pending', 'Demande en attente', 'Anfrage ausstehend') : requestState === 'unavailable' ? t('Requests unavailable', 'Demandes indisponibles', 'Anfragen nicht verfügbar') : t('Request a craft', 'Demander un craft', 'Craft anfragen')}
          </AppButton>
          {hasOpenRequest && onViewRequests && <AppButton variant="ghost" size="sm" onClick={onViewRequests}>{requestState === 'accepted' ? t('View requests', 'Voir les demandes', 'Anfragen ansehen') : t('Follow my request', 'Suivre ma demande', 'Meine Anfrage verfolgen')}</AppButton>}
        </>}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          {onOpenBlueprint && <AppButton variant="ghost" size="sm" onClick={onOpenBlueprint}>{t('Blueprint details', 'Détails du blueprint', 'Blueprint-Details')}</AppButton>}
          {extraAction}
        </Box>
      </Box>
    </Box>
  </Paper>;
}
