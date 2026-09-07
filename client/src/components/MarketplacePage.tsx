import type { KeyboardEvent } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { Box, ButtonBase, Paper, Stack, Typography } from '../ui/system';
import { CitizenIdSignInButton } from './CitizenIdBrand';
import { AppButton } from './ui/controls';
import { AppAlert, SurfaceState } from './ui/feedback';
import { PageHeader } from './ui/page/PageHeader';
import { PageLayout } from './ui/page/PageLayout';
import { AppChip } from './ui/data-display/AppChip';
import { CraftRequestDialog } from './organizations';
import { MarketplaceBrowse } from './marketplace/MarketplaceBrowse';
import { MarketplacePublications } from './marketplace/MarketplacePublications';
import {
  MarketplaceModeration,
  MarketplaceReportDialog,
  MarketplaceSafety,
} from './marketplace/MarketplaceSafety';
import { useMarketplaceController, type MarketplaceTab } from './marketplace/useMarketplaceController';

export function MarketplacePage() {
  const { t } = useI18n();
  const model = useMarketplaceController();
  const { auth, scope, route, navigate } = model;
  const tabs: { id: MarketplaceTab; label: string }[] = [
    { id: 'browse', label: t('Browse offers', 'Explorer les offres', 'Angebote entdecken') },
    { id: 'listings', label: t('My listings', 'Mes annonces', 'Meine Angebote') },
    { id: 'safety', label: t('Safety & privacy', 'Sécurité et confidentialité', 'Sicherheit & Datenschutz') },
    ...(auth.account?.isAdmin
      ? [{ id: 'moderation' as const, label: t('Moderation', 'Modération', 'Moderation') }]
      : []),
  ];
  const currentTab = tabs.some((tab) => tab.id === route.tab) ? route.tab : 'browse';
  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, id: MarketplaceTab) => {
    const index = tabs.findIndex((tab) => tab.id === id);
    const target =
      event.key === 'ArrowRight'
        ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? tabs.length - 1
              : -1;
    if (target < 0) return;
    event.preventDefault();
    const container = event.currentTarget.parentElement;
    navigate({ tab: tabs[target].id });
    container?.querySelector<HTMLButtonElement>(`#marketplace-tab-${tabs[target].id}`)?.focus();
  };
  const canSignIn = auth.enabled && auth.citizenIdLoginEnabled;
  return (
    <PageLayout>
      <Stack spacing={2.5}>
        <PageHeader
          eyebrow={t('SC CRAFT / Community', 'SC CRAFT / Communauté', 'SC CRAFT / Community')}
          title={t('Community marketplace', 'Marketplace communautaire', 'Community-Marktplatz')}
          description={t(
            'Your next craft starts with another citizen.',
            'Ton prochain craft commence avec un autre citoyen.',
            'Dein nächster Craft beginnt mit einem anderen Citizen.',
          )}
          meta={
            <AppChip
              label={`${scope.toUpperCase()} · ${t('Player-to-player', 'Entre joueurs', 'Von Spieler zu Spieler')}`}
              size="sm"
              outlined
            />
          }
          actions={
            auth.user ? (
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <AppButton href="/organizations" variant="secondary">
                  {t('My organizations', 'Mes organisations', 'Meine Organisationen')}
                </AppButton>
                <AppButton href="/account?section=requests" variant="secondary">
                  {t('My craft requests', 'Mes demandes de craft', 'Meine Craft-Anfragen')}
                </AppButton>
              </Stack>
            ) : undefined
          }
        />
        {auth.loading ? (
          <SurfaceState
            tone="loading"
            title={t('Loading your account', 'Chargement de ton compte', 'Dein Konto wird geladen')}
          />
        ) : !auth.user ? (
          <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 4 } }}>
            <Stack spacing={2} sx={{ maxWidth: 720 }}>
              <Typography component="h2" variant="h4" sx={{ fontWeight: 700 }}>
                {t(
                  'Craft together, beyond your organization.',
                  'Craftez ensemble, au-delà de votre organisation.',
                  'Gemeinsam craften, über deine Organisation hinaus.',
                )}
              </Typography>
              <Typography sx={{ color: 'text.secondary' }}>
                {t(
                  'Sign in and verify your RSI identity to discover craft partners and voluntarily share selected inventory. No listing is published automatically.',
                  'Connecte-toi et vérifie ton identité RSI pour trouver des partenaires de craft et partager les éléments de ton choix. Aucune annonce n’est publiée automatiquement.',
                  'Melde dich an und bestätige deine RSI-Identität, um Craft-Partner zu finden und ausgewähltes Inventar freiwillig zu teilen. Es wird nichts automatisch veröffentlicht.',
                )}
              </Typography>
              <CitizenIdSignInButton
                disabled={!canSignIn}
                environment={auth.citizenIdBrandEnvironment}
                onClick={() => auth.loginWithCitizenId('/marketplace')}
              />
              {!canSignIn && (
                <AppAlert severity="info">
                  {t(
                    'Sign-in is temporarily unavailable.',
                    'La connexion est temporairement indisponible.',
                    'Die Anmeldung ist vorübergehend nicht verfügbar.',
                  )}
                </AppAlert>
              )}
            </Stack>
          </Paper>
        ) : !auth.account ? (
          <SurfaceState
            tone="error"
            title={t('Account unavailable', 'Compte indisponible', 'Konto nicht verfügbar')}
            actionLabel={t('Try again', 'Réessayer', 'Erneut versuchen')}
            onAction={() => {
              void auth.refreshSession();
            }}
          />
        ) : (
          <>
            {!model.verified && (
              <AppAlert severity="warning">
                <Stack spacing={1}>
                  <Typography>
                    {t(
                      'Verify your RSI identity before browsing or publishing. You can still withdraw listings and manage blocked players.',
                      'Vérifie ton identité RSI avant de consulter ou publier des offres. Tu peux toujours retirer tes annonces et gérer les joueurs bloqués.',
                      'Bestätige deine RSI-Identität, bevor du Angebote ansiehst oder veröffentlichst. Angebote zurückziehen und blockierte Spieler verwalten bleibt möglich.',
                    )}
                  </Typography>
                  <AppButton
                    href="/account?section=settings"
                    variant="secondary"
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    {t('Manage RSI connection', 'Gérer ma connexion RSI', 'RSI-Verbindung verwalten')}
                  </AppButton>
                </Stack>
              </AppAlert>
            )}
            {model.actionError && <AppAlert severity="error">{model.actionError}</AppAlert>}
            {model.notice && <AppAlert severity="success">{model.notice}</AppAlert>}
            <Box
              role="tablist"
              aria-label={t('Marketplace sections', 'Sections de la marketplace', 'Marktplatz-Bereiche')}
              sx={{
                display: 'flex',
                gap: 0.75,
                overflowX: 'auto',
                borderBottom: '1px solid',
                borderColor: 'divider',
                pb: 1,
              }}
            >
              {tabs.map((tab) => (
                <ButtonBase
                  key={tab.id}
                  id={`marketplace-tab-${tab.id}`}
                  role="tab"
                  aria-selected={currentTab === tab.id}
                  aria-controls={`marketplace-panel-${tab.id}`}
                  tabIndex={currentTab === tab.id ? 0 : -1}
                  onClick={() => navigate({ tab: tab.id })}
                  onKeyDown={(event) => moveFocus(event, tab.id)}
                  sx={{
                    px: 2,
                    py: 1.25,
                    flexShrink: 0,
                    fontWeight: 650,
                    fontSize: '0.875rem',
                    borderRadius: 1,
                    backgroundColor: currentTab === tab.id ? 'action.selected' : 'transparent',
                    color: currentTab === tab.id ? 'primary.main' : 'text.secondary',
                    border: '1px solid',
                    borderColor: currentTab === tab.id ? 'primary.main' : 'transparent',
                    '&:focus-visible': {
                      outline: '2px solid',
                      outlineColor: 'primary.main',
                      outlineOffset: 2,
                    },
                  }}
                >
                  {tab.label}
                </ButtonBase>
              ))}
            </Box>
            <Box
              role="tabpanel"
              id="marketplace-panel-browse"
              aria-labelledby="marketplace-tab-browse"
              hidden={currentTab !== 'browse'}
            >
              {model.canBrowse ? (
                <MarketplaceBrowse model={model} />
              ) : (
                <SurfaceState
                  title={t(
                    'RSI verification required',
                    'Vérification RSI requise',
                    'RSI-Verifizierung erforderlich',
                  )}
                  description={t(
                    'A verified identity helps everyone know who offers each blueprint.',
                    'Une identité vérifiée permet à chacun de savoir qui propose chaque blueprint.',
                    'Eine verifizierte Identität zeigt allen, wer jeden Blueprint anbietet.',
                  )}
                />
              )}
            </Box>
            <Box
              role="tabpanel"
              id="marketplace-panel-listings"
              aria-labelledby="marketplace-tab-listings"
              hidden={currentTab !== 'listings'}
            >
              <MarketplacePublications
                key={model.identity}
                account={auth.account}
                verified={model.verified}
                busy={model.busy}
                onSave={model.save}
              />
            </Box>
            <Box
              role="tabpanel"
              id="marketplace-panel-safety"
              aria-labelledby="marketplace-tab-safety"
              hidden={currentTab !== 'safety'}
            >
              <MarketplaceSafety
                key={model.identity}
                account={auth.account}
                busy={model.busy}
                onBlock={model.block}
              />
            </Box>
            {auth.account.isAdmin && currentTab === 'moderation' && (
              <Box
                role="tabpanel"
                id="marketplace-panel-moderation"
                aria-labelledby="marketplace-tab-moderation"
              >
                <MarketplaceModeration key={model.identity} scope={scope} />
              </Box>
            )}
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {t(
                'A listing is an invitation to coordinate, not a reservation or a guaranteed delivery. Agree on availability with the player; no payment is processed by the app.',
                'Une annonce invite à échanger : elle ne réserve aucun stock et ne garantit pas une livraison. Convenez des disponibilités avec le joueur ; l’app ne traite aucun paiement.',
                'Ein Angebot dient der Abstimmung und ist keine Reservierung oder Liefergarantie. Klärt Verfügbarkeit mit dem Spieler; die App verarbeitet keine Zahlungen.',
              )}
            </Typography>
          </>
        )}
      </Stack>
      <CraftRequestDialog
        source="community"
        open={Boolean(model.request)}
        blueprintName={model.request?.blueprint.name ?? ''}
        owner={{
          handle: model.request?.member.handle ?? '',
          displayName: model.request?.member.display ?? '',
        }}
        contextLabel={t('Community marketplace', 'Marketplace communautaire', 'Community-Marktplatz')}
        busy={model.busy}
        error={model.requestError}
        onClose={() => {
          if (!model.busy) model.setRequest(null);
        }}
        onSubmit={(draft) => {
          void model.sendRequest(draft);
        }}
      />
      <MarketplaceReportDialog
        ownerHandle={model.reportHandle}
        busy={model.busy}
        error={model.reportError}
        onClose={() => {
          if (!model.busy) model.setReportHandle(null);
        }}
        onSubmit={(reason) => {
          void model.sendReport(reason);
        }}
      />
    </PageLayout>
  );
}
