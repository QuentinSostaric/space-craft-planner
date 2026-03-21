import { useEffect } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useCraft } from '../../store/CraftContext';
import { useI18n } from '../../i18n/I18nContext';
import { formatScaleLabel } from '../../utils/crafting';
import type { ResourceMethod } from '../../types';

interface ResourceMethodDetailProps {
  resourceName: string;
  method: ResourceMethod;
}

export function ResourceMethodDetail({ resourceName, method }: ResourceMethodDetailProps) {
  const { missionRewards, missionRewardsLoading, ensureMissionRewardsLoaded } = useCraft();
  const { lang, t } = useI18n();

  useEffect(() => {
    if (method === 'mission') {
      void ensureMissionRewardsLoaded();
    }
  }, [method, ensureMissionRewardsLoaded]);

  if (method === 'mining') {
    return (
      <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
        {t('⛏ Manual collection — move the slider or type the quantity collected.', '⛏ Collecte manuelle — déplacez le slider ou saisissez la quantité récoltée.')}
      </Typography>
    );
  }

  if (method === 'dismantle') {
    return (
      <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
        {t('🔧 Recovered by dismantling — enter the quantity obtained.', '🔧 Récupération par démantèlement — saisir la quantité obtenue.')}
      </Typography>
    );
  }

  if (method === 'buy') {
    return (
      <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
        {t('🛒 Purchase from shop or terminal — enter the quantity bought.', '🛒 Achat en magasin ou terminal — saisir la quantité achetée.')}
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

  const nameNorm = resourceName.trim().toLowerCase();
  const matchingContracts: Array<{ contractDebugName: string | null; contractorDisplayName: string | null; derivedScale: string; localities: string[] }> = [];

  for (const group of missionRewards?.factionGroups ?? []) {
    for (const contract of group.contracts) {
      const hasObjective = contract.resourceObjectives.some(
        (obj) => obj.displayName.trim().toLowerCase() === nameNorm,
      );
      if (hasObjective) {
        matchingContracts.push({
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
            secondary={[contract.contractorDisplayName, ...contract.localities].filter(Boolean).join(' · ')}
            slotProps={{
              primary: { sx: { fontSize: '0.75rem', fontWeight: 600 } },
              secondary: { sx: { fontSize: '0.65rem' } },
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
