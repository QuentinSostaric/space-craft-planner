import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useI18n } from '../../i18n/I18nContext';
import type { Blueprint } from '../../types';
import { isResourceSlot } from '../../utils/crafting';

interface DismantleSectionProps {
  blueprint: Blueprint;
  dismantleTimeSecs: number;
  efficiency: number;
  perItemYieldModelResolved: boolean;
}

export function DismantleSection({ blueprint, dismantleTimeSecs, efficiency, perItemYieldModelResolved }: DismantleSectionProps) {
  const { t } = useI18n();
  const resourceSlots = blueprint.slots.filter(isResourceSlot);

  return (
    <Box component="section" aria-label={t('Dismantling', 'Démontage')} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="overline" sx={{ display: 'block' }}>
        {t('Dismantling', 'Démontage')}
      </Typography>

      {!perItemYieldModelResolved ? (
        <Typography variant="body2" sx={{ color: 'text.disabled' }}>
          {t('Yield data per item unavailable', 'Données de rendement par objet indisponibles')}
        </Typography>
      ) : resourceSlots.length === 0 ? (
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
            {resourceSlots.map((slot) => {
              const effectiveQty = slot.quantityScu * (slot.quantityMultiplier ?? 1);
              const recovered = effectiveQty * efficiency;
              return (
                <TableRow key={slot.id}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
