import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import { alpha, useTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { fetchPublishedDatasetById } from '../hooks/gameDataApi';
import { useI18n } from '../i18n/I18nContext';
import { useCraft } from '../store/CraftContext';
import { FONT_HEADING, FONT_MONO } from '../theme';
import type {
  Blueprint,
  DatasetSummary,
  GppModifier,
  GameDataset,
  ItemStats,
  Lang,
  LocalizedString,
  Resource,
} from '../types';
import { GPP_LABELS, GPP_LOWER_IS_BETTER, STAT_LABELS, STAT_LOWER_IS_BETTER } from '../types';
import { PageStatCard } from './ui/PageStatCard';

function compareDatasetSummaries(a: DatasetSummary, b: DatasetSummary) {
  const channelOrder = a.channel.localeCompare(b.channel);
  if (channelOrder !== 0) return channelOrder;
  const dateA = Date.parse(a.updatedAt ?? a.importedAt ?? '') || 0;
  const dateB = Date.parse(b.updatedAt ?? b.importedAt ?? '') || 0;
  if (dateA !== dateB) return dateB - dateA;
  const buildA = Number(a.buildNumber ?? 0);
  const buildB = Number(b.buildNumber ?? 0);
  if (buildA !== buildB) return buildB - buildA;
  return b.version.localeCompare(a.version, undefined, { numeric: true, sensitivity: 'base' });
}

function datasetOptionLabel(dataset: DatasetSummary | GameDataset) {
  return `${dataset.channel.toUpperCase()} ${dataset.version}${dataset.buildNumber ? ` #${dataset.buildNumber}` : ''}`;
}

function stableStringify(value: unknown): string {
  if (value == null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const objectValue = value as Record<string, unknown>;
  return `{${Object.keys(objectValue).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`).join(',')}}`;
}

function loc(label: LocalizedString | undefined, lang: Lang) {
  return label?.[lang] ?? label?.en ?? '';
}

function statLabel(stat: string, lang: Lang) {
  return loc(STAT_LABELS[stat as keyof ItemStats], lang) || stat;
}

function gppLabel(gppId: string, lang: Lang) {
  return loc(GPP_LABELS[gppId], lang) || gppId.replace(/^GPP_/, '').replaceAll('_', ' ');
}

function formatScalar(value: unknown) {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);
  }
  if (value == null || value === '') return '-';
  return String(value);
}

function formatDelta(before: unknown, after: unknown) {
  if (typeof before !== 'number' || typeof after !== 'number' || before === 0) return null;
  const pct = Math.round(((after / before) - 1) * 1000) / 10;
  if (Math.abs(pct) < 0.05) return null;
  return `${pct > 0 ? '+' : ''}${Number.isInteger(pct) ? pct.toFixed(0) : pct.toFixed(1)}%`;
}

function formatModifierValue(value: number) {
  const pct = Math.round((value - 1) * 1000) / 10;
  return `${pct > 0 ? '+' : ''}${Number.isInteger(pct) ? pct.toFixed(0) : pct.toFixed(1)}%`;
}

function modifierRangeText(modifier: Pick<GppModifier, 'modAtMin' | 'modAtMax'>) {
  return `${formatModifierValue(modifier.modAtMin)} <-> ${formatModifierValue(modifier.modAtMax)}`;
}

function modifierScore(modifier: Pick<GppModifier, 'modAtMin' | 'modAtMax'>) {
  return (modifier.modAtMin + modifier.modAtMax) / 2;
}

function collectModifierRanges(blueprint: Blueprint, lang: Lang) {
  const byGpp = new Map<string, { gppId: string; label: string; modAtMin: number; modAtMax: number }>();
  for (const slot of blueprint.slots ?? []) {
    for (const modifier of slot.modifiers ?? []) {
      const current = byGpp.get(modifier.gppId);
      if (!current) {
        byGpp.set(modifier.gppId, {
          gppId: modifier.gppId,
          label: gppLabel(modifier.gppId, lang),
          modAtMin: modifier.modAtMin,
          modAtMax: modifier.modAtMax,
        });
        continue;
      }
      current.modAtMin = Math.min(current.modAtMin, modifier.modAtMin);
      current.modAtMax = Math.max(current.modAtMax, modifier.modAtMax);
    }
  }
  return [...byGpp.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function statEntries(blueprint: Blueprint, lang: Lang) {
  return Object.entries(blueprint.baseStats ?? {})
    .filter(([key, value]) => key !== 'displayName' && value != null && value !== '')
    .map(([key, value]) => `${statLabel(key, lang)}: ${formatScalar(value)}`)
    .sort((a, b) => a.localeCompare(b));
}

function changedStatEntries(before: Blueprint, after: Blueprint, lang: Lang) {
  const beforeStats = before.baseStats ?? {};
  const afterStats = after.baseStats ?? {};
  const keys = new Set([...Object.keys(beforeStats), ...Object.keys(afterStats)]);
  return [...keys]
    .filter((key) => key !== 'displayName' && stableStringify(beforeStats[key as keyof ItemStats]) !== stableStringify(afterStats[key as keyof ItemStats]))
    .map((key) => `${statLabel(key, lang)}: ${formatScalar(beforeStats[key as keyof ItemStats])} -> ${formatScalar(afterStats[key as keyof ItemStats])}`)
    .sort((a, b) => a.localeCompare(b));
}

function changedModifierEntries(before: Blueprint, after: Blueprint, lang: Lang) {
  const beforeMods = new Map(collectModifierRanges(before, lang).map((modifier) => [modifier.label, modifier]));
  const afterMods = new Map(collectModifierRanges(after, lang).map((modifier) => [modifier.label, modifier]));
  const labels = new Set([...beforeMods.keys(), ...afterMods.keys()]);
  return [...labels]
    .map((label) => {
      const previous = beforeMods.get(label);
      const next = afterMods.get(label);
      if (previous && next && previous.modAtMin === next.modAtMin && previous.modAtMax === next.modAtMax) return null;
      if (!previous && next) return `${label} modifier: added ${modifierRangeText(next)}`;
      if (previous && !next) return `${label} modifier: removed ${modifierRangeText(previous)}`;
      if (previous && next) return `${label} modifier: previous ${modifierRangeText(previous)}, new ${modifierRangeText(next)}`;
      return null;
    })
    .filter((entry): entry is string => Boolean(entry))
    .sort((a, b) => a.localeCompare(b));
}

function allModifierEntries(blueprint: Blueprint, lang: Lang) {
  return collectModifierRanges(blueprint, lang).map((modifier) => `${modifier.label} modifier: ${modifierRangeText(modifier)}`);
}

function materialChanged(before: Blueprint, after: Blueprint) {
  return stableStringify(blueprintMaterialSignature(before)) !== stableStringify(blueprintMaterialSignature(after));
}

type ChangeStatus = 'Added' | 'Changed' | 'Removed';
type StatusFilter = 'all' | ChangeStatus;
type ChangeDomain = 'stats' | 'modifiers' | 'materials' | 'craft' | 'identity' | 'resources';
type DomainFilter = 'all' | ChangeDomain;
type ImpactFilter = 'all' | 'buffs' | 'nerfs' | 'neutral';
type ChangeTone = 'positive' | 'negative' | 'neutral' | 'added' | 'removed';

interface StructuredChangeDetail {
  id: string;
  domain: ChangeDomain;
  label: string;
  before?: string;
  after?: string;
  delta?: string | null;
  tone: ChangeTone;
}

interface FlatChangeRow {
  id: string;
  name: string;
  type: string;
  status: ChangeStatus;
  details: string;
  detailItems: StructuredChangeDetail[];
  domains: ChangeDomain[];
  impact: ImpactFilter;
}

function toneFromStatChange(key: string, before: unknown, after: unknown): ChangeTone {
  if (typeof before !== 'number' || typeof after !== 'number' || before === after) return 'neutral';
  const lowerIsBetter = STAT_LOWER_IS_BETTER.has(key as never);
  const improved = lowerIsBetter ? after < before : after > before;
  return improved ? 'positive' : 'negative';
}

function toneFromModifierChange(gppId: string, before: Pick<GppModifier, 'modAtMin' | 'modAtMax'> | null, after: Pick<GppModifier, 'modAtMin' | 'modAtMax'> | null): ChangeTone {
  if (!before && after) return 'added';
  if (before && !after) return 'removed';
  if (!before || !after) return 'neutral';
  const beforeScore = modifierScore(before);
  const afterScore = modifierScore(after);
  if (beforeScore === afterScore) return 'neutral';
  const lowerIsBetter = GPP_LOWER_IS_BETTER.has(gppId);
  const improved = lowerIsBetter ? afterScore < beforeScore : afterScore > beforeScore;
  return improved ? 'positive' : 'negative';
}

function computeImpact(detailItems: StructuredChangeDetail[]): ImpactFilter {
  if (detailItems.some((item) => item.tone === 'positive')) return 'buffs';
  if (detailItems.some((item) => item.tone === 'negative')) return 'nerfs';
  return 'neutral';
}

function domainsFromDetails(detailItems: StructuredChangeDetail[]) {
  return [...new Set(detailItems.map((item) => item.domain))];
}

function structuredAddedBlueprintDetails(blueprint: Blueprint, lang: Lang): StructuredChangeDetail[] {
  const modifiers = collectModifierRanges(blueprint, lang).map((modifier) => ({
    id: `modifier-${modifier.label}`,
    domain: 'modifiers' as const,
    label: modifier.label,
    after: modifierRangeText(modifier),
    tone: 'added' as const,
  }));
  const stats = Object.entries(blueprint.baseStats ?? {})
    .filter(([key, value]) => key !== 'displayName' && value != null && value !== '')
    .map(([key, value]) => ({
      id: `stat-${key}`,
      domain: 'stats' as const,
      label: statLabel(key, lang),
      after: formatScalar(value),
      tone: 'added' as const,
    }));
  return [...modifiers, ...stats].sort((a, b) => a.domain.localeCompare(b.domain) || a.label.localeCompare(b.label));
}

function structuredRemovedBlueprintDetails(blueprint: Blueprint, lang: Lang): StructuredChangeDetail[] {
  return structuredAddedBlueprintDetails(blueprint, lang).map((item) => ({
    ...item,
    before: item.after,
    after: undefined,
    tone: 'removed',
  }));
}

function structuredChangedBlueprintDetails(before: Blueprint, after: Blueprint, lang: Lang): StructuredChangeDetail[] {
  const detailItems: StructuredChangeDetail[] = [];
  const beforeMods = new Map(collectModifierRanges(before, lang).map((modifier) => [modifier.label, modifier]));
  const afterMods = new Map(collectModifierRanges(after, lang).map((modifier) => [modifier.label, modifier]));
  const modifierLabels = new Set([...beforeMods.keys(), ...afterMods.keys()]);
  for (const label of modifierLabels) {
    const previous = beforeMods.get(label) ?? null;
    const next = afterMods.get(label) ?? null;
    if (previous && next && previous.modAtMin === next.modAtMin && previous.modAtMax === next.modAtMax) continue;
    detailItems.push({
      id: `modifier-${label}`,
      domain: 'modifiers',
      label,
      before: previous ? modifierRangeText(previous) : undefined,
      after: next ? modifierRangeText(next) : undefined,
      tone: toneFromModifierChange(previous?.gppId ?? next?.gppId ?? label, previous, next),
    });
  }

  const beforeStats = before.baseStats ?? {};
  const afterStats = after.baseStats ?? {};
  const statKeys = new Set([...Object.keys(beforeStats), ...Object.keys(afterStats)]);
  for (const key of statKeys) {
    if (key === 'displayName' || stableStringify(beforeStats[key as keyof ItemStats]) === stableStringify(afterStats[key as keyof ItemStats])) continue;
    detailItems.push({
      id: `stat-${key}`,
      domain: 'stats',
      label: statLabel(key, lang),
      before: formatScalar(beforeStats[key as keyof ItemStats]),
      after: formatScalar(afterStats[key as keyof ItemStats]),
      delta: formatDelta(beforeStats[key as keyof ItemStats], afterStats[key as keyof ItemStats]),
      tone: toneFromStatChange(key, beforeStats[key as keyof ItemStats], afterStats[key as keyof ItemStats]),
    });
  }

  if (materialChanged(before, after)) {
    detailItems.push({ id: 'materials', domain: 'materials', label: 'Materials', after: 'changed', tone: 'neutral' });
  }
  if (before.craftTimeSecs !== after.craftTimeSecs) {
    detailItems.push({
      id: 'craft-time',
      domain: 'craft',
      label: 'Craft time',
      before: `${before.craftTimeSecs}s`,
      after: `${after.craftTimeSecs}s`,
      delta: formatDelta(before.craftTimeSecs, after.craftTimeSecs),
      tone: before.craftTimeSecs < after.craftTimeSecs ? 'negative' : 'positive',
    });
  }
  if (before.name !== after.name) {
    detailItems.push({ id: 'name', domain: 'identity', label: 'Name', before: before.name, after: after.name, tone: 'neutral' });
  }
  if (before.category !== after.category) {
    detailItems.push({ id: 'type', domain: 'identity', label: 'Type', before: before.category, after: after.category, tone: 'neutral' });
  }

  return detailItems.sort((a, b) => a.domain.localeCompare(b.domain) || a.label.localeCompare(b.label));
}

function resourceDetailItems(status: ChangeStatus, before: Resource | null, after: Resource | null): StructuredChangeDetail[] {
  if (status === 'Added' && after) return [{ id: 'resource-added', domain: 'resources', label: 'Resource entry', after: after.description || after.visualStatus || 'added', tone: 'added' }];
  if (status === 'Removed' && before) return [{ id: 'resource-removed', domain: 'resources', label: 'Resource entry', before: before.description || before.visualStatus || 'removed', tone: 'removed' }];
  if (!before || !after) return [];
  const detailItems: StructuredChangeDetail[] = [];
  if (before.name !== after.name) detailItems.push({ id: 'name', domain: 'resources', label: 'Name', before: before.name, after: after.name, tone: 'neutral' });
  if (before.description !== after.description) detailItems.push({ id: 'description', domain: 'resources', label: 'Description', after: 'changed', tone: 'neutral' });
  if (before.visualKind !== after.visualKind) detailItems.push({ id: 'visual-kind', domain: 'resources', label: 'Visual type', before: before.visualKind ?? '-', after: after.visualKind ?? '-', tone: 'neutral' });
  if (before.visualStatus !== after.visualStatus) detailItems.push({ id: 'visual-status', domain: 'resources', label: 'Visual status', before: before.visualStatus ?? '-', after: after.visualStatus ?? '-', tone: 'neutral' });
  if (stableStringify(before.visual) !== stableStringify(after.visual)) detailItems.push({ id: 'visual', domain: 'resources', label: 'Visual', after: 'changed', tone: 'neutral' });
  return detailItems;
}

function buildBlueprintDetails(status: ChangeStatus, before: Blueprint | null, after: Blueprint | null, lang: Lang) {
  if (status === 'Added' && after) {
    const parts = [...allModifierEntries(after, lang), ...statEntries(after, lang)];
    return parts.length > 0 ? parts.join('; ') : 'No stats or modifiers exposed';
  }

  if (status === 'Removed' && before) {
    const parts = [...allModifierEntries(before, lang), ...statEntries(before, lang)];
    return parts.length > 0 ? `Previous: ${parts.join('; ')}` : 'Removed from target dataset';
  }

  if (before && after) {
    const parts = [...changedModifierEntries(before, after, lang), ...changedStatEntries(before, after, lang)];
    if (materialChanged(before, after)) parts.push('materials changed');
    if (before.craftTimeSecs !== after.craftTimeSecs) parts.push(`craft time: ${before.craftTimeSecs}s -> ${after.craftTimeSecs}s`);
    if (before.name !== after.name) parts.push(`name: ${before.name} -> ${after.name}`);
    if (before.category !== after.category) parts.push(`type: ${before.category} -> ${after.category}`);
    return parts.length > 0 ? parts.join('; ') : 'Changed';
  }

  return '';
}

function buildBlueprintDetailItems(status: ChangeStatus, before: Blueprint | null, after: Blueprint | null, lang: Lang) {
  if (status === 'Added' && after) return structuredAddedBlueprintDetails(after, lang);
  if (status === 'Removed' && before) return structuredRemovedBlueprintDetails(before, lang);
  if (before && after) return structuredChangedBlueprintDetails(before, after, lang);
  return [];
}

function resourceDetails(status: ChangeStatus, before: Resource | null, after: Resource | null) {
  if (status === 'Added' && after) return after.description || after.visualStatus || 'New resource entry';
  if (status === 'Removed' && before) return before.description || before.visualStatus || 'Removed resource entry';
  if (before && after) {
    const parts: string[] = [];
    if (before.name !== after.name) parts.push(`name: ${before.name} -> ${after.name}`);
    if (before.description !== after.description) parts.push('description changed');
    if (before.visualKind !== after.visualKind) parts.push(`visual type: ${before.visualKind ?? '-'} -> ${after.visualKind ?? '-'}`);
    if (before.visualStatus !== after.visualStatus) parts.push(`visual status: ${before.visualStatus ?? '-'} -> ${after.visualStatus ?? '-'}`);
    if (stableStringify(before.visual) !== stableStringify(after.visual)) parts.push('visual changed');
    return parts.join('; ') || 'Changed';
  }
  return '';
}

function makeFlatChangeRow({
  id,
  name,
  type,
  status,
  details,
  detailItems,
}: {
  id: string;
  name: string;
  type: string;
  status: ChangeStatus;
  details: string;
  detailItems: StructuredChangeDetail[];
}): FlatChangeRow {
  return {
    id,
    name,
    type,
    status,
    details,
    detailItems,
    domains: domainsFromDetails(detailItems),
    impact: computeImpact(detailItems),
  };
}

function buildFlatChangeRows(baseDataset: GameDataset, targetDataset: GameDataset, lang: Lang): FlatChangeRow[] {
  const rows: FlatChangeRow[] = [];
  const baseBlueprints = new Map(baseDataset.blueprints.map((blueprint) => [blueprint.id, blueprint]));
  const targetBlueprints = new Map(targetDataset.blueprints.map((blueprint) => [blueprint.id, blueprint]));
  const baseResources = new Map(baseDataset.resources.map((resource) => [resource.id, resource]));
  const targetResources = new Map(targetDataset.resources.map((resource) => [resource.id, resource]));

  for (const blueprint of targetDataset.blueprints) {
    const previous = baseBlueprints.get(blueprint.id) ?? null;
    const status: ChangeStatus = previous ? 'Changed' : 'Added';
    const details = buildBlueprintDetails(status, previous, blueprint, lang);
    if (status === 'Added' || details !== 'Changed') {
      rows.push(makeFlatChangeRow({
        id: `blueprint-${blueprint.id}`,
        name: blueprint.name,
        type: blueprint.category,
        status,
        details,
        detailItems: buildBlueprintDetailItems(status, previous, blueprint, lang),
      }));
    }
  }

  for (const blueprint of baseDataset.blueprints) {
    if (!targetBlueprints.has(blueprint.id)) {
      const details = buildBlueprintDetails('Removed', blueprint, null, lang);
      rows.push(makeFlatChangeRow({
        id: `blueprint-${blueprint.id}`,
        name: blueprint.name,
        type: blueprint.category,
        status: 'Removed',
        details,
        detailItems: buildBlueprintDetailItems('Removed', blueprint, null, lang),
      }));
    }
  }

  for (const resource of targetDataset.resources) {
    const previous = baseResources.get(resource.id) ?? null;
    const status: ChangeStatus = previous ? 'Changed' : 'Added';
    const details = resourceDetails(status, previous, resource);
    if (status === 'Added' || details !== 'Changed') {
      rows.push(makeFlatChangeRow({
        id: `resource-${resource.id}`,
        name: resource.name,
        type: 'resource',
        status,
        details,
        detailItems: resourceDetailItems(status, previous, resource),
      }));
    }
  }

  for (const resource of baseDataset.resources) {
    if (!targetResources.has(resource.id)) {
      const details = resourceDetails('Removed', resource, null);
      rows.push(makeFlatChangeRow({
        id: `resource-${resource.id}`,
        name: resource.name,
        type: 'resource',
        status: 'Removed',
        details,
        detailItems: resourceDetailItems('Removed', resource, null),
      }));
    }
  }

  const statusOrder: Record<ChangeStatus, number> = { Added: 0, Changed: 1, Removed: 2 };
  return rows.sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
}

function filterFlatChangeRows(rows: FlatChangeRow[], searchQuery: string, statusFilter: StatusFilter, domainFilter: DomainFilter, typeFilter: string, impactFilter: ImpactFilter) {
  const normalizedSearch = searchQuery.trim().toLowerCase();
  return rows.filter((row) => {
    if (statusFilter !== 'all' && row.status !== statusFilter) return false;
    if (domainFilter !== 'all' && !row.domains.includes(domainFilter)) return false;
    if (typeFilter !== 'all' && row.type !== typeFilter) return false;
    if (impactFilter !== 'all' && row.impact !== impactFilter) return false;
    if (!normalizedSearch) return true;
    return `${row.name} ${row.type} ${row.status} ${row.details}`.toLowerCase().includes(normalizedSearch);
  });
}

function blueprintMaterialSignature(blueprint: Blueprint) {
  return (blueprint.slots ?? []).map((slot) => ({
    id: slot.id,
    requirementType: slot.requirementType,
    requirementName: slot.requirementName,
    requiredResource: slot.requiredResource,
    requiredItem: slot.requiredItem,
    requiredItemClass: slot.requiredItemClass,
    minQuality: slot.minQuality,
    quantityValue: slot.quantityValue,
    quantityUnit: slot.quantityUnit,
    quantityMultiplier: slot.quantityMultiplier,
    modifiers: slot.modifiers,
  }));
}

function DatasetSelect({
  label,
  value,
  datasets,
  onChange,
}: {
  label: string;
  value: string;
  datasets: DatasetSummary[];
  onChange: (datasetId: string) => void;
}) {
  return (
    <FormControl size="small" sx={{ minWidth: 0, flex: 1 }}>
      <Typography component="label" variant="caption" sx={{ color: 'text.secondary', mb: 0.5, fontSize: '.65rem', textTransform: 'uppercase', letterSpacing: '.08em' }}>
        {label}
      </Typography>
      <Select
        value={value}
        displayEmpty
        onChange={(event) => onChange(event.target.value)}
        renderValue={(selected) => {
          const dataset = datasets.find((entry) => entry.datasetId === selected);
          return dataset ? datasetOptionLabel(dataset) : label;
        }}
      >
        {datasets.map((dataset) => (
          <MenuItem key={dataset.datasetId} value={dataset.datasetId}>
            <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{datasetOptionLabel(dataset)}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>{dataset.label}</Typography>
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function statusColor(status: ChangeStatus) {
  if (status === 'Added') return 'success.main';
  if (status === 'Removed') return 'error.main';
  return 'warning.main';
}

function toneColor(tone: ChangeTone, theme: Theme) {
  if (tone === 'positive' || tone === 'added') return theme.palette.success.main;
  if (tone === 'negative' || tone === 'removed') return theme.palette.error.main;
  return theme.palette.text.secondary;
}

function domainLabel(domain: ChangeDomain, lang: Lang) {
  const labels: Record<ChangeDomain, { en: string; fr: string }> = {
    stats: { en: 'Stats', fr: 'Stats' },
    modifiers: { en: 'Modifiers', fr: 'Modifiers' },
    materials: { en: 'Materials', fr: 'Materiaux' },
    craft: { en: 'Craft', fr: 'Craft' },
    identity: { en: 'Identity', fr: 'Identite' },
    resources: { en: 'Resources', fr: 'Ressources' },
  };
  return labels[domain][lang === 'fr' ? 'fr' : 'en'];
}

function DetailPill({ item }: { item: StructuredChangeDetail }) {
  const theme = useTheme();
  const color = toneColor(item.tone, theme);
  return (
    <Box
      sx={{
        minWidth: 0,
        px: 1,
        py: 0.75,
        border: 1,
        borderColor: alpha(color, 0.32),
        backgroundColor: alpha(color, 0.07),
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'minmax(96px, .75fr) minmax(120px, 1fr) auto' },
        gap: { xs: 0.35, sm: 1 },
        alignItems: 'center',
      }}
    >
      <Typography variant="caption" sx={{ minWidth: 0, color: 'text.primary', fontWeight: 700, overflowWrap: 'anywhere' }}>
        {item.label}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          minWidth: 0,
          color: 'text.secondary',
          fontFamily: FONT_MONO,
          overflowWrap: 'anywhere',
        }}
      >
        {item.before && item.after ? `${item.before} -> ${item.after}` : item.after ?? item.before ?? '-'}
      </Typography>
      {item.delta && (
        <Typography variant="caption" sx={{ color, fontFamily: FONT_MONO, fontWeight: 700, justifySelf: { xs: 'start', sm: 'end' } }}>
          {item.delta}
        </Typography>
      )}
    </Box>
  );
}

function ChangeDetailsCell({ row, lang }: { row: FlatChangeRow; lang: Lang }) {
  if (row.detailItems.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '.76rem', lineHeight: 1.45, overflowWrap: 'anywhere' }}>
        {row.details}
      </Typography>
    );
  }

  const grouped = row.detailItems.reduce<Partial<Record<ChangeDomain, StructuredChangeDetail[]>>>((acc, item) => {
    acc[item.domain] = [...(acc[item.domain] ?? []), item];
    return acc;
  }, {});
  const orderedDomains: ChangeDomain[] = ['stats', 'modifiers', 'materials', 'craft', 'identity', 'resources'];

  return (
    <Stack spacing={0.85}>
      {orderedDomains.map((domain) => {
        const items = grouped[domain];
        if (!items?.length) return null;
        return (
          <Box key={domain} sx={{ minWidth: 0 }}>
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                mb: 0.45,
                color: 'text.disabled',
                fontSize: '.58rem',
                fontWeight: 700,
                letterSpacing: '.1em',
                textTransform: 'uppercase',
              }}
            >
              {domainLabel(domain, lang)}
            </Typography>
            <Stack spacing={0.55}>
              {items.slice(0, 8).map((item) => <DetailPill key={item.id} item={item} />)}
              {items.length > 8 && (
                <Typography variant="caption" sx={{ color: 'text.disabled', fontFamily: FONT_MONO }}>
                  +{items.length - 8} {lang === 'fr' ? 'changements supplementaires' : 'more changes'}
                </Typography>
              )}
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}

function ChangeRows({ rows, lang }: { rows: FlatChangeRow[]; lang: Lang }) {
  if (rows.length === 0) {
    return <Alert severity="success">{lang === 'fr' ? 'Aucune difference detectee entre ces deux datasets.' : 'No differences detected between these datasets.'}</Alert>;
  }

  return (
    <Card variant="outlined" sx={{ backgroundColor: (theme) => theme.palette.ui.surface1, borderColor: (theme) => theme.palette.ui.border }}>
      <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
        <Box
          sx={{
            display: { xs: 'none', md: 'grid' },
            gridTemplateColumns: 'minmax(220px, .95fr) 150px 105px minmax(420px, 2.5fr)',
            gap: 1.5,
            px: 2,
            py: 1,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          {['Name', 'Type', 'Status', 'Stats / modifiers'].map((label) => (
            <Typography key={label} variant="caption" sx={{ color: 'text.secondary', fontSize: '.65rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
              {label}
            </Typography>
          ))}
        </Box>
        {rows.map((row) => (
          <Box
            key={row.id}
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'minmax(220px, .95fr) 150px 105px minmax(420px, 2.5fr)' },
              gap: { xs: 0.75, md: 1.5 },
              px: 2,
              py: 1.35,
              borderBottom: 1,
              borderColor: 'divider',
              '&:last-child': { borderBottom: 0 },
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{row.name}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }}>{row.type}</Typography>
            <Chip
              label={row.status}
              size="small"
              variant="outlined"
              sx={{ width: 'fit-content', height: 22, color: statusColor(row.status), borderColor: statusColor(row.status), fontSize: '.65rem', fontWeight: 700 }}
            />
            <ChangeDetailsCell row={row} lang={lang} />
          </Box>
        ))}
      </CardContent>
    </Card>
  );
}

export function DatasetChangelogPage() {
  const { activeDataset, availableDatasets } = useCraft();
  const { lang, t } = useI18n();
  const datasetCacheRef = useRef<Record<string, GameDataset>>({});
  const [baseDatasetId, setBaseDatasetId] = useState('');
  const [targetDatasetId, setTargetDatasetId] = useState(activeDataset.datasetId);
  const [loadedPair, setLoadedPair] = useState<{ base: GameDataset; target: GameDataset } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [domainFilter, setDomainFilter] = useState<DomainFilter>('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>('all');

  const selectableDatasets = useMemo(() => {
    const byId = new Map<string, DatasetSummary>();
    for (const dataset of availableDatasets) byId.set(dataset.datasetId, dataset);
    if (activeDataset.datasetId && !byId.has(activeDataset.datasetId)) {
      byId.set(activeDataset.datasetId, {
        channel: activeDataset.channel,
        datasetId: activeDataset.datasetId,
        label: activeDataset.label,
        version: activeDataset.version,
        branch: activeDataset.branch,
        buildNumber: activeDataset.buildNumber,
        buildDateStamp: activeDataset.buildDateStamp,
        buildTimeStamp: activeDataset.buildTimeStamp,
        published: activeDataset.published,
        blueprintCount: activeDataset.blueprintCount,
        resourceCount: activeDataset.resourceCount,
        hasDismantling: activeDataset.hasDismantling,
        hasMissionRewards: activeDataset.hasMissionRewards,
        missionRewardContractCount: 0,
        missionRewardFactionGroupCount: 0,
        importedAt: activeDataset.importedAt,
        updatedAt: activeDataset.updatedAt,
        hasChangelog: activeDataset.hasChangelog,
        hasResourceData: activeDataset.hasResourceData,
        hasShipComponents: activeDataset.hasShipComponents,
      });
    }
    return [...byId.values()].sort(compareDatasetSummaries);
  }, [activeDataset, availableDatasets]);

  const datasetSummaryById = useMemo(() => new Map(selectableDatasets.map((dataset) => [dataset.datasetId, dataset])), [selectableDatasets]);

  useEffect(() => {
    if (activeDataset.datasetId) datasetCacheRef.current[activeDataset.datasetId] = activeDataset;
  }, [activeDataset]);

  useEffect(() => {
    if (selectableDatasets.length === 0) return;
    const latestLive = selectableDatasets.find((dataset) => dataset.channel === 'live');
    const activeSummary = selectableDatasets.find((dataset) => dataset.datasetId === activeDataset.datasetId);
    const firstOther = selectableDatasets.find((dataset) => dataset.datasetId !== activeDataset.datasetId);
    const defaultBaseDataset =
      latestLive && latestLive.datasetId !== activeSummary?.datasetId
        ? latestLive
        : firstOther;
    setTargetDatasetId((current) => current && datasetSummaryById.has(current) ? current : activeSummary?.datasetId ?? selectableDatasets[0].datasetId);
    setBaseDatasetId((current) => current && datasetSummaryById.has(current) ? current : defaultBaseDataset?.datasetId ?? selectableDatasets[0].datasetId);
  }, [activeDataset.datasetId, datasetSummaryById, selectableDatasets]);

  const loadDataset = useCallback(async (datasetId: string) => {
    const cached = datasetCacheRef.current[datasetId];
    if (cached) return cached;
    const summary = datasetSummaryById.get(datasetId);
    const dataset = await fetchPublishedDatasetById(datasetId, summary?.channel);
    datasetCacheRef.current[datasetId] = dataset;
    return dataset;
  }, [datasetSummaryById]);

  useEffect(() => {
    if (!baseDatasetId || !targetDatasetId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([loadDataset(baseDatasetId), loadDataset(targetDatasetId)])
      .then(([base, target]) => {
        if (!cancelled) setLoadedPair({ base, target });
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadedPair(null);
          setError(err instanceof Error ? err.message : 'Failed to load selected datasets.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [baseDatasetId, loadDataset, targetDatasetId]);

  const flatRows = useMemo(() => (loadedPair ? buildFlatChangeRows(loadedPair.base, loadedPair.target, lang) : []), [lang, loadedPair]);
  const typeOptions = useMemo(() => [...new Set(flatRows.map((row) => row.type))].sort((a, b) => a.localeCompare(b)), [flatRows]);
  const changeStats = useMemo(() => ({
    added: flatRows.filter((row) => row.status === 'Added').length,
    changed: flatRows.filter((row) => row.status === 'Changed').length,
    removed: flatRows.filter((row) => row.status === 'Removed').length,
    statRows: flatRows.filter((row) => row.domains.includes('stats')).length,
  }), [flatRows]);
  const filteredRows = useMemo(() => filterFlatChangeRows(flatRows, searchQuery, statusFilter, domainFilter, typeFilter, impactFilter), [domainFilter, flatRows, impactFilter, searchQuery, statusFilter, typeFilter]);
  const totalDelta = flatRows.length;

  useEffect(() => {
    if (typeFilter !== 'all' && !typeOptions.includes(typeFilter)) setTypeFilter('all');
  }, [typeFilter, typeOptions]);

  return (
    <Box sx={{ p: { xs: 1.25, sm: 2, md: 3 }, flex: 1 }}>
      <Stack spacing={1.5}>
        <Stack spacing={1.25}>
          <Box>
            <Typography
              sx={{
                fontFamily: FONT_HEADING,
                fontWeight: 700,
                fontSize: { xs: '1.9rem', md: '2.2rem' },
                textTransform: 'uppercase',
                lineHeight: 1,
              }}
            >
              {t('Changelog', 'Changelog')}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75 }}>
              {loadedPair
                ? `${loadedPair.target.label} vs ${loadedPair.base.label}`
                : t('Compare published datasets and isolate gameplay stat, modifier, resource and material changes.', 'Comparez les datasets publies et isolez les changements de stats, modifiers, ressources et materiaux.')}
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' },
              gap: 1,
            }}
          >
            <PageStatCard label={t('Delta entries', 'Entrees modifiees')} value={String(totalDelta)} />
            <PageStatCard label={t('Added', 'Ajouts')} value={String(changeStats.added)} />
            <PageStatCard label={t('Changed', 'Modifies')} value={String(changeStats.changed)} />
            <PageStatCard label={t('Stat rows', 'Lignes stats')} value={String(changeStats.statRows)} />
          </Box>
        </Stack>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {selectableDatasets.length === 0 && <Alert severity="info">{t('No published dataset is available yet.', 'Aucun dataset publie disponible.')}</Alert>}

      {loadedPair && (
        <>
          <Paper
            variant="outlined"
            sx={(theme) => ({
              p: { xs: 1.25, md: 1.5 },
              borderColor: alpha(theme.palette.primary.main, 0.14),
              backgroundColor: alpha(theme.palette.background.default, 0.24),
            })}
          >
            <Stack spacing={1.25}>
              <Stack
                direction={{ xs: 'column', lg: 'row' }}
                spacing={1}
                justifyContent="space-between"
                alignItems={{ xs: 'stretch', lg: 'flex-start' }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="overline" sx={{ color: 'secondary.main', letterSpacing: '0.12em' }}>
                    {t('Dataset comparison', 'Comparaison datasets')}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {filteredRows.length}/{totalDelta} {t('entries match the current filters.', 'entrees correspondent aux filtres actifs.')}
                  </Typography>
                </Box>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ width: { xs: '100%', lg: 'min(760px, 56vw)' } }}>
                  <DatasetSelect label={t('Base dataset', 'Dataset de base')} value={baseDatasetId} datasets={selectableDatasets} onChange={setBaseDatasetId} />
                  <DatasetSelect label={t('Target dataset', 'Dataset cible')} value={targetDatasetId} datasets={selectableDatasets} onChange={setTargetDatasetId} />
                </Stack>
              </Stack>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'minmax(220px, 1.4fr) repeat(4, minmax(150px, 1fr))' },
                  gap: 1,
                  alignItems: 'end',
                }}
              >
                <TextField
                  size="small"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  label={t('Search', 'Recherche')}
                  placeholder={t('Name, type, stat or modifier', 'Nom, type, stat ou modifier')}
                />
                <FormControl size="small">
                  <Typography component="label" variant="caption" sx={{ color: 'text.secondary', mb: 0.5, fontSize: '.65rem', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    Status
                  </Typography>
                  <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
                    <MenuItem value="all">{t('All statuses', 'Tous statuts')}</MenuItem>
                    <MenuItem value="Added">{t('Added', 'Ajouts')}</MenuItem>
                    <MenuItem value="Changed">{t('Changed', 'Modifies')}</MenuItem>
                    <MenuItem value="Removed">{t('Removed', 'Retires')}</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small">
                  <Typography component="label" variant="caption" sx={{ color: 'text.secondary', mb: 0.5, fontSize: '.65rem', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    {t('Domain', 'Domaine')}
                  </Typography>
                  <Select value={domainFilter} onChange={(event) => setDomainFilter(event.target.value as DomainFilter)}>
                    <MenuItem value="all">{t('All domains', 'Tous domaines')}</MenuItem>
                    <MenuItem value="stats">Stats</MenuItem>
                    <MenuItem value="modifiers">Modifiers</MenuItem>
                    <MenuItem value="materials">{t('Materials', 'Materiaux')}</MenuItem>
                    <MenuItem value="resources">{t('Resources', 'Ressources')}</MenuItem>
                    <MenuItem value="craft">Craft</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small">
                  <Typography component="label" variant="caption" sx={{ color: 'text.secondary', mb: 0.5, fontSize: '.65rem', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    Type
                  </Typography>
                  <Select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                    <MenuItem value="all">{t('All types', 'Tous types')}</MenuItem>
                    {typeOptions.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small">
                  <Typography component="label" variant="caption" sx={{ color: 'text.secondary', mb: 0.5, fontSize: '.65rem', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    Impact
                  </Typography>
                  <Select value={impactFilter} onChange={(event) => setImpactFilter(event.target.value as ImpactFilter)}>
                    <MenuItem value="all">{t('All impacts', 'Tous impacts')}</MenuItem>
                    <MenuItem value="buffs">{t('Buffs', 'Buffs')}</MenuItem>
                    <MenuItem value="nerfs">{t('Nerfs', 'Nerfs')}</MenuItem>
                    <MenuItem value="neutral">{t('Neutral', 'Neutre')}</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </Stack>
          </Paper>
          <ChangeRows rows={filteredRows} lang={lang} />
        </>
      )}
      </Stack>
    </Box>
  );
}
