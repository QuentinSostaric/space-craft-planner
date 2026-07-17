import { Box, Stack, Typography, alpha, useTheme } from '../../ui/system';
import { Avatar, Card, CardActionArea, CardMedia, Chip } from '../../ui/widgets';
import { memo } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import {
  StarCitizenLicensedIcon,
  getLocationIconName,
} from '../ui/StarCitizenLicensedIcon';
import { ResourceIcon } from '../ui/ResourceIcon';
import { useI18n } from '../../i18n/I18nContext';
import type { Resource, ResourceInsight } from '../../types';
import { FONT_HEADING } from '../../theme';
import { shouldHandleInternalLinkClick } from '../../utils/spaLinks';

type ResourceCardChip = {
  label: string;
  color?: 'default' | 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'error';
  variant?: 'filled' | 'outlined';
};

type ResourceOwnerInfo = {
  label: string;
  avatarSrc?: string | null;
  avatarAlt?: string;
  supportingText?: string | null;
};

function getResourceFamilyLabel(
  visualKind: Resource['visualKind'],
  lang: 'en' | 'fr' | 'de',
): string {
  switch (visualKind) {
    case 'metal':
      return lang === 'fr' ? 'Metal' : lang === 'de' ? 'Metall' : 'Metal';
    case 'mineral':
      return lang === 'fr' ? 'Mineral' : lang === 'de' ? 'Mineral' : 'Mineral';
    case 'crystal':
      return lang === 'fr' ? 'Cristal' : lang === 'de' ? 'Kristall' : 'Crystal';
    case 'ice':
      return lang === 'fr' ? 'Glace' : lang === 'de' ? 'Eis' : 'Ice';
    case 'crafting-slot':
      return lang === 'fr' ? 'Piece de craft' : lang === 'de' ? 'Fertigungsteil' : 'Crafting part';
    default:
      return lang === 'fr' ? 'Ressource' : lang === 'de' ? 'Ressource' : 'Resource';
  }
}

function ResourceFact({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        px: 1.25,
        py: 1,
        minWidth: 0,
        flex: '1 1 90px',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1.5,
        backgroundColor: 'background.paper',
      }}
    >
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          color: 'text.secondary',
          mb: 0.5,
        }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {value}
      </Typography>
    </Box>
  );
}

