import { Box, Stack, Typography, alpha, useTheme } from '../ui/system';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '../ui/widgets';
import { DownloadOutlinedIcon } from '../ui/icons';
import { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { getDesktopInstallerUrl, isTauriRuntime } from '../services/apiBaseUrl';
import { CitizenIdIcon, CitizenIdSignInButton } from './CitizenIdBrand';

export function OnboardingDialog() {
  const {
    account,
    user,
    citizenIdRsiLinkEnabled,
    citizenIdBrandEnvironment,
    linkRsiAccountWithCitizenId,
    updateOnboardingState,
  } = useAuth();
  const { t } = useI18n();
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const isDesktop = isTauriRuntime();

  const step = useMemo(() => {
    if (!account || account.onboardingCompletedAt || account.onboardingDismissedAt) {
      return null;
    }
    if (!account.rsi?.handle) {
      return 'rsi';
    }
    if (!isDesktop) {
      return 'desktop';
    }
    return 'complete';
  }, [account, isDesktop]);

  if (!user || !account || !step) {
    return null;
  }

  const markDismissed = async () => {
    setBusy(true);
    try {
      await updateOnboardingState({ dismissed: true });
    } finally {
      setBusy(false);
    }
  };

  const markCompleted = async () => {
    setBusy(true);
    try {
      await updateOnboardingState({ completed: true });
    } finally {
      setBusy(false);
    }
  };

  const title =
    step === 'rsi'
      ? t('Link your RSI account', 'Lier ton compte RSI', 'RSI-Konto verknuepfen')
      : step === 'desktop'
        ? t('Install the desktop app', 'Installer l app desktop', 'Desktop-App installieren')
        : t('Setup complete', 'Configuration terminee', 'Einrichtung abgeschlossen');

  return (
    <Dialog open maxWidth="sm" fullWidth aria-labelledby="onboarding-title">
      <DialogTitle id="onboarding-title">{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          {step === 'rsi' && (
            <>
              <Typography sx={{ color: 'text.secondary' }}>
                {t(
                  'Citizen iD links your RSI handle and synchronizes your public RSI organizations automatically.',
                  'Citizen iD lie ton handle RSI et synchronise automatiquement tes organisations RSI publiques.',
                  'Citizen iD verknuepft deinen RSI-Handle und synchronisiert deine oeffentlichen RSI-Organisationen automatisch.',
                )}
              </Typography>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                  backgroundColor: alpha(theme.palette.primary.main, 0.06),
                }}
              >
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <CitizenIdIcon environment={citizenIdBrandEnvironment} />
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {t(
                      'This lets ItemFab add your organizations without manual SID entry.',
                      'Cela permet a ItemFab d ajouter tes organisations sans saisie manuelle de SID.',
                      'So kann ItemFab deine Organisationen ohne manuelle SID-Eingabe hinzufuegen.',
                    )}
                  </Typography>
                </Stack>
              </Box>
            </>
          )}

          {step === 'desktop' && (
            <>
              <Typography sx={{ color: 'text.secondary' }}>
                {t(
                  'The desktop app reads Star Citizen logs locally so your blueprints can update automatically in real time.',
                  'L app desktop lit localement les logs Star Citizen afin de mettre a jour tes blueprints automatiquement en temps reel.',
                  'Die Desktop-App liest Star-Citizen-Logs lokal, damit deine Blueprints automatisch in Echtzeit aktualisiert werden.',
                )}
              </Typography>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  border: `1px solid ${alpha(theme.palette.success.main, 0.22)}`,
                  backgroundColor: alpha(theme.palette.success.main, 0.06),
                }}
              >
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {t(
                    'You can keep using the web app, but real-time blueprint capture is available from the desktop app.',
                    'Tu peux continuer avec l app web, mais la capture temps reel des blueprints passe par l app desktop.',
                    'Du kannst die Web-App weiter nutzen, die Echtzeit-Erfassung der Blueprints laeuft aber ueber die Desktop-App.',
                  )}
                </Typography>
              </Box>
            </>
          )}

          {step === 'complete' && (
            <Typography sx={{ color: 'text.secondary' }}>
              {t(
                'Your RSI account is linked and you are already using the desktop app.',
                'Ton compte RSI est lie et tu utilises deja l app desktop.',
                'Dein RSI-Konto ist verknuepft und du nutzt bereits die Desktop-App.',
              )}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1, flexWrap: 'wrap' }}>
        <Button onClick={() => { void markDismissed(); }} disabled={busy}>
          {t('Later', 'Plus tard', 'Spaeter')}
        </Button>
        {step === 'rsi' && (
          <CitizenIdSignInButton
            environment={citizenIdBrandEnvironment}
            disabled={busy || !citizenIdRsiLinkEnabled}
            onClick={() => { linkRsiAccountWithCitizenId('/account'); }}
          />
        )}
        {step === 'desktop' && (
          <>
            <Button
              component="a"
              href={getDesktopInstallerUrl()}
              variant="contained"
              startIcon={<DownloadOutlinedIcon />}
            >
              {t('Download app', 'Telecharger l app', 'App herunterladen')}
            </Button>
            <Button variant="outlined" onClick={() => { void markCompleted(); }} disabled={busy}>
              {t('Done', 'Terminer', 'Fertig')}
            </Button>
          </>
        )}
        {step === 'complete' && (
          <Button variant="contained" onClick={() => { void markCompleted(); }} disabled={busy}>
            {t('Finish', 'Terminer', 'Abschliessen')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
