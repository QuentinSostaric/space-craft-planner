import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { alpha, useTheme } from '@mui/material/styles';
import { useI18n } from '../../i18n/I18nContext';
import { formatContractName, formatScaleLabel } from '../../utils/crafting';
import type { AcquisitionGraphEntry } from '../../types';

interface AcquisitionSectionProps {
  entry: AcquisitionGraphEntry | null;
  loading: boolean;
  onMissionClick?: (contractDebugName: string, contractorDisplayName: string | null) => void;
}

export function AcquisitionSection({ entry, loading, onMissionClick }: AcquisitionSectionProps) {
  const { lang, t } = useI18n();
  const theme = useTheme();
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
            <Skeleton variant="rectangular" height={32} sx={{ borderRadius: 0.5 }} />
          </Box>
        </Paper>
      )}

      {!loading && !entry && (
        <Paper sx={panelSx}>
          <Typography variant="body2" sx={{ color: 'text.disabled' }}>
            {t('Not obtainable via missions', 'Non obtenable via les missions')}
          </Typography>
        </Paper>
      )}

      {!loading && entry && (
        <>
          <Paper sx={panelSx}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                <Chip label={`${entry.contractCount} ${t('contracts', 'contrats')}`} size="small" variant="outlined" />
                <Chip label={`${entry.factionCount} ${t('factions', 'factions')}`} size="small" variant="outlined" />
                <Chip label={`${entry.localityCount} ${t('localities', 'localites')}`} size="small" variant="outlined" />
                <Chip label={`Score: ${entry.dropScore}`} size="small" variant="outlined" color="primary" />
              </Box>

              {entry.localities.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {entry.localities.map((loc) => (
                    <Chip key={loc} label={loc} size="small" sx={{ fontSize: '0.65rem', height: 20 }} />
                  ))}
                </Box>
              )}

              {entry.standings.length > 0 && (
                <Box>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 0.5 }}
                  >
                    {t('Standing requirements', 'Exigences de reputation')}
                  </Typography>
                  {entry.standings.map((standing, index) => (
                    <Typography
                      key={index}
                      variant="caption"
                      sx={{ color: 'text.secondary', display: 'block', fontSize: '0.75rem' }}
                    >
                      {[standing.factionName, standing.scopeName, standing.standingName].filter(Boolean).join(' - ')}
                      {standing.minReputation != null && ` (${standing.minReputation})`}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>
          </Paper>

          {entry.factions.map((faction, index) => (
            <Accordion
              key={index}
              disableGutters
              sx={{
                border: `1px solid ${theme.palette.ui.border}`,
                backgroundColor: theme.palette.ui.surface1,
                '&::before': { display: 'none' },
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    {faction.contractorDisplayName ?? t('Unknown', 'Inconnu')}
                  </Typography>
                  {faction.faction?.factionType && (
                    <Chip
                      label={faction.faction.factionType}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.6rem', height: 18 }}
                    />
                  )}
                  <Chip
                    label={`${faction.contractCount} ${t('contracts', 'contrats')}`}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.6rem', height: 18, ml: 'auto', mr: 1 }}
                  />
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                {faction.localities.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                    {faction.localities.map((loc) => (
                      <Chip key={loc} label={loc} size="small" sx={{ fontSize: '0.6rem', height: 18 }} />
                    ))}
                  </Box>
                )}

                {faction.standings.length > 0 && (
                  <Box sx={{ mb: 1 }}>
                    {faction.standings.map((standing, standingIndex) => (
                      <Typography
                        key={standingIndex}
                        variant="caption"
                        sx={{ color: 'text.secondary', display: 'block', fontSize: '0.7rem' }}
                      >
                        {[standing.factionName, standing.scopeName, standing.standingName].filter(Boolean).join(' - ')}
                        {standing.minReputation != null && ` (${standing.minReputation})`}
                      </Typography>
                    ))}
                  </Box>
                )}

                <List disablePadding dense>
                  {faction.contracts.map((contract, contractIndex) => (
                    <ListItem
                      key={contractIndex}
                      sx={{
                        flexDirection: 'column',
                        alignItems: 'stretch',
                        py: 0.75,
                        borderBottom: 1,
                        borderColor: 'divider',
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.25, gap: 1 }}>
                        {contract.contractDebugName && onMissionClick ? (
                          <Link
                            component="button"
                            type="button"
                            underline="hover"
                            onClick={() => onMissionClick(contract.contractDebugName, faction.contractorDisplayName)}
                            sx={{
                              fontWeight: 600,
                              fontSize: '0.8rem',
                              color: 'text.primary',
                              textAlign: 'left',
                              cursor: 'pointer',
                            }}
                          >
                            {formatContractName(contract.contractDebugName)}
                          </Link>
                        ) : (
                          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                            {contract.contractDebugName ?? t('Unknown contract', 'Contrat inconnu')}
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

                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                        {contract.availability.localities.length > 0
                          ? contract.availability.localities.join(', ')
                          : contract.availability.explicitLocations.length > 0
                            ? contract.availability.explicitLocations.join(', ')
                            : t('No explicit location', 'Aucun lieu explicite')}
                      </Typography>

                      {contract.minimumRequiredStandings.length > 0 && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                          {contract.minimumRequiredStandings
                            .map((standing) => [standing.factionName, standing.scopeName, standing.standingName].filter(Boolean).join(' - '))
                            .join(' | ')}
                        </Typography>
                      )}

                      <Box sx={{ display: 'flex', gap: 1, mt: 0.25, flexWrap: 'wrap' }}>
                        {contract.expectedRewardShare != null && (
                          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>
                            {t('Share', 'Part')}: {(contract.expectedRewardShare * 100).toFixed(1)}%
                          </Typography>
                        )}
                        {contract.maxChance != null && (
                          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem' }}>
                            {t('Chance', 'Chance')}: {(contract.maxChance * 100).toFixed(1)}%
                          </Typography>
                        )}
                      </Box>
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          ))}
        </>
      )}
    </Box>
  );
}
