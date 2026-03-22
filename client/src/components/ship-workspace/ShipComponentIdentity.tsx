import type { ReactNode } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import TuneIcon from '@mui/icons-material/Tune';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme, type Theme } from '@mui/material/styles';
import { loc, useI18n } from '../../i18n/I18nContext';
import type { BlueprintIdentityFact, LocalizedString, ShipComponentEntry } from '../../types';
import {
  buildShipComponentLeftColumnModel,
  type ShipComponentCommonMetric,
  type ShipComponentLeftColumnSectionModel,
} from '../../utils/shipComponentWorkspace';
import { Button } from '../ui/Button';

interface ShipComponentIdentityProps {
  component: ShipComponentEntry;
  onBack?: () => void;
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
      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '.05em' }}
      >
        {fact.label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.45 }}>
        {fact.value}
      </Typography>
    </Box>
  );
}

function MetricTile({
  label,
  value,
}: {
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
        flexDirection: 'column',
        gap: 0.45,
        justifyContent: 'center',
        backgroundColor: 'transparent',
      }}
    >
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
          display: 'block',
          textTransform: 'uppercase',
          letterSpacing: '.05em',
        }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 700, wordBreak: 'break-word' }}>
        {value}
      </Typography>
    </Paper>
  );
}

function renderMetricGrid(
  metrics: Array<{ id: string; label: LocalizedString; value: string }>,
  lang: 'en' | 'fr' | 'de',
) {
  if (metrics.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
        gap: 1,
      }}
    >
      {metrics.map((metric) => (
        <MetricTile key={metric.id} label={loc(metric.label, lang)} value={metric.value} />
      ))}
    </Box>
  );
}

function renderCommonMetricGrid(commonMetrics: ShipComponentCommonMetric[], lang: 'en' | 'fr' | 'de') {
  if (commonMetrics.length === 0) {
    return null;
  }

  return renderMetricGrid(commonMetrics, lang);
}

