import { Box, Typography, alpha, useTheme } from '../ui/system';
import { Card, CardMedia, Chip } from '../ui/widgets';
import { memo, useMemo, useState } from 'react';
import { loc, useI18n } from '../i18n/I18nContext';
import type { ShipComponentEntry } from '../types';
import {
  buildShipComponentCardModel,
  type ShipComponentCardMetric,
  type ShipComponentCardProfileKey,
} from '../utils/shipComponents';
import { Badge } from './ui/Badge';
import { GameIcon } from './ui/GameIcon';
import type { GameIconName } from './ui/GameIcon';
import { FONT_HEADING, TEXT_LABEL, TEXT_LABEL_SM} from '../theme';

const SHIP_COMPONENT_ICON_MAP: Record<ShipComponentCardProfileKey, GameIconName> = {
  scanner: 'radars',
  'refueling-nozzle': 'utilities',
  'fuel-pod': 'utilities',
  'salvage-head': 'salvage',
  'salvage-modifier:scraper': 'salvage',
  'salvage-modifier:tractor': 'tractor-beams',
  'salvage-modifier:buff': 'salvage',
  'mining-laser': 'mining-lasers',
  'mining-module:active': 'mining-gadget',
  'mining-module:passive': 'mining-gadget',
  powerplant: 'power-plants',
  cooler: 'coolers',
  'shield-generator': 'shields',
  'quantum-drive': 'engines',
  radar: 'radars',
  'ship-weapon': 'weapons',
  'missile-rack': 'missiles',
  emp: 'emps',
  'qed-qid': 'qeds',
  'jump-drive': 'engines',
  thruster: 'thrusters',
  'fuel-tank': 'utilities',
  'fuel-intake': 'utilities',
  battery: 'utilities',
  computer: 'computer',
};

function resolveThumb(component: ShipComponentEntry): { url: string | null; mode: 'item' | 'logo' } {
  const media = component.media;
  const primaryUrl = media?.primaryVisual?.imageUrl ?? null;
  const imageUrl = media?.image?.imageUrl ?? null;
  const logoUrl = media?.manufacturerLogo?.imageUrl ?? null;

  if (!primaryUrl) {
    return { url: null, mode: 'item' };
  }

  if (imageUrl && primaryUrl === imageUrl) {
    return { url: primaryUrl, mode: 'item' };
  }

  if (logoUrl && primaryUrl === logoUrl) {
    return { url: primaryUrl, mode: 'logo' };
  }

  return { url: primaryUrl, mode: imageUrl ? 'item' : 'logo' };
}

function renderMetricLabel(metric: ShipComponentCardMetric, lang: 'en' | 'fr' | 'de'): string {
  return loc(metric.label, lang);
}

