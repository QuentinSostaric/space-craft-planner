import { useCallback, useState } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { loc, useI18n } from '../../i18n/I18nContext';
import type { Blueprint, ItemStats, NumericItemStatKey } from '../../types';
import {
  CATEGORY_LABELS,
  NUMERIC_ITEM_STAT_KEYS,
  STAT_LABELS,
  STAT_LOWER_IS_BETTER,
  STAT_UNITS,
} from '../../types';
import { Button } from '../ui/Button';
import { Panel } from '../ui/Panel';
import { SlotCard } from './shared/SlotCard';
import { FONT_DISPLAY, FONT_MONO } from '../../theme';

interface CraftSectionProps {
  blueprint: Blueprint;
  slotAssignments: Record<string, number | undefined>;
  assignQuality: (slotId: string, value: number | undefined) => void;
  clearAssignments: () => void;
  qualityScore: number;
  projectedStats: ItemStats;
}

function formatCraftTime(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatStatValue(key: NumericItemStatKey, value: number): string {
  const unit = STAT_UNITS[key];
  const abs = Math.abs(value);
  const formatted = abs < 10 ? value.toFixed(2) : abs < 100 ? value.toFixed(1) : String(Math.round(value));
  return unit ? `${formatted} ${unit}` : formatted;
}

interface StatRow {
  key: NumericItemStatKey;
  label: string;
  baseVal: number;
  finalVal: number;
  delta: number;
  deltaPct: number;
  unit: string;
  fillBase: number;
  fillFinal: number;
  isImproved: boolean;
  isNeutral: boolean;
}

function buildStatRows(blueprint: Blueprint, projectedStats: ItemStats, lang: 'en' | 'fr' | 'de'): StatRow[] {
  const base = blueprint.baseStats;
  return NUMERIC_ITEM_STAT_KEYS
    .filter((key) => typeof base[key] === 'number' && base[key] !== 0)
    .map((key) => {
      const baseVal = base[key] as number;
      const finalVal = typeof projectedStats[key] === 'number' ? (projectedStats[key] as number) : baseVal;
      const delta = finalVal - baseVal;
      const deltaPct = baseVal !== 0 ? (finalVal / baseVal - 1) * 100 : 0;
      const lowerIsBetter = STAT_LOWER_IS_BETTER.has(key);
      const isImproved = lowerIsBetter ? delta < 0 : delta > 0;
      const isNeutral = Math.abs(deltaPct) < 0.005;
      const unit = STAT_UNITS[key] ?? '';
      const maxRef = Math.max(Math.abs(baseVal), Math.abs(finalVal)) * 1.2 || 1;
      const fillBase = Math.min(100, (Math.abs(baseVal) / maxRef) * 100);
      const fillFinal = Math.min(100, (Math.abs(finalVal) / maxRef) * 100);
      const labelObj = STAT_LABELS[key] ?? { en: String(key), fr: String(key) };
      const label = loc(labelObj, lang);
      return { key, label, baseVal, finalVal, delta, deltaPct, unit, fillBase, fillFinal, isImproved, isNeutral };
    })
    .slice(0, 12);
}

function getGrade(score: number): { label: string; labelFr: string; color: 'success' | 'primary' | 'default' | 'warning' | 'error' } {
  if (score >= 80) return { label: 'Excellent', labelFr: 'Excellent', color: 'success' };
  if (score >= 60) return { label: 'Élevé', labelFr: 'Élevé', color: 'primary' };
  if (score >= 40) return { label: 'Standard', labelFr: 'Standard', color: 'default' };
  if (score >= 20) return { label: 'Médiocre', labelFr: 'Médiocre', color: 'warning' };
  return { label: 'Défectueux', labelFr: 'Défectueux', color: 'error' };
}

function KVRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1, py: 0.35 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.78rem', flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="caption" sx={{ fontFamily: FONT_MONO, fontSize: '0.78rem', color: 'text.primary', textAlign: 'right' }}>
        {value}
      </Typography>
    </Box>
  );
}

