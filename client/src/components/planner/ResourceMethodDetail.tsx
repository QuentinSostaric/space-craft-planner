import { useEffect, useMemo } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useCraft } from '../../store/CraftContext';
import { useI18n } from '../../i18n/I18nContext';
import { StarCitizenLicensedIcon, getLocationIconName, getMaterialProviderIconName } from '../ui/StarCitizenLicensedIcon';
import { formatScaleLabel, getMaterialProviders } from '../../utils/crafting';
import type { ResourceMethod } from '../../types';

interface ResourceMethodDetailProps {
  resourceName: string;
  method: ResourceMethod;
}

export function ResourceMethodDetail({ resourceName, method }: ResourceMethodDetailProps) {
  const { missionRewards, missionRewardsLoading, ensureMissionRewardsLoaded, materialSources } = useCraft();
  const { lang, t } = useI18n();

  const miningProviders = getMaterialProviders(materialSources, resourceName);

  useEffect(() => {
    if (method === 'mission') {
      void ensureMissionRewardsLoaded();
    }
  }, [method, ensureMissionRewardsLoaded]);

  if (method === 'mining') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <StarCitizenLicensedIcon name="asteroid" size={14} dimmed />
          <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
            {t('Manual collection — move the slider or type the quantity collected.', 'Collecte manuelle — déplacez le slider ou saisissez la quantité récoltée.')}
          </Typography>
        </Box>
        {miningProviders.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {miningProviders.slice(0, 5).map((provider, index) => {
              const iconName = getMaterialProviderIconName(
                provider.providerType,
                provider.providerDisplayName,
                provider.system,
              );

              return (
                <Chip
                  key={`${provider.providerDisplayName}-${index}`}
                  size="small"
                  variant="outlined"
                  icon={iconName ? <StarCitizenLicensedIcon name={iconName} size={12} dimmed /> : undefined}
                  label={provider.providerDisplayName}
                  sx={{ fontSize: '0.62rem', height: 20 }}
                />
              );
            })}
            {miningProviders.length > 5 && (
              <Chip
                size="small"
                variant="outlined"
                label={`+${miningProviders.length - 5}`}
                sx={{ fontSize: '0.62rem', height: 20 }}
              />
            )}
          </Box>
        )}
      </Box>
    );
  }

  if (method === 'dismantle') {
    return (
      <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
        {t('Recovered by dismantling — enter the quantity obtained.', 'Récupération par démantèlement — saisir la quantité obtenue.')}
      </Typography>
    );
  }

  if (method === 'buy') {
    return (
      <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
        {t('Purchase from shop or terminal — enter the quantity bought.', 'Achat en magasin ou terminal — saisir la quantité achetée.')}
      </Typography>
    );
  }

  // method === 'mission'
  if (missionRewardsLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Skeleton variant="rectangular" height={20} sx={{ borderRadius: 0.5 }} />
        <Skeleton variant="rectangular" height={20} sx={{ borderRadius: 0.5 }} />
      </Box>
    );
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const matchingContracts = useMemo(() => {
    const resourceIdNorm = resourceName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const results: Array<{ contractDebugName: string | null; contractorDisplayName: string | null; derivedScale: string; localities: string[] }> = [];
    for (const group of missionRewards?.factionGroups ?? []) {
      for (const contract of group.contracts) {
        const hasObjective = contract.resourceObjectives.some(
          (obj) => obj.resourceId === resourceIdNorm,
        );
        if (hasObjective) {
          results.push({
            contractDebugName: contract.contractDebugName,
            contractorDisplayName: group.contractorDisplayName,
            derivedScale: contract.availability.derivedScale,
            localities: contract.availability.localities.length > 0
              ? contract.availability.localities
              : contract.availability.explicitLocations,
          });
        }
      }
    }
    return results;
  }, [method, missionRewards, resourceName]);

  if (matchingContracts.length === 0) {
    return (
      <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
        {t('No contract found with this resource objective in the current dataset.', 'Aucun contrat trouvé avec cet objectif dans le dataset actuel.')}
      </Typography>
    );
  }

  return (
    <List dense disablePadding>
      {matchingContracts.map((contract, i) => (
        <ListItem key={i} disableGutters sx={{ py: 0.25, gap: 1 }}>
          <ListItemText
            primary={contract.contractDebugName ?? t('Unknown contract', 'Contrat inconnu')}
            secondary={
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                {contract.contractorDisplayName && (
                  <Typography component="span" variant="caption" sx={{ fontSize: '0.65rem' }}>
                    {contract.contractorDisplayName}
                  </Typography>
                )}
                {contract.localities.slice(0, 2).map((location) => {
                  const iconName = getLocationIconName(location);
                  return (
                    <Chip
                      key={location}
                      size="small"
                      variant="outlined"
                      icon={iconName ? <StarCitizenLicensedIcon name={iconName} size={12} dimmed /> : undefined}
                      label={location}
                      sx={{ fontSize: '0.6rem', height: 18 }}
                    />
                  );
                })}
              </Box>
            }
            slotProps={{
              primary: { sx: { fontSize: '0.75rem', fontWeight: 600 } },
              secondary: { component: 'div', sx: { fontSize: '0.65rem' } },
            }}
          />
          <Chip
            label={formatScaleLabel(contract.derivedScale, lang)}
            size="small"
            variant="outlined"
            color="primary"
            sx={{ fontSize: '0.6rem', height: 18, flexShrink: 0 }}
          />
        </ListItem>
      ))}
    </List>
  );
}
