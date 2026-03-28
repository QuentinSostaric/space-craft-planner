import { useEffect, useMemo } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import FlagIcon from '@mui/icons-material/Flag';
import MilitaryTechOutlinedIcon from '@mui/icons-material/MilitaryTechOutlined';
import TravelExploreOutlinedIcon from '@mui/icons-material/TravelExploreOutlined';
import { alpha } from '@mui/material/styles';
import { useCraft } from '../../store/CraftContext';
import { useI18n } from '../../i18n/I18nContext';
import {
  formatMaterialProviderConfidence,
  formatMaterialProviderType,
  formatMaterialSourceMethod,
  formatMineableGroupName,
  formatScaleLabel,
  getMissionContractName,
  getMaterialProviderProbabilityPct,
  getMaterialProviders,
} from '../../utils/crafting';
import { missionPathFromSlug, missionSlugFromContract, navigateToPath } from '../../utils/slug';
import type { ResourceMethod } from '../../types';
import { DatasetTooOldNotice } from '../ui/DatasetTooOldNotice';
import {
  StarCitizenLicensedIcon,
  getLocationIconName,
  getMaterialProviderIconName,
} from '../ui/StarCitizenLicensedIcon';

interface ResourceMethodDetailProps {
  resourceName: string;
  method: ResourceMethod;
}

type MissionActivityKind = 'combat' | 'recovery' | 'objective';

function getMissionActivityKind(
  contractDebugName: string | null,
  handlerDebugName: string | null,
  hasResourceObjectives: boolean,
): MissionActivityKind {
  if (hasResourceObjectives) {
    return 'objective';
  }

  const haystack = `${contractDebugName ?? ''} ${handlerDebugName ?? ''}`.toLowerCase();
  if (/(eliminate|kill|clear|bounty|assassinate|hunt|hostile|combat)/.test(haystack)) {
    return 'combat';
  }
  if (/(retrieve|recover|search|investigate|survey|locate|blackbox|explore)/.test(haystack)) {
    return 'recovery';
  }

  return 'objective';
}

function MissionActivityIcon({ kind }: { kind: MissionActivityKind }) {
  switch (kind) {
    case 'combat':
      return <MilitaryTechOutlinedIcon sx={{ fontSize: '0.95rem' }} />;
    case 'recovery':
      return <TravelExploreOutlinedIcon sx={{ fontSize: '0.95rem' }} />;
    case 'objective':
    default:
      return <FlagIcon sx={{ fontSize: '0.95rem' }} />;
  }
}

