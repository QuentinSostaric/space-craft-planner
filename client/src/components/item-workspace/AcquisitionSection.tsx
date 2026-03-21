import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useI18n } from '../../i18n/I18nContext';
import { formatScaleLabel } from '../../utils/crafting';
import type { AcquisitionGraphEntry } from '../../types';

interface AcquisitionSectionProps {
  entry: AcquisitionGraphEntry | null;
  loading: boolean;
  sectionRef: React.RefObject<HTMLDivElement | null>;
}

export function AcquisitionSection({ entry, loading, sectionRef }: AcquisitionSectionProps) {
  const { lang, t } = useI18n();

  return (
    <Box ref={sectionRef} component="section" aria-label={t('Acquisition', 'Acquisition')} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="overline" sx={{ display: 'block' }}>
        {t('Acquisition', 'Acquisition')}
      </Typography>

      {loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t('Loading acquisition data...', 'Chargement des données d\'acquisition...')}
          </Typography>
          <Skeleton variant="rectangular" height={60} />
          <Skeleton variant="rectangular" height={40} />
        </Box>
      )}

      {!loading && !entry && (
        <Typography variant="body2" sx={{ color: 'text.disabled', py: 2 }}>
          {t('Not obtainable via missions', 'Non obtenable via les missions')}
        </Typography>
      )}

      {!loading && entry && (
        <>
          {/* Summary chips */}
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            <Chip label={`${entry.contractCount} ${t('contracts', 'contrats')}`} size="small" variant="outlined" />
            <Chip label={`${entry.factionCount} ${t('factions', 'factions')}`} size="small" variant="outlined" />
            <Chip label={`${entry.localityCount} ${t('localities', 'localités')}`} size="small" variant="outlined" />
            <Chip label={`Score: ${entry.dropScore}`} size="small" variant="outlined" color="primary" />
          </Box>

          {/* Localities */}
          {entry.localities.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {entry.localities.map((loc) => (
                <Chip key={loc} label={loc} size="small" sx={{ fontSize: '0.65rem', height: 20 }} />
              ))}
            </Box>
          )}

          {/* Standings */}
          {entry.standings.length > 0 && (
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 0.5 }}>
                {t('Standing requirements', 'Exigences de réputation')}
              </Typography>
              {entry.standings.map((s, idx) => (
                <Typography key={idx} variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.75rem' }}>
                  {[s.factionName, s.scopeName, s.standingName].filter(Boolean).join(' — ')}
                  {s.minReputation != null && ` (${s.minReputation})`}
                </Typography>
              ))}
            </Box>
          )}

          {/* Factions */}
          {entry.factions.map((faction, fIdx) => (
            <Accordion key={fIdx} disableGutters>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    {faction.contractorDisplayName ?? t('Unknown', 'Inconnu')}
                  </Typography>
                  {faction.faction?.factionType && (
                    <Chip label={faction.faction.factionType} size="small" variant="outlined" sx={{ fontSize: '0.6rem', height: 18 }} />
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
                {/* Per-faction localities */}
                {faction.localities.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                    {faction.localities.map((loc) => (
                      <Chip key={loc} label={loc} size="small" sx={{ fontSize: '0.6rem', height: 18 }} />
                    ))}
                  </Box>
                )}

                {/* Per-faction standings */}
                {faction.standings.length > 0 && (
                  <Box sx={{ mb: 1 }}>
                    {faction.standings.map((s, sIdx) => (
                      <Typography key={sIdx} variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.7rem' }}>
                        {[s.factionName, s.scopeName, s.standingName].filter(Boolean).join(' — ')}
                        {s.minReputation != null && ` (${s.minReputation})`}
                      </Typography>
                    ))}
                  </Box>
                )}

                {/* Contracts */}
                <List disablePadding dense>
                  {faction.contracts.map((contract, cIdx) => (
                    <ListItem key={cIdx} sx={{ flexDirection: 'column', alignItems: 'stretch', py: 0.75, borderBottom: 1, borderColor: 'divider' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                          {contract.contractDebugName ?? t('Unknown contract', 'Contrat inconnu')}
                        </Typography>
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
                            .map((s) => [s.factionName, s.scopeName, s.standingName].filter(Boolean).join(' — '))
                            .join(' | ')}
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', gap: 1, mt: 0.25 }}>
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
