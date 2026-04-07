import { useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputAdornment from '@mui/material/InputAdornment';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FilterListOffOutlinedIcon from '@mui/icons-material/FilterListOffOutlined';
import HandymanOutlinedIcon from '@mui/icons-material/HandymanOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import { alpha, useTheme } from '@mui/material/styles';
import { useAuth } from '../auth/AuthContext';
import { useLocalPersist } from '../hooks/useLocalPersist';
import { useI18n } from '../i18n/I18nContext';
import { type AccountCraftRequestResourcesOption } from '../services/authService';
import { useCraft } from '../store/CraftContext';
import { CATEGORY_LABELS, LS_KEYS, type Blueprint, type ItemCategory, type ResourceInsight } from '../types';
import { computeStatMaxima, formatQualityLabel, formatResourceQuantity } from '../utils/crafting';
import { navigateToPath, resourcePathFromSlug } from '../utils/slug';
import { BlueprintCard, type BlueprintCardQuickAction } from './BlueprintGrid';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { ResourceAssetCard } from './resources/ResourceAssetCard';
import { FONT_HEADING } from '../theme';

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

type OrganizationAccordionLoadState =
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

type AccountOrganization = NonNullable<ReturnType<typeof useAuth>['account']>['organizations'][number];

function OrganizationBlueprintAccordion({
  organization,
  expanded,
  onExpandedChange,
  blueprintById,
  resourceInsightById,
  statMaxima,
  resources,
  favoriteIdSet,
  inventoryIdSet,
}: {
  organization: AccountOrganization;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  blueprintById: Map<string, Blueprint>;
  resourceInsightById: Map<string, ResourceInsight>;
  statMaxima: ReturnType<typeof computeStatMaxima>;
  resources: ReturnType<typeof useCraft>['activeDataset']['resources'];
  favoriteIdSet: Set<string>;
  inventoryIdSet: Set<string>;
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
  const [loadState, setLoadState] = useState<OrganizationAccordionLoadState>({ status: 'idle' });
  const [assetTab, setAssetTab] = useState<'blueprints' | 'resources'>('blueprints');
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

  useEffect(() => {
    let cancelled = false;

    if (!expanded) {
      setLoadState({ status: 'idle' });
      setAssetTab('blueprints');
      setBlueprintSearch('');
      setResourceSearch('');
      setCategoryFilter('all');
      setManufacturerFilter('all');
      setBlueprintOwnerFilter(null);
      setResourceOwnerFilter(null);
      setResourceQualityFilter('all');
      setNotice(null);
      setError(null);
      setRequestBusyKey(null);
      setCraftRequestDialog(null);
      return () => {
        cancelled = true;
      };
    }

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

        if (cancelled) {
          return;
        }

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
        if (cancelled) {
          return;
        }

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
  }, [
    blueprintById,
    expanded,
    loadOrganizationSharedBlueprints,
    loadOrganizationSharedResources,
    organization.sid,
    t,
  ]);

  const closeCraftRequestDialog = () => {
    if (requestBusyKey) {
      return;
    }
    setCraftRequestDialog(null);
  };

  const openCraftRequestDialog = (row: SharedBlueprintRow) => {
    setNotice(null);
    setError(null);
    setCraftRequestDialog({
      row,
      comment: '',
      resourcesOption: 'unspecified',
      error: null,
    });
  };

  const updateCraftRequestDialog = (
    updater: (current: CraftRequestDialogState) => CraftRequestDialogState,
  ) => {
    setCraftRequestDialog((current) => (current ? updater(current) : current));
  };

  const submitCraftRequest = () => {
    if (!craftRequestDialog) {
      return;
    }

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
  const sharedMemberCount = loadState.status === 'success' ? loadState.sharedMemberCount : null;
  const filteredBlueprintRows = useMemo(() => {
    const normalizedSearch = blueprintSearch.trim().toLowerCase();

    return blueprintRows.filter((row) => {
      if (normalizedSearch && !buildOrganizationBlueprintSearchHaystack(row).includes(normalizedSearch)) {
        return false;
      }
      if (categoryFilter !== 'all' && row.blueprint.category !== categoryFilter) {
        return false;
      }
      if (manufacturerFilter !== 'all' && row.blueprint.manufacturer !== manufacturerFilter) {
        return false;
      }
      if (
        blueprintOwnerFilter &&
        normalizeComparableText(row.ownerHandle) !== normalizeComparableText(blueprintOwnerFilter)
      ) {
        return false;
      }
      return true;
    });
  }, [blueprintOwnerFilter, blueprintRows, blueprintSearch, categoryFilter, manufacturerFilter]);

  const filteredResourceRows = useMemo(() => {
    const normalizedSearch = resourceSearch.trim().toLowerCase();

    return resourceRows.filter((row) => {
      if (normalizedSearch && !buildOrganizationResourceSearchHaystack(row).includes(normalizedSearch)) {
        return false;
      }
      if (
        resourceOwnerFilter &&
        normalizeComparableText(row.ownerHandle) !== normalizeComparableText(resourceOwnerFilter)
      ) {
        return false;
      }
      if (resourceQualityFilter === 'with-quality' && row.quality == null) {
        return false;
      }
      if (resourceQualityFilter === 'no-quality' && row.quality != null) {
        return false;
      }
      return true;
    });
  }, [resourceOwnerFilter, resourceQualityFilter, resourceRows, resourceSearch]);

  const manufacturerOptions = useMemo(
    () =>
      [...new Set(blueprintRows.map((row) => row.blueprint.manufacturer))]
        .filter(Boolean)
        .sort((left, right) =>
          left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true }),
        ),
    [blueprintRows],
  );
  const blueprintOwnerOptions = useMemo(
    () =>
      [...new Set(blueprintRows.map((row) => row.ownerHandle))]
        .filter(Boolean)
        .sort((left, right) =>
          left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true }),
        ),
    [blueprintRows],
  );
  const resourceOwnerOptions = useMemo(
    () =>
      [...new Set(resourceRows.map((row) => row.ownerHandle))]
        .filter(Boolean)
        .sort((left, right) =>
          left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true }),
        ),
    [resourceRows],
  );
  const categoryOptions = useMemo(
    () =>
      [...new Set(blueprintRows.map((row) => row.blueprint.category))]
        .filter(Boolean)
        .sort((left, right) =>
          left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true }),
        ),
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
  const { scrollContainerRef, sentinelRef, visibleCount, initialCount } = useInfiniteScroll(
    filteredBlueprintRows,
    { getColumns: organizationGridColumns },
  );

  return (
    <Accordion
      expanded={expanded}
      onChange={(_, nextExpanded) => onExpandedChange(nextExpanded)}
      disableGutters
      sx={{
        border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
        backgroundColor: alpha(theme.palette.background.paper, 0.94),
        '&::before': {
          display: 'none',
        },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{
          px: { xs: 1.25, md: 1.5 },
          py: 0.25,
          '& .MuiAccordionSummary-content': {
            my: 1.15,
          },
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.25}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          sx={{ width: '100%', minWidth: 0 }}
        >
          <Stack direction="row" spacing={1.15} alignItems="center" sx={{ minWidth: 0 }}>
            <Avatar
              src={organization.image ?? organization.logo ?? undefined}
              alt={organization.name}
              variant="rounded"
              sx={{
                width: 52,
                height: 52,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
              }}
            >
              {organization.name.charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                {organization.name}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  mt: 0.35,
                  color: 'text.secondary',
                  fontFamily: 'monospace',
                  letterSpacing: '0.04em',
                }}
              >
                {organization.sid}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            <Chip
              label={
                organization.status === 'verified_admin'
                  ? t('Verified admin', 'Admin verifie', 'Verifizierter Admin')
                  : t('Verified member', 'Membre verifie', 'Verifiziertes Mitglied')
              }
              size="small"
              color={organization.status === 'verified_admin' ? 'success' : 'info'}
              variant="outlined"
            />
            {loadState.status === 'success' && (
              <Chip
                label={t(
                  `${blueprintRows.length + resourceRows.length} shared entries`,
                  `${blueprintRows.length + resourceRows.length} entrees partagees`,
                  `${blueprintRows.length + resourceRows.length} geteilte Eintrage`,
                )}
                size="small"
                variant="outlined"
              />
            )}
            {organization.syncStatus === 'stale' && (
              <Chip
                label={t('Snapshot stale', 'Snapshot obsolete', 'Snapshot veraltet')}
                size="small"
                color="warning"
                variant="outlined"
              />
            )}
            {organization.blueprintSharingEnabled === false && (
              <Chip
                label={t('Sharing disabled', 'Partage desactive', 'Freigabe deaktiviert')}
                size="small"
                color="warning"
                variant="outlined"
              />
            )}
          </Stack>
        </Stack>
      </AccordionSummary>

      <AccordionDetails sx={{ px: { xs: 1.25, md: 1.5 }, pb: 1.5, pt: 0 }}>
        <Stack spacing={1.25}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
          >
            <Typography sx={{ color: 'text.secondary' }}>
              {t(
                'Filter shared organization entries by search or owner. Category and manufacturer filters apply to blueprints only.',
                'Filtre les entrees partagees de cette organisation par recherche ou proprietaire. Les filtres categorie et fabricant ne s appliquent qu aux blueprints.',
                'Filtere geteilte Organisationseintrage nach Suche oder Besitzer. Kategorie- und Herstellerfilter gelten nur fur Blueprints.',
              )}
            </Typography>
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
              {typeof sharedMemberCount === 'number' && sharedMemberCount > 0 && (
                <Chip
                  label={t(
                    `${sharedMemberCount} members`,
                    `${sharedMemberCount} membres`,
                    `${sharedMemberCount} Mitglieder`,
                  )}
                  size="small"
                  variant="outlined"
                />
              )}
            </Stack>
          </Stack>

          {notice && <Alert severity="success" variant="outlined">{notice}</Alert>}
          {error && <Alert severity="error" variant="outlined">{error}</Alert>}

          {loadState.status === 'loading' ? (
            <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress />
            </Box>
          ) : null}

          {loadState.status === 'error' ? (
            <Alert severity="error" variant="outlined">
              {loadState.error}
            </Alert>
          ) : null}

          {loadState.status === 'success' ? (
            <>
              <Paper
                variant="outlined"
                sx={{
                  p: 1.25,
                  borderColor: alpha(theme.palette.primary.main, 0.14),
                  backgroundColor: alpha(theme.palette.background.default, 0.24),
                }}
              >
                <Stack spacing={1.25}>
                  <Tabs
                    value={assetTab}
                    onChange={(_event, value: 'blueprints' | 'resources') => setAssetTab(value)}
                    variant="scrollable"
                    allowScrollButtonsMobile
                  >
                    <Tab
                      value="blueprints"
                      label={t(
                        `Blueprints (${blueprintRows.length})`,
                        `Blueprints (${blueprintRows.length})`,
                        `Blueprints (${blueprintRows.length})`,
                      )}
                    />
                    <Tab
                      value="resources"
                      label={t(
                        `Resources (${resourceRows.length})`,
                        `Ressources (${resourceRows.length})`,
                        `Ressourcen (${resourceRows.length})`,
                      )}
                    />
                  </Tabs>

                  {assetTab === 'blueprints' ? (
                    <Stack
                      direction={{ xs: 'column', lg: 'row' }}
                      spacing={1}
                      alignItems={{ xs: 'stretch', lg: 'center' }}
                    >
                      <TextField
                        size="small"
                        fullWidth
                        label={t('Search blueprints or owners', 'Rechercher blueprints ou proprietaires', 'Blueprints oder Besitzer suchen')}
                        value={blueprintSearch}
                        onChange={(event) => setBlueprintSearch(event.target.value)}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <SearchOutlinedIcon fontSize="small" />
                            </InputAdornment>
                          ),
                        }}
                      />
                      <TextField
                        select
                        size="small"
                        label={t('Category', 'Categorie', 'Kategorie')}
                        value={categoryFilter}
                        onChange={(event) =>
                          setCategoryFilter(event.target.value as 'all' | ItemCategory)
                        }
                        sx={{ minWidth: { xs: '100%', sm: 180 } }}
                      >
                        <MenuItem value="all">{t('All categories', 'Toutes les categories', 'Alle Kategorien')}</MenuItem>
                        {categoryOptions.map((category) => (
                          <MenuItem key={category} value={category}>
                            {CATEGORY_LABELS[category]
                              ? CATEGORY_LABELS[category][lang] ?? CATEGORY_LABELS[category].en
                              : category}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        select
                        size="small"
                        label={t('Manufacturer', 'Fabricant', 'Hersteller')}
                        value={manufacturerFilter}
                        onChange={(event) => setManufacturerFilter(event.target.value)}
                        sx={{ minWidth: { xs: '100%', sm: 180 } }}
                      >
                        <MenuItem value="all">{t('All manufacturers', 'Tous les fabricants', 'Alle Hersteller')}</MenuItem>
                        {manufacturerOptions.map((manufacturer) => (
                          <MenuItem key={manufacturer} value={manufacturer}>
                            {manufacturer}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        select
                        size="small"
                        label={t('Owner', 'Proprietaire', 'Besitzer')}
                        value={blueprintOwnerFilter ?? 'all'}
                        onChange={(event) =>
                          setBlueprintOwnerFilter(event.target.value === 'all' ? null : event.target.value)
                        }
                        sx={{ minWidth: { xs: '100%', sm: 180 } }}
                      >
                        <MenuItem value="all">{t('All owners', 'Tous les proprietaires', 'Alle Besitzer')}</MenuItem>
                        {blueprintOwnerOptions.map((ownerHandle) => (
                          <MenuItem key={ownerHandle} value={ownerHandle}>
                            {ownerHandle}
                          </MenuItem>
                        ))}
                      </TextField>
                      <Button
                        variant="outlined"
                        startIcon={<FilterListOffOutlinedIcon />}
                        onClick={() => {
                          setBlueprintSearch('');
                          setCategoryFilter('all');
                          setManufacturerFilter('all');
                          setBlueprintOwnerFilter(null);
                        }}
                        sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                      >
                        {t('Reset filters', 'Reinitialiser', 'Filter zurucksetzen')}
                      </Button>
                    </Stack>
                  ) : (
                    <Stack
                      direction={{ xs: 'column', lg: 'row' }}
                      spacing={1}
                      alignItems={{ xs: 'stretch', lg: 'center' }}
                    >
                      <TextField
                        size="small"
                        fullWidth
                        label={t('Search resources or owners', 'Rechercher ressources ou proprietaires', 'Ressourcen oder Besitzer suchen')}
                        value={resourceSearch}
                        onChange={(event) => setResourceSearch(event.target.value)}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <SearchOutlinedIcon fontSize="small" />
                            </InputAdornment>
                          ),
                        }}
                      />
                      <TextField
                        select
                        size="small"
                        label={t('Owner', 'Proprietaire', 'Besitzer')}
                        value={resourceOwnerFilter ?? 'all'}
                        onChange={(event) =>
                          setResourceOwnerFilter(event.target.value === 'all' ? null : event.target.value)
                        }
                        sx={{ minWidth: { xs: '100%', sm: 180 } }}
                      >
                        <MenuItem value="all">{t('All owners', 'Tous les proprietaires', 'Alle Besitzer')}</MenuItem>
                        {resourceOwnerOptions.map((ownerHandle) => (
                          <MenuItem key={ownerHandle} value={ownerHandle}>
                            {ownerHandle}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        select
                        size="small"
                        label={t('Quality', 'Qualite', 'Qualitat')}
                        value={resourceQualityFilter}
                        onChange={(event) =>
                          setResourceQualityFilter(event.target.value as 'all' | 'with-quality' | 'no-quality')
                        }
                        sx={{ minWidth: { xs: '100%', sm: 180 } }}
                      >
                        <MenuItem value="all">{t('All qualities', 'Toutes les qualites', 'Alle Qualitaten')}</MenuItem>
                        <MenuItem value="with-quality">{t('With quality', 'Avec qualite', 'Mit Qualitat')}</MenuItem>
                        <MenuItem value="no-quality">{t('No quality', 'Sans qualite', 'Ohne Qualitat')}</MenuItem>
                      </TextField>
                      <Button
                        variant="outlined"
                        startIcon={<FilterListOffOutlinedIcon />}
                        onClick={() => {
                          setResourceSearch('');
                          setResourceOwnerFilter(null);
                          setResourceQualityFilter('all');
                        }}
                        sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                      >
                        {t('Reset filters', 'Reinitialiser', 'Filter zurucksetzen')}
                      </Button>
                    </Stack>
                  )}
                </Stack>
              </Paper>

              {loadState.hiddenBlueprintCount > 0 && (
                <Alert severity="info" variant="outlined">
                  {t(
                    `${loadState.hiddenBlueprintCount} shared blueprint entries are hidden because they are not present in the currently loaded dataset.`,
                    `${loadState.hiddenBlueprintCount} entrees partagees sont masquees car elles ne sont pas presentes dans le dataset actuellement charge.`,
                    `${loadState.hiddenBlueprintCount} geteilte Blueprint-Eintrage sind ausgeblendet, weil sie im aktuell geladenen Datensatz fehlen.`,
                  )}
                </Alert>
              )}

              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {assetTab === 'blueprints' ? filteredBlueprintRows.length : filteredResourceRows.length}{' '}
                {t('visible shared entries', 'entrees partagees visibles', 'sichtbare geteilte Eintrage')}
              </Typography>

              {assetTab === 'blueprints' && filteredBlueprintRows.length === 0 ? (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 3,
                    textAlign: 'center',
                    color: 'text.secondary',
                  }}
                >
                  <Typography variant="body1" sx={{ mb: 0.75 }}>
                    {t(
                      'No shared blueprint matches the current filters.',
                      'Aucun blueprint partage ne correspond aux filtres actuels.',
                      'Kein geteilter Blueprint entspricht den aktuellen Filtern.',
                    )}
                  </Typography>
                  <Typography variant="body2">
                    {t(
                      'Try clearing the owner or manufacturer filter first.',
                      'Essaie d abord de retirer le filtre proprietaire ou fabricant.',
                      'Entferne zuerst den Besitzer- oder Herstellerfilter.',
                    )}
                  </Typography>
                </Paper>
              ) : assetTab === 'resources' && filteredResourceRows.length === 0 ? (
                <Paper
                  variant="outlined"
                  sx={{
                    p: 3,
                    textAlign: 'center',
                    color: 'text.secondary',
                  }}
                >
                  <Typography variant="body1" sx={{ mb: 0.75 }}>
                    {t(
                      'No shared resource matches the current filters.',
                      'Aucune ressource partagee ne correspond aux filtres actuels.',
                      'Keine geteilte Ressource entspricht den aktuellen Filtern.',
                    )}
                  </Typography>
                  <Typography variant="body2">
                    {t(
                      'Try clearing the owner or quality filter first.',
                      'Essaie d abord de retirer le filtre proprietaire ou qualite.',
                      'Entferne zuerst den Besitzer- oder Qualitatsfilter.',
                    )}
                  </Typography>
                </Paper>
              ) : (
                <Stack spacing={1.5}>
                  {assetTab === 'resources' && (
                    <Box
                      role="list"
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                          xs: '1fr',
                          md: 'repeat(2, minmax(0, 1fr))',
                          xl: 'repeat(3, minmax(0, 1fr))',
                        },
                        gap: { xs: 1.25, md: 1.5, xl: 2 },
                      }}
                    >
                      {filteredResourceRows.map((row) => (
                        <ResourceAssetCard
                          key={row.key}
                          resource={resourceById.get(row.resourceId) ?? null}
                          insight={resourceInsightById.get(row.resourceId) ?? null}
                          onOpen={() =>
                            navigateToPath(resourcePathFromSlug(row.resourceId), {
                              resourceId: row.resourceId,
                              mainView: 'resources',
                            })
                          }
                          title={row.resourceName}
                          owner={{
                            label: row.ownerDisplay || row.ownerHandle,
                            avatarSrc: row.ownerImage,
                            avatarAlt: row.ownerHandle,
                            supportingText: row.ownerRank
                              ? `${row.ownerHandle} • ${row.ownerRank}`
                              : row.ownerHandle,
                          }}
                          infoChips={[
                            {
                              label: formatResourceQuantity(row.quantity, row.quantityUnit, lang, 'long'),
                            },
                            {
                              label:
                                row.quality == null
                                  ? t('No quality', 'Sans qualite', 'Ohne Qualitat')
                                  : formatQualityLabel(row.quality, lang),
                              variant: 'outlined',
                            },
                          ]}
                        />
                      ))}
                    </Box>
                  )}

                  {assetTab === 'blueprints' && filteredBlueprintRows.length > 0 && (
                    <Box
                      ref={scrollContainerRef}
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                        maxHeight: { xs: '62vh', md: '68vh', lg: '72vh' },
                        overflow: 'auto',
                        pr: 0.5,
                      }}
                    >
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
                      const ownSharedBlueprint =
                        normalizeComparableText(row.ownerHandle) === currentUserRsiHandle;
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
                            `Afficher seulement les blueprints partages par ${row.ownerDisplay || row.ownerHandle}.`,
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
                            ? t(
                                'Craft request already pending',
                                'Demande de craft deja en attente',
                                'Craft-Anfrage bereits ausstehend',
                              )
                            : ownSharedBlueprint
                              ? t(
                                  'This is your own shared blueprint',
                                  'C est ton propre blueprint partage',
                                  'Dies ist dein eigener geteilter Blueprint',
                                )
                              : t(
                                  `Request a craft from ${row.ownerHandle}`,
                                  `Demander un craft a ${row.ownerHandle}`,
                                  `Einen Craft von ${row.ownerHandle} anfordern`,
                                ),
                          tooltip: requestAlreadyPending
                            ? t(
                                'A craft request is already pending for this owner and blueprint.',
                                'Une demande de craft est deja en attente pour ce proprietaire et ce blueprint.',
                                'Für diesen Besitzer und Blueprint ist bereits eine Craft-Anfrage ausstehend.',
                              )
                            : ownSharedBlueprint
                              ? t(
                                  'You already own and share this blueprint yourself.',
                                  'Tu possedes et partages deja toi-meme ce blueprint.',
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
                          onClick: () => {
                            openCraftRequestDialog(row);
                          },
                        },
                      ];

                      return (
                        <BlueprintCard
                          key={row.key}
                          blueprint={row.blueprint}
                          activeBlueprintId={activeBlueprint?.id ?? null}
                          isFavorite={favoriteIdSet.has(row.blueprint.id)}
                          isInInventory={inventoryIdSet.has(row.blueprint.id)}
                          extraQuickActions={extraQuickActions}
                          statMaxima={statMaxima}
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
              )}
            </>
          ) : null}
        </Stack>
      </AccordionDetails>
      <Dialog
        open={Boolean(craftRequestDialog)}
        onClose={closeCraftRequestDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {craftRequestDialog
            ? t(
                `Request craft from ${craftRequestDialog.row.ownerHandle}`,
                `Demander un craft a ${craftRequestDialog.row.ownerHandle}`,
                `Craft bei ${craftRequestDialog.row.ownerHandle} anfragen`,
              )
            : t('Request craft', 'Demander craft', 'Craft anfragen')}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {craftRequestDialog ? (
              <Alert severity="info" variant="outlined">
                {t(
                  `You are requesting ${craftRequestDialog.row.blueprint.name} from ${craftRequestDialog.row.ownerDisplay || craftRequestDialog.row.ownerHandle}.`,
                  `Tu demandes ${craftRequestDialog.row.blueprint.name} a ${craftRequestDialog.row.ownerDisplay || craftRequestDialog.row.ownerHandle}.`,
                  `Du fragst ${craftRequestDialog.row.blueprint.name} bei ${craftRequestDialog.row.ownerDisplay || craftRequestDialog.row.ownerHandle} an.`,
                )}
              </Alert>
            ) : null}

            {craftRequestDialog?.error ? (
              <Alert severity="error" variant="outlined">
                {craftRequestDialog.error}
              </Alert>
            ) : null}

            <TextField
              label={t('Comment (optional)', 'Commentaire (optionnel)', 'Kommentar (optional)')}
              value={craftRequestDialog?.comment ?? ''}
              onChange={(event) => {
                const nextComment = event.target.value;
                updateCraftRequestDialog((current) => ({
                  ...current,
                  comment: nextComment,
                  error: null,
                }));
              }}
              multiline
              minRows={4}
              placeholder={t(
                'Add useful details for the crafter.',
                'Ajoute des details utiles pour le crafteur.',
                'Fuge hilfreiche Details fur den Crafter hinzu.',
              )}
            />

            <Stack spacing={0.5}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {t('Resources', 'Ressources', 'Ressourcen')}
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={craftRequestDialog?.resourcesOption === 'has_resources'}
                    onChange={(event) => {
                      updateCraftRequestDialog((current) => ({
                        ...current,
                        resourcesOption: event.target.checked ? 'has_resources' : 'unspecified',
                        error: null,
                      }));
                    }}
                  />
                }
                label={t('I have the resources', 'J ai les ressources', 'Ich habe die Ressourcen')}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={craftRequestDialog?.resourcesOption === 'buy_resources'}
                    onChange={(event) => {
                      updateCraftRequestDialog((current) => ({
                        ...current,
                        resourcesOption: event.target.checked ? 'buy_resources' : 'unspecified',
                        error: null,
                      }));
                    }}
                  />
                }
                label={t(
                  'I will buy the resources',
                  'Je t achete les ressources',
                  'Ich kaufe dir die Ressourcen ab',
                )}
              />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {t(
                  'These options are mutually exclusive and will be shown in the app and in Discord.',
                  'Ces options sont exclusives et seront visibles dans l appli et sur Discord.',
                  'Diese Optionen schliessen sich gegenseitig aus und werden in der App und auf Discord angezeigt.',
                )}
              </Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            variant="outlined"
            onClick={closeCraftRequestDialog}
            disabled={Boolean(requestBusyKey)}
          >
            {t('Cancel', 'Annuler', 'Abbrechen')}
          </Button>
          <Button
            variant="contained"
            onClick={submitCraftRequest}
            disabled={!craftRequestDialog || Boolean(requestBusyKey)}
          >
            {requestBusyKey
              ? t('Sending...', 'Envoi...', 'Sende...')
              : t('Send request', 'Envoyer la demande', 'Anfrage senden')}
          </Button>
        </DialogActions>
      </Dialog>
    </Accordion>
  );
}

