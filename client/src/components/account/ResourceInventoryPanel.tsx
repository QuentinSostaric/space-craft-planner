import { Box, Paper, Stack, Typography, alpha, useTheme } from '../../ui/system';
import { Alert, Avatar, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle } from '../../ui/widgets';
import { ShareOutlinedIcon, DeleteOutlineOutlinedIcon } from '../../ui/icons';
import { useMemo, useState } from 'react';
import type { Resource } from '../../types';
import { useI18n } from '../../i18n/I18nContext';
import type { StoredAccount } from '../../services/authService';
import { useAuth } from '../../auth/AuthContext';
import { formatQualityLabel, formatResourceQuantity } from '../../utils/crafting';
import { ResourceIcon } from '../ui/ResourceIcon';
import { Button } from '../ui/Button';
import { FONT_HEADING } from '../../theme';

interface ResourceInventoryPanelProps {
  account: StoredAccount;
  resources: Resource[];
}

export function ResourceInventoryPanel({
  account,
  resources,
}: ResourceInventoryPanelProps) {
  const theme = useTheme();
  const { t, lang } = useI18n();
  const {
    updateInventoryResources,
    updateOrganizationResourceShares,
  } = useAuth();
  const [actionEntryId, setActionEntryId] = useState<string | null>(null);
  const [resourceError, setResourceError] = useState<string | null>(null);
  const [shareDialogEntryId, setShareDialogEntryId] = useState<string | null>(null);
  const [shareDialogSelection, setShareDialogSelection] = useState<string[]>([]);

  const resourceById = useMemo(
    () => new Map(resources.map((resource) => [resource.id, resource])),
    [resources],
  );
  const inventoryResources = account.inventoryResources ?? [];
  const linkedOrganizations = account.organizations ?? [];
  const sharedResourceEntryIdSet = useMemo(
    () => new Set(account.sharedResourceEntryIds ?? []),
    [account.sharedResourceEntryIds],
  );
  const sharedOrganizationIdsByEntryId = useMemo(() => {
    const nextMap = new Map<string, string[]>();
    for (const [sid, resourceEntryIds] of Object.entries(account.organizationResourceShares ?? {})) {
      for (const resourceEntryId of resourceEntryIds) {
        const currentOrganizationIds = nextMap.get(resourceEntryId) ?? [];
        currentOrganizationIds.push(sid);
        nextMap.set(resourceEntryId, currentOrganizationIds);
      }
    }
    return nextMap;
  }, [account.organizationResourceShares]);
  const shareDialogEntry = shareDialogEntryId
    ? inventoryResources.find((resourceEntry) => resourceEntry.id === shareDialogEntryId) ?? null
    : null;

  const handleRemoveResourceEntry = async (entryId: string) => {
    setActionEntryId(entryId);
    setResourceError(null);

    try {
      await updateInventoryResources(
        inventoryResources.filter((resourceEntry) => resourceEntry.id !== entryId),
      );
    } catch (error) {
      setResourceError(
        error instanceof Error
          ? error.message
          : t(
              'Failed to update the resource inventory.',
              'La mise a jour de l inventaire de ressources a echoue.',
              'Das Ressourceninventar konnte nicht aktualisiert werden.',
            ),
      );
    } finally {
      setActionEntryId(null);
    }
  };

  const openShareDialog = (entryId: string) => {
    setResourceError(null);
    setShareDialogEntryId(entryId);
    setShareDialogSelection(sharedOrganizationIdsByEntryId.get(entryId) ?? []);
  };

  const closeShareDialog = () => {
    if (!actionEntryId) {
      setShareDialogEntryId(null);
      setShareDialogSelection([]);
    }
  };

  const handleSaveResourceShares = async () => {
    if (!shareDialogEntryId) {
      return;
    }

    setActionEntryId(shareDialogEntryId);
    setResourceError(null);
    try {
      const nextOrganizationResourceShares = Object.fromEntries(
        Object.entries(account.organizationResourceShares ?? {}).map(([sid, resourceEntryIds]) => [
          sid,
          resourceEntryIds.filter((resourceEntryId) => resourceEntryId !== shareDialogEntryId),
        ]),
      ) as Record<string, string[]>;

      for (const sid of shareDialogSelection) {
        const currentEntryIds = nextOrganizationResourceShares[sid] ?? [];
        nextOrganizationResourceShares[sid] = [...new Set([...currentEntryIds, shareDialogEntryId])];
      }

      const prunedOrganizationResourceShares = Object.fromEntries(
        Object.entries(nextOrganizationResourceShares).filter(([, resourceEntryIds]) => resourceEntryIds.length > 0),
      );

      await updateOrganizationResourceShares(prunedOrganizationResourceShares);
      setShareDialogEntryId(null);
      setShareDialogSelection([]);
    } catch (error) {
      setResourceError(
        error instanceof Error
          ? error.message
          : t(
              'Failed to update resource sharing.',
              'La mise a jour du partage des ressources a echoue.',
              'Die Ressourcenfreigabe konnte nicht aktualisiert werden.',
            ),
      );
    } finally {
      setActionEntryId(null);
    }
  };

  return (
    <>
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 1.25, md: 1.5 },
          borderColor: alpha(theme.palette.primary.main, 0.16),
          backgroundColor: alpha(theme.palette.background.paper, 0.96),
        }}
      >
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
          >
            <Box>
              <Typography
                variant="h6"
                sx={{
                  fontFamily: FONT_HEADING,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                }}
              >
                {t('Resource inventory', 'Inventaire de ressources', 'Ressourceninventar')}
              </Typography>
              <Typography sx={{ color: 'text.secondary', mt: 0.5, maxWidth: 760 }}>
                {t(
                  'Store multiple entries for the same resource with different quantities and qualities, then choose which linked organizations can access them.',
                  'Stocke plusieurs entrees pour une meme ressource avec des quantites et qualites differentes, puis choisis quelles organisations liees peuvent y acceder.',
                  'Speichere mehrere Eintrage fur dieselbe Ressource mit unterschiedlichen Mengen und Qualitaten und wahle dann aus, welche verknupften Organisationen darauf zugreifen konnen.',
                )}
              </Typography>
            </Box>

            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
              <Chip
                label={t(
                  `${inventoryResources.length} stored entries`,
                  `${inventoryResources.length} entrees stockees`,
                  `${inventoryResources.length} gespeicherte Eintrage`,
                )}
                size="small"
              />
              <Chip
                label={t(
                  `${sharedResourceEntryIdSet.size} shared entries`,
                  `${sharedResourceEntryIdSet.size} entrees partagees`,
                  `${sharedResourceEntryIdSet.size} geteilte Eintrage`,
                )}
                size="small"
                variant="outlined"
              />
            </Stack>
          </Stack>

          {resourceError && (
            <Alert severity="error" variant="outlined">
              {resourceError}
            </Alert>
          )}

          {inventoryResources.length === 0 ? (
            <Box
              sx={{
                py: { xs: 4, md: 5 },
                px: 2,
                textAlign: 'center',
                borderRadius: 2,
                border: `1px dashed ${theme.palette.divider}`,
                backgroundColor: alpha(theme.palette.background.default, 0.3),
              }}
            >
              <Typography variant="h6" sx={{ mb: 0.75 }}>
                {t(
                  'No resources stored yet',
                  'Aucune ressource stockee pour le moment',
                  'Noch keine Ressourcen gespeichert',
                )}
              </Typography>
              <Typography sx={{ color: 'text.secondary', maxWidth: 560, mx: 'auto' }}>
                {t(
                  'Use Add to inventory on any resource card to create one or more entries with quantity and quality.',
                  'Utilise Ajouter a l inventaire sur une carte ressource pour creer une ou plusieurs entrees avec quantite et qualite.',
                  'Nutze Auf Karte zum Inventar hinzufugen, um einen oder mehrere Eintrage mit Menge und Qualitat zu erstellen.',
                )}
              </Typography>
            </Box>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  md: 'repeat(2, minmax(0, 1fr))',
                  xl: 'repeat(3, minmax(0, 1fr))',
                },
                gap: 1.25,
              }}
            >
              {inventoryResources.map((resourceEntry) => {
                const sharedOrganizationIds = sharedOrganizationIdsByEntryId.get(resourceEntry.id) ?? [];
                const isShared = sharedOrganizationIds.length > 0;
                const resource = resourceById.get(resourceEntry.resourceId) ?? null;
                const imageUrl = resource?.visual?.imageUrl ?? null;

                return (
                  <Paper
                    key={resourceEntry.id}
                    variant="outlined"
                    sx={{
                      p: 1.2,
                      borderColor: isShared ? alpha(theme.palette.primary.main, 0.5) : 'divider',
                      backgroundColor: alpha(theme.palette.background.default, 0.22),
                    }}
                  >
                    <Stack spacing={1}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                        <Avatar
                          src={imageUrl ?? undefined}
                          alt={resourceEntry.resourceName}
                          variant="rounded"
                          sx={{
                            width: 44,
                            height: 44,
                            backgroundColor: alpha(theme.palette.primary.main, 0.08),
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
                          }}
                        >
                          <ResourceIcon name={resourceEntry.resourceName} size={22} />
                        </Avatar>

                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography sx={{ fontWeight: 700, lineHeight: 1.15 }}>
                            {resourceEntry.resourceName}
                          </Typography>
                          <Typography sx={{ color: 'text.secondary', fontSize: '0.86rem', mt: 0.3 }}>
                            {formatResourceQuantity(
                              resourceEntry.quantity,
                              resourceEntry.quantityUnit,
                              lang,
                              'long',
                            )}
                          </Typography>
                        </Box>
                      </Stack>

                      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                        <Chip
                          size="small"
                          label={
                            resourceEntry.quality == null
                              ? t('No quality', 'Sans qualite', 'Ohne Qualitat')
                              : formatQualityLabel(resourceEntry.quality, lang)
                          }
                          variant={resourceEntry.quality == null ? 'outlined' : 'filled'}
                        />
                        <Chip
                          size="small"
                          label={
                            isShared
                              ? t(
                                  `Shared with ${sharedOrganizationIds.length} org${sharedOrganizationIds.length > 1 ? 's' : ''}`,
                                  `Partage avec ${sharedOrganizationIds.length} org${sharedOrganizationIds.length > 1 ? 's' : ''}`,
                                  `Mit ${sharedOrganizationIds.length} Org${sharedOrganizationIds.length > 1 ? 's' : ''} geteilt`,
                                )
                              : t('Private entry', 'Entree privee', 'Privater Eintrag')
                          }
                          color={isShared ? 'primary' : 'default'}
                          variant={isShared ? 'filled' : 'outlined'}
                        />
                      </Stack>

                      <Stack direction="row" spacing={1}>
                        <Box sx={{ flex: 1 }}>
                          <Button
                            variant="ghost"
                            icon={<ShareOutlinedIcon />}
                            onClick={() => openShareDialog(resourceEntry.id)}
                            disabled={Boolean(actionEntryId)}
                            fullWidth
                          >
                            {isShared
                              ? t('Edit sharing', 'Modifier le partage', 'Freigabe bearbeiten')
                              : t('Share', 'Partager', 'Teilen')}
                          </Button>
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Button
                            variant="ghost"
                            icon={<DeleteOutlineOutlinedIcon />}
                            onClick={() => {
                              void handleRemoveResourceEntry(resourceEntry.id);
                            }}
                            disabled={Boolean(actionEntryId)}
                            fullWidth
                          >
                            {t('Remove', 'Retirer', 'Entfernen')}
                          </Button>
                        </Box>
                      </Stack>
                    </Stack>
                  </Paper>
                );
              })}
            </Box>
          )}
        </Stack>
      </Paper>

      <Dialog
        open={Boolean(shareDialogEntry)}
        onClose={closeShareDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {t(
            'Share resource entry with organizations',
            'Partager cette entree de ressource avec des organisations',
            'Ressourceneintrag mit Organisationen teilen',
          )}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography sx={{ color: 'text.secondary' }}>
              {shareDialogEntry
                ? t(
                    `Choose which linked organizations can access ${shareDialogEntry.resourceName}.`,
                    `Choisis quelles organisations liees peuvent acceder a ${shareDialogEntry.resourceName}.`,
                    `Wahle, welche verknupften Organisationen auf ${shareDialogEntry.resourceName} zugreifen konnen.`,
                  )
                : t(
                    'Choose which linked organizations can access this resource entry.',
                    'Choisis quelles organisations liees peuvent acceder a cette entree de ressource.',
                    'Wahle, welche verknupften Organisationen auf diesen Ressourceneintrag zugreifen konnen.',
                  )}
            </Typography>

            {linkedOrganizations.length === 0 ? (
              <Alert severity="info" variant="outlined">
                {t(
                  'Link at least one organization on this account before sharing resources.',
                  'Lie au moins une organisation a ce compte avant de partager des ressources.',
                  'Verknupfe mindestens eine Organisation mit diesem Konto, bevor du Ressourcen teilst.',
                )}
              </Alert>
            ) : (
              <Stack spacing={1}>
                {linkedOrganizations.map((organization) => {
                  const checked = shareDialogSelection.includes(organization.sid);
                  return (
                    <Paper
                      key={organization.sid}
                      variant="outlined"
                      sx={{
                        p: 1.1,
                        borderColor: checked ? 'primary.main' : 'divider',
                        backgroundColor: checked
                          ? alpha(theme.palette.primary.main, 0.08)
                          : alpha(theme.palette.background.default, 0.2),
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Checkbox
                          checked={checked}
                          onChange={() =>
                            setShareDialogSelection((currentSelection) =>
                              checked
                                ? currentSelection.filter((sid) => sid !== organization.sid)
                                : [...currentSelection, organization.sid],
                            )
                          }
                        />
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography sx={{ fontWeight: 700 }}>{organization.name}</Typography>
                          <Typography sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>
                            {organization.sid}
                          </Typography>
                        </Box>
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            variant="ghost"
            onClick={closeShareDialog}
            disabled={Boolean(actionEntryId)}
          >
            {t('Cancel', 'Annuler', 'Abbrechen')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              void handleSaveResourceShares();
            }}
            disabled={Boolean(actionEntryId) || linkedOrganizations.length === 0}
          >
            {actionEntryId === shareDialogEntryId
              ? t('Saving...', 'Enregistrement...', 'Speichere...')
              : t('Save sharing', 'Enregistrer le partage', 'Freigabe speichern')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
