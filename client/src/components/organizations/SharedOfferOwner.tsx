import { Box, Typography } from '../../ui/system';
import { useI18n } from '../../i18n/I18nContext';
import { sanitizeExternalHttpsUrl } from '../../utils/urlSafety';
import { Avatar } from '../ui/primitives';
import type { SharedOfferOwner } from './sharedOfferTypes';

export function SharedOfferOwnerIdentity({ owner }: { owner: SharedOfferOwner }) {
  const { t } = useI18n();
  return <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
    <Avatar src={sanitizeExternalHttpsUrl(owner.imageUrl) ?? undefined} alt="" sx={{ width: 38, height: 38 }}>{(owner.displayName || owner.handle).charAt(0).toUpperCase()}</Avatar>
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>{t('Offered by', 'Proposé par', 'Angeboten von')}</Typography>
      <Box component="a" href={`https://robertsspaceindustries.com/citizens/${encodeURIComponent(owner.handle)}`} target="_blank" rel="noopener noreferrer" sx={{ color: 'text.primary', textDecoration: 'none', fontSize: '.875rem', fontWeight: 700, overflowWrap: 'anywhere', '&:hover': { textDecoration: 'underline' }, '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 3 } }}>{owner.displayName || owner.handle}</Box>
      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', overflowWrap: 'anywhere' }}>@{owner.handle}{owner.rank ? ` · ${owner.rank}` : ''}</Typography>
    </Box>
  </Box>;
}
