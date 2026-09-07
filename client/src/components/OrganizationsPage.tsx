import { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { useCraft } from '../store/CraftContext';
import { Box, Paper, Stack, Typography } from '../ui/system';
import { GroupsOutlinedIcon, RefreshOutlinedIcon } from '../ui/icons';
import { navigateToPath } from '../utils/slug';
import { Avatar } from './ui/primitives';
import { AppButton, AppSelect, AppTextField } from './ui/controls';
import { AppAlert, SurfaceState } from './ui/feedback';
import { AppChip } from './ui/data-display/AppChip';
import { PageHeader } from './ui/page/PageHeader';
import { PageLayout } from './ui/page/PageLayout';
import { CitizenIdIcon } from './CitizenIdBrand';
import { OrganizationDetail } from './organizations/OrganizationDetail';
import { hasVerifiedOrganizationIdentity, normalizeOfferSearch } from './organizations/organizationOffers';
import { useOrganizationNavigation } from './organizations/useOrganizationNavigation';

export function OrganizationsPage() {
  const { t, lang } = useI18n();
  const { account, user, loading, citizenIdRsiLinkEnabled, citizenIdBrandEnvironment, linkRsiAccountWithCitizenId, syncStatus, syncError, authError, refreshSession, flushPendingMutations } = useAuth();
  const { activeDataset } = useCraft();
  const { sid, tab, navigate } = useOrganizationNavigation();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'name' | 'members' | 'role'>('name');
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const identityVerified = hasVerifiedOrganizationIdentity(account?.rsi);
  const linked = (account?.organizations ?? []).filter(organization => !organization.deletedAt);
  const accessible = linked.filter(organization => identityVerified && (organization.status === 'verified_admin' || organization.status === 'verified_member'));
  const locked = linked.filter(organization => !accessible.includes(organization));
  const activeOrganization = accessible.find(organization => organization.sid.toUpperCase() === sid);
  const query = normalizeOfferSearch(search);
  const organizations = useMemo(() => accessible.filter(organization => !query || normalizeOfferSearch([organization.name, organization.sid, organization.primaryFocus, organization.secondaryFocus].join(' ')).includes(query))
    .sort((a, b) => {
      if (sort === 'members' && (a.memberCount ?? -1) !== (b.memberCount ?? -1)) return (b.memberCount ?? -1) - (a.memberCount ?? -1);
      if (sort === 'role' && a.status !== b.status) return a.status === 'verified_admin' ? -1 : 1;
      return a.name.localeCompare(b.name, lang, { sensitivity: 'base', numeric: true });
    }), [accessible, query, sort, lang]);
  const manageOrganizations = () => navigateToPath('/account?section=orgs');
  const refresh = async () => {
    if (refreshBusy) return;
    setRefreshBusy(true); setRefreshError(null);
    try { await flushPendingMutations(); await refreshSession(); }
    catch (error) { setRefreshError(error instanceof Error ? error.message : t('Unable to refresh organizations.', 'Impossible d’actualiser les organisations.', 'Organisationen konnten nicht aktualisiert werden.')); }
    finally { setRefreshBusy(false); }
  };

  if (loading) return <PageLayout><PageHeader title={t('Organizations', 'Organisations', 'Organisationen')} /><SurfaceState tone="loading" title={t('Loading your organizations…', 'Chargement de vos organisations…', 'Deine Organisationen werden geladen…')} /></PageLayout>;

  return <PageLayout sx={{ maxWidth: 1520, gap: 2.5 }}>
    {authError && <AppAlert severity="error">{authError}</AppAlert>}
    {(syncError || refreshError) && <AppAlert severity="error">{refreshError || syncError}</AppAlert>}
    {(syncStatus === 'pending' || syncStatus === 'syncing') && <AppAlert severity="info">{t('Changes are syncing with your account. Newly shared offers and craft requests may take a moment to appear.', 'Les modifications se synchronisent avec votre compte. Les nouvelles offres et demandes de craft peuvent prendre un instant à apparaître.', 'Änderungen werden mit deinem Konto synchronisiert. Neue Angebote und Craft-Anfragen erscheinen möglicherweise erst nach einem Moment.')}</AppAlert>}
    {activeOrganization ? <OrganizationDetail key={`${account?.accountId}:${account?.datasetScope ?? activeDataset.channel}:${activeOrganization.sid}`} organization={activeOrganization} activeTab={tab} onTabChange={nextTab => navigate(activeOrganization.sid, nextTab)} onBack={() => navigate(null)} /> : <>
      <PageHeader title={t('Organizations', 'Organisations', 'Organisationen')} eyebrow="SC CRAFT / ORGANIZATIONS"
        description={t('Find a crafter in your crew. Browse the blueprints and resources shared with your organizations.', 'Trouvez un crafteur dans votre équipage. Découvrez les blueprints et ressources partagés avec vos organisations.', 'Finde eine craftende Person in deiner Crew. Entdecke die Blueprints und Ressourcen deiner Organisationen.')}
        actions={<Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <AppButton variant="secondary" onClick={() => navigateToPath('/marketplace')}>{t('Community marketplace', 'Marketplace communautaire', 'Community-Marktplatz')}</AppButton>
          <AppButton variant="ghost" onClick={manageOrganizations}>{t('Manage organizations', 'Gérer mes organisations', 'Organisationen verwalten')}</AppButton>
        </Box>} />
      {!user ? <SurfaceState icon={<GroupsOutlinedIcon />} title={t('Connect with your organizations', 'Retrouvez vos organisations', 'Verbinde dich mit deinen Organisationen')}
        description={t('Sign in and verify your RSI identity to browse offers from your organization members.', 'Connectez-vous et vérifiez votre identité RSI pour découvrir les offres des membres de vos organisations.', 'Melde dich an und bestätige deine RSI-Identität, um Angebote deiner Organisationsmitglieder zu sehen.')}
        actionLabel={t('Open my account', 'Ouvrir mon compte', 'Mein Konto öffnen')} onAction={() => navigateToPath('/account')} />
        : !account ? <SurfaceState tone="error" title={t('Account data is unavailable', 'Les données du compte sont indisponibles', 'Kontodaten sind nicht verfügbar')} actionLabel={t('Try again', 'Réessayer', 'Erneut versuchen')} onAction={() => { void refresh(); }} />
        : <>
          {sid && <AppAlert severity="warning"><Stack spacing={1} alignItems="flex-start"><Typography variant="body2">{t('This organization is not available to your current account. Choose another organization or check your memberships.', 'Cette organisation n’est pas accessible à votre compte actuel. Choisissez-en une autre ou vérifiez vos affiliations.', 'Diese Organisation ist für dein aktuelles Konto nicht verfügbar. Wähle eine andere oder prüfe deine Mitgliedschaften.')}</Typography><AppButton variant="ghost" size="sm" onClick={() => navigate(null)}>{t('All organizations', 'Toutes les organisations', 'Alle Organisationen')}</AppButton></Stack></AppAlert>}
          {!identityVerified && <AppAlert severity="info">{t('Verify your RSI identity in Account to unlock organization sharing.', 'Vérifiez votre identité RSI dans Compte pour accéder aux partages de vos organisations.', 'Bestätige deine RSI-Identität im Konto, um Organisationsfreigaben zu nutzen.')} <AppButton variant="ghost" size="sm" onClick={() => navigateToPath('/account?section=settings')}>{t('Verify RSI identity', 'Vérifier mon identité RSI', 'RSI-Identität bestätigen')}</AppButton></AppAlert>}
          <Paper sx={{ p: { xs: 2, md: 2.5 }, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ flex: '1 1 240px' }}>
              <Typography component="h2" sx={{ fontSize: '1.15rem', fontWeight: 700 }}>{t('Your organization directory', 'Votre annuaire d’organisations', 'Dein Organisationsverzeichnis')}</Typography>
              <Typography variant="body2" sx={{ mt: .75, color: 'text.secondary' }}>{t(`${accessible.length} accessible organizations · ${(activeDataset.channel ?? 'live').toUpperCase()} data`, `${accessible.length} organisations accessibles · données ${(activeDataset.channel ?? 'live').toUpperCase()}`, `${accessible.length} verfügbare Organisationen · ${(activeDataset.channel ?? 'live').toUpperCase()}-Daten`)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <AppButton variant="secondary" icon={<RefreshOutlinedIcon fontSize="small" />} loading={refreshBusy} disabled={refreshBusy} onClick={() => { void refresh(); }}>{t('Refresh directory', 'Actualiser l’annuaire', 'Verzeichnis aktualisieren')}</AppButton>
              <AppButton icon={<CitizenIdIcon environment={citizenIdBrandEnvironment} />} disabled={!citizenIdRsiLinkEnabled || refreshBusy} onClick={() => linkRsiAccountWithCitizenId('/organizations')} sx={{ backgroundColor: '#212126', color: '#F0F0F0', minHeight: 44, border: '1px solid rgba(240,240,240,.18)', '&:hover': { backgroundColor: '#0E0E0F' } }}>{t('Sync with Citizen iD', 'Synchroniser avec Citizen iD', 'Mit Citizen iD synchronisieren')}</AppButton>
            </Box>
          </Paper>
          {accessible.length > 0 && <>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'minmax(0,1fr) 260px' }, gap: 1.5 }}>
              <AppTextField type="search" label={t('Search organizations', 'Rechercher une organisation', 'Organisationen suchen')} value={search} onValueChange={setSearch} placeholder={t('Organization name or SID…', 'Nom ou SID de l’organisation…', 'Name oder SID der Organisation…')} />
              <AppSelect label={t('Sort organizations', 'Trier les organisations', 'Organisationen sortieren')} value={sort} onValueChange={value => setSort(value ?? 'name')} options={[
                { value: 'name', label: t('Name A–Z', 'Nom A–Z', 'Name A–Z') },
                { value: 'members', label: t('Largest membership first', 'Plus grand effectif en premier', 'Größte Mitgliederzahl zuerst') },
                { value: 'role', label: t('Organizations I administer first', 'Mes organisations administrées en premier', 'Von mir verwaltete Organisationen zuerst') },
              ]} />
            </Box>
            <Typography variant="body2" role="status" aria-live="polite" sx={{ color: 'text.secondary' }}>{t(`${organizations.length} of ${accessible.length} organizations`, `${organizations.length} organisations sur ${accessible.length}`, `${organizations.length} von ${accessible.length} Organisationen`)}</Typography>
          </>}
          {organizations.length ? <Box component="ul" sx={{ p: 0, m: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 290px), 1fr))', gap: 2 }}>
            {organizations.map(organization => <Box component="li" key={organization.sid} sx={{ minWidth: 0 }}><Paper component="article" aria-label={organization.name} sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5, height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar src={organization.image ?? organization.logo ?? undefined} alt="" sx={{ width: 52, height: 52 }}>{organization.name.charAt(0)}</Avatar>
                <Box sx={{ minWidth: 0 }}><Typography component="h3" sx={{ fontWeight: 700, fontSize: '1.1rem', overflowWrap: 'anywhere' }}>{organization.name}</Typography><Typography variant="caption" sx={{ color: 'text.secondary' }}>{organization.sid}</Typography></Box>
              </Box>
              <Box sx={{ display: 'flex', gap: .75, flexWrap: 'wrap' }}><AppChip size="sm" label={organization.status === 'verified_admin' ? t('Admin', 'Admin', 'Admin') : t('Member', 'Membre', 'Mitglied')} outlined />{organization.memberCount != null && <AppChip size="sm" label={t(`${organization.memberCount} members`, `${organization.memberCount} membres`, `${organization.memberCount} Mitglieder`)} outlined />}</Box>
              {organization.primaryFocus && <Typography variant="body2" sx={{ color: 'text.secondary' }}>{organization.primaryFocus}{organization.secondaryFocus ? ` · ${organization.secondaryFocus}` : ''}</Typography>}
              {organization.blueprintSharingEnabled === false && <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('Blueprint sharing is paused for this organization.', 'Le partage de blueprints est suspendu dans cette organisation.', 'Blueprint-Freigaben sind für diese Organisation pausiert.')}</Typography>}
              <AppButton variant="primary" fullWidth onClick={() => navigate(organization.sid)} sx={{ mt: 'auto', minHeight: 44 }} ariaLabel={t(`Browse offers in ${organization.name}`, `Voir les offres de ${organization.name}`, `Angebote von ${organization.name} ansehen`)}>{t('Browse shared offers', 'Voir les offres partagées', 'Geteilte Angebote ansehen')}</AppButton>
            </Paper></Box>)}
          </Box> : <SurfaceState icon={<GroupsOutlinedIcon />} title={query ? t('No matching organizations', 'Aucune organisation correspondante', 'Keine passenden Organisationen') : t('No verified organizations yet', 'Aucune organisation vérifiée pour le moment', 'Noch keine verifizierten Organisationen')}
            description={query ? t('Try a different name or SID.', 'Essayez un autre nom ou SID.', 'Versuche einen anderen Namen oder eine andere SID.') : t('Sync your public RSI memberships with Citizen iD or manage your linked organizations in Account.', 'Synchronisez vos affiliations RSI publiques avec Citizen iD ou gérez vos organisations liées dans Compte.', 'Synchronisiere deine öffentlichen RSI-Mitgliedschaften mit Citizen iD oder verwalte verknüpfte Organisationen im Konto.')}
            actionLabel={query ? t('Clear search', 'Effacer la recherche', 'Suche zurücksetzen') : t('Manage organizations', 'Gérer mes organisations', 'Organisationen verwalten')}
            onAction={query ? () => setSearch('') : manageOrganizations} />}
          {locked.length > 0 && <Paper sx={{ p: 2 }}><Typography component="h2" sx={{ fontSize: '1rem', fontWeight: 700 }}>{t('Memberships awaiting verification', 'Affiliations en attente de vérification', 'Mitgliedschaften warten auf Bestätigung')}</Typography><Typography variant="body2" sx={{ color: 'text.secondary', mt: .75 }}>{t('Offers stay private until your membership is verified.', 'Les offres restent privées tant que votre affiliation n’est pas vérifiée.', 'Angebote bleiben privat, bis deine Mitgliedschaft bestätigt ist.')}</Typography><Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1.5 }}>{locked.map(organization => <AppChip key={organization.sid} label={`${organization.name} · ${organization.sid}`} tone="warning" outlined />)}</Box></Paper>}
        </>}
    </>}
  </PageLayout>;
}
