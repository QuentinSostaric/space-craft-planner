import { I18nProvider } from './i18n/I18nContext';
import { CraftProvider, useCraft } from './store/CraftContext';
import { useI18n } from './i18n/I18nContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { BlueprintExplorer } from './components/BlueprintExplorer';
import { CraftSimulator } from './components/CraftSimulator';
import { StatsPanel } from './components/StatsPanel';
import { PlannerDrawer } from './components/PlannerDrawer';
import { ComparisonModal } from './components/ComparisonModal';
import { DatasetChangelog } from './components/DatasetChangelog';

function DatasetStatusBanner() {
  const { datasetError, datasetSource, activeDataset } = useCraft();
  const { t } = useI18n();

  if (!datasetError && datasetSource !== 'local') {
    return null;
  }

  return (
    <section className="dataset-banner" role="status" aria-live="polite">
      <div className="dataset-banner__content">
        <strong className="dataset-banner__title">
          {datasetSource === 'local'
            ? t('Local dataset fallback', 'Fallback dataset local')
            : t('Dataset notice', 'Notice dataset')}
        </strong>
        <p className="dataset-banner__message">
          {datasetError ?? t(
            `Displaying ${activeDataset.label} from the bundled local files.`,
            `Affichage de ${activeDataset.label} depuis les fichiers locaux embarques.`,
          )}
        </p>
      </div>
    </section>
  );
}

function AppShell() {
  return (
    <div className="app">
      <Header />
      <div className="app__body">
        <DatasetStatusBanner />
        <DatasetChangelog />
        <div className="dashboard" role="main">
          <aside className="dashboard__col dashboard__col--left" aria-label="Blueprint explorer">
            <BlueprintExplorer />
          </aside>
          <section className="dashboard__col dashboard__col--center" aria-label="Craft simulator">
            <CraftSimulator />
          </section>
          <aside className="dashboard__col dashboard__col--right" aria-label="Stats and goals">
            <StatsPanel />
          </aside>
        </div>
      </div>
      <PlannerDrawer />
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
