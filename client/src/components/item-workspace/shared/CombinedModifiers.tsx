import { Box, Paper, Stack, Typography, alpha, useTheme } from '../../../ui/system';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '../../../ui/widgets';
import { ElectricBoltIcon } from '../../../ui/icons';
import { loc, useI18n } from '../../../i18n/I18nContext';
import { NUMERIC_ITEM_STAT_KEYS, STAT_LABELS, STAT_LOWER_IS_BETTER, STAT_UNITS } from '../../../types';
import type { ItemCategory, ItemStats, NumericItemStatKey } from '../../../types';
import { FONT_HEADING, FONT_MONO, TEXT_LABEL} from '../../../theme';

export function CombinedModifiers({ blueprint, projectedStats }: { blueprint: { baseStats: ItemStats; category?: ItemCategory }; projectedStats: ItemStats }) {
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
      const label =
        blueprint.category === 'ship-weapon' && key === 'damage'
          ? t('Alpha Damage', 'Degats alpha', 'Alpha-Schaden')
          : loc(STAT_LABELS[key] ?? { en: String(key), fr: String(key) }, lang);
      return { key, label, base, projected, pct, isImproved, isNeutral: Math.abs(pct) < 0.005 };
    })
    .filter(Boolean) as Array<{ key: NumericItemStatKey; label: string; base: number; projected: number; pct: number; isImproved: boolean; isNeutral: boolean }>;

  if (rows.length === 0) return null;
  const formatValue = (key: NumericItemStatKey, value: number) => {
    const suffix = STAT_UNITS[key];
    return `${value.toFixed(2)}${suffix ? ` ${suffix}` : ''}`;
  };
  const headerCellSx = {
    color: 'text.secondary',
    fontFamily: FONT_HEADING,
    fontSize: { xs: TEXT_LABEL, sm: '0.8rem' },
    fontWeight: 700,
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor: alpha(theme.palette.background.default, 0.38),
    px: { xs: 0.45, sm: 0.9 },
    py: { xs: 0.75, sm: 1 },
    whiteSpace: 'nowrap',
  } as const;
  const valueCellSx = {
    fontFamily: FONT_MONO,
    fontSize: { xs: TEXT_LABEL, sm: '0.8rem' },
    fontWeight: 800,
    px: { xs: 0.45, sm: 0.9 },
    py: { xs: 0.8, sm: 0.95 },
    whiteSpace: 'nowrap',
  } as const;

  return (
    <Box component="section">
      <Stack direction="row" spacing={0.65} alignItems="center" sx={{ mb: 0.85 }}>
        <ElectricBoltIcon sx={{ fontSize: '1rem', color: 'primary.main' }} />
        <Typography
          variant="body2"
          sx={{
            fontWeight: 700,
            fontFamily: FONT_HEADING,
            fontSize: '.9rem',
            lineHeight: 1,
          }}
        >
          {t('Combined Modifiers', 'Modificateurs combines')}
        </Typography>
      </Stack>

      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{
          overflowX: 'auto',
          maxWidth: '100%',
          minWidth: 0,
          backgroundColor: alpha(theme.palette.background.paper, 0.72),
          borderColor: theme.palette.ui.border,
        }}
      >
        <Table
          size="small"
          aria-label={t('Stats modifiers', 'Modificateurs de stats')}
          sx={{ width: '100%', minWidth: 0, tableLayout: 'fixed' }}
        >
          <TableHead>
            <TableRow>
              <TableCell scope="col" sx={{ ...headerCellSx, pl: { xs: 0.75, sm: 1.25 }, width: { xs: '34%', sm: '38%' }, textAlign: 'left' }}>
                {t('Stat', 'Stat')}
              </TableCell>
              <TableCell scope="col" align="right" sx={{ ...headerCellSx, width: { xs: '22%', sm: '20%' } }}>
                {t('Base', 'Base')}
              </TableCell>
              <TableCell scope="col" align="right" sx={{ ...headerCellSx, width: { xs: '22%', sm: '20%' } }}>
                {t('Final', 'Final')}
              </TableCell>
              <TableCell scope="col" align="right" sx={{ ...headerCellSx, pr: { xs: 0.75, sm: 1.25 }, width: '22%' }}>
                {t('Delta', 'Delta')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => {
              const accentColor = r.isNeutral
                ? theme.palette.text.secondary
                : r.isImproved
                  ? theme.palette.success.main
                  : theme.palette.error.main;
              const delta = `${r.pct > 0 ? '+' : ''}${r.pct.toFixed(2)}%`;

              return (
                <TableRow
                  key={r.key}
                  hover
                  sx={{
                    transition: 'background-color 150ms ease',
                    '&:hover': {
                      backgroundColor: alpha(accentColor, r.isNeutral ? 0.05 : 0.08),
                    },
                    '&:last-of-type td, &:last-of-type th': {
                      borderBottom: 0,
                    },
                  }}
                >
                  <TableCell
                    align="left"
                    component="th"
                    scope="row"
                    sx={{
                      pl: { xs: 0.75, sm: 1.25 },
                      pr: { xs: 0.35, sm: 0.9 },
                      py: { xs: 0.8, sm: 0.95 },
                      borderBottomColor: 'divider',
                      borderLeft: '2px solid',
                      borderLeftColor: alpha(accentColor, r.isNeutral ? 0.26 : 0.8),
                      textAlign: 'left',
                    }}
                  >
                    <Typography
                      sx={{
                        fontFamily: FONT_HEADING,
                        fontWeight: 700,
                        fontSize: { xs: TEXT_LABEL, sm: '0.92rem' },
                        lineHeight: { xs: 1.05, sm: 1 },
                        textAlign: 'left',
                        overflow: 'hidden',
                        textOverflow: { xs: 'clip', sm: 'ellipsis' },
                        whiteSpace: { xs: 'normal', sm: 'nowrap' },
                        overflowWrap: 'anywhere',
                        maxWidth: '100%',
                      }}
                    >
                      {r.label}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ ...valueCellSx, color: 'text.secondary', borderBottomColor: 'divider' }}>
                    {formatValue(r.key, r.base)}
                  </TableCell>
                  <TableCell align="right" sx={{ ...valueCellSx, borderBottomColor: 'divider' }}>
                    {formatValue(r.key, r.projected)}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      ...valueCellSx,
                      pr: { xs: 0.75, sm: 1.25 },
                      borderBottomColor: 'divider',
                      color: r.isNeutral ? 'text.secondary' : accentColor,
                    }}
                  >
                    {delta}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