export function ResourceMethodDetail({ resourceName, method }: ResourceMethodDetailProps) {
  const {
    missionRewards,
    missionRewardsLoading,
    ensureMissionRewardsLoaded,
    ensureFactionContractsLoaded,
    factionContractsByFactionId,
    factionContractsLoadingIds,
    materialSources,
    ensureResourceDataLoaded,
    resourceDataLoading,
    activeDataset,
  } = useCraft();
  const { lang, t } = useI18n();
  const miningProviders = getMaterialProviders(materialSources, resourceName);
  const hasMaterialSourceDataset = Boolean(materialSources?.resources || activeDataset.hasResourceData);

  const resourceIdNorm = resourceName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  // Faction IDs that have resource-objective contracts for this resource,
  // derived from the pre-built index in the slim chunk.
  const relevantFactionIds = useMemo(() => {
    if (method !== 'mission' || !missionRewards) return [];
    return missionRewards.resourceObjectiveIndex?.[resourceIdNorm] ?? [];
  }, [method, missionRewards, resourceIdNorm]);

  useEffect(() => {
    if (method === 'mission') {
      void ensureMissionRewardsLoaded();
    }
    if (method === 'mining') {
      void ensureResourceDataLoaded();
    }
  }, [method, ensureMissionRewardsLoaded, ensureResourceDataLoaded]);

  // Load only the factions that have contracts for this resource.
  useEffect(() => {
    if (method !== 'mission') return;
    for (const factionId of relevantFactionIds) {
      void ensureFactionContractsLoaded(factionId);
    }
  }, [method, relevantFactionIds, ensureFactionContractsLoaded]);

  const matchingContracts = useMemo(() => {
    if (method !== 'mission' || !missionRewards) return [];

    const results: Array<{ contract: typeof factionContractsByFactionId[string][number]; group: typeof missionRewards.factionGroups[number] }> = [];

    for (const group of missionRewards.factionGroups) {
      // New datasets: use per-faction loaded contracts.
      // Old datasets (backward compat): fall back to embedded contracts.
      const contracts = factionContractsByFactionId[group.id] ?? group.contracts ?? [];
      for (const contract of contracts) {
        const hasObjective = contract.resourceObjectives.some(
          (objective) => objective.resourceId === resourceIdNorm,
        );
        if (hasObjective) {
          results.push({ contract, group });
        }
      }
    }

    return results;
  }, [method, missionRewards, factionContractsByFactionId, resourceIdNorm]);

  const relevantFactionsLoading = relevantFactionIds.some((id) => factionContractsLoadingIds.has(id));

  if (method === 'mining') {
    const mineableGroups = [
      ...new Set(
        miningProviders
          .map((provider) => provider.mineableGroupName)
          .filter((groupName): groupName is string => Boolean(groupName)),
      ),
    ].sort((left, right) => left.localeCompare(right));

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <StarCitizenLicensedIcon name="asteroid" size={14} dimmed />
          <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
            {t(
              'Manual collection. Enter what you gathered.',
              'Collecte manuelle. Saisissez ce que vous avez recolte.',
            )}
          </Typography>
        </Box>
        {!hasMaterialSourceDataset ? (
          <DatasetTooOldNotice variant="caption" />
        ) : resourceDataLoading && !materialSources?.resources ? (
          <Skeleton variant="rectangular" height={20} sx={{ borderRadius: 0.5 }} />
        ) : miningProviders.length === 0 ? (
          <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
            {t(
              'No mining source data available in the current dataset.',
              'Aucune source de minage disponible dans le dataset actuel.',
            )}
          </Typography>
        ) : (
          <>
            <Table size="small" aria-label={resourceName}>
              <TableHead>
                <TableRow>
                  <TableCell>{t('Provider', 'Fournisseur')}</TableCell>
                  <TableCell>{t('Method', 'Methode')}</TableCell>
                  <TableCell>{t('Type', 'Type')}</TableCell>
                  <TableCell>{t('System', 'Systeme')}</TableCell>
                  <TableCell>{t('Share', 'Part')}</TableCell>
                  <TableCell>{t('Tier', 'Tier')}</TableCell>
                  <TableCell>{t('Confidence', 'Confiance')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {miningProviders.map((provider, index) => {
                  const iconName = getMaterialProviderIconName(
                    provider.providerType,
                    provider.providerDisplayName,
                    provider.system,
                  );
                  const providerProbabilityPct = getMaterialProviderProbabilityPct(provider);

                  return (
                    <TableRow key={`${provider.providerDisplayName}-${index}`}>
                      <TableCell>
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                          {iconName && <StarCitizenLicensedIcon name={iconName} size={14} dimmed />}
                          <span>{provider.providerDisplayName}</span>
                        </Box>
                      </TableCell>
                      <TableCell>{formatMaterialSourceMethod(provider.sourceMethod, lang)}</TableCell>
                      <TableCell>{formatMaterialProviderType(provider.providerType, lang)}</TableCell>
                      <TableCell>{provider.system ?? '-'}</TableCell>
                      <TableCell>{providerProbabilityPct != null ? `${providerProbabilityPct}%` : '-'}</TableCell>
                      <TableCell>{provider.tier ?? '-'}</TableCell>
                      <TableCell>{formatMaterialProviderConfidence(provider.labelConfidence, lang)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {mineableGroups.length > 0 && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {t('Groups', 'Groupes')}: {mineableGroups.map((groupName) => formatMineableGroupName(groupName)).join(', ')}
              </Typography>
            )}
          </>
        )}
      </Box>
    );
  }

  if (method === 'dismantle') {
    return (
      <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
        {t(
          'Recovered by dismantling. Enter what you got.',
          'Recupere par demantelement. Saisissez ce que vous avez obtenu.',
        )}
      </Typography>
    );
  }

  if (method === 'buy') {
    return (
      <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
        {t(
          'Bought from a shop or terminal. Enter what you bought.',
          'Achete en magasin ou terminal. Saisissez ce que vous avez achete.',
        )}
      </Typography>
    );
  }

  if (missionRewardsLoading || relevantFactionsLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Skeleton variant="rectangular" height={20} sx={{ borderRadius: 0.5 }} />
        <Skeleton variant="rectangular" height={20} sx={{ borderRadius: 0.5 }} />
      </Box>
    );
  }

  if (!missionRewards) {
    return <DatasetTooOldNotice variant="caption" />;
  }

  if (matchingContracts.length === 0) {
    return (
      <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
        {t(
          'No contract found with this resource objective in the current dataset.',
          'Aucun contrat trouve avec cet objectif ressource dans le dataset actuel.',
        )}
      </Typography>
    );
  }

  return (
    <List dense disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {matchingContracts.map(({ contract, group }, index) => {
        const missionName =
          getMissionContractName(contract) || t('Unknown contract', 'Contrat inconnu');
        const factionName =
          contract.faction?.displayName ??
          group.faction?.displayName ??
          contract.contractorDisplayName ??
          group.contractorDisplayName;
        const activityKind = getMissionActivityKind(
          contract.contractDebugName,
          contract.handlerDebugName,
          contract.resourceObjectives.length > 0,
        );
        const activityLabel =
          activityKind === 'combat'
            ? t('Combat', 'Combat')
            : activityKind === 'recovery'
              ? t('Recovery', 'Recuperation')
              : t('Objective', 'Objectif');
        const missionSlug = missionSlugFromContract(
          contract.contractDebugName,
          group.contractorDisplayName,
        );
        const localities =
          contract.availability.localities.length > 0
            ? contract.availability.localities
            : contract.availability.explicitLocations;

        return (
          <ListItem key={contract.contractDebugName ?? `${group.contractorDisplayName}-${index}`} disablePadding>
            <ListItemButton
              onClick={() => {
                navigateToPath(missionPathFromSlug(missionSlug), { missionSlug, mainView: 'missions' });
              }}
              sx={{
                alignItems: 'flex-start',
                px: 1,
                py: 0.9,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                '&:hover': {
                  borderColor: 'primary.main',
                  backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.06),
                },
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                  {missionName}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center', mt: 0.65 }}>
                  {factionName && (
                    <Chip
                      label={factionName}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.6rem', height: 18 }}
                    />
                  )}
                  <Chip
                    icon={<MissionActivityIcon kind={activityKind} />}
                    label={activityLabel}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.6rem', height: 18 }}
                  />
                  <Chip
                    label={formatScaleLabel(contract.availability.derivedScale, lang)}
                    size="small"
                    variant="outlined"
                    color="primary"
                    sx={{ fontSize: '0.6rem', height: 18 }}
                  />
                </Box>
                {localities.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center', mt: 0.65 }}>
                    {localities.slice(0, 2).map((location) => {
                      const iconName = getLocationIconName(location);
                      return (
                        <Chip
                          key={location}
                          size="small"
                          variant="outlined"
                          icon={
                            iconName ? <StarCitizenLicensedIcon name={iconName} size={12} dimmed /> : undefined
                          }
                          label={location}
                          sx={{ fontSize: '0.6rem', height: 18 }}
                        />
                      );
                    })}
                  </Box>
                )}
              </Box>
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );
}
