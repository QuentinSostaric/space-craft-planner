import { useMemo } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { alpha, useTheme } from '@mui/material/styles';
import { useI18n } from '../../i18n/I18nContext';
import {
  formatProbabilityPercent,
  formatScaleLabel,
  formatStandingLabel,
  getMissionBlueprintDropChance,
  getMissionContractName,
} from '../../utils/crafting';
import { DatasetTooOldNotice } from '../ui/DatasetTooOldNotice';
import { StarCitizenLicensedIcon, getLocationIconName } from '../ui/StarCitizenLicensedIcon';
import { missionPathFromSlug, missionSlugFromContract } from '../../utils/slug';
import { shouldHandleInternalLinkClick } from '../../utils/spaLinks';
import type {
  AcquisitionContract,
  AcquisitionGraphEntry,
  MissionContract,
  MissionRewardsData,
} from '../../types';
import { FONT_HEADING } from '../../theme';

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

  if (haystack.includes('fps')) return 'fps';
  if (haystack.includes('ship')) return 'ship';
  return 'unknown';
}

function getMissionTypeLabel(missionType: 'fps' | 'ship' | 'unknown', lang: 'en' | 'fr' | 'de') {
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
      const rewardedBlueprints = new Map(previous.rewardedBlueprints.map((bp) => [bp.id, bp]));
      for (const blueprint of contract.rewardedBlueprints ?? []) {
        if (!blueprint.id || !blueprint.name) continue;
        rewardedBlueprints.set(blueprint.id, { id: blueprint.id, name: blueprint.name });
      }
      map.set(key, {
        missionType:
          previous.missionType !== 'unknown'
            ? previous.missionType
            : getMissionTypeFromContract(contract),
        rewardedBlueprints: [...rewardedBlueprints.values()].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      });
    }
  }
  return map;
}

