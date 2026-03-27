import { useEffect, useMemo, useState } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { useI18n } from '../../i18n/I18nContext';
import {
  formatMaterialProviderConfidence,
  formatMaterialProviderType,
  formatMaterialSourceMethod,
  formatMineableGroupName,
  formatQuantityValue,
  formatResourceQuantity,
  getMaterialProviderProbabilityPct,
  getMaterialProviders,
  getResourceQuantityInputStep,
  summarizeAssignedQualities,
} from '../../utils/crafting';
import type { AggregatedResource, MaterialSources, Resource } from '../../types';
import { Button as AppButton } from '../ui/Button';
import { AppGlyph } from '../ui/AppGlyph';
import { DatasetTooOldNotice } from '../ui/DatasetTooOldNotice';
import { ResourceIcon } from '../ui/ResourceIcon';
import {
  StarCitizenLicensedIcon,
  getMaterialProviderIconName,
} from '../ui/StarCitizenLicensedIcon';

function normalizeResourceKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function resolveResource(resourceName: string, resources: Resource[]) {
  const normalized = normalizeResourceKey(resourceName);
  return (
    resources.find((resource) => resource.id === normalized)
    ?? resources.find((resource) => normalizeResourceKey(resource.name) === normalized)
    ?? null
  );
}

function getRequiredQuantity(resourceEntry: AggregatedResource, qty: number) {
  return Math.round(resourceEntry.totalScu * qty * 1000) / 1000;
}

function normalizePlannerQuantity(
  rawValue: string | undefined,
  fallbackValue: number,
  quantityUnit: AggregatedResource['quantityUnit'],
) {
  const parsed = Number(rawValue);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallbackValue;
  }

  if (quantityUnit === 'count') {
    return Math.max(1, Math.round(parsed));
  }

  return Math.round(parsed * 1000) / 1000;
}

interface MaterialSourcesSectionProps {
  resources: AggregatedResource[];
  allResources: Resource[];
  materialSources: MaterialSources | null;
  hasResourceData: boolean;
  loading: boolean;
  qty: number;
  setQty: (val: number) => void;
  onAddGoal: () => void;
  onAddResource: (
    resourceName: string,
    quantity: number,
    quantityUnit: AggregatedResource['quantityUnit'],
  ) => void;
}

