import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import { useI18n } from '../i18n/I18nContext';

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
        flexShrink: 0,
      }}
    >
      <Typography
        variant="body2"
        sx={{ fontSize: '.65rem', color: 'text.secondary', lineHeight: 1.5 }}
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
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 0.5, fontSize: '.65rem', flexWrap: 'wrap' }}>
        <Link
          href="https://robertsspaceindustries.com"
          target="_blank"
          rel="noopener noreferrer"
          sx={{ fontSize: 'inherit' }}
        >
          robertsspaceindustries.com
        </Link>
        <Typography component="span" aria-hidden="true" sx={{ color: 'text.disabled', fontSize: 'inherit' }}>|</Typography>
        <Typography component="span" sx={{ color: 'text.secondary', fontSize: 'inherit' }}>
          {t('External media credit:', 'Credit medias externes :')}{' '}
          <Link href="https://starcitizen.tools" target="_blank" rel="noopener noreferrer">
            starcitizen.tools
          </Link>
        </Typography>
        <Typography component="span" aria-hidden="true" sx={{ color: 'text.disabled', fontSize: 'inherit' }}>|</Typography>
        <Typography component="span" sx={{ color: 'text.secondary', fontSize: 'inherit' }}>
          {t('Made by', 'Fait par')}{' '}
          <Link href="https://x.com/ThSamon" target="_blank" rel="noopener noreferrer">
            @ThSamon
          </Link>
        </Typography>
      </Box>
    </Box>
  );
}
