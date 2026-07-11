import type { ReactNode } from 'react';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import StarIcon from '@mui/icons-material/Star';
import StraightenOutlinedIcon from '@mui/icons-material/StraightenOutlined';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { useI18n } from '../../i18n/I18nContext';
import type { Blueprint, BlueprintIdentityFact } from '../../types';
import { Button } from '../ui/Button';
import { AppGlyph } from '../ui/AppGlyph';
import { CategoryBadge } from '../ui/Badge';
import { RarityBadge } from '../ui/RarityBadge';
import { FONT_HEADING, TEXT_LABEL} from '../../theme';

interface ItemIdentityProps {
  blueprint: Blueprint;
  isFavorite: boolean;
  isLooted: boolean;
  onBack: () => void;
  onToggleFavorite: () => void;
  onToggleInventory: () => void;
}

function humanizeToken(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return null;
  }

  return normalized
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatMicroScu(value: number | undefined): string | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }

  if (Math.abs(value) >= 1000) {
    const compact = value / 1000;
    const digits = Number.isInteger(compact) ? 0 : 1;
    return `${compact.toFixed(digits)}K`;
  }

  return String(value);
}

function formatDimensionsMm(
  dimensions: { x?: number; y?: number; z?: number } | undefined,
): string | null {
  if (!dimensions?.x || !dimensions?.y || !dimensions?.z) {
    return null;
  }

  const values = [dimensions.x, dimensions.y, dimensions.z].map((value) =>
    Math.round(value * 1000),
  );

  return `${values[0]} x ${values[1]} x ${values[2]} mm`;
}

const DUPLICATED_FIELD_FACT_IDS = new Set([
  'damage',
  'damage_per_shot',
  'rate_of_fire',
  'effective_range',
  'ideal_range',
  'magazine',
  'magazine_size',
  'reload_speed',
  'recoil',
  'recoil_handling',
  'recoil_kick',
  'recoil_smoothness',
]);

const DUPLICATED_FIELD_LABELS = [
  'damage',
  'damage per shot',
  'rate of fire',
  'cadence',
  'effective range',
  'ideal range',
  'portee',
  'range',
  'magazine',
  'magazine size',
  'taille chargeur',
  'reload',
  'rechargement',
  'recoil',
  'recul',
];

