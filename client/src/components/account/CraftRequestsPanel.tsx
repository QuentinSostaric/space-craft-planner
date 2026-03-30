import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';
import { type AccountSyncStatus, type OptimisticAccountState } from '../../auth/accountMutations';
import { useI18n } from '../../i18n/I18nContext';
import type {
  AccountCraftRequest,
  AccountCraftRequestStatus,
  StoredAccount,
} from '../../services/authService';
import { Button } from '../ui/Button';

type CraftRequestViewMode = 'incoming' | 'outgoing' | 'all';
type CraftRequestStatusFilter = 'all' | 'active' | AccountCraftRequestStatus;
type CraftRequestDecision = 'accepted' | 'denied' | 'closed';
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
  const [viewMode, setViewMode] = useState<CraftRequestViewMode>('incoming');
  const [statusFilter, setStatusFilter] = useState<CraftRequestStatusFilter>('active');

  useEffect(() => {
    setViewMode('incoming');
    setStatusFilter('active');
  }, [account?.accountId]);

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
            <Chip
              label={t(
                `${pendingIncomingCraftRequestCount} awaiting you`,
                `${pendingIncomingCraftRequestCount} a traiter`,
                `${pendingIncomingCraftRequestCount} warten auf dich`,
              )}
              size="small"
              color="warning"
            />
            <Chip
              label={t(
                `${activeCraftRequestCount} active`,
                `${activeCraftRequestCount} actives`,
                `${activeCraftRequestCount} aktiv`,
              )}
              size="small"
              variant="outlined"
            />
            <Chip
              label={t(
                `${closedCraftRequestCount} closed`,
                `${closedCraftRequestCount} cloturees`,
                `${closedCraftRequestCount} geschlossen`,
              )}
              size="small"
              variant="outlined"
            />
          </Stack>
        </Stack>

        {syncError && (
          <Alert severity="error" variant="outlined">
            {syncError}
          </Alert>
        )}

        {(syncStatus === 'pending' || syncStatus === 'syncing') && (
          <Alert severity="info" variant="outlined">
            {t(
              'Craft request changes are still syncing to the cloud. The interface is already updated locally.',
              'Les changements de demandes de craft se synchronisent encore vers le cloud. L interface est deja mise a jour localement.',
              'Craft-Anfragen werden noch mit der Cloud synchronisiert. Die Oberfläche ist lokal bereits aktualisiert.',
            )}
          </Alert>
        )}

        {craftRequestError && (
          <Alert severity="error" variant="outlined">
            {craftRequestError}
          </Alert>
        )}

        {craftRequestNotice && (
          <Alert severity="success" variant="outlined">
            {craftRequestNotice}
          </Alert>
        )}

        <Stack spacing={1}>
          <ToggleButtonGroup
            exclusive
            value={viewMode}
            onChange={(_event, value: CraftRequestViewMode | null) => {
              if (value) {
                setViewMode(value);
              }
            }}
            size="small"
            sx={{
              alignSelf: 'flex-start',
              '& .MuiToggleButton-root': {
                px: 1.5,
                py: 0.9,
                textTransform: 'none',
              },
            }}
          >
            <ToggleButton value="incoming">
              {t('Incoming', 'Entrantes', 'Eingehend')}
            </ToggleButton>
            <ToggleButton value="outgoing">
              {t('Outgoing', 'Sortantes', 'Ausgehend')}
            </ToggleButton>
            <ToggleButton value="all">
              {t('All', 'Tout', 'Alle')}
            </ToggleButton>
          </ToggleButtonGroup>

          <ToggleButtonGroup
            exclusive
            value={statusFilter}
            onChange={(_event, value: CraftRequestStatusFilter | null) => {
              if (value) {
                setStatusFilter(value);
              }
            }}
            size="small"
            sx={{
              alignSelf: 'flex-start',
              '& .MuiToggleButton-root': {
                px: 1.25,
                py: 0.8,
                textTransform: 'none',
              },
            }}
          >
            <ToggleButton value="active">
              {t('Active', 'Actives', 'Aktiv')}
            </ToggleButton>
            <ToggleButton value="pending">
              {t('Pending', 'En attente', 'Ausstehend')}
            </ToggleButton>
            <ToggleButton value="accepted">
              {t('Accepted', 'Acceptees', 'Angenommen')}
            </ToggleButton>
            <ToggleButton value="denied">
              {t('Denied', 'Refusees', 'Abgelehnt')}
            </ToggleButton>
            <ToggleButton value="closed">
              {t('Closed', 'Cloturees', 'Geschlossen')}
            </ToggleButton>
            <ToggleButton value="all">
              {t('All statuses', 'Tous les statuts', 'Alle Status')}
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        {filteredCraftRequestEntries.length === 0 ? (
          <Box
            sx={{
              py: 4,
              px: 2,
              textAlign: 'center',
              borderRadius: 2,
              border: `1px dashed ${theme.palette.divider}`,
              backgroundColor: alpha(theme.palette.background.default, 0.28),
            }}
          >
            <Typography variant="h6" sx={{ mb: 0.75 }}>
              {t('No craft requests match this view', 'Aucune demande de craft dans cette vue', 'Keine Craft-Anfragen in dieser Ansicht')}
            </Typography>
            <Typography sx={{ color: 'text.secondary', maxWidth: 620, mx: 'auto' }}>
              {t(
                'Switch the direction or status filter to inspect the rest of your request history.',
                'Change le filtre de direction ou de statut pour consulter le reste de ton historique de demandes.',
                'Wechsle den Richtungs- oder Statusfilter, um den Rest deiner Anfragenhistorie zu sehen.',
              )}
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              maxHeight: { xl: 780 },
              overflowY: { xl: 'auto' },
              pr: { xl: 0.5 },
            }}
          >
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
                          <Chip
                            label={
                              direction === 'incoming'
                                ? t('Incoming', 'Entrante', 'Eingehend')
                                : t('Outgoing', 'Sortante', 'Ausgehend')
                            }
                            size="small"
                            variant="outlined"
                          />
                          <Chip
                            label={statusMeta.label}
                            size="small"
                            color={statusMeta.color}
                            variant="outlined"
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
                          <Chip
                            label={resourcesLabel}
                            size="small"
                            variant="outlined"
                          />
                        )}
                        {request.ownerDiscordMessageId && (
                          <Chip
                            label={t('Discord bot notified', 'Bot Discord notifie', 'Discord-Bot benachrichtigt')}
                            size="small"
                            variant="outlined"
                          />
                        )}
                        {request.contactInitiatedAt && (
                          <Chip
                            label={t('Contact initiated', 'Mise en relation lancee', 'Kontakt gestartet')}
                            size="small"
                            color="info"
                            variant="outlined"
                          />
                        )}
                        {isSyncing && (
                          <Chip
                            label={t('Syncing', 'Synchronisation', 'Synchronisiert')}
                            size="small"
                            color="warning"
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
                              textTransform: 'uppercase',
                              letterSpacing: '0.1em',
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
                          <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
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
                          <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
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
                          <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
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

                      {(canAnswer || canClose) && (
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
