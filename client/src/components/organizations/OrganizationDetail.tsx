import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { loc, useI18n } from '../../i18n/I18nContext';
import { useCraft } from '../../store/CraftContext';
import type { AccountOrganization } from '../../services/authService';
import { CATEGORY_LABELS, type ItemCategory } from '../../types';
import { Box, Paper, Stack, Typography } from '../../ui/system';
import { RefreshOutlinedIcon } from '../../ui/icons';
import { navigateToPath, resourcePathFromSlug } from '../../utils/slug';
import { Avatar } from '../ui/primitives';
import { AppButton, AppSelect, AppTextField } from '../ui/controls';
import { AppAlert, SurfaceState } from '../ui/feedback';
import { AppChip } from '../ui/data-display/AppChip';
import { PageHeader } from '../ui/page/PageHeader';
import { CraftRequestDialog } from './CraftRequestDialog';
import { SharedBlueprintOfferCard } from './SharedBlueprintOfferCard';
import { SharedResourceOfferCard } from './SharedResourceOfferCard';
import { SharedOfferOwnerIdentity } from './SharedOfferOwner';
import { buildOrganizationOffers, normalizeOfferSearch, organizationRequestKey, pendingOrganizationRequestKeys, type OrganizationBlueprintOffer } from './organizationOffers';
import { useOrganizationCatalog } from './useOrganizationCatalog';
import type { OrganizationTab } from './useOrganizationNavigation';
import type { CraftRequestDraft } from './sharedOfferTypes';

const TABS: OrganizationTab[] = ['blueprints', 'resources', 'members'];
const CATALOG_BATCH_SIZE = 24;
const EMPTY_OWNER = { handle: '', displayName: '' };

