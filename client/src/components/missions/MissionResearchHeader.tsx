import { Box, Typography } from '../../ui/system';
import { useCraft } from '../../store/CraftContext';
import { useI18n } from '../../i18n/I18nContext';
import { AppChip } from '../ui/data-display/AppChip';
import { MISSION_REFERENCE_BUILD } from '../../hooks/useMissionSnapshot';

export function MissionResearchHeader() {
  const { activeDataset } = useCraft();
  const { t } = useI18n();
  const sameBuild = String(activeDataset.buildNumber) === MISSION_REFERENCE_BUILD && activeDataset.channel === 'live';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
      <AppChip label={`LIVE 4.10 · ${MISSION_REFERENCE_BUILD}`} size="small" variant="outlined" />
      <Typography variant="caption" sx={{ color: sameBuild ? 'text.secondary' : 'warning.main' }}>
        {sameBuild
          ? t('Game data · 26 Aug 2026 · Server availability unverified', 'Données du jeu · 26 août 2026 · Disponibilité serveur non vérifiée')
          : t('Reference build shown. This research does not describe your selected dataset.', 'Build de référence affiché. Cette recherche ne décrit pas le dataset sélectionné.')}
      </Typography>
    </Box>
  );
}
