import { I18nProvider, useI18n } from './i18n/I18nContext';
import { CraftProvider } from './store/CraftContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { BlueprintExplorer } from './components/BlueprintExplorer';
import { BlueprintGrid } from './components/BlueprintGrid';
import { ItemWorkspace } from './components/ItemWorkspace';
import { MissionsPanel } from './components/MissionsPanel';
import { PlannerDrawer } from './components/PlannerDrawer';
import { ComparisonModal } from './components/ComparisonModal';
import { DatasetChangelog } from './components/DatasetChangelog';
import { Footer } from './components/Footer';
import { useCraft } from './store/CraftContext';
import { useEffect, useState } from 'react';

type MainView = 'blueprints' | 'missions';

function MainContent() {
  const { activeBlueprint, ensureMissionRewardsLoaded } = useCraft();
  const { t } = useI18n();
  const [mainView, setMainView] = useState<MainView>('blueprints');

  // Load missions when switching to missions view or when no blueprint is selected
  useEffect(() => {
    if (mainView === 'missions' || !activeBlueprint) {
      void ensureMissionRewardsLoaded();
    }
  }, [mainView, activeBlueprint, ensureMissionRewardsLoaded]);

  if (activeBlueprint) {
    return <ItemWorkspace />;
  }

  return (
    <div className="main-content">
      <nav className="main-tabs" role="tablist" aria-label={t('Main view', 'Vue principale')}>
        <button
          className={['main-tab', mainView === 'blueprints' && 'main-tab--active'].filter(Boolean).join(' ')}
          role="tab"
          aria-selected={mainView === 'blueprints'}
          onClick={() => setMainView('blueprints')}
        >
          {t('Blueprints', 'Blueprints')}
        </button>
        <button
          className={['main-tab', mainView === 'missions' && 'main-tab--active'].filter(Boolean).join(' ')}
          role="tab"
          aria-selected={mainView === 'missions'}
          onClick={() => {
            setMainView('missions');
            void ensureMissionRewardsLoaded();
          }}
        >
          {t('Missions', 'Missions')}
        </button>
      </nav>

      {mainView === 'blueprints' ? (
        <BlueprintGrid />
      ) : (
        <MissionsPanel />
      )}
    </div>
  );
}

function AppShell() {
  const { activeDataset, datasetLoading, datasetError } = useCraft();
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
              {t('Loading published dataset', 'Chargement du dataset publié')}
            </h2>
            <p className="app-status__message">
              {t(
                'The app is connecting to the published MongoDB dataset.',
                'L\'application se connecte au dataset publié sur MongoDB.',
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
              {t('Published dataset unavailable', 'Dataset publié indisponible')}
            </h2>
            <p className="app-status__message">{datasetError}</p>
            <p className="app-status__hint">
              {t(
                'This app no longer bundles local dataset snapshots. The runtime API must be available.',
                'Cette app n\'embarque plus de snapshots locaux. L\'API runtime doit être disponible.',
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
        <main id="main-content" className="dashboard">
          <aside
            className="dashboard__col dashboard__col--left"
            aria-label={t('Blueprint filters', 'Filtres blueprints')}
          >
            <BlueprintExplorer />
          </aside>
          <section
            className="dashboard__col dashboard__col--center"
            aria-label={t('Content', 'Contenu')}
          >
            <MainContent />
          </section>
        </main>
        <PlannerDrawer />
      </div>
      <Footer />
      <ComparisonModal />
      <DatasetChangelog />
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
