import { useEffect } from 'react';
import { Box, Typography } from '../ui/system';
import { useI18n } from '../i18n/I18nContext';
import { FONT_MONO } from '../theme';
import type { MainView } from './NavRail';

/** Workspaces always use the compact rhythm. */
export function WorkspaceToolbar({ view }: { view: MainView }) {
  const { t } = useI18n();
  useEffect(() => { document.documentElement.dataset.density = 'compact'; }, []);
  const labels: Record<MainView, string> = {
    fabricator: t('Fabricator', 'Fabricator', 'Fertigung'),
    blueprints: t('Blueprint library', 'Bibliothèque de blueprints', 'Bauplanbibliothek'),
    missions: t('Mission intelligence', 'Renseignements missions', 'Missionsübersicht'),
    resources: t('Resource database', 'Base de ressources', 'Ressourcendatenbank'),
    planner: t('Operations planner', 'Planification des opérations', 'Einsatzplanung'),
    organizations: t('Organizations', 'Organisations', 'Organisationen'),
    account: t('Account', 'Compte', 'Konto'),
    changelog: t('Dataset changes', 'Évolution des données', 'Datenänderungen'),
    privacy: t('Privacy', 'Confidentialité', 'Datenschutz'),
  };
  return (
    <Box
      className="workspace-toolbar"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
        minHeight: 40,
        px: 'var(--workspace-gutter)',
        borderBottom: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        flexShrink: 0,
      }}
    >
      <Typography
        sx={{ fontFamily: FONT_MONO, fontSize: '0.6875rem', color: 'text.secondary', minWidth: 0 }}
      >
        <Box
          component="span"
          sx={{ display: { xs: 'none', sm: 'inline' }, color: 'text.disabled' }}
        >
          SC CRAFT /{' '}
        </Box>
        {labels[view]}
      </Typography>

    </Box>
  );
}
