import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { useI18n } from '../../../i18n/I18nContext';

export function QualityScore({ score }: { score: number }) {
  const { t } = useI18n();
  const theme = useTheme();
  
  const tier = score >= 80 ? 'success' : score >= 50 ? 'info' : score >= 25 ? 'warning' : 'error';
  const labels = {
    success: t('Excellent', 'Excellent'),
    info: t('Good', 'Bon'),
    warning: t('Fair', 'Moyen'),
    error: t('Poor', 'Faible'),
  };
  
  const tierColor = theme.palette[tier].main;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }} aria-label={`${t('Build index', 'Indice de build')}: ${score}/100`}>
      <Box sx={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
        <svg viewBox="0 0 44 44" aria-hidden="true" style={{ width: '100%', height: '100%' }}>
          <circle cx="22" cy="22" r="18" fill="none" stroke={theme.palette.divider} strokeWidth="3" />
          <circle cx="22" cy="22" r="18" fill="none" stroke={tierColor} strokeWidth="3"
            strokeDasharray={`${(score / 100) * 113.1} 113.1`} strokeDashoffset="0"
            strokeLinecap="butt" transform="rotate(-90 22 22)" />
        </svg>
        <Typography
          variant="caption"
          sx={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Share Tech Mono', monospace", fontWeight: 700, fontSize: '0.85rem',
          }}
        >
          {score}
        </Typography>
      </Box>
      <Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '.08em', display: 'block' }}>
          {t('Build index', 'Indice de build')}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 700, color: tierColor, fontSize: '0.85rem' }}>
          {labels[tier]}
        </Typography>
      </Box>
    </Box>
  );
}
