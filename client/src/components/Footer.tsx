import { Box, Typography } from '../ui/system';
import { useI18n } from '../i18n/I18nContext';
import { navigateToPath } from '../utils/slug';
import { TEXT_LABEL_SM } from '../theme';

export function Footer() {
  const { t } = useI18n();

  return (
    <Box
      component="footer"
      sx={{
        borderTop: 1,
        borderColor: 'divider',
        px: { xs: 1.5, sm: 3 },
        py: 1.5,
        textAlign: 'center',
        mt: 'auto',
        flexShrink: 0,
      }}
    >
      <Typography
        variant="body2"
        sx={{ fontSize: TEXT_LABEL_SM, color: 'text.secondary', lineHeight: 1.5 }}
      >
        {t(
          'This is an unofficial Star Citizen fan site, not affiliated with the Cloud Imperium group of companies. All game content and materials are copyright Cloud Imperium Rights LLC and Cloud Imperium Rights Ltd.',
          'Ceci est un site de fan Star Citizen non officiel, non affilie au groupe Cloud Imperium. Tout le contenu et les materiaux du jeu sont la propriete de Cloud Imperium Rights LLC et Cloud Imperium Rights Ltd.',
        )}
        {' '}
        Star Citizen{'\u00AE'}, Squadron 42{'\u00AE'}, Roberts Space Industries{'\u00AE'},{' '}
        {t('and', 'et')} Cloud Imperium{'\u00AE'}{' '}
        {t(
          'are registered trademarks of Cloud Imperium Rights LLC.',
          'sont des marques deposees de Cloud Imperium Rights LLC.',
        )}
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 0.5, fontSize: TEXT_LABEL_SM, flexWrap: 'wrap' }}>
        <Box component="a"
          href="https://robertsspaceindustries.com"
          target="_blank"
          rel="noopener noreferrer"
          sx={{ fontSize: 'inherit', color: 'brand.blue', textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', '&:hover': { textDecoration: 'underline' } }}
        >
          robertsspaceindustries.com
        </Box>
        <Typography component="span" aria-hidden="true" sx={{ color: 'text.disabled', fontSize: 'inherit' }}>|</Typography>
        <Typography component="span" sx={{ color: 'text.secondary', fontSize: 'inherit' }}>
          {t('External media credit:', 'Credit medias externes :')}{' '}
          <Box component="a" sx={{ color: 'brand.blue', textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', '&:hover': { textDecoration: 'underline' } }} href="https://starcitizen.tools" target="_blank" rel="noopener noreferrer">
            starcitizen.tools
          </Box>
        </Typography>
        <Typography component="span" aria-hidden="true" sx={{ color: 'text.disabled', fontSize: 'inherit' }}>|</Typography>
        <Typography component="span" sx={{ color: 'text.secondary', fontSize: 'inherit' }}>
          {t('Made by', 'Fait par')}{' '}
          <Box component="a" sx={{ color: 'brand.blue', textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', '&:hover': { textDecoration: 'underline' } }} href="https://x.com/ThSamon" target="_blank" rel="noopener noreferrer">
            @ThSamon
          </Box>
        </Typography>
        <Typography component="span" aria-hidden="true" sx={{ color: 'text.disabled', fontSize: 'inherit' }}>|</Typography>
        <Box component="a"
          href="/privacy"
          sx={{ fontSize: 'inherit', color: 'brand.blue', textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center', '&:hover': { textDecoration: 'underline' } }}
          onClick={(e) => { e.preventDefault(); navigateToPath('/privacy'); }}
        >
          {t('Privacy Policy', 'Politique de confidentialité', 'Datenschutzerklärung')}
        </Box>
      </Box>
    </Box>
  );
}