export function OrganizationDetail({ organization, activeTab, onTabChange, onBack }: {
  organization: AccountOrganization;
  activeTab: OrganizationTab;
  onTabChange: (tab: OrganizationTab) => void;
  onBack: () => void;
}) {
  const { t, lang } = useI18n();
  const { account, loadOrganizationSharedBlueprints, loadOrganizationSharedResources, requestOrganizationCraft } = useAuth();
  const { blueprints, activeDataset, setActiveBlueprint } = useCraft();
  const catalog = useOrganizationCatalog({ sid: organization.sid, loadBlueprints: loadOrganizationSharedBlueprints, loadResources: loadOrganizationSharedResources });
  const blueprintById = useMemo(() => new Map(blueprints.map(blueprint => [blueprint.id, blueprint])), [blueprints]);
  const resourceById = useMemo(() => new Map(activeDataset.resources.map(resource => [resource.id, resource])), [activeDataset.resources]);
  const offers = useMemo(() => buildOrganizationOffers(catalog.blueprints.data, catalog.resources.data, blueprintById), [catalog.blueprints.data, catalog.resources.data, blueprintById]);
  const [queries, setQueries] = useState<Record<OrganizationTab, string>>({ blueprints: '', resources: '', members: '' });
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [category, setCategory] = useState<'all' | ItemCategory>('all');
  const [manufacturer, setManufacturer] = useState('all');
  const [quality, setQuality] = useState<'all' | 'known' | 'unknown'>('all');
  const [sort, setSort] = useState<'name' | 'owner' | 'quality'>('name');
  const [pageSize, setPageSize] = useState(CATALOG_BATCH_SIZE);
  const [requestOffer, setRequestOffer] = useState<OrganizationBlueprintOffer | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestBusy, setRequestBusy] = useState(false);
  const requestInFlight = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  const query = normalizeOfferSearch(queries[activeTab]);
  const resetPage = () => setPageSize(CATALOG_BATCH_SIZE);
  const changeTab = (tab: OrganizationTab) => { resetPage(); onTabChange(tab); };
  const resetFilters = () => { setQueries(current => ({ ...current, [activeTab]: '' })); setOwnerFilter('all'); setCategory('all'); setManufacturer('all'); setQuality('all'); resetPage(); };
  const filtered = Boolean(query || (activeTab !== 'members' && ownerFilter !== 'all') || (activeTab === 'blueprints' && (category !== 'all' || manufacturer !== 'all')) || (activeTab === 'resources' && quality !== 'all'));
  const matchesOwner = (handle: string) => ownerFilter === 'all' || normalizeOfferSearch(handle) === normalizeOfferSearch(ownerFilter);
  const compareNames = (a: string, b: string) => a.localeCompare(b, lang, { sensitivity: 'base', numeric: true });
  const blueprintOffers = offers.blueprints.filter(offer => matchesOwner(offer.owner.handle)
    && (category === 'all' || offer.blueprint.category === category)
    && (manufacturer === 'all' || offer.blueprint.manufacturer === manufacturer)
    && (!query || normalizeOfferSearch([offer.blueprint.name, offer.blueprint.manufacturer, offer.blueprint.category, offer.owner.displayName, offer.owner.handle, offer.owner.rank].join(' ')).includes(query)))
    .sort((a, b) => compareNames(sort === 'owner' ? a.owner.displayName : a.blueprint.name, sort === 'owner' ? b.owner.displayName : b.blueprint.name));
  const resourceOffers = offers.resources.filter(offer => matchesOwner(offer.owner.handle)
    && (quality === 'all' || (quality === 'known' ? offer.entry.quality != null : offer.entry.quality == null))
    && (!query || normalizeOfferSearch([offer.entry.resourceName, offer.owner.displayName, offer.owner.handle, offer.owner.rank].join(' ')).includes(query)))
    .sort((a, b) => sort === 'quality' && a.entry.quality !== b.entry.quality ? (b.entry.quality ?? -1) - (a.entry.quality ?? -1) : compareNames(sort === 'owner' ? a.owner.displayName : a.entry.resourceName, sort === 'owner' ? b.owner.displayName : b.entry.resourceName));
  const contributors = offers.contributors.filter(contributor => !query || normalizeOfferSearch([contributor.owner.displayName, contributor.owner.handle, contributor.owner.rank].join(' ')).includes(query))
    .sort((a, b) => compareNames(a.owner.displayName, b.owner.displayName));
  const pendingKeys = pendingOrganizationRequestKeys(account?.outgoingCraftRequests ?? []);
  const selfHandle = normalizeOfferSearch(account?.rsi?.handle ?? '');
  const viewRequests = () => navigateToPath('/account?section=requests');
  const manageSharing = () => navigateToPath('/account?section=inventory');
  const owners = offers.contributors.map(({ owner }) => owner).sort((a, b) => compareNames(a.displayName, b.displayName));
  const categories = [...new Set(offers.blueprints.map(offer => offer.blueprint.category))];
  const manufacturers = [...new Set(offers.blueprints.map(offer => offer.blueprint.manufacturer).filter(Boolean))].sort(compareNames);
  const resultCount = activeTab === 'blueprints' ? blueprintOffers.length : activeTab === 'resources' ? resourceOffers.length : contributors.length;
  const activeLoad = activeTab === 'blueprints' ? catalog.blueprints : activeTab === 'resources' ? catalog.resources : null;

  const submitRequest = async (draft: CraftRequestDraft) => {
    if (!requestOffer || requestInFlight.current) return;
    if (normalizeOfferSearch(requestOffer.owner.handle) === selfHandle || pendingKeys.has(organizationRequestKey(organization.sid, requestOffer.blueprint.id, requestOffer.owner.handle))) {
      setRequestError(t('This request is no longer available. Close this dialog to check its status.', 'Cette demande n’est plus disponible. Fermez cette fenêtre pour consulter son statut.', 'Diese Anfrage ist nicht mehr verfügbar. Schließe den Dialog, um ihren Status zu prüfen.'));
      return;
    }
    requestInFlight.current = true;
    setRequestBusy(true);
    setRequestError(null);
    try {
      await requestOrganizationCraft(organization.sid, { blueprintId: requestOffer.blueprint.id, blueprintName: requestOffer.blueprint.name, ownerHandle: requestOffer.owner.handle, ...draft });
      setNotice(t(`Request to ${requestOffer.owner.displayName || requestOffer.owner.handle} saved. Follow its progress in your account.`, `Demande à ${requestOffer.owner.displayName || requestOffer.owner.handle} enregistrée. Suivez son avancée dans votre compte.`, `Anfrage an ${requestOffer.owner.displayName || requestOffer.owner.handle} gespeichert. Verfolge den Fortschritt in deinem Konto.`));
      setRequestOffer(null);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : t('Unable to send your request. Please try again.', 'Impossible d’envoyer la demande. Réessayez.', 'Deine Anfrage konnte nicht gesendet werden. Versuche es erneut.'));
    } finally { requestInFlight.current = false; setRequestBusy(false); }
  };
  const handleTabKeys = (event: KeyboardEvent<HTMLButtonElement>, tab: OrganizationTab) => {
    const index = TABS.indexOf(tab);
    const next = event.key === 'ArrowRight' ? TABS[(index + 1) % TABS.length] : event.key === 'ArrowLeft' ? TABS[(index + TABS.length - 1) % TABS.length] : event.key === 'Home' ? TABS[0] : event.key === 'End' ? TABS[TABS.length - 1] : null;
    if (!next) return;
    event.preventDefault();
    const tabList = event.currentTarget.closest('[role="tablist"]');
    changeTab(next);
    requestAnimationFrame(() => tabList?.querySelector<HTMLButtonElement>(`[data-org-tab="${next}"]`)?.focus());
  };
  const emptyState = <SurfaceState title={filtered ? t('No matching offers', 'Aucune offre correspondante', 'Keine passenden Angebote') : t('No shared offers yet', 'Aucune offre partagée pour le moment', 'Noch keine geteilten Angebote')}
    description={filtered ? t('Try another search or clear your filters.', 'Essayez une autre recherche ou effacez les filtres.', 'Versuche eine andere Suche oder setze die Filter zurück.') : t('Members can share their owned blueprints and resource lots from Account → Inventory.', 'Les membres peuvent partager leurs blueprints et lots de ressources depuis Compte → Inventaire.', 'Mitglieder können ihre Blueprints und Ressourcenbestände unter Konto → Inventar teilen.')}
    actionLabel={filtered ? t('Clear filters', 'Effacer les filtres', 'Filter zurücksetzen') : t('Manage my sharing', 'Gérer mes partages', 'Meine Freigaben verwalten')}
    onAction={filtered ? resetFilters : manageSharing} />;

  return <Stack spacing={2.5}>
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'space-between' }}>
      <AppButton variant="ghost" size="sm" onClick={onBack}>{t('All organizations', 'Toutes les organisations', 'Alle Organisationen')}</AppButton>
      <AppButton variant="ghost" size="sm" onClick={() => navigateToPath('/marketplace')}>{t('Community marketplace', 'Marketplace communautaire', 'Community-Marktplatz')}</AppButton>
    </Box>
    <PageHeader title={organization.name} eyebrow={`SC CRAFT / ${organization.sid}`} description={t('Find the right blueprint, resources and people for your next craft.', 'Trouvez les blueprints, ressources et personnes pour votre prochain craft.', 'Finde passende Blueprints, Ressourcen und Menschen für deinen nächsten Craft.')}
      actions={<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <AppButton variant="secondary" onClick={viewRequests}>{t('My craft requests', 'Mes demandes de craft', 'Meine Craft-Anfragen')}</AppButton>
        <AppButton variant="ghost" onClick={manageSharing}>{t('Manage my sharing', 'Gérer mes partages', 'Meine Freigaben verwalten')}</AppButton>
      </Box>} />
    <Paper sx={{ p: 2, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
      <Avatar src={organization.image ?? organization.logo ?? undefined} alt="" sx={{ width: 52, height: 52 }}>{organization.name.charAt(0)}</Avatar>
      <Box sx={{ flex: '1 1 220px' }}>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <AppChip label={organization.status === 'verified_admin' ? t('Organization admin', 'Administrateur d’organisation', 'Organisationsadministrator') : t('Verified member', 'Membre vérifié', 'Verifiziertes Mitglied')} tone="success" size="sm" />
          {organization.syncStatus === 'stale' && <AppChip label={t('Membership data may be outdated', 'Les affiliations peuvent être anciennes', 'Mitgliedsdaten möglicherweise veraltet')} tone="warning" size="sm" />}
        </Stack>
        <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>{t(`${offers.blueprints.length} blueprint offers · ${offers.resources.length} resource lots · ${offers.contributors.length} contributors`, `${offers.blueprints.length} offres de blueprints · ${offers.resources.length} lots de ressources · ${offers.contributors.length} contributeurs`, `${offers.blueprints.length} Blueprint-Angebote · ${offers.resources.length} Ressourcenbestände · ${offers.contributors.length} Beitragende`)}</Typography>
      </Box>
      <AppButton variant="ghost" href={`https://robertsspaceindustries.com/orgs/${encodeURIComponent(organization.sid)}`} target="_blank" rel="noopener noreferrer">{t('RSI organization', 'Organisation RSI', 'RSI-Organisation')}</AppButton>
      <AppButton variant="secondary" size="sm" icon={<RefreshOutlinedIcon fontSize="small" />} onClick={catalog.reload} loading={catalog.blueprints.loading || catalog.resources.loading} disabled={catalog.blueprints.loading || catalog.resources.loading}>{t('Refresh offers', 'Actualiser les offres', 'Angebote aktualisieren')}</AppButton>
    </Paper>
    {notice && <AppAlert severity="success"><Stack spacing={1} alignItems="flex-start"><Typography variant="body2">{notice}</Typography><AppButton variant="ghost" size="sm" onClick={viewRequests}>{t('Follow my request', 'Suivre ma demande', 'Meine Anfrage verfolgen')}</AppButton></Stack></AppAlert>}
    <Box role="tablist" aria-label={t('Organization catalog', 'Catalogue de l’organisation', 'Organisationskatalog')} sx={{ display: 'flex', gap: 1, overflowX: 'auto', borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}>
      {([
        ['blueprints', t('Blueprints', 'Blueprints', 'Blueprints'), offers.blueprints.length],
        ['resources', t('Resources', 'Ressources', 'Ressourcen'), offers.resources.length],
        ['members', t('Contributors', 'Contributeurs', 'Beitragende'), offers.contributors.length],
      ] as const).map(([tab, label, count]) => <Box key={tab} component="button" type="button" role="tab" data-org-tab={tab} id={`org-tab-${tab}`} aria-controls={`org-panel-${tab}`} aria-selected={activeTab === tab} tabIndex={activeTab === tab ? 0 : -1} onClick={() => changeTab(tab)} onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => handleTabKeys(event, tab)} sx={{ font: 'inherit', fontSize: '.875rem', fontWeight: 650, whiteSpace: 'nowrap', px: 2, py: 1.25, minHeight: 44, cursor: 'pointer', border: '1px solid', borderColor: activeTab === tab ? 'primary.main' : 'divider', color: activeTab === tab ? 'primary.main' : 'text.secondary', backgroundColor: activeTab === tab ? 'ui.surface2' : 'transparent', borderRadius: 1, '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -3 } }}>{label} · {count}</Box>)}
    </Box>
    <Stack role="tabpanel" id={`org-panel-${activeTab}`} aria-labelledby={`org-tab-${activeTab}`} tabIndex={0} spacing={2}>
      {activeTab === 'members' && <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('These verified members have shared offers in SC CRAFT. This is not the full organization roster.', 'Ces membres vérifiés proposent des offres dans SC CRAFT. Cette liste ne représente pas tous les membres de l’organisation.', 'Diese verifizierten Mitglieder teilen Angebote in SC CRAFT. Dies ist keine vollständige Mitgliederliste.')}</Typography>}
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr)', md: activeTab === 'members' ? 'minmax(0,1fr)' : 'minmax(0,1.5fr) repeat(2,minmax(0,1fr))' }, gap: 1.5 }}>
          <AppTextField type="search" label={activeTab === 'members' ? t('Search contributors', 'Rechercher un contributeur', 'Beitragende suchen') : t('Search offers', 'Rechercher une offre', 'Angebote durchsuchen')} value={queries[activeTab]} onValueChange={value => { setQueries(current => ({ ...current, [activeTab]: value })); resetPage(); }} placeholder={t('Name, RSI handle, item…', 'Nom, handle RSI, objet…', 'Name, RSI-Handle, Gegenstand…')} />
          {activeTab !== 'members' && <>
            <AppSelect label={t('Contributor', 'Contributeur', 'Anbieter')} value={ownerFilter} onValueChange={value => { setOwnerFilter(value ?? 'all'); resetPage(); }} options={[{ value: 'all', label: t('All contributors', 'Tous les contributeurs', 'Alle Anbieter') }, ...owners.map(owner => ({ value: owner.handle, label: `${owner.displayName || owner.handle} (@${owner.handle})` }))]} />
            <AppSelect label={t('Sort offers', 'Trier les offres', 'Angebote sortieren')} value={sort === 'quality' && activeTab === 'blueprints' ? 'name' : sort} onValueChange={value => { setSort(value ?? 'name'); resetPage(); }} options={[{ value: 'name', label: t('Item name', 'Nom de l’objet', 'Name des Gegenstands') }, { value: 'owner', label: t('Contributor name', 'Nom du contributeur', 'Name des Anbieters') }, ...(activeTab === 'resources' ? [{ value: 'quality' as const, label: t('Highest quality first', 'Meilleure qualité en premier', 'Höchste Qualität zuerst') }] : [])]} />
          </>}
          {activeTab === 'blueprints' && <>
            <AppSelect label={t('Category', 'Catégorie', 'Kategorie')} value={category} onValueChange={value => { setCategory(value ?? 'all'); resetPage(); }} options={[{ value: 'all', label: t('All categories', 'Toutes les catégories', 'Alle Kategorien') }, ...categories.map(value => ({ value, label: loc(CATEGORY_LABELS[value], lang) }))]} />
            <AppSelect label={t('Manufacturer', 'Fabricant', 'Hersteller')} value={manufacturer} onValueChange={value => { setManufacturer(value ?? 'all'); resetPage(); }} options={[{ value: 'all', label: t('All manufacturers', 'Tous les fabricants', 'Alle Hersteller') }, ...manufacturers.map(value => ({ value, label: value }))]} />
          </>}
          {activeTab === 'resources' && <AppSelect label={t('Quality', 'Qualité', 'Qualität')} value={quality} onValueChange={value => { setQuality(value ?? 'all'); resetPage(); }} options={[{ value: 'all', label: t('All qualities', 'Toutes les qualités', 'Alle Qualitäten') }, { value: 'known', label: t('Known quality', 'Qualité connue', 'Bekannte Qualität') }, { value: 'unknown', label: t('Unspecified quality', 'Qualité non précisée', 'Unbekannte Qualität') }]} />}
        </Box>
      </Paper>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'center' }}>
        <Typography variant="body2" role="status" aria-live="polite" sx={{ color: 'text.secondary' }}>{t(`${resultCount} results`, `${resultCount} résultats`, `${resultCount} Ergebnisse`)}</Typography>
        {filtered && <AppButton variant="ghost" size="sm" onClick={resetFilters}>{t('Clear filters', 'Effacer les filtres', 'Filter zurücksetzen')}</AppButton>}
      </Box>
      {activeLoad?.loading ? <SurfaceState tone="loading" title={t('Loading shared offers…', 'Chargement des offres partagées…', 'Geteilte Angebote werden geladen…')} />
        : activeLoad?.error ? <SurfaceState tone="error" title={t('This catalog could not be loaded', 'Ce catalogue n’a pas pu être chargé', 'Dieser Katalog konnte nicht geladen werden')} description={activeLoad.error} actionLabel={t('Try again', 'Réessayer', 'Erneut versuchen')} onAction={activeLoad.reload} />
        : activeTab === 'members' && catalog.blueprints.loading && catalog.resources.loading ? <SurfaceState tone="loading" title={t('Loading contributors…', 'Chargement des contributeurs…', 'Beitragende werden geladen…')} />
        : <>
          {activeTab === 'blueprints' && offers.hiddenBlueprintCount > 0 && <AppAlert severity="info">{t(`${offers.hiddenBlueprintCount} shared blueprints are not available in this dataset.`, `${offers.hiddenBlueprintCount} blueprints partagés ne sont pas disponibles dans ce jeu de données.`, `${offers.hiddenBlueprintCount} geteilte Blueprints sind in diesem Datensatz nicht verfügbar.`)}</AppAlert>}
          {activeTab === 'members' && (catalog.blueprints.error || catalog.resources.error) && <AppAlert severity="warning">{t('Some shared offers could not be loaded. Contributor counts may be incomplete.', 'Certaines offres n’ont pas pu être chargées. La liste des contributeurs peut être incomplète.', 'Einige Angebote konnten nicht geladen werden. Die Liste der Beitragenden ist möglicherweise unvollständig.')}<AppButton variant="ghost" size="sm" onClick={() => { if (catalog.blueprints.error) catalog.blueprints.reload(); if (catalog.resources.error) catalog.resources.reload(); }}>{t('Try again', 'Réessayer', 'Erneut versuchen')}</AppButton></AppAlert>}
          {!resultCount ? emptyState : <Box component="ul" sx={{ p: 0, m: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 290px), 1fr))', gap: 2 }}>
            {activeTab === 'blueprints' && blueprintOffers.slice(0, pageSize).map(offer => <Box component="li" key={offer.key} sx={{ minWidth: 0 }}><SharedBlueprintOfferCard blueprint={offer.blueprint} owner={offer.owner} contextLabel={organization.name}
              requestState={normalizeOfferSearch(offer.owner.handle) === selfHandle ? 'self' : pendingKeys.has(organizationRequestKey(organization.sid, offer.blueprint.id, offer.owner.handle)) ? 'pending' : 'available'}
              onRequest={() => { setRequestOffer(offer); setRequestError(null); setNotice(null); }} busy={requestBusy && requestOffer?.key === offer.key}
              onOpenBlueprint={() => setActiveBlueprint(offer.blueprint)} onManageSharing={manageSharing} onViewRequests={viewRequests} /></Box>)}
            {activeTab === 'resources' && resourceOffers.slice(0, pageSize).map(offer => <Box component="li" key={offer.key} sx={{ minWidth: 0 }}><SharedResourceOfferCard entry={offer.entry} resource={resourceById.get(offer.entry.resourceId) ?? null} owner={offer.owner} contextLabel={organization.name}
              onOpenResource={resourceById.has(offer.entry.resourceId) ? () => navigateToPath(resourcePathFromSlug(offer.entry.resourceId), { mainView: 'resources' }) : undefined} /></Box>)}
            {activeTab === 'members' && contributors.slice(0, pageSize).map(({ owner, blueprintCount, resourceCount }) => <Box component="li" key={owner.handle} sx={{ minWidth: 0 }}><Paper component="article" sx={{ p: 2, height: '100%' }}>
              <SharedOfferOwnerIdentity owner={owner} />
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5 }}>{t(`${blueprintCount} blueprints · ${resourceCount} resource lots`, `${blueprintCount} blueprints · ${resourceCount} lots de ressources`, `${blueprintCount} Blueprints · ${resourceCount} Ressourcenbestände`)}</Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1.5 }}>
                {blueprintCount > 0 && <AppButton variant="secondary" size="sm" onClick={() => { setOwnerFilter(owner.handle); setCategory('all'); setManufacturer('all'); setQueries(current => ({ ...current, blueprints: '' })); changeTab('blueprints'); }}>{t('See blueprints', 'Voir les blueprints', 'Blueprints ansehen')}</AppButton>}
                {resourceCount > 0 && <AppButton variant="secondary" size="sm" onClick={() => { setOwnerFilter(owner.handle); setQuality('all'); setQueries(current => ({ ...current, resources: '' })); changeTab('resources'); }}>{t('See resources', 'Voir les ressources', 'Ressourcen ansehen')}</AppButton>}
              </Stack>
            </Paper></Box>)}
          </Box>}
          {resultCount > pageSize && <AppButton variant="secondary" onClick={() => setPageSize(current => current + CATALOG_BATCH_SIZE)}>{t('Show more', 'Afficher plus', 'Mehr anzeigen')} ({Math.min(pageSize, resultCount)}/{resultCount})</AppButton>}
        </>}
    </Stack>
    <CraftRequestDialog open={Boolean(requestOffer)} blueprintName={requestOffer?.blueprint.name ?? ''} owner={requestOffer?.owner ?? EMPTY_OWNER} contextLabel={organization.name} busy={requestBusy} error={requestError} onClose={() => setRequestOffer(null)} onSubmit={draft => { void submitRequest(draft); }} />
  </Stack>;
}
