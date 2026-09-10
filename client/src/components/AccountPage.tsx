import type { KeyboardEvent } from 'react';
import { FONT_DISPLAY, FONT_MONO } from '../theme';
import {
  CloudSyncOutlinedIcon,
  GroupsOutlinedIcon,
  HandymanOutlinedIcon,
  Inventory2OutlinedIcon,
  LogoutOutlinedIcon,
  PersonOutlineOutlinedIcon,
  RefreshOutlinedIcon,
  TuneIcon,
} from '../ui/icons';
import { alpha, Box, Paper, Stack, Typography, useMediaQuery } from '../ui/system';
import { AccountDialogs } from './account/AccountDialogs';
import { AccountGuestView } from './account/AccountGuestView';
import { AccountInventoryPanel } from './account/AccountInventoryPanel';
import { AccountOrganizationsPanel } from './account/AccountOrganizationsPanel';
import { AccountOverviewPanel } from './account/AccountOverviewPanel';
import { AccountSettingsPanel } from './account/AccountSettingsPanel';
import { CraftRequestsPanel } from './account/CraftRequestsPanel';
import {
  formatAbsoluteDate,
  handleAccountTabKeyDown,
  openDiscordBotInvite,
  type AccountTab,
} from './account/accountHelpers';
import { useAccountController } from './account/useAccountController';
import { AppButton } from './ui/controls';
import { AppChip } from './ui/data-display/AppChip';
import { AppAlert } from './ui/feedback';
import { SurfaceState } from './ui/feedback/SurfaceState';
import { PageHeader } from './ui/page/PageHeader';
import { PageLayout } from './ui/page/PageLayout';
import { Avatar } from './ui/primitives';

