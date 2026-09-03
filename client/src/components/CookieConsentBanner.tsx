import { Box, Typography } from '../ui/system';
import { AppButton } from './ui/controls';
import { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { isTauriRuntime } from '../services/apiBaseUrl';
import { LS_KEYS } from '../types';
import { setAnalyticsConsent, type AnalyticsConsent } from '../analytics/posthog';
import { navigateToPath } from '../utils/slug';

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    try {
      // Fallback for private browsing / storage-quota contexts — persists for the tab session
      window.sessionStorage.setItem(key, value);
    } catch {
      // Both unavailable; in-memory state handles the rest of the session
    }
  }
}

function readConsent(): boolean {
  return readStorage(LS_KEYS.COOKIE_CONSENT) === '1';
}

export function CookieConsentBanner() {
  const { t } = useI18n();
  const isDesktop = isTauriRuntime();
  const [dismissed, setDismissed] = useState(readConsent);

  if (dismissed) return null;

  const handleChoice = (analyticsConsent: Exclude<AnalyticsConsent, null>) => {
    writeStorage(LS_KEYS.COOKIE_CONSENT, '1');
    setAnalyticsConsent(analyticsConsent);
    setDismissed(true);
  };

  return (
    <Box
      role="region"
      aria-label={t('Cookie notice', 'Avis sur les cookies', 'Cookie-Hinweis')}
      sx={{
        position: 'fixed',
        bottom: { xs: 'calc(64px + env(safe-area-inset-bottom, 0px))', md: 0 },
        left: 0,
        right: 0,
        zIndex: 1500,
        bgcolor: 'background.paper',
        borderTop: '1px solid',
        borderColor: 'divider',
        px: { xs: 2, sm: 3 },
        py: 1.25,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flexWrap: 'wrap',
      }}
    >
      <Typography variant="body2" sx={{ flex: 1, minWidth: 220, color: 'text.secondary' }}>
        {isDesktop
          ? t(
              'This app uses essential local storage for your session and preferences. Optional usage analytics help improve the app; they never record sessions or advertising data.',
              "Cette application utilise un stockage local essentiel pour votre session et vos préférences. Des statistiques d'usage optionnelles aident à améliorer l'app ; elles n'enregistrent ni sessions ni données publicitaires.",
              'Diese App verwendet wesentlichen lokalen Speicher für Sitzung und Einstellungen. Optionale Nutzungsanalysen helfen bei der Verbesserung; Sitzungen oder Werbedaten werden nicht aufgezeichnet.',
            )
          : t(
              'This site uses essential cookies for authentication and preferences. Optional usage analytics help improve the app; they never record sessions or advertising data.',
              "Ce site utilise des cookies essentiels pour l'authentification et les préférences. Des statistiques d'usage optionnelles aident à améliorer l'app ; elles n'enregistrent ni sessions ni données publicitaires.",
              'Diese Website verwendet wesentliche Cookies für Authentifizierung und Einstellungen. Optionale Nutzungsanalysen helfen bei der Verbesserung; Sitzungen oder Werbedaten werden nicht aufgezeichnet.',
            )}
      </Typography>
      <Box
        component="a"
        href="/privacy"
        onClick={(event) => {
          event.preventDefault();
          navigateToPath('/privacy');
        }}
        sx={{ color: 'brand.blue', minHeight: 44, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}
      >
        {t('Privacy details', 'Détails de confidentialité', 'Datenschutzdetails')}
      </Box>
      <AppButton
        variant="secondary"
        size="sm"
        onClick={() => handleChoice('denied')}
        sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
      >
        {t('Essential only', 'Essentiel uniquement', 'Nur erforderlich')}
      </AppButton>
      <AppButton
        variant="secondary"
        size="sm"
        onClick={() => handleChoice('granted')}
        sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
      >
        {t('Allow analytics', "Autoriser l'analyse", 'Analytik erlauben')}
      </AppButton>
    </Box>
  );
}
