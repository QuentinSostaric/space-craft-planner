import type { ReactNode } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { FONT_MONO } from '../../theme';
import { Inventory2OutlinedIcon } from '../../ui/icons';
import { Box, Paper, Typography } from '../../ui/system';
import { formatQualityLabel, formatResourceQuantity } from '../../utils/crafting';
import { navigateToPath, resourcePathFromSlug } from '../../utils/slug';
import { shouldHandleInternalLinkClick } from '../../utils/spaLinks';
import { AppButton } from '../ui/controls';
import { AppChip } from '../ui/data-display/AppChip';
import { formatAbsoluteDate, type AccountLibraryEntry } from './accountHelpers';

export function AccountResourceCard({
  entry,
  actions,
}: {
  entry: Extract<AccountLibraryEntry, { kind: 'resource' }>;
  actions: ReactNode;
}) {
  const { t, lang } = useI18n();
  const lot = entry.resourceEntry;
  const href = resourcePathFromSlug(lot.resourceId);
  return (
    <Paper
      role="listitem"
      variant="outlined"
      sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Inventory2OutlinedIcon sx={{ color: 'text.secondary', fontSize: 22 }} />
        <Typography sx={{ fontWeight: 700, flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
          {lot.resourceName}
        </Typography>
        <AppChip
          label={entry.isShared ? t('Shared', 'Partagé', 'Geteilt') : t('Private', 'Privé', 'Privat')}
          size="sm"
          tone={entry.isShared ? 'info' : 'default'}
          outlined
        />
      </Box>
      <Box sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {t('Available quantity', 'Quantité disponible', 'Verfügbare Menge')}
          </Typography>
          <Typography
            sx={{
              fontFamily: FONT_MONO,
              fontSize: '1.7rem',
              fontWeight: 650,
              mt: 0.5,
              overflowWrap: 'anywhere',
            }}
          >
            {formatResourceQuantity(lot.quantity, lot.quantityUnit, lang, 'long')}
          </Typography>
        </Box>
        <AppChip
          label={
            lot.quality == null
              ? t('Quality unspecified', 'Qualité non précisée', 'Qualität nicht angegeben')
              : formatQualityLabel(lot.quality, lang)
          }
          size="sm"
          outlined
          sx={{ alignSelf: 'flex-start' }}
        />
        <Typography variant="body2" sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }}>
          {entry.isShared
            ? `${t('Shared with', 'Partagé avec', 'Geteilt mit')} ${entry.sharedOrganizationIds.join(', ')}`
            : t('Only visible to you.', 'Visible uniquement par toi.', 'Nur für dich sichtbar.')}
        </Typography>
        {formatAbsoluteDate(lot.updatedAt) && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {t('Updated', 'Modifié', 'Aktualisiert')} {formatAbsoluteDate(lot.updatedAt)}
          </Typography>
        )}
        {entry.resource && (
          <AppButton
            variant="ghost"
            size="sm"
            href={href}
            onClick={(event) => {
              if (!shouldHandleInternalLinkClick(event)) return;
              event.preventDefault();
              navigateToPath(href, { mainView: 'resources' });
            }}
            sx={{ alignSelf: 'flex-start', mt: 'auto' }}
          >
            {t('Resource details', 'Détails de la ressource', 'Ressourcendetails')} →
          </AppButton>
        )}
      </Box>
      <Box sx={{ p: 1.25, borderTop: '1px solid', borderColor: 'divider' }}>{actions}</Box>
    </Paper>
  );
}