function CompactFact({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <Paper
      variant="outlined"
      sx={{
        px: 1,
        py: 0.75,
        minWidth: 0,
        backgroundColor: alpha(theme.palette.background.default, 0.28),
      }}
    >
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          color: 'text.disabled',
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

export function AcquisitionSection({
  entry,
  loading,
  missionRewards,
  factionContractsByFactionId,
  onMissionClick,
}: AcquisitionSectionProps) {
  const { lang, t } = useI18n();
  const theme = useTheme();

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

  const panelSx = {
    p: 2,
    border: `1px solid ${theme.palette.ui.border}`,
    background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`,
  };

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
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {/* Summary strip */}
          <Paper
            variant="outlined"
            sx={{
              p: { xs: 1.25, md: 1.5 },
              border: `1px solid ${theme.palette.ui.border}`,
              background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`,
            }}
          >
            <Stack spacing={0.85}>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                <Chip
                  label={`${entry.contractCount} ${t('contracts', 'contrats')}`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`${entry.factionCount} ${t('factions', 'factions')}`}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`${entry.localityCount} ${t('localities', 'localites')}`}
                  size="small"
                  variant="outlined"
                />
                {missionTypeLabels.map((type) => (
                  <Chip
                    key={type}
                    label={getMissionTypeLabel(type, lang)}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                ))}
                {entry.dropScore > 0 && (
                  <Chip
                    label={`${t('Drop score', 'Score drop')}: ${formatProbabilityPercent(entry.dropScore)}`}
                    size="small"
                    color="secondary"
                    variant="outlined"
                  />
                )}
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
            </Stack>
          </Paper>

          {/* Per-faction cards */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' },
              gap: 1.25,
            }}
          >
            {entry.factions.map((faction, index) => {
              const factionMissionTypes = normalizeMissionTypes(
                faction.contracts,
                contractDetailsByKey,
                faction.contractorDisplayName,
              );
              const topScale =
                faction.derivedScales.length > 0
                  ? formatScaleLabel(faction.derivedScales[0], lang)
                  : '-';
              const uniqueStandings = [
                ...new Map(
                  faction.standings.map((s) => [
                    `${s.factionName ?? ''}-${s.scopeName ?? ''}-${s.standingName ?? ''}`,
                    s,
                  ]),
                ).values(),
              ];

              return (
                <Card
                  key={faction.contractorDisplayName ?? String(index)}
                  variant="outlined"
                  sx={{
                    overflow: 'hidden',
                    backgroundColor: 'background.paper',
                    borderColor: alpha(theme.palette.primary.main, 0.22),
                  }}
                >
                  {/* Card header */}
                  <Box
                    sx={{
                      px: 1.25,
                      py: 1,
                      borderBottom: 1,
                      borderColor: 'divider',
                      background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.16)} 0%, ${alpha(theme.palette.background.paper, 0.94)} 100%)`,
                    }}
                  >
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) auto' },
                        gap: 1,
                        alignItems: 'start',
                      }}
                    >
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
                          {faction.contractorDisplayName ?? t('Unknown', 'Inconnu')}
                        </Typography>
                        <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.65 }}>
                          {faction.faction?.factionType && (
                            <Chip
                              label={faction.faction.factionType}
                              size="small"
                              variant="outlined"
                            />
                          )}
                          {factionMissionTypes.map((type) => (
                            <Chip
                              key={type}
                              label={getMissionTypeLabel(type, lang)}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          ))}
                        </Stack>
                      </Box>

                      {/* CompactFact metrics */}
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, minmax(56px, 1fr))',
                          gap: 0.6,
                          gridColumn: { xs: '1 / -1', md: 'auto' },
                        }}
                      >
                        <CompactFact label={t('Scale', 'Portee')} value={topScale} />
                        <CompactFact
                          label={t('Max rep', 'Rep max')}
                          value={faction.maxReputation > 0 ? String(faction.maxReputation) : '-'}
                        />
                        <CompactFact
                          label={t('Locations', 'Lieux')}
                          value={String(faction.localityCount || faction.localities.length)}
                        />
                      </Box>
                    </Box>

                    {/* Standing requirements */}
                    {uniqueStandings.length > 0 && (
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.75 }}>
                        {uniqueStandings.map((standing, si) => {
                          const label = formatStandingLabel(standing, lang);
                          const repSuffix =
                            standing.minReputation != null && standing.minReputation !== 0
                              ? ` ≥ ${standing.minReputation}`
                              : '';
                          return (
                            <Chip
                              key={si}
                              label={`${label}${repSuffix}`}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.6rem', height: 18 }}
                            />
                          );
                        })}
                      </Box>
                    )}

                    {/* Locality chips */}
                    {faction.localities.length > 0 && (
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.75 }}>
                        {faction.localities.map((locality) => (
                          <Chip
                            key={locality}
                            label={locality}
                            size="small"
                            icon={
                              getLocationIconName(locality) ? (
                                <StarCitizenLicensedIcon
                                  name={getLocationIconName(locality)!}
                                  size={12}
                                  dimmed
                                />
                              ) : undefined
                            }
                            sx={{ fontSize: '0.6rem', height: 18 }}
                          />
                        ))}
                      </Box>
                    )}
                  </Box>

                  <CardContent sx={{ p: 1.1, '&:last-child': { pb: 1.1 } }}>
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
                          '& .MuiAccordionSummary-content': { my: 0.35, minWidth: 0 },
                        }}
                      >
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {t('Contracts', 'Contrats')}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {faction.contracts
                              .slice(0, 3)
                              .map(getMissionContractName)
                              .filter(Boolean)
                              .join(' • ')}
                            {faction.contracts.length > 3
                              ? ` +${faction.contracts.length - 3}`
                              : ''}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`${faction.contractCount} ${t('contracts', 'contrats')}`}
                          sx={{ mr: 0.75 }}
                        />
                      </AccordionSummary>

                      <AccordionDetails sx={{ px: 1, pb: 1, pt: 0 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {faction.contracts.map((contract, contractIndex) => {
                            const detail =
                              contractDetailsByKey.get(
                                buildContractKey(
                                  contract.contractDebugName,
                                  faction.contractorDisplayName,
                                ),
                              ) ?? EMPTY_CONTRACT_DETAIL;
                            const dropChance = getMissionBlueprintDropChance(contract);
                            const contractLocations =
                              contract.availability.localities.length > 0
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
                                  borderBottom:
                                    contractIndex === faction.contracts.length - 1 ? 0 : 1,
                                  borderColor: 'divider',
                                }}
                              >
                                {/* Name + scale */}
                                <Box
                                  sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: 1,
                                  }}
                                >
                                  {contract.contractDebugName && onMissionClick ? (
                                    <Link
                                      href={missionPathFromSlug(
                                        missionSlugFromContract(
                                          contract.contractDebugName,
                                          faction.contractorDisplayName,
                                        ),
                                      )}
                                      underline="hover"
                                      onClick={(event) => {
                                        if (!shouldHandleInternalLinkClick(event)) return;
                                        event.preventDefault();
                                        onMissionClick(
                                          contract.contractDebugName,
                                          faction.contractorDisplayName,
                                        );
                                      }}
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
                                    <Typography
                                      variant="body2"
                                      sx={{ fontWeight: 600, fontSize: '0.85rem' }}
                                    >
                                      {getMissionContractName(contract) ||
                                        t('Unknown contract', 'Contrat inconnu')}
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

                                {/* Type + probabilities */}
                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                  <Chip
                                    label={getMissionTypeLabel(detail.missionType, lang)}
                                    size="small"
                                    variant="outlined"
                                    color="primary"
                                    sx={{ fontSize: '0.65rem', height: 20 }}
                                  />
                                  {dropChance > 0 && (
                                    <Chip
                                      label={`${t('Drop', 'Drop')}: ${formatProbabilityPercent(dropChance)}`}
                                      size="small"
                                      variant="outlined"
                                      sx={{ fontSize: '0.65rem', height: 20 }}
                                    />
                                  )}
                                  {contract.expectedRewardShare != null &&
                                    contract.expectedRewardShare > 0 && (
                                      <Chip
                                        label={`${t('Share', 'Part')}: ${formatProbabilityPercent(contract.expectedRewardShare)}`}
                                        size="small"
                                        variant="outlined"
                                        sx={{ fontSize: '0.65rem', height: 20 }}
                                      />
                                    )}
                                  {contract.maxChance != null && contract.maxChance > 0 && (
                                    <Chip
                                      label={`${t('Max', 'Max')}: ${formatProbabilityPercent(contract.maxChance)}`}
                                      size="small"
                                      variant="outlined"
                                      color="secondary"
                                      sx={{ fontSize: '0.65rem', height: 20 }}
                                    />
                                  )}
                                </Box>

                                {/* Standing requirements with minReputation */}
                                {contract.minimumRequiredStandings.length > 0 && (
                                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                    {contract.minimumRequiredStandings.map((standing, si) => {
                                      const label = formatStandingLabel(standing, lang);
                                      const repSuffix =
                                        standing.minReputation != null &&
                                        standing.minReputation !== 0
                                          ? ` ≥ ${standing.minReputation}`
                                          : '';
                                      return (
                                        <Chip
                                          key={si}
                                          label={`${label}${repSuffix}`}
                                          size="small"
                                          variant="outlined"
                                          sx={{ fontSize: '0.65rem', height: 20 }}
                                        />
                                      );
                                    })}
                                  </Box>
                                )}

                                {/* Locations */}
                                {contractLocations.length > 0 && (
                                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                    {contractLocations.map((locality) => (
                                      <Chip
                                        key={locality}
                                        label={locality}
                                        size="small"
                                        icon={
                                          getLocationIconName(locality) ? (
                                            <StarCitizenLicensedIcon
                                              name={getLocationIconName(locality)!}
                                              size={12}
                                              dimmed
                                            />
                                          ) : undefined
                                        }
                                        sx={{ fontSize: '0.65rem', height: 20 }}
                                      />
                                    ))}
                                  </Box>
                                )}

                                {/* Blueprint pool */}
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color: 'text.secondary',
                                      fontWeight: 600,
                                      letterSpacing: '0.04em',
                                    }}
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
                                          variant={
                                            blueprint.id === entry.blueprint.id
                                              ? 'filled'
                                              : 'outlined'
                                          }
                                          color={
                                            blueprint.id === entry.blueprint.id
                                              ? 'primary'
                                              : 'default'
                                          }
                                          sx={{ fontSize: '0.65rem', height: 20 }}
                                        />
                                      ))
                                    ) : (
                                      <Typography
                                        variant="caption"
                                        sx={{ color: 'text.disabled' }}
                                      >
                                        {t(
                                          'No blueprint pool data',
                                          'Aucune donnee de pool blueprint',
                                        )}
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
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        </Box>
      )}
    </Box>
  );
}
