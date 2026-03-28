import { useMemo } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { useI18n } from '../../i18n/I18nContext';
import {
  formatProbabilityPercent,
  formatScaleLabel,
  getMissionBlueprintDropChance,
  getMissionContractName,
} from '../../utils/crafting';
import { AppGlyph } from '../ui/AppGlyph';
import { DatasetTooOldNotice } from '../ui/DatasetTooOldNotice';
import { StarCitizenLicensedIcon, getLocationIconName } from '../ui/StarCitizenLicensedIcon';
import type {
  AcquisitionContract,
  AcquisitionGraphEntry,
  MissionContract,
  MissionRewardsData,
} from '../../types';

interface AcquisitionSectionProps {
  entry: AcquisitionGraphEntry | null;
  loading: boolean;
  missionRewards: MissionRewardsData | null;
  factionContractsByFactionId: Record<string, MissionContract[]>;
  onMissionClick?: (contractDebugName: string, contractorDisplayName: string | null) => void;
}

interface RewardPoolBlueprint {
  id: string;
  name: string;
}

interface AcquisitionContractDetail {
  missionType: 'fps' | 'ship' | 'unknown';
  rewardedBlueprints: RewardPoolBlueprint[];
}

const EMPTY_CONTRACT_DETAIL: AcquisitionContractDetail = {
  missionType: 'unknown',
  rewardedBlueprints: [],
};

