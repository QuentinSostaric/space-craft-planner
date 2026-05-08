import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import FlagIcon from '@mui/icons-material/Flag';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import MilitaryTechOutlinedIcon from '@mui/icons-material/MilitaryTechOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import TravelExploreOutlinedIcon from '@mui/icons-material/TravelExploreOutlined';
import { alpha, useTheme } from '@mui/material/styles';
import { useI18n } from '../../i18n/I18nContext';
import {
  formatProbabilityPercent,
  formatScaleLabel,
  formatStandingSummary,
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
import { FONT_HEADING } from '../../theme';

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

function getEmployerInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 3).map((word) => word[0]).join('').toUpperCase();
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
  const activityKind = detail.activityKind ?? getMissionActivityKind(contract);
  const activityShortLabel =
    activityKind === 'combat'
      ? t('Combat', 'Combat')
      : activityKind === 'recovery'
        ? t('Recovery', 'Recuperation')
        : t('Objective', 'Objectif');
  const activityColor = isUnlawful
    ? theme.palette.error.main
    : activityKind === 'recovery'
      ? theme.palette.success.main
      : theme.palette.secondary.main;
  const activityTextColor = isUnlawful
    ? theme.palette.error.light
    : activityKind === 'recovery'
      ? theme.palette.success.light
      : theme.palette.secondary.light;
  const locations = getContractLocations(contract);
  const primaryLocation = locations[0] ?? null;
  const locationIconName = primaryLocation ? getLocationIconName(primaryLocation) : null;
  const missionHref = contract.contractDebugName && onMissionClick
    ? missionPathFromSlug(missionSlugFromContract(contract.contractDebugName, faction.contractorDisplayName))
    : null;
  const employerName =
    detail.employerDisplayName
    ?? faction.contractorDisplayName
    ?? t('Unknown employer', 'Employeur inconnu');
  const factionLabel =
    faction.faction?.displayName
    ?? faction.contractorDisplayName
    ?? t('Unknown faction', 'Faction inconnue');
  const dropChance = getMissionBlueprintDropChance(contract);
  const focusedChance =
    contract.maxChance != null && contract.maxChance > 0
      ? contract.maxChance
      : contract.expectedRewardShare != null && contract.expectedRewardShare > 0
        ? contract.expectedRewardShare
        : dropChance > 0
          ? dropChance
          : null;
  const chanceLabel =
    contract.maxChance != null && contract.maxChance > 0
      ? t('Max chance', 'Chance max')
      : contract.expectedRewardShare != null && contract.expectedRewardShare > 0
        ? t('Expected share', 'Part attendue')
        : t('Blueprint drop', 'Drop blueprint');
  const chanceProgress = focusedChance == null
    ? 0
    : Math.max(0, Math.min(100, focusedChance * 100));
  const standingLabel = contract.minimumRequiredStandings.length > 0
    ? formatStandingSummary(contract.minimumRequiredStandings, lang)
    : null;
  const poolBlueprints = detail.rewardedBlueprints;
  const orderedPoolBlueprints = (
    poolBlueprints.some((blueprint) => blueprint.id === activeBlueprint.id)
      ? [
          ...poolBlueprints.filter((blueprint) => blueprint.id === activeBlueprint.id),
          ...poolBlueprints.filter((blueprint) => blueprint.id !== activeBlueprint.id),
        ]
      : poolBlueprints
  );

  return (
    <Card
      role="listitem"
      variant="outlined"
      sx={{
        position: 'relative',
        minHeight: { xs: 'auto', md: 218 },
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '132px minmax(0, 1fr)' },
        overflow: 'hidden',
        borderColor: alpha(theme.palette.brand.blueLight, 0.22),
        background: `linear-gradient(115deg, ${alpha(theme.palette.brand.blue, 0.14)} 0%, ${alpha(theme.palette.background.default, 0.98)} 52%, ${alpha(theme.palette.common.black, 0.22)} 100%)`,
        transition: 'border-color 150ms, box-shadow 150ms, transform 150ms',
        '&:hover': {
          borderColor: alpha(theme.palette.secondary.main, 0.55),
          boxShadow: `0 16px 36px ${alpha(theme.palette.common.black, 0.28)}`,
          transform: 'translateY(-1px)',
        },
      }}
    >
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
              outline: `2px solid ${theme.palette.secondary.main}`,
              outlineOffset: -2,
            },
          }}
        />
      )}

      <Box
        sx={{
          position: 'relative',
          minHeight: { xs: 132, sm: 'auto' },
          overflow: 'hidden',
          borderRight: { sm: `1px solid ${alpha(theme.palette.brand.blueLight, 0.16)}` },
          borderBottom: { xs: `1px solid ${alpha(theme.palette.brand.blueLight, 0.16)}`, sm: 0 },
          pointerEvents: 'none',
          background: `
            radial-gradient(circle at 28% 18%, ${alpha(activityColor, 0.24)}, transparent 28%),
            linear-gradient(150deg, ${alpha(activityColor, 0.18)}, transparent 48%),
            linear-gradient(180deg, ${alpha(theme.palette.brand.blue, 0.18)} 0%, ${alpha(theme.palette.background.default, 0.94)} 100%)
          `,
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            opacity: 0.42,
            backgroundImage: `
              linear-gradient(${alpha(theme.palette.common.white, 0.035)} 1px, transparent 1px),
              linear-gradient(90deg, ${alpha(theme.palette.common.white, 0.028)} 1px, transparent 1px)
            `,
            backgroundSize: '34px 34px',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            left: '-22%',
            right: '20%',
            bottom: '28%',
            height: 34,
            transform: 'skewX(-18deg)',
            background: `linear-gradient(90deg, transparent 0%, ${alpha(theme.palette.common.black, 0.48)} 44%, ${alpha(activityColor, 0.22)} 100%)`,
            borderTop: `1px solid ${alpha(theme.palette.brand.blueLight, 0.14)}`,
            borderBottom: `1px solid ${alpha(theme.palette.common.black, 0.48)}`,
          }}
        />
        <Chip
          label={activityShortLabel}
          icon={<MissionActivityIcon kind={activityKind} size="0.88rem" />}
          size="small"
          sx={{
            position: 'absolute',
            top: 12,
            left: 12,
            right: 12,
            maxWidth: 'calc(100% - 24px)',
            height: 28,
            borderRadius: 1,
            color: activityTextColor,
            backgroundColor: alpha(theme.palette.background.default, 0.58),
            border: `1px solid ${alpha(activityColor, 0.58)}`,
            '& .MuiChip-label': {
              fontFamily: FONT_HEADING,
              fontSize: '0.72rem',
              fontWeight: 800,
              textTransform: 'uppercase',
            },
            '& .MuiChip-icon': { ml: '7px', mr: '-2px', color: 'inherit' },
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pt: 2,
          }}
        >
          {detail.employerAssetUrl ? (
            <Box
              component="img"
              src={detail.employerAssetUrl}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              sx={{
                width: 72,
                height: 72,
                objectFit: 'contain',
                opacity: 0.5,
                filter: `drop-shadow(0 14px 24px ${alpha(theme.palette.common.black, 0.5)})`,
              }}
            />
          ) : (
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: 1.25,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: alpha(activityColor, 0.12),
                border: `1px solid ${alpha(activityColor, 0.32)}`,
              }}
            >
              <Typography
                sx={{
                  fontFamily: FONT_HEADING,
                  fontSize: '1.3rem',
                  fontWeight: 800,
                  lineHeight: 1,
                  color: activityTextColor,
                  userSelect: 'none',
                }}
              >
                {getEmployerInitials(employerName)}
              </Typography>
            </Box>
          )}
        </Box>
        <Stack
          spacing={0.25}
          sx={{
            position: 'absolute',
            left: 12,
            right: 12,
            bottom: 12,
            minWidth: 0,
          }}
        >
          <Typography
            noWrap
            sx={{
              fontFamily: FONT_HEADING,
              fontSize: '0.82rem',
              fontWeight: 800,
              color: 'text.primary',
              textTransform: 'uppercase',
              textShadow: `0 1px 8px ${alpha(theme.palette.common.black, 0.65)}`,
            }}
          >
            {employerName}
          </Typography>
          <Stack direction="row" spacing={0.6} alignItems="center" sx={{ color: isUnlawful ? 'error.light' : 'success.light' }}>
            <Box
              sx={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: isUnlawful ? 'error.main' : 'success.main',
                boxShadow: `0 0 0 3px ${alpha(isUnlawful ? theme.palette.error.main : theme.palette.success.main, 0.14)}`,
                flexShrink: 0,
              }}
            />
            <Typography
              noWrap
              sx={{
                fontSize: '0.62rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                color: 'inherit',
              }}
            >
              {isUnlawful ? t('Unlawful', 'Illegal') : t('Lawful', 'Legal')}
            </Typography>
          </Stack>
        </Stack>
      </Box>

      <Box
        sx={{
          position: 'relative',
          zIndex: 2,
          pointerEvents: 'none',
          p: 0,
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 128px' },
          gap: 0,
          minWidth: 0,
        }}
      >
        <Stack spacing={0.9} sx={{ minWidth: 0, p: { xs: 1.35, md: 1.5 } }}>
          <Stack spacing={0.35} sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                fontFamily: FONT_HEADING,
                fontWeight: 800,
                fontSize: { xs: '1.18rem', md: '1.3rem' },
                lineHeight: 0.95,
                color: 'text.primary',
                textTransform: 'uppercase',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {getMissionContractName(contract)}
            </Typography>
            <Typography
              noWrap
              variant="caption"
              sx={{ color: alpha(theme.palette.text.primary, 0.68), fontSize: '0.68rem' }}
            >
              {factionLabel}
            </Typography>
          </Stack>

          {primaryLocation && (
            <Stack direction="row" spacing={0.85} alignItems="center" sx={{ minWidth: 0, color: 'text.secondary' }}>
              {locationIconName ? (
                <StarCitizenLicensedIcon name={locationIconName} size={17} dimmed />
              ) : (
                <PlaceOutlinedIcon sx={{ fontSize: 17, color: 'secondary.main' }} />
              )}
              <Typography
                noWrap
                sx={{
                  color: 'text.primary',
                  fontFamily: FONT_HEADING,
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  minWidth: 0,
                }}
              >
                {primaryLocation}
              </Typography>
              <Typography
                noWrap
                variant="caption"
                sx={{ color: alpha(theme.palette.brand.blueLight, 0.72), fontSize: '0.62rem', textTransform: 'uppercase' }}
              >
                {formatScaleLabel(contract.availability.derivedScale, lang)}
              </Typography>
            </Stack>
          )}

          <Box sx={{ display: 'flex', gap: 0.55, flexWrap: 'wrap', minWidth: 0 }}>
            <Chip
              label={getMissionTypeLabel(detail.missionType, lang)}
              size="small"
              variant="outlined"
              sx={{
                height: 25,
                borderRadius: 1,
                color: activityTextColor,
                borderColor: alpha(activityColor, 0.52),
                backgroundColor: alpha(activityColor, 0.08),
                '& .MuiChip-label': { fontFamily: FONT_HEADING, fontSize: '0.66rem', fontWeight: 800, textTransform: 'uppercase' },
              }}
            />
            {detail.reputationActivity && (
              <Chip
                label={detail.reputationActivity}
                size="small"
                variant="outlined"
                sx={{
                  height: 25,
                  maxWidth: 210,
                  borderRadius: 1,
                  color: theme.palette.brand.blueLight,
                  borderColor: alpha(theme.palette.brand.blueLight, 0.3),
                  backgroundColor: alpha(theme.palette.brand.blueLight, 0.06),
                  '& .MuiChip-label': { fontFamily: FONT_HEADING, fontSize: '0.64rem', fontWeight: 700, textTransform: 'uppercase' },
                }}
              />
            )}
            {standingLabel && (
              <Chip
                label={standingLabel}
                size="small"
                variant="outlined"
                sx={{
                  height: 25,
                  maxWidth: 220,
                  borderRadius: 1,
                  color: theme.palette.warning.light,
                  borderColor: alpha(theme.palette.warning.main, 0.36),
                  backgroundColor: alpha(theme.palette.warning.main, 0.08),
                  '& .MuiChip-label': { fontFamily: FONT_HEADING, fontSize: '0.64rem', fontWeight: 800, textTransform: 'uppercase' },
                }}
              />
            )}
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.55, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.58rem',
                  color: alpha(theme.palette.text.primary, 0.58),
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}
              >
                {t('Blueprint pool', 'Pool blueprint')}
              </Typography>
              <Divider sx={{ flex: 1, borderColor: alpha(theme.palette.brand.blueLight, 0.16) }} />
            </Stack>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'minmax(0, 1fr)',
                  sm: 'repeat(auto-fit, minmax(142px, 1fr))',
                },
                gap: 0.55,
                minWidth: 0,
              }}
            >
              {orderedPoolBlueprints.length > 0 ? (
                orderedPoolBlueprints.map((blueprint) => {
                  const isActive = blueprint.id === activeBlueprint.id;
                  return (
                    <Button
                      key={blueprint.id}
                      size="small"
                      variant="outlined"
                      component="a"
                      href={`/item/${toSlug(blueprint.name)}`}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (!shouldHandleInternalLinkClick(event)) return;
                        if (!onBlueprintClick) return;
                        event.preventDefault();
                        onBlueprintClick(blueprint.id);
                      }}
                      sx={{
                        pointerEvents: 'auto',
                        minWidth: 0,
                        minHeight: 28,
                        height: '100%',
                        justifyContent: 'flex-start',
                        px: 0.8,
                        borderRadius: 1,
                        color: isActive ? theme.palette.common.white : theme.palette.text.primary,
                        borderColor: isActive
                          ? alpha(theme.palette.primary.light, 0.86)
                          : alpha(theme.palette.brand.blueLight, 0.25),
                        background: isActive
                          ? `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.88)}, ${alpha(theme.palette.primary.dark, 0.72)})`
                          : `linear-gradient(180deg, ${alpha(theme.palette.brand.blue, 0.1)}, ${alpha(theme.palette.common.black, 0.14)})`,
                        textTransform: 'none',
                        fontFamily: 'inherit',
                        fontSize: '0.64rem',
                        fontWeight: 800,
                        lineHeight: 1.05,
                        letterSpacing: 0,
                        '&:hover': {
                          borderColor: alpha(theme.palette.secondary.main, 0.6),
                          backgroundColor: alpha(theme.palette.secondary.main, 0.08),
                        },
                      }}
                    >
                      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', textAlign: 'left' }}>
                        {blueprint.name}
                      </Box>
                    </Button>
                  );
                })
              ) : (
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                  {t('Blueprint pool loading', 'Pool blueprint en cours de chargement')}
                </Typography>
              )}
            </Box>
          </Box>
        </Stack>

        <Box
          sx={{
            border: `1px solid ${alpha(theme.palette.brand.blueLight, 0.18)}`,
            background: `linear-gradient(180deg, ${alpha(theme.palette.brand.blue, 0.1)}, ${alpha(theme.palette.common.black, 0.16)})`,
            borderRadius: { xs: 0, lg: '0 0 0 4px' },
            p: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            pointerEvents: 'none',
            borderTop: { lg: 0 },
            borderRight: { lg: 0 },
            borderBottom: { lg: 0 },
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: alpha(theme.palette.text.primary, 0.62),
              textTransform: 'uppercase',
              display: 'block',
              fontSize: '0.58rem',
            }}
          >
            {chanceLabel}
          </Typography>
          <Typography
            sx={{
              fontFamily: FONT_HEADING,
              fontSize: { xs: '2.5rem', lg: '2.05rem' },
              fontWeight: 800,
              lineHeight: 0.85,
              color: focusedChance != null ? theme.palette.secondary.light : theme.palette.text.secondary,
              mt: 0.7,
            }}
          >
            {focusedChance != null ? formatProbabilityPercent(focusedChance) : '-'}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={chanceProgress}
            sx={{
              mt: 0.85,
              height: 6,
              borderRadius: 999,
              backgroundColor: alpha(theme.palette.common.white, 0.07),
              '& .MuiLinearProgress-bar': {
                borderRadius: 999,
                backgroundColor: theme.palette.secondary.light,
              },
            }}
          />
          <Stack spacing={0.6} sx={{ mt: 1 }}>
            {dropChance > 0 && (
              <Chip
                label={`${t('Drop', 'Drop')}: ${formatProbabilityPercent(dropChance)}`}
                size="small"
                variant="outlined"
                sx={{ height: 22, borderRadius: 1, '& .MuiChip-label': { fontSize: '0.58rem', fontWeight: 700 } }}
              />
            )}
            {contract.expectedRewardShare != null && contract.expectedRewardShare > 0 && (
              <Chip
                label={`${t('Share', 'Part')}: ${formatProbabilityPercent(contract.expectedRewardShare)}`}
                size="small"
                variant="outlined"
                sx={{ height: 22, borderRadius: 1, '& .MuiChip-label': { fontSize: '0.58rem', fontWeight: 700 } }}
              />
            )}
            <Stack direction="row" spacing={0.7} alignItems="center" sx={{ color: alpha(theme.palette.text.primary, 0.66) }}>
              <Inventory2OutlinedIcon sx={{ fontSize: 18 }} />
              <Typography variant="caption" sx={{ fontSize: '0.58rem' }}>
                {poolBlueprints.length > 0
                  ? `${poolBlueprints.length} ${t('blueprints', 'blueprints')}`
                  : t('Pool pending', 'Pool en attente')}
              </Typography>
            </Stack>
          </Stack>
          <Button
            variant="text"
            component="a"
            href={missionHref ?? undefined}
            disabled={!missionHref}
            endIcon={<KeyboardArrowRightIcon />}
            onClick={(event) => {
              event.stopPropagation();
              if (!missionHref || !shouldHandleInternalLinkClick(event)) return;
              event.preventDefault();
              onMissionClick?.(contract.contractDebugName, faction.contractorDisplayName);
            }}
            sx={{
              pointerEvents: 'auto',
              mt: 'auto',
              mx: -0.6,
              mb: -0.7,
              pt: 0.8,
              fontSize: '0.62rem',
              justifyContent: 'space-between',
              color: alpha(theme.palette.text.primary, 0.78),
              borderTop: `1px solid ${alpha(theme.palette.brand.blueLight, 0.13)}`,
              borderRadius: 0,
              '&:hover': {
                color: theme.palette.secondary.light,
                backgroundColor: alpha(theme.palette.secondary.main, 0.06),
              },
            }}
          >
            {t('Open dossier', 'Ouvrir dossier')}
          </Button>
        </Box>
      </Box>
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
    p: 2,
    border: `1px solid ${theme.palette.ui.border}`,
    background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`,
  };

  return (
    <Box
      id="blueprint-acquisition"
      component="section"
      aria-label={t('Acquisition', 'Acquisition')}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, scrollMarginTop: 18 }}
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
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 148px' },
                gap: { xs: 1.25, md: 1.5 },
                alignItems: 'stretch',
              }}
            >
              <Stack spacing={1} sx={{ minWidth: 0 }}>
                <Stack spacing={0.35} sx={{ minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontFamily: FONT_HEADING,
                      fontSize: { xs: '1.55rem', md: '1.85rem' },
                      fontWeight: 800,
                      lineHeight: 0.92,
                      textTransform: 'uppercase',
                    }}
                  >
                    {entry.contractCount} {t('contracts', 'contrats')}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      fontSize: '0.62rem',
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
                        sx={{ fontSize: '0.65rem', height: 20 }}
                      />
                    ))}
                  </Box>
                )}
              </Stack>

              <Paper
                variant="outlined"
                sx={{
                  p: 1,
                  minHeight: 118,
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
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    fontSize: '0.58rem',
                  }}
                >
                  {t('Drop score', 'Score drop')}
                </Typography>
                <Typography
                  sx={{
                    fontFamily: FONT_HEADING,
                    fontSize: { xs: '2.45rem', md: '2.2rem' },
                    fontWeight: 800,
                    lineHeight: 0.85,
                    color: entry.dropScore > 0 ? theme.palette.secondary.light : theme.palette.text.secondary,
                  }}
                >
                  {entry.dropScore > 0 ? formatProbabilityPercent(entry.dropScore) : '-'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem' }}>
                  {t('Best linked chance', 'Meilleure chance liee')}
                </Typography>
              </Paper>
            </Box>
          </Paper>

          {/* Mission cards */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' },
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
