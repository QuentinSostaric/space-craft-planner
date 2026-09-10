import { useState } from 'react';
import discordSymbol from '../../assets/discord-symbol.svg';
import { Box, Divider, Paper, Stack, Typography, alpha } from '../../ui/system';
import { sanitizeExternalHttpsUrl } from '../../utils/urlSafety';
import { CitizenIdIcon } from '../CitizenIdBrand';
import { Button } from '../ui/Button';
import { AppSwitch, AppTextField } from '../ui/controls';
import { AppChip } from '../ui/data-display/AppChip';
import { AppAlert } from '../ui/feedback';
import { Avatar, Link } from '../ui/primitives';
import { formatAbsoluteDate, normalizeOrganizationSidInput, openDiscordBotInvite } from './accountHelpers';
import type { AccountController } from './useAccountController';

export function AccountOrganizationsPanel({ model }: { model: AccountController }) {
  const [search, setSearch] = useState('');
  const {
    t,
    account,
    theme,
    citizenIdRsiLinkEnabled,
    citizenIdBrandEnvironment,
    rsiAction,
    organizationSidInput,
    setOrganizationSidInput,
    organizationAddBusy,
    organizationActionSid,
    organizationError,
    organizationNotice,
    linkedOrganizations,
    canManageOrganizations,
    handleCitizenIdRsiLink,
    handleAddOrganization,
    handleRemoveOrganization,
    openClaimOrganizationDialog,
    openDeleteOrganizationDialog,
    openOrganizationSharingDialog,
  } = model;
  const query = search.trim().toLocaleLowerCase();
  const visibleOrganizations = linkedOrganizations.filter((organization) =>
    `${organization.name} ${organization.sid} ${organization.rank ?? ''}`.toLocaleLowerCase().includes(query),
  );
  const openMyShares = () => {
    model.updatePreferences({ filter: 'all', search: '', sharing: 'all' });
    model.setActiveTab('inventory');
  };

  return (
    <Stack role="tabpanel" id="account-tabpanel-orgs" aria-labelledby="account-tab-orgs" spacing={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
      >
        <Box>
          <Typography component="h2" variant="h5">
            {t('My organizations', 'Mes organisations', 'Meine Organisationen')}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary', maxWidth: 660 }}>
            {t(
              'Control your access and choose what you share with each group.',
              'Gère tes accès et choisis ce que tu partages avec chaque groupe.',
              'Verwalte deinen Zugang und entscheide, was du mit jeder Gruppe teilst.',
            )}
          </Typography>
        </Box>
        {canManageOrganizations && (
          <Button href="/organizations" variant="secondary">
            {t('Browse shared inventories', 'Voir les inventaires partagés', 'Geteilte Inventare ansehen')}
          </Button>
        )}
      </Stack>

      {organizationError && <AppAlert severity="error">{organizationError}</AppAlert>}
      {organizationNotice && <AppAlert severity="success">{organizationNotice}</AppAlert>}

      {!canManageOrganizations ? (
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
          <Stack spacing={1.5} alignItems="flex-start">
            <Typography component="h3" variant="h6">
              {t(
                'Verify your RSI identity to get started',
                'Vérifie ton identité RSI pour commencer',
                'Verifiziere zuerst deine RSI-Identität',
              )}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {t(
                'A verified RSI account gives you access to your organizations and their shared blueprints and resources.',
                'Un compte RSI vérifié donne accès à tes organisations et à leurs blueprints et ressources partagés.',
                'Ein verifiziertes RSI-Konto ermöglicht den Zugang zu deinen Organisationen und ihren geteilten Blueprints und Ressourcen.',
              )}
            </Typography>
            <Button variant="primary" onClick={() => model.setActiveTab('settings')}>
              {t('Set up my RSI account', 'Configurer mon compte RSI', 'RSI-Konto einrichten')}
            </Button>
          </Stack>
        </Paper>
      ) : (
        <>
          {linkedOrganizations.length > 1 && (
            <AppTextField
              label={t('Find an organization', 'Rechercher une organisation', 'Organisation suchen')}
              value={search}
              onValueChange={setSearch}
              placeholder={t('Name, SID or role', 'Nom, SID ou rôle', 'Name, SID oder Rolle')}
            />
          )}
          <Typography variant="body2" aria-live="polite" sx={{ color: 'text.secondary' }}>
            {t(
              `${visibleOrganizations.length} of ${linkedOrganizations.length} organizations`,
              `${visibleOrganizations.length} sur ${linkedOrganizations.length} organisations`,
              `${visibleOrganizations.length} von ${linkedOrganizations.length} Organisationen`,
            )}
          </Typography>

          {visibleOrganizations.map((organization) => {
            const claimPending = organization.claimRequestStatus === 'pending';
            const queued = model.optimisticState.pendingMutations.some(
              (mutation) =>
                (mutation.kind === 'organization-membership' ||
                  mutation.kind === 'organization-sharing' ||
                  mutation.kind === 'organization-claim') &&
                mutation.payload.sid === organization.sid,
            );
            const busy = organizationActionSid === organization.sid || queued;
            const sharingEnabled = organization.blueprintSharingEnabled !== false;
            const blueprintCount = account?.organizationBlueprintShares[organization.sid]?.length ?? 0;
            const resourceCount = account?.organizationResourceShares[organization.sid]?.length ?? 0;
            const organizationUrl = sanitizeExternalHttpsUrl(organization.url);
            const statusLabel =
              organization.status === 'verified_admin'
                ? t('Verified admin', 'Admin vérifié', 'Verifizierter Admin')
                : organization.status === 'verified_member'
                  ? t('Verified member', 'Membre vérifié', 'Verifiziertes Mitglied')
                  : t(
                      'Membership not verified',
                      'Appartenance non vérifiée',
                      'Mitgliedschaft nicht verifiziert',
                    );
            const metadata = [
              [
                t('Source', 'Source', 'Quelle'),
                organization.source === 'profile-main'
                  ? t('Main RSI organization', 'Organisation RSI principale', 'RSI-Hauptorganisation')
                  : t('Added manually', 'Ajout manuel', 'Manuell hinzugefügt'),
              ],
              [
                t('Last role verification', 'Dernière vérification du rôle', 'Letzte Rollenverifizierung'),
                formatAbsoluteDate(organization.lastVerifiedAt),
              ],
              [
                t('Last member snapshot', 'Dernier relevé des membres', 'Letzter Mitgliederstand'),
                formatAbsoluteDate(organization.lastLiveSyncAt),
              ],
              [
                t('Members in snapshot', 'Membres dans le relevé', 'Mitglieder im Datenstand'),
                organization.memberCount ? organization.memberCount.toLocaleString() : null,
              ],
              [
                t('RSI rank', 'Rang RSI', 'RSI-Rang'),
                organization.stars == null ? null : `${organization.stars}/5`,
              ],
              [
                t('Claim requested', 'Demande de gestion', 'Verwaltung beantragt'),
                formatAbsoluteDate(organization.claimRequestSubmittedAt),
              ],
            ];

            return (
              <Paper
                key={organization.sid}
                component="article"
                aria-label={organization.name}
                variant="outlined"
                sx={{ p: { xs: 1.5, sm: 2 }, minWidth: 0 }}
              >
                <Stack spacing={1.5}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1.5}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                  >
                    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
                      <Avatar
                        src={organization.image ?? organization.logo ?? undefined}
                        alt=""
                        variant="rounded"
                        sx={{ width: 44, height: 44 }}
                      >
                        {organization.name.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography component="h3" variant="h6" sx={{ overflowWrap: 'anywhere' }}>
                          {organization.name}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {organization.sid}
                          {organization.rank ? ` · ${organization.rank}` : ''}
                        </Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                      <AppChip
                        size="sm"
                        outlined
                        label={statusLabel}
                        tone={organization.status === 'observed' ? 'default' : 'success'}
                      />
                      {organization.claimedByCurrentUser && (
                        <AppChip
                          size="sm"
                          outlined
                          tone="primary"
                          label={t(
                            'You manage this group',
                            'Tu gères ce groupe',
                            'Du verwaltest diese Gruppe',
                          )}
                        />
                      )}
                      {claimPending && (
                        <AppChip
                          size="sm"
                          outlined
                          tone="warning"
                          label={t(
                            'Claim under review',
                            'Gestion en cours de validation',
                            'Verwaltung wird geprüft',
                          )}
                        />
                      )}
                      {queued && (
                        <AppChip size="sm" outlined label={t('Saving…', 'Enregistrement…', 'Speichert…')} />
                      )}
                    </Stack>
                  </Stack>

                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1.25}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    justifyContent="space-between"
                    sx={{ p: 1.25, borderRadius: 1, backgroundColor: 'ui.surface2' }}
                  >
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {t('Your shared items', 'Tes éléments partagés', 'Deine Freigaben')}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
                        {t(
                          `${blueprintCount} blueprints · ${resourceCount} resource batches`,
                          `${blueprintCount} blueprints · ${resourceCount} lots de ressources`,
                          `${blueprintCount} Blueprints · ${resourceCount} Ressourcenposten`,
                        )}
                      </Typography>
                    </Box>
                    <Button size="sm" variant="secondary" onClick={openMyShares}>
                      {t('Manage my shares', 'Gérer mes partages', 'Freigaben verwalten')}
                    </Button>
                  </Stack>
                  {!sharingEnabled && (
                    <Typography variant="body2" sx={{ color: 'warning.main' }}>
                      {t(
                        'Blueprint sharing is paused by this organization.',
                        'Le partage de blueprints est suspendu par cette organisation.',
                        'Diese Organisation hat die Blueprint-Freigabe pausiert.',
                      )}
                    </Typography>
                  )}

                  <Box
                    component="details"
                    sx={{
                      '& summary': {
                        cursor: 'pointer',
                        color: 'text.secondary',
                        py: 0.75,
                        minHeight: 40,
                        '&:focus-visible': {
                          outline: '2px solid',
                          outlineColor: 'primary.main',
                          outlineOffset: 2,
                        },
                      },
                    }}
                  >
                    <Box component="summary">
                      {t(
                        'Details and organization controls',
                        'Détails et gestion de l’organisation',
                        'Details und Organisationsverwaltung',
                      )}
                    </Box>
                    <Stack spacing={1.5} sx={{ pt: 1 }}>
                      <Box
                        component="dl"
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                          gap: 1.25,
                          m: 0,
                        }}
                      >
                        {metadata
                          .filter(([, value]) => value)
                          .map(([label, value]) => (
                            <Box key={label}>
                              <Typography component="dt" variant="caption" sx={{ color: 'text.secondary' }}>
                                {label}
                              </Typography>
                              <Typography component="dd" variant="body2" sx={{ m: 0 }}>
                                {value}
                              </Typography>
                            </Box>
                          ))}
                      </Box>
                      {organization.syncStatus === 'stale' && (
                        <AppAlert severity="info">
                          {t(
                            'The stored member snapshot is old. Sync with Citizen iD to verify your current role.',
                            'Le relevé des membres est ancien. Synchronise avec Citizen iD pour vérifier ton rôle actuel.',
                            'Der gespeicherte Mitgliederstand ist veraltet. Synchronisiere mit Citizen iD, um deine aktuelle Rolle zu prüfen.',
                          )}
                        </AppAlert>
                      )}
                      {organizationUrl && (
                        <Link href={organizationUrl} target="_blank" rel="noopener noreferrer">
                          {t(
                            'View public RSI profile',
                            'Voir le profil public RSI',
                            'Öffentliches RSI-Profil ansehen',
                          )}
                        </Link>
                      )}
                      <Divider />
                      {organization.claimedByCurrentUser && (
                        <>
                          <AppSwitch
                            label={t(
                              'Enable blueprint sharing for this group',
                              'Activer le partage de blueprints du groupe',
                              'Blueprint-Freigabe für diese Gruppe aktivieren',
                            )}
                            checked={sharingEnabled}
                            disabled={busy}
                            onCheckedChange={(checked) =>
                              openOrganizationSharingDialog(organization.sid, checked)
                            }
                          />
                          <Button
                            variant="secondary"
                            size="sm"
                            sx={{ alignSelf: 'flex-start' }}
                            onClick={openDiscordBotInvite}
                            icon={
                              <Box
                                component="img"
                                src={discordSymbol}
                                alt=""
                                sx={{ width: 16, height: 16 }}
                              />
                            }
                          >
                            {t('Add Discord bot', 'Ajouter le bot Discord', 'Discord-Bot hinzufügen')}
                          </Button>
                        </>
                      )}
                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                        {!organization.claimed && !claimPending && (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={busy}
                            onClick={() => openClaimOrganizationDialog(organization.sid)}
                          >
                            {t(
                              'Request management access',
                              'Demander les droits de gestion',
                              'Verwaltungszugriff beantragen',
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            void handleRemoveOrganization(organization.sid);
                          }}
                        >
                          {t('Remove from my account', 'Retirer de mon compte', 'Aus meinem Konto entfernen')}
                        </Button>
                        {organization.claimedByCurrentUser && (
                          <Button
                            variant="danger"
                            size="sm"
                            disabled={busy}
                            onClick={() => openDeleteOrganizationDialog(organization.sid)}
                          >
                            {t('Delete from SC Craft', 'Supprimer de SC Craft', 'Aus SC Craft löschen')}
                          </Button>
                        )}
                      </Stack>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {t(
                          'Removing this group from SC Craft does not change your RSI membership.',
                          'Retirer ce groupe de SC Craft ne modifie pas ton appartenance sur RSI.',
                          'Das Entfernen aus SC Craft ändert deine RSI-Mitgliedschaft nicht.',
                        )}
                      </Typography>
                    </Stack>
                  </Box>
                </Stack>
              </Paper>
            );
          })}

          {visibleOrganizations.length === 0 && (
            <Paper variant="outlined" sx={{ p: 3, borderStyle: 'dashed', textAlign: 'center' }}>
              <Typography component="h3" variant="h6">
                {query
                  ? t(
                      'No matching organizations',
                      'Aucune organisation correspondante',
                      'Keine passenden Organisationen',
                    )
                  : t(
                      'Your organizations will appear here',
                      'Tes organisations apparaîtront ici',
                      'Deine Organisationen erscheinen hier',
                    )}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75 }}>
                {query
                  ? t(
                      'Try another name or SID.',
                      'Essaie un autre nom ou SID.',
                      'Versuche einen anderen Namen oder eine andere SID.',
                    )
                  : t(
                      'Sync with Citizen iD or add a public organization below.',
                      'Synchronise avec Citizen iD ou ajoute une organisation publique ci-dessous.',
                      'Synchronisiere mit Citizen iD oder füge unten eine öffentliche Organisation hinzu.',
                    )}
              </Typography>
              {query && (
                <Button variant="ghost" size="sm" sx={{ mt: 1 }} onClick={() => setSearch('')}>
                  {t('Clear search', 'Effacer la recherche', 'Suche löschen')}
                </Button>
              )}
            </Paper>
          )}

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1.5}
              alignItems={{ xs: 'stretch', md: 'center' }}
              justifyContent="space-between"
            >
              <Box>
                <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {t(
                    'Keep your memberships up to date',
                    'Actualiser tes appartenances',
                    'Mitgliedschaften aktuell halten',
                  )}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                  {t(
                    'Citizen iD imports your public organizations and verifies your role.',
                    'Citizen iD importe tes organisations publiques et vérifie ton rôle.',
                    'Citizen iD importiert deine öffentlichen Organisationen und verifiziert deine Rolle.',
                  )}
                </Typography>
              </Box>
              <Button
                variant="secondary"
                icon={
                  <CitizenIdIcon
                    environment={citizenIdBrandEnvironment}
                    size={18}
                    variant={theme.palette.mode === 'dark' ? 'light' : 'dark'}
                  />
                }
                disabled={rsiAction.busy || !citizenIdRsiLinkEnabled}
                onClick={() => handleCitizenIdRsiLink('/account?section=orgs')}
              >
                {rsiAction.busy
                  ? t('Syncing…', 'Synchronisation…', 'Synchronisiere…')
                  : t(
                      'Sync with Citizen iD',
                      'Synchroniser avec Citizen iD',
                      'Mit Citizen iD synchronisieren',
                    )}
              </Button>
            </Stack>
            {!citizenIdRsiLinkEnabled && (
              <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                {t(
                  'Citizen iD sync is unavailable in this environment. You can add a public organization below.',
                  'La synchronisation Citizen iD est indisponible ici. Tu peux ajouter une organisation publique ci-dessous.',
                  'Die Citizen iD-Synchronisierung ist hier nicht verfügbar. Du kannst unten eine öffentliche Organisation hinzufügen.',
                )}
              </Typography>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, backgroundColor: alpha(theme.palette.primary.main, 0.025) }}>
            <Box
              component="form"
              onSubmit={(event) => {
                event.preventDefault();
                if (!organizationAddBusy && normalizeOrganizationSidInput(organizationSidInput))
                  void handleAddOrganization();
              }}
            >
              <Stack spacing={1.5}>
                <Box>
                  <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {t(
                      'Add a missing organization',
                      'Ajouter une organisation manquante',
                      'Fehlende Organisation hinzufügen',
                    )}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                    {t(
                      'Use its public RSI SID or URL when Citizen iD has not imported it.',
                      'Utilise son SID ou son URL RSI publique si Citizen iD ne l’a pas importée.',
                      'Nutze ihre öffentliche RSI-SID oder URL, wenn Citizen iD sie nicht importiert hat.',
                    )}
                  </Typography>
                </Box>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  alignItems={{ xs: 'stretch', sm: 'flex-end' }}
                >
                  <AppTextField
                    label={t(
                      'Organization SID or URL',
                      'SID ou URL de l’organisation',
                      'Organisations-SID oder URL',
                    )}
                    value={organizationSidInput}
                    onValueChange={setOrganizationSidInput}
                    placeholder="PROTECTORA"
                    disabled={organizationAddBusy}
                    fieldSx={{ flex: 1 }}
                  />
                  <Button
                    type="submit"
                    variant="secondary"
                    disabled={organizationAddBusy || !normalizeOrganizationSidInput(organizationSidInput)}
                  >
                    {organizationAddBusy
                      ? t('Adding…', 'Ajout…', 'Füge hinzu…')
                      : t('Add organization', 'Ajouter l’organisation', 'Organisation hinzufügen')}
                  </Button>
                </Stack>
              </Stack>
            </Box>
          </Paper>
        </>
      )}
    </Stack>
  );
}
