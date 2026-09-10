import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import type { AccountDatasetScope, StoredAccount } from '../../services/authService';
import {
  fetchMarketplaceReports,
  moderateMarketplaceReport,
  type MarketplaceReport,
  type MarketplaceReportReason,
} from '../../services/marketplaceService';
import { Box, Paper, Stack, Typography } from '../../ui/system';
import { AppButton, AppSelect, AppTextField } from '../ui/controls';
import { AppAlert } from '../ui/feedback';
import { AppDialog } from '../ui/overlays';

export function MarketplaceReportDialog({
  ownerHandle,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  ownerHandle: string | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (reason: MarketplaceReportReason) => void;
}) {
  const { t } = useI18n();
  const [reason, setReason] = useState<MarketplaceReportReason>('misleading');
  useEffect(() => {
    setReason('misleading');
  }, [ownerHandle]);
  return (
    <AppDialog
      open={Boolean(ownerHandle)}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      title={t('Report a listing', 'Signaler une annonce', 'Angebot melden')}
      footer={
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <AppButton variant="secondary" disabled={busy} onClick={onClose}>
            {t('Cancel', 'Annuler', 'Abbrechen')}
          </AppButton>
          <AppButton disabled={busy} onClick={() => onSubmit(reason)}>
            {t('Send report', 'Envoyer le signalement', 'Meldung senden')}
          </AppButton>
        </Stack>
      }
    >
      <Stack spacing={2}>
        <Typography>
          {t(
            `Report listings from ${ownerHandle ?? ''} to app moderators.`,
            `Signaler les annonces de ${ownerHandle ?? ''} aux modérateurs de l’app.`,
            `Angebote von ${ownerHandle ?? ''} an App-Moderatoren melden.`,
          )}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t(
            'Reports are private. The other player will not see your identity or report.',
            'Les signalements sont privés. Le joueur ne verra ni ton identité ni ton signalement.',
            'Meldungen sind privat. Der andere Spieler sieht weder deine Identität noch deine Meldung.',
          )}
        </Typography>
        {error && <AppAlert severity="error">{error}</AppAlert>}
        <AppSelect
          label={t('Reason', 'Motif', 'Grund')}
          value={reason}
          onValueChange={(value) => {
            if (value) setReason(value);
          }}
          disabled={busy}
          options={[
            {
              value: 'misleading',
              label: t(
                'Misleading or unavailable offer',
                'Offre trompeuse ou indisponible',
                'Irreführendes oder nicht verfügbares Angebot',
              ),
            },
            {
              value: 'spam',
              label: t(
                'Spam or repeated solicitation',
                'Spam ou sollicitations répétées',
                'Spam oder wiederholte Anfragen',
              ),
            },
            {
              value: 'abuse',
              label: t('Abusive behavior', 'Comportement abusif', 'Missbräuchliches Verhalten'),
            },
          ]}
        />
      </Stack>
    </AppDialog>
  );
}

