import { Box, Paper, Skeleton, Stack, Typography, alpha, useTheme } from '../../ui/system';
import { Card, Chip, LinearProgress } from '../../ui/widgets';
import { ChevronRightIcon, FlagIcon, MilitaryTechOutlinedIcon, PlaceOutlinedIcon, TravelExploreOutlinedIcon } from '../../ui/icons';
import { useMemo } from 'react';
import { useI18n } from '../../i18n/I18nContext';
import {
  formatProbabilityPercent,
  formatScaleLabel,
  getMissionBlueprintDropChance,
  getMissionContractName,
} from '../../utils/crafting';
import { DatasetTooOldNotice } from '../ui/DatasetTooOldNotice';
import { StarCitizenLicensedIcon, getLocationIconName } from '../ui/StarCitizenLicensedIcon';
import { missionPathFromSlug, missionSlugFromContract, toSlug } from '../../utils/slug';
import { shouldHandleInternalLinkClick } from '../../utils/spaLinks';
import type {
  AcquisitionContract,
  AcquisitionGraphEntry,
  MissionContract,
  MissionRewardsData,
} from '../../types';
import { FONT_HEADING, FONT_MONO, TEXT_LABEL, TEXT_LABEL_LG, TEXT_LABEL_SM} from '../../theme';

interface AcquisitionSectionProps {
  entry: AcquisitionGraphEntry | null;
  loading: boolean;
  missionRewards: MissionRewardsData | null;
  factionContractsByFactionId: Record<string, MissionContract[]>;
  onMissionClick?: (contractDebugName: string, contractorDisplayName: string | null) => void;
  onBlueprintClick?: (blueprintId: string) => void;
}

interface RewardPoolBlueprint {
  id: string;
  name: string;
}

type AcquisitionFactionRow = AcquisitionGraphEntry['factions'][number];
type MissionActivityKind = 'combat' | 'recovery' | 'objective';

interface AcquisitionContractDetail {
  missionType: 'fps' | 'ship' | 'unknown';
  activityKind: MissionActivityKind;
  rewardedBlueprints: RewardPoolBlueprint[];
  employerDisplayName: string | null;
  employerAssetUrl: string | null;
  reputationActivity: string | null;
}

const EMPTY_CONTRACT_DETAIL: AcquisitionContractDetail = {
  missionType: 'unknown',
  activityKind: 'objective',
  rewardedBlueprints: [],
  employerDisplayName: null,
  employerAssetUrl: null,
  reputationActivity: null,
};

interface AcquisitionMissionRow {
  key: string;
  contract: AcquisitionContract;
  faction: AcquisitionFactionRow;
  detail: AcquisitionContractDetail;
}

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

function getMissionActivityKind(contract: Partial<MissionContract> | Partial<AcquisitionContract>): MissionActivityKind {
  if ('resourceObjectives' in contract && (contract.resourceObjectives?.length ?? 0) > 0) {
    return 'objective';
  }

  const title = [
    contract.title?.displayText,
    contract.title?.renderedText,
    contract.title?.template,
  ]
    .filter(Boolean)
    .join(' ');
  const haystack = [
    contract.contractDebugName,
    'handlerDebugName' in contract ? contract.handlerDebugName : null,
    'contractFile' in contract ? contract.contractFile : null,
    contract.contractType,
    title,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/(eliminate|kill|clear|bounty|assassinate|hunt|hostile|combat)/.test(haystack)) {
    return 'combat';
  }
  if (/(retrieve|recover|search|investigate|survey|locate|blackbox|explore)/.test(haystack)) {
    return 'recovery';
  }

  return 'objective';
}

function MissionActivityIcon({
  kind,
  size = '1rem',
}: {
  kind: MissionActivityKind;
  size?: string;
}) {
  switch (kind) {
    case 'combat':
      return <MilitaryTechOutlinedIcon sx={{ fontSize: size }} />;
    case 'recovery':
      return <TravelExploreOutlinedIcon sx={{ fontSize: size }} />;
    case 'objective':
    default:
      return <FlagIcon sx={{ fontSize: size }} />;
  }
}

function getMissionReputationActivity(contract: MissionContract): string | null {
  const primaryScope = contract.reputationScope?.displayName?.trim()
    || contract.reputationScope?.scopeName?.trim();
  if (primaryScope) {
    return primaryScope;
  }

  for (const standing of contract.minimumRequiredStandings) {
    const standingScope = standing.scopeName?.trim() || standing.scopeKey?.trim();
    if (standingScope) {
      return standingScope;
    }
  }

  return null;
}

