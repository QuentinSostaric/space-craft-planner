import { useMemo } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import type { DatasetChangelogSection, DatasetDiffEntry } from '../types';

function renderDiffLabel(entry: DatasetDiffEntry) {
  return entry.nameAfter ?? entry.name ?? entry.id;
}

function DiffList({
  title,
  emptyLabel,
  entries,
  type,
}: {
  title: string;
  emptyLabel: string;
  entries: DatasetDiffEntry[];
  type: 'added' | 'changed' | 'removed';
}) {
  const visibleEntries = entries.slice(0, 5);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', fontSize: '.65rem' }}>
          {title}
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          {entries.length}
        </Typography>
      </Box>

      {visibleEntries.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.disabled', fontSize: '.75rem', py: 1 }}>{emptyLabel}</Typography>
      ) : (
        <List dense disablePadding>
          {visibleEntries.map((entry) => (
            <ListItem key={`${type}-${entry.id}`} disablePadding sx={{ py: 0.25 }}>
              <ListItemText
                primary={renderDiffLabel(entry)}
                secondary={type === 'changed' && entry.changedFields && entry.changedFields.length > 0
                  ? entry.changedFields.join(', ')
                  : undefined}
                slotProps={{
                  primary: { variant: 'body2', sx: { fontSize: '.78rem' } },
                  secondary: { variant: 'caption', sx: { fontSize: '.62rem' } },
                }}
              />
            </ListItem>
          ))}
        </List>
      )}

      {entries.length > visibleEntries.length && (
        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '.65rem' }}>
          +{entries.length - visibleEntries.length}
        </Typography>
      )}
    </Box>
  );
}

function DiffCard({
  title,
  subtitle,
  section,
  lang,
}: {
  title: string;
  subtitle: string;
  section: DatasetChangelogSection;
  lang: 'en' | 'fr';
}) {
  const theme = useTheme();
  
  const COUNT_COLORS: Record<string, string> = {
    added: theme.palette.success.main,
    changed: theme.palette.warning.main,
    removed: theme.palette.error.main,
  };

  const counts = [
    { key: 'added', label: lang === 'en' ? 'Added' : 'Ajoutes', value: section.added.length },
    { key: 'changed', label: lang === 'en' ? 'Changed' : 'Modifies', value: section.changed.length },
    { key: 'removed', label: lang === 'en' ? 'Removed' : 'Retires', value: section.removed.length },
  ];

  return (
    <Card component="article" sx={{ backgroundColor: theme.palette.ui.surface1, borderColor: theme.palette.ui.border }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Typography variant="h6" sx={{ fontSize: '1rem', mb: 0.25 }}>
          {title}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '.75rem', mb: 1.5 }}>
          {subtitle}
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          {counts.map((c) => (
            <Box key={c.key} sx={{ flex: 1, textAlign: 'center', py: 0.75, border: (theme) => `1px solid ${theme.palette.ui.border}` }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '.6rem', display: 'block' }}>
                {c.label}
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: "'Share Tech Mono', monospace", fontWeight: 700, color: COUNT_COLORS[c.key] }}>
                {c.value}
              </Typography>
            </Box>
          ))}
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <DiffList
            title={lang === 'en' ? 'Added' : 'Ajoutes'}
            emptyLabel={lang === 'en' ? 'No additions.' : 'Aucun ajout.'}
            entries={section.added}
            type="added"
          />
          <DiffList
            title={lang === 'en' ? 'Changed' : 'Modifies'}
            emptyLabel={lang === 'en' ? 'No changes.' : 'Aucune modification.'}
            entries={section.changed}
            type="changed"
          />
          <DiffList
            title={lang === 'en' ? 'Removed' : 'Retires'}
            emptyLabel={lang === 'en' ? 'No removals.' : 'Aucun retrait.'}
            entries={section.removed}
            type="removed"
          />
        </Box>
      </CardContent>
    </Card>
  );
}

export function DatasetChangelog() {
  const { activeDataset, changelogOpen, setChangelogOpen } = useCraft();
  const { lang, t } = useI18n();

  const generatedAtLabel = useMemo(() => {
    if (!activeDataset.changelog?.generatedAt) return null;
    return new Date(activeDataset.changelog.generatedAt).toLocaleString(
      lang === 'fr' ? 'fr-FR' : 'en-US',
    );
  }, [activeDataset.changelog?.generatedAt, lang]);

  if (activeDataset.channel !== 'ptu' || !activeDataset.changelog) {
    return null;
  }

  const { changelog } = activeDataset;
  const totalDelta =
    changelog.summary.blueprints.added +
    changelog.summary.blueprints.changed +
    changelog.summary.blueprints.removed +
    changelog.summary.resources.added +
    changelog.summary.resources.changed +
    changelog.summary.resources.removed;

  return (
    <Dialog
      open={changelogOpen}
      onClose={() => setChangelogOpen(false)}
      aria-label={t('PTU changelog', 'Changelog PTU')}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: { maxHeight: '85vh' },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          pb: 1,
        }}
      >
        <Box>
          <Typography
            variant="overline"
            sx={{ color: 'primary.main', letterSpacing: '0.15em' }}
          >
            PTU vs LIVE
          </Typography>
          <Typography
            variant="h6"
            sx={{
              fontSize: '1.2rem',
              lineHeight: 1.2,
            }}
          >
            {t('Detected differences for the active PTU dataset', 'Differences detectees pour le dataset PTU actif')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            {t(
              `Compared against ${changelog.comparedAgainstVersion} (${changelog.comparedAgainstDatasetId})`,
              `Compare a ${changelog.comparedAgainstVersion} (${changelog.comparedAgainstDatasetId})`,
            )}
          </Typography>
        </Box>
        <IconButton
          onClick={() => setChangelogOpen(false)}
          aria-label={t('Close', 'Fermer')}
          size="small"
          sx={{ mt: -0.5, mr: -1 }}
        >
          ✕
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Chip
            label={<><Typography component="span" variant="caption" sx={{ mr: 0.5 }}>{lang === 'en' ? 'Delta entries' : 'Entrees modifiees'}</Typography><strong>{totalDelta}</strong></>}
            variant="outlined"
            size="small"
          />
          {generatedAtLabel && (
            <Chip
              label={<><Typography component="span" variant="caption" sx={{ mr: 0.5 }}>{lang === 'en' ? 'Generated' : 'Genere'}</Typography><strong>{generatedAtLabel}</strong></>}
              variant="outlined"
              size="small"
            />
          )}
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
          <DiffCard
            title={lang === 'en' ? 'Blueprints' : 'Blueprints'}
            subtitle={t('Craftable items changed between PTU and LIVE.', 'Items craftables modifies entre PTU et LIVE.')}
            section={changelog.blueprints}
            lang={lang}
          />
          <DiffCard
            title={lang === 'en' ? 'Resources' : 'Ressources'}
            subtitle={t('Material list changes between PTU and LIVE.', 'Changements de materiaux entre PTU et LIVE.')}
            section={changelog.resources}
            lang={lang}
          />
        </Box>
      </DialogContent>
    </Dialog>
  );
}
