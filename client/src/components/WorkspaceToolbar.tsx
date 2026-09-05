import { useEffect, useState } from 'react';
import { Box, Typography } from '../ui/system';
import { AppToggleGroup } from './ui/controls';
import { useI18n } from '../i18n/I18nContext';
import { FONT_MONO } from '../theme';
import type { MainView } from './NavRail';

const DENSITY_KEY = 'sc-craft-workspace-density';

/** A single persistent density preference applies to every workspace. */
export function WorkspaceToolbar({ view }: { view: MainView }) {
  const { t } = useI18n();
  const [density, setDensity] = useState<'compact' | 'comfortable'>(() => {
    try {
      return localStorage.getItem(DENSITY_KEY) === 'comfortable' ? 'comfortable' : 'compact';
    } catch {
      return 'compact';
    }
  });
  useEffect(() => {
    document.documentElement.dataset.density = density;
    try {
      localStorage.setItem(DENSITY_KEY, density);
    } catch {
      /* Session-only when storage is unavailable. */
    }
  }, [density]);
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
      <AppToggleGroup
        value={density}
        onValueChange={setDensity}
        ariaLabel={t('Display density', 'Densité d’affichage', 'Anzeigedichte')}
        options={[
          { value: 'compact', label: t('Dense', 'Dense', 'Kompakt') },
          { value: 'comfortable', label: t('Comfort', 'Confort', 'Komfort') },
        ]}
        partSx={{ button: { minHeight: 28, px: 1, py: 0.25, fontSize: '0.6875rem' } }}
      />
    </Box>
  );
}