function renderSection(
  section: ShipComponentLeftColumnSectionModel,
  lang: 'en' | 'fr' | 'de',
  theme: Theme,
) {
  const panelSx = {
    p: 2.25,
    border: `1px solid ${theme.palette.ui.border}`,
    background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.04)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`,
  };

  switch (section.kind) {
    case 'brief':
      return (
        <Paper key={section.id} sx={panelSx}>
          <Stack spacing={1.25}>
            <SectionHeading
              icon={<DescriptionOutlinedIcon sx={{ fontSize: '1rem' }} />}
              label={loc(section.label, lang)}
            />
            <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
              {section.description}
            </Typography>
          </Stack>
        </Paper>
      );

    case 'metric-grid':
      return (
        <Paper key={section.id} sx={panelSx}>
          <Stack spacing={1.5}>
            <SectionHeading
              icon={<GridViewOutlinedIcon sx={{ fontSize: '1rem' }} />}
              label={loc(section.label, lang)}
            />
            {renderMetricGrid(section.metrics ?? [], lang)}
          </Stack>
        </Paper>
      );

    case 'field-data':
      return (
        <Paper key={section.id} sx={panelSx}>
          <Stack spacing={1.5}>
            <SectionHeading
              icon={<InfoOutlinedIcon sx={{ fontSize: '1rem' }} />}
              label={loc(section.label, lang)}
            />

            {(section.facts?.length ?? 0) > 0 && (
              <Stack spacing={1.1} divider={<Divider flexItem />}>
                {section.facts?.map((fact, index) => (
                  <FactRow
                    key={`${section.id}-${fact.id ?? fact.label ?? 'fact'}-${index}`}
                    fact={fact}
                  />
                ))}
              </Stack>
            )}

            {(section.commonMetrics?.length ?? 0) > 0 && (
              <>
                {(section.facts?.length ?? 0) > 0 && <Divider flexItem />}
                {renderCommonMetricGrid(section.commonMetrics ?? [], lang)}
              </>
            )}

            {(section.metrics?.length ?? 0) > 0 && (
              <>
                {(section.facts?.length ?? 0) > 0 || (section.commonMetrics?.length ?? 0) > 0 ? (
                  <Divider flexItem />
                ) : null}
                {renderMetricGrid(section.metrics ?? [], lang)}
              </>
            )}
          </Stack>
        </Paper>
      );

    case 'scanner-matrix':
      return (
        <Paper key={section.id} sx={panelSx}>
          <Stack spacing={1.5}>
            <SectionHeading
              icon={<TuneIcon sx={{ fontSize: '1rem' }} />}
              label={loc(section.label, lang)}
            />
            {(section.scannerMatrix?.[0]?.focusAngles?.length ?? 0) > 0 && (
              <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
                Focus: {section.scannerMatrix?.[0].focusAngles.map((value) => `${value}deg`).join(' / ')}
              </Typography>
            )}
            <Stack spacing={1}>
              {(section.scannerMatrix ?? []).map((curve) => {
                const contactRange = `${curve.contactSensitivity[0]}x -> ${curve.contactSensitivity[curve.contactSensitivity.length - 1]}x`;
                const blobRange = `${curve.blobSensitivity[0]}x -> ${curve.blobSensitivity[curve.blobSensitivity.length - 1]}x`;
                return (
                  <Paper key={curve.signatureId} variant="outlined" sx={{ p: 1.25, backgroundColor: 'transparent' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {loc(curve.label, lang)}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.5 }}>
                      Contact: {contactRange}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                      Blob: {blobRange}
                    </Typography>
                  </Paper>
                );
              })}
            </Stack>
          </Stack>
        </Paper>
      );

    case 'technical-tags':
      return (
        <Paper key={section.id} sx={panelSx}>
          <Stack spacing={1}>
            <SectionHeading
              icon={<SellOutlinedIcon sx={{ fontSize: '1rem' }} />}
              label={loc(section.label, lang)}
            />
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              {(section.technicalTags ?? []).map((tag) => (
                <Chip key={`${section.id}-${tag}`} label={tag} size="small" variant="outlined" />
              ))}
            </Box>
          </Stack>
        </Paper>
      );
  }
}

export function ShipComponentIdentity({
  component,
  onBack,
}: ShipComponentIdentityProps) {
  const { lang, t } = useI18n();
  const theme = useTheme();
  const model = buildShipComponentLeftColumnModel(component);

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      {onBack && (
        <Box sx={{ alignSelf: 'flex-start' }}>
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowBackIcon sx={{ fontSize: '1rem', mr: 0.5 }} /> {t('Library', 'Bibliotheque')}
          </Button>
        </Box>
      )}

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
              {model.badges.map((badge) => (
                <Chip key={badge} label={badge} size="small" variant="outlined" />
              ))}
            </Box>

            <Box>
              <Typography
                variant="caption"
                sx={{ color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.14em' }}
              >
                {model.shortName ?? model.kicker}
              </Typography>
              <Typography variant="h4" sx={{ lineHeight: 0.95, mt: 0.75 }}>
                {model.title}
              </Typography>
            </Box>

            {model.manufacturer && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {model.manufacturerLogoUrl && (
                  <Box
                    component="img"
                    src={model.manufacturerLogoUrl}
                    alt={model.manufacturer}
                    loading="lazy"
                    sx={{ height: 24, objectFit: 'contain' }}
                  />
                )}
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {model.manufacturer}
                </Typography>
              </Box>
            )}

            {model.typeChips.length > 0 && (
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                {model.typeChips.map((token) => (
                  <Chip key={token} label={token} size="small" variant="outlined" />
                ))}
              </Box>
            )}

            {model.notes && (
              <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.55 }}>
                {model.notes}
              </Typography>
            )}
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
            {model.imageUrl ? (
              <Box
                component="img"
                src={model.imageUrl}
                alt={model.title}
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

      {model.sections.map((section) => renderSection(section, lang, theme))}
    </Stack>
  );
}
