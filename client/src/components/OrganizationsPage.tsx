import { Box, Divider, Paper, Stack, Typography, alpha, useTheme } from '../ui/system';
import { Avatar, CardMedia } from './ui/primitives';
import { AppAlert } from './ui/feedback';
import { FilterListOffOutlinedIcon, HandymanOutlinedIcon, SearchOutlinedIcon } from '../ui/icons';
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useLocalPersist } from '../hooks/useLocalPersist';
import { useI18n } from '../i18n/I18nContext';
import { type AccountCraftRequestResourcesOption } from '../services/authService';
import { useCraft } from '../store/CraftContext';
import { CATEGORY_LABELS, LS_KEYS, type Blueprint, type ItemCategory, type Resource } from '../types';
import { formatQualityLabel, formatResourceQuantity } from '../utils/crafting';
import { BlueprintCard, type BlueprintCardQuickAction } from './BlueprintGrid';
import { getMainContentScrollRoot, useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { ResourceIcon } from './ui/ResourceIcon';
import { Panel } from './ui/Panel';
import { FONT_DISPLAY, FONT_MONO, TEXT_LABEL, TEXT_LABEL_LG, TEXT_LABEL_SM} from '../theme';
import { AppButton, AppCheckbox, AppSelect, AppTextArea, AppTextField } from './ui/controls';
import { AppDialog } from './ui/overlays';
import { PageHeader } from './ui/page/PageHeader';
import { PageLayout } from './ui/page/PageLayout';
import { SurfaceState } from './ui/feedback/SurfaceState';
import { AppChip } from './ui/data-display/AppChip';
import { CitizenIdSignInButton, type CitizenIdBrandEnvironment } from './CitizenIdBrand';

// ─── Types ────────────────────────────────────────────────────────────────────

type SharedBlueprintRow = {
  key: string;
  blueprint: Blueprint;
  ownerHandle: string;
  ownerDisplay: string;
  ownerImage: string | null;
  ownerRank: string | null;
  ownerStars: number | null;
};

type SharedResourceRow = {
  key: string;
  entryId: string;
  resourceId: string;
  resourceName: string;
  quantity: number;
  quantityUnit: 'scu' | 'count';
  quality: number | null;
  ownerHandle: string;
  ownerDisplay: string;
  ownerImage: string | null;
  ownerRank: string | null;
  ownerStars: number | null;
};

type CraftRequestDialogState = {
  row: SharedBlueprintRow;
  comment: string;
  resourcesOption: AccountCraftRequestResourcesOption;
  error: string | null;
};

type OrganizationLoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | {
      status: 'success';
      blueprintRows: SharedBlueprintRow[];
      resourceRows: SharedResourceRow[];
      hiddenBlueprintCount: number;
      sharedMemberCount: number;
    };

type AccountOrganization = NonNullable<ReturnType<typeof useAuth>['account']>['organizations'][number];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function organizationGridColumns(containerWidth: number): number {
  if (containerWidth >= 1536) return 5;
  if (containerWidth >= 1200) return 4;
  if (containerWidth >= 900) return 3;
  if (containerWidth >= 600) return 2;
  return 1;
}

function buildOrganizationBlueprintSearchHaystack(row: SharedBlueprintRow): string {
  return [
    row.blueprint.name,
    row.blueprint.manufacturer,
    row.blueprint.category,
    row.ownerHandle,
    row.ownerDisplay,
    row.ownerRank,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function buildOrganizationResourceSearchHaystack(row: SharedResourceRow): string {
  return [
    row.resourceName,
    row.ownerHandle,
    row.ownerDisplay,
    row.ownerRank,
    row.quantityUnit,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function normalizeComparableText(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

function handleTabKeyDown<T extends string>(
  event: KeyboardEvent<HTMLButtonElement>,
  tabIds: readonly T[],
  activeId: T,
  onChange: (id: T) => void,
) {
  const currentIndex = tabIds.indexOf(activeId);
  let nextIndex = currentIndex;

  if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabIds.length;
  else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabIds.length) % tabIds.length;
  else if (event.key === 'Home') nextIndex = 0;
  else if (event.key === 'End') nextIndex = tabIds.length - 1;
  else return;

  event.preventDefault();
  const nextId = tabIds[nextIndex];
  onChange(nextId);
  requestAnimationFrame(() => {
    event.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`[data-tab-id="${nextId}"]`)
      ?.focus();
  });
}

/** Derive a stable accent colour from an org's SID (deterministic, palette-safe). */
function orgColorFromSid(sid: string): string {
  const COLORS = [
    '#818CF8', '#6BB6FF', '#34D399', '#F4B740',
    '#F87171', '#A78BFA', '#38BDF8', '#4ADE80',
  ];
  let h = 0;
  for (let i = 0; i < sid.length; i++) h = (h * 31 + sid.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

// ─── Org Detail ───────────────────────────────────────────────────────────────

function OrganizationDetail({
  organization,
  blueprintById,
  resources,
  favoriteIdSet,
  inventoryIdSet,
  onBack,
}: {
  organization: AccountOrganization;
  blueprintById: Map<string, Blueprint>;
  resources: ReturnType<typeof useCraft>['activeDataset']['resources'];
  favoriteIdSet: Set<string>;
  inventoryIdSet: Set<string>;
  onBack: () => void;
}) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const {
    account,
    loadOrganizationSharedBlueprints,
    loadOrganizationSharedResources,
    requestOrganizationCraft,
  } = useAuth();
  const {
    activeBlueprint,
    setActiveBlueprint,
    toggleFavorite,
    toggleInventory,
  } = useCraft();

  const [loadState, setLoadState] = useState<OrganizationLoadState>({ status: 'loading' });
  const [assetTab, setAssetTab] = useState<'resources' | 'blueprints' | 'members'>('resources');
  const [blueprintSearch, setBlueprintSearch] = useState('');
  const [resourceSearch, setResourceSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ItemCategory>('all');
  const [manufacturerFilter, setManufacturerFilter] = useState('all');
  const [blueprintOwnerFilter, setBlueprintOwnerFilter] = useState<string | null>(null);
  const [resourceOwnerFilter, setResourceOwnerFilter] = useState<string | null>(null);
  const [resourceQualityFilter, setResourceQualityFilter] = useState<'all' | 'with-quality' | 'no-quality'>('all');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestBusyKey, setRequestBusyKey] = useState<string | null>(null);
  const [craftRequestDialog, setCraftRequestDialog] = useState<CraftRequestDialogState | null>(null);

  const resourceById = useMemo(
    () => new Map(resources.map((resource) => [resource.id, resource])),
    [resources],
  );

  const orgColor = orgColorFromSid(organization.sid);

  // Load data on mount
  useEffect(() => {
    let cancelled = false;

    setLoadState({ status: 'loading' });
    setNotice(null);
    setError(null);

    void (async () => {
      const loadSharedBlueprints = async () => {
        try {
          return await loadOrganizationSharedBlueprints(organization.sid);
        } catch (nextError) {
          if (nextError instanceof Error && nextError.message.toLowerCase().includes('no shared blueprints')) {
            return null;
          }
          throw nextError;
        }
      };

      const loadSharedResources = async () => {
        try {
          return await loadOrganizationSharedResources(organization.sid);
        } catch (nextError) {
          if (nextError instanceof Error && nextError.message.toLowerCase().includes('no shared resources')) {
            return null;
          }
          throw nextError;
        }
      };

      try {
        const [blueprintPayload, resourcePayload] = await Promise.all([
          loadSharedBlueprints(),
          loadSharedResources(),
        ]);

        if (cancelled) return;

        const blueprintRows: SharedBlueprintRow[] = [];
        const resourceRows: SharedResourceRow[] = [];
        let hiddenBlueprintCount = 0;
        const sharedMemberHandles = new Set<string>();

        for (const member of blueprintPayload?.members ?? []) {
          if ((member.sharedBlueprintIds?.length ?? 0) > 0) {
            sharedMemberHandles.add(normalizeComparableText(member.handle));
          }
          for (const blueprintId of member.sharedBlueprintIds) {
            const blueprint = blueprintById.get(blueprintId);
            if (!blueprint) {
              hiddenBlueprintCount += 1;
              continue;
            }
            blueprintRows.push({
              key: `${member.handle}:${blueprint.id}`,
              blueprint,
              ownerHandle: member.handle,
              ownerDisplay: member.display,
              ownerImage: member.image,
              ownerRank: member.rank,
              ownerStars: member.stars,
            });
          }
        }

        for (const member of resourcePayload?.members ?? []) {
          if ((member.sharedResources?.length ?? 0) > 0) {
            sharedMemberHandles.add(normalizeComparableText(member.handle));
          }
          for (const resourceEntry of member.sharedResources) {
            resourceRows.push({
              key: `${member.handle}:${resourceEntry.id}`,
              entryId: resourceEntry.id,
              resourceId: resourceEntry.resourceId,
              resourceName: resourceEntry.resourceName,
              quantity: resourceEntry.quantity,
              quantityUnit: resourceEntry.quantityUnit,
              quality: resourceEntry.quality,
              ownerHandle: member.handle,
              ownerDisplay: member.display,
              ownerImage: member.image,
              ownerRank: member.rank,
              ownerStars: member.stars,
            });
          }
        }

        setLoadState({
          status: 'success',
          blueprintRows,
          resourceRows,
          hiddenBlueprintCount,
          sharedMemberCount: sharedMemberHandles.size,
        });
      } catch (nextError) {
        if (cancelled) return;
        setLoadState({
          status: 'error',
          error:
            nextError instanceof Error
              ? nextError.message
              : t(
                  'Failed to load the organization blueprints.',
                  'Le chargement des blueprints de l organisation a echoue.',
                  'Die Organisations-Blueprints konnten nicht geladen werden.',
                ),
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [blueprintById, loadOrganizationSharedBlueprints, loadOrganizationSharedResources, organization.sid, t]);

  const closeCraftRequestDialog = () => {
    if (requestBusyKey) return;
    setCraftRequestDialog(null);
  };

  const openCraftRequestDialog = (row: SharedBlueprintRow) => {
    setNotice(null);
    setError(null);
    setCraftRequestDialog({ row, comment: '', resourcesOption: 'unspecified', error: null });
  };

  const updateCraftRequestDialog = (
    updater: (current: CraftRequestDialogState) => CraftRequestDialogState,
  ) => {
    setCraftRequestDialog((current) => (current ? updater(current) : current));
  };

  const submitCraftRequest = () => {
    if (!craftRequestDialog) return;
    const { row, comment, resourcesOption } = craftRequestDialog;
    setRequestBusyKey(row.key);
    setNotice(null);
    setError(null);
    updateCraftRequestDialog((current) => ({ ...current, error: null }));

    void requestOrganizationCraft(organization.sid, {
      blueprintId: row.blueprint.id,
      blueprintName: row.blueprint.name,
      ownerHandle: row.ownerHandle,
      comment,
      resourcesOption,
    })
      .then(() => {
        setNotice(
          t(
            `Craft request sent to ${row.ownerHandle}.`,
            `Demande de craft envoyee a ${row.ownerHandle}.`,
            `Craft-Anfrage an ${row.ownerHandle} gesendet.`,
          ),
        );
        setCraftRequestDialog(null);
      })
      .catch((nextError) => {
        const message =
          nextError instanceof Error
            ? nextError.message
            : t(
                'Failed to send the craft request.',
                'L envoi de la demande de craft a echoue.',
                'Die Craft-Anfrage konnte nicht gesendet werden.',
              );
        setError(message);
        updateCraftRequestDialog((current) => ({ ...current, error: message }));
      })
      .finally(() => {
        setRequestBusyKey(null);
      });
  };

  const blueprintRows = loadState.status === 'success' ? loadState.blueprintRows : [];
  const resourceRows = loadState.status === 'success' ? loadState.resourceRows : [];

  const filteredBlueprintRows = useMemo(() => {
    const normalizedSearch = blueprintSearch.trim().toLowerCase();
    return blueprintRows.filter((row) => {
      if (normalizedSearch && !buildOrganizationBlueprintSearchHaystack(row).includes(normalizedSearch)) return false;
      if (categoryFilter !== 'all' && row.blueprint.category !== categoryFilter) return false;
      if (manufacturerFilter !== 'all' && row.blueprint.manufacturer !== manufacturerFilter) return false;
      if (blueprintOwnerFilter && normalizeComparableText(row.ownerHandle) !== normalizeComparableText(blueprintOwnerFilter)) return false;
      return true;
    });
  }, [blueprintOwnerFilter, blueprintRows, blueprintSearch, categoryFilter, manufacturerFilter]);

  const filteredResourceRows = useMemo(() => {
    const normalizedSearch = resourceSearch.trim().toLowerCase();
    return resourceRows.filter((row) => {
      if (normalizedSearch && !buildOrganizationResourceSearchHaystack(row).includes(normalizedSearch)) return false;
      if (resourceOwnerFilter && normalizeComparableText(row.ownerHandle) !== normalizeComparableText(resourceOwnerFilter)) return false;
      if (resourceQualityFilter === 'with-quality' && row.quality == null) return false;
      if (resourceQualityFilter === 'no-quality' && row.quality != null) return false;
      return true;
    });
  }, [resourceOwnerFilter, resourceQualityFilter, resourceRows, resourceSearch]);

  const resourceGroups = useMemo(() => {
    const map = new Map<string, { resource: Resource | null; rows: SharedResourceRow[] }>();
    for (const row of filteredResourceRows) {
      if (!map.has(row.resourceId)) {
        map.set(row.resourceId, { resource: resourceById.get(row.resourceId) ?? null, rows: [] });
      }
      map.get(row.resourceId)!.rows.push(row);
    }
    return [...map.values()];
  }, [filteredResourceRows, resourceById]);

  const manufacturerOptions = useMemo(
    () =>
      [...new Set(blueprintRows.map((row) => row.blueprint.manufacturer))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })),
    [blueprintRows],
  );
  const blueprintOwnerOptions = useMemo(
    () =>
      [...new Set(blueprintRows.map((row) => row.ownerHandle))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })),
    [blueprintRows],
  );
  const resourceOwnerOptions = useMemo(
    () =>
      [...new Set(resourceRows.map((row) => row.ownerHandle))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })),
    [resourceRows],
  );
  const categoryOptions = useMemo(
    () =>
      [...new Set(blueprintRows.map((row) => row.blueprint.category))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })),
    [blueprintRows],
  );

  const pendingRequestKeys = useMemo(
    () =>
      new Set(
        (account?.outgoingCraftRequests ?? [])
          .filter((request) => request.status === 'pending')
          .map(
            (request) =>
              `${request.organizationSid}::${request.blueprintId}::${normalizeComparableText(request.ownerRsiHandle)}`,
          ),
      ),
    [account?.outgoingCraftRequests],
  );
  const currentUserRsiHandle = normalizeComparableText(account?.rsi?.handle);

  const { sentinelRef, visibleCount, initialCount } = useInfiniteScroll(filteredBlueprintRows, {
    getColumns: organizationGridColumns,
    getScrollRoot: getMainContentScrollRoot,
  });

  const roleBadgeColor =
    organization.status === 'verified_admin' ? theme.palette.success.main : theme.palette.primary.main;

  return (
    <PageLayout>
      <Box component="nav" aria-label={t('Breadcrumb', 'Fil d Ariane', 'Breadcrumb')}>
        <Stack component="ol" direction="row" spacing={0.75} alignItems="center" sx={{ listStyle: 'none', p: 0, m: 0 }}>
          <Box component="li">
            <AppButton variant="ghost" size="sm" onClick={onBack}>
              {t('Organizations', 'Organisations', 'Organisationen')}
            </AppButton>
          </Box>
          <Box component="li" aria-hidden="true" sx={{ color: 'text.disabled' }}>/</Box>
          <Box component="li" aria-current="page" sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL }}>
            {organization.name}
          </Box>
        </Stack>
      </Box>

      {/* Hero Panel */}
      <Panel noPad>
        {/* Hero content */}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 3,
            alignItems: 'flex-start',
            p: { xs: 2.5, md: 3 },
            background: `linear-gradient(135deg, ${alpha(orgColor, 0.13)} 0%, transparent 60%)`,
            borderBottom: `1px solid ${theme.palette.ui.border}`,
          }}
        >
          <Avatar
            src={organization.image ?? organization.logo ?? undefined}
            alt={organization.name}
            variant="rounded"
            sx={{
              width: { xs: 64, md: 80 },
              height: { xs: 64, md: 80 },
              border: `2px solid ${alpha(orgColor, 0.45)}`,
              backgroundColor: alpha(orgColor, 0.15),
              fontFamily: FONT_DISPLAY,
              fontWeight: 700,
              fontSize: { xs: '1.5rem', md: '1.75rem' },
              color: orgColor,
              flexShrink: 0,
            }}
          >
            {organization.name.charAt(0).toUpperCase()}
          </Avatar>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <PageHeader
              title={organization.name}
              variant="compact"
              meta={`[${organization.sid}]`}
            />
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>

              <AppChip
                label={
                  organization.status === 'verified_admin'
                    ? t('Admin', 'Admin', 'Admin')
                    : t('Member', 'Membre', 'Mitglied')
                }
                size="sm"
                sx={{
                  height: 20,
                  fontSize: TEXT_LABEL_SM,
                  fontFamily: FONT_MONO,
                  backgroundColor: alpha(roleBadgeColor, 0.15),
                  color: roleBadgeColor,
                  border: `1px solid ${alpha(roleBadgeColor, 0.35)}`,

                }}
              />
              {organization.syncStatus === 'stale' && (
                <AppChip
                  label={t('Stale', 'Obsolete', 'Veraltet')}
                  size="sm"
                  tone="warning"
                  outlined
                  sx={{ height: 20, fontSize: TEXT_LABEL_SM, fontFamily: FONT_MONO }}
                />
              )}
            </Stack>
          </Box>

          {/* Stats */}
          <Stack direction="row" spacing={3} sx={{ flexShrink: 0 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL_SM, color: 'text.secondary', mb: 0.25 }}>
                {t('Resources', 'Ressources', 'Ressourcen')}
              </Typography>
              <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: '1.5rem', lineHeight: 1, color: 'text.primary' }}>
                {loadState.status === 'success' ? loadState.resourceRows.length : '—'}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL_SM, color: 'text.secondary', mb: 0.25 }}>
                {t('Blueprints', 'Blueprints', 'Blueprints')}
              </Typography>
              <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: '1.5rem', lineHeight: 1, color: 'text.primary' }}>
                {loadState.status === 'success' ? loadState.blueprintRows.length : '—'}
              </Typography>
            </Box>
          </Stack>
        </Box>

        <Box
          role="tablist"
          aria-label={t('Organization tabs', 'Onglets organisation', 'Organisations-Tabs')}
          sx={{ display: 'flex', gap: 0.75, p: 1, overflowX: 'auto' }}
        >
          {([
            { id: 'resources' as const, label: loadState.status === 'success'
              ? t(`Resource marketplace (${loadState.resourceRows.length})`, `Marketplace ressources (${loadState.resourceRows.length})`, `Ressourcen-Marketplace (${loadState.resourceRows.length})`)
              : t('Resource marketplace', 'Marketplace ressources', 'Ressourcen-Marketplace') },
            { id: 'blueprints' as const, label: loadState.status === 'success'
              ? t(`Blueprint marketplace (${loadState.blueprintRows.length})`, `Marketplace blueprints (${loadState.blueprintRows.length})`, `Blueprint-Marketplace (${loadState.blueprintRows.length})`)
              : t('Blueprint marketplace', 'Marketplace blueprints', 'Blueprint-Marketplace') },
            { id: 'members' as const, label: t('Members', 'Membres', 'Mitglieder') },
          ]).map((tab) => (
            <Box
              component="button"
              type="button"
              key={tab.id}
              role="tab"
              id={`org-tab-${tab.id}`}
              data-tab-id={tab.id}
              aria-label={tab.label}
              aria-selected={assetTab === tab.id}
              aria-controls={`org-tabpanel-${tab.id}`}
              tabIndex={assetTab === tab.id ? 0 : -1}
              onClick={() => setAssetTab(tab.id)}
              onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) =>
                handleTabKeyDown(event, ['resources', 'blueprints', 'members'] as const, assetTab, setAssetTab)}
              sx={{
                minHeight: 44,
                px: 1.5,
                whiteSpace: 'nowrap',
                borderRadius: 1,
                border: `1px solid ${assetTab === tab.id ? orgColor : theme.palette.divider}`,
                backgroundColor: assetTab === tab.id ? alpha(orgColor, 0.12) : 'transparent',
                color: assetTab === tab.id ? 'text.primary' : 'text.secondary',
                font: 'inherit',
                cursor: 'pointer',
                '&:hover': { color: 'text.primary', borderColor: orgColor },
              }}
            >
              {tab.label}
            </Box>
          ))}
        </Box>
      </Panel>

      {/* Alerts */}
      {notice && <AppAlert severity="success">{notice}</AppAlert>}
      {error && <AppAlert severity="error">{error}</AppAlert>}

      {/* Loading state */}
      {loadState.status === 'loading' && (
        <SurfaceState
          tone="loading"
          title={t('Loading organization data', 'Chargement des donnees de l organisation', 'Organisationsdaten werden geladen')}
        />
      )}

      {/* Error state */}
      {loadState.status === 'error' && (
        <SurfaceState tone="error" title={loadState.error} />
      )}

      {/* Tab panels */}
      {loadState.status === 'success' && (
        <>
          {/* ── Resources tab ─────────────────────────────────────────────── */}
          <Box
            role="tabpanel"
            id="org-tabpanel-resources"
            aria-labelledby="org-tab-resources"
            hidden={assetTab !== 'resources'}
          >
            <Panel
              eyebrow={t('Marketplace', 'Marketplace', 'Marketplace')}
              title={t('Available lots', 'Lots disponibles', 'Verfügbare Lose')}
              subtitle={t(
                'Several players can share the same resource at different qualities — lots stay separate.',
                'Plusieurs joueurs peuvent partager la même ressource à des qualités différentes — les lots restent séparés.',
                'Mehrere Spieler können dieselbe Ressource mit unterschiedlichen Qualitäten teilen — Lose bleiben getrennt.',
              )}
            >
              {/* Filters toolbar */}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
                <Box sx={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
                  <SearchOutlinedIcon
                    aria-hidden="true"
                    sx={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 1, color: 'text.secondary' }}
                  />
                  <AppTextField
                    type="search"
                    ariaLabel={t('Search resources or owners', 'Rechercher ressources ou propriétaires', 'Ressourcen oder Besitzer suchen')}
                    placeholder={t('Search resources or owners', 'Rechercher ressources ou propriétaires', 'Ressourcen oder Besitzer suchen')}
                    value={resourceSearch}
                    onValueChange={setResourceSearch}
                    sx={{ pl: 4.5 }}
                  />
                </Box>
                <AppSelect
                  label={t('Owner', 'Propriétaire', 'Besitzer')}
                  value={resourceOwnerFilter ?? 'all'}
                  options={[
                    { label: t('All owners', 'Tous les propriétaires', 'Alle Besitzer'), value: 'all' },
                    ...resourceOwnerOptions.map((ownerHandle) => ({ label: ownerHandle, value: ownerHandle })),
                  ]}
                  onValueChange={(value) => setResourceOwnerFilter(value === 'all' || value == null ? null : value)}
                  sx={{ minWidth: 140 }}
                />
                <AppSelect
                  label={t('Quality', 'Qualité', 'Qualität')}
                  value={resourceQualityFilter}
                  options={[
                    { label: t('All qualities', 'Toutes les qualités', 'Alle Qualitäten'), value: 'all' },
                    { label: t('With quality', 'Avec qualité', 'Mit Qualität'), value: 'with-quality' },
                    { label: t('No quality', 'Sans qualité', 'Ohne Qualität'), value: 'no-quality' },
                  ]}
                  onValueChange={(value) => setResourceQualityFilter((value ?? 'all') as 'all' | 'with-quality' | 'no-quality')}
                  sx={{ minWidth: 130 }}
                />
                <AppButton
                  variant="ghost"
                  size="sm"
                  icon={<FilterListOffOutlinedIcon />}
                  onClick={() => { setResourceSearch(''); setResourceOwnerFilter(null); setResourceQualityFilter('all'); }}
                  sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  {t('Reset', 'Réinitialiser', 'Zurücksetzen')}
                </AppButton>
              </Stack>

              {resourceGroups.length === 0 ? (
                <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                  <Typography variant="body1" sx={{ mb: 0.75 }}>
                    {t(
                      'No shared resource matches the current filters.',
                      'Aucune ressource partagée ne correspond aux filtres actuels.',
                      'Keine geteilte Ressource entspricht den aktuellen Filtern.',
                    )}
                  </Typography>
                  <Typography variant="body2">
                    {t(
                      'Try clearing the owner or quality filter first.',
                      'Essaie d abord de retirer le filtre propriétaire ou qualité.',
                      'Entferne zuerst den Besitzer- oder Qualitätsfilter.',
                    )}
                  </Typography>
                </Paper>
              ) : (
                <Stack spacing={1.25}>
                  {resourceGroups.map(({ resource, rows }) => {
                    const totalQty = rows.reduce((s, r) => s + r.quantity, 0);
                    const isScu = rows[0]?.quantityUnit === 'scu';
                    return (
                      <Paper key={resource?.id ?? rows[0].resourceId} variant="outlined" sx={{ overflow: 'hidden', bgcolor: 'ui.surface' }}>
                        {/* Group header */}
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            px: 2,
                            py: 1.25,
                            bgcolor: alpha(theme.palette.background.default, 0.5),
                            borderBottom: `1px solid ${theme.palette.ui.border}`,
                          }}
                        >
                          <Box
                            sx={{
                              width: 36,
                              height: 36,
                              flexShrink: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                              bgcolor: alpha(resource?.color ?? '#fff', 0.12),
                              color: resource?.color ?? 'text.secondary',
                              border: `1px solid ${alpha(resource?.color ?? '#fff', 0.35)}`,
                            }}
                          >
                            {resource?.visual?.imageUrl ? (
                              <CardMedia
                                component="img"
                                image={resource.visual.imageUrl}
                                alt=""
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              <ResourceIcon name={rows[0].resourceName} size={18} shimmer={false} />
                            )}
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: '0.875rem', lineHeight: 1.2 }} noWrap>
                              {rows[0].resourceName}
                            </Typography>
                            <Typography sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL_SM, color: 'text.secondary' }}>
                              {rows.length} {t('lot', 'lot')}{rows.length > 1 ? 's' : ''}{' '}·{' '}
                              {t('total', 'total')} ×{totalQty}{isScu ? ' SCU' : ''}
                            </Typography>
                          </Box>
                        </Box>
                        {/* Lots */}
                        <Box>
                          {rows.map((row, i) => {
                            const qualityTone = row.quality == null ? null
                              : row.quality >= 600 ? theme.palette.success.main
                              : row.quality >= 400 ? theme.palette.primary.main
                              : theme.palette.warning.main;
                            return (
                              <Box
                                key={row.key}
                                sx={{
                                  display: 'grid',
                                  gridTemplateColumns: '28px 1fr auto auto',
                                  gap: 1.5,
                                  alignItems: 'center',
                                  px: 2,
                                  py: 1.25,
                                  borderTop: i > 0 ? `1px dashed ${alpha(theme.palette.ui.border, 0.8)}` : 'none',
                                  transition: 'background-color 150ms',
                                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                                }}
                              >
                                <Avatar
                                  src={row.ownerImage ?? undefined}
                                  alt={row.ownerHandle}
                                  sx={{ width: 28, height: 28, fontSize: TEXT_LABEL, bgcolor: alpha(orgColor, 0.2), color: orgColor }}
                                >
                                  {row.ownerHandle.charAt(0).toUpperCase()}
                                </Avatar>
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: TEXT_LABEL_LG, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {row.ownerDisplay || row.ownerHandle}
                                  </Typography>
                                  {row.ownerRank && (
                                    <Typography sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL_SM, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {row.ownerHandle} · {row.ownerRank}
                                    </Typography>
                                  )}
                                </Box>
                                <AppChip
                                  label={`×${formatResourceQuantity(row.quantity, row.quantityUnit, lang, 'compact')}`}
                                  size="sm"
                                  outlined
                                  sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL, height: 22 }}
                                />
                                {row.quality != null && qualityTone ? (
                                  <AppChip
                                    label={formatQualityLabel(row.quality, lang)}
                                    size="sm"
                                    sx={{
                                      fontFamily: FONT_MONO,
                                      fontSize: TEXT_LABEL,
                                      height: 22,
                                      bgcolor: alpha(qualityTone, 0.15),
                                      color: qualityTone,
                                      border: `1px solid ${alpha(qualityTone, 0.35)}`,

                                    }}
                                  />
                                ) : (
                                  <Box />
                                )}
                              </Box>
                            );
                          })}
                        </Box>
                      </Paper>
                    );
                  })}
                </Stack>
              )}
            </Panel>
          </Box>

          {/* ── Blueprints tab ────────────────────────────────────────────── */}
          <Box
            role="tabpanel"
            id="org-tabpanel-blueprints"
            aria-labelledby="org-tab-blueprints"
            hidden={assetTab !== 'blueprints'}
          >
            <Panel
              eyebrow={t('Marketplace', 'Marketplace', 'Marketplace')}
              title={t('Shared blueprints', 'Blueprints partagés', 'Geteilte Blueprints')}
              action={
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Box sx={{ position: 'relative', width: { xs: 160, md: 220 } }}>
                    <SearchOutlinedIcon
                      aria-hidden="true"
                      sx={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 1, color: 'text.secondary' }}
                    />
                    <AppTextField
                      type="search"
                      ariaLabel={t('Search blueprints or owners', 'Rechercher blueprints ou propriétaires', 'Blueprints oder Besitzer suchen')}
                      placeholder={t('Search blueprints or owners', 'Rechercher blueprints ou propriétaires', 'Blueprints oder Besitzer suchen')}
                      value={blueprintSearch}
                      onValueChange={setBlueprintSearch}
                      sx={{ pl: 4.5 }}
                    />
                  </Box>
                  <AppSelect
                    label={t('Category', 'Catégorie', 'Kategorie')}
                    value={categoryFilter}
                    options={[
                      { label: t('All categories', 'Toutes les catégories', 'Alle Kategorien'), value: 'all' },
                      ...categoryOptions.map((category) => ({
                        value: category,
                        label: CATEGORY_LABELS[category]
                          ? CATEGORY_LABELS[category][lang] ?? CATEGORY_LABELS[category].en
                          : category,
                      })),
                    ]}
                    onValueChange={(value) => setCategoryFilter((value ?? 'all') as 'all' | ItemCategory)}
                    sx={{ minWidth: 140 }}
                  />
                  <AppSelect
                    label={t('Manufacturer', 'Fabricant', 'Hersteller')}
                    value={manufacturerFilter}
                    options={[
                      { label: t('All manufacturers', 'Tous les fabricants', 'Alle Hersteller'), value: 'all' },
                      ...manufacturerOptions.map((manufacturer) => ({ label: manufacturer, value: manufacturer })),
                    ]}
                    onValueChange={(value) => setManufacturerFilter(value ?? 'all')}
                    sx={{ minWidth: 140 }}
                  />
                  <AppSelect
                    label={t('Owner', 'Propriétaire', 'Besitzer')}
                    value={blueprintOwnerFilter ?? 'all'}
                    options={[
                      { label: t('All owners', 'Tous les propriétaires', 'Alle Besitzer'), value: 'all' },
                      ...blueprintOwnerOptions.map((ownerHandle) => ({ label: ownerHandle, value: ownerHandle })),
                    ]}
                    onValueChange={(value) => setBlueprintOwnerFilter(value === 'all' || value == null ? null : value)}
                    sx={{ minWidth: 140 }}
                  />
                  <AppButton
                    variant="ghost"
                    size="sm"
                    icon={<FilterListOffOutlinedIcon />}
                    onClick={() => { setBlueprintSearch(''); setCategoryFilter('all'); setManufacturerFilter('all'); setBlueprintOwnerFilter(null); }}
                    sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    {t('Reset', 'Réinitialiser', 'Zurücksetzen')}
                  </AppButton>
                </Stack>
              }
            >
              <Stack spacing={1.5}>
                {loadState.hiddenBlueprintCount > 0 && (
                  <AppAlert severity="info">
                    {t(
                      `${loadState.hiddenBlueprintCount} shared blueprint entries are hidden because they are not present in the currently loaded dataset.`,
                      `${loadState.hiddenBlueprintCount} entrées partagées sont masquées car elles ne sont pas présentes dans le dataset actuellement chargé.`,
                      `${loadState.hiddenBlueprintCount} geteilte Blueprint-Einträge sind ausgeblendet, weil sie im aktuell geladenen Datensatz fehlen.`,
                    )}
                  </AppAlert>
                )}

                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {filteredBlueprintRows.length}{' '}
                  {t('visible shared entries', 'entrées partagées visibles', 'sichtbare geteilte Einträge')}
                </Typography>

                {filteredBlueprintRows.length === 0 ? (
                  <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                    <Typography variant="body1" sx={{ mb: 0.75 }}>
                      {t(
                        'No shared blueprint matches the current filters.',
                        'Aucun blueprint partagé ne correspond aux filtres actuels.',
                        'Kein geteilter Blueprint entspricht den aktuellen Filtern.',
                      )}
                    </Typography>
                    <Typography variant="body2">
                      {t(
                        'Try clearing the owner or manufacturer filter first.',
                        'Essaie d abord de retirer le filtre propriétaire ou fabricant.',
                        'Entferne zuerst den Besitzer- oder Herstellerfilter.',
                      )}
                    </Typography>
                  </Paper>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box
                      role="list"
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                          xs: '1fr',
                          sm: 'repeat(2, minmax(0, 1fr))',
                          md: 'repeat(3, minmax(0, 1fr))',
                          lg: 'repeat(4, minmax(0, 1fr))',
                          xl: 'repeat(5, minmax(0, 1fr))',
                        },
                        gap: { xs: 1.25, md: 1.5, xl: 2 },
                      }}
                    >
                      {filteredBlueprintRows.slice(0, visibleCount).map((row, index) => {
                        const pendingRequestKey = `${organization.sid}::${row.blueprint.id}::${normalizeComparableText(row.ownerHandle)}`;
                        const requestAlreadyPending = pendingRequestKeys.has(pendingRequestKey);
                        const ownSharedBlueprint = normalizeComparableText(row.ownerHandle) === currentUserRsiHandle;
                        const requestBusy = requestBusyKey === row.key;

                        const extraQuickActions: BlueprintCardQuickAction[] = [
                          {
                            key: `owner-filter-${row.key}`,
                            label: row.ownerHandle,
                            ariaLabel: t(
                              `Filter this organization grid by ${row.ownerHandle}`,
                              `Filtrer cette grille d organisation par ${row.ownerHandle}`,
                              `Dieses Organisationsraster nach ${row.ownerHandle} filtern`,
                            ),
                            tooltip: t(
                              `Show only blueprints shared by ${row.ownerDisplay || row.ownerHandle}.`,
                              `Afficher seulement les blueprints partagés par ${row.ownerDisplay || row.ownerHandle}.`,
                              `Nur Blueprints anzeigen, die von ${row.ownerDisplay || row.ownerHandle} geteilt werden.`,
                            ),
                            selected:
                              normalizeComparableText(blueprintOwnerFilter) ===
                              normalizeComparableText(row.ownerHandle),
                            avatarSrc: row.ownerImage,
                            avatarAlt: row.ownerHandle,
                            onClick: () => {
                              setBlueprintOwnerFilter((currentOwnerFilter) =>
                                normalizeComparableText(currentOwnerFilter) ===
                                normalizeComparableText(row.ownerHandle)
                                  ? null
                                  : row.ownerHandle,
                              );
                            },
                          },
                          {
                            key: `request-craft-${row.key}`,
                            label: requestAlreadyPending
                              ? t('Pending', 'En attente', 'Ausstehend')
                              : ownSharedBlueprint
                                ? t('Your blueprint', 'Ton blueprint', 'Dein Blueprint')
                                : t('Request craft', 'Demander craft', 'Craft anfragen'),
                            ariaLabel: requestAlreadyPending
                              ? t('Craft request already pending', 'Demande de craft déjà en attente', 'Craft-Anfrage bereits ausstehend')
                              : ownSharedBlueprint
                                ? t('This is your own shared blueprint', 'C est ton propre blueprint partagé', 'Dies ist dein eigener geteilter Blueprint')
                                : t(`Request a craft from ${row.ownerHandle}`, `Demander un craft à ${row.ownerHandle}`, `Einen Craft von ${row.ownerHandle} anfordern`),
                            tooltip: requestAlreadyPending
                              ? t(
                                  'A craft request is already pending for this owner and blueprint.',
                                  'Une demande de craft est déjà en attente pour ce propriétaire et ce blueprint.',
                                  'Für diesen Besitzer und Blueprint ist bereits eine Craft-Anfrage ausstehend.',
                                )
                              : ownSharedBlueprint
                                ? t(
                                    'You already own and share this blueprint yourself.',
                                    'Tu possèdes et partages déjà toi-même ce blueprint.',
                                    'Du besitzt und teilst diesen Blueprint bereits selbst.',
                                  )
                                : t(
                                    'Send a craft request to the member who shared this blueprint.',
                                    'Envoyer une demande de craft au membre qui partage ce blueprint.',
                                    'Eine Craft-Anfrage an das Mitglied senden, das diesen Blueprint teilt.',
                                  ),
                            icon: <HandymanOutlinedIcon fontSize="small" />,
                            busy: requestBusy,
                            disabled: requestBusy || requestAlreadyPending || ownSharedBlueprint,
                            onClick: () => { openCraftRequestDialog(row); },
                          },
                        ];

                        return (
                          <BlueprintCard
                            key={row.key}
                            blueprint={row.blueprint}
                            isActive={activeBlueprint?.id === row.blueprint.id}
                            isFavorite={favoriteIdSet.has(row.blueprint.id)}
                            isInInventory={inventoryIdSet.has(row.blueprint.id)}
                            extraQuickActions={extraQuickActions}
                            resources={resources}
                            priority={index < initialCount}
                            onSelect={setActiveBlueprint}
                            onToggleFavorite={toggleFavorite}
                            onToggleInventory={toggleInventory}
                          />
                        );
                      })}
                    </Box>
                    {visibleCount < filteredBlueprintRows.length && (
                      <div ref={sentinelRef} style={{ height: 1 }} aria-hidden="true" />
                    )}
                  </Box>
                )}
              </Stack>
            </Panel>
          </Box>

          {/* ── Members tab ───────────────────────────────────────────────── */}
          <Box
            role="tabpanel"
            id="org-tabpanel-members"
            aria-labelledby="org-tab-members"
            hidden={assetTab !== 'members'}
          >
            <Panel
              eyebrow={`${loadState.sharedMemberCount} ${t('active', 'actifs', 'aktiv')}`}
              title={t('Members', 'Membres', 'Mitglieder')}
            >
              {loadState.sharedMemberCount === 0 ? (
                <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                  <Typography variant="body2">
                    {t(
                      'No members have shared entries in this organization yet.',
                      'Aucun membre n a encore partagé d entrées dans cette organisation.',
                      'Noch keine Mitglieder haben Einträge in dieser Organisation geteilt.',
                    )}
                  </Typography>
                </Paper>
              ) : (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: 1.5,
                  }}
                >
                  {[
                    ...new Map(
                      [...blueprintRows, ...resourceRows].map((row) => [
                        normalizeComparableText(row.ownerHandle),
                        row,
                      ]),
                    ).values(),
                  ].map((row) => (
                    <Paper
                      key={row.ownerHandle}
                      variant="outlined"
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.25,
                        p: 1.5,
                        backgroundColor: 'ui.surface',
                      }}
                    >
                      <Avatar
                        src={row.ownerImage ?? undefined}
                        alt={row.ownerHandle}
                        sx={{
                          width: 36,
                          height: 36,
                          fontSize: '0.875rem',
                          flexShrink: 0,
                          backgroundColor: alpha(orgColor, 0.2),
                          color: orgColor,
                          border: `1px solid ${alpha(orgColor, 0.3)}`,
                        }}
                      >
                        {row.ownerHandle.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          sx={{
                            fontFamily: FONT_DISPLAY,
                            fontWeight: 600,
                            fontSize: TEXT_LABEL_LG,
                            lineHeight: 1.3,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {row.ownerDisplay || row.ownerHandle}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: TEXT_LABEL_SM,
                            color: 'text.secondary',
                            fontFamily: FONT_MONO,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {row.ownerRank ?? row.ownerHandle}
                        </Typography>
                      </Box>
                      {/* Online dot placeholder */}
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: 'success.main',
                          flexShrink: 0,
                        }}
                        title={t('Shared entries', 'Entrées partagées', 'Geteilte Einträge')}
                      />
                    </Paper>
                  ))}
                </Box>
              )}
            </Panel>
          </Box>
        </>
      )}

      {/* Craft Request Dialog */}
      <AppDialog
        open={Boolean(craftRequestDialog)}
        onOpenChange={(open) => { if (!open) closeCraftRequestDialog(); }}
        width="min(36rem, calc(100vw - 2rem))"
        title={craftRequestDialog
          ? t(
              `Request craft from ${craftRequestDialog.row.ownerHandle}`,
              `Demander un craft à ${craftRequestDialog.row.ownerHandle}`,
              `Craft bei ${craftRequestDialog.row.ownerHandle} anfragen`,
            )
          : t('Request craft', 'Demander craft', 'Craft anfragen')}
        footer={
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <AppButton variant="ghost" onClick={closeCraftRequestDialog} disabled={Boolean(requestBusyKey)}>
              {t('Cancel', 'Annuler', 'Abbrechen')}
            </AppButton>
            <AppButton
              variant="primary"
              onClick={submitCraftRequest}
              disabled={!craftRequestDialog || Boolean(requestBusyKey)}
            >
              {requestBusyKey
                ? t('Sending...', 'Envoi...', 'Sende...')
                : t('Send request', 'Envoyer la demande', 'Anfrage senden')}
            </AppButton>
          </Box>
        }
      >
          <Stack spacing={2}>
            {craftRequestDialog && (
              <AppAlert severity="info">
                {t(
                  `You are requesting ${craftRequestDialog.row.blueprint.name} from ${craftRequestDialog.row.ownerDisplay || craftRequestDialog.row.ownerHandle}.`,
                  `Tu demandes ${craftRequestDialog.row.blueprint.name} à ${craftRequestDialog.row.ownerDisplay || craftRequestDialog.row.ownerHandle}.`,
                  `Du fragst ${craftRequestDialog.row.blueprint.name} bei ${craftRequestDialog.row.ownerDisplay || craftRequestDialog.row.ownerHandle} an.`,
                )}
              </AppAlert>
            )}
            {craftRequestDialog?.error && (
              <AppAlert severity="error">{craftRequestDialog.error}</AppAlert>
            )}
            <AppTextArea
              label={t('Comment (optional)', 'Commentaire (optionnel)', 'Kommentar (optional)')}
              value={craftRequestDialog?.comment ?? ''}
              onValueChange={(nextComment) => {
                updateCraftRequestDialog((current) => ({ ...current, comment: nextComment, error: null }));
              }}
              rows={4}
              placeholder={t(
                'Add useful details for the crafter.',
                'Ajoute des détails utiles pour le crafteur.',
                'Füge hilfreiche Details für den Crafter hinzu.',
              )}
            />
            <Stack spacing={0.5}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {t('Resources', 'Ressources', 'Ressourcen')}
              </Typography>
              <AppCheckbox
                checked={craftRequestDialog?.resourcesOption === 'has_resources'}
                onCheckedChange={(checked) => {
                  updateCraftRequestDialog((current) => ({
                    ...current,
                    resourcesOption: checked ? 'has_resources' : 'unspecified',
                    error: null,
                  }));
                }}
                label={t('I have the resources', 'J ai les ressources', 'Ich habe die Ressourcen')}
              />
              <AppCheckbox
                checked={craftRequestDialog?.resourcesOption === 'buy_resources'}
                onCheckedChange={(checked) => {
                  updateCraftRequestDialog((current) => ({
                    ...current,
                    resourcesOption: checked ? 'buy_resources' : 'unspecified',
                    error: null,
                  }));
                }}
                label={t(
                  'I will buy the resources',
                  'Je t achète les ressources',
                  'Ich kaufe dir die Ressourcen ab',
                )}
              />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {t(
                  'These options are mutually exclusive and will be shown in the app and in Discord.',
                  'Ces options sont exclusives et seront visibles dans l appli et sur Discord.',
                  'Diese Optionen schließen sich gegenseitig aus und werden in der App und auf Discord angezeigt.',
                )}
              </Typography>
            </Stack>
          </Stack>
      </AppDialog>
    </PageLayout>
  );
}

