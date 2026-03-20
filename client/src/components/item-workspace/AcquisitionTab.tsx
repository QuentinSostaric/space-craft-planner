import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Typography from '@mui/material/Typography';
import { useI18n } from '../../i18n/I18nContext';
import { formatLocations, formatScaleLabel, formatStanding } from '../../utils/crafting';
import type { MissionContract } from '../../types';

interface AcquisitionTabProps {
  contracts: MissionContract[];
  loading: boolean;
}

export function AcquisitionTab({ contracts, loading }: AcquisitionTabProps) {
  const { lang, t } = useI18n();

  if (loading) {
    return (
      <Box sx={{ p: 2, color: 'text.secondary' }}>
        <Typography>{t('Loading mission data...', 'Chargement des missions...')}</Typography>
      </Box>
    );
  }

  if (contracts.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
        <Typography>{t('No known contract reward for this blueprint.', 'Aucune recompense de contrat connue pour ce blueprint.')}</Typography>
      </Box>
    );
  }

  return (
    <List disablePadding>
      {contracts.map((contract) => (
        <ListItem
          key={`${contract.contractFile ?? ''}-${contract.contractDebugName ?? ''}`}
          sx={{ flexDirection: 'column', alignItems: 'stretch', py: 1, borderBottom: 1, borderColor: 'divider' }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '.78rem' }}>
              {contract.contractDebugName ?? 'Unknown contract'}
            </Typography>
            <Chip
              label={formatScaleLabel(contract.availability.derivedScale, lang)}
              size="small"
              variant="outlined"
              color="primary"
              sx={{ fontSize: '.58rem', height: 20 }}
            />
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '.68rem' }}>
            {contract.contractorDisplayName ?? contract.faction?.displayName ?? 'Unknown'}{' — '}{formatLocations(contract, lang)}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '.68rem' }}>
            {formatStanding(contract, lang)}
          </Typography>
        </ListItem>
      ))}
    </List>
  );
}
