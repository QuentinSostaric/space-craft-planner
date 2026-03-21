import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
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
import type { Blueprint } from '../../types';

interface HeroSectionProps {
  blueprint: Blueprint;
  isFavorite: boolean;
  isLooted: boolean;
  onBack: () => void;
  onToggleFavorite: () => void;
  onToggleInventory: () => void;
  onAddGoal: () => void;
  onAddToComparison: () => void;
  canAddToComparison: boolean;
  nextComparisonColor: string;
  comparisonCount: number;
  onOpenComparison: () => void;
  qty: number;
  setQty: (val: number) => void;
}

export function HeroSection({
  blueprint,
  isFavorite,
  isLooted,
  onBack,
  onToggleFavorite,
  onToggleInventory,
  onAddGoal,
  onAddToComparison,
  canAddToComparison,
  nextComparisonColor,
  comparisonCount,
  onOpenComparison,
  qty,
  setQty,
}: HeroSectionProps) {
  const { t } = useI18n();
  const craftMinutes = Math.round(blueprint.craftTimeSecs / 60);
  const imgSrc = blueprint.media?.primaryVisual?.imageUrl ?? blueprint.media?.manufacturerLogo?.imageUrl;

  return (
    <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Top row: back + identity + toggles */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowBackIcon sx={{ fontSize: '1rem', mr: 0.5 }} /> {t('Library', 'Bibliothèque')}
        </Button>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
          {imgSrc && (
            <Box
              component="img"
              src={imgSrc}
              alt={blueprint.name}
              sx={{ maxHeight: 48, objectFit: 'contain' }}
            />
          )}
          <CategoryBadge category={blueprint.category} iconOnly />
          <Typography
            variant="h6"
            sx={{
              fontFamily: "'Khand', sans-serif",
              fontWeight: 700,
              fontSize: '1.1rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {blueprint.name}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {blueprint.manufacturer}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, ml: 1 }}>
            <TimerIcon sx={{ fontSize: '.8rem', color: 'text.disabled' }} />
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              {craftMinutes}m
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton
            onClick={onToggleInventory}
            aria-pressed={isLooted}
            size="small"
            sx={{ ...(isLooted && { color: 'primary.main', backgroundColor: 'rgba(139, 92, 246, 0.1)' }) }}
          >
            {isLooted ? <CheckCircleIcon sx={{ fontSize: '1.1rem' }} /> : <RadioButtonUncheckedIcon sx={{ fontSize: '1.1rem' }} />}
          </IconButton>
          <IconButton
            onClick={onToggleFavorite}
            aria-pressed={isFavorite}
            size="small"
            sx={{ ...(isFavorite && { color: 'warning.main' }) }}
          >
            {isFavorite ? <StarIcon sx={{ fontSize: '1.2rem' }} /> : <StarBorderIcon sx={{ fontSize: '1.2rem' }} />}
          </IconButton>
        </Box>
      </Box>

      {/* Category chips */}
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {blueprint.baseStats.weaponType && <Chip label={blueprint.baseStats.weaponType} size="small" variant="outlined" />}
        {blueprint.baseStats.armorType && <Chip label={blueprint.baseStats.armorType} size="small" variant="outlined" />}
        {blueprint.baseStats.armorSlot && <Chip label={blueprint.baseStats.armorSlot} size="small" variant="outlined" />}
        {blueprint.baseStats.ammoType && <Chip label={blueprint.baseStats.ammoType} size="small" variant="outlined" />}
        {blueprint.baseStats.ammoFlavor && <Chip label={blueprint.baseStats.ammoFlavor} size="small" variant="outlined" />}
      </Box>

      {/* Action buttons */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'stretch' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, border: 1, borderColor: 'divider' }}>
          <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '.65rem' }}>{t('Qty', 'Qte')}</Typography>
          <TextField
            type="number"
            size="small"
            value={qty}
            onChange={(e) => setQty(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
            slotProps={{ htmlInput: { min: 1, max: 99, style: { width: 40, textAlign: 'center', padding: '4px 0', fontSize: '.85rem' } } }}
            sx={{ width: 48, '& .MuiOutlinedInput-root': { '& fieldset': { border: 'none' } } }}
          />
        </Box>
        <Box sx={{ flex: 2 }}>
          <Button variant="gradient" size="md" fullWidth onClick={onAddGoal}>
            {t('Add to Planner', 'Ajouter au planificateur')}
          </Button>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Button
            variant="secondary"
            size="md"
            fullWidth
            onClick={onAddToComparison}
            disabled={!canAddToComparison}
          >
            {canAddToComparison && (
              <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: nextComparisonColor, mr: 0.5 }} aria-hidden="true" />
            )}
            <span>{t('Compare', 'Comparer')}</span>
            {!canAddToComparison && <Typography component="span" sx={{ fontSize: '.6rem', ml: 0.5, opacity: 0.6 }}>max 4</Typography>}
          </Button>
        </Box>
      </Box>

      {comparisonCount > 0 && (
        <Chip
          label={`${comparisonCount} ${t('in comparison', 'en comparaison')}`}
          variant="outlined"
          onClick={onOpenComparison}
          aria-label={`${t('Open comparison', 'Ouvrir la comparaison')} (${comparisonCount})`}
          sx={{ cursor: 'pointer', alignSelf: 'center' }}
        />
      )}
    </Paper>
  );
}