export const ShipComponentCard = memo(function ShipComponentCard({
  component,
  priority = false,
}: {
  component: ShipComponentEntry;
  priority?: boolean;
}) {
  const theme = useTheme();
  const { t, lang } = useI18n();
  const model = useMemo(() => buildShipComponentCardModel(component), [component]);
  const { url: thumbUrl, mode: thumbMode } = resolveThumb(component);
  const [imgError, setImgError] = useState(false);
  const showImage = thumbUrl && !imgError;
  const iconName = SHIP_COMPONENT_ICON_MAP[model.profileKey] ?? 'utilities';
  const heroMetrics = model.heroMetrics.slice(0, 3);
  const chipMetrics = model.chipMetrics.slice(0, 5);
  const detailMetrics = model.detailMetrics.slice(0, 2);
  const description = component.descriptionBody?.trim() || component.description?.trim() || '';
  const manufacturerLabel =
    component.manufacturer ??
    t('Unknown manufacturer', 'Fabricant inconnu', 'Unbekannter Hersteller');
  const typeLabel = component.displayType ?? loc(model.profile.label, lang);

  return (
    <Card
      role="listitem"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        transition: 'all 200ms ease',
        '&:hover': {
          borderColor: 'primary.main',
          transform: 'translateY(-4px)',
          boxShadow:
            theme.palette.mode === 'dark'
              ? `0 12px 32px ${alpha('#000', 0.5)}`
              : `0 12px 32px ${alpha(theme.palette.primary.main, 0.12)}`,
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          height: { xs: 132, sm: 152, md: 160 },
          backgroundColor:
            theme.palette.mode === 'dark'
              ? alpha('#000', 0.2)
              : alpha(theme.palette.primary.main, 0.02),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box sx={{ position: 'absolute', top: 12, left: 12, zIndex: 1 }}>
          <Badge variant="info">{loc(model.profile.label, lang)}</Badge>
        </Box>

        <Box sx={{ width: '100%', height: '100%', p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {showImage ? (
            <CardMedia
              component="img"
              image={thumbUrl}
              alt=""
              loading="lazy"
              fetchPriority={priority ? 'high' : 'auto'}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              sx={{
                maxHeight: '100%',
                maxWidth: '100%',
                objectFit: 'contain',
                filter:
                  thumbMode === 'item'
                    ? theme.palette.mode === 'dark'
                      ? 'drop-shadow(0 8px 16px rgba(0,0,0,0.6))'
                      : 'drop-shadow(0 8px 16px rgba(0,0,0,0.1))'
                    : 'none',
                p: thumbMode === 'logo' ? 2 : 0,
                transition: 'transform 300ms ease',
                '.MuiCard-root:hover &': {
                  transform: 'scale(1.05)',
                },
              }}
            />
          ) : (
            <GameIcon name={iconName} size={56} shimmer={false} />
          )}
        </Box>
      </Box>

      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1 }}>
        <Box>
          <Typography
            sx={{
              fontFamily: FONT_HEADING,
              fontWeight: 700,
              fontSize: '1.1rem',
              lineHeight: 1.2,
              color: 'text.primary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              minHeight: '2.4em',
            }}
          >
            {component.name ?? t('Unknown component', 'Composant inconnu', 'Unbekannte Komponente')}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: 'secondary.main',
              fontSize: TEXT_LABEL,
              fontWeight: 500,
              mt: 0.5,
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {manufacturerLabel} · {typeLabel}
          </Typography>
        </Box>

        {heroMetrics.length > 0 && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: `repeat(${heroMetrics.length}, minmax(0, 1fr))`,
              gap: 1,
            }}
          >
            {heroMetrics.map((metric) => (
              <Box
                key={metric.id}
                sx={{
                  minWidth: 0,
                  px: 1,
                  py: 1,
                  borderRadius: 1,
                  border: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
                  backgroundColor: alpha(theme.palette.text.primary, 0.02),
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    color: 'text.secondary',
                    fontWeight: 500,
                    fontSize: TEXT_LABEL_SM,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {renderMetricLabel(metric, lang)}
                </Typography>
                <Typography
                  sx={{
                    mt: 0.35,
                    color: 'primary.main',
                    fontWeight: 700,
                    fontSize: '0.92rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {metric.value}
                </Typography>
              </Box>
            ))}
          </Box>
        )}

        {chipMetrics.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {chipMetrics.map((metric) => (
              <Chip
                key={metric.id}
                label={`${renderMetricLabel(metric, lang)}: ${metric.value}`}
                size="small"
                variant="outlined"
                sx={{
                  maxWidth: '100%',
                  height: 24,
                  borderColor: 'divider',
                  color: 'text.secondary',
                  backgroundColor: alpha(theme.palette.text.primary, 0.02),
                  '& .MuiChip-label': {
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  },
                }}
              />
            ))}
          </Box>
        )}

        <Box sx={{ mt: 'auto', pt: 0.5 }}>
          {detailMetrics.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: description ? 1 : 0 }}>
              {detailMetrics.map((metric) => (
                <Typography
                  key={metric.id}
                  variant="caption"
                  sx={{ color: 'text.secondary', display: 'block' }}
                >
                  {renderMetricLabel(metric, lang)}: <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>{metric.value}</Box>
                </Typography>
              ))}
            </Box>
          )}

          {description ? (
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                lineHeight: 1.45,
              }}
            >
              {description}
            </Typography>
          ) : (
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              {t(
                'Blueprint data pending for this component family.',
                'Donnees blueprint en attente pour cette famille de composants.',
                'Blueprint-Daten fur diese Komponentenfamilie folgen spater.',
              )}
            </Typography>
          )}
        </Box>
      </Box>
    </Card>
  );
});
