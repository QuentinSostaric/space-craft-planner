import { useMemo, useState } from 'react';
import { Box, Paper, Stack, Typography } from '../../ui/system';
import { OpenInNewIcon, SmartToyOutlinedIcon } from '../../ui/icons';
import { type AccountSyncStatus, type OptimisticAccountState } from '../../auth/accountMutations';
import { useLocalPersist } from '../../hooks/useLocalPersist';
import { useI18n } from '../../i18n/I18nContext';
import type {
  AccountCraftRequest,
  AccountCraftRequestStatus,
  StoredAccount,
} from '../../services/authService';
import { Avatar } from '../ui/primitives';
import { AppButton } from '../ui/controls/AppButton';
import { AppTextField } from '../ui/controls/AppTextField';
import { AppSelect } from '../ui/controls/AppSelect';
import { AppChip, type AppChipTone } from '../ui/data-display/AppChip';
import { AppAlert, SurfaceState } from '../ui/feedback';
import { AppDialog } from '../ui/overlays/AppDialog';

type CraftRequestViewMode = 'incoming' | 'outgoing' | 'all';
type CraftRequestStatusFilter = 'all' | 'active' | AccountCraftRequestStatus;
type CraftRequestDecision = 'accepted' | 'denied' | 'closed' | 'deleted';
type CraftRequestSort = 'recent' | 'oldest' | 'attention';
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
  direction: 'incoming' | 'outgoing';
  displayName: string;
  avatarUrl: string | null;
  rsiHandle: string | null;
}

const DIRECTIONS: CraftRequestViewMode[] = ['all', 'incoming', 'outgoing'];
const STATUSES: CraftRequestStatusFilter[] = ['all', 'active', 'pending', 'accepted', 'denied', 'closed'];
const SORTS: CraftRequestSort[] = ['recent', 'oldest', 'attention'];
const EMPTY_REQUESTS: AccountCraftRequest[] = [];

