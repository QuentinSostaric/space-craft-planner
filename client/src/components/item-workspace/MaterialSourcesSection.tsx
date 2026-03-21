import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
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
import { Button } from '../ui/Button';
import { getMaterialProviders } from '../../utils/crafting';
import type { AggregatedResource, MaterialSources } from '../../types';

interface MaterialSourcesSectionProps {
  resources: AggregatedResource[];
  materialSources: MaterialSources | null;
  qty: number;
  setQty: (val: number) => void;
  onAddGoal: () => void;
}

export function MaterialSourcesSection({ resources, materialSources, qty, setQty, onAddGoal }: MaterialSourcesSectionProps) {
  const { t } = useI18n();

  if (resources.length === 0) return null;

  return (
    <Box component="section" aria-label={t('Material sources', 'Sources de matériaux')} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
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

      {/* Planner CTA */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'stretch', mt: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, border: 1, borderColor: 'divider' }}>
          <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '.65rem' }}>{t('Qty', 'Qté')}</Typography>
          <TextField
            type="number"
            size="small"
            value={qty}
            onChange={(e) => setQty(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
            slotProps={{ htmlInput: { min: 1, max: 99, style: { width: 40, textAlign: 'center', padding: '4px 0', fontSize: '.85rem' } } }}
            sx={{ width: 48, '& .MuiOutlinedInput-root': { '& fieldset': { border: 'none' } } }}
          />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Button variant="gradient" size="md" fullWidth onClick={onAddGoal}>
            {t('Add to Planner', 'Ajouter au planificateur')}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