export function OrganizationsPage() {
  const { t } = useI18n();
  const theme = useTheme();
  const { account, syncStatus, syncError } = useAuth();
  const {
    blueprints,
    activeDataset,
    favoriteIds,
    inventoryIds,
  } = useCraft();
  const [accordionState, setAccordionState] = useLocalPersist<Record<string, boolean>>(
    LS_KEYS.ORGANIZATIONS_ACCORDIONS,
    {},
  );
  const blueprintById = useMemo(
    () => new Map(blueprints.map((blueprint) => [blueprint.id, blueprint])),
    [blueprints],
  );
  const statMaxima = useMemo(() => computeStatMaxima(blueprints), [blueprints]);
  const favoriteIdSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const inventoryIdSet = useMemo(() => new Set(inventoryIds), [inventoryIds]);
  const resources = activeDataset.resources;
  const resourceInsightById = useMemo(
    () => new Map((activeDataset.resourceInsights ?? []).map((insight) => [insight.resourceId, insight])),
    [activeDataset.resourceInsights],
  );

  const linkedOrganizations = account?.organizations ?? [];
  const accessibleOrganizations = linkedOrganizations.filter(
    (organization) =>
      organization.status === 'verified_member' || organization.status === 'verified_admin',
  );
  const lockedOrganizations = linkedOrganizations.filter(
    (organization) =>
      organization.status !== 'verified_member' && organization.status !== 'verified_admin',
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Box
        sx={{
          p: { xs: 1.25, sm: 1.5, md: 2 },
          borderBottom: 1,
          borderColor: 'divider',
          backgroundColor: 'background.paper',
        }}
      >
        <Stack spacing={1.25}>
          <Box>
            <Typography
              sx={{
                fontFamily: FONT_HEADING,
                fontWeight: 700,
                fontSize: { xs: '1.9rem', md: '2.2rem' },
                textTransform: 'uppercase',
                lineHeight: 1,
              }}
            >
              {t('Organizations', 'Organisations', 'Organisationen')}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75, maxWidth: 900 }}>
              {t(
                'Browse blueprints and resources shared by verified members of your linked RSI organizations. Each organization section stays unloaded until its accordion is opened.',
                'Parcours les blueprints et ressources partages par les membres verifies de tes organisations RSI liees. Chaque section d organisation reste dechargee tant que son accordeon n est pas ouvert.',
                'Durchsuche Blueprints und Ressourcen, die von verifizierten Mitgliedern deiner verknupften RSI-Organisationen geteilt werden. Jeder Organisationsbereich bleibt entladen, bis sein Akkordeon geoffnet wird.',
              )}
            </Typography>
          </Box>

          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            <Chip
              label={t(
                `${accessibleOrganizations.length} accessible organizations`,
                `${accessibleOrganizations.length} organisations accessibles`,
                `${accessibleOrganizations.length} zugangliche Organisationen`,
              )}
              size="small"
              variant="outlined"
            />
            <Chip
              label={t(
                `${linkedOrganizations.length} linked total`,
                `${linkedOrganizations.length} liees au total`,
                `${linkedOrganizations.length} insgesamt liees`,
              )}
              size="small"
              variant="outlined"
            />
          </Stack>
        </Stack>
      </Box>

      <Box
        sx={{
          p: { xs: 1.25, sm: 1.5, md: 2, xl: 3 },
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
        }}
        >
          {syncError && (
            <Alert severity="error" variant="outlined">
              {syncError}
            </Alert>
          )}

          {(syncStatus === 'pending' || syncStatus === 'syncing') && (
            <Alert severity="info" variant="outlined">
              {t(
                'Cloud changes are still syncing. Newly shared blueprints and craft request updates may take a moment to settle.',
                'Les changements cloud se synchronisent encore. Les blueprints fraichement partages et les mises a jour de demandes de craft peuvent prendre un court instant.',
                'Cloud-Anderungen werden noch synchronisiert. Neu geteilte Blueprints und Craft-Anfragen konnen einen kurzen Moment brauchen.',
              )}
            </Alert>
          )}

          {!account?.rsi?.handle && (
            <Alert severity="info" variant="outlined">
              {t(
              'Link an RSI account first from the account page to access organization-shared blueprints and resources.',
              'Lie d abord un compte RSI depuis la page compte pour acceder aux blueprints et ressources partages d organisation.',
              'Verknupfe zuerst auf der Kontoseite ein RSI-Konto, um auf organisationsgeteilte Blueprints und Ressourcen zuzugreifen.',
            )}
          </Alert>
        )}

        {accessibleOrganizations.length === 0 ? (
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              textAlign: 'center',
              color: 'text.secondary',
            }}
          >
            <Typography variant="h6" sx={{ mb: 0.75 }}>
              {t(
                'No verified organizations are ready yet',
                'Aucune organisation verifiee n est encore prete',
                'Noch keine verifizierten Organisationen verfugbar',
              )}
            </Typography>
            <Typography variant="body2">
              {t(
                'As soon as an organization membership is verified and shared entries exist, it will appear here with its own lazy-loaded section.',
                'Des qu une appartenance a une organisation est verifiee et que des entrees partagees existent, elle apparaitra ici avec sa propre section lazy-load.',
                'Sobald eine Organisationsmitgliedschaft verifiziert ist und geteilte Eintrage existieren, erscheint sie hier mit ihrem eigenen lazy geladenen Bereich.',
              )}
            </Typography>
          </Paper>
        ) : (
          accessibleOrganizations.map((organization) => (
            <OrganizationBlueprintAccordion
              key={organization.sid}
              organization={organization}
              expanded={Boolean(accordionState[organization.sid])}
              blueprintById={blueprintById}
              resourceInsightById={resourceInsightById}
              statMaxima={statMaxima}
              resources={resources}
              favoriteIdSet={favoriteIdSet}
              inventoryIdSet={inventoryIdSet}
              onExpandedChange={(expanded) => {
                setAccordionState((currentState) => ({
                  ...currentState,
                  [organization.sid]: expanded,
                }));
              }}
            />
          ))
        )}

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
                  'Liees mais pas encore accessibles',
                  'Verknupft, aber noch nicht verfugbar',
                )}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {t(
                  'These organizations are linked to the account, but their shared entries stay locked until the membership is verified in the app snapshot.',
                  'Ces organisations sont bien liees au compte, mais leurs entrees partagees restent verrouillees tant que l appartenance n est pas verifiee dans le snapshot de l appli.',
                  'Diese Organisationen sind mit dem Konto verknupft, aber ihre geteilten Eintrage bleiben gesperrt, bis die Mitgliedschaft im App-Snapshot verifiziert ist.',
                )}
              </Typography>
              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                {lockedOrganizations.map((organization) => (
                  <Chip
                    key={organization.sid}
                    label={`${organization.name} (${organization.sid})`}
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Stack>
            </Stack>
          </Paper>
        )}
      </Box>
    </Box>
  );
}
