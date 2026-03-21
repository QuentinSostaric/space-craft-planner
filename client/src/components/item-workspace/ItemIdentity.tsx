import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import ToggleButton from '@mui/material/ToggleButton';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TimerIcon from '@mui/icons-material/Timer';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { useI18n } from '../../i18n/I18nContext';
import { Button } from '../ui/Button';
import { CategoryBadge } from '../ui/Badge';
import { RarityBadge } from '../ui/RarityBadge';
import type { Blueprint } from '../../types';

interface ItemIdentityProps {
  blueprint: Blueprint;
  isFavorite: boolean;
  isLooted: boolean;
  onBack: () => void;
  onToggleFavorite: () => void;
  onToggleInventory: () => void;
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
  const craftMinutes = Math.round(blueprint.craftTimeSecs / 60);
  const imgSrc = blueprint.media?.primaryVisual?.imageUrl ?? blueprint.media?.manufacturerLogo?.imageUrl;
  const mfgLogo = blueprint.media?.manufacturerLogo?.imageUrl;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
      {/* Back button */}
      <Box sx={{ alignSelf: 'flex-start' }}>
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowBackIcon sx={{ fontSize: '1rem', mr: 0.5 }} /> {t('Library', 'Bibliothèque')}
        </Button>
      </Box>

      {/* Item image */}
      {imgSrc && (
        <Box
          component="img"
          src={imgSrc}
          alt={blueprint.name}
          sx={{ maxHeight: 180, objectFit: 'contain', alignSelf: 'center' }}
        />
      )}

      {/* Item name */}
      <Typography
        variant="h5"
        sx={{
          fontFamily: "'Khand', sans-serif",
          fontWeight: 700,
          lineHeight: 1.2,
        }}
      >
        {blueprint.name}
      </Typography>

      {/* Manufacturer line */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {mfgLogo && (
          <Box
            component="img"
            src={mfgLogo}
            alt={blueprint.manufacturer}
            sx={{ height: 20, objectFit: 'contain' }}
          />
        )}
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {blueprint.manufacturer}
        </Typography>
      </Box>

      {/* Category & classification chips */}
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <CategoryBadge category={blueprint.category} iconOnly />
        {blueprint.rarity && <RarityBadge rarity={blueprint.rarity} />}
        {blueprint.baseStats.weaponType && <Chip label={blueprint.baseStats.weaponType} size="small" variant="outlined" />}
        {blueprint.baseStats.armorType && <Chip label={blueprint.baseStats.armorType} size="small" variant="outlined" />}
        {blueprint.baseStats.armorSlot && <Chip label={blueprint.baseStats.armorSlot} size="small" variant="outlined" />}
        {blueprint.baseStats.ammoType && <Chip label={blueprint.baseStats.ammoType} size="small" variant="outlined" />}
        {blueprint.baseStats.ammoFlavor && <Chip label={blueprint.baseStats.ammoFlavor} size="small" variant="outlined" />}
      </Box>

      {/* Craft time */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <TimerIcon sx={{ fontSize: '1rem', color: 'text.disabled' }} />
        <Typography variant="body2" sx={{ color: 'text.disabled' }}>
          {craftMinutes}m
        </Typography>
      </Box>

      {/* Favorite & inventory toggles */}
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
            ...(isFavorite && { color: 'warning.main', borderColor: 'warning.main' }),
          }}
        >
          {isFavorite ? <StarIcon sx={{ fontSize: '1rem' }} /> : <StarBorderIcon sx={{ fontSize: '1rem' }} />}
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
            ...(isLooted && { color: 'primary.main', borderColor: 'primary.main' }),
          }}
        >
          {isLooted ? <CheckCircleIcon sx={{ fontSize: '1rem' }} /> : <RadioButtonUncheckedIcon sx={{ fontSize: '1rem' }} />}
          {t('Owned', 'Possédé')}
        </ToggleButton>
      </Box>
    </Box>
  );
}
