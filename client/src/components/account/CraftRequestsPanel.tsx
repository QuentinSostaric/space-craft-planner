import { Box, Paper, Stack, Typography, alpha, useTheme } from '../../ui/system';
import { Avatar } from '../ui/primitives';
import { AppAlert } from '../ui/feedback';
import { useMemo } from 'react';
import { type AccountSyncStatus, type OptimisticAccountState } from '../../auth/accountMutations';
import { useLocalPersist } from '../../hooks/useLocalPersist';
import { useI18n } from '../../i18n/I18nContext';
import type {
  AccountCraftRequest,
  AccountCraftRequestStatus,
  StoredAccount,
} from '../../services/authService';
import { Button } from '../ui/Button';
import { AppButton } from '../ui/controls/AppButton';
import { SurfaceState } from '../ui/feedback/SurfaceState';
import { AppChip } from '../ui/data-display/AppChip';

type CraftRequestViewMode = 'incoming' | 'outgoing' | 'all';
type CraftRequestStatusFilter = 'all' | 'active' | AccountCraftRequestStatus;
type CraftRequestDecision = 'accepted' | 'denied' | 'closed' | 'deleted';
type CraftRequestFeedDirection = 'incoming' | 'outgoing';
type TranslateFn = (en: string, fr: string, de: string) => string;

interface CraftRequestsPanelProps {
  account: StoredAccount | null;
  optimisticState: OptimisticAccountState;
  syncStatus: AccountSyncStatus;
  syncError: string | null;
  craftRequestActionId: string | null;
  craftRequestError: string | null;
  craftRequestNotice: string | null;
  onRespondToCraftRequest: (requestId: string, decision: CraftRequestDecision) => void;
}

interface CraftRequestFeedEntry {
  request: AccountCraftRequest;
  direction: CraftRequestFeedDirection;
  counterpartDisplayName: string;
  counterpartAvatarUrl: string | null;
  counterpartRsiHandle: string | null;
}

function formatAbsoluteDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}