export const ResourceAssetCard = memo(function ResourceAssetCard({
  resource,
  insight,
  onOpen,
  href,
  title,
  description,
  owner,
  infoChips = [],
  footer,
}: {
  resource: Resource | null;
  insight: ResourceInsight | null;
  onOpen?: (() => void) | null;
  href?: string | null;
  title?: string;
  description?: string | null;
  owner?: ResourceOwnerInfo | null;
  infoChips?: ResourceCardChip[];
  footer?: ReactNode;
}) {
  const { t, lang } = useI18n();
  const theme = useTheme();
  const resourceName = title ?? resource?.name ?? '';
  const imageUrl = resource?.visual?.imageUrl ?? null;
  const systems = insight?.systems ?? [];
  const providerCount = insight?.providerCount ?? 0;
  const missionCount = insight?.missionObjectiveContractCount ?? 0;
  const blueprintCount = insight?.blueprintUsageCount ?? 0;
  const content = (
    <>
      <Box
        sx={{
          position: 'relative',
          height: { xs: 148, sm: 164, md: 180 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderBottom: 1,
          borderColor: 'divider',
          background: `linear-gradient(180deg, ${alpha(resource?.color ?? theme.palette.primary.main, 0.22)} 0%, ${alpha(
            theme.palette.background.paper,
            0.1,
          )} 100%)`,
        }}
      >
        <Box sx={{ position: 'absolute', top: 12, left: 12, zIndex: 1 }}>
          <Chip
            label={getResourceFamilyLabel(resource?.visualKind ?? null, lang)}
            size="small"
            sx={{
              backgroundColor: alpha(theme.palette.background.default, 0.75),
              color: 'text.primary',
              borderColor: alpha(resource?.color ?? theme.palette.primary.main, 0.5),
            }}
          />
        </Box>
        <Box sx={{ position: 'absolute', top: 12, right: 12, zIndex: 1 }}>
          <Chip
            size="small"
            color={missionCount > 0 ? 'primary' : 'default'}
            label={
              missionCount > 0
                ? t('Mission-linked', 'Liee aux missions', 'Missionsbezogen')
                : t('No missions', 'Sans mission', 'Keine Missionen')
            }
          />
        </Box>
        {imageUrl ? (
          <CardMedia
            component="img"
            image={imageUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
            }}
          >
            <ResourceIcon name={resourceName} size={72} shimmer={false} />
          </Box>
        )}
      </Box>

      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1 }}>
        <Box>
          <Typography
            sx={{
              fontFamily: FONT_HEADING,
              fontWeight: 700,
              fontSize: '1.15rem',
              lineHeight: 1,
            }}
          >
            {resourceName}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              mt: 0.75,
              display: '-webkit-box',
              overflow: 'hidden',
              WebkitLineClamp: owner ? 1 : 2,
              WebkitBoxOrient: 'vertical',
              minHeight: owner ? '1.4em' : '2.8em',
            }}
          >
            {description ?? resource?.description ?? ''}
          </Typography>
        </Box>

        {owner ? (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
            <Avatar
              src={owner.avatarSrc ?? undefined}
              alt={owner.avatarAlt ?? owner.label}
              sx={{ width: 28, height: 28 }}
            >
              {owner.label.charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.1 }}>
                {owner.label}
              </Typography>
              {owner.supportingText ? (
                <Typography sx={{ color: 'text.secondary', fontSize: '0.78rem' }}>
                  {owner.supportingText}
                </Typography>
              ) : null}
            </Box>
          </Stack>
        ) : null}

        {infoChips.length > 0 ? (
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            {infoChips.map((chip) => (
              <Chip
                key={`${resourceName}-${chip.label}`}
                size="small"
                label={chip.label}
                color={chip.color ?? 'default'}
                variant={chip.variant ?? 'outlined'}
              />
            ))}
          </Stack>
        ) : null}

        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <ResourceFact label={t('Providers', 'Sources', 'Quellen')} value={String(providerCount)} />
          <ResourceFact label={t('Missions', 'Missions', 'Missionen')} value={String(missionCount)} />
          <ResourceFact label={t('Blueprints', 'Blueprints', 'Blueprints')} value={String(blueprintCount)} />
        </Stack>

        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 'auto' }}>
          {systems.slice(0, 3).map((system) => {
            const iconName = getLocationIconName(system);
            return (
              <Chip
                key={system}
                size="small"
                icon={
                  iconName ? <StarCitizenLicensedIcon name={iconName} size={14} dimmed /> : undefined
                }
                label={system}
              />
            );
          })}
          {systems.length > 3 ? <Chip size="small" label={`+${systems.length - 3}`} /> : null}
        </Stack>
      </Box>
    </>
  );

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'background.paper',
        transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
        '&:hover': {
          transform: onOpen ? 'translateY(-4px)' : 'none',
          borderColor: onOpen ? 'primary.main' : undefined,
          boxShadow:
            theme.palette.mode === 'dark'
              ? `0 12px 28px ${alpha('#000', 0.45)}`
              : `0 12px 28px ${alpha(theme.palette.primary.main, 0.15)}`,
        },
      }}
    >
      {onOpen ? (
        <CardActionArea
          component={href ? 'a' : 'button'}
          href={href ?? undefined}
          onClick={(event: MouseEvent<HTMLElement>) => {
            if (href && !shouldHandleInternalLinkClick(event)) return;
            if (href) event.preventDefault();
            onOpen();
          }}
          sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
        >
          {content}
        </CardActionArea>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>{content}</Box>
      )}
      {footer ? (
        <>
          <Box
            sx={{
              px: { xs: 1.15, sm: 1.4 },
              pb: { xs: 1.15, sm: 1.4 },
              pt: 0.75,
              borderTop: `1px solid ${theme.palette.divider}`,
              backgroundColor: alpha(theme.palette.background.default, 0.08),
            }}
          >
            {footer}
          </Box>
        </>
      ) : null}
    </Card>
  );
});
