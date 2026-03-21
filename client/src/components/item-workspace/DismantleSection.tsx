import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useI18n } from '../../i18n/I18nContext';
import { ResourceIcon } from '../ui/ResourceIcon';
import type { Blueprint } from '../../types';

interface DismantleSectionProps {
  blueprint: Blueprint;
  dismantleTimeSecs: number;
  efficiency: number;
}

export function DismantleSection({ blueprint, dismantleTimeSecs, efficiency }: DismantleSectionProps) {
  const { t } = useI18n();

  return (
    <Box component="section" aria-label={t('Dismantling', 'Démontage')} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="overline" sx={{ display: 'block' }}>
        {t('Dismantling', 'Démontage')}
      </Typography>

      {blueprint.slots.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.disabled' }}>
          {t('No materials', 'Aucun matériau')}
        </Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('Material', 'Matériau')}</TableCell>
              <TableCell align="right">{t('Recovered', 'Récupéré')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {blueprint.slots.map((slot) => {
              const effectiveQty = slot.quantityScu * (slot.quantityMultiplier ?? 1);
              const recovered = effectiveQty * efficiency;
              return (
                <TableRow key={slot.id}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ResourceIcon name={slot.requiredResource} size={14} />
                      <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                        {slot.requiredResource}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.85rem' }}>
                      {recovered.toFixed(2)} SCU
                    </Typography>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
        {Math.round(efficiency * 100)}% {t('recovery', 'récupération')} · {dismantleTimeSecs}s {t('per job', 'par job')}
      </Typography>
    </Box>
  );
}
