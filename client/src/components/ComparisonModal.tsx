import { useMemo } from 'react';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useCraft } from '../store/CraftContext';
import { loc, useI18n } from '../i18n/I18nContext';
import {
  NUMERIC_ITEM_STAT_KEYS,
  STAT_LABELS,
  STAT_PERCENT_KEYS,
  STAT_UNITS,
  STAT_LOWER_IS_BETTER,
} from '../types';
import type { Blueprint, ComparisonItem, Lang, NumericItemStatKey } from '../types';
import { aggregateBlueprintResources, summarizeAssignedQualities } from '../utils/crafting';
import { Button } from './ui/Button';
import { CategoryBadge } from './ui/Badge';
import { FONT_HEADING, FONT_MONO, TEXT_LABEL} from '../theme';

// ─── Radar Chart ─────────────────────────────────────────────────────────────
interface RadarChartProps {
  items: ComparisonItem[];
  statKeys: NumericItemStatKey[];
  lang: Lang;
}

function RadarChart({ items, statKeys, lang }: RadarChartProps) {
  const n = statKeys.length;
  const cx = 150, cy = 150, r = 90;

  function polarToXY(value: number, index: number): [number, number] {
    const angle = (2 * Math.PI * index) / n - Math.PI / 2;
    return [cx + r * value * Math.cos(angle), cy + r * value * Math.sin(angle)];
  }

  function textAnchor(index: number): 'start' | 'end' | 'middle' {
    const angle = (2 * Math.PI * index) / n - Math.PI / 2;
    const x = Math.cos(angle);
    if (x > 0.3) return 'start';
    if (x < -0.3) return 'end';
    return 'middle';
  }

  function dominantBaseline(index: number): 'hanging' | 'auto' | 'middle' {
    const angle = (2 * Math.PI * index) / n - Math.PI / 2;
    const y = Math.sin(angle);
    if (y > 0.3) return 'hanging';
    if (y < -0.3) return 'auto';
    return 'middle';
  }

  const maxValues: Partial<Record<NumericItemStatKey, number>> = {};
  for (const key of statKeys) {
    const vals = items.map((item) =>
      typeof item.projectedStats[key] === 'number' ? item.projectedStats[key] : 0,
    );
    maxValues[key] = Math.max(...vals, 0.001);
  }

  function normalize(item: ComparisonItem, key: NumericItemStatKey): number {
    const val = typeof item.projectedStats[key] === 'number' ? item.projectedStats[key] : 0;
    const max = maxValues[key] ?? 1;
    const norm = val / max;
    return STAT_LOWER_IS_BETTER.has(key) ? 1 - norm * 0.8 : norm;
  }

  const gridRings = [0.25, 0.5, 0.75, 1];

  return (
    <svg
      viewBox="0 0 300 300"
      style={{ width: '100%', maxWidth: 300, height: 'auto' }}
      role="img"
      aria-label={
        lang === 'fr'
          ? `Radar comparant ${items.length} item${items.length > 1 ? 's' : ''}`
          : lang === 'de'
            ? `Radar-Diagramm zum Vergleich von ${items.length} Element${items.length > 1 ? 'en' : ''}`
            : `Radar chart comparing ${items.length} item${items.length > 1 ? 's' : ''}`
      }
    >
      <title>
        {lang === 'fr'
          ? 'Radar de comparaison des statistiques'
          : lang === 'de'
            ? 'Radar-Diagramm zum Statistikvergleich'
            : 'Stats comparison radar chart'}
      </title>

      {gridRings.map((ring) => {
        const pts = statKeys.map((_, i) => polarToXY(ring, i).join(',')).join(' ');
        return (
          <polygon key={ring} points={pts} fill="none" stroke="rgba(99,102,241,0.15)" strokeWidth="1" />
        );
      })}

      {gridRings.map((ring) => {
        const [x, y] = polarToXY(ring, 0);
        return (
          <text key={`rl-${ring}`} x={x + 4} y={y} fontSize="7" fill="rgba(139,92,246,0.4)" dominantBaseline="middle">
            {Math.round(ring * 100)}%
          </text>
        );
      })}

      {statKeys.map((key, i) => {
        const [x, y] = polarToXY(1, i);
        return <line key={key} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(99,102,241,0.2)" strokeWidth="1" />;
      })}

      {statKeys.map((key, i) => {
        const [x, y] = polarToXY(1.32, i);
        return (
          <text
            key={`lbl-${key}`}
            x={x} y={y}
            fontSize="9"
            fontFamily={FONT_HEADING}
            fontWeight="600"
            fill="rgba(221,228,245,0.7)"
            textAnchor={textAnchor(i)}
            dominantBaseline={dominantBaseline(i)}
          >
{loc(STAT_LABELS[key] ?? { en: String(key), fr: String(key) }, lang)}
          </text>
        );
      })}

      {items.map((item) => {
        const pts = statKeys.map((key, i) => polarToXY(normalize(item, key), i).join(',')).join(' ');
        const [r2, g2, b2] = hexToRgb(item.color);
        return (
          <polygon key={`fill-${item.id}`} points={pts} fill={`rgba(${r2},${g2},${b2},0.12)`} stroke="none" />
        );
      })}

      {items.map((item) => {
        const pts = statKeys.map((key, i) => polarToXY(normalize(item, key), i).join(',')).join(' ');
        return (
          <polygon key={`stroke-${item.id}`} points={pts} fill="none" stroke={item.color} strokeWidth="1.8" strokeLinejoin="round" opacity="0.9" />
        );
      })}

      {items.map((item) =>
        statKeys.map((key, i) => {
          const [x, y] = polarToXY(normalize(item, key), i);
          return <circle key={`dot-${item.id}-${key}`} cx={x} cy={y} r="3" fill={item.color} stroke="var(--c-bg)" strokeWidth="1.5" />;
        }),
      )}
    </svg>
  );
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return [0, 0, 0];
  return [r, g, b];
}

