import { useMemo } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
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
    <div className="dataset-changelog__list-block">
      <div className="dataset-changelog__list-header">
        <span>{title}</span>
        <span>{entries.length}</span>
      </div>

      {visibleEntries.length === 0 ? (
        <p className="dataset-changelog__empty">{emptyLabel}</p>
      ) : (
        <ul className="dataset-changelog__list">
          {visibleEntries.map((entry) => (
            <li key={`${type}-${entry.id}`} className="dataset-changelog__list-item">
              <span className="dataset-changelog__list-name">{renderDiffLabel(entry)}</span>
              {type === 'changed' && entry.changedFields && entry.changedFields.length > 0 && (
                <span className="dataset-changelog__list-meta">
                  {entry.changedFields.join(', ')}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {entries.length > visibleEntries.length && (
        <p className="dataset-changelog__more">
          +{entries.length - visibleEntries.length}
        </p>
      )}
    </div>
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
  return (
    <article className="dataset-changelog__card">
      <div className="dataset-changelog__card-header">
        <h3 className="dataset-changelog__card-title">{title}</h3>
        <p className="dataset-changelog__card-subtitle">{subtitle}</p>
      </div>

      <div className="dataset-changelog__counts">
        <div className="dataset-changelog__count dataset-changelog__count--added">
          <span>{lang === 'en' ? 'Added' : 'Ajoutes'}</span>
          <strong>{section.added.length}</strong>
        </div>
        <div className="dataset-changelog__count dataset-changelog__count--changed">
          <span>{lang === 'en' ? 'Changed' : 'Modifies'}</span>
          <strong>{section.changed.length}</strong>
        </div>
        <div className="dataset-changelog__count dataset-changelog__count--removed">
          <span>{lang === 'en' ? 'Removed' : 'Retires'}</span>
          <strong>{section.removed.length}</strong>
        </div>
      </div>

      <div className="dataset-changelog__lists">
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
      </div>
    </article>
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
              fontFamily: "'Khand', sans-serif",
              fontWeight: 700,
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
        <div className="dataset-changelog__summary">
          <div className="dataset-changelog__summary-pill">
            <span>{lang === 'en' ? 'Delta entries' : 'Entrees modifiees'}</span>
            <strong>{totalDelta}</strong>
          </div>
          {generatedAtLabel && (
            <div className="dataset-changelog__summary-pill">
              <span>{lang === 'en' ? 'Generated' : 'Genere'}</span>
              <strong>{generatedAtLabel}</strong>
            </div>
          )}
        </div>

        <div className="dataset-changelog__grid">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
