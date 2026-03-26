import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useI18n } from '../../i18n/I18nContext';
import type { AggregatedResource, Blueprint } from '../../types';
import { formatResourceQuantity, summarizeAssignedQualities } from '../../utils/crafting';
import { DatasetTooOldNotice } from '../ui/DatasetTooOldNotice';

interface DismantleSectionProps {
  blueprint: Blueprint;
  resources: AggregatedResource[];
  dismantleTimeSecs: number;
  efficiency: number;
}

export function DismantleSection({
  blueprint,
  resources,
  dismantleTimeSecs,
  efficiency,
}: DismantleSectionProps) {
  const { t, lang } = useI18n();

  return (
    <Box
      component="section"
      aria-label={t('Dismantling', 'Demontage')}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}
    >
      <Typography variant="overline" sx={{ display: 'block' }}>
        {t('Dismantling', 'Demontage')}
      </Typography>

      {dismantleTimeSecs <= 0 ? (
        <DatasetTooOldNotice />
      ) : resources.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.disabled' }}>
          {t('No materials', 'Aucun materiau')}
        </Typography>
      ) : (
        <Table size="small" aria-label={blueprint.name}>
          <TableHead>
            <TableRow>
              <TableCell>{t('Material', 'Materiau')}</TableCell>
              <TableCell align="right">{t('Recovered', 'Recupere')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {resources.map((resource) => {
              const recovered = resource.totalScu * efficiency;

              return (
                <TableRow key={resource.resourceName}>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2 }}>
                      <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                        {resource.resourceName}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                        {summarizeAssignedQualities(
                          resource.assignedQualityValues,
                          resource.unassignedSlotCount,
                          lang,
                        )}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: "'Share Tech Mono', monospace",
                        fontSize: '0.85rem',
                      }}
                    >
                      {formatResourceQuantity(recovered, resource.quantityUnit, lang)}
                    </Typography>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
        {Math.round(efficiency * 100)}% {t('recovery', 'recuperation')} · {t('same selected quality', 'meme qualite selectionnee')} · {dismantleTimeSecs}s {t('per job', 'par job')}
      </Typography>
    </Box>
  );
}