function getMissionTypeFromContract(contract: Partial<MissionContract> | Partial<AcquisitionContract>) {
  const haystack = [
    contract.contractDebugName,
    'handlerDebugName' in contract ? contract.handlerDebugName : null,
    'contractFile' in contract ? contract.contractFile : null,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (haystack.includes('fps')) {
    return 'fps';
  }

  if (haystack.includes('ship')) {
    return 'ship';
  }

  return 'unknown';
}

function getMissionTypeLabel(
  missionType: 'fps' | 'ship' | 'unknown',
  lang: 'en' | 'fr' | 'de',
) {
  if (missionType === 'fps') {
    if (lang === 'fr') return 'Mission FPS';
    if (lang === 'de') return 'FPS-Mission';
    return 'FPS mission';
  }

  if (missionType === 'ship') {
    if (lang === 'fr') return 'Mission vaisseau';
    if (lang === 'de') return 'Schiffsmission';
    return 'Ship mission';
  }

  if (lang === 'fr') return 'Type inconnu';
  if (lang === 'de') return 'Unbekannter Typ';
  return 'Unknown type';
}

function buildContractKey(contractDebugName: string | null, contractorDisplayName: string | null) {
  return `${contractorDisplayName ?? ''}::${contractDebugName ?? ''}`;
}

function normalizeStandingNames(contracts: AcquisitionContract[]) {
  return [...new Set(
    contracts.flatMap((contract) =>
      contract.minimumRequiredStandings
        .map((standing) => standing.standingName?.trim())
        .filter((standing): standing is string => Boolean(standing)),
    ),
  )];
}

function normalizeMissionTypes(
  contracts: AcquisitionContract[],
  detailsByKey: Map<string, AcquisitionContractDetail>,
  contractorDisplayName: string | null,
) {
  return [...new Set(
    contracts
      .map((contract) => {
        const key = buildContractKey(contract.contractDebugName, contractorDisplayName);
        return detailsByKey.get(key)?.missionType ?? 'unknown';
      })
      .filter((missionType) => missionType !== 'unknown'),
  )] as Array<'fps' | 'ship'>;
}

function buildContractDetailsMap(
  missionRewards: MissionRewardsData | null,
  factionContractsByFactionId: Record<string, MissionContract[]>,
) {
  const map = new Map<string, AcquisitionContractDetail>();

  for (const group of missionRewards?.factionGroups ?? []) {
    for (const contract of factionContractsByFactionId[group.id] ?? group.contracts ?? []) {
      const key = buildContractKey(contract.contractDebugName, group.contractorDisplayName);
      const previous = map.get(key) ?? EMPTY_CONTRACT_DETAIL;
      const rewardedBlueprints = new Map(
        previous.rewardedBlueprints.map((blueprint) => [blueprint.id, blueprint]),
      );

      for (const blueprint of contract.rewardedBlueprints ?? []) {
        if (!blueprint.id || !blueprint.name) continue;
        rewardedBlueprints.set(blueprint.id, {
          id: blueprint.id,
          name: blueprint.name,
        });
      }

      map.set(key, {
        missionType:
          previous.missionType !== 'unknown'
            ? previous.missionType
            : getMissionTypeFromContract(contract),
        rewardedBlueprints: [...rewardedBlueprints.values()].sort((left, right) =>
          left.name.localeCompare(right.name),
        ),
      });
    }
  }

  return map;
}

export function AcquisitionSection({
  entry,
  loading,
  missionRewards,
  factionContractsByFactionId,
  onMissionClick,
}: AcquisitionSectionProps) {
  const { lang, t } = useI18n();
  const theme = useTheme();
  const panelSx = {
    p: 2,
    border: `1px solid ${theme.palette.ui.border}`,
    background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`,
  };

  const contractDetailsByKey = useMemo(
    () => buildContractDetailsMap(missionRewards, factionContractsByFactionId),
    [missionRewards, factionContractsByFactionId],
  );

  const missionTypeLabels = useMemo(() => {
    if (!entry) return [];
    return [...new Set(
      entry.factions.flatMap((faction) =>
        normalizeMissionTypes(faction.contracts, contractDetailsByKey, faction.contractorDisplayName),
      ),
    )];
  }, [contractDetailsByKey, entry]);

  return (
    <Box
      component="section"
      aria-label={t('Acquisition', 'Acquisition')}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}
    >
      <Typography variant="overline" sx={{ display: 'block' }}>
        {t('Acquisition', 'Acquisition')}
      </Typography>

      {loading && (
        <Paper sx={panelSx}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <LinearProgress />
            <Skeleton variant="rectangular" height={48} sx={{ borderRadius: 0.5 }} />
            <Skeleton variant="rectangular" height={96} sx={{ borderRadius: 0.5 }} />
          </Box>
        </Paper>
      )}

      {!loading && !entry && (
        <Paper sx={panelSx}>
          {missionRewards ? (
            <Typography variant="body2" sx={{ color: 'text.disabled' }}>
              {t('Not obtainable via missions', 'Non obtenable via les missions')}
            </Typography>
          ) : (
            <DatasetTooOldNotice />
          )}
        </Paper>
      )}

      {!loading && entry && (
        <Paper sx={panelSx}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              <Chip label={`${entry.contractCount} ${t('contracts', 'contrats')}`} size="small" variant="outlined" />
              <Chip label={`${entry.factionCount} ${t('factions', 'factions')}`} size="small" variant="outlined" />
              <Chip label={`${entry.localityCount} ${t('localities', 'localites')}`} size="small" variant="outlined" />
              {missionTypeLabels.map((missionType) => (
                <Chip
                  key={missionType}
                  label={getMissionTypeLabel(missionType, lang)}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              ))}
            </Box>

            {entry.localities.length > 0 && (
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {entry.localities.map((locality) => (
                  <Chip
                    key={locality}
                    label={locality}
                    size="small"
                    icon={
                      getLocationIconName(locality) ? (
                        <StarCitizenLicensedIcon name={getLocationIconName(locality)!} size={13} dimmed />
                      ) : undefined
                    }
                    sx={{ fontSize: '0.65rem', height: 20 }}
                  />
                ))}
              </Box>
            )}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {entry.factions.map((faction, index) => {
                const standingNames = normalizeStandingNames(faction.contracts);
                const factionMissionTypes = normalizeMissionTypes(
                  faction.contracts,
                  contractDetailsByKey,
                  faction.contractorDisplayName,
                );

                return (
                  <Accordion
                    key={faction.contractorDisplayName ?? String(index)}
                    disableGutters
                    sx={{
                      border: `1px solid ${theme.palette.ui.border}`,
                      backgroundColor: theme.palette.ui.surface1,
                      '&::before': { display: 'none' },
                    }}
                  >
              <AccordionSummary expandIcon={<AppGlyph name="caret-up" size={18} />}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, width: '100%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                            {faction.contractorDisplayName ?? t('Unknown', 'Inconnu')}
                          </Typography>
                          {faction.faction?.factionType && (
                            <Chip
                              label={faction.faction.factionType}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.6rem', height: 18 }}
                            />
                          )}
                          <Chip
                            label={`${faction.contractCount} ${t('contracts', 'contrats')}`}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.6rem', height: 18, ml: 'auto', mr: 1 }}
                          />
                        </Box>

                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {factionMissionTypes.map((missionType) => (
                            <Chip
                              key={missionType}
                              label={getMissionTypeLabel(missionType, lang)}
                              size="small"
                              color="primary"
                              variant="outlined"
                              sx={{ fontSize: '0.6rem', height: 18 }}
                            />
                          ))}
                          {standingNames.map((standingName) => (
                            <Chip
                              key={standingName}
                              label={standingName}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.6rem', height: 18 }}
                            />
                          ))}
                          {faction.localities.map((locality) => (
                            <Chip
                              key={locality}
                              label={locality}
                              size="small"
                              icon={
                                getLocationIconName(locality) ? (
                                  <StarCitizenLicensedIcon name={getLocationIconName(locality)!} size={12} dimmed />
                                ) : undefined
                              }
                              sx={{ fontSize: '0.6rem', height: 18 }}
                            />
                          ))}
                        </Box>
                      </Box>
                    </AccordionSummary>

                    <AccordionDetails sx={{ pt: 0 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {faction.contracts.map((contract, contractIndex) => {
                          const detail =
                            contractDetailsByKey.get(
                              buildContractKey(contract.contractDebugName, faction.contractorDisplayName),
                            ) ?? EMPTY_CONTRACT_DETAIL;
                          const blueprintDropChance = getMissionBlueprintDropChance(contract);
                          const contractStandingNames = [...new Set(
                            contract.minimumRequiredStandings
                              .map((standing) => standing.standingName?.trim())
                              .filter((standing): standing is string => Boolean(standing)),
                          )];
                          const contractLocations = contract.availability.localities.length > 0
                            ? contract.availability.localities
                            : contract.availability.explicitLocations;

                          return (
                            <Box
                              key={contract.contractDebugName ?? String(contractIndex)}
                              sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 0.75,
                                py: 1,
                                borderBottom: contractIndex === faction.contracts.length - 1 ? 0 : 1,
                                borderColor: 'divider',
                              }}
                            >
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                                {contract.contractDebugName && onMissionClick ? (
                                  <Link
                                    component="button"
                                    type="button"
                                    underline="hover"
                                    onClick={() => onMissionClick(contract.contractDebugName, faction.contractorDisplayName)}
                                    sx={{
                                      fontWeight: 600,
                                      fontSize: '0.85rem',
                                      color: 'text.primary',
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {getMissionContractName(contract)}
                                  </Link>
                                ) : (
                                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                                    {getMissionContractName(contract) || t('Unknown contract', 'Contrat inconnu')}
                                  </Typography>
                                )}
                                <Chip
                                  label={formatScaleLabel(contract.availability.derivedScale, lang)}
                                  size="small"
                                  variant="outlined"
                                  color="primary"
                                  sx={{ fontSize: '0.65rem', height: 20 }}
                                />
                              </Box>

                              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                <Chip
                                  label={getMissionTypeLabel(detail.missionType, lang)}
                                  size="small"
                                  variant="outlined"
                                  color="primary"
                                  sx={{ fontSize: '0.65rem', height: 20 }}
                                />
                                {blueprintDropChance > 0 && (
                                  <Chip
                                    label={`${formatProbabilityPercent(blueprintDropChance)} ${t('chance', 'chance')}`}
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontSize: '0.65rem', height: 20 }}
                                  />
                                )}
                                {contractStandingNames.map((standingName) => (
                                  <Chip
                                    key={standingName}
                                    label={standingName}
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontSize: '0.65rem', height: 20 }}
                                  />
                                ))}
                                {contractLocations.map((locality) => (
                                  <Chip
                                    key={locality}
                                    label={locality}
                                    size="small"
                                    icon={
                                      getLocationIconName(locality) ? (
                                        <StarCitizenLicensedIcon name={getLocationIconName(locality)!} size={12} dimmed />
                                      ) : undefined
                                    }
                                    sx={{ fontSize: '0.65rem', height: 20 }}
                                  />
                                ))}
                              </Box>

                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                <Typography
                                  variant="caption"
                                  sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: '0.04em' }}
                                >
                                  {t('Blueprint pool', 'Pool de blueprints')}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                  {detail.rewardedBlueprints.length > 0 ? (
                                    detail.rewardedBlueprints.map((blueprint) => (
                                      <Chip
                                        key={blueprint.id}
                                        label={blueprint.name}
                                        size="small"
                                        variant={blueprint.id === entry.blueprint.id ? 'filled' : 'outlined'}
                                        color={blueprint.id === entry.blueprint.id ? 'primary' : 'default'}
                                        sx={{ fontSize: '0.65rem', height: 20 }}
                                      />
                                    ))
                                  ) : (
                                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                                      {t('No blueprint pool data', 'Aucune donnee de pool blueprint')}
                                    </Typography>
                                  )}
                                </Box>
                              </Box>
                            </Box>
                          );
                        })}
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                );
              })}
            </Box>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