export function AccountPage() {
  const model = useAccountController();
  const {
    t,
    loading,
    user,
    account,
    theme,
    activeTab,
    setActiveTab,
    activeDataset,
    syncStatus,
    syncError,
    desktopAuthError,
    sessionAction,
    handleRefresh,
    handleLogout,
    pendingCraftRequestCount,
    rsiVerificationRequired,
    handleStartRsiLink,
  } = model;
  const wide = useMediaQuery('(min-width: 1100px)');
  const sections = [
    {
      id: 'overview',
      label: t('Overview', 'Aperçu', 'Übersicht'),
      detail: t(
        'Your workspace at a glance',
        'Ton espace en un coup d’œil',
        'Dein Arbeitsbereich im Überblick',
      ),
      icon: PersonOutlineOutlinedIcon,
    },
    {
      id: 'inventory',
      label: t('Inventory', 'Inventaire', 'Inventar'),
      detail: t(
        'Blueprints, favorites & resources',
        'Blueprints, favoris et ressources',
        'Blueprints, Favoriten & Ressourcen',
      ),
      icon: Inventory2OutlinedIcon,
    },
    {
      id: 'requests',
      label: t('Craft requests', 'Demandes de craft', 'Craft-Anfragen'),
      detail: t('Coordinate with other crafters', 'Coordonne tes crafts', 'Crafting gemeinsam planen'),
      icon: HandymanOutlinedIcon,
    },
    {
      id: 'orgs',
      label: t('Organizations', 'Organisations', 'Organisationen'),
      detail: t('Memberships & sharing', 'Membres et partages', 'Mitgliedschaften & Freigaben'),
      icon: GroupsOutlinedIcon,
    },
    {
      id: 'settings',
      label: t('Settings', 'Paramètres', 'Einstellungen'),
      detail: t(
        'Connections, preferences & data',
        'Connexions, préférences et données',
        'Verbindungen, Einstellungen & Daten',
      ),
      icon: TuneIcon,
    },
  ] as const;
  const syncLabel =
    syncStatus === 'syncing'
      ? t('Saving changes…', 'Enregistrement…', 'Änderungen speichern…')
      : syncError || syncStatus === 'error'
        ? t('Sync needs attention', 'Synchronisation à vérifier', 'Synchronisierung prüfen')
        : syncStatus === 'pending'
          ? t(
              'Changes waiting to sync',
              'Modifications en attente de synchronisation',
              'Änderungen warten auf Synchronisierung',
            )
          : t('Cloud connected', 'Connecté au cloud', 'Mit der Cloud verbunden');

  if (loading)
    return (
      <PageLayout width="content">
        <PageHeader title={t('Account', 'Compte', 'Konto')} />
        <SurfaceState
          tone="loading"
          title={t('Loading your account…', 'Chargement de ton compte…', 'Dein Konto wird geladen…')}
        />
      </PageLayout>
    );

  return (
    <PageLayout sx={{ maxWidth: 1640, gap: 2.5 }}>
      <PageHeader
        title={t('Account', 'Compte', 'Konto')}
        eyebrow={user ? undefined : 'SC CRAFT / ACCOUNT'}
        description={
          user ? (
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
              {t(
                'Your collection. Your crew. Your way to craft.',
                'Ta collection. Ton équipage. Ta façon de crafter.',
                'Deine Sammlung. Deine Crew. Dein Crafting.',
              )}
            </Box>
          ) : (
            t(
              'Take your crafting workspace with you.',
              'Retrouve ton espace de craft partout.',
              'Dein Crafting-Arbeitsbereich, überall dabei.',
            )
          )
        }
        actions={
          user ? (
            <AppChip
              label={`${(activeDataset.channel ?? 'live').toUpperCase()} · ${t('Account data', 'Données du compte', 'Kontodaten')}`}
              outlined
              size="sm"
            />
          ) : undefined
        }
      />

      {model.urlAuthError && (
        <AppAlert severity="error">
          {t('Authentication failed.', 'Échec de l’authentification.', 'Authentifizierung fehlgeschlagen.')}{' '}
          {model.urlAuthError}
        </AppAlert>
      )}
      {desktopAuthError && <AppAlert severity="error">{desktopAuthError}</AppAlert>}
      {!user ? (
        <AccountGuestView
          enabled={model.enabled && model.citizenIdLoginEnabled}
          brandEnvironment={model.citizenIdBrandEnvironment}
          onLogin={() => model.loginWithCitizenId('/account')}
          onInviteBot={openDiscordBotInvite}
        />
      ) : (
        <>
          <Paper
            variant="outlined"
            sx={{
              p: { xs: 1.5, md: 2.5 },
              display: 'flex',
              gap: { xs: 1.25, sm: 2 },
              alignItems: 'center',
              flexWrap: 'wrap',
              borderTop: '3px solid',
              borderTopColor: 'primary.main',
            }}
          >
            <Avatar
              src={user.avatarUrl ?? undefined}
              alt=""
              sx={{
                width: { xs: 40, sm: 56 },
                height: { xs: 40, sm: 56 },
                fontFamily: FONT_DISPLAY,
                fontWeight: 750,
                backgroundColor: alpha(theme.palette.primary.main, 0.12),
                color: 'text.primary',
              }}
            >
              {user.displayName.charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 150 }}>
              <Typography
                component="h2"
                sx={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: { xs: '1.05rem', sm: '1.35rem' },
                  fontWeight: 750,
                  overflowWrap: 'anywhere',
                }}
              >
                {user.displayName}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                @{user.username}
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: { xs: 0.5, sm: 1 },
                flexWrap: 'wrap',
                width: { xs: '100%', sm: 'auto' },
              }}
            >
              <Box
                role="status"
                aria-live="polite"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  color: syncError ? 'warning.main' : 'text.secondary',
                  fontSize: '.75rem',
                  mr: { xs: 0, sm: 1 },
                  flex: { xs: '1 0 100%', sm: '0 1 auto' },
                }}
              >
                <CloudSyncOutlinedIcon sx={{ fontSize: 17 }} />
                {syncLabel}
              </Box>
              <AppButton
                variant="secondary"
                size="sm"
                icon={<RefreshOutlinedIcon sx={{ fontSize: 16 }} />}
                loading={sessionAction.busy}
                disabled={syncStatus === 'syncing'}
                onClick={() => {
                  void handleRefresh();
                }}
              >
                {t('Refresh', 'Actualiser', 'Aktualisieren')}
              </AppButton>
              <AppButton
                variant="ghost"
                size="sm"
                icon={<LogoutOutlinedIcon sx={{ fontSize: 16 }} />}
                disabled={sessionAction.busy || syncStatus === 'syncing'}
                onClick={() => {
                  void handleLogout();
                }}
              >
                {t('Sign out', 'Déconnexion', 'Abmelden')}
              </AppButton>
            </Box>
          </Paper>
          {(syncError || sessionAction.error) && (
            <AppAlert severity="error">{sessionAction.error || syncError}</AppAlert>
          )}
          {rsiVerificationRequired && (
            <AppAlert severity="warning">
              <Stack spacing={1} alignItems="flex-start">
                <Typography>
                  {t(
                    'Please verify your RSI account again to restore access to organization sharing. Your saved inventory is preserved.',
                    'Vérifie à nouveau ton compte RSI pour rétablir le partage avec tes organisations. Ton inventaire est conservé.',
                    'Verifiziere dein RSI-Konto erneut, um die Organisationsfreigabe wieder zu aktivieren. Dein Inventar bleibt erhalten.',
                  )}
                </Typography>
                <AppButton variant="secondary" onClick={handleStartRsiLink}>
                  {t('Verify RSI account', 'Vérifier le compte RSI', 'RSI-Konto verifizieren')}
                </AppButton>
              </Stack>
            </AppAlert>
          )}
          {!account ? (
            <SurfaceState
              tone="error"
              title={t(
                'Account data is unavailable',
                'Les données du compte sont indisponibles',
                'Kontodaten sind nicht verfügbar',
              )}
              description={t(
                'Refresh to try loading your saved workspace again.',
                'Actualise pour recharger ton espace sauvegardé.',
                'Aktualisiere, um deinen gespeicherten Arbeitsbereich erneut zu laden.',
              )}
            />
          ) : (
            <Box
              inert={sessionAction.busy}
              aria-busy={sessionAction.busy}
              sx={{
                display: 'grid',
                gridTemplateColumns: wide ? '236px minmax(0, 1fr)' : 'minmax(0, 1fr)',
                gap: { xs: 2, lg: 3 },
                alignItems: 'start',
              }}
            >
              <Box component="aside" sx={{ position: wide ? 'sticky' : 'static', top: 16, minWidth: 0 }}>
                <Box
                  role="tablist"
                  aria-label={t('Account sections', 'Sections du compte', 'Kontobereiche')}
                  aria-orientation={wide ? 'vertical' : 'horizontal'}
                  sx={{
                    display: 'flex',
                    flexDirection: wide ? 'column' : 'row',
                    gap: 0.5,
                    overflowX: 'auto',
                    pb: 1,
                  }}
                >
                  {sections.map(({ id, label, detail, icon: Icon }) => (
                    <Box
                      component="button"
                      type="button"
                      role="tab"
                      key={id}
                      id={`account-tab-${id}`}
                      data-tab-id={id}
                      aria-selected={activeTab === id}
                      aria-controls={`account-tabpanel-${id}`}
                      tabIndex={activeTab === id ? 0 : -1}
                      onClick={() => setActiveTab(id)}
                      onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) =>
                        handleAccountTabKeyDown(event, id as AccountTab, setActiveTab)
                      }
                      sx={{
                        minHeight: wide ? 64 : 44,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.25,
                        textAlign: 'left',
                        p: 1.5,
                        cursor: 'pointer',
                        font: 'inherit',
                        color: activeTab === id ? 'text.primary' : 'text.secondary',
                        backgroundColor:
                          activeTab === id ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor:
                          activeTab === id ? alpha(theme.palette.primary.main, 0.35) : 'transparent',
                        '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.06) },
                        '&:focus-visible': {
                          outline: '2px solid',
                          outlineColor: 'primary.main',
                          outlineOffset: -2,
                        },
                      }}
                    >
                      <Icon
                        sx={{ fontSize: 18, color: activeTab === id ? 'primary.main' : 'text.secondary' }}
                      />
                      <Box sx={{ flex: 1 }}>
                        <Box
                          component="span"
                          sx={{
                            display: 'block',
                            fontWeight: activeTab === id ? 700 : 550,
                            fontSize: '.875rem',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {label}
                        </Box>
                        {wide && (
                          <Box
                            component="span"
                            aria-hidden="true"
                            sx={{ display: 'block', fontSize: '.7rem', mt: 0.25, color: 'text.secondary' }}
                          >
                            {detail}
                          </Box>
                        )}
                      </Box>
                      {id === 'requests' && pendingCraftRequestCount > 0 && (
                        <Box
                          component="span"
                          aria-label={t('pending', 'en attente', 'ausstehend')}
                          sx={{ fontFamily: FONT_MONO, fontSize: '.75rem', color: 'primary.main' }}
                        >
                          {pendingCraftRequestCount}
                        </Box>
                      )}
                    </Box>
                  ))}
                </Box>
                {wide && (
                  <Box sx={{ pt: 2, px: 1.5, borderTop: '1px solid', borderColor: 'divider', mt: 2 }}>
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.6 }}
                    >
                      {t(
                        'Your inventory stays private until you choose to share it.',
                        'Ton inventaire reste privé tant que tu ne choisis pas de le partager.',
                        'Dein Inventar bleibt privat, bis du es freigibst.',
                      )}
                    </Typography>
                    {formatAbsoluteDate(account.updatedAt) && (
                      <Typography
                        variant="caption"
                        sx={{ display: 'block', color: 'text.secondary', mt: 1.5 }}
                      >
                        {t('Last saved', 'Dernière sauvegarde', 'Zuletzt gespeichert')}
                        <br />
                        {formatAbsoluteDate(account.updatedAt)}
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                {activeTab === 'overview' && <AccountOverviewPanel model={model} />}
                {activeTab === 'inventory' && <AccountInventoryPanel model={model} />}
                {activeTab === 'orgs' && <AccountOrganizationsPanel model={model} />}
                {activeTab === 'settings' && <AccountSettingsPanel model={model} />}
                {activeTab === 'requests' && (
                  <Box
                    role="tabpanel"
                    id="account-tabpanel-requests"
                    aria-labelledby="account-tab-requests"
                    tabIndex={0}
                  >
                    <CraftRequestsPanel
                      account={account}
                      optimisticState={model.optimisticState}
                      syncStatus={syncStatus}
                      syncError={syncError}
                      craftRequestActionId={model.craftRequestActionId}
                      craftRequestError={model.craftRequestError}
                      craftRequestNotice={model.craftRequestNotice}
                      onRespondToCraftRequest={(id, decision) => {
                        void model.handleRespondToCraftRequest(id, decision);
                      }}
                    />
                  </Box>
                )}
              </Box>
            </Box>
          )}
        </>
      )}
      <AccountDialogs model={model} />
    </PageLayout>
  );
}
