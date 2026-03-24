import type { SyntheticEvent } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { alpha, useTheme } from '@mui/material/styles';
import { useI18n } from '../../i18n/I18nContext';
import { getMaterialProviders, summarizeAssignedQualities } from '../../utils/crafting';
import type { AggregatedResource, MaterialSources, Resource } from '../../types';
import { Button as AppButton } from '../ui/Button';
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

function formatScu(totalScu: number) {
  if (totalScu >= 10) {
    return totalScu.toFixed(0);
  }

  if (totalScu >= 1) {
    return totalScu.toFixed(1);
  }

  return totalScu.toFixed(2);
}

function stopAccordionToggle(event: SyntheticEvent) {
  event.stopPropagation();
}

interface MaterialSourcesSectionProps {
  resources: AggregatedResource[];
  allResources: Resource[];
  materialSources: MaterialSources | null;
  qty: number;
  setQty: (val: number) => void;
  onAddGoal: () => void;
  onAddResource: (resourceName: string, quantityScu: number) => void;
}

export function MaterialSourcesSection({
  resources,
  allResources,
  materialSources,
  qty,
  setQty,
  onAddGoal,
  onAddResource,
}: MaterialSourcesSectionProps) {
  const { lang, t } = useI18n();
  const theme = useTheme();

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
        const requiredScu = Math.round(resourceEntry.totalScu * qty * 1000) / 1000;

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
              expandIcon={<ExpandMoreIcon sx={{ fontSize: '1rem' }} />}
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
                    {formatScu(requiredScu)} SCU
                  </Typography>
                </Box>

                <Box
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                  onClick={stopAccordionToggle}
                  onFocusCapture={stopAccordionToggle}
                >
                  <Button
                    variant="contained"
                    size="small"
                    onClick={(event) => {
                      stopAccordionToggle(event);
                      onAddResource(resourceEntry.resourceName, requiredScu);
                    }}
                    sx={{
                      width: { xs: '100%', sm: 'auto' },
                      minWidth: { sm: 132 },
                    }}
                  >
                    {t('Add to Planner', 'Ajouter au planificateur')}
                  </Button>
                </Box>
              </Box>
            </AccordionSummary>

            <AccordionDetails sx={{ px: 1.25, pt: 0, pb: 1.25 }}>
              {providers.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                  {t('No source data available', 'Aucune donnee de source disponible')}
                </Typography>
              ) : (
                <Table size="small" aria-label={resourceEntry.resourceName}>
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('Provider', 'Fournisseur')}</TableCell>
                      <TableCell>{t('Type', 'Type')}</TableCell>
                      <TableCell>{t('System', 'Systeme')}</TableCell>
                      <TableCell>{t('Probability', 'Probabilite')}</TableCell>
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
                          <TableCell>{provider.providerType}</TableCell>
                          <TableCell>{provider.system ?? '-'}</TableCell>
                          <TableCell>{provider.groupProbabilityPct != null ? `${provider.groupProbabilityPct}%` : '-'}</TableCell>
                          <TableCell>{provider.tier ?? '-'}</TableCell>
                          <TableCell>{provider.labelConfidence}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
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
