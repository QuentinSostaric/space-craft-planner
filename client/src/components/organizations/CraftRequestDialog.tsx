import { useEffect, useId, useState } from 'react';
import { Box, Stack, Typography } from '../../ui/system';
import { useI18n } from '../../i18n/I18nContext';
import { AppButton, AppSelect, AppTextArea } from '../ui/controls';
import { AppAlert } from '../ui/feedback';
import { AppDialog } from '../ui/overlays';
import { SharedOfferOwnerIdentity } from './SharedOfferOwner';
import type { CraftRequestDialogProps, CraftRequestDraft } from './sharedOfferTypes';
export type { CraftRequestDialogProps, CraftRequestDraft } from './sharedOfferTypes';
export const CRAFT_REQUEST_COMMENT_LIMIT = 1000;

export function CraftRequestDialog({ open, source = 'organization', blueprintName, owner, contextLabel, busy = false, error, onClose, onSubmit }: CraftRequestDialogProps) {
  const { t } = useI18n();
  const formId = useId();
  const [draft, setDraft] = useState<CraftRequestDraft>({ comment: '', resourcesOption: 'unspecified' });
  useEffect(() => {
    if (open) setDraft({ comment: '', resourcesOption: 'unspecified' });
  }, [open, source, blueprintName, owner.handle, contextLabel]);
  return <AppDialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !busy) onClose(); }} dismissable={!busy}
    partSx={{ header: { p: 2 }, content: { px: 2, pb: 2 }, footer: { px: 2, pb: 2, pt: 1 } }}
    title={t('Request a craft', 'Demander un craft', 'Craft anfragen')}
    closeLabel={t('Close', 'Fermer', 'Schließen')}
    description={t(`Send your request for ${blueprintName} to ${owner.displayName || owner.handle}.`, `Envoyez votre demande pour ${blueprintName} à ${owner.displayName || owner.handle}.`, `Sende deine Anfrage für ${blueprintName} an ${owner.displayName || owner.handle}.`)}
    footer={<Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" justifyContent="flex-end">
      <AppButton variant="ghost" disabled={busy} onClick={onClose}>{t('Cancel', 'Annuler', 'Abbrechen')}</AppButton>
      <AppButton variant="primary" type="submit" form={formId} disabled={busy || draft.comment.length > CRAFT_REQUEST_COMMENT_LIMIT} loading={busy}>{t('Send request', 'Envoyer la demande', 'Anfrage senden')}</AppButton>
    </Stack>}>
    <Box component="form" id={formId} onSubmit={(event) => { event.preventDefault(); if (!busy && draft.comment.length <= CRAFT_REQUEST_COMMENT_LIMIT) onSubmit({ ...draft, comment: draft.comment.trim() }); }}>
      <Stack spacing={2}>
        <SharedOfferOwnerIdentity owner={owner} />
        {contextLabel && <Typography variant="body2" sx={{ color: 'text.secondary' }}>{contextLabel}</Typography>}
        {error && <AppAlert severity="error">{error}</AppAlert>}
        <AppSelect<CraftRequestDraft['resourcesOption']> label={t('Resources', 'Ressources', 'Ressourcen')} value={draft.resourcesOption} onValueChange={(value) => setDraft(current => ({ ...current, resourcesOption: value ?? 'unspecified' }))} disabled={busy} options={[
          { value: 'unspecified', label: t('Discuss with the crafter', 'À convenir avec le crafteur', 'Mit der craftenden Person abstimmen') },
          { value: 'has_resources', label: t('I will provide the resources', 'Je fournis les ressources', 'Ich stelle die Ressourcen bereit') },
          { value: 'buy_resources', label: t('I will buy the resources', 'J’achèterai les ressources', 'Ich kaufe die Ressourcen') },
        ]} />
        <AppTextArea label={t('Comment (optional)', 'Commentaire (facultatif)', 'Kommentar (optional)')} value={draft.comment} onValueChange={(value) => setDraft(current => ({ ...current, comment: value.slice(0, CRAFT_REQUEST_COMMENT_LIMIT) }))} disabled={busy} rows={4} maxLength={CRAFT_REQUEST_COMMENT_LIMIT} placeholder={t('Availability, location, preferred quality…', 'Disponibilités, lieu, qualité souhaitée…', 'Verfügbarkeit, Ort, gewünschte Qualität…')} helperText={`${draft.comment.length} / ${CRAFT_REQUEST_COMMENT_LIMIT}`} />
        <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.65 }}>{source === 'community'
          ? t('The crafter will see your RSI identity, comment and resource arrangement. Follow replies in Account → Craft requests.', 'Le crafteur verra votre identité RSI, votre commentaire et les ressources convenues. Suivez les réponses dans Compte → Demandes de craft.', 'Die craftende Person sieht deine RSI-Identität, deinen Kommentar und die Ressourcenabsprache. Verfolge Antworten unter Konto → Craft-Anfragen.')
          : t('Follow replies in Account → Craft requests. The Discord bot can notify the crafter when available.', 'Suivez les réponses dans Compte → Demandes de craft. Le bot Discord peut notifier le crafteur lorsqu’il est disponible.', 'Verfolge Antworten unter Konto → Craft-Anfragen. Der Discord-Bot kann die craftende Person benachrichtigen, wenn er verfügbar ist.')}</Typography>
      </Stack>
    </Box>
  </AppDialog>;
}
