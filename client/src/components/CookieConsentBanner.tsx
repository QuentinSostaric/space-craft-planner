import { Box, Typography } from '../ui/system';
import { AppButton } from './ui/controls';
import { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { isTauriRuntime } from '../services/apiBaseUrl';
import { LS_KEYS } from '../types';

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

  const handleDismiss = () => {
    writeStorage(LS_KEYS.COOKIE_CONSENT, '1');
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
              'This app stores your authentication credentials securely on your device and uses local storage for your preferences. No tracking or advertising data is collected.',
              "Cette application stocke vos identifiants d'authentification de manière sécurisée sur votre appareil et utilise le stockage local pour vos préférences. Aucune donnée de suivi ou publicitaire n'est collectée.",
              'Diese App speichert Ihre Anmeldedaten sicher auf Ihrem Gerät und verwendet lokalen Speicher für Ihre Einstellungen. Es werden keine Tracking- oder Werbedaten gesammelt.',
            )
          : t(
              'This site uses strictly necessary cookies for authentication only. No tracking or advertising cookies are used.',
              "Ce site utilise uniquement des cookies strictement nécessaires à l'authentification. Aucun cookie de suivi ou publicitaire n'est utilisé.",
              'Diese Website verwendet ausschließlich für die Authentifizierung notwendige Cookies. Es werden keine Tracking- oder Werbe-Cookies verwendet.',
            )}
      </Typography>
      <AppButton
        variant="primary"
        size="sm"
        onClick={handleDismiss}
        sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
      >
        {t('Got it', 'Compris', 'Verstanden')}
      </AppButton>
    </Box>
  );
}
