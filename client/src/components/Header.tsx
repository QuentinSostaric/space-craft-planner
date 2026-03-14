import { useCraft } from '../store/CraftContext';
import { useI18n } from '../i18n/I18nContext';
import { useTheme } from '../hooks/useTheme';
import { Button } from './ui/Button';
import { GameIcon } from './ui/GameIcon';

function formatChannelLabel(channel: 'live' | 'ptu') {
  return channel.toUpperCase();
}

export function Header() {
  const {
    goals,
    openPlanner,
    plannerOpen,
    activeDataset,
    availableDatasets,
    activeChannel,
    datasetSource,
    datasetLoading,
    setActiveDatasetChannel,
  } = useCraft();
  const { lang, setLang, t } = useI18n();
  const [theme, setTheme] = useTheme();

  const showChannelSwitch = availableDatasets.length > 1;
  const versionLabel = activeDataset.version || activeDataset.label;
  const buildLabel = activeDataset.buildNumber ? `Build ${activeDataset.buildNumber}` : null;
  const sourceLabel = datasetSource === 'remote'
    ? t('Published dataset', 'Dataset publie')
    : t('Local fallback', 'Fallback local');
  const sourceClassName = [
    'header__source-pill',
    datasetSource === 'remote' ? 'header__source-pill--remote' : 'header__source-pill--local',
  ].join(' ');
  const versionClassName = [
    'header__version-pill',
    datasetSource === 'local'
      ? 'header__version-pill--local'
      : activeChannel === 'live'
        ? 'header__version-pill--live'
        : 'header__version-pill--ptu',
  ].join(' ');

  return (
    <header className="header" role="banner">
      <div className="header__brand">
        <GameIcon name="calculator" size={22} shimmer className="header__logo-icon" />
        <span className="header__title">
          SC<span className="header__title-accent">Craft</span>
        </span>
        <span className="header__subtitle">{activeDataset.label}</span>
      </div>

      <nav className="header__nav" aria-label={t('Main navigation', 'Navigation principale')}>
        <div className={versionClassName}>
          <span className="header__version-dot" aria-hidden="true" />
          <span>{formatChannelLabel(activeChannel)}</span>
          <span>{versionLabel}</span>
        </div>

        {buildLabel && (
          <div className="header__build-pill">
            <span>{buildLabel}</span>
          </div>
        )}

        <div className={sourceClassName}>
          <span>{sourceLabel}</span>
        </div>

        {showChannelSwitch && (
          <div className="header__channel-switch" role="group" aria-label={t('Dataset channel', 'Canal du dataset')}>
            {availableDatasets.map((dataset) => (
              <button
                key={dataset.channel}
                className={[
                  'header__channel-btn',
                  activeChannel === dataset.channel && 'header__channel-btn--active',
                ].filter(Boolean).join(' ')}
                onClick={() => { void setActiveDatasetChannel(dataset.channel); }}
                disabled={datasetLoading}
                aria-pressed={activeChannel === dataset.channel}
                aria-label={t(
                  `Switch to ${dataset.channel.toUpperCase()} data`,
                  `Basculer sur les donnees ${dataset.channel.toUpperCase()}`,
                )}
              >
                <span>{formatChannelLabel(dataset.channel)}</span>
              </button>
            ))}
          </div>
        )}
      </nav>

      <div className="header__actions">
        <button
          className="theme-toggle"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={theme === 'dark'
            ? t('Switch to light theme', 'Passer au theme clair')
            : t('Switch to dark theme', 'Passer au theme sombre')}
          title={theme === 'dark'
            ? t('Light theme', 'Theme clair')
            : t('Dark theme', 'Theme sombre')}
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>

        <div className="lang-toggle" role="group" aria-label={t('Language', 'Langue')}>
          <button
            className={['lang-toggle__btn', lang === 'en' && 'lang-toggle__btn--active'].filter(Boolean).join(' ')}
            onClick={() => setLang('en')}
            aria-pressed={lang === 'en'}
            aria-label="Switch to English"
          >
            EN
          </button>
          <span className="lang-toggle__sep" aria-hidden="true">|</span>
          <button
            className={['lang-toggle__btn', lang === 'fr' && 'lang-toggle__btn--active'].filter(Boolean).join(' ')}
            onClick={() => setLang('fr')}
            aria-pressed={lang === 'fr'}
            aria-label="Passer en francais"
          >
            FR
          </button>
        </div>

        <Button
          variant="gradient"
          size="sm"
          onClick={openPlanner}
          aria-expanded={plannerOpen}
          aria-label={
            t('Open resource planner', 'Ouvrir le planificateur de ressources') +
            (goals.length > 0
              ? ` (${goals.length} ${t('goal', 'objectif')}${goals.length > 1 ? 's' : ''})`
              : '')
          }
        >
          <GameIcon name="shopping-cart" size={14} />
          {t('Planner', 'Planificateur')}
          {goals.length > 0 && (
            <span className="header__goal-count" aria-hidden="true">
              {goals.length}
            </span>
          )}
        </Button>
      </div>
    </header>
  );
}