function getMissionEmployerAssetUrl(employer: MissionContract['employer'] | null | undefined): string | null {
  return employer?.logo?.imageUrl ?? employer?.icon?.imageUrl ?? null;
}

/** Returns just the standing tier name (e.g. "Veteran Contractor") from the hardest requirement. */
function getTopStandingName(standings: AcquisitionContract['minimumRequiredStandings']): string | null {
  if (standings.length === 0) return null;
  const sorted = [...standings].sort((a, b) => (b.minReputation ?? 0) - (a.minReputation ?? 0));
  const top = sorted[0];
  return top.standingName?.trim() || top.scopeName?.trim() || null;
}

function getContractLocations(contract: AcquisitionContract): string[] {
  return [...new Set([
    ...contract.availability.localities,
    ...contract.availability.explicitLocations,
  ])];
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
        return detailsByKey.get(key)?.missionType ?? getMissionTypeFromContract(contract);
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
      const employer = contract.employer ?? group.employer ?? null;
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
        activityKind:
          previous.activityKind !== 'objective'
            ? previous.activityKind
            : getMissionActivityKind(contract),
        rewardedBlueprints: [...rewardedBlueprints.values()].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
        employerDisplayName:
          previous.employerDisplayName
          ?? employer?.displayName
          ?? group.contractorDisplayName,
        employerAssetUrl:
          previous.employerAssetUrl
          ?? getMissionEmployerAssetUrl(employer),
        reputationActivity:
          previous.reputationActivity
          ?? getMissionReputationActivity(contract),
      });
    }
  }
  return map;
}

function buildMissionRows(
  entry: AcquisitionGraphEntry | null,
  detailsByKey: Map<string, AcquisitionContractDetail>,
): AcquisitionMissionRow[] {
  if (!entry) {
    return [];
  }

  return entry.factions.flatMap((faction, factionIndex) =>
    faction.contracts.map((contract, contractIndex) => {
      const detailKey = buildContractKey(contract.contractDebugName, faction.contractorDisplayName);
      return {
        key: `${detailKey}::${factionIndex}::${contractIndex}`,
        contract,
        faction,
        detail: detailsByKey.get(detailKey) ?? {
          ...EMPTY_CONTRACT_DETAIL,
          missionType: getMissionTypeFromContract(contract),
          activityKind: getMissionActivityKind(contract),
        },
      };
    }),
  );
}

function getEmployerInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

