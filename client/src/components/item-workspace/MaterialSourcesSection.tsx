import { useEffect, useMemo, useState } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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
import { DatasetTooOldNotice } from '../ui/DatasetTooOldNotice';
import { ResourceIcon } from '../ui/ResourceIcon';
import {
  StarCitizenLicensedIcon,
  getMaterialProviderIconName,
} from '../ui/StarCitizenLicensedIcon';
import { FONT_HEADING, FONT_MONO } from '../../theme';

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

function CompactFact({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        px: 1,
        py: 0.75,
        minWidth: 0,
        backgroundColor: (theme) => alpha(theme.palette.background.default, 0.2),
      }}
    >
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          mb: 0.3,
        }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {value}
      </Typography>
    </Paper>
  );
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
      id="blueprint-materials"
      component="section"
      aria-label={t('Material sources', 'Sources de materiaux')}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.35, scrollMarginTop: 18 }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) auto' },
          gap: 1,
          alignItems: 'end',
        }}
      >
        <Stack spacing={0.35} sx={{ minWidth: 0, alignSelf: 'center' }}>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontSize: '0.75rem',
              lineHeight: 1.15,
            }}
          >
            {resources.length === 1
              ? t('1 required resource', '1 ressource requise')
              : `${resources.length} ${t('required resources', 'ressources requises')}`}
          </Typography>
        </Stack>

        <Paper
          variant="outlined"
          sx={{
            px: 1,
            py: 0.75,
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            flexWrap: 'wrap',
            justifyContent: { xs: 'space-between', md: 'flex-end' },
            borderColor: alpha(theme.palette.primary.main, 0.18),
            backgroundColor: alpha(theme.palette.background.default, 0.24),
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.6875rem' }}>
              {t('Qty', 'Qte')}
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
                    width: 44,
                    textAlign: 'center',
                    padding: '4px 0',
                    fontSize: '.85rem',
                  },
                },
              }}
              sx={{
                width: 56,
                '& .MuiOutlinedInput-root': {
                  height: 32,
                  '& fieldset': { border: 'none' },
                },
              }}
            />
          </Box>

          <AppButton variant="secondary" size="sm" onClick={onAddGoal}>
            {t('Add Goal to Planner', 'Ajouter l objectif au planificateur')}
          </AppButton>
        </Paper>
      </Box>

      {loading && !materialSources?.resources && <LinearProgress />}
      {!loading && !materialSources?.resources && !hasResourceData && (
        <DatasetTooOldNotice variant="caption" />
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' },
          gap: 1.25,
        }}
      >
        {resources.map((resourceEntry) => {
          const providers = getMaterialProviders(materialSources, resourceEntry.resourceName);
          const leadProvider = providers[0] ?? null;
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
          const systems = [...new Set(providers.map((provider) => provider.system).filter(Boolean))] as string[];
          const sourceMethods = [
            ...new Set(
              providers
                .map((provider) => provider.sourceMethod)
                .filter(Boolean)
                .map((sourceMethod) => formatMaterialSourceMethod(sourceMethod, lang)),
            ),
          ];

          return (
            <Card
              key={resourceEntry.resourceName}
              variant="outlined"
              sx={{
                overflow: 'hidden',
                background: `linear-gradient(180deg, ${alpha(resource?.color ?? theme.palette.primary.main, 0.055)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 42%)`,
                borderColor: alpha(resource?.color ?? theme.palette.primary.main, 0.22),
              }}
            >
              <Box
                sx={{
                  px: 1.3,
                  py: 1.05,
                  borderBottom: 1,
                  borderColor: 'divider',
                  background: `linear-gradient(180deg, ${alpha(
                    resource?.color ?? theme.palette.primary.main,
                    0.16,
                  )} 0%, ${alpha(theme.palette.background.paper, 0.94)} 100%)`,
                }}
              >
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '52px minmax(0, 1fr)', md: '52px minmax(0, 1fr) auto' },
                    gap: 1,
                    alignItems: 'center',
                  }}
                >
                  <Box
                    sx={{
                      width: 52,
                      height: 52,
                      borderRadius: 1.25,
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `1px solid ${theme.palette.ui.border}`,
                      backgroundColor: alpha(theme.palette.common.white, 0.04),
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
                      <ResourceIcon name={resourceEntry.resourceName} size={22} />
                    )}
                  </Box>

                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      sx={{
                        fontFamily: FONT_HEADING,
                        fontWeight: 700,
                        fontSize: '1.08rem',
                        lineHeight: 1,
                        textTransform: 'uppercase',
                      }}
                    >
                      {resourceEntry.resourceName}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.35 }}>
                      {summarizeAssignedQualities(
                        resourceEntry.assignedQualityValues,
                        resourceEntry.unassignedSlotCount,
                        lang,
                      )}
                    </Typography>
                    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.65 }}>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t(`${providers.length} providers`, `${providers.length} sources`)}
                      />
                      {sourceMethods.slice(0, 2).map((method) => (
                        <Chip key={method} size="small" variant="outlined" label={method} />
                      ))}
                    </Stack>
                  </Box>

                  <Paper
                    variant="outlined"
                    sx={{
                      px: 1,
                      py: 0.75,
                      minWidth: { xs: '100%', md: 128 },
                      gridColumn: { xs: '1 / -1', md: 'auto' },
                      borderColor: alpha(resource?.color ?? theme.palette.primary.main, 0.28),
                      backgroundColor: alpha(theme.palette.background.default, 0.32),
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        display: 'block',
                        color: 'text.secondary',
                        textTransform: 'uppercase',
                        letterSpacing: '0.12em',
                        mb: 0.3,
                      }}
                    >
                      {t('Required', 'Requis')}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ fontFamily: FONT_MONO, fontWeight: 700 }}
                    >
                      {formatResourceQuantity(requiredQuantity, resourceEntry.quantityUnit, lang)}
                    </Typography>
                  </Paper>
                </Box>
              </Box>

              <CardContent sx={{ p: 1.2, '&:last-child': { pb: 1.2 } }}>
                <Stack spacing={0.85}>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                      gap: 0.75,
                    }}
                  >
                    <CompactFact
                      label={t('Lead source', 'Source principale')}
                      value={leadProvider?.providerDisplayName ?? t('No source data', 'Aucune source')}
                    />
                    <CompactFact
                      label={t('System', 'Systeme')}
                      value={systems.length > 0 ? systems.join(' / ') : '-'}
                    />
                    <CompactFact
                      label={t('Top share', 'Part max')}
                      value={
                        leadProvider && getMaterialProviderProbabilityPct(leadProvider) != null
                          ? `${getMaterialProviderProbabilityPct(leadProvider)}%`
                          : '-'
                      }
                    />
                  </Box>

                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0.75,
                    }}
                  >
                    <Paper
                      variant="outlined"
                      sx={{
                        px: 1,
                        py: 0.85,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.6,
                        flexWrap: 'wrap',
                        justifyContent: 'space-between',
                        backgroundColor: alpha(theme.palette.background.default, 0.18),
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.6,
                          flexWrap: 'wrap',
                          minWidth: 0,
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'text.secondary',
                            textTransform: 'uppercase',
                            letterSpacing: '0.12em',
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
                                fontSize: '0.8rem',
                                fontFamily: FONT_MONO,
                              },
                            },
                          }}
                          sx={{
                            width: 84,
                            '& .MuiOutlinedInput-root': {
                              height: 30,
                              backgroundColor: alpha(theme.palette.common.white, 0.02),
                            },
                          }}
                        />
                        <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                          {resourceEntry.quantityUnit === 'count' ? t('items', 'objets') : 'SCU'}
                        </Typography>
                      </Box>

                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() =>
                          onAddResource(
                            resourceEntry.resourceName,
                            plannerQuantity,
                            resourceEntry.quantityUnit,
                          )}
                        sx={{
                          minHeight: 30,
                          px: 1.5,
                          whiteSpace: 'nowrap',
                          alignSelf: { xs: 'stretch', sm: 'center' },
                        }}
                      >
                        {t('Add to Planner', 'Ajouter au planificateur')}
                      </Button>
                    </Paper>
                  </Box>

                  {!materialSources?.resources ? (
                    loading ? (
                      <LinearProgress />
                    ) : !hasResourceData ? (
                      <DatasetTooOldNotice />
                    ) : (
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {t('No source data available', 'Aucune donnee de source disponible')}
                      </Typography>
                    )
                  ) : providers.length === 0 ? (
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {t('No source data available', 'Aucune donnee de source disponible')}
                    </Typography>
                  ) : (
                    <Accordion
                      disableGutters
                      elevation={0}
                      sx={{
                        border: `1px solid ${theme.palette.ui.border}`,
                        borderRadius: 1.25,
                        overflow: 'hidden',
                        backgroundColor: alpha(theme.palette.background.default, 0.18),
                        '&::before': { display: 'none' },
                      }}
                    >
                      <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        sx={{
                          minHeight: 0,
                          px: 1,
                          py: 0.35,
                          '& .MuiAccordionSummary-content': {
                            my: 0.35,
                            minWidth: 0,
                          },
                        }}
                      >
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {t('Detailed locations', 'Lieux detailles')}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {providers
                              .slice(0, 3)
                              .map((provider) => provider.providerDisplayName)
                              .filter(Boolean)
                              .join(' • ')}
                            {providers.length > 3
                              ? ` ${t(`+${providers.length - 3} more`, `+${providers.length - 3} autres`)}`
                              : ''}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={t(
                            `${providers.length} providers`,
                            `${providers.length} sources`,
                          )}
                          sx={{ mr: 0.75 }}
                        />
                      </AccordionSummary>

                      <AccordionDetails sx={{ px: 1, pb: 1, pt: 0 }}>
                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
                            gap: 0.6,
                          }}
                        >
                          {providers.map((provider, index) => {
                            const iconName = getMaterialProviderIconName(
                              provider.providerType,
                              provider.providerDisplayName,
                              provider.system,
                            );
                            const share = getMaterialProviderProbabilityPct(provider);

                            return (
                              <Paper
                                key={`${provider.providerDisplayName}-${index}`}
                                variant="outlined"
                                sx={{
                                  px: 1,
                                  py: 0.75,
                                  backgroundColor: alpha(theme.palette.background.paper, 0.42),
                                }}
                              >
                                <Box
                                  sx={{
                                    display: 'grid',
                                    gridTemplateColumns: '32px minmax(0, 1fr)',
                                    gap: 0.75,
                                    alignItems: 'start',
                                  }}
                                >
                                  <Box
                                    sx={{
                                      width: 32,
                                      height: 32,
                                      borderRadius: 1,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      border: `1px solid ${theme.palette.ui.border}`,
                                      backgroundColor: alpha(theme.palette.common.white, 0.03),
                                    }}
                                  >
                                    {iconName ? (
                                      <StarCitizenLicensedIcon name={iconName} size={18} dimmed />
                                    ) : (
                                      <ResourceIcon name={resourceEntry.resourceName} size={16} />
                                    )}
                                  </Box>

                                  <Box sx={{ minWidth: 0 }}>
                                    <Stack
                                      direction="row"
                                      spacing={0.75}
                                      alignItems="center"
                                      justifyContent="space-between"
                                      sx={{ mb: 0.4 }}
                                    >
                                      <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                                        {provider.providerDisplayName}
                                      </Typography>
                                      {share != null ? (
                                        <Chip size="small" variant="outlined" label={`${share}%`} />
                                      ) : null}
                                    </Stack>
                                    <Typography
                                      variant="caption"
                                      sx={{ color: 'text.secondary', display: 'block' }}
                                    >
                                      {provider.mineableGroupName
                                        ? formatMineableGroupName(provider.mineableGroupName)
                                        : provider.system ?? '-'}
                                    </Typography>
                                    <Stack
                                      direction="row"
                                      spacing={0.45}
                                      useFlexGap
                                      flexWrap="wrap"
                                      sx={{ mt: 0.55 }}
                                    >
                                      <Chip
                                        size="small"
                                        variant="outlined"
                                        label={formatMaterialSourceMethod(provider.sourceMethod, lang)}
                                      />
                                      <Chip
                                        size="small"
                                        variant="outlined"
                                        label={formatMaterialProviderType(provider.providerType, lang)}
                                      />
                                      {provider.tier ? (
                                        <Chip
                                          size="small"
                                          variant="outlined"
                                          label={`${t('Tier', 'Tier')} ${provider.tier}`}
                                        />
                                      ) : null}
                                      <Chip
                                        size="small"
                                        variant="outlined"
                                        label={formatMaterialProviderConfidence(provider.labelConfidence, lang)}
                                      />
                                    </Stack>
                                  </Box>
                                </Box>
                              </Paper>
                            );
                          })}
                        </Box>
                      </AccordionDetails>
                    </Accordion>
                  )}

                  {providers.some((provider) => provider.mineableGroupName) && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {providers
                        .map((provider) => provider.mineableGroupName)
                        .filter((groupName, index, list): groupName is string =>
                          Boolean(groupName) && list.indexOf(groupName) === index,
                        )
                        .map((groupName) => formatMineableGroupName(groupName))
                        .join(' | ')}
                    </Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Box>

    </Box>
  );
}