function SectionPanel({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  const theme = useTheme();

  return (
    <Paper
      sx={{
        overflow: 'hidden',
        border: `1px solid ${theme.palette.ui.border}`,
        background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.035)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`,
      }}
    >
      <Box
        sx={{
          px: 1.25,
          py: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${theme.palette.ui.border}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
          <Box sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center' }}>{icon}</Box>
          <Typography
            variant="overline"
            sx={{
              lineHeight: 1,
              color: 'text.secondary',
              letterSpacing: '0.1em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {label}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ p: 1.25 }}>{children}</Box>
    </Paper>
  );
}

function DataRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '18px minmax(84px, 0.8fr) minmax(0, 1fr)',
        gap: 0.8,
        alignItems: 'center',
        py: 0.62,
        borderBottom: `1px solid ${theme.palette.ui.border}`,
        '&:last-of-type': {
          borderBottom: 'none',
        },
      }}
    >
      <Box sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center' }}>{icon}</Box>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          fontWeight: 500,
          lineHeight: 1.15,
          fontSize: TEXT_LABEL,
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          minWidth: 0,
          fontWeight: 650,
          color: 'text.primary',
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

export function ItemIdentity({
  blueprint,
  isFavorite,
  isLooted,
  onBack,
  onToggleFavorite,
  onToggleInventory,
}: ItemIdentityProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const imgSrc =
    blueprint.media?.primaryVisual?.imageUrl ?? blueprint.media?.manufacturerLogo?.imageUrl;
  const mfgLogo = blueprint.media?.manufacturerLogo?.imageUrl;
  const shortName =
    blueprint.identity?.shortName &&
    blueprint.identity.shortName.trim().toLowerCase() !== blueprint.name.trim().toLowerCase()
      ? blueprint.identity.shortName
      : null;
  const description = blueprint.identity?.descriptionBody ?? blueprint.identity?.description;
  const inventory = blueprint.identity?.inventoryOccupancy;
  const attachDef = blueprint.identity?.attachDef;
  const gridSize = inventory?.gridSize?.x && inventory?.gridSize?.y
    ? `${inventory.gridSize.x} x ${inventory.gridSize.y}`
    : null;
  const footprint = formatDimensionsMm(inventory?.dimensions);
  const volume = formatMicroScu(inventory?.microScu);
  const attachType = [humanizeToken(attachDef?.type), humanizeToken(attachDef?.subType)]
    .filter(Boolean)
    .join(' / ');
  const technicalTags = [...new Set([...(attachDef?.tags ?? []), ...(attachDef?.requiredTags ?? [])]
    .filter(Boolean))]
    .slice(0, 6);
  const typeChips = [...new Set([
    blueprint.baseStats.weaponType,
    blueprint.baseStats.armorType,
    blueprint.baseStats.armorSlot,
    blueprint.baseStats.ammoType,
    blueprint.baseStats.ammoFlavor,
  ].filter(Boolean) as string[])];
  const normalizedChipValues = new Set(
    typeChips.map((chip) => chip.trim().toLowerCase()),
  );
  const facts = (blueprint.identity?.descriptionFacts ?? []).filter(
    (fact): fact is BlueprintIdentityFact & { label: string; value: string } => {
      if (!fact.label || !fact.value || fact.id === 'manufacturer') {
        return false;
      }

      const normalizedId = fact.id?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_') ?? '';
      const normalizedLabel = fact.label.trim().toLowerCase();
      if (
        DUPLICATED_FIELD_FACT_IDS.has(normalizedId)
        || DUPLICATED_FIELD_LABELS.some((label) => normalizedLabel.includes(label))
      ) {
        return false;
      }

      return !normalizedChipValues.has(fact.value.trim().toLowerCase());
    },
  );
  const dataRows = [
    ...facts.slice(0, 6).map((fact) => ({
      key: fact.id ?? fact.label,
      icon: <InfoOutlinedIcon sx={{ fontSize: '0.94rem' }} />,
      label: fact.label,
      value: fact.value,
    })),
    volume
      ? {
          key: 'volume',
          icon: <Inventory2OutlinedIcon sx={{ fontSize: '0.94rem' }} />,
          label: t('Volume', 'Volume'),
          value: `${volume} microSCU`,
        }
      : null,
    gridSize
      ? {
          key: 'grid-size',
          icon: <GridViewOutlinedIcon sx={{ fontSize: '0.94rem' }} />,
          label: t('Grid Size', 'Taille grille'),
          value: gridSize,
        }
      : null,
    footprint
      ? {
          key: 'footprint',
          icon: <StraightenOutlinedIcon sx={{ fontSize: '0.94rem' }} />,
          label: t('Footprint', 'Encombrement'),
          value: footprint,
        }
      : null,
    attachType
      ? {
          key: 'attach-profile',
          icon: <CategoryOutlinedIcon sx={{ fontSize: '0.94rem' }} />,
          label: t('Attach Profile', 'Profil equipement'),
          value: attachType,
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; icon: ReactNode; label: string; value: string }>;

  return (
    <Stack spacing={1.05}>
      <Paper
        sx={{
          position: 'relative',
          overflow: 'hidden',
          border: `1px solid ${theme.palette.ui.borderStrong}`,
          background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 72%)`,
        }}
      >
        <Box
          sx={{
            p: 1.15,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            borderBottom: `1px solid ${theme.palette.ui.border}`,
          }}
        >
          <Button variant="ghost" size="sm" onClick={onBack}>
            <AppGlyph name="arrow-left" size={16} sx={{ mr: 0.5 }} /> {t('Back to blueprints', 'Retour blueprints')}
          </Button>
        </Box>

        <Box
          sx={{
            position: 'relative',
            minHeight: { xs: 188, md: 196 },
            aspectRatio: '16 / 9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: { xs: 1.25, md: 1.5 },
            overflow: 'hidden',
            borderBottom: `1px solid ${theme.palette.ui.border}`,
            background: `
              linear-gradient(${alpha(theme.palette.common.white, 0.035)} 1px, transparent 1px),
              linear-gradient(90deg, ${alpha(theme.palette.common.white, 0.03)} 1px, transparent 1px),
              radial-gradient(circle at 50% 35%, ${alpha(theme.palette.primary.main, 0.15)}, transparent 42%),
              ${alpha(theme.palette.background.default, 0.34)}
            `,
            backgroundSize: '28px 28px, 28px 28px, auto, auto',
          }}
        >
          {imgSrc ? (
            <Box
              component="img"
              src={imgSrc}
              alt={blueprint.name}
              loading="lazy"
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                objectPosition: 'center',
                filter: 'drop-shadow(0 18px 30px rgba(0,0,0,0.34))',
              }}
            />
          ) : (
            <Inventory2OutlinedIcon sx={{ fontSize: 72, color: 'text.disabled' }} />
          )}
        </Box>

        <Stack spacing={1.1} sx={{ p: { xs: 1.25, md: 1.45 } }}>
          <Box sx={{ display: 'flex', gap: 0.65, flexWrap: 'wrap', alignItems: 'center' }}>
            <CategoryBadge category={blueprint.category} />
            {blueprint.rarity && <RarityBadge rarity={blueprint.rarity} />}
            {typeChips.map((token) => (
              <Chip key={`type-${token}`} label={token} size="small" variant="outlined" />
            ))}
          </Box>

          <Box>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                fontSize: TEXT_LABEL,
              }}
            >
              {shortName ?? t('Blueprint dossier', 'Dossier blueprint')}
            </Typography>
            <Typography
              variant="h4"
              sx={{
                mt: 0.55,
                fontSize: { xs: '1.88rem', md: '2.04rem' },
                lineHeight: 0.95,
                overflowWrap: 'anywhere',
              }}
            >
              {blueprint.name}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, minWidth: 0 }}>
            {mfgLogo && (
              <Box
                component="img"
                src={mfgLogo}
                alt={blueprint.manufacturer}
                loading="lazy"
                sx={{ height: 22, maxWidth: 92, objectFit: 'contain' }}
              />
            )}
            <Typography variant="body2" sx={{ color: 'text.secondary', minWidth: 0 }} noWrap>
              {blueprint.manufacturer}
            </Typography>
          </Box>

          <Stack spacing={0.75}>
            <ToggleButton
              value="owned"
              selected={isLooted}
              onChange={onToggleInventory}
              aria-pressed={isLooted}
              size="small"
              sx={{
                minHeight: 40,
                width: '100%',
                gap: 0.65,
                px: 1,
                fontFamily: FONT_HEADING,
                fontSize: '0.78rem',
                fontWeight: 800,
                justifyContent: 'center',
                color: theme.palette.common.white,
                borderColor: alpha(theme.palette.primary.main, 0.58),
                background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.78)}, ${alpha(theme.palette.primary.dark, 0.64)})`,
                '&:hover': {
                  color: theme.palette.common.white,
                  backgroundColor: alpha(theme.palette.primary.main, 0.2),
                },
                '&.Mui-selected': {
                  color: 'primary.light',
                  borderColor: 'primary.main',
                  background: alpha(theme.palette.primary.main, 0.18),
                },
              }}
            >
              {isLooted ? (
                <CheckCircleIcon sx={{ fontSize: '1rem' }} />
              ) : (
                <Inventory2OutlinedIcon sx={{ fontSize: '1rem' }} />
              )}
              {isLooted
                ? t('In inventory', 'En inventaire')
                : t('Add to inventory', 'Ajouter a l\'inventaire')}
            </ToggleButton>
            <ToggleButton
              value="favorite"
              selected={isFavorite}
              onChange={onToggleFavorite}
              aria-pressed={isFavorite}
              size="small"
              sx={{
                minHeight: 38,
                width: '100%',
                gap: 0.6,
                fontFamily: FONT_HEADING,
                fontSize: '0.76rem',
                fontWeight: 800,
                justifyContent: 'center',
                backgroundColor: alpha(theme.palette.background.default, 0.2),
                '&.Mui-selected': {
                  color: 'warning.main',
                  borderColor: 'warning.main',
                  backgroundColor: alpha(theme.palette.warning.main, 0.1),
                },
              }}
            >
              {isFavorite ? (
                <StarIcon sx={{ fontSize: '1rem' }} />
              ) : (
                <StarBorderIcon sx={{ fontSize: '1rem' }} />
              )}
              {t('Favorite', 'Favori')}
            </ToggleButton>
          </Stack>
        </Stack>
      </Paper>

      {description && (
        <SectionPanel
          icon={<DescriptionOutlinedIcon sx={{ fontSize: '1rem' }} />}
          label={t('Item Brief', 'Fiche item')}
        >
          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.58 }}>
            {description}
          </Typography>
        </SectionPanel>
      )}

      {dataRows.length > 0 && (
        <SectionPanel
          icon={<InfoOutlinedIcon sx={{ fontSize: '1rem' }} />}
          label={t('Field Data', 'Donnees objet')}
        >
          <Box>
            {dataRows.map((row) => (
              <DataRow key={row.key} icon={row.icon} label={row.label} value={row.value} />
            ))}
          </Box>

          {(attachDef?.size || attachDef?.grade || technicalTags.length > 0) && (
            <Stack spacing={0.85} sx={{ mt: 1.15 }}>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  fontWeight: 500,
                  fontSize: TEXT_LABEL,
                }}
              >
                {t('Technical Tags', 'Tags techniques')}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.55, flexWrap: 'wrap' }}>
                {attachDef?.size && (
                  <Chip label={`Size ${attachDef.size}`} size="small" variant="outlined" />
                )}
                {attachDef?.grade && (
                  <Chip label={`Grade ${attachDef.grade}`} size="small" variant="outlined" />
                )}
                {technicalTags
                  .filter((tag) => {
                    const normalizedTag = (humanizeToken(tag) ?? tag).trim().toLowerCase();
                    return !normalizedChipValues.has(normalizedTag);
                  })
                  .map((tag) => (
                    <Chip
                      key={`tag-${tag}`}
                      label={humanizeToken(tag) ?? tag}
                      size="small"
                      variant="outlined"
                    />
                  ))}
              </Box>
            </Stack>
          )}
        </SectionPanel>
      )}
    </Stack>
  );
}