function humanizeToken(value: string | undefined): string | null {
  if (!value) return null;
  return value.replace(/[_-]+/g, ' ').trim().split(' ')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

function formatMicroScu(value: number): string {
  if (Math.abs(value) >= 1000) {
    const compact = value / 1000;
    return `${Number.isInteger(compact) ? compact : compact.toFixed(1)}K`;
  }
  return String(value);
}

function FieldRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          fontWeight: 500,
          fontSize: '0.75rem',
          py: 0.65,
          borderBottom: `1px solid ${theme.palette.ui.border}`,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 650,
          color: 'text.primary',
          py: 0.65,
          borderBottom: `1px solid ${theme.palette.ui.border}`,
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </Typography>
    </>
  );
}

export function CraftSection({
  blueprint,
  slotAssignments,
  assignQuality,
  clearAssignments,
  qualityScore,
  projectedStats,
}: CraftSectionProps) {
  const { lang, t } = useI18n();
  const theme = useTheme();
  const [techExpanded, setTechExpanded] = useState(false);

  const fillSlots = useCallback(
    (mode: 'max' | 'standard') => {
      for (const slot of blueprint.slots) {
        assignQuality(slot.id, mode === 'max' ? 1000 : 500);
      }
    },
    [blueprint.slots, assignQuality],
  );

  const validAssignedCount = blueprint.slots.filter((slot) => {
    const value = slotAssignments[slot.id];
    return value !== undefined && (slot.minQuality == null || value >= slot.minQuality);
  }).length;
  const allPartsValid = validAssignedCount === blueprint.slots.length;

  const grade = getGrade(qualityScore);
  const gradeColor = {
    success: theme.palette.success.main,
    primary: theme.palette.primary.main,
    default: theme.palette.text.secondary,
    warning: theme.palette.warning.main,
    error: theme.palette.error.main,
  }[grade.color];

  const statRows = buildStatRows(blueprint, projectedStats, lang);

  const attachDef = blueprint.identity?.attachDef;
  const inv = blueprint.identity?.inventoryOccupancy;
  const itemType = blueprint.baseStats.weaponType || blueprint.baseStats.armorType || null;
  const sizeVal = attachDef?.size != null ? String(attachDef.size) : null;
  const volumeVal = inv?.microScu != null ? `${formatMicroScu(inv.microScu)} microSCU` : null;
  const gridSizeVal = inv?.gridSize?.x && inv?.gridSize?.y ? `${inv.gridSize.x} × ${inv.gridSize.y}` : null;
  const footprintVal = inv?.dimensions?.x && inv?.dimensions?.y && inv?.dimensions?.z
    ? `${Math.round(inv.dimensions.x * 1000)} × ${Math.round(inv.dimensions.y * 1000)} × ${Math.round(inv.dimensions.z * 1000)} mm`
    : null;
  const attackProfile = [attachDef?.type, attachDef?.subType].filter(Boolean).map(humanizeToken).join(' / ') || null;
  const ammoType = blueprint.baseStats.ammoType || blueprint.baseStats.ammoFlavor || null;
  const armorSlot = blueprint.baseStats.armorSlot || null;
  const technicalTags = [
    attachDef?.size != null ? `Size ${attachDef.size}` : null,
    attachDef?.grade != null ? `Grade ${attachDef.grade}` : null,
    ...(attachDef?.tags ?? []).map(humanizeToken),
    ...(attachDef?.requiredTags ?? []).map(humanizeToken),
  ].filter(Boolean) as string[];
  const hasFieldData = !!(itemType || sizeVal || volumeVal || gridSizeVal || footprintVal || attackProfile || ammoType || armorSlot || technicalTags.length > 0);

  const gradeChipSx = {
    height: 22,
    fontFamily: FONT_MONO,
    fontSize: '0.75rem',
    fontWeight: 700,
    backgroundColor: alpha(gradeColor, 0.14),
    color: gradeColor,
    border: `1px solid ${alpha(gradeColor, 0.38)}`,
    '& .MuiChip-label': { px: 1 },
  };

  return (
    <Box
      id="blueprint-craft"
      component="section"
      aria-label={t('Craft simulator', 'Simulateur de craft')}
      sx={{ scrollMarginTop: 66, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 340px' }, gap: 1.5, alignItems: 'start' }}
    >
      {/* ── LEFT: Slots + Field Data ── */}
      <Stack spacing={1.5}>
        <Panel
          eyebrow={t('Slots', 'Slots')}
          title={t('Materials & quality', 'Matériaux et qualité')}
          subtitle={t(
            `Place a material in each slot and adjust its quality. 500 = standard.`,
            `Place un matériau dans chaque slot, ajuste sa qualité. 500 = standard.`,
          )}
        >
          <Stack spacing={0.65}>
            {blueprint.slots.map((slot) => (
              <SlotCard
                key={slot.id}
                slot={slot}
                qualityValue={slotAssignments[slot.id]}
                onQualityChange={(value) => assignQuality(slot.id, value)}
                category={blueprint.category}
              />
            ))}
          </Stack>

          {blueprint.slots.length > 0 && (
            <>
              <Divider sx={{ my: 1.5, borderColor: theme.palette.ui.border }} />
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 1,
                }}
              >
                <Stack direction="row" spacing={0.6} alignItems="center" sx={{ color: allPartsValid ? 'success.main' : 'text.disabled' }}>
                  <CheckCircleOutlineIcon sx={{ fontSize: '0.95rem' }} />
                  <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                    {validAssignedCount}/{blueprint.slots.length} {t('valid', 'valides')}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={0.5}>
                  <Button variant="ghost" size="sm" icon={<RefreshIcon sx={{ fontSize: '0.85rem' }} />} onClick={() => fillSlots('standard')}>
                    {t('Reset 500', 'Reset 500')}
                  </Button>
                  <Button variant="ghost" size="sm" icon={<AutoAwesomeIcon sx={{ fontSize: '0.85rem' }} />} onClick={() => fillSlots('max')}>
                    {t('Max quality', 'Qualité max')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearAssignments}>
                    {t('Clear', 'Effacer')}
                  </Button>
                </Stack>
              </Box>
            </>
          )}
        </Panel>

        {/* ── FIELD DATA ── */}
        {hasFieldData && (
          <Accordion
            expanded={techExpanded}
            onChange={() => setTechExpanded((v) => !v)}
            disableGutters
            elevation={0}
            sx={{
              backgroundColor: theme.palette.ui.surface,
              border: `1px solid ${theme.palette.ui.border}`,
              '&::before': { display: 'none' },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon sx={{ fontSize: '1rem', color: 'text.secondary' }} />}
              sx={{
                minHeight: 0,
                px: 2,
                py: 1,
                '& .MuiAccordionSummary-content': { my: 0 },
                borderBottom: techExpanded ? `1px solid ${theme.palette.ui.border}` : 'none',
              }}
            >
              <Typography
                variant="overline"
                sx={{ fontFamily: FONT_MONO, fontSize: '0.6875rem', letterSpacing: '0.1em', color: 'text.secondary', lineHeight: 1 }}
              >
                {t('Field Data', 'Données objet')}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 2, pt: 1.25, pb: 1.5 }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(100px, 0.5fr) 1fr',
                  columnGap: 2,
                  '& > *:last-child, & > *:nth-last-of-type(2)': { borderBottom: 'none' },
                }}
              >
                {itemType && <FieldRow label={t('Item Type', 'Type objet')} value={itemType} />}
                {sizeVal && <FieldRow label={t('Size', 'Taille')} value={sizeVal} />}
                {volumeVal && <FieldRow label={t('Volume', 'Volume')} value={volumeVal} />}
                {gridSizeVal && <FieldRow label={t('Grid Size', 'Taille grille')} value={gridSizeVal} />}
                {footprintVal && <FieldRow label={t('Footprint', 'Encombrement')} value={footprintVal} />}
                {attackProfile && <FieldRow label={t('Attack Profile', 'Profil attaque')} value={attackProfile} />}
                {ammoType && <FieldRow label={t('Ammo Type', 'Type munition')} value={ammoType} />}
                {armorSlot && <FieldRow label={t('Armor Slot', 'Emplacement')} value={armorSlot} />}
              </Box>

              {technicalTags.length > 0 && (
                <Box sx={{ mt: 1.25 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      fontWeight: 500,
                      fontSize: '0.75rem',
                      display: 'block',
                      mb: 0.75,
                    }}
                  >
                    {t('Technical Tags', 'Tags techniques')}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {technicalTags.map((tag) => (
                      <Chip key={tag} label={tag} size="small" variant="outlined" />
                    ))}
                  </Box>
                </Box>
              )}
            </AccordionDetails>
          </Accordion>
        )}
      </Stack>

      {/* ── RIGHT: Preview + Details ── */}
      <Stack spacing={1.5}>
        {/* "Résultat prévu" */}
        <Panel
          eyebrow={t('Simulation', 'Simulation')}
          title={t('Expected result', 'Résultat prévu')}
          subtitle={t('Final stats update live with sliders', 'Les stats finales évoluent en direct avec les sliders')}
          action={
            qualityScore > 0 ? (
              <Chip
                label={`Q${qualityScore} · ${lang === 'fr' ? grade.labelFr : grade.label}`}
                size="small"
                sx={gradeChipSx}
              />
            ) : undefined
          }
        >
          {statRows.length > 0 ? (
            <Stack spacing={0.5} sx={{ mb: 1.5 }}>
              {statRows.map((row) => {
                const deltaColor = row.isNeutral
                  ? theme.palette.text.disabled
                  : row.isImproved
                    ? theme.palette.success.main
                    : theme.palette.error.main;
                const deltaSign = row.delta > 0 ? '+' : '';
                const deltaStr = `${deltaSign}${Math.abs(row.deltaPct) >= 1 ? row.deltaPct.toFixed(1) : row.deltaPct.toFixed(2)}%`;
                return (
                  <Box key={row.key}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 0.5, mb: 0.3 }}>
                      <Typography sx={{ fontFamily: FONT_DISPLAY, fontSize: '0.78rem', color: 'text.secondary', fontWeight: 600 }}>
                        {row.label}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                        <Typography sx={{ fontFamily: FONT_MONO, fontSize: '0.75rem', color: 'text.disabled' }}>
                          {formatStatValue(row.key, row.baseVal)}
                        </Typography>
                        <ArrowForwardIcon sx={{ fontSize: '0.6875rem', color: 'text.disabled' }} />
                        <Typography sx={{ fontFamily: FONT_MONO, fontSize: '0.78rem', fontWeight: 700, color: 'text.primary' }}>
                          {formatStatValue(row.key, row.finalVal)}
                        </Typography>
                        {!row.isNeutral && (
                          <Typography sx={{ fontFamily: FONT_MONO, fontSize: '0.75rem', fontWeight: 700, color: deltaColor }}>
                            {deltaStr}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                    <Box sx={{ position: 'relative', height: 3, backgroundColor: alpha(theme.palette.text.primary, 0.08) }}>
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          height: '100%',
                          width: `${row.fillBase}%`,
                          backgroundColor: alpha(theme.palette.text.secondary, 0.3),
                          transition: 'width 300ms ease',
                        }}
                      />
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          height: '100%',
                          width: `${row.fillFinal}%`,
                          backgroundColor: row.isNeutral
                            ? theme.palette.primary.main
                            : row.isImproved
                              ? theme.palette.success.main
                              : theme.palette.error.main,
                          opacity: 0.75,
                          transition: 'width 300ms ease',
                        }}
                      />
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          ) : (
            <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mb: 1.5 }}>
              {t('No modifiable stats', 'Aucune stat modifiable')}
            </Typography>
          )}

          <Divider sx={{ my: 1.25, borderColor: theme.palette.ui.border }} />
          <Stack spacing={0.15} sx={{ mb: 1.25 }}>
            <KVRow label={t('Craft time', 'Temps de craft')} value={formatCraftTime(blueprint.craftTimeSecs)} />
          </Stack>
        </Panel>

        {/* "Détails du blueprint" */}
        <Panel eyebrow={t('Reference', 'Référence')} title={t('Blueprint details', 'Détails du blueprint')}>
          <Stack spacing={0.15}>
            <KVRow label={t('Manufacturer', 'Fabricant')} value={blueprint.manufacturer} />
            <KVRow
              label={t('Category', 'Catégorie')}
              value={loc(CATEGORY_LABELS[blueprint.category], lang)}
            />
            {blueprint.rarity && (
              <KVRow label={t('Rarity', 'Rareté')} value={blueprint.rarity} />
            )}
            <KVRow label={t('Slots', 'Slots')} value={`${blueprint.slots.length} ${t('materials', 'matériaux')}`} />
          </Stack>
        </Panel>

      </Stack>
    </Box>
  );
}
