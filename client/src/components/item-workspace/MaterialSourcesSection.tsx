import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useI18n } from '../../i18n/I18nContext';
import { getMaterialProviders } from '../../utils/crafting';
import type { AggregatedResource, MaterialSources } from '../../types';

interface MaterialSourcesSectionProps {
  resources: AggregatedResource[];
  materialSources: MaterialSources | null;
  sectionRef: React.RefObject<HTMLDivElement | null>;
}

export function MaterialSourcesSection({ resources, materialSources, sectionRef }: MaterialSourcesSectionProps) {
  const { t } = useI18n();

  if (resources.length === 0) return null;

  return (
    <Box ref={sectionRef} component="section" aria-label={t('Material sources', 'Sources de matériaux')} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="overline" sx={{ display: 'block' }}>
        {t('Material Sources', 'Sources de matériaux')}
      </Typography>

      {resources.map((res) => {
        const providers = getMaterialProviders(materialSources, res.resourceName);

        return (
          <Accordion key={res.resourceName} disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {res.resourceName}
                </Typography>
                {providers.length > 0 && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', ml: 'auto', mr: 1 }}>
                    {providers[0].providerDisplayName}
                    {providers[0].system && ` · ${providers[0].system}`}
                  </Typography>
                )}
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {providers.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                  {t('No source data available', 'Aucune donnée de source disponible')}
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('Provider', 'Fournisseur')}</TableCell>
                      <TableCell>{t('Type', 'Type')}</TableCell>
                      <TableCell>{t('System', 'Système')}</TableCell>
                      <TableCell>{t('Probability', 'Probabilité')}</TableCell>
                      <TableCell>{t('Tier', 'Tier')}</TableCell>
                      <TableCell>{t('Confidence', 'Confiance')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {providers.map((p, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{p.providerDisplayName}</TableCell>
                        <TableCell>{p.providerType}</TableCell>
                        <TableCell>{p.system ?? '—'}</TableCell>
                        <TableCell>{p.groupProbabilityPct != null ? `${p.groupProbabilityPct}%` : '—'}</TableCell>
                        <TableCell>{p.tier ?? '—'}</TableCell>
                        <TableCell>{p.labelConfidence}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
}
