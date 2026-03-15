import { I18nProvider, useI18n } from './i18n/I18nContext';
import { CraftProvider } from './store/CraftContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { BlueprintExplorer } from './components/BlueprintExplorer';
import { CraftSimulator } from './components/CraftSimulator';
import { DismantlingPanel } from './components/DismantlingPanel';
import { MissionsPanel } from './components/MissionsPanel';
import { PlannerPanel } from './components/PlannerPanel';
import { ComparisonModal } from './components/ComparisonModal';
import { DatasetChangelog } from './components/DatasetChangelog';
import { useCraft } from './store/CraftContext';

function AppShell() {
  const { appMode, activeDataset, datasetLoading, datasetError } = useCraft();
  const { t } = useI18n();

  if (datasetLoading && activeDataset.blueprints.length === 0) {
    return (
      <div className="app">
        <a className="skip-link" href="#main-content">
          {t('Skip to main content', 'Aller au contenu principal')}
        </a>
        <Header />
        <main id="main-content" className="app-status" aria-live="polite">
          <div className="app-status__panel">
            <h2 className="app-status__title">
              {t('Loading published dataset', 'Chargement du dataset publie')}
            </h2>
            <p className="app-status__message">
              {t(
                'The app is connecting to the published MongoDB dataset.',
                'L application se connecte au dataset publie sur MongoDB.',
              )}
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (datasetError && activeDataset.blueprints.length === 0) {
    return (
      <div className="app">
        <a className="skip-link" href="#main-content">
          {t('Skip to main content', 'Aller au contenu principal')}
        </a>
        <Header />
        <main id="main-content" className="app-status" aria-live="assertive">
          <div className="app-status__panel app-status__panel--error">
            <h2 className="app-status__title">
              {t('Published dataset unavailable', 'Dataset publie indisponible')}
            </h2>
            <p className="app-status__message">{datasetError}</p>
            <p className="app-status__hint">
              {t(
                'This app no longer bundles local dataset snapshots. The runtime API must be available.',
                'Cette app n embarque plus de snapshots locaux. L API runtime doit etre disponible.',
              )}
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">
        {t('Skip to main content', 'Aller au contenu principal')}
      </a>
      <Header />
      <div className="app__body">
        <DatasetChangelog />
        <main id="main-content" className="dashboard">
          <aside
            className="dashboard__col dashboard__col--left"
            aria-label={t('Blueprint explorer', 'Explorateur de blueprints')}
          >
            <BlueprintExplorer />
          </aside>
          <section
            className="dashboard__col dashboard__col--center"
            aria-label={
              appMode === 'craft'
                ? t('Craft simulator', 'Simulateur de craft')
                : appMode === 'dismantle'
                  ? t('Dismantling', 'Demontage')
                  : t('Missions', 'Missions')
            }
          >
            {appMode === 'craft' && <CraftSimulator />}
            {appMode === 'dismantle' && <DismantlingPanel />}
            {appMode === 'missions' && <MissionsPanel />}
          </section>
          <aside
            className="dashboard__col dashboard__col--right"
            aria-label={t('Planner', 'Planificateur')}
          >
            <PlannerPanel />
          </aside>
        </main>
      </div>
      <ComparisonModal />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <I18nProvider>
        <CraftProvider>
          <AppShell />
        </CraftProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}