export function MarketplaceSafety({
  account,
  busy,
  onBlock,
}: {
  account: StoredAccount;
  busy: boolean;
  onBlock: (handle: string, blocked: boolean) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [handle, setHandle] = useState('');
  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography component="h2" variant="h5" sx={{ fontWeight: 700 }}>
          {t('Safety & privacy', 'Sécurité et confidentialité', 'Sicherheit & Datenschutz')}
        </Typography>
        <Typography sx={{ color: 'text.secondary', mt: 0.75 }}>
          {t(
            'You decide who can contact you through community craft requests.',
            'Tu décides qui peut te contacter via les demandes de craft communautaires.',
            'Du entscheidest, wer dir Community-Craft-Anfragen senden kann.',
          )}
        </Typography>
      </Box>
      <AppAlert severity="info">
        {t(
          'Blocking hides each player’s listings from the other and stops new community craft requests between you. Existing requests remain in Account, where you can close them. Organization sharing is managed separately.',
          'Le blocage masque vos annonces respectives et empêche les nouvelles demandes de craft communautaires entre vous. Les demandes existantes restent dans Account, où tu peux les clôturer. Les partages d’organisation se gèrent séparément.',
          'Blockieren verbirgt eure Angebote voreinander und verhindert neue Community-Craft-Anfragen zwischen euch. Bestehende Anfragen bleiben im Konto und können dort geschlossen werden. Organisationsfreigaben werden getrennt verwaltet.',
        )}
      </AppAlert>
      <Paper
        component="form"
        variant="outlined"
        sx={{ p: 2, display: 'flex', gap: 1.5, alignItems: 'flex-end', flexWrap: 'wrap' }}
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && handle.trim())
            void onBlock(handle.trim(), true).then((ok) => {
              if (ok) setHandle('');
            });
        }}
      >
        <AppTextField
          label={t('RSI handle to block', 'Handle RSI à bloquer', 'Zu blockierender RSI-Handle')}
          value={handle}
          onValueChange={setHandle}
          maxLength={60}
          disabled={busy}
          fieldSx={{ flex: '1 1 240px' }}
        />
        <AppButton type="submit" variant="secondary" disabled={busy || !handle.trim()}>
          {t('Block player', 'Bloquer ce joueur', 'Spieler blockieren')}
        </AppButton>
      </Paper>
      <Typography component="h3" sx={{ fontWeight: 700 }}>
        {t('Blocked players', 'Joueurs bloqués', 'Blockierte Spieler')}
      </Typography>
      {(account.marketplace?.blockedHandles ?? []).length === 0 && (
        <Typography sx={{ color: 'text.secondary' }}>
          {t('You have not blocked anyone.', 'Tu n’as bloqué personne.', 'Du hast niemanden blockiert.')}
        </Typography>
      )}
      {(account.marketplace?.blockedHandles ?? []).map((blocked) => (
        <Paper
          key={blocked}
          variant="outlined"
          sx={{ p: 1.5, display: 'flex', gap: 1.5, alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Typography sx={{ overflowWrap: 'anywhere', minWidth: 0 }}>{blocked}</Typography>
          <AppButton
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => {
              void onBlock(blocked, false);
            }}
          >
            {t('Unblock', 'Débloquer', 'Entsperren')}
          </AppButton>
        </Paper>
      ))}
      <AppButton href="/account?section=requests" variant="ghost" sx={{ alignSelf: 'flex-start' }}>
        {t('Manage my requests', 'Gérer mes demandes', 'Meine Anfragen verwalten')}
      </AppButton>
    </Stack>
  );
}