export function MaterialSourcesSection({
  resources,
  allResources,
  materialSources,
  hasResourceData,
  loading,
  qty,
  setQty,
  onAddGoal,
  onAddResource,
}: MaterialSourcesSectionProps) {
  const { lang, t } = useI18n();
  const theme = useTheme();
  const defaultResourceQuantities = useMemo(
    () =>
      Object.fromEntries(
        resources.map((resourceEntry) => {
          const requiredQuantity = getRequiredQuantity(resourceEntry, qty);
          return [
            resourceEntry.resourceName,
            formatQuantityValue(requiredQuantity, resourceEntry.quantityUnit),
          ];
        }),
      ),
    [qty, resources],
  );
  const [resourceQuantities, setResourceQuantities] = useState<Record<string, string>>(
    defaultResourceQuantities,
  );

  useEffect(() => {
    setResourceQuantities(defaultResourceQuantities);
  }, [defaultResourceQuantities]);

  if (resources.length === 0) return null;

  return (
    <Box
      component="section"
      aria-label={t('Material sources', 'Sources de materiaux')}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
    >
      <Typography variant="overline" sx={{ display: 'block' }}>
        {t('Material Sources', 'Sources de materiaux')}
      </Typography>
      {loading && !materialSources?.resources && <LinearProgress />}
      {!loading && !materialSources?.resources && !hasResourceData && (
        <DatasetTooOldNotice variant="caption" />
      )}

      {resources.map((resourceEntry) => {
        const providers = getMaterialProviders(materialSources, resourceEntry.resourceName);
        const leadProvider = providers[0];
        const leadProviderIcon = leadProvider
          ? getMaterialProviderIconName(
            leadProvider.providerType,
            leadProvider.providerDisplayName,
            leadProvider.system,
          )
          : null;
        const resource = resolveResource(resourceEntry.resourceName, allResources);
        const requiredQuantity = getRequiredQuantity(resourceEntry, qty);
        const plannerQuantityValue = resourceQuantities[resourceEntry.resourceName]
          ?? defaultResourceQuantities[resourceEntry.resourceName]
          ?? formatQuantityValue(requiredQuantity, resourceEntry.quantityUnit);
        const plannerQuantity = normalizePlannerQuantity(
          plannerQuantityValue,
          requiredQuantity,
          resourceEntry.quantityUnit,
        );
        const quantityStep = getResourceQuantityInputStep(resourceEntry.quantityUnit);

        return (
          <Accordion
            key={resourceEntry.resourceName}
            disableGutters
            sx={{
              overflow: 'hidden',
              border: `1px solid ${theme.palette.ui.border}`,
              backgroundColor: theme.palette.ui.surface1,
              '&::before': { display: 'none' },
            }}
          >
            <AccordionSummary
              expandIcon={<AppGlyph name="caret-up" size={16} />}
              sx={{
                px: 1.25,
                py: 0.25,
                '& .MuiAccordionSummary-content': {
                  my: 0.75,
                  minWidth: 0,
                },
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  width: '100%',
                  minWidth: 0,
                  flexWrap: { xs: 'wrap', sm: 'nowrap' },
                }}
              >
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 1.25,
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1px solid ${theme.palette.ui.border}`,
                    backgroundColor: alpha(theme.palette.common.white, 0.03),
                    flexShrink: 0,
                  }}
                >
                  {resource?.visual?.imageUrl ? (
                    <Box
                      component="img"
                      src={resource.visual.imageUrl}
                      alt={resourceEntry.resourceName}
                      loading="lazy"
                      sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <ResourceIcon name={resourceEntry.resourceName} size={18} />
                  )}
                </Box>

                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                    {resourceEntry.resourceName}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ display: 'block', color: 'text.secondary', fontSize: '0.7rem' }}
                  >
                    {summarizeAssignedQualities(
                      resourceEntry.assignedQualityValues,
                      resourceEntry.unassignedSlotCount,
                      lang,
                    )}
                  </Typography>
                  {leadProvider && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        minWidth: 0,
                        mt: 0.35,
                      }}
                    >
                      {leadProviderIcon && (
                        <StarCitizenLicensedIcon name={leadProviderIcon} size={14} dimmed />
                      )}
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                          fontSize: '0.68rem',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {leadProvider.providerDisplayName}
                        {leadProvider.system ? ` - ${leadProvider.system}` : ''}
                        {leadProvider.sourceMethod
                          ? ` - ${formatMaterialSourceMethod(leadProvider.sourceMethod, lang)}`
                          : ''}
                      </Typography>
                    </Box>
                  )}
                </Box>

                <Box
                  sx={{
                    minWidth: { xs: 0, sm: 88 },
                    ml: { xs: 0, sm: 'auto' },
                    textAlign: { xs: 'left', sm: 'right' },
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      color: 'text.secondary',
                      fontSize: '0.65rem',
                      textTransform: 'uppercase',
                      letterSpacing: '.04em',
                    }}
                  >
                    {t('Required', 'Requis')}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontFamily: "'Share Tech Mono', monospace", fontWeight: 700 }}
                  >
                    {formatResourceQuantity(requiredQuantity, resourceEntry.quantityUnit, lang)}
                  </Typography>
                </Box>
              </Box>
            </AccordionSummary>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                px: 1.25,
                pb: 1,
                pt: 0.25,
                flexWrap: { xs: 'wrap', md: 'nowrap' },
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  minWidth: 0,
                  flexWrap: 'wrap',
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    fontSize: '0.65rem',
                    textTransform: 'uppercase',
                    letterSpacing: '.04em',
                  }}
                >
                  {t('Planner qty', 'Qte planner')}
                </Typography>
                <TextField
                  type="number"
                  size="small"
                  value={plannerQuantityValue}
                  onChange={(event) =>
                    setResourceQuantities((prev) => ({
                      ...prev,
                      [resourceEntry.resourceName]: event.target.value,
                    }))}
                  onBlur={() =>
                    setResourceQuantities((prev) => ({
                      ...prev,
                      [resourceEntry.resourceName]: formatQuantityValue(
                        normalizePlannerQuantity(
                          prev[resourceEntry.resourceName],
                          requiredQuantity,
                          resourceEntry.quantityUnit,
                        ),
                        resourceEntry.quantityUnit,
                      ),
                    }))}
                  slotProps={{
                    htmlInput: {
                      min: 0,
                      step: quantityStep,
                      'aria-label': `${resourceEntry.resourceName} ${t('quantity', 'quantite')}`,
                      style: {
                        width: 62,
                        textAlign: 'right',
                        padding: '3px 6px',
                        fontSize: '0.78rem',
                        fontFamily: "'Share Tech Mono', monospace",
                      },
                    },
                  }}
                  sx={{
                    width: 82,
                    flexShrink: 0,
                    '& .MuiOutlinedInput-root': {
                      height: 30,
                      backgroundColor: alpha(theme.palette.common.white, 0.02),
                    },
                  }}
                />
                <Typography variant="caption" sx={{ color: 'text.disabled', whiteSpace: 'nowrap' }}>
                  {resourceEntry.quantityUnit === 'count'
                    ? t('items', 'objets')
                    : 'SCU'}
                </Typography>
              </Box>

              <Box sx={{ width: { xs: '100%', md: 'auto' }, ml: { md: 'auto' } }}>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() =>
                    onAddResource(
                      resourceEntry.resourceName,
                      plannerQuantity,
                      resourceEntry.quantityUnit,
                    )}
                  sx={{
                    width: { xs: '100%', sm: 'auto' },
                    minWidth: { sm: 132 },
                  }}
                >
                  {t('Add to Planner', 'Ajouter au planificateur')}
                </Button>
              </Box>
            </Box>

            <AccordionDetails sx={{ px: 1.25, pt: 0, pb: 1.25 }}>
              {!materialSources?.resources ? (
                loading ? (
                  <LinearProgress />
                ) : !hasResourceData ? (
                  <DatasetTooOldNotice />
                ) : (
                  <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                    {t('No source data available', 'Aucune donnee de source disponible')}
                  </Typography>
                )
                ) : providers.length === 0 ? (
                  <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                    {t('No source data available', 'Aucune donnee de source disponible')}
                  </Typography>
                ) : (
                <Table size="small" aria-label={resourceEntry.resourceName}>
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('Provider', 'Fournisseur')}</TableCell>
                      <TableCell>{t('Method', 'Methode')}</TableCell>
                      <TableCell>{t('Type', 'Type')}</TableCell>
                      <TableCell>{t('System', 'Systeme')}</TableCell>
                      <TableCell>{t('Share', 'Part')}</TableCell>
                      <TableCell>{t('Tier', 'Tier')}</TableCell>
                      <TableCell>{t('Confidence', 'Confiance')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {providers.map((provider, index) => {
                      const iconName = getMaterialProviderIconName(
                        provider.providerType,
                        provider.providerDisplayName,
                        provider.system,
                      );

                      return (
                        <TableRow key={`${provider.providerDisplayName}-${index}`}>
                          <TableCell>
                            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                              {iconName && (
                                <StarCitizenLicensedIcon name={iconName} size={14} dimmed />
                              )}
                              <span>{provider.providerDisplayName}</span>
                            </Box>
                          </TableCell>
                          <TableCell>{formatMaterialSourceMethod(provider.sourceMethod, lang)}</TableCell>
                          <TableCell>{formatMaterialProviderType(provider.providerType, lang)}</TableCell>
                          <TableCell>{provider.system ?? '-'}</TableCell>
                          <TableCell>
                            {getMaterialProviderProbabilityPct(provider) != null
                              ? `${getMaterialProviderProbabilityPct(provider)}%`
                              : '-'}
                          </TableCell>
                          <TableCell>{provider.tier ?? '-'}</TableCell>
                          <TableCell>{formatMaterialProviderConfidence(provider.labelConfidence, lang)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}

              {providers.some((provider) => provider.mineableGroupName) && (
                <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.disabled' }}>
                  {providers
                    .map((provider) => provider.mineableGroupName)
                    .filter((groupName, index, list): groupName is string =>
                      Boolean(groupName) && list.indexOf(groupName) === index,
                    )
                    .map((groupName) => formatMineableGroupName(groupName))
                    .join(' | ')}
                </Typography>
              )}
            </AccordionDetails>
          </Accordion>
        );
      })}

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'stretch', mt: 1 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            border: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '.65rem' }}>
            {t('Blueprint qty', 'Qte blueprint')}
          </Typography>
          <TextField
            type="number"
            size="small"
            value={qty}
            onChange={(event) => setQty(Math.max(1, Math.min(99, Number(event.target.value) || 1)))}
            slotProps={{
              htmlInput: {
                min: 1,
                max: 99,
                'aria-label': t('Quantity', 'Quantite'),
                style: {
                  width: 40,
                  textAlign: 'center',
                  padding: '4px 0',
                  fontSize: '.85rem',
                },
              },
            }}
            sx={{
              width: 48,
              '& .MuiOutlinedInput-root': {
                '& fieldset': { border: 'none' },
              },
            }}
          />
        </Box>
        <Box sx={{ flex: 1 }}>
          <AppButton variant="gradient" size="md" fullWidth onClick={onAddGoal}>
            {t('Add Goal to Planner', 'Ajouter l objectif au planificateur')}
          </AppButton>
        </Box>
      </Box>
    </Box>
  );
}