function formatStatDisplayValue(key: NumericItemStatKey, value: number): number {
  const scaled = STAT_PERCENT_KEYS.has(key) ? value * 100 : value;
  return Number.isInteger(scaled) ? scaled : Math.round(scaled * 100) / 100;
}

// ─── Stat comparison table ────────────────────────────────────────────────────
function StatTable({ items, statKeys, lang }: { items: ComparisonItem[]; statKeys: NumericItemStatKey[]; lang: Lang }) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table
        size="small"
        aria-label={lang === 'fr' ? 'Comparaison des statistiques' : lang === 'de' ? 'Statistikvergleich' : 'Stats comparison'}
      >
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600, fontSize: '.7rem', letterSpacing: 0 }}>Stat</TableCell>
            {items.map((item) => (
              <TableCell key={item.id} align="center">
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: item.color, flexShrink: 0 }} aria-hidden="true" />
                  <Typography variant="caption" sx={{ fontWeight: 600, fontSize: TEXT_LABEL }}>{item.blueprintName}</Typography>
                </Box>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {statKeys.map((key) => {
            const vals = items.map((item) =>
              typeof item.projectedStats[key] === 'number' ? item.projectedStats[key] : 0,
            );
            const maxVal = Math.max(...vals);
            const minVal = Math.min(...vals);
            const isLower = STAT_LOWER_IS_BETTER.has(key);
            const bestVal = isLower ? minVal : maxVal;

            return (
              <TableRow key={key}>
                <TableCell component="th" scope="row">
                      <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '.7rem' }}>{loc(STAT_LABELS[key] ?? { en: String(key), fr: String(key) }, lang)}</Typography>
                  {STAT_UNITS[key] && (
                    <Typography component="span" variant="caption" sx={{ color: 'text.secondary', ml: 0.5, fontSize: TEXT_LABEL }}>
                      {STAT_UNITS[key]}
                    </Typography>
                  )}
                </TableCell>
                {items.map((item) => {
                  const val = typeof item.projectedStats[key] === 'number' ? item.projectedStats[key] : 0;
                  const base = typeof item.baseStats[key] === 'number' ? item.baseStats[key] : 0;
                  const isBest = val === bestVal && vals.filter(v => v === bestVal).length < vals.length;
                  const delta = val - base;
                  const displayVal = formatStatDisplayValue(key, val);
                  const displayDelta = formatStatDisplayValue(key, delta);
                  return (
                    <TableCell key={item.id} align="center">
                      <Typography
                        variant="body2"
                        sx={{ fontFamily: FONT_MONO, fontWeight: isBest ? 700 : 400, color: isBest ? item.color : 'text.primary', fontSize: '.78rem' }}
                      >
                        {displayVal}
                      </Typography>
                      {delta !== 0 && (
                        <Typography variant="caption" sx={{ color: (isLower ? delta < 0 : delta > 0) ? 'success.main' : 'error.main', fontSize: TEXT_LABEL }}>
                          {displayDelta > 0 ? '+' : ''}{displayDelta}
                        </Typography>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}

          {/* Quality score row */}
          <TableRow sx={{ '& td, & th': { borderBottom: 'none' } }}>
            <TableCell component="th" scope="row">
              <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '.7rem' }}>
                {lang === 'fr' ? 'Score qualite' : lang === 'de' ? 'Qualitatswert' : 'Quality score'}
              </Typography>
            </TableCell>
            {(() => {
              const maxScore = Math.max(...items.map(i => i.qualityScore));
              return items.map((item) => {
                const isBest = item.qualityScore === maxScore;
                return (
                  <TableCell key={item.id} align="center">
                    <Typography
                      variant="body2"
                      sx={{ fontFamily: FONT_MONO, fontWeight: isBest ? 700 : 400, color: isBest ? item.color : 'text.primary', fontSize: '.78rem' }}
                    >
                      {item.qualityScore}<Typography component="span" sx={{ color: 'text.secondary', fontSize: TEXT_LABEL }}>/100</Typography>
                    </Typography>
                  </TableCell>
                );
              });
            })()}
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ─── Resource summary per item ────────────────────────────────────────────────
function ResourceSummary({ item, lang, blueprints }: { item: ComparisonItem; lang: Lang; blueprints: Blueprint[] }) {
  const bp = blueprints.find((blueprint) => blueprint.id === item.blueprintId);
  if (!bp) return null;

  const entries = aggregateBlueprintResources(bp.slots, item.slotAssignments);
  if (entries.length === 0) return <Typography variant="body2" sx={{ color: 'text.secondary' }}>—</Typography>;

  return (
    <List
      dense
      disablePadding
      aria-label={`${lang === 'fr' ? 'Ressources pour' : lang === 'de' ? 'Ressourcen fur' : 'Resources for'} ${item.blueprintName}`}
    >
      {entries.map((entry) => (
        <ListItem key={entry.resourceName} disablePadding sx={{ py: 0.25 }}>
          <ListItemText
            primary={entry.resourceName}
            secondary={summarizeAssignedQualities(entry.assignedQualityValues, entry.unassignedSlotCount, lang)}
            slotProps={{
              primary: { variant: 'body2', sx: { fontSize: '.75rem' } },
              secondary: { variant: 'caption', sx: { fontSize: TEXT_LABEL } },
            }}
          />
          <Typography variant="caption" sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL, ml: 1, flexShrink: 0 }}>
            ×{entry.totalScu.toFixed(2)} SCU
          </Typography>
        </ListItem>
      ))}
    </List>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────
export function ComparisonModal() {
  const { comparisonItems, comparisonOpen, closeComparison, removeFromComparison, clearComparison, blueprints } = useCraft();
  const { lang, t } = useI18n();

  const allStatKeys = useMemo<NumericItemStatKey[]>(
    () =>
      NUMERIC_ITEM_STAT_KEYS.filter((key) =>
        comparisonItems.some(
          (item) =>
            typeof item.projectedStats[key] === 'number' ||
            typeof item.baseStats[key] === 'number',
        ),
      ),
    [comparisonItems],
  );

  return (
    <Dialog
      open={comparisonOpen}
      onClose={closeComparison}
      aria-labelledby="comparison-dialog-title"
      maxWidth="lg"
      fullWidth
      slotProps={{
        paper: {
          sx: { maxHeight: '90vh' },
        },
      }}
    >
      <DialogTitle
        id="comparison-dialog-title"
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          pb: 1,
        }}
      >
        <Box>
          <Typography
            variant="h6"
            sx={{
              fontFamily: FONT_HEADING,
              fontWeight: 700,
              fontSize: '1.3rem',
            }}
          >
            {t('Compare', 'Comparer')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {comparisonItems.length} {t('item', 'item')}{comparisonItems.length !== 1 ? 's' : ''}
            {' · '}{t('max 4', 'max 4')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {comparisonItems.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearComparison}>
              {t('Clear all', 'Tout effacer')}
            </Button>
          )}
          <IconButton
            onClick={closeComparison}
            aria-label={t('Close comparison', 'Fermer la comparaison')}
            size="small"
          >
            ✕
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {comparisonItems.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
            <Typography variant="h4" sx={{ mb: 1, opacity: 0.4 }}>◈</Typography>
            <Typography>{t('Add items to compare from the Stats panel.', 'Ajoutez des items à comparer depuis le panneau Stats.')}</Typography>
          </Box>
        ) : (
          <Box>
            {/* Item chips */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
              {comparisonItems.map((item) => (
                <Chip
                  key={item.id}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: item.color, flexShrink: 0 }} aria-hidden="true" />
                      <CategoryBadge category={item.category} iconOnly />
                      <span>{item.blueprintName}</span>
                      <Typography component="span" sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL, color: 'text.secondary' }}>
                        {item.qualityScore}/100
                      </Typography>
                    </Box>
                  }
                  variant="outlined"
                  onDelete={() => removeFromComparison(item.id)}
                  deleteIcon={<span style={{ fontSize: '.7rem' }}>✕</span>}
                  sx={{ borderColor: item.color }}
                />
              ))}
              {comparisonItems.length < 4 && (
                <Chip
                  label={t('+ Add from Stats panel', '+ Ajouter depuis Stats')}
                  variant="outlined"
                  sx={{ borderStyle: 'dashed', color: 'text.secondary' }}
                />
              )}
            </Box>

            {/* Radar + Stats sections */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, mb: 2 }}>
              {allStatKeys.length >= 3 && (
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" sx={{ fontFamily: FONT_HEADING, fontWeight: 700, fontSize: '.9rem', mb: 1 }}>
                    {t('Radar', 'Radar')}
                  </Typography>
                  <RadarChart items={comparisonItems} statKeys={allStatKeys} lang={lang} />
                </Box>
              )}
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" sx={{ fontFamily: FONT_HEADING, fontWeight: 700, fontSize: '.9rem', mb: 1 }}>
                  {t('Stat breakdown', 'Detail des stats')}
                </Typography>
                <StatTable items={comparisonItems} statKeys={allStatKeys} lang={lang} />
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Materials section */}
            <Typography variant="h6" sx={{ fontFamily: FONT_HEADING, fontWeight: 700, fontSize: '.9rem', mb: 1.5 }}>
              {t('Required resources', 'Ressources requises')}
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: `repeat(${Math.min(comparisonItems.length, 2)}, 1fr)`, md: `repeat(${comparisonItems.length}, 1fr)` }, gap: 1.5 }}>
              {comparisonItems.map((item) => (
                <Paper key={item.id} variant="outlined" sx={{ p: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, pb: 0.75, borderBottom: 2, borderColor: item.color }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: item.color, flexShrink: 0 }} aria-hidden="true" />
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '.78rem' }}>{item.blueprintName}</Typography>
                  </Box>
                  <ResourceSummary item={item} lang={lang} blueprints={blueprints} />
                </Paper>
              ))}
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