export function MarketplaceModeration({ scope }: { scope: AccountDatasetScope }) {
  const { t, lang } = useI18n();
  const reasons = {
    spam: t('Spam', 'Spam', 'Spam'),
    misleading: t('Misleading offer', 'Offre trompeuse', 'Irreführendes Angebot'),
    abuse: t('Abusive behavior', 'Comportement abusif', 'Missbräuchliches Verhalten'),
  };
  const statuses = {
    pending: t('To review', 'À examiner', 'Zu prüfen'),
    dismissed: t('Dismissed', 'Classé sans suite', 'Geschlossen'),
    suspended: t('Suspended', 'Suspendu', 'Gesperrt'),
    restored: t('Restored', 'Rétabli', 'Wiederhergestellt'),
  };
  const [reports, setReports] = useState<MarketplaceReport[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    id: string;
    handle: string;
    action: 'suspend' | 'restore';
  } | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    return () => {
      generation.current += 1;
    };
  }, []);
  const load = async (next?: string) => {
    const current = generation.current;
    setBusy(true);
    setError(null);
    try {
      const result = await fetchMarketplaceReports(scope, next);
      if (generation.current !== current) return;
      setReports((old) =>
        next
          ? [...old, ...result.reports.filter((report) => !old.some((item) => item.id === report.id))]
          : result.reports,
      );
      setCursor(result.nextCursor);
    } catch (err) {
      if (generation.current === current)
        setError(err instanceof Error ? err.message : 'Unable to load reports.');
    } finally {
      if (generation.current === current) setBusy(false);
    }
  };
  useEffect(() => {
    void load();
  }, [scope]);
  const moderate = async (id: string, action: 'dismiss' | 'suspend' | 'restore') => {
    const current = generation.current;
    setBusy(true);
    setError(null);
    try {
      const result = await moderateMarketplaceReport(scope, id, action);
      if (generation.current !== current) return;
      setReports((old) => old.map((report) => (report.id === id ? result.report : report)));
      setConfirmation(null);
    } catch (err) {
      if (generation.current === current)
        setError(err instanceof Error ? err.message : 'Unable to moderate report.');
    } finally {
      if (generation.current === current) setBusy(false);
    }
  };
  return (
    <Stack spacing={2}>
      <Typography component="h2" variant="h5" sx={{ fontWeight: 700 }}>
        {t('Community moderation', 'Modération communautaire', 'Community-Moderation')}
      </Typography>
      <Typography sx={{ color: 'text.secondary' }}>
        {t(
          'Reports are allegations to review. Suspending a player withdraws their listings and prevents new community requests.',
          'Les signalements sont des faits à vérifier. Suspendre un joueur retire ses annonces et empêche les nouvelles demandes communautaires.',
          'Meldungen müssen geprüft werden. Eine Sperre zieht Angebote zurück und verhindert neue Community-Anfragen.',
        )}
      </Typography>
      {error && <AppAlert severity="error">{error}</AppAlert>}
      <AppButton
        variant="secondary"
        disabled={busy}
        onClick={() => {
          void load();
        }}
        sx={{ alignSelf: 'flex-start' }}
      >
        {t('Refresh reports', 'Actualiser les signalements', 'Meldungen aktualisieren')}
      </AppButton>
      {!reports.length && !busy && (
        <Typography>
          {t('No reports to review.', 'Aucun signalement à examiner.', 'Keine Meldungen zu prüfen.')}
        </Typography>
      )}
      {reports.map((report) => (
        <Paper key={report.id} variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1}>
            <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
              {report.ownerHandle} · {reasons[report.reason]}
            </Typography>
            <Typography variant="body2">
              {t('Reported by', 'Signalé par', 'Gemeldet von')}{' '}
              {report.reporterHandle ??
                t('Identity not displayed', 'Identité non affichée', 'Identität nicht angezeigt')}{' '}
              · {statuses[report.status]} · {new Date(report.createdAt).toLocaleString(lang)}
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {report.status === 'pending' && (
                <>
                  <AppButton
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      void moderate(report.id, 'dismiss');
                    }}
                  >
                    {t('Dismiss report', 'Classer sans suite', 'Meldung schließen')}
                  </AppButton>
                  <AppButton
                    variant="danger"
                    disabled={busy}
                    onClick={() =>
                      setConfirmation({ id: report.id, handle: report.ownerHandle, action: 'suspend' })
                    }
                  >
                    {t('Suspend player', 'Suspendre le joueur', 'Spieler sperren')}
                  </AppButton>
                </>
              )}
              {report.status === 'suspended' && (
                <AppButton
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    setConfirmation({ id: report.id, handle: report.ownerHandle, action: 'restore' })
                  }
                >
                  {t('Restore access', 'Rétablir l’accès', 'Zugang wiederherstellen')}
                </AppButton>
              )}
            </Stack>
          </Stack>
        </Paper>
      ))}
      {cursor && (
        <AppButton
          variant="secondary"
          disabled={busy}
          onClick={() => {
            void load(cursor);
          }}
        >
          {t('Load more reports', 'Charger plus de signalements', 'Weitere Meldungen laden')}
        </AppButton>
      )}
      <AppDialog
        open={Boolean(confirmation)}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirmation(null);
        }}
        title={t('Confirm moderation action', 'Confirmer la modération', 'Moderationsaktion bestätigen')}
        footer={
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <AppButton variant="secondary" disabled={busy} onClick={() => setConfirmation(null)}>
              {t('Cancel', 'Annuler', 'Abbrechen')}
            </AppButton>
            <AppButton
              disabled={busy}
              onClick={() => {
                if (confirmation) void moderate(confirmation.id, confirmation.action);
              }}
            >
              {t('Confirm', 'Confirmer', 'Bestätigen')}
            </AppButton>
          </Stack>
        }
      >
        {error && <AppAlert severity="error">{error}</AppAlert>}
        <Typography>
          {confirmation?.action === 'suspend'
            ? t(
                `Suspend community access for ${confirmation?.handle}?`,
                `Suspendre l’accès communautaire de ${confirmation?.handle} ?`,
                `Community-Zugang für ${confirmation?.handle} sperren?`,
              )
            : t(
                `Restore community access for ${confirmation?.handle}?`,
                `Rétablir l’accès communautaire de ${confirmation?.handle} ?`,
                `Community-Zugang für ${confirmation?.handle} wiederherstellen?`,
              )}
        </Typography>
      </AppDialog>
    </Stack>
  );
}
