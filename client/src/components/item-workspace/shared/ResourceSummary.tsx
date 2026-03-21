import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import { useI18n } from '../../../i18n/I18nContext';
import { ResourceIcon } from '../../ui/ResourceIcon';
import { summarizeAssignedQualities } from '../../../utils/crafting';
import type { AggregatedResource } from '../../../types';

export function ResourceSummary({ entries }: { entries: AggregatedResource[] }) {
  const { lang, t } = useI18n();
  if (entries.length === 0) return null;
  return (
    <Box component="section">
      <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: "'Khand', sans-serif", mb: 0.5, fontSize: '.85rem' }}>
        {t('Required Resources', 'Ressources necessaires')}
      </Typography>
      <List dense disablePadding aria-label={t('Required resources', 'Ressources necessaires')}>
        {entries.map((entry) => (
          <ListItem key={entry.resourceName} disablePadding sx={{ py: 0.25 }}>
            <ListItemIcon sx={{ minWidth: 28 }}>
              <ResourceIcon name={entry.resourceName} size={16} />
            </ListItemIcon>
            <ListItemText
              primary={entry.resourceName}
              secondary={summarizeAssignedQualities(entry.assignedQualityValues, entry.unassignedSlotCount, lang)}
              slotProps={{
                primary: { variant: 'body2', sx: { fontSize: '0.85rem' } },
                secondary: { variant: 'caption', sx: { fontSize: '0.75rem' } },
              }}
            />
            <Typography variant="caption" sx={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.75rem', ml: 1, flexShrink: 0 }}>
              ×{entry.totalScu.toFixed(2)} SCU
            </Typography>
          </ListItem>
        ))}
      </List>
    </Box>
  );
}