// ─── Org Card ─────────────────────────────────────────────────────────────────

function OrganizationCard({
  organization,
  onOpen,
}: {
  organization: AccountOrganization;
  onOpen: (org: AccountOrganization) => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const orgColor = orgColorFromSid(organization.sid);

  const roleBadgeColor =
    organization.status === 'verified_admin' ? theme.palette.success.main : theme.palette.primary.main;

  return (
    <Paper
      variant="outlined"
      component="article"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: 'ui.surface',
        transition: 'border-color 180ms ease',
        '&:hover': { borderColor: alpha(orgColor, 0.45) },
      }}
    >
      {/* Banner */}
      <Box
        sx={{
          height: 80,
          position: 'relative',
          background: `linear-gradient(135deg, ${alpha(orgColor, 0.33)} 0%, ${alpha(orgColor, 0.13)} 100%)`,
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(120% 100% at 20% 0%, ${alpha('#fff', 0.1)} 0%, transparent 50%), linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.18) 100%)`,
          }}
        />
      </Box>

      {/* Body — overlaps banner by 28px */}
      <Box sx={{ px: 2, pb: 2, pt: 0, mt: '-28px', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <Avatar
          src={organization.image ?? organization.logo ?? undefined}
          alt={organization.name}
          variant="rounded"
          sx={{
            width: 56,
            height: 56,
            border: `2px solid ${alpha(orgColor, 0.45)}`,
            backgroundColor: alpha(orgColor, 0.15),
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: '1.25rem',
            color: orgColor,
            flexShrink: 0,
            boxShadow: `0 2px 8px ${alpha(orgColor, 0.25)}`,
          }}
        >
          {organization.name.charAt(0).toUpperCase()}
        </Avatar>

        <Typography
          sx={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: '0.9375rem',
            lineHeight: 1.2,
            mt: 1.5,
            mb: 0.5,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {organization.name}
        </Typography>
        <Typography
          sx={{
            fontFamily: FONT_MONO,
            fontSize: TEXT_LABEL_SM,
            color: 'text.disabled',
            letterSpacing: '0.05em',
            mb: 1.5,
          }}
        >
          [{organization.sid}]
        </Typography>

        <Divider sx={{ mb: 1.5 }} />

        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 'auto' }}>
          <AppChip
            label={
              organization.status === 'verified_admin'
                ? t('Admin', 'Admin', 'Admin')
                : t('Member', 'Membre', 'Mitglied')
            }
            size="sm"
            sx={{
              height: 20,
              fontSize: TEXT_LABEL_SM,
              fontFamily: FONT_MONO,
              backgroundColor: alpha(roleBadgeColor, 0.15),
              color: roleBadgeColor,
              border: `1px solid ${alpha(roleBadgeColor, 0.35)}`,

            }}
          />
          <AppButton
            variant="ghost"
            size="sm"
            onClick={() => onOpen(organization)}
            sx={{ whiteSpace: 'nowrap', fontSize: TEXT_LABEL }}
          >
            {t('Marketplace', 'Marketplace', 'Marketplace')}
          </AppButton>
        </Stack>

        {organization.syncStatus === 'stale' && (
          <AppChip
            label={t('Snapshot stale', 'Snapshot obsolète', 'Snapshot veraltet')}
            size="sm"
            tone="warning"
            outlined
            sx={{ alignSelf: 'flex-start', mt: 1, fontSize: TEXT_LABEL_SM, fontFamily: FONT_MONO, height: 20 }}
          />
        )}
      </Box>
    </Paper>
  );
}

// ─── Org List ─────────────────────────────────────────────────────────────────

function OrganizationList({
  accessibleOrganizations,
  lockedOrganizations,
  citizenIdRsiLinkEnabled,
  citizenIdBrandEnvironment,
  onSyncCitizenId,
  onOpenOrg,
}: {
  accessibleOrganizations: AccountOrganization[];
  lockedOrganizations: AccountOrganization[];
  citizenIdRsiLinkEnabled: boolean;
  citizenIdBrandEnvironment: CitizenIdBrandEnvironment;
  onSyncCitizenId: () => void;
  onOpenOrg: (org: AccountOrganization) => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();

  return (
    <PageLayout>
      <PageHeader
        title={t('Organizations', 'Organisations', 'Organisationen')}
        eyebrow={t('Shared operations', 'Opérations partagées', 'Gemeinsame Einsätze')}
        description={t('Find a member, a blueprint or materials to share.', 'Retrouvez un membre, un blueprint ou des matériaux à partager.', 'Mitglieder, Baupläne und gemeinsame Materialien finden.')}

        actions={
          <CitizenIdSignInButton
            environment={citizenIdBrandEnvironment}
            onClick={onSyncCitizenId}
            disabled={!citizenIdRsiLinkEnabled}
          />
        }
      />



      {/* Accessible org grid */}
      {accessibleOrganizations.length === 0 ? (
        <Paper
          variant="outlined"
          sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}
        >
          <Typography variant="h6" sx={{ mb: 0.75 }}>
            {t(
              'No verified organizations are ready yet',
              'Aucune organisation vérifiée n est encore prête',
              'Noch keine verifizierten Organisationen verfügbar',
            )}
          </Typography>
          <Typography variant="body2">
            {t(
              'As soon as an organization membership is verified and shared entries exist, it will appear here.',
              'Dès qu une appartenance à une organisation est vérifiée et que des entrées partagées existent, elle apparaîtra ici.',
              'Sobald eine Organisationsmitgliedschaft verifiziert ist und geteilte Einträge existieren, erscheint sie hier.',
            )}
          </Typography>
        </Paper>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))',
            gap: 2,
          }}
        >
          {accessibleOrganizations.map((org) => (
            <OrganizationCard key={org.sid} organization={org} onOpen={onOpenOrg} />
          ))}
        </Box>
      )}

      <details className="workspace-disclosure">
        <summary>{t('Sharing & organization access', 'Partage et accès aux organisations', 'Freigaben und Organisationszugang')}</summary>
        <div className="workspace-disclosure-body">
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>{t(
          'Each organization has an internal marketplace where members share blueprints and resources. Resources are listed by quality and quantity — several lots of the same material can coexist.',
          'Chaque org dispose d un marketplace interne où les membres partagent blueprints et ressources. Les ressources sont listées par qualité et quantité — plusieurs lots du même matériau peuvent coexister.',
          'Jede Organisation hat einen internen Marketplace, auf dem Mitglieder Blueprints und Ressourcen teilen. Ressourcen werden nach Qualität und Menge aufgelistet — mehrere Lose desselben Materials können nebeneinander existieren.',
        )}</Typography>
      <AppAlert severity="info">
        {t(
          'Public RSI organizations are imported automatically from Citizen iD. Re-sync here after changing organization visibility or granting new scopes; manual SID linking remains a fallback on the account page.',
          'Les organisations RSI publiques sont importees automatiquement depuis Citizen iD. Relance la synchro ici apres avoir change la visibilite des organisations ou accepte de nouveaux scopes ; le lien manuel par SID reste disponible sur la page compte.',
          'Oeffentliche RSI-Organisationen werden automatisch aus Citizen iD importiert. Synchronisiere hier erneut, wenn sich Org-Sichtbarkeit oder Scopes geaendert haben; manuelle SID-Verknuepfung bleibt auf der Kontoseite als Fallback verfuegbar.',
        )}
      </AppAlert>
        </div>
      </details>

      {/* Locked organizations */}
      {lockedOrganizations.length > 0 && (
        <Paper
          variant="outlined"
          sx={{
            p: 1.5,
            borderColor: alpha(theme.palette.warning.main, 0.2),
            backgroundColor: alpha(theme.palette.warning.main, 0.04),
          }}
        >
          <Stack spacing={1}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {t(
                'Linked but not accessible yet',
                'Liées mais pas encore accessibles',
                'Verknüpft, aber noch nicht verfügbar',
              )}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {t(
                'These organizations are linked to the account, but their shared entries stay locked until the membership is verified in the app snapshot.',
                'Ces organisations sont bien liées au compte, mais leurs entrées partagées restent verrouillées tant que l appartenance n est pas vérifiée dans le snapshot de l appli.',
                'Diese Organisationen sind mit dem Konto verknüpft, aber ihre geteilten Einträge bleiben gesperrt, bis die Mitgliedschaft im App-Snapshot verifiziert ist.',
              )}
            </Typography>
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
              {lockedOrganizations.map((org) => (
                <AppChip
                  key={org.sid}
                  label={`${org.name} (${org.sid})`}
                  size="sm"
                  outlined
                />
              ))}
            </Stack>
          </Stack>
        </Paper>
      )}
    </PageLayout>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function OrganizationsPage() {
  const { t } = useI18n();
  const {
    account,
    citizenIdRsiLinkEnabled,
    citizenIdBrandEnvironment,
    linkRsiAccountWithCitizenId,
    syncStatus,
    syncError,
    authError,
  } = useAuth();
  const {
    blueprints,
    activeDataset,
    favoriteIds,
    inventoryIds,
  } = useCraft();
  const [selectedOrg, setSelectedOrg] = useLocalPersist<string | null>(
    LS_KEYS.ORGANIZATIONS_ACCORDIONS,
    null,
  );

  const blueprintById = useMemo(
    () => new Map(blueprints.map((blueprint) => [blueprint.id, blueprint])),
    [blueprints],
  );
  const favoriteIdSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const inventoryIdSet = useMemo(() => new Set(inventoryIds), [inventoryIds]);
  const resources = activeDataset.resources;

  const linkedOrganizations = account?.organizations ?? [];
  const accessibleOrganizations = linkedOrganizations.filter(
    (org) => org.status === 'verified_member' || org.status === 'verified_admin',
  );
  const lockedOrganizations = linkedOrganizations.filter(
    (org) => org.status !== 'verified_member' && org.status !== 'verified_admin',
  );

  const activeOrg = selectedOrg
    ? (accessibleOrganizations.find((org) => org.sid === selectedOrg) ?? null)
    : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      {/* Sync banners */}
      {(authError || syncError || syncStatus === 'pending' || syncStatus === 'syncing' || !account?.rsi?.handle) && (
        <Box sx={{ px: { xs: 2, sm: 3, lg: 4 }, pt: { xs: 2, sm: 3 }, maxWidth: 1600, mx: 'auto', width: '100%' }}>
          <Stack spacing={1}>
            {authError && (
              <AppAlert severity="error">{authError}</AppAlert>
            )}
            {syncError && (
              <AppAlert severity="error">{syncError}</AppAlert>
            )}
            {(syncStatus === 'pending' || syncStatus === 'syncing') && (
              <AppAlert severity="info">
                {t(
                  'Cloud changes are still syncing. Newly shared blueprints and craft request updates may take a moment to settle.',
                  'Les changements cloud se synchronisent encore. Les blueprints fraîchement partagés et les mises à jour de demandes de craft peuvent prendre un court instant.',
                  'Cloud-Änderungen werden noch synchronisiert. Neu geteilte Blueprints und Craft-Anfragen können einen kurzen Moment brauchen.',
                )}
              </AppAlert>
            )}
            {!account?.rsi?.handle && (
              <AppAlert severity="info">
                {t(
                  'Link an RSI account first from the account page to access organization-shared blueprints and resources.',
                  'Lie d abord un compte RSI depuis la page compte pour accéder aux blueprints et ressources partagés d organisation.',
                  'Verknüpfe zuerst auf der Kontoseite ein RSI-Konto, um auf organisationsgeteilte Blueprints und Ressourcen zuzugreifen.',
                )}
              </AppAlert>
            )}
          </Stack>
        </Box>
      )}

      {activeOrg ? (
        <OrganizationDetail
          organization={activeOrg}
          blueprintById={blueprintById}
          resources={resources}
          favoriteIdSet={favoriteIdSet}
          inventoryIdSet={inventoryIdSet}
          onBack={() => setSelectedOrg(null)}
        />
      ) : (
        <OrganizationList
          accessibleOrganizations={accessibleOrganizations}
          lockedOrganizations={lockedOrganizations}
          citizenIdRsiLinkEnabled={citizenIdRsiLinkEnabled}
          citizenIdBrandEnvironment={citizenIdBrandEnvironment}
          onSyncCitizenId={() => { linkRsiAccountWithCitizenId('/organizations'); }}
          onOpenOrg={(org) => setSelectedOrg(org.sid)}
        />
      )}
    </Box>
  );
}
