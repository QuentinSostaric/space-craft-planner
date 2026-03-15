import { I18nProvider } from './i18n/I18nContext';
import { CraftProvider } from './store/CraftContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { BlueprintExplorer } from './components/BlueprintExplorer';
import { CraftSimulator } from './components/CraftSimulator';
import { DismantlingPanel } from './components/DismantlingPanel';
import { PlannerPanel } from './components/PlannerPanel';
import { ComparisonModal } from './components/ComparisonModal';
import { DatasetChangelog } from './components/DatasetChangelog';
import { useCraft } from './store/CraftContext';

function AppShell() {
  const { appMode } = useCraft();
  return (
    <div className="app">
      <Header />
      <div className="app__body">
        <DatasetChangelog />
        <div className="dashboard" role="main">
          <aside className="dashboard__col dashboard__col--left" aria-label="Blueprint explorer">
            <BlueprintExplorer />
          </aside>
          <section className="dashboard__col dashboard__col--center" aria-label={appMode === 'craft' ? 'Craft simulator' : 'Dismantling'}>
            {appMode === 'craft' ? <CraftSimulator /> : <DismantlingPanel />}
          </section>
          <aside className="dashboard__col dashboard__col--right" aria-label="Planner">
            <PlannerPanel />
          </aside>
        </div>
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