function getCraftRequestSortTimestamp(request: AccountCraftRequest): number {
  const timestamp = Date.parse(request.updatedAt ?? request.createdAt ?? '');
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function isCraftRequestActiveStatus(status: AccountCraftRequestStatus): boolean {
  return status === 'pending' || status === 'accepted';
}

function getCraftRequestStatusMeta(
  t: TranslateFn,
  status: AccountCraftRequestStatus,
): {
  label: string;
  color: 'warning' | 'success' | 'error' | 'default';
  summary: string;
} {
  switch (status) {
    case 'accepted':
      return {
        label: t('Accepted', 'Acceptee', 'Angenommen'),
        color: 'success',
        summary: t(
          'Accepted. Keep the coordination going and close the request when the craft is done.',
          'Acceptee. Continuez la coordination puis cloturez la demande quand le craft est termine.',
          'Angenommen. Koordiniert euch weiter und schliesst die Anfrage, wenn der Craft erledigt ist.',
        ),
      };
    case 'denied':
      return {
        label: t('Denied', 'Refusee', 'Abgelehnt'),
        color: 'error',
        summary: t(
          'Denied. Leave it in history or close it to archive it.',
          'Refusee. Laisse-la dans l historique ou cloture-la pour l archiver.',
          'Abgelehnt. Lass sie in der Historie oder schliesse sie zum Archivieren.',
        ),
      };
    case 'closed':
      return {
        label: t('Closed', 'Cloturee', 'Geschlossen'),
        color: 'default',
        summary: t(
          'Closed and archived in the account activity.',
          'Cloturee et archivee dans l activite du compte.',
          'Geschlossen und in der Kontoaktivitat archiviert.',
        ),
      };
    default:
      return {
        label: t('Pending', 'En attente', 'Ausstehend'),
        color: 'warning',
        summary: t(
          'Pending. Waiting for an answer from the blueprint owner.',
          'En attente. La demande attend encore la reponse du proprietaire du blueprint.',
          'Ausstehend. Die Anfrage wartet noch auf die Antwort des Blueprint-Besitzers.',
        ),
      };
  }
}

export function CraftRequestsPanel({
  account,
  optimisticState,
  syncStatus,
  syncError,
  craftRequestActionId,
  craftRequestError,
  craftRequestNotice,
  onRespondToCraftRequest,
}: CraftRequestsPanelProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const [viewMode, setViewMode] = useLocalPersist<CraftRequestViewMode>('craft-requests-view-mode', 'all');
  const [statusFilter, setStatusFilter] = useLocalPersist<CraftRequestStatusFilter>('craft-requests-status-filter', 'all');

  const incomingCraftRequests = account?.incomingCraftRequests ?? [];
  const outgoingCraftRequests = account?.outgoingCraftRequests ?? [];

  const syncingCraftRequestIds = useMemo(() => {
    const nextIds = new Set<string>();
    for (const mutation of optimisticState.pendingMutations) {
      if (mutation.kind === 'craft-request-create') {
        nextIds.add(mutation.payload.tempRequestId);
      } else if (mutation.kind === 'craft-request-decision') {
        nextIds.add(mutation.payload.requestId);
      }
    }
    return nextIds;
  }, [optimisticState.pendingMutations]);

  const craftRequestEntries = useMemo<CraftRequestFeedEntry[]>(() => {
    const incomingEntries = incomingCraftRequests.map((request) => ({
      request,
      direction: 'incoming' as const,
      counterpartDisplayName: request.requesterDisplayName,
      counterpartAvatarUrl: request.requesterAvatarUrl,
      counterpartRsiHandle: request.requesterRsiHandle,
    }));
    const outgoingEntries = outgoingCraftRequests.map((request) => ({
      request,
      direction: 'outgoing' as const,
      counterpartDisplayName: request.ownerDisplayName,
      counterpartAvatarUrl: request.ownerAvatarUrl,
      counterpartRsiHandle: request.ownerRsiHandle,
    }));

    return [...incomingEntries, ...outgoingEntries].sort(
      (left, right) => getCraftRequestSortTimestamp(right.request) - getCraftRequestSortTimestamp(left.request),
    );
  }, [incomingCraftRequests, outgoingCraftRequests]);

  const pendingIncomingCraftRequestCount = useMemo(
    () => incomingCraftRequests.filter((request) => request.status === 'pending').length,
    [incomingCraftRequests],
  );
  const activeCraftRequestCount = useMemo(
    () => craftRequestEntries.filter((entry) => isCraftRequestActiveStatus(entry.request.status)).length,
    [craftRequestEntries],
  );
  const closedCraftRequestCount = useMemo(
    () => craftRequestEntries.filter((entry) => entry.request.status === 'closed').length,
    [craftRequestEntries],
  );

  const filteredCraftRequestEntries = useMemo(
    () =>
      craftRequestEntries.filter((entry) => {
        if (viewMode !== 'all' && entry.direction !== viewMode) {
          return false;
        }
        if (statusFilter === 'all') {
          return true;
        }
        if (statusFilter === 'active') {
          return isCraftRequestActiveStatus(entry.request.status);
        }
        return entry.request.status === statusFilter;
      }),
    [craftRequestEntries, statusFilter, viewMode],
  );

  const getCraftRequestResourcesLabel = (request: AccountCraftRequest) => {
    if (request.resourcesOption === 'has_resources') {
      return t(
        'Requester has the resources',
        'Le demandeur a les ressources',
        'Anfragender hat die Ressourcen',
      );
    }
    if (request.resourcesOption === 'buy_resources') {
      return t(
        'Requester buys the resources',
        'Le demandeur achete les ressources',
        'Anfragender kauft die Ressourcen',
      );
    }
    return null;
  };

  const getCraftRequestTimelineTitle = (request: AccountCraftRequest) => {
    if (request.status === 'accepted' || request.status === 'denied') {
      return t('Answered', 'Repondue', 'Beantwortet');
    }
    if (request.status === 'closed') {
      return t('Closed', 'Cloturee', 'Geschlossen');
    }
    return t('Created', 'Creee', 'Erstellt');
  };

  const getCraftRequestTimelineLabel = (request: AccountCraftRequest) => {
    if (request.status === 'accepted' || request.status === 'denied') {
      return formatAbsoluteDate(request.respondedAt ?? request.updatedAt ?? request.createdAt);
    }
    if (request.status === 'closed') {
      return formatAbsoluteDate(request.updatedAt ?? request.createdAt);
    }
    return formatAbsoluteDate(request.createdAt);
  };

  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.25, md: 1.5 } }}>
      <Stack spacing={1.5}>
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={1}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', lg: 'center' }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="overline"
              sx={{ color: 'secondary.main', letterSpacing: '0.14em' }}
            >
              {t('Craft requests', 'Demandes de craft', 'Craft-Anfragen')}
            </Typography>
            <Typography variant="h6" sx={{ mt: 0.25 }}>
              {t('Workflow, statuses and Discord follow-up', 'Workflow, statuts et suivi Discord', 'Workflow, Status und Discord-Follow-up')}
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.75, color: 'text.secondary', maxWidth: 780 }}>
              {t(
                'Track each request from the first ask to the archive state: comment, resource arrangement, Discord delivery and contact initiation all stay visible here.',
                'Suis chaque demande du premier message jusqu a l archivage : commentaire, arrangement sur les ressources, envoi Discord et mise en relation restent visibles ici.',
                'Verfolge jede Anfrage vom ersten Kontakt bis zum Archivstatus: Kommentar, Ressourcenabstimmung, Discord-Zustellung und Kontaktstart bleiben hier sichtbar.',
              )}
            </Typography>
          </Box>

          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            <AppChip
              label={t(
                `${pendingIncomingCraftRequestCount} awaiting you`,
                `${pendingIncomingCraftRequestCount} a traiter`,
                `${pendingIncomingCraftRequestCount} warten auf dich`,
              )}
              size="sm"
              tone="warning"
            />
            <AppChip
              label={t(
                `${activeCraftRequestCount} active`,
                `${activeCraftRequestCount} actives`,
                `${activeCraftRequestCount} aktiv`,
              )}
              size="sm"
              outlined
            />
            <AppChip
              label={t(
                `${closedCraftRequestCount} closed`,
                `${closedCraftRequestCount} cloturees`,
                `${closedCraftRequestCount} geschlossen`,
              )}
              size="sm"
              outlined
            />
          </Stack>
        </Stack>

        {syncError && (
          <AppAlert severity="error">
            {syncError}
          </AppAlert>
        )}

        {(syncStatus === 'pending' || syncStatus === 'syncing') && syncingCraftRequestIds.size > 0 && (
          <AppAlert severity="info">
            {t(
              'Craft request changes are still syncing to the cloud. The interface is already updated locally.',
              'Les changements de demandes de craft se synchronisent encore vers le cloud. L interface est deja mise a jour localement.',
              'Craft-Anfragen werden noch mit der Cloud synchronisiert. Die Oberfläche ist lokal bereits aktualisiert.',
            )}
          </AppAlert>
        )}

        {craftRequestError && (
          <AppAlert severity="error">
            {craftRequestError}
          </AppAlert>
        )}

        {craftRequestNotice && (
          <AppAlert severity="success">
            {craftRequestNotice}
          </AppAlert>
        )}

        <Stack spacing={1}>
          <Box
            role="group"
            aria-label={t('Request direction', 'Direction des demandes', 'Anfragerichtung')}
            sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}
          >
            {([
              ['incoming', t('Incoming', 'Entrantes', 'Eingehend')],
              ['outgoing', t('Outgoing', 'Sortantes', 'Ausgehend')],
              ['all', t('All', 'Tout', 'Alle')],
            ] as const).map(([value, label]) => (
              <AppButton
                key={value}
                variant={viewMode === value ? 'secondary' : 'ghost'}
                size="sm"
                ariaPressed={viewMode === value}
                onClick={() => setViewMode(value)}
                sx={{ minHeight: 44 }}
              >
                {label}
              </AppButton>
            ))}
          </Box>
          <Box
            role="group"
            aria-label={t('Request status', 'Statut des demandes', 'Anfragestatus')}
            sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}
          >
            {([
              ['active', t('Active', 'Actives', 'Aktiv')],
              ['pending', t('Pending', 'En attente', 'Ausstehend')],
              ['accepted', t('Accepted', 'Acceptees', 'Angenommen')],
              ['denied', t('Denied', 'Refusees', 'Abgelehnt')],
              ['closed', t('Closed', 'Cloturees', 'Geschlossen')],
              ['all', t('All statuses', 'Tous les statuts', 'Alle Status')],
            ] as const).map(([value, label]) => (
              <AppButton
                key={value}
                variant={statusFilter === value ? 'secondary' : 'ghost'}
                size="sm"
                ariaPressed={statusFilter === value}
                onClick={() => setStatusFilter(value)}
                sx={{ minHeight: 44 }}
              >
                {label}
              </AppButton>
            ))}
          </Box>
        </Stack>

        {filteredCraftRequestEntries.length === 0 ? (
          <SurfaceState
            title={t('No craft requests match this view', 'Aucune demande de craft dans cette vue', 'Keine Craft-Anfragen in dieser Ansicht')}
            description={t(
              'Switch the direction or status filter to inspect the rest of your request history.',
              'Change le filtre de direction ou de statut pour consulter le reste de ton historique de demandes.',
              'Wechsle den Richtungs- oder Statusfilter, um den Rest deiner Anfragenhistorie zu sehen.',
            )}
          />
        ) : (
          <Box>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' },
                gap: 1.25,
              }}
            >
              {filteredCraftRequestEntries.map((entry) => {
                const { request, direction, counterpartDisplayName, counterpartAvatarUrl, counterpartRsiHandle } = entry;
                const statusMeta = getCraftRequestStatusMeta(t, request.status);
                const resourcesLabel = getCraftRequestResourcesLabel(request);
                const isSyncing = syncingCraftRequestIds.has(request.id);
                const canAnswer = direction === 'incoming' && request.status === 'pending';
                const canClose = request.status !== 'closed' && !canAnswer;
                const canDelete = request.status === 'denied' || request.status === 'closed';
                const closeLabel =
                  direction === 'outgoing' && request.status === 'pending'
                    ? t('Cancel request', 'Annuler la demande', 'Anfrage abbrechen')
                    : t('Close', 'Clore', 'Schliessen');
                const timelineTitle = getCraftRequestTimelineTitle(request);
                const timelineLabel = getCraftRequestTimelineLabel(request);

                return (
                  <Paper
                    key={`${direction}:${request.id}`}
                    variant="outlined"
                    sx={{
                      p: 1.25,
                      borderColor: alpha(theme.palette.primary.main, 0.14),
                      backgroundColor: alpha(theme.palette.background.default, 0.18),
                    }}
                  >
                    <Stack spacing={1.2}>
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                        justifyContent="space-between"
                        alignItems={{ xs: 'flex-start', sm: 'flex-start' }}
                      >
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                          <Avatar
                            src={counterpartAvatarUrl ?? undefined}
                            alt={counterpartDisplayName}
                            sx={{ width: 38, height: 38 }}
                          >
                            {(counterpartDisplayName || '?').charAt(0).toUpperCase()}
                          </Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
                              {request.blueprintName}
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
                              {t(
                                `${counterpartDisplayName} via ${request.organizationName}`,
                                `${counterpartDisplayName} via ${request.organizationName}`,
                                `${counterpartDisplayName} uber ${request.organizationName}`,
                              )}
                            </Typography>
                          </Box>
                        </Stack>

                        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                          <AppChip
                            label={
                              direction === 'incoming'
                                ? t('Incoming', 'Entrante', 'Eingehend')
                                : t('Outgoing', 'Sortante', 'Ausgehend')
                            }
                            size="sm"
                            outlined
                          />
                          <AppChip
                            label={statusMeta.label}
                            size="sm"
                            tone={statusMeta.color === 'error' ? 'danger' : statusMeta.color}
                            outlined
                          />
                        </Stack>
                      </Stack>

                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {direction === 'incoming' && request.status === 'pending'
                          ? t(
                            'You own this blueprint. Answer here or let the Discord bot buttons handle it.',
                            'Tu possedes ce blueprint. Reponds ici ou laisse les boutons du bot Discord le faire.',
                            'Du besitzt diesen Blueprint. Antworte hier oder lass die Discord-Bot-Buttons das erledigen.',
                          )
                          : statusMeta.summary}
                      </Typography>

                      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                        {resourcesLabel && (
                          <AppChip
                            label={resourcesLabel}
                            size="sm"
                            outlined
                          />
                        )}
                        {request.ownerDiscordMessageId && (
                          <AppChip
                            label={t('Discord bot notified', 'Bot Discord notifie', 'Discord-Bot benachrichtigt')}
                            size="sm"
                            outlined
                          />
                        )}
                        {request.contactInitiatedAt && (
                          <AppChip
                            label={t('Contact initiated', 'Mise en relation lancee', 'Kontakt gestartet')}
                            size="sm"
                            tone="info"
                            outlined
                          />
                        )}
                        {isSyncing && (
                          <AppChip
                            label={t('Syncing', 'Synchronisation', 'Synchronisiert')}
                            size="sm"
                            tone="warning"
                          />
                        )}
                      </Stack>

                      {request.comment && (
                        <Box
                          sx={{
                            p: 1,
                            borderRadius: 1.5,
                            border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                            backgroundColor: alpha(theme.palette.background.paper, 0.42),
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              display: 'block',
                              color: 'text.secondary',
                              mb: 0.5,
                            }}
                          >
                            {t('Comment', 'Commentaire', 'Kommentar')}
                          </Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                            {request.comment}
                          </Typography>
                        </Box>
                      )}

                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                          gap: 0.9,
                        }}
                      >
                        <Paper
                          variant="outlined"
                          sx={{ p: 1, backgroundColor: alpha(theme.palette.background.paper, 0.35) }}
                        >
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                            {direction === 'incoming'
                              ? t('Requester', 'Demandeur', 'Anfragender')
                              : t('Crafter', 'Crafteur', 'Crafter')}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.35, fontWeight: 700 }} noWrap>
                            {counterpartDisplayName}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                            {counterpartRsiHandle || t('No RSI handle', 'Pas de handle RSI', 'Kein RSI-Handle')}
                          </Typography>
                        </Paper>

                        <Paper
                          variant="outlined"
                          sx={{ p: 1, backgroundColor: alpha(theme.palette.background.paper, 0.35) }}
                        >
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                            {t('Organization', 'Organisation', 'Organisation')}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.35, fontWeight: 700 }} noWrap>
                            {request.organizationName}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                            {request.organizationSid}
                          </Typography>
                        </Paper>

                        <Paper
                          variant="outlined"
                          sx={{ p: 1, backgroundColor: alpha(theme.palette.background.paper, 0.35) }}
                        >
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                            {timelineTitle}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.35, fontWeight: 700 }}>
                            {timelineLabel ?? t('Unknown', 'Inconnue', 'Unbekannt')}
                          </Typography>
                          {request.contactInitiatedAt && (
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.35 }}>
                              {t('Contact', 'Contact', 'Kontakt')}: {formatAbsoluteDate(request.contactInitiatedAt)}
                            </Typography>
                          )}
                        </Paper>
                      </Box>

                      {(canAnswer || canClose || canDelete) && (
                        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                          {canAnswer && (
                            <>
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={craftRequestActionId === request.id}
                                onClick={() => { onRespondToCraftRequest(request.id, 'accepted'); }}
                              >
                                {craftRequestActionId === request.id
                                  ? t('Saving...', 'Enregistrement...', 'Speichere...')
                                  : t('Accept', 'Accepter', 'Annehmen')}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={craftRequestActionId === request.id}
                                onClick={() => { onRespondToCraftRequest(request.id, 'denied'); }}
                              >
                                {t('Deny', 'Refuser', 'Ablehnen')}
                              </Button>
                            </>
                          )}

                          {canClose && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={craftRequestActionId === request.id}
                              onClick={() => { onRespondToCraftRequest(request.id, 'closed'); }}
                            >
                              {craftRequestActionId === request.id
                                ? t('Saving...', 'Enregistrement...', 'Speichere...')
                                : closeLabel}
                            </Button>
                          )}

                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={craftRequestActionId === request.id}
                              onClick={() => { onRespondToCraftRequest(request.id, 'deleted'); }}
                            >
                              {craftRequestActionId === request.id
                                ? t('Saving...', 'Enregistrement...', 'Speichere...')
                                : t('Delete', 'Supprimer', 'Loschen')}
                            </Button>
                          )}
                        </Stack>
                      )}
                    </Stack>
                  </Paper>
                );
              })}
            </Box>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}
