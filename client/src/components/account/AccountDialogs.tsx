import rsiLogoOfficial from '../../assets/rsi-logo-official.jpg';
import { FONT_MONO } from '../../theme';
import { Box, Paper, Stack, Typography, alpha } from '../../ui/system';
import { formatResourceQuantity } from '../../utils/crafting';
import { Button } from '../ui/Button';
import { AppButton, AppCheckbox, AppSelect, AppTextField } from '../ui/controls';
import { AppChip } from '../ui/data-display/AppChip';
import { AppAlert } from '../ui/feedback';
import { AppDialog } from '../ui/overlays';
import { Link } from '../ui/primitives';
import { ALL_RESOURCES_SHARE_OPTION } from './accountHelpers';
import { AccountResourceEditor } from './AccountResourceEditor';
import type { AccountController } from './useAccountController';

export function AccountDialogs({ model }: { model: AccountController }) {
  const {
    t,
    lang,
    account,
    theme,
    setImportModalDismissed,
    importAction,
    rsiDialogOpen,
    setRsiDialogOpen,
    rsiChallenge,
    setRsiChallenge,
    rsiCode,
    rsiHandleInput,
    setRsiHandleInput,
    rsiAction,
    rsiCopyFeedback,
    setRsiCopyFeedback,
    sharedBlueprintError,
    shareDialogSelection,
    setShareDialogSelection,
    sharedBlueprintBusyId,
    resourceCollectionError,
    shareDialogResourceSelection,
    setShareDialogResourceSelection,
    sharedResourceBusyId,
    resourceBulkShareDialogOpen,
    resourceBulkShareDraft,
    setResourceBulkShareDraft,
    resourceBulkShareBusy,
    resourceBulkShareError,
    organizationActionSid,
    organizationSharingDialogState,
    linkedOrganizations,
    organizationClaimDialogTarget,
    organizationDeleteDialogTarget,
    organizationSharingDialogTarget,
    localImportPlan,
    importDialogOpen,
    sortedResources,
    shareDialogBlueprint,
    shareDialogResourceEntry,
    bulkResourceSharePreview,
    handleImportLocalCollections,
    handleCopyRsiCode,
    handleVerifyRsiLink,
    closeShareBlueprintDialog,
    handleSaveBlueprintOrganizationShares,
    closeShareResourceDialog,
    closeResourceBulkShareDialog,
    handleSaveResourceBulkShare,
    handleSaveResourceOrganizationShares,
    closeClaimOrganizationDialog,
    closeDeleteOrganizationDialog,
    closeOrganizationSharingDialog,
    handleClaimOrganization,
    handleDeleteOrganization,
    handleSetOrganizationSharing,
  } = model;
  return (
    <>
      <AppDialog
        open={Boolean(model.confirmation)}
        onOpenChange={(open) => {
          if (!open) model.resolveConfirmation(false);
        }}
        title={
          model.confirmation?.title ?? t('Confirm this action', 'Confirmer cette action', 'Aktion bestätigen')
        }
        footer={
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <AppButton variant="secondary" onClick={() => model.resolveConfirmation(false)}>
              {t('Cancel', 'Annuler', 'Abbrechen')}
            </AppButton>
            <AppButton variant="danger" onClick={() => model.resolveConfirmation(true)}>
              {model.confirmation?.label ?? t('Confirm', 'Confirmer', 'Bestätigen')}
            </AppButton>
          </Box>
        }
      >
        <Typography sx={{ lineHeight: 1.65 }}>{model.confirmation?.message}</Typography>
      </AppDialog>
      {account && (
        <AppDialog
          open={importDialogOpen}
          dismissable={!importAction.busy}
          onOpenChange={(open) => {
            if (!open && !importAction.busy) setImportModalDismissed(true);
          }}
          width="min(36rem, calc(100vw - 2rem))"
          title={t(
            'Import local inventory data?',
            'Importer les donnees locales d inventaire ?',
            'Lokale Inventardaten importieren?',
          )}
          footer={
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <Button
                variant="ghost"
                onClick={() => setImportModalDismissed(true)}
                disabled={importAction.busy}
              >
                {t('Not now', 'Plus tard', 'Nicht jetzt')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  void handleImportLocalCollections();
                }}
                disabled={importAction.busy}
              >
                {importAction.busy
                  ? t('Importing...', 'Import en cours...', 'Importiere...')
                  : t('Import into account', 'Importer dans le compte', 'In Konto importieren')}
              </Button>
            </Box>
          }
        >
          <Stack spacing={2}>
            <Typography sx={{ color: 'text.secondary' }}>
              {t(
                'Local blueprint collections or stored resources were found after login. Some of them are not present in the cloud account yet.',
                'Des collections blueprint locales ou des ressources stockees localement ont ete trouvees apres connexion. Certaines ne sont pas encore presentes dans le compte cloud.',
                'Nach der Anmeldung wurden lokale Blueprint-Sammlungen oder gespeicherte Ressourcen gefunden. Ein Teil davon ist noch nicht im Cloud-Konto vorhanden.',
              )}
            </Typography>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                gap: 1,
              }}
            >
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  {t('Inventory to import', 'Inventaire a importer', 'Zu importierendes Inventar')}
                </Typography>
                <Typography variant="h5" sx={{ mt: 0.5 }}>
                  {localImportPlan.missingInventoryBlueprintIds.length}
                </Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  {t('Favorites to import', 'Favoris a importer', 'Zu importierende Favoriten')}
                </Typography>
                <Typography variant="h5" sx={{ mt: 0.5 }}>
                  {localImportPlan.missingFavoriteBlueprintIds.length}
                </Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  {t('Resources to import', 'Ressources a importer', 'Zu importierende Ressourcen')}
                </Typography>
                <Typography variant="h5" sx={{ mt: 0.5 }}>
                  {localImportPlan.missingInventoryResources.length}
                </Typography>
              </Paper>
            </Box>

            <Typography sx={{ color: 'text.secondary' }}>
              {t(
                'Accepting merges the missing local blueprints and resource entries into the cloud account, then clears the imported local entries.',
                'Accepter fusionne les blueprints et entrees de ressources locales manquants dans le compte cloud, puis vide les entrees locales importees.',
                'Beim Bestatigen werden die fehlenden lokalen Blueprints und Ressourceneintrage in das Cloud-Konto ubernommen und die importierten lokalen Eintrage geleert.',
              )}
            </Typography>

            {importAction.error && <AppAlert severity="error">{importAction.error}</AppAlert>}
          </Stack>
        </AppDialog>
      )}

      <AppDialog
        open={Boolean(shareDialogBlueprint)}
        dismissable={!Boolean(sharedBlueprintBusyId)}
        onOpenChange={(open) => {
          if (!open) closeShareBlueprintDialog();
        }}
        width="min(36rem, calc(100vw - 2rem))"
        title={t(
          'Share blueprint with organizations',
          'Partager le blueprint avec des organisations',
          'Blueprint mit Organisationen teilen',
        )}
        footer={
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button
              variant="ghost"
              onClick={closeShareBlueprintDialog}
              disabled={Boolean(sharedBlueprintBusyId)}
            >
              {t('Cancel', 'Annuler', 'Abbrechen')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                void handleSaveBlueprintOrganizationShares();
              }}
              disabled={Boolean(sharedBlueprintBusyId) || linkedOrganizations.length === 0}
            >
              {sharedBlueprintBusyId
                ? t('Saving...', 'Enregistrement...', 'Speichere...')
                : t('Save sharing', 'Enregistrer le partage', 'Freigabe speichern')}
            </Button>
          </Box>
        }
      >
        <Stack spacing={2}>
          <Typography sx={{ color: 'text.secondary' }}>
            {shareDialogBlueprint
              ? t(
                  `Choose which linked organizations can access ${shareDialogBlueprint.name}.`,
                  `Choisis quelles organisations liees peuvent acceder a ${shareDialogBlueprint.name}.`,
                  `Wähle, welche verknüpften Organisationen auf ${shareDialogBlueprint.name} zugreifen können.`,
                )
              : t(
                  'Choose which linked organizations can access this blueprint.',
                  'Choisis quelles organisations liees peuvent acceder a ce blueprint.',
                  'Wähle, welche verknüpften Organisationen auf diesen Blueprint zugreifen können.',
                )}
          </Typography>

          {linkedOrganizations.length === 0 ? (
            <AppAlert severity="info">
              {t(
                'Link at least one organization on this account before sharing blueprints.',
                'Lie au moins une organisation a ce compte avant de partager des blueprints.',
                'Verknüpfe mindestens eine Organisation mit diesem Konto, bevor du Blueprints teilst.',
              )}
            </AppAlert>
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
                    <Stack direction="row" spacing={1.1} alignItems="center">
                      <AppCheckbox
                        checked={checked}
                        onCheckedChange={() =>
                          setShareDialogSelection((currentSelection) =>
                            checked
                              ? currentSelection.filter((sid) => sid !== organization.sid)
                              : [...currentSelection, organization.sid],
                          )
                        }
                        label={organization.name}
                        description={organization.sid}
                      />
                      <Box sx={{ flex: 1 }} />
                      <AppChip
                        size="sm"
                        outlined
                        label={
                          organization.status === 'verified_admin'
                            ? t('Verified admin', 'Admin verifie', 'Verifizierter Admin')
                            : organization.status === 'verified_member'
                              ? t('Verified member', 'Membre verifie', 'Verifiziertes Mitglied')
                              : t('Linked only', 'Simplement liee', 'Nur verknüpft')
                        }
                        tone={
                          organization.status === 'verified_admin'
                            ? 'success'
                            : organization.status === 'verified_member'
                              ? 'info'
                              : 'default'
                        }
                      />
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          )}

          {sharedBlueprintError && <AppAlert severity="error">{sharedBlueprintError}</AppAlert>}
        </Stack>
      </AppDialog>

      <AppDialog
        open={Boolean(shareDialogResourceEntry)}
        dismissable={!Boolean(sharedResourceBusyId)}
        onOpenChange={(open) => {
          if (!open) closeShareResourceDialog();
        }}
        width="min(36rem, calc(100vw - 2rem))"
        title={t(
          'Share resource entry with organizations',
          'Partager l entree ressource avec des organisations',
          'Ressourceneintrag mit Organisationen teilen',
        )}
        footer={
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button
              variant="ghost"
              onClick={closeShareResourceDialog}
              disabled={Boolean(sharedResourceBusyId)}
            >
              {t('Cancel', 'Annuler', 'Abbrechen')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                void handleSaveResourceOrganizationShares();
              }}
              disabled={Boolean(sharedResourceBusyId) || linkedOrganizations.length === 0}
            >
              {sharedResourceBusyId
                ? t('Saving...', 'Enregistrement...', 'Speichere...')
                : t('Save sharing', 'Enregistrer le partage', 'Freigabe speichern')}
            </Button>
          </Box>
        }
      >
        <Stack spacing={2}>
          <Typography sx={{ color: 'text.secondary' }}>
            {shareDialogResourceEntry
              ? t(
                  `Choose which linked organizations can access ${shareDialogResourceEntry.resourceName} (${formatResourceQuantity(shareDialogResourceEntry.quantity, shareDialogResourceEntry.quantityUnit, lang, 'long')}).`,
                  `Choisis quelles organisations liees peuvent acceder a ${shareDialogResourceEntry.resourceName} (${formatResourceQuantity(shareDialogResourceEntry.quantity, shareDialogResourceEntry.quantityUnit, lang, 'long')}).`,
                  `Wahle, welche verknupften Organisationen auf ${shareDialogResourceEntry.resourceName} (${formatResourceQuantity(shareDialogResourceEntry.quantity, shareDialogResourceEntry.quantityUnit, lang, 'long')}) zugreifen konnen.`,
                )
              : t(
                  'Choose which linked organizations can access this resource entry.',
                  'Choisis quelles organisations liees peuvent acceder a cette entree ressource.',
                  'Wahle, welche verknupften Organisationen auf diesen Ressourceneintrag zugreifen konnen.',
                )}
          </Typography>

          {linkedOrganizations.length === 0 ? (
            <AppAlert severity="info">
              {t(
                'Link at least one organization on this account before sharing stored resources.',
                'Lie au moins une organisation a ce compte avant de partager des ressources stockees.',
                'Verknupfe mindestens eine Organisation mit diesem Konto, bevor du gespeicherte Ressourcen teilst.',
              )}
            </AppAlert>
          ) : (
            <Stack spacing={1}>
              {linkedOrganizations.map((organization) => {
                const checked = shareDialogResourceSelection.includes(organization.sid);
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
                    <Stack direction="row" spacing={1.1} alignItems="center">
                      <AppCheckbox
                        checked={checked}
                        onCheckedChange={() =>
                          setShareDialogResourceSelection((currentSelection) =>
                            checked
                              ? currentSelection.filter((sid) => sid !== organization.sid)
                              : [...currentSelection, organization.sid],
                          )
                        }
                        label={organization.name}
                        description={organization.sid}
                      />
                      <Box sx={{ flex: 1 }} />
                      <AppChip
                        size="sm"
                        outlined
                        label={
                          organization.status === 'verified_admin'
                            ? t('Verified admin', 'Admin verifie', 'Verifizierter Admin')
                            : organization.status === 'verified_member'
                              ? t('Verified member', 'Membre verifie', 'Verifiziertes Mitglied')
                              : t('Linked only', 'Simplement liee', 'Nur verknupft')
                        }
                        tone={
                          organization.status === 'verified_admin'
                            ? 'success'
                            : organization.status === 'verified_member'
                              ? 'info'
                              : 'default'
                        }
                      />
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          )}

          {resourceCollectionError && <AppAlert severity="error">{resourceCollectionError}</AppAlert>}
        </Stack>
      </AppDialog>

      <AccountResourceEditor model={model} />

      <AppDialog
        open={resourceBulkShareDialogOpen}
        dismissable={!resourceBulkShareBusy}
        onOpenChange={(open) => {
          if (!open) closeResourceBulkShareDialog();
        }}
        width="min(36rem, calc(100vw - 2rem))"
        title={t(
          'Share stored resources with an organization',
          'Partager des ressources stockees avec une organisation',
          'Gespeicherte Ressourcen mit einer Organisation teilen',
        )}
        footer={
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button variant="ghost" onClick={closeResourceBulkShareDialog} disabled={resourceBulkShareBusy}>
              {t('Cancel', 'Annuler', 'Abbrechen')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                void handleSaveResourceBulkShare();
              }}
              disabled={resourceBulkShareBusy || linkedOrganizations.length === 0}
            >
              {resourceBulkShareBusy
                ? t('Saving...', 'Enregistrement...', 'Speichere...')
                : t(
                    'Share matching entries',
                    'Partager les entrees correspondantes',
                    'Passende Eintrage teilen',
                  )}
            </Button>
          </Box>
        }
      >
        <Stack spacing={2}>
          <Typography sx={{ color: 'text.secondary' }}>
            {t(
              'Choose one linked organization, then target all stored resources or only one resource family. Quality filters are optional, so you can batch share ranges such as Hadanite quality 700 to 800.',
              'Choisis une organisation liee, puis cible toutes les ressources stockees ou une seule famille de ressources. Les filtres de qualite sont optionnels, ce qui permet par exemple de partager les Hadanites de qualite 700 a 800.',
              'Wahle eine verknupfte Organisation und danach entweder alle gespeicherten Ressourcen oder nur eine Ressourcenfamilie. Qualitatsfilter sind optional, sodass du zum Beispiel Hadanite mit Qualitat 700 bis 800 gesammelt teilen kannst.',
            )}
          </Typography>

          <AppSelect
            label={t('Organization', 'Organisation', 'Organisation')}
            value={resourceBulkShareDraft.organizationSid}
            options={linkedOrganizations.map((organization) => ({
              label: `${organization.name} (${organization.sid})`,
              value: organization.sid,
            }))}
            onValueChange={(value) =>
              setResourceBulkShareDraft((currentDraft) => ({
                ...currentDraft,
                organizationSid: value ?? '',
              }))
            }
            fieldSx={{ width: '100%' }}
          />

          <AppSelect
            label={t('Resource scope', 'Portee ressource', 'Ressourcenbereich')}
            value={resourceBulkShareDraft.resourceId}
            options={[
              {
                label: t(
                  'All stored resources',
                  'Toutes les ressources stockees',
                  'Alle gespeicherten Ressourcen',
                ),
                value: ALL_RESOURCES_SHARE_OPTION,
              },
              ...sortedResources.map((resource) => ({ label: resource.name, value: resource.id })),
            ]}
            onValueChange={(value) =>
              setResourceBulkShareDraft((currentDraft) => ({
                ...currentDraft,
                resourceId: value ?? ALL_RESOURCES_SHARE_OPTION,
              }))
            }
            fieldSx={{ width: '100%' }}
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
            <AppTextField
              type="number"
              label={t('Minimum quality', 'Qualite minimale', 'Minimale Qualitat')}
              value={resourceBulkShareDraft.minQuality}
              onValueChange={(value) =>
                setResourceBulkShareDraft((currentDraft) => ({
                  ...currentDraft,
                  minQuality: value,
                }))
              }
              placeholder="0"
              min={0}
              max={1000}
              step={1}
            />
            <AppTextField
              type="number"
              label={t('Maximum quality', 'Qualite maximale', 'Maximale Qualitat')}
              value={resourceBulkShareDraft.maxQuality}
              onValueChange={(value) =>
                setResourceBulkShareDraft((currentDraft) => ({
                  ...currentDraft,
                  maxQuality: value,
                }))
              }
              placeholder="1000"
              min={0}
              max={1000}
              step={1}
            />
          </Stack>

          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              backgroundColor: alpha(theme.palette.background.default, 0.24),
              borderColor: alpha(theme.palette.primary.main, 0.14),
            }}
          >
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
              <AppChip
                size="sm"
                label={t(
                  `${bulkResourceSharePreview.matchingEntryIds.length} matching entries`,
                  `${bulkResourceSharePreview.matchingEntryIds.length} entrees correspondantes`,
                  `${bulkResourceSharePreview.matchingEntryIds.length} passende Eintrage`,
                )}
              />
              <AppChip
                size="sm"
                tone="primary"
                outlined
                label={t(
                  `${bulkResourceSharePreview.newEntryIds.length} new shares`,
                  `${bulkResourceSharePreview.newEntryIds.length} nouveaux partages`,
                  `${bulkResourceSharePreview.newEntryIds.length} neue Freigaben`,
                )}
              />
            </Stack>
          </Paper>

          {resourceBulkShareError && <AppAlert severity="error">{resourceBulkShareError}</AppAlert>}
        </Stack>
      </AppDialog>

      <AppDialog
        open={Boolean(organizationClaimDialogTarget)}
        dismissable={!Boolean(organizationActionSid)}
        onOpenChange={(open) => {
          if (!open) closeClaimOrganizationDialog();
        }}
        width="min(36rem, calc(100vw - 2rem))"
        title={t(
          'Request organization claim review?',
          'Demander une revue de claim pour cette organisation ?',
          'Claim-Prüfung für diese Organisation anfordern?',
        )}
        footer={
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button
              variant="ghost"
              onClick={closeClaimOrganizationDialog}
              disabled={Boolean(organizationActionSid)}
            >
              {t('Cancel', 'Annuler', 'Abbrechen')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                void handleClaimOrganization();
              }}
              disabled={Boolean(organizationActionSid)}
            >
              {organizationActionSid
                ? t('Sending...', 'Envoi...', 'Sende...')
                : t('Send review request', 'Envoyer la demande', 'Anfrage senden')}
            </Button>
          </Box>
        }
      >
        <Stack spacing={2}>
          <Typography sx={{ color: 'text.secondary' }}>
            {organizationClaimDialogTarget
              ? t(
                  `A manual review request will be created for ${organizationClaimDialogTarget.name}.`,
                  `Une demande de revue manuelle sera creee pour ${organizationClaimDialogTarget.name}.`,
                  `Für ${organizationClaimDialogTarget.name} wird eine manuelle Prüfungsanfrage erstellt.`,
                )
              : t(
                  'A manual review request will be created for this organization.',
                  'Une demande de revue manuelle sera creee pour cette organisation.',
                  'Für diese Organisation wird eine manuelle Prüfungsanfrage erstellt.',
                )}
          </Typography>
          <Typography sx={{ color: 'text.secondary' }}>
            {t(
              'No automatic claim will happen immediately. You will be able to continue using the app while the request is reviewed.',
              'Aucun claim automatique ne sera effectue immediatement. Tu pourras continuer a utiliser l appli pendant la revue de la demande.',
              'Es erfolgt kein sofortiger automatischer Claim. Du kannst die App während der Prüfung normal weiterverwenden.',
            )}
          </Typography>
        </Stack>
      </AppDialog>

      <AppDialog
        open={Boolean(organizationSharingDialogTarget && organizationSharingDialogState)}
        dismissable={!Boolean(organizationActionSid)}
        onOpenChange={(open) => {
          if (!open) closeOrganizationSharingDialog();
        }}
        width="min(36rem, calc(100vw - 2rem))"
        title={
          organizationSharingDialogState?.enabled
            ? t(
                'Enable blueprint sharing?',
                'Activer le partage de blueprints ?',
                'Blueprint-Freigabe aktivieren?',
              )
            : t(
                'Disable blueprint sharing?',
                'Desactiver le partage de blueprints ?',
                'Blueprint-Freigabe deaktivieren?',
              )
        }
        footer={
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button
              variant="ghost"
              onClick={closeOrganizationSharingDialog}
              disabled={Boolean(organizationActionSid)}
            >
              {t('Cancel', 'Annuler', 'Abbrechen')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                void handleSetOrganizationSharing();
              }}
              disabled={Boolean(organizationActionSid)}
            >
              {organizationActionSid
                ? t('Saving...', 'Enregistrement...', 'Speichere...')
                : organizationSharingDialogState?.enabled
                  ? t('Enable sharing', 'Activer le partage', 'Freigabe aktivieren')
                  : t('Disable sharing', 'Desactiver le partage', 'Freigabe deaktivieren')}
            </Button>
          </Box>
        }
      >
        <Stack spacing={2}>
          <Typography sx={{ color: 'text.secondary' }}>
            {organizationSharingDialogTarget
              ? organizationSharingDialogState?.enabled
                ? t(
                    `Shared blueprints will become visible again in ${organizationSharingDialogTarget.name}.`,
                    `Les blueprints partages redeviendront visibles dans ${organizationSharingDialogTarget.name}.`,
                    `Geteilte Blueprints werden in ${organizationSharingDialogTarget.name} wieder sichtbar.`,
                  )
                : t(
                    `Shared blueprints will stop being visible in ${organizationSharingDialogTarget.name} until you reactivate sharing.`,
                    `Les blueprints partages ne seront plus visibles dans ${organizationSharingDialogTarget.name} tant que tu ne reactives pas le partage.`,
                    `Geteilte Blueprints sind in ${organizationSharingDialogTarget.name} nicht mehr sichtbar, bis du die Freigabe wieder aktivierst.`,
                  )
              : organizationSharingDialogState?.enabled
                ? t(
                    'Shared blueprints will become visible again in this organization.',
                    'Les blueprints partages redeviendront visibles dans cette organisation.',
                    'Geteilte Blueprints werden in dieser Organisation wieder sichtbar.',
                  )
                : t(
                    'Shared blueprints will stop being visible in this organization until you reactivate sharing.',
                    'Les blueprints partages ne seront plus visibles dans cette organisation tant que tu ne reactives pas le partage.',
                    'Geteilte Blueprints sind in dieser Organisation nicht mehr sichtbar, bis du die Freigabe wieder aktivierst.',
                  )}
          </Typography>
          <Typography sx={{ color: 'text.secondary' }}>
            {organizationSharingDialogState?.enabled
              ? t(
                  'Existing share settings are preserved. They will be reused immediately if you enable sharing again later.',
                  'Les reglages de partage existants sont conserves. Ils seront reutilises immediatement si tu reactives le partage plus tard.',
                  'Bestehende Freigabeeinstellungen bleiben erhalten. Sie werden sofort wiederverwendet, wenn du die Freigabe später erneut aktivierst.',
                )
              : t(
                  'Reactivating sharing makes the already configured shared blueprints available again without having to reselect them.',
                  'La reactivation du partage rend a nouveau disponibles les blueprints deja configures sans avoir a les reselectionner.',
                  'Beim erneuten Aktivieren werden die bereits konfigurierten geteilten Blueprints wieder verfügbar, ohne dass du sie erneut auswählen musst.',
                )}
          </Typography>
        </Stack>
      </AppDialog>

      <AppDialog
        open={Boolean(organizationDeleteDialogTarget)}
        dismissable={!Boolean(organizationActionSid)}
        onOpenChange={(open) => {
          if (!open) closeDeleteOrganizationDialog();
        }}
        width="min(36rem, calc(100vw - 2rem))"
        title={t(
          'Delete organization from the app?',
          'Supprimer l organisation de l appli ?',
          'Organisation aus der App löschen?',
        )}
        footer={
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button
              variant="ghost"
              onClick={closeDeleteOrganizationDialog}
              disabled={Boolean(organizationActionSid)}
            >
              {t('Cancel', 'Annuler', 'Abbrechen')}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                void handleDeleteOrganization();
              }}
              disabled={Boolean(organizationActionSid)}
            >
              {organizationActionSid
                ? t('Deleting...', 'Suppression...', 'Lösche...')
                : t('Delete organization', 'Supprimer l organisation', 'Organisation löschen')}
            </Button>
          </Box>
        }
      >
        <Stack spacing={2}>
          <Typography sx={{ color: 'text.secondary' }}>
            {organizationDeleteDialogTarget
              ? t(
                  `This will remove ${organizationDeleteDialogTarget.name} from the app for every linked member account.`,
                  `Cela supprimera ${organizationDeleteDialogTarget.name} de l appli pour tous les comptes membres lies.`,
                  `Dadurch wird ${organizationDeleteDialogTarget.name} für alle verknüpften Mitgliedskonten aus der App entfernt.`,
                )
              : t(
                  'This will remove the organization from the app for every linked member account.',
                  'Cela supprimera l organisation de l appli pour tous les comptes membres lies.',
                  'Dadurch wird die Organisation für alle verknüpften Mitgliedskonten aus der App entfernt.',
                )}
          </Typography>
          <Typography sx={{ color: 'text.secondary' }}>
            {t(
              'Members will have to relink or add the organization again later if you decide to reopen it.',
              'Les membres devront relier ou ajouter a nouveau l organisation plus tard si tu decides de la rouvrir.',
              'Mitglieder müssen die Organisation später erneut verknupfen oder hinzufügen, wenn du sie wieder öffnen willst.',
            )}
          </Typography>
        </Stack>
      </AppDialog>

      <AppDialog
        open={rsiDialogOpen}
        dismissable={!rsiAction.busy}
        onOpenChange={(open) => {
          if (!open && !rsiAction.busy) setRsiDialogOpen(false);
        }}
        width="min(36rem, calc(100vw - 2rem))"
        title={
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Box
              component="img"
              src={rsiLogoOfficial}
              alt=""
              sx={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 0.75 }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" component="span" sx={{ display: 'block', fontWeight: 800 }}>
                {t('Manual RSI verification', 'Verification RSI manuelle', 'Manuelle RSI-Verifizierung')}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {t(
                  'Alternative verification method',
                  'Methode de verification alternative',
                  'Alternative Verifizierungsmethode',
                )}
              </Typography>
            </Box>
          </Stack>
        }
        footer={
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button variant="ghost" onClick={() => setRsiDialogOpen(false)} disabled={rsiAction.busy}>
              {t('Cancel', 'Annuler', 'Abbrechen')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                void handleVerifyRsiLink();
              }}
              disabled={rsiAction.busy || !rsiHandleInput.trim()}
            >
              {rsiAction.busy
                ? t('Please wait...', 'Patiente...', 'Bitte warten...')
                : rsiCode
                  ? t('Verify and link', 'Verifier et lier', 'Verifizieren und verknupfen')
                  : t('Get verification code', 'Obtenir un code', 'Verifizierungscode anfordern')}
            </Button>
          </Box>
        }
      >
        <Stack spacing={2}>
          <AppAlert severity="info">
            {t(
              'Citizen iD is not available right now.',
              'Citizen iD n est pas disponible pour le moment.',
              'Citizen iD ist derzeit nicht verfuegbar.',
            )}
          </AppAlert>

          <Typography sx={{ color: 'text.secondary' }}>
            {t(
              'Enter your RSI handle to get a verification code. Paste the code into the short bio on your RSI profile, then verify within 15 minutes.',
              'Saisis ton handle RSI pour obtenir un code. Colle le code dans la short bio de ton profil RSI, puis verifie dans les 15 minutes.',
              'Gib deinen RSI-Handle ein, um einen Code zu erhalten. Fuege ihn in die Kurzbiografie deines RSI-Profils ein und verifiziere innerhalb von 15 Minuten.',
            )}
          </Typography>

          <Typography sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }}>
            <Link
              href="https://robertsspaceindustries.com/en/account/profile"
              target="_blank"
              rel="noreferrer"
              underline="hover"
              sx={{ overflowWrap: 'anywhere', wordBreak: 'break-all' }}
            >
              https://robertsspaceindustries.com/en/account/profile
            </Link>
          </Typography>

          <AppTextField
            label={t('RSI handle', 'Handle RSI', 'RSI-Handle')}
            value={rsiHandleInput}
            onValueChange={(value) => {
              setRsiHandleInput(value);
              setRsiChallenge(null);
              setRsiCopyFeedback(null);
            }}
            disabled={rsiAction.busy}
            autoFocus
          />

          {rsiChallenge && (
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                backgroundColor: alpha(theme.palette.background.default, 0.45),
              }}
            >
              <Stack spacing={1.5}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  {t('Verification code', 'Code de verification', 'Verifizierungscode')}
                </Typography>
                <Typography
                  variant="h3"
                  sx={{
                    fontFamily: FONT_MONO,
                    fontSize: '1.25rem',
                    overflowWrap: 'anywhere',
                    lineHeight: 1.4,
                  }}
                >
                  {rsiCode}
                </Typography>
                <Box>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      void handleCopyRsiCode();
                    }}
                  >
                    {t('Copy code', 'Copier le code', 'Code kopieren')}
                  </Button>
                </Box>
                {rsiCopyFeedback && (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {rsiCopyFeedback}
                  </Typography>
                )}
              </Stack>
            </Paper>
          )}

          {rsiAction.error && <AppAlert severity="error">{rsiAction.error}</AppAlert>}
        </Stack>
      </AppDialog>
    </>
  );
}
