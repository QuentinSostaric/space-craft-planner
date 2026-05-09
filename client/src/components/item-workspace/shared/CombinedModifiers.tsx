import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';
import { loc, useI18n } from '../../../i18n/I18nContext';
import { NUMERIC_ITEM_STAT_KEYS, STAT_LABELS, STAT_LOWER_IS_BETTER } from '../../../types';
import type { ItemStats, NumericItemStatKey } from '../../../types';
import { FONT_HEADING, FONT_MONO } from '../../../theme';

export function CombinedModifiers({ blueprint, projectedStats }: { blueprint: { baseStats: ItemStats }; projectedStats: ItemStats }) {
  const { lang, t } = useI18n();
  const theme = useTheme();
  const statKeys = NUMERIC_ITEM_STAT_KEYS.filter(
    (key) => typeof blueprint.baseStats[key] === 'number' || typeof projectedStats[key] === 'number',
  );
  const rows = statKeys
    .map((key) => {
      const rawBase = blueprint.baseStats[key];
      const base = typeof rawBase === 'number' ? rawBase : 1;
      if (base === 0) return null;
      const projectedValue = projectedStats[key];
      const projected = typeof projectedValue === 'number' ? projectedValue : base;
      const pct = (projected / base - 1) * 100;
      const isImproved = STAT_LOWER_IS_BETTER.has(key) ? pct < 0 : pct > 0;
      return { key, label: loc(STAT_LABELS[key] ?? { en: String(key), fr: String(key) }, lang), base, projected, pct, isImproved, isNeutral: Math.abs(pct) < 0.005 };
    })
    .filter(Boolean) as Array<{ key: NumericItemStatKey; label: string; base: number; projected: number; pct: number; isImproved: boolean; isNeutral: boolean }>;

  if (rows.length === 0) return null;
  return (
    <Box component="section">
      <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: FONT_HEADING, mb: 0.5, fontSize: '.85rem' }}>
        <ElectricBoltIcon sx={{ fontSize: '1rem', mr: 0.5, verticalAlign: 'text-bottom' }} /> {t('Combined Modifiers', 'Modificateurs combines')}
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label={t('Stats modifiers', 'Modificateurs de stats')}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontSize: '0.65rem', py: 0.55, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {t('Stat', 'Stat')}
              </TableCell>
              <TableCell align="right" sx={{ fontSize: '0.65rem', py: 0.55, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {t('Base', 'Base')}
              </TableCell>
              <TableCell align="right" sx={{ fontSize: '0.65rem', py: 0.55, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {t('Final', 'Final')}
              </TableCell>
              <TableCell align="right" sx={{ fontSize: '0.65rem', py: 0.55, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {t('Delta', 'Delta')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key}>
                <TableCell sx={{ fontSize: '0.75rem', py: 0.5 }}>
                  {r.label}
                </TableCell>
                <TableCell align="right" sx={{ fontFamily: FONT_MONO, fontSize: '0.75rem', py: 0.5, color: 'text.secondary' }}>
                  {r.base.toFixed(2)}
                </TableCell>
                <TableCell align="right" sx={{ fontFamily: FONT_MONO, fontSize: '0.75rem', py: 0.5 }}>
                  {r.projected.toFixed(2)}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontFamily: FONT_MONO,
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