function AcquisitionMissionCard({
  row,
  activeBlueprint,
  onMissionClick,
  onBlueprintClick,
}: {
  row: AcquisitionMissionRow;
  activeBlueprint: AcquisitionGraphEntry['blueprint'];
  onMissionClick?: (contractDebugName: string, contractorDisplayName: string | null) => void;
  onBlueprintClick?: (blueprintId: string) => void;
}) {
  const { lang, t } = useI18n();
  const theme = useTheme();
  const { contract, faction, detail } = row;
  const factionType = faction.faction?.factionType?.toLowerCase() ?? '';
  const isUnlawful = factionType === 'unlawful';
  const factionColor = isUnlawful ? theme.palette.warning.main : theme.palette.primary.main;
  const activityKind = detail.activityKind ?? getMissionActivityKind(contract);

  const employerName =
    detail.employerDisplayName
    ?? faction.contractorDisplayName
    ?? t('Unknown employer', 'Employeur inconnu');
  const employerLogoUrl = detail.employerAssetUrl;
  const initials = getEmployerInitials(employerName);

  const locations = getContractLocations(contract);
  const primaryLocation = locations[0] ?? null;
  const locationIconName = primaryLocation ? getLocationIconName(primaryLocation) : null;

  const dropChance = getMissionBlueprintDropChance(contract);
  const blueprintCount = detail.rewardedBlueprints.length;
  const bpChance = dropChance > 0 && blueprintCount > 0 ? dropChance / blueprintCount : null;

  const standingLabel = getTopStandingName(contract.minimumRequiredStandings);

  const missionHref = contract.contractDebugName
    ? missionPathFromSlug(missionSlugFromContract(contract.contractDebugName, faction.contractorDisplayName))
    : null;

  const orderedPoolBlueprints = detail.rewardedBlueprints.some((bp) => bp.id === activeBlueprint.id)
    ? [
        ...detail.rewardedBlueprints.filter((bp) => bp.id === activeBlueprint.id),
        ...detail.rewardedBlueprints.filter((bp) => bp.id !== activeBlueprint.id),
      ]
    : detail.rewardedBlueprints;

  return (
    <Card
      role="listitem"
      aria-label={getMissionContractName(contract)}
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        borderColor: 'ui.border',
        bgcolor: 'ui.surface',
        overflow: 'hidden',
        transition: 'border-color 150ms, box-shadow 150ms, transform 150ms',
        '&:hover': {
          borderColor: alpha(factionColor, 0.55),
          boxShadow: `0 8px 24px ${alpha(theme.palette.common.black, 0.28)}`,
          transform: 'translateY(-1px)',
        },
      }}
    >
      {/* Clickable overlay */}
      {missionHref && (
        <Box
          component="a"
          href={missionHref}
          aria-label={t('Open mission dossier', 'Ouvrir le dossier mission')}
          onClick={(event) => {
            if (!shouldHandleInternalLinkClick(event)) return;
            event.preventDefault();
            onMissionClick?.(contract.contractDebugName, faction.contractorDisplayName);
          }}
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            cursor: 'pointer',
            '&:focus-visible': {
              outline: `2px solid ${factionColor}`,
              outlineOffset: -2,
            },
          }}
        />
      )}

      {/* Colored top stripe */}
      <Box sx={{ height: 3, bgcolor: isUnlawful ? 'warning.main' : 'primary.main', opacity: 0.85, flexShrink: 0 }} />

      {/* Card head */}
      <Box sx={{ p: '16px 20px 12px', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {/* Eyebrow: employer logo + name + legal badge */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            {employerLogoUrl ? (
              <Box
                component="img"
                src={employerLogoUrl}
                alt={employerName}
                loading="lazy"
                referrerPolicy="no-referrer"
                sx={{
                  width: 36,
                  height: 36,
                  objectFit: 'contain',
                  borderRadius: 0.75,
                  flexShrink: 0,
                  filter: `drop-shadow(0 2px 6px ${alpha(theme.palette.common.black, 0.5)})`,
                }}
              />
            ) : (
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 1,
                  bgcolor: alpha(factionColor, 0.14),
                  color: factionColor,
                  border: `1px solid ${alpha(factionColor, 0.42)}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: FONT_HEADING,
                  fontWeight: 700,
                  fontSize: 12,
                  flexShrink: 0,
                  userSelect: 'none',
                }}
              >
                {initials}
              </Box>
            )}
            <Typography
              noWrap
              sx={{
                fontFamily: FONT_HEADING,
                fontWeight: 600,
                fontSize: TEXT_LABEL_LG,
                color: 'text.secondary',
                minWidth: 0,
              }}
            >
              {employerName}
            </Typography>
          </Box>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              px: 0.875,
              py: 0.25,
              borderRadius: 0.75,
              bgcolor: isUnlawful ? alpha(theme.palette.warning.main, 0.12) : alpha(theme.palette.primary.main, 0.1),
              color: isUnlawful ? 'warning.main' : 'primary.main',
              fontFamily: FONT_MONO,
              fontSize: TEXT_LABEL_SM,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              flexShrink: 0,
            }}
          >
            {isUnlawful ? t('Unlawful', 'Illégal') : t('Lawful', 'Légal')}
          </Box>
        </Box>

        {/* Mission title */}
        <Typography
          component="h3"
          sx={{
            fontFamily: FONT_HEADING,
            fontWeight: 700,
            fontSize: '1rem',
            lineHeight: 1.25,
            color: 'text.primary',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {getMissionContractName(contract)}
        </Typography>

        {/* Scale + location row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          {contract.availability.derivedScale && (
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                px: 0.75,
                py: 0.2,
                borderRadius: 0.75,
                bgcolor: alpha(factionColor, 0.1),
                border: `1px solid ${alpha(factionColor, 0.3)}`,
                fontFamily: FONT_MONO,
                fontSize: TEXT_LABEL_SM,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: factionColor,
                flexShrink: 0,
              }}
            >
              {formatScaleLabel(contract.availability.derivedScale, lang)}
            </Box>
          )}
          {primaryLocation && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
              {locationIconName ? (
                <StarCitizenLicensedIcon name={locationIconName} size={13} dimmed />
              ) : (
                <PlaceOutlinedIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
              )}
              <Typography noWrap sx={{ fontSize: TEXT_LABEL_LG, color: 'text.secondary', minWidth: 0 }}>
                {primaryLocation}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* Facts grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          borderTop: '1px solid',
          borderColor: 'ui.border',
          bgcolor: 'background.paper',
        }}
      >
        {[
          { label: t('Pool', 'Pool'), value: `${blueprintCount} bp` },
          {
            label: t('Location', 'Lieu'),
            value: primaryLocation ?? '—',
          },
          {
            label: t('Standing', 'Réputation'),
            value: standingLabel ?? t('None', 'Aucune'),
          },
        ].map((fact, i) => (
          <Box
            key={i}
            sx={{
              p: '8px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 0.25,
              borderRight: i < 2 ? '1px solid' : 'none',
              borderColor: 'ui.border',
            }}
          >
            <Typography
              sx={{
                fontFamily: FONT_MONO,
                fontSize: TEXT_LABEL_SM,
                color: 'text.secondary',
              }}
            >
              {fact.label}
            </Typography>
            <Typography
              noWrap
              sx={{
                fontFamily: FONT_HEADING,
                fontWeight: 700,
                fontSize: TEXT_LABEL_LG,
                color: 'text.primary',
              }}
            >
              {fact.value}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Blueprint pool */}
      {orderedPoolBlueprints.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid', borderColor: 'ui.border', flex: 1, minHeight: 0 }}>
          {/* Pool header */}
          <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL_SM, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {t('Pool', 'Pool')} · {blueprintCount} {t('blueprints', 'blueprints')}
            </Typography>
            {dropChance > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                <Box
                  sx={{
                    width: 64,
                    height: 4,
                    borderRadius: 99,
                    bgcolor: alpha(theme.palette.domain.blue, 0.18),
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      height: '100%',
                      width: `${Math.min(dropChance * 100, 100)}%`,
                      bgcolor: theme.palette.domain.blue,
                      borderRadius: 99,
                    }}
                  />
                </Box>
                <Typography sx={{ fontFamily: FONT_MONO, fontSize: TEXT_LABEL_SM, color: theme.palette.domain.blue, fontWeight: 600 }}>

                  {formatProbabilityPercent(dropChance)}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Pool list */}
          <Box
            onClick={(event) => event.stopPropagation()}
            sx={{
              position: 'relative',
              zIndex: 2,
              overflowY: 'auto',
              maxHeight: 264,
              scrollbarWidth: 'thin',
              scrollbarColor: `${alpha(theme.palette.primary.main, 0.28)} transparent`,
              '&::-webkit-scrollbar': { width: 4 },
              '&::-webkit-scrollbar-thumb': { bgcolor: alpha(theme.palette.primary.main, 0.28), borderRadius: 99 },
            }}
          >
            {orderedPoolBlueprints.map((blueprint, index) => {
              const isActive = blueprint.id === activeBlueprint.id;
              return (
                <Box
                  key={`${blueprint.id}-${index}`}
                  component="a"
                  href={`/item/${toSlug(blueprint.name)}`}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!shouldHandleInternalLinkClick(event)) return;
                    event.preventDefault();
                    onBlueprintClick?.(blueprint.id);
                  }}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '3px 20px 1fr auto 20px',
                    alignItems: 'center',
                    gap: 0.75,
                    px: 1,
                    py: 0.875,
                    textDecoration: 'none',
                    color: 'text.primary',
                    borderBottom: '1px solid',
                    borderColor: alpha(theme.palette.divider, 0.5),
                    bgcolor: isActive ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                    '&:last-child': { borderBottom: 'none' },
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06) },
                  }}
                >
                  <Box sx={{ width: 3, height: 28, borderRadius: 99, bgcolor: isActive ? 'primary.main' : alpha(theme.palette.primary.main, 0.3), flexShrink: 0 }} />
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.disabled' }}>
                    <MissionActivityIcon kind={activityKind} size="1rem" />
                  </Box>
                  <Typography
                    noWrap
                    sx={{
                      fontSize: TEXT_LABEL_LG,
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? 'primary.light' : 'text.primary',
                      minWidth: 0,
                    }}
                  >
                    {blueprint.name}
                  </Typography>
                  {bpChance !== null && (
                    <Typography
                      sx={{
                        fontFamily: FONT_MONO,
                        fontSize: TEXT_LABEL_SM,
                        color: 'primary.main',
                        fontWeight: 600,
                        flexShrink: 0,
                        textAlign: 'right',
                      }}
                    >
                      {formatProbabilityPercent(bpChance)}
                    </Typography>
                  )}
                  <ChevronRightIcon sx={{ fontSize: 16, color: 'text.disabled', flexShrink: 0 }} />
                </Box>
              );
            })}
          </Box>
        </Box>
      )}
    </Card>
  );
}

export function AcquisitionSection({
  entry,
  loading,
  missionRewards,
  factionContractsByFactionId,
  onMissionClick,
  onBlueprintClick,
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

  const missionRows = useMemo(
    () => buildMissionRows(entry, contractDetailsByKey),
    [contractDetailsByKey, entry],
  );

  const panelSx = {
    p: { xs: 1.4, md: 1.6 },
    border: `1px solid ${theme.palette.ui.border}`,
    boxShadow: `inset 2px 0 0 0 ${theme.palette.domain.blue}`,
    background: `linear-gradient(180deg, ${alpha(theme.palette.domain.blue, 0.05)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`,
  };

  return (
    <Box
      id="blueprint-acquisition"
      component="section"
      aria-label={t('Acquisition', 'Acquisition')}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, scrollMarginTop: 18 }}
    >
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
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
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
              p: { xs: 1.25, md: 1.35 },
              border: `1px solid ${theme.palette.ui.border}`,
              boxShadow: `inset 2px 0 0 0 ${theme.palette.domain.blue}`,
              background: `linear-gradient(180deg, ${alpha(theme.palette.domain.blue, 0.05)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`,
            }}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 136px' },
                gap: { xs: 1.25, md: 1.5 },
                alignItems: 'stretch',
              }}
            >
              <Stack spacing={1} sx={{ minWidth: 0 }}>
                <Stack spacing={0.35} sx={{ minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontFamily: FONT_HEADING,
                    fontSize: { xs: '1.45rem', md: '1.65rem' },
                      fontWeight: 800,
                      lineHeight: 0.92,
                    }}
                  >
                    {entry.contractCount} {t('contracts', 'contrats')}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      fontSize: TEXT_LABEL,
                    }}
                  >
                    {entry.factionCount} {t('factions', 'factions')} / {entry.localityCount} {t('localities', 'localites')}
                  </Typography>
                </Stack>

                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                  {missionTypeLabels.map((type) => (
                    <Chip
                      key={type}
                      label={getMissionTypeLabel(type, lang)}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                  {entry.derivedScales.map((scale) => (
                    <Chip
                      key={scale}
                      label={formatScaleLabel(scale, lang)}
                      size="small"
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
                        sx={{ fontSize: TEXT_LABEL, height: 20 }}
                      />
                    ))}
                  </Box>
                )}
              </Stack>

              <Paper
                variant="outlined"
                sx={{
                  p: 1,
                  minHeight: 104,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderColor: alpha(theme.palette.secondary.main, 0.32),
                  background: `linear-gradient(180deg, ${alpha(theme.palette.secondary.main, 0.12)}, ${alpha(theme.palette.background.default, 0.2)})`,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    color: alpha(theme.palette.text.primary, 0.62),
                    fontSize: TEXT_LABEL,
                  }}
                >
                  {t('Drop score', 'Score drop')}
                </Typography>
                <Typography
                  sx={{
                    fontFamily: FONT_HEADING,
                    fontSize: { xs: '2.2rem', md: '1.95rem' },
                    fontWeight: 800,
                    lineHeight: 0.85,
                    color: entry.dropScore > 0 ? theme.palette.secondary.light : theme.palette.text.secondary,
                  }}
                >
                  {entry.dropScore > 0 ? formatProbabilityPercent(entry.dropScore) : '-'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: TEXT_LABEL }}>
                  {t('Best linked chance', 'Meilleure chance liee')}
                </Typography>
              </Paper>
            </Box>
          </Paper>

          {/* Mission cards */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' },
              gap: 1.25,
            }}
            role="list"
            aria-label={t('Blueprint acquisition missions', 'Missions d acquisition du blueprint')}
          >
            {missionRows.map((row) => (
              <AcquisitionMissionCard
                key={row.key}
                row={row}
                activeBlueprint={entry!.blueprint}
                onMissionClick={onMissionClick}
                onBlueprintClick={onBlueprintClick}
              />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