function timestamp(value: string | null | undefined): number {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isActive(status: AccountCraftRequestStatus): boolean {
  return status === 'pending' || status === 'accepted';
}

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function statusMeta(t: TranslateFn, status: AccountCraftRequestStatus): { label: string; tone: AppChipTone } {
  switch (status) {
    case 'accepted':
      return { label: t('Accepted', 'Acceptée', 'Angenommen'), tone: 'success' };
    case 'denied':
      return { label: t('Declined', 'Refusée', 'Abgelehnt'), tone: 'danger' };
    case 'closed':
      return { label: t('Closed', 'Clôturée', 'Geschlossen'), tone: 'default' };
    default:
      return { label: t('Pending', 'En attente', 'Ausstehend'), tone: 'warning' };
  }
}

// Owner DM links are useful only to the owner. Never use a request-provided host.
function discordMessageUrl(entry: CraftRequestFeedEntry): string | null {
  const { ownerDiscordChannelId, ownerDiscordMessageId, status } = entry.request;
  if (entry.direction !== 'incoming' || !isActive(status)) return null;
  if (!/^\d+$/.test(ownerDiscordChannelId ?? '') || !/^\d+$/.test(ownerDiscordMessageId ?? '')) return null;
  return `https://discord.com/channels/@me/${ownerDiscordChannelId}/${ownerDiscordMessageId}`;
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
  const { t, lang } = useI18n();
  const [savedDirection, setDirection] = useLocalPersist<CraftRequestViewMode>(
    'craft-requests-view-mode',
    'all',
  );
  const [savedStatus, setStatus] = useLocalPersist<CraftRequestStatusFilter>(
    'craft-requests-status-filter',
    'all',
  );
  const [savedSort, setSort] = useLocalPersist<CraftRequestSort>('craft-requests-sort', 'recent');
  const [search, setSearch] = useState('');
  const [deleteRequestId, setDeleteRequestId] = useState<string | null>(null);
  // Old or edited browser preferences must not silently hide the whole history.
  const direction = DIRECTIONS.includes(savedDirection) ? savedDirection : 'all';
  const status = STATUSES.includes(savedStatus) ? savedStatus : 'all';
  const sort = SORTS.includes(savedSort) ? savedSort : 'recent';
  const incoming = account?.incomingCraftRequests ?? EMPTY_REQUESTS;
  const outgoing = account?.outgoingCraftRequests ?? EMPTY_REQUESTS;

  const pendingIds = useMemo(() => {
    const ids = new Set<string>();
    for (const mutation of optimisticState.pendingMutations) {
      if (mutation.kind === 'craft-request-create') ids.add(mutation.payload.tempRequestId);
      if (mutation.kind === 'craft-request-decision') ids.add(mutation.payload.requestId);
    }
    return ids;
  }, [optimisticState.pendingMutations]);

  const entries = useMemo<CraftRequestFeedEntry[]>(
    () => [
      ...incoming.map((request) => ({
        request,
        direction: 'incoming' as const,
        displayName: request.requesterDisplayName,
        avatarUrl: request.requesterAvatarUrl,
        rsiHandle: request.requesterRsiHandle,
      })),
      ...outgoing.map((request) => ({
        request,
        direction: 'outgoing' as const,
        displayName: request.ownerDisplayName,
        avatarUrl: request.ownerAvatarUrl,
        rsiHandle: request.ownerRsiHandle,
      })),
    ],
    [incoming, outgoing],
  );

  const attentionCount = incoming.filter((request) => request.status === 'pending').length;
  const activeCount = entries.filter(({ request }) => isActive(request.status)).length;
  const hasFilters = direction !== 'all' || status !== 'all' || search.trim() !== '';
  const resetFilters = () => {
    setDirection('all');
    setStatus('all');
    setSearch('');
  };
  const filteredEntries = useMemo(() => {
    const query = normalizeSearch(search.trim());
    return entries
      .filter((entry) => {
        if (direction !== 'all' && entry.direction !== direction) return false;
        if (status === 'active' && !isActive(entry.request.status)) return false;
        if (status !== 'all' && status !== 'active' && entry.request.status !== status) return false;
        return (
          !query ||
          normalizeSearch(
            [
              entry.request.blueprintName,
              entry.displayName,
              entry.rsiHandle,
              entry.request.organizationName,
              entry.request.organizationSid,
              entry.request.comment,
            ]
              .filter(Boolean)
              .join(' '),
          ).includes(query)
        );
      })
      .sort((left, right) => {
        if (sort === 'attention') {
          const leftAttention = Number(left.direction === 'incoming' && left.request.status === 'pending');
          const rightAttention = Number(right.direction === 'incoming' && right.request.status === 'pending');
          if (leftAttention !== rightAttention) return rightAttention - leftAttention;
        }
        const leftTime =
          timestamp(sort === 'oldest' ? left.request.createdAt : left.request.updatedAt) ||
          timestamp(left.request.createdAt);
        const rightTime =
          timestamp(sort === 'oldest' ? right.request.createdAt : right.request.updatedAt) ||
          timestamp(right.request.createdAt);
        return sort === 'oldest' ? leftTime - rightTime : rightTime - leftTime;
      });
  }, [entries, direction, status, search, sort]);

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }),
    [lang],
  );
  const dateLabel = (value: string | null | undefined) =>
    timestamp(value)
      ? dateFormatter.format(new Date(value!))
      : t('Date unavailable', 'Date indisponible', 'Datum nicht verfügbar');
  const deleteTarget = entries.find(({ request }) => request.id === deleteRequestId)?.request;
  const canConfirmDelete = Boolean(
    deleteTarget &&
      (deleteTarget.status === 'denied' || deleteTarget.status === 'closed') &&
      !pendingIds.has(deleteTarget.id) &&
      !craftRequestActionId,
  );

  return (
    <Stack spacing={2}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          gap: 2,
        }}
      >
        <Box sx={{ maxWidth: 720 }}>
          <Typography component="h2" sx={{ fontSize: '1.35rem', fontWeight: 700 }}>
            {t('Craft requests', 'Demandes de craft', 'Craft-Anfragen')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75, lineHeight: 1.7 }}>
            {t(
              'Review requests, agree on resources and follow each craft through to completion.',
              'Consultez les demandes, convenez des ressources et suivez chaque craft jusqu’à sa réalisation.',
              'Prüfe Anfragen, stimme Ressourcen ab und begleite jeden Craft bis zum Abschluss.',
            )}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <AppChip
            label={t(
              `${attentionCount} awaiting your reply`,
              `${attentionCount} en attente de votre réponse`,
              `${attentionCount} warten auf deine Antwort`,
            )}
            tone={attentionCount ? 'warning' : 'default'}
          />
          <AppChip
            label={t(`${activeCount} active`, `${activeCount} actives`, `${activeCount} aktiv`)}
            outlined
          />
        </Stack>
      </Box>

      {syncError && <AppAlert severity="error">{syncError}</AppAlert>}
      {craftRequestError && <AppAlert severity="error">{craftRequestError}</AppAlert>}
      {craftRequestNotice && <AppAlert severity="success">{craftRequestNotice}</AppAlert>}
      {(syncStatus === 'pending' || syncStatus === 'syncing') && pendingIds.size > 0 && (
        <AppAlert severity="info">
          {t(
            'Your changes are saved locally and waiting for cloud confirmation. Actions on those requests will be available once syncing finishes.',
            'Vos modifications sont enregistrées localement et attendent la confirmation du cloud. Les actions sur ces demandes seront disponibles après la synchronisation.',
            'Deine Änderungen sind lokal gespeichert und warten auf die Cloud-Bestätigung. Aktionen für diese Anfragen sind nach der Synchronisierung wieder verfügbar.',
          )}
        </AppAlert>
      )}

      <Paper sx={{ p: { xs: 1.5, md: 2 } }}>
        <Stack spacing={2}>
          <Box
            role="group"
            aria-label={t('Request direction', 'Direction des demandes', 'Anfragerichtung')}
            sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}
          >
            {(
              [
                ['all', t('All requests', 'Toutes les demandes', 'Alle Anfragen'), entries.length],
                ['incoming', t('Received', 'Reçues', 'Empfangen'), incoming.length],
                ['outgoing', t('Sent', 'Envoyées', 'Gesendet'), outgoing.length],
              ] as const
            ).map(([value, label, count]) => (
              <AppButton
                key={value}
                size="sm"
                variant={direction === value ? 'secondary' : 'ghost'}
                ariaPressed={direction === value}
                onClick={() => setDirection(value)}
                sx={{ minHeight: 44 }}
              >
                {`${label} · ${count}`}
              </AppButton>
            ))}
          </Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                sm: 'repeat(2, minmax(0, 1fr))',
                lg: 'minmax(220px, 1.5fr) minmax(150px, 1fr) minmax(160px, 1fr)',
              },
              gap: 1.5,
            }}
          >
            <AppTextField
              label={t('Search requests', 'Rechercher une demande', 'Anfragen durchsuchen')}
              type="search"
              value={search}
              onValueChange={setSearch}
              placeholder={t(
                'Blueprint, person, organization…',
                'Blueprint, personne, organisation…',
                'Blueprint, Person, Organisation…',
              )}
              fieldSx={{ gridColumn: { sm: '1 / -1', lg: 'auto' } }}
            />
            <AppSelect<CraftRequestStatusFilter>
              label={t('Status', 'Statut', 'Status')}
              value={status}
              onValueChange={(value) => setStatus(value ?? 'all')}
              options={[
                { value: 'all', label: t('All statuses', 'Tous les statuts', 'Alle Status') },
                {
                  value: 'active',
                  label: t(
                    'Active: pending or accepted',
                    'Actives : en attente ou acceptées',
                    'Aktiv: ausstehend oder angenommen',
                  ),
                },
                ...(['pending', 'accepted', 'denied', 'closed'] as const).map((value) => ({
                  value,
                  label: statusMeta(t, value).label,
                })),
              ]}
            />
            <AppSelect<CraftRequestSort>
              label={t('Sort by', 'Trier par', 'Sortieren nach')}
              value={sort}
              onValueChange={(value) => setSort(value ?? 'recent')}
              options={[
                {
                  value: 'recent',
                  label: t('Recently updated', 'Mise à jour récente', 'Zuletzt aktualisiert'),
                },
                {
                  value: 'oldest',
                  label: t('Oldest request first', 'Plus anciennes d’abord', 'Älteste Anfrage zuerst'),
                },
                {
                  value: 'attention',
                  label: t(
                    'Awaiting my reply first',
                    'À traiter en premier',
                    'Warten auf meine Antwort zuerst',
                  ),
                },
              ]}
            />
          </Box>
        </Stack>
      </Paper>

      <Box
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minHeight: 36 }}
      >
        <Typography variant="body2" role="status" aria-live="polite" sx={{ color: 'text.secondary' }}>
          {t(
            `${filteredEntries.length} of ${entries.length} requests`,
            `${filteredEntries.length} demande(s) sur ${entries.length}`,
            `${filteredEntries.length} von ${entries.length} Anfragen`,
          )}
        </Typography>
        {hasFilters && (
          <AppButton variant="ghost" size="sm" onClick={resetFilters}>
            {t('Clear filters', 'Effacer les filtres', 'Filter zurücksetzen')}
          </AppButton>
        )}
      </Box>

      {filteredEntries.length === 0 ? (
        <SurfaceState
          icon={<SmartToyOutlinedIcon />}
          title={
            entries.length
              ? t('No matching requests', 'Aucune demande correspondante', 'Keine passenden Anfragen')
              : t(
                  'No craft requests yet',
                  'Aucune demande de craft pour le moment',
                  'Noch keine Craft-Anfragen',
                )
          }
          description={
            entries.length
              ? t(
                  'Try another search or clear your filters to see your full history.',
                  'Essayez une autre recherche ou effacez les filtres pour retrouver votre historique.',
                  'Versuche eine andere Suche oder setze die Filter zurück, um den gesamten Verlauf zu sehen.',
                )
              : t(
                  'Requests appear here when you ask a member to craft a shared blueprint, or when someone requests one of yours. Find shared blueprints in your organizations.',
                  'Les demandes apparaissent ici lorsque vous demandez à un membre de fabriquer un blueprint partagé ou qu’un membre vous sollicite. Retrouvez les blueprints partagés dans vos organisations.',
                  'Hier erscheinen Anfragen, wenn du einen geteilten Blueprint anfragst oder jemand einen deiner Blueprints anfragt. Geteilte Blueprints findest du in deinen Organisationen.',
                )
          }
          actionLabel={
            hasFilters ? t('Clear filters', 'Effacer les filtres', 'Filter zurücksetzen') : undefined
          }
          onAction={hasFilters ? resetFilters : undefined}
        />
      ) : (
        <Box component="ul" sx={{ listStyle: 'none', display: 'grid', gap: 1.5, m: 0, p: 0 }}>
          {filteredEntries.map((entry) => {
            const { request, direction: entryDirection, displayName, avatarUrl, rsiHandle } = entry;
            const meta = statusMeta(t, request.status);
            const awaitingReply = entryDirection === 'incoming' && request.status === 'pending';
            const isPending = pendingIds.has(request.id);
            const isBusy = craftRequestActionId === request.id;
            const disabled = Boolean(craftRequestActionId) || isPending;
            const canDelete = request.status === 'denied' || request.status === 'closed';
            const canClose = request.status !== 'closed';
            const discordUrl = discordMessageUrl(entry);
            const resources =
              request.resourcesOption === 'has_resources'
                ? t(
                    'Requester provides the resources',
                    'Le demandeur fournit les ressources',
                    'Anfragende Person stellt die Ressourcen',
                  )
                : request.resourcesOption === 'buy_resources'
                  ? t(
                      'Requester will buy the resources',
                      'Le demandeur achètera les ressources',
                      'Anfragende Person kauft die Ressourcen',
                    )
                  : t(
                      'Resource arrangement to discuss',
                      'Ressources à convenir ensemble',
                      'Ressourcen nach Absprache',
                    );
            const summary = awaitingReply
              ? t(
                  'This request needs your reply.',
                  'Cette demande attend votre réponse.',
                  'Diese Anfrage wartet auf deine Antwort.',
                )
              : request.status === 'pending'
                ? t(
                    'Waiting for the crafter’s reply.',
                    'En attente de la réponse du crafteur.',
                    'Warten auf die Antwort der craftenden Person.',
                  )
                : request.status === 'accepted'
                  ? t(
                      'Coordinate the craft, then close the request when finished.',
                      'Organisez le craft, puis clôturez la demande une fois terminé.',
                      'Stimmt den Craft ab und schließt die Anfrage nach Abschluss.',
                    )
                  : request.status === 'denied'
                    ? t(
                        'Declined. Keep this request in your history or remove it.',
                        'Demande refusée. Conservez-la dans l’historique ou supprimez-la.',
                        'Abgelehnt. Behalte die Anfrage im Verlauf oder lösche sie.',
                      )
                    : t(
                        'Closed. This request is kept in your history.',
                        'Demande clôturée et conservée dans votre historique.',
                        'Geschlossen. Diese Anfrage bleibt in deinem Verlauf.',
                      );
            return (
              <Box component="li" key={`${entryDirection}:${request.id}`} sx={{ minWidth: 0 }}>
                <Paper
                  component="article"
                  aria-label={request.blueprintName}
                  aria-busy={isBusy || isPending}
                  sx={{
                    p: { xs: 1.5, md: 2.5 },
                    borderLeft: awaitingReply ? '3px solid' : undefined,
                    borderLeftColor: awaitingReply ? 'warning.main' : undefined,
                  }}
                >
                  <Stack spacing={1.75}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 1.5,
                      }}
                    >
                      <Box sx={{ flex: '1 1 240px', minWidth: 0 }}>
                        <Typography
                          component="h3"
                          sx={{ fontSize: '1.1rem', fontWeight: 700, overflowWrap: 'anywhere' }}
                        >
                          {request.blueprintName}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1, minWidth: 0 }}>
                          <Avatar src={avatarUrl ?? undefined} alt="" sx={{ width: 28, height: 28 }}>
                            {(displayName || '?').charAt(0).toUpperCase()}
                          </Avatar>
                          <Typography
                            variant="body2"
                            sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }}
                          >
                            {entryDirection === 'incoming' ? t('From', 'De', 'Von') : t('To', 'À', 'An')}{' '}
                            <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>
                              {displayName}
                            </Box>{' '}
                            · {request.source === 'community'
                              ? t('Community marketplace', 'Marketplace communautaire', 'Community-Marktplatz')
                              : request.organizationName}
                          </Typography>
                        </Stack>
                      </Box>
                      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                        <AppChip
                          size="sm"
                          label={
                            entryDirection === 'incoming'
                              ? t('Received', 'Reçue', 'Empfangen')
                              : t('Sent', 'Envoyée', 'Gesendet')
                          }
                          outlined
                        />
                        <AppChip size="sm" label={meta.label} tone={meta.tone} />
                        {isPending && (
                          <AppChip
                            size="sm"
                            label={
                              syncStatus === 'error'
                                ? t(
                                    'Waiting to sync',
                                    'En attente de synchronisation',
                                    'Wartet auf Synchronisierung',
                                  )
                                : t('Syncing', 'Synchronisation', 'Wird synchronisiert')
                            }
                            tone="warning"
                            outlined
                          />
                        )}
                      </Stack>
                    </Box>
                    <Box
                      sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 1,
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                      }}
                    >
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {resources}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {t('Created', 'Créée le', 'Erstellt')}: {dateLabel(request.createdAt)}
                      </Typography>
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{ color: awaitingReply ? 'text.primary' : 'text.secondary' }}
                    >
                      {summary}
                    </Typography>
                    {(awaitingReply || canClose || canDelete) && (
                      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                        {awaitingReply && (
                          <>
                            <AppButton
                              variant="primary"
                              size="sm"
                              disabled={disabled}
                              loading={isBusy}
                              onClick={() => onRespondToCraftRequest(request.id, 'accepted')}
                              sx={{ minHeight: 44 }}
                            >
                              {t('Accept', 'Accepter', 'Annehmen')}
                            </AppButton>
                            <AppButton
                              variant="secondary"
                              size="sm"
                              disabled={disabled}
                              onClick={() => onRespondToCraftRequest(request.id, 'denied')}
                              sx={{ minHeight: 44 }}
                            >
                              {t('Decline', 'Refuser', 'Ablehnen')}
                            </AppButton>
                          </>
                        )}
                        {canClose && !awaitingReply && (
                          <AppButton
                            variant={request.status === 'accepted' ? 'secondary' : 'ghost'}
                            size="sm"
                            disabled={disabled}
                            loading={isBusy}
                            onClick={() => onRespondToCraftRequest(request.id, 'closed')}
                            sx={{ minHeight: 44 }}
                          >
                            {request.status === 'pending'
                              ? t('Cancel request', 'Annuler la demande', 'Anfrage abbrechen')
                              : t('Close request', 'Clôturer la demande', 'Anfrage schließen')}
                          </AppButton>
                        )}
                        {canDelete && (
                          <AppButton
                            variant="ghost"
                            size="sm"
                            disabled={disabled}
                            onClick={() => setDeleteRequestId(request.id)}
                            sx={{ minHeight: 44 }}
                          >
                            {t('Delete request', 'Supprimer la demande', 'Anfrage löschen')}
                          </AppButton>
                        )}
                        {discordUrl && (
                          <AppButton
                            href={discordUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="ghost"
                            size="sm"
                            endIcon={<OpenInNewIcon fontSize="small" />}
                            sx={{ minHeight: 44 }}
                          >
                            {t('Open in Discord', 'Ouvrir dans Discord', 'In Discord öffnen')}
                          </AppButton>
                        )}
                      </Stack>
                    )}
                    <details className="workspace-disclosure">
                      <summary>
                        {request.comment
                          ? t(
                              'Comment, activity & contact',
                              'Commentaire, activité et contact',
                              'Kommentar, Aktivität und Kontakt',
                            )
                          : t('Activity & contact', 'Activité et contact', 'Aktivität und Kontakt')}
                      </summary>
                      <Stack className="workspace-disclosure-body" spacing={2}>
                        {request.comment && (
                          <Box>
                            <Typography
                              component="h4"
                              variant="caption"
                              sx={{ color: 'text.secondary', fontWeight: 600 }}
                            >
                              {t('Requester’s comment', 'Commentaire du demandeur', 'Kommentar zur Anfrage')}
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{ mt: 0.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                            >
                              {request.comment}
                            </Typography>
                          </Box>
                        )}
                        <Box
                          component="dl"
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
                            gap: 1.5,
                            m: 0,
                          }}
                        >
                          {[
                            [
                              t('Last updated', 'Dernière mise à jour', 'Zuletzt aktualisiert'),
                              dateLabel(request.updatedAt ?? request.createdAt),
                            ],
                            ...(request.respondedAt
                              ? [[t('Answered', 'Réponse le', 'Beantwortet'), dateLabel(request.respondedAt)]]
                              : []),
                            ...(request.contactInitiatedAt
                              ? [
                                  [
                                    t('Contact initiated', 'Contact établi le', 'Kontakt aufgenommen'),
                                    dateLabel(request.contactInitiatedAt),
                                  ],
                                ]
                              : []),
                          ].map(([label, value]) => (
                            <Box key={label}>
                              <Typography component="dt" variant="caption" sx={{ color: 'text.secondary' }}>
                                {label}
                              </Typography>
                              <Typography component="dd" variant="body2" sx={{ m: 0, mt: 0.35 }}>
                                {value}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                          {rsiHandle && (
                            <AppButton
                              href={`https://robertsspaceindustries.com/citizens/${encodeURIComponent(rsiHandle)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              size="sm"
                              variant="ghost"
                              endIcon={<OpenInNewIcon fontSize="small" />}
                              sx={{ minHeight: 44 }}
                            >
                              {t('RSI profile', 'Profil RSI', 'RSI-Profil')} · {rsiHandle}
                            </AppButton>
                          )}
                          {request.source === 'community' && (
                            <AppButton href="/marketplace" variant="ghost" size="sm">
                              {t('Community marketplace', 'Marketplace communautaire', 'Community-Marktplatz')}
                            </AppButton>
                          )}
                          {request.source !== 'community' && request.organizationSid && (
                            <AppButton
                              href={`https://robertsspaceindustries.com/orgs/${encodeURIComponent(request.organizationSid)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              size="sm"
                              variant="ghost"
                              endIcon={<OpenInNewIcon fontSize="small" />}
                              sx={{ minHeight: 44 }}
                            >
                              {t('RSI organization', 'Organisation RSI', 'RSI-Organisation')} ·{' '}
                              {request.organizationSid}
                            </AppButton>
                          )}
                        </Stack>
                        {awaitingReply && (
                          <AppButton
                            variant="ghost"
                            size="sm"
                            disabled={disabled}
                            onClick={() => onRespondToCraftRequest(request.id, 'closed')}
                            sx={{ alignSelf: 'flex-start', minHeight: 44 }}
                          >
                            {t('Close without answering', 'Clôturer sans répondre', 'Ohne Antwort schließen')}
                          </AppButton>
                        )}
                        {isActive(request.status) && (
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {request.ownerDiscordMessageId
                              ? t(
                                  'The owner was notified by the Discord bot.',
                                  'Le bot Discord a notifié le propriétaire.',
                                  'Der Discord-Bot hat die besitzende Person benachrichtigt.',
                                )
                              : t(
                                  'No Discord delivery is recorded. You can manage this request here.',
                                  'Aucun envoi Discord n’est enregistré. Vous pouvez gérer cette demande ici.',
                                  'Keine Discord-Zustellung erfasst. Du kannst diese Anfrage hier verwalten.',
                                )}
                          </Typography>
                        )}
                      </Stack>
                    </details>
                  </Stack>
                </Paper>
              </Box>
            );
          })}
        </Box>
      )}
      <AppDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteRequestId(null);
        }}
        title={t(
          'Delete this craft request?',
          'Supprimer cette demande de craft ?',
          'Diese Craft-Anfrage löschen?',
        )}
        closeLabel={t('Close', 'Fermer', 'Schließen')}
        description={t(
          'This removes the request from both your history and the other participant’s history. This cannot be undone.',
          'Cette action supprime la demande de votre historique et de celui de l’autre participant. Elle est irréversible.',
          'Dadurch wird die Anfrage aus deinem Verlauf und dem Verlauf der anderen Person entfernt. Dies lässt sich nicht rückgängig machen.',
        )}
        footer={
          <Stack direction="row" spacing={1} justifyContent="flex-end" useFlexGap flexWrap="wrap">
            <AppButton variant="secondary" onClick={() => setDeleteRequestId(null)}>
              {t('Keep request', 'Conserver la demande', 'Anfrage behalten')}
            </AppButton>
            <AppButton
              variant="danger"
              disabled={!canConfirmDelete}
              onClick={() => {
                if (!deleteTarget || !canConfirmDelete) return;
                onRespondToCraftRequest(deleteTarget.id, 'deleted');
                setDeleteRequestId(null);
              }}
            >
              {t(
                'Delete for both participants',
                'Supprimer pour les deux participants',
                'Für beide Beteiligten löschen',
              )}
            </AppButton>
          </Stack>
        }
      >
        <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
          {deleteTarget?.blueprintName}
        </Typography>
      </AppDialog>
    </Stack>
  );
}
