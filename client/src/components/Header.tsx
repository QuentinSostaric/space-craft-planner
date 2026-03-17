import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { useTheme } from '../hooks/useTheme';
import { GameIcon } from './ui/GameIcon';

export function Header() {
  const {
    activeDataset,
    availableDatasets,
    activeChannel,
    datasetLoading,
    setActiveDatasetChannel,
    goals,
    openPlanner,
    changelogOpen,
    setChangelogOpen,
  } = useCraft();
  const { lang, setLang, t } = useI18n();
  const [theme, setTheme] = useTheme();

  const showChannelToggle = availableDatasets.length > 1;
  const hasChangelog = activeDataset.channel === 'ptu' && Boolean(activeDataset.changelog);

  return (
    <header className="header" role="banner">
      <div className="header__brand">
        <GameIcon name="calculator" size={22} className="header__logo-icon" />
        <span className="header__title">
          Item<span className="header__title-accent">Fabricator</span>
        </span>
        <span className="header__subtitle">{activeDataset.version}</span>
      </div>

      <div className="header__actions">
        {showChannelToggle && (
          <div className="channel-toggle" role="group" aria-label={t('Dataset channel', 'Canal du dataset')}>
            {availableDatasets.map((dataset) => (
              <button
                key={dataset.channel}
                className={[
                  'channel-toggle__btn',
                  `channel-toggle__btn--${dataset.channel}`,
                  activeChannel === dataset.channel && 'channel-toggle__btn--active',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => {
                  void setActiveDatasetChannel(dataset.channel);
                }}
                disabled={datasetLoading}
                aria-pressed={activeChannel === dataset.channel}
                aria-label={t(
                  `Switch to ${dataset.channel.toUpperCase()} data`,
                  `Basculer sur les donnees ${dataset.channel.toUpperCase()}`,
                )}
              >
                {dataset.channel.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {hasChangelog && (
          <button
            className={['header__changelog-btn', changelogOpen && 'header__changelog-btn--active'].filter(Boolean).join(' ')}
            onClick={() => setChangelogOpen(!changelogOpen)}
            aria-pressed={changelogOpen}
            aria-label={t('Toggle changelog', 'Afficher le changelog')}
            title={t('PTU Changelog', 'Changelog PTU')}
          >
            Δ
          </button>
        )}

        <button
          className="header__planner-btn"
          onClick={openPlanner}
          aria-label={t(`Open planner (${goals.length} goals)`, `Ouvrir le planificateur (${goals.length} objectifs)`)}
          title={t('Planner', 'Planificateur')}
        >
          🎯
          {goals.length > 0 && (
            <span className="header__goal-count">{goals.length}</span>
          )}
        </button>

        <button
          className="theme-toggle"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={
            theme === 'dark'
              ? t('Switch to light theme', 'Passer au theme clair')
              : t('Switch to dark theme', 'Passer au theme sombre')
          }
          title={theme === 'dark' ? t('Light theme', 'Theme clair') : t('Dark theme', 'Theme sombre')}
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>

        <div className="lang-toggle" role="group" aria-label={t('Language', 'Langue')}>
          <button
            className={['lang-toggle__btn', lang === 'en' && 'lang-toggle__btn--active']
              .filter(Boolean)
              .join(' ')}
            onClick={() => setLang('en')}
            aria-pressed={lang === 'en'}
            aria-label={t('Switch to English', 'Passer en anglais')}
          >
            EN
          </button>
          <span className="lang-toggle__sep" aria-hidden="true">|</span>
          <button
            className={['lang-toggle__btn', lang === 'fr' && 'lang-toggle__btn--active']
              .filter(Boolean)
              .join(' ')}
            onClick={() => setLang('fr')}
            aria-pressed={lang === 'fr'}
            aria-label={t('Switch to French', 'Passer en francais')}
          >
            FR
          </button>
        </div>
      </div>
    </header>
  );
}
