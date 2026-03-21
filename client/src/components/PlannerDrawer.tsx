import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { PlannerPanel } from './PlannerPanel';

export function PlannerDrawer() {
  const { plannerOpen, closePlanner } = useCraft();
  const { t } = useI18n();

  return (
    <Drawer
      anchor="right"
      open={plannerOpen}
      onClose={closePlanner}
      aria-label={t('Planner', 'Planificateur')}
      slotProps={{
        paper: {
          sx: {
            width: { xs: '100%', sm: 400 },
            display: 'flex',
            flexDirection: 'column',
          },
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Typography
          variant="h6"
          sx={{
            letterSpacing: '0.06em',
            fontSize: '1.1rem',
          }}
        >
          {t('Planner', 'Planificateur')}
        </Typography>
        <IconButton
          onClick={closePlanner}
          aria-label={t('Close planner', 'Fermer le planificateur')}
          size="small"
        >
          ✕
        </IconButton>
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <PlannerPanel />
      </Box>
    </Drawer>
  );
}
