import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';
import { useI18n } from '../../../i18n/I18nContext';
import { NUMERIC_ITEM_STAT_KEYS, STAT_LABELS, STAT_LOWER_IS_BETTER } from '../../../types';
import type { ItemStats, NumericItemStatKey } from '../../../types';

export function CombinedModifiers({ blueprint, projectedStats }: { blueprint: { baseStats: ItemStats }; projectedStats: ItemStats }) {
  const { lang, t } = useI18n();
  const theme = useTheme();
  const statKeys = NUMERIC_ITEM_STAT_KEYS.filter((key) => typeof blueprint.baseStats[key] === 'number');
  const rows = statKeys
    .map((key) => {
      const base = blueprint.baseStats[key];
      if (typeof base !== 'number' || base === 0) return null;
      const projectedValue = projectedStats[key];
      const projected = typeof projectedValue === 'number' ? projectedValue : base;
      const pct = (projected / base - 1) * 100;
      const isImproved = STAT_LOWER_IS_BETTER.has(key) ? pct < 0 : pct > 0;
      return { key, label: STAT_LABELS[key]?.[lang] ?? String(key), base, projected, pct, isImproved, isNeutral: Math.abs(pct) < 0.005 };
    })
    .filter(Boolean) as Array<{ key: NumericItemStatKey; label: string; base: number; projected: number; pct: number; isImproved: boolean; isNeutral: boolean }>;

  if (rows.length === 0) return null;
  return (
    <Box component="section">
      <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: "'Khand', sans-serif", mb: 0.5, fontSize: '.85rem' }}>
        <ElectricBoltIcon sx={{ fontSize: '1rem', mr: 0.5, verticalAlign: 'text-bottom' }} /> {t('Final Combined Modifiers', 'Modificateurs combines')}
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label={t('Stats modifiers', 'Modificateurs de stats')}>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key}>
                <TableCell sx={{ fontSize: '0.75rem', py: 0.5 }}>
                  {r.label}
                </TableCell>
                <TableCell align="right" sx={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.75rem', py: 0.5, color: 'text.secondary' }}>
                  {r.base.toFixed(2)}
                </TableCell>
                <TableCell align="right" sx={{ fontFamily: "'Share Tech Mono', monospace", fontSize: '0.75rem', py: 0.5 }}>
                  {r.projected.toFixed(2)}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    py: 0.5,
                    color: r.isNeutral ? 'text.secondary' : r.isImproved ? theme.palette.success.main : theme.palette.error.main,
                  }}
                >
                  {r.pct > 0 ? '+' : ''}{r.pct.toFixed(2)}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
