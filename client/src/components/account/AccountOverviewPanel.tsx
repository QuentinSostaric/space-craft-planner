import discordSymbol from '../../assets/discord-symbol.svg';
import rsiLogo from '../../assets/rsi-logo-official.jpg';
import { FONT_DISPLAY, FONT_MONO } from '../../theme';
import {
  ArrowForwardIcon,
  GroupsOutlinedIcon,
  HandymanOutlinedIcon,
  Inventory2OutlinedIcon,
  StarBorderIcon,
} from '../../ui/icons';
import { alpha, Box, Paper, Stack, Typography } from '../../ui/system';
import { CitizenIdSignInButton } from '../CitizenIdBrand';
import { AppButton } from '../ui/controls';
import { AppChip } from '../ui/data-display/AppChip';
import { AppAlert, AppProgressBar } from '../ui/feedback';
import { Link } from '../ui/primitives';
import type { AccountController } from './useAccountController';

export function AccountOverviewPanel({ model }: { model: AccountController }) {
  const {
    t,
    user,
    account,
    theme,
    setActiveTab,
    inventoryCount,
    favoriteCount,
    pendingCraftRequestCount,
    inventoryResources,
    canManageOrganizations,
    rsiVerificationRequired,
    handleStartRsiLink,
    citizenIdRsiLinkEnabled,
    citizenIdBrandEnvironment,
    localImportPlan,
    onboardingAction,
  } = model;
  if (!user || !account) return null;
  const showSetup = !account.onboardingCompletedAt && !account.onboardingDismissedAt;
  const stats = [
    {
      label: t('Owned blueprints', 'Blueprints possédés', 'Eigene Blueprints'),
      count: inventoryCount,
      icon: Inventory2OutlinedIcon,
      onClick: () => {
        model.setAssetFilter('inventory-blueprints');
        setActiveTab('inventory');
      },
    },
    {
      label: t('Favorites', 'Favoris', 'Favoriten'),
      count: favoriteCount,
      icon: StarBorderIcon,
      onClick: () => {
        model.setAssetFilter('favorite-blueprints');
        setActiveTab('inventory');
      },
    },
    {
      label: t('Resource lots', 'Lots de ressources', 'Ressourcenbestände'),
      count: inventoryResources.length,
      icon: Inventory2OutlinedIcon,
      onClick: () => {
        model.setAssetFilter('resources');
        setActiveTab('inventory');
      },
    },
    {
      label: t('Organizations', 'Organisations', 'Organisationen'),
      count: account.organizations.length,
      icon: GroupsOutlinedIcon,
      onClick: () => setActiveTab('orgs'),
    },
  ];
  return (
    <Stack
      role="tabpanel"
      id="account-tabpanel-overview"
      aria-labelledby="account-tab-overview"
      tabIndex={0}
      spacing={2.5}
    >
      <Box>
        <Typography component="h2" sx={{ fontSize: '1.4rem', fontFamily: FONT_DISPLAY, fontWeight: 750 }}>
          {t('Your crafting workspace', 'Ton espace de craft', 'Dein Crafting-Arbeitsbereich')}
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
          {t(
            'Everything you own and everyone you craft with, in one place.',
            'Tout ce que tu possèdes et les personnes avec qui tu craftes, au même endroit.',
            'Deine Sammlung und deine Crafting-Kontakte an einem Ort.',
          )}
        </Typography>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
          gap: 1.25,
        }}
      >
        {stats.map(({ label, count, icon: Icon, onClick }) => (
          <Box
            component="button"
            type="button"
            key={label}
            onClick={onClick}
            sx={{
              textAlign: 'left',
              font: 'inherit',
              cursor: 'pointer',
              p: { xs: 1.5, md: 2 },
              backgroundColor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              color: 'text.primary',
              '&:hover': {
                borderColor: 'primary.main',
                backgroundColor: alpha(theme.palette.primary.main, 0.04),
              },
              '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: 'text.secondary',
              }}
            >
              <Icon sx={{ fontSize: 17 }} />
              <ArrowForwardIcon sx={{ fontSize: 13 }} />
            </Box>
            <Typography
              component="span"
              sx={{
                display: 'block',
                mt: 1.5,
                fontSize: '2rem',
                fontFamily: FONT_MONO,
                fontWeight: 650,
                lineHeight: 1,
              }}
            >
              {count}
            </Typography>
            <Typography
              component="span"
              sx={{ display: 'block', mt: 1, color: 'text.secondary', fontSize: '.8rem' }}
            >
              {label}
            </Typography>
          </Box>
        ))}
      </Box>
      {pendingCraftRequestCount > 0 && (
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            borderColor: alpha(theme.palette.primary.main, 0.35),
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            alignItems: 'center',
          }}
        >
          <HandymanOutlinedIcon sx={{ color: 'primary.main' }} />
          <Box sx={{ flex: 1, minWidth: 180 }}>
            <Typography sx={{ fontWeight: 700 }}>
              {t(
                pendingCraftRequestCount === 1
                  ? '1 craft request needs your answer'
                  : `${pendingCraftRequestCount} craft requests need your answer`,
                pendingCraftRequestCount === 1
                  ? '1 demande de craft attend ta réponse'
                  : `${pendingCraftRequestCount} demandes de craft attendent ta réponse`,
                `${pendingCraftRequestCount} Craft-Anfragen warten auf deine Antwort`,
              )}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              {t(
                'Review the blueprint and resource arrangement before accepting.',
                'Vérifie le blueprint et les ressources prévues avant d’accepter.',
                'Prüfe Blueprint und Ressourcenabsprache, bevor du annimmst.',
              )}
            </Typography>
          </Box>
          <AppButton variant="primary" onClick={() => setActiveTab('requests')}>
            {t('Review requests', 'Voir les demandes', 'Anfragen ansehen')}
          </AppButton>
        </Paper>
      )}
      {showSetup && (
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
          <Stack spacing={1.5}>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between', alignItems: 'start' }}>
              <Box>
                <Typography component="h3" sx={{ fontWeight: 700 }}>
                  {t(
                    'Make this workspace yours',
                    'Personnalise ton espace',
                    'Mach diesen Arbeitsbereich zu deinem',
                  )}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                  {t(
                    'Your account is ready. These next steps are optional.',
                    'Ton compte est prêt. Ces prochaines étapes sont facultatives.',
                    'Dein Konto ist bereit. Die nächsten Schritte sind optional.',
                  )}
                </Typography>
              </Box>
              <AppChip label={t('Getting started', 'Premiers pas', 'Erste Schritte')} size="sm" outlined />
            </Box>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                gap: 1,
              }}
            >
              <AppButton variant="secondary" onClick={handleStartRsiLink} disabled={canManageOrganizations}>
                {canManageOrganizations
                  ? t('RSI identity verified', 'Identité RSI vérifiée', 'RSI-Identität verifiziert')
                  : t('Link your RSI identity', 'Lier ton identité RSI', 'RSI-Identität verknüpfen')}
              </AppButton>
              <AppButton variant="secondary" onClick={() => setActiveTab('inventory')}>
                {t('Build your inventory', 'Compléter ton inventaire', 'Dein Inventar aufbauen')}
              </AppButton>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <AppButton
                variant="ghost"
                size="sm"
                disabled={onboardingAction.busy}
                onClick={() => {
                  void model.handleDismissOnboarding();
                }}
              >
                {t('Dismiss checklist', 'Masquer la checklist', 'Checkliste ausblenden')}
              </AppButton>
              {canManageOrganizations && (
                <AppButton
                  variant="ghost"
                  size="sm"
                  onClick={model.handleCompleteOnboarding}
                  disabled={onboardingAction.busy}
                >
                  {t('Mark done', 'Terminer', 'Abschließen')}
                </AppButton>
              )}
            </Box>
            {onboardingAction.error && <AppAlert severity="error">{onboardingAction.error}</AppAlert>}
          </Stack>
        </Paper>
      )}
      {localImportPlan.hasPendingImport && (
        <AppAlert severity="info">
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
            <Typography sx={{ flex: 1 }}>
              {t(
                'You still have local data available to import.',
                'Des données locales peuvent encore être importées.',
                'Lokale Daten stehen noch zum Import bereit.',
              )}
            </Typography>
            <AppButton variant="secondary" onClick={() => model.setImportModalDismissed(false)}>
              {t('Review import', 'Examiner l’import', 'Import prüfen')}
            </AppButton>
          </Stack>
        </AppAlert>
      )}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.3fr) minmax(0, 1fr)' },
          gap: 2,
        }}
      >
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
          <Stack spacing={2}>
            <Typography component="h3" sx={{ fontWeight: 700 }}>
              {t('Connected identities', 'Identités connectées', 'Verknüpfte Identitäten')}
            </Typography>
            {[
              { name: 'Discord', image: discordSymbol, detail: `@${user.username}`, verified: true },
              {
                name: 'RSI',
                image: rsiLogo,
                detail: account.rsi?.handle
                  ? `${account.rsi.handle} · ${rsiVerificationRequired ? t('verification required', 'vérification requise', 'Verifizierung erforderlich') : t('verified', 'vérifié', 'verifiziert')}`
                  : t('Not linked', 'Non lié', 'Nicht verknüpft'),
                verified: canManageOrganizations,
              },
            ].map((identity) => (
              <Box
                key={identity.name}
                sx={{ display: 'flex', gap: 1.25, alignItems: 'center', flexWrap: 'wrap', py: 0.5 }}
              >
                <Box
                  component="img"
                  src={identity.image}
                  alt=""
                  sx={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 0.5 }}
                />
                <Box sx={{ flex: 1, minWidth: 120 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '.875rem' }}>{identity.name}</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }}>
                    {identity.detail}
                  </Typography>
                </Box>
                <AppChip
                  label={
                    identity.verified
                      ? t('Connected', 'Connecté', 'Verbunden')
                      : t('Action needed', 'À compléter', 'Aktion nötig')
                  }
                  tone={identity.verified ? 'success' : 'warning'}
                  size="sm"
                  outlined
                />
              </Box>
            ))}
            {!canManageOrganizations ? (
              citizenIdRsiLinkEnabled ? (
                <CitizenIdSignInButton environment={citizenIdBrandEnvironment} onClick={handleStartRsiLink} />
              ) : (
                <AppButton variant="secondary" onClick={handleStartRsiLink}>
                  {t('Manual RSI link', 'Lier RSI manuellement', 'RSI manuell verknüpfen')}
                </AppButton>
              )
            ) : (
              <AppButton variant="ghost" onClick={() => setActiveTab('settings')}>
                {t('Manage connections', 'Gérer les connexions', 'Verbindungen verwalten')}
              </AppButton>
            )}
          </Stack>
        </Paper>
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
          <Stack spacing={1.5}>
            <Typography component="h3" sx={{ fontWeight: 700 }}>
              {t('Collection progress', 'Progression de la collection', 'Sammlungsfortschritt')}
            </Typography>
            <Typography sx={{ fontSize: '1.7rem', fontFamily: FONT_MONO, fontWeight: 650 }}>
              {model.missionRewards
                ? `${model.ownedBlueprintCount} / ${model.totalObtainableBlueprintCount}`
                : '—'}
            </Typography>
            <AppProgressBar
              value={model.blueprintProgress}
              label={t(
                'Blueprint collection progress',
                'Progression des blueprints',
                'Blueprint-Sammlungsfortschritt',
              )}
            />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {t(
                'Owned blueprints from the obtainable mission catalog. Your full inventory can include other blueprints.',
                'Blueprints possédés parmi ceux obtenables en mission. Ton inventaire peut aussi contenir d’autres blueprints.',
                'Eigene Blueprints aus dem erhältlichen Missionskatalog. Dein Inventar kann weitere Blueprints enthalten.',
              )}
            </Typography>
            <Link
              href="/missions"
              underline="hover"
              sx={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', fontSize: '.875rem' }}
            >
              {t(
                'Explore blueprint rewards',
                'Explorer les récompenses de missions',
                'Blueprint-Belohnungen entdecken',
              )}{' '}
              →
            </Link>
          </Stack>
        </Paper>
      </Box>
    </Stack>
  );
}
