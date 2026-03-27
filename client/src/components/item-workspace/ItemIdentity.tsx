import type { ReactNode } from 'react';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import StarIcon from '@mui/icons-material/Star';
import StraightenOutlinedIcon from '@mui/icons-material/StraightenOutlined';
import TimerIcon from '@mui/icons-material/Timer';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
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

function SectionHeading({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <Box sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center' }}>{icon}</Box>
      <Typography
        variant="overline"
        sx={{
          color: 'text.secondary',
          letterSpacing: '.08em',
          lineHeight: 1.2,
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

function FactRow({ fact }: { fact: BlueprintIdentityFact }) {
  if (!fact.label || !fact.value) {
    return null;
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'minmax(88px, 112px) 1fr' },
        gap: 1,
      }}
    >
      <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '.05em' }}>
        {fact.label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.45 }}>
        {fact.value}
      </Typography>
    </Box>
  );
}

function MetricTile({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.25,
        height: '100%',
        display: 'flex',
        gap: 1,
        alignItems: 'flex-start',
        backgroundColor: 'transparent',
      }}
    >
      <Box sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', mt: 0.25 }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', textTransform: 'uppercase', letterSpacing: '.05em' }}>
          {label}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 700, wordBreak: 'break-word' }}>
          {value}
        </Typography>
      </Box>
    </Paper>
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
  const craftMinutes = Math.round(blueprint.craftTimeSecs / 60);
  const imgSrc =
    blueprint.media?.primaryVisual?.imageUrl ?? blueprint.media?.manufacturerLogo?.imageUrl;
  const mfgLogo = blueprint.media?.manufacturerLogo?.imageUrl;
  const shortName =
    blueprint.identity?.shortName &&
    blueprint.identity.shortName.trim().toLowerCase() !== blueprint.name.trim().toLowerCase()
      ? blueprint.identity.shortName
      : null;
  const description = blueprint.identity?.descriptionBody ?? blueprint.identity?.description;
  const facts = (blueprint.identity?.descriptionFacts ?? []).filter(
    (fact) => fact.label && fact.value && fact.id !== 'manufacturer',
  );
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
  const panelSx = {
    p: 2.25,
    border: `1px solid ${theme.palette.ui.border}`,
    background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.04)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`,
  };
  const typeChips = [...new Set([
    blueprint.baseStats.weaponType,
    blueprint.baseStats.armorType,
    blueprint.baseStats.armorSlot,
    blueprint.baseStats.ammoType,
    blueprint.baseStats.ammoFlavor,
  ].filter(Boolean) as string[])];

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Box sx={{ alignSelf: 'flex-start' }}>
        <Button variant="ghost" size="sm" onClick={onBack}>
          <AppGlyph name="arrow-left" size={16} sx={{ mr: 0.5 }} /> {t('Library', 'Bibliotheque')}
        </Button>
      </Box>

      <Paper
        sx={{
          position: 'relative',
          overflow: 'hidden',
          p: 2.5,
          minHeight: 320,
          border: `1px solid ${theme.palette.ui.borderStrong}`,
          background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.18)} 0%, ${alpha(theme.palette.primary.main, 0.12)} 42%, ${alpha(theme.palette.background.paper, 0.96)} 100%)`,
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              radial-gradient(circle at top right, ${alpha(theme.palette.primary.main, 0.2)}, transparent 35%),
              radial-gradient(circle at bottom left, ${alpha(theme.palette.secondary.main, 0.14)}, transparent 32%)
            `,
            pointerEvents: 'none',
          }}
        />

        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2.5}
          sx={{ position: 'relative', zIndex: 1, minHeight: 272 }}
        >
          <Stack spacing={1.5} sx={{ flex: '1 1 0', minWidth: 0 }}>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
              <CategoryBadge category={blueprint.category} />
              {blueprint.rarity && <RarityBadge rarity={blueprint.rarity} />}
              <Chip
                icon={<TimerIcon sx={{ fontSize: '0.95rem !important' }} />}
                label={`${craftMinutes}m`}
                size="small"
                variant="outlined"
              />
            </Box>

            <Box>
              <Typography
                variant="caption"
                sx={{ color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.14em' }}
              >
                {shortName ?? t('Blueprint dossier', 'Dossier blueprint')}
              </Typography>
              <Typography variant="h4" sx={{ lineHeight: 0.95, mt: 0.75 }}>
                {blueprint.name}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {mfgLogo && (
                <Box
                  component="img"
                  src={mfgLogo}
                  alt={blueprint.manufacturer}
                  loading="lazy"
                  sx={{ height: 24, objectFit: 'contain' }}
                />
              )}
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {blueprint.manufacturer}
              </Typography>
            </Box>

            {typeChips.length > 0 && (
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                {typeChips.map((token) => (
                  <Chip key={`type-${token}`} label={token} size="small" variant="outlined" />
                ))}
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 1 }}>
              <ToggleButton
                value="favorite"
                selected={isFavorite}
                onChange={onToggleFavorite}
                aria-pressed={isFavorite}
                size="small"
                sx={{
                  flex: 1,
                  gap: 0.5,
                  textTransform: 'none',
                  fontSize: '0.8rem',
                  backgroundColor: alpha(theme.palette.background.default, 0.2),
                  ...(isFavorite && { color: 'warning.main', borderColor: 'warning.main' }),
                }}
              >
                {isFavorite ? (
                  <StarIcon sx={{ fontSize: '1rem' }} />
                ) : (
                  <StarBorderIcon sx={{ fontSize: '1rem' }} />
                )}
                {t('Favorite', 'Favori')}
              </ToggleButton>
              <ToggleButton
                value="owned"
                selected={isLooted}
                onChange={onToggleInventory}
                aria-pressed={isLooted}
                size="small"
                sx={{
                  flex: 1,
                  gap: 0.5,
                  textTransform: 'none',
                  fontSize: '0.8rem',
                  backgroundColor: alpha(theme.palette.background.default, 0.2),
                  ...(isLooted && { color: 'primary.main', borderColor: 'primary.main' }),
                }}
              >
                {isLooted ? (
                  <AppGlyph name="checkmark" size={16} />
                ) : (
                  <RadioButtonUncheckedIcon sx={{ fontSize: '1rem' }} />
                )}
                {t('Owned', 'Possede')}
              </ToggleButton>
            </Box>
          </Stack>

          <Box
            sx={{
              flex: { xs: '0 0 auto', md: '0 0 42%' },
              minHeight: { xs: 180, md: 'auto' },
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 1,
              border: `1px solid ${alpha(theme.palette.common.white, theme.palette.mode === 'dark' ? 0.06 : 0.12)}`,
              backgroundColor: alpha(theme.palette.background.default, 0.18),
              p: 2,
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
                  maxHeight: 240,
                  objectFit: 'contain',
                  objectPosition: 'center',
                  filter: 'drop-shadow(0 16px 28px rgba(0,0,0,0.28))',
                }}
              />
            ) : (
              <Inventory2OutlinedIcon sx={{ fontSize: 72, color: 'text.disabled' }} />
            )}
          </Box>
        </Stack>
      </Paper>

      {description && (
        <Paper sx={panelSx}>
          <Stack spacing={1.25}>
            <SectionHeading
              icon={<DescriptionOutlinedIcon sx={{ fontSize: '1rem' }} />}
              label={t('Item Brief', 'Fiche item')}
            />
            <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
              {description}
            </Typography>
          </Stack>
        </Paper>
      )}

      {(facts.length > 0 || volume || gridSize || footprint || attachType) && (
        <Paper sx={panelSx}>
          <Stack spacing={1.5}>
            <SectionHeading
              icon={<InfoOutlinedIcon sx={{ fontSize: '1rem' }} />}
              label={t('Field Data', 'Donnees objet')}
            />

            {facts.length > 0 && (
              <Stack spacing={1.1} divider={<Divider flexItem />}>
                {facts.slice(0, 8).map((fact, index) => (
                  <FactRow
                    key={`${fact.id ?? fact.label ?? 'fact'}-${index}`}
                    fact={fact}
                  />
                ))}
              </Stack>
            )}

            {(volume || gridSize || footprint || attachType) && (
              <>
                {facts.length > 0 && <Divider flexItem />}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    gap: 1,
                  }}
                >
                  {volume && (
                    <MetricTile
                      icon={<Inventory2OutlinedIcon sx={{ fontSize: '1rem' }} />}
                      label={t('Inventory Volume', 'Volume inventaire')}
                      value={`${volume} microSCU`}
                    />
                  )}
                  {gridSize && (
                    <MetricTile
                      icon={<GridViewOutlinedIcon sx={{ fontSize: '1rem' }} />}
                      label={t('Grid Size', 'Taille grille')}
                      value={gridSize}
                    />
                  )}
                  {footprint && (
                    <MetricTile
                      icon={<StraightenOutlinedIcon sx={{ fontSize: '1rem' }} />}
                      label={t('Footprint', 'Encombrement')}
                      value={footprint}
                    />
                  )}
                  {attachType && (
                    <MetricTile
                      icon={<CategoryOutlinedIcon sx={{ fontSize: '1rem' }} />}
                      label={t('Attach Profile', 'Profil equipement')}
                      value={attachType}
                    />
                  )}
                </Box>
              </>
            )}

            {(attachDef?.size || attachDef?.grade || technicalTags.length > 0) && (
              <>
                <Divider flexItem />
                <Stack spacing={1}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                    {t('Technical Tags', 'Tags techniques')}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                    {attachDef?.size && (
                      <Chip label={`Size ${attachDef.size}`} size="small" variant="outlined" />
                    )}
                    {attachDef?.grade && (
                      <Chip label={`Grade ${attachDef.grade}`} size="small" variant="outlined" />
                    )}
                    {technicalTags.map((tag) => (
                      <Chip
                        key={`tag-${tag}`}
                        label={humanizeToken(tag) ?? tag}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </Stack>
              </>
            )}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
