import { useEffect, useMemo, useState } from 'react';
import { useCraft } from '../../store/CraftContext';
import { useI18n } from '../../i18n/I18nContext';
import { aggregatePlannedResources } from '../../utils/crafting';
import { AppButton } from '../ui/controls';
import { GoalsList } from './GoalsList';
import { ResourcesList } from './ResourcesList';
import { PlannerTodoBoard } from './PlannerTodoBoard';

type WorkView = 'goals' | 'resources' | 'tasks';
const isSavedWorkHash = () => ['#planner-production', '#planner-saved-work'].includes(window.location.hash);

/** Restores the saved plans created elsewhere in the app without mixing them into free-form notes. */
export function PlannerSavedWork() {
  const { t } = useI18n();
  const { goals, blueprints, plannerResourceRequirements, plannerTodoItems, ensureBlueprintDetailLoaded } = useCraft();
  const [open, setOpen] = useState(isSavedWorkHash);
  const [view, setView] = useState<WorkView>(() => goals.length ? 'goals' : Object.keys(plannerResourceRequirements).length ? 'resources' : 'tasks');
  const aggregated = useMemo(() => aggregatePlannedResources(goals, blueprints, plannerResourceRequirements), [goals, blueprints, plannerResourceRequirements]);
  const openTasks = plannerTodoItems.filter((item) => !item.completed).length;
  const goalBlueprintIds = useMemo(() => [...new Set(goals.map((goal) => goal.blueprintId))], [goals]);
  useEffect(() => {
    const revealLinkedWork = () => { if (isSavedWorkHash()) setOpen(true); };
    window.addEventListener('hashchange', revealLinkedWork);
    window.addEventListener('popstate', revealLinkedWork);
    return () => {
      window.removeEventListener('hashchange', revealLinkedWork);
      window.removeEventListener('popstate', revealLinkedWork);
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    for (const id of goalBlueprintIds) {
      const blueprint = blueprints.find((candidate) => candidate.id === id);
      if (blueprint && !blueprint.detailsLoaded) void ensureBlueprintDetailLoaded(id);
    }
  }, [open, goalBlueprintIds, blueprints, ensureBlueprintDetailLoaded]);

  const summary = [
    goals.length > 0 ? `${goals.length} ${t('crafts', 'crafts', 'Fertigungen')}` : null,
    aggregated.length > 0 ? `${aggregated.length} ${t('materials', 'matériaux', 'Materialien')}` : null,
    plannerTodoItems.length > 0 ? `${openTasks}/${plannerTodoItems.length} ${t('tasks open', 'tâches ouvertes', 'offene Aufgaben')}` : null,
  ].filter(Boolean).join(' · ');

  return <details className="planner-saved-work" id="planner-production" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary><span><i className="pi pi-box" aria-hidden="true" />{t('Collection & crafts', 'Collecte & crafts', 'Sammlung & Fertigung')}</span><small>{summary || t('Saved goals, materials & tasks', 'Objectifs, matériaux & tâches enregistrés', 'Gespeicherte Ziele, Materialien & Aufgaben')}</small></summary>
    {open && <div className="planner-saved-work-body">
      <div className="planner-saved-work-navigation" role="group" aria-label={t('Saved work to display', 'Travail enregistré à afficher', 'Gespeicherte Arbeit anzeigen')}>
        <AppButton variant={view === 'goals' ? 'secondary' : 'ghost'} size="sm" ariaPressed={view === 'goals'} onClick={() => setView('goals')}>{t('Craft queue', 'File de craft', 'Fertigungswarteschlange')} · {goals.length}</AppButton>
        <AppButton variant={view === 'resources' ? 'secondary' : 'ghost'} size="sm" ariaPressed={view === 'resources'} onClick={() => setView('resources')}>{t('Materials', 'Matériaux', 'Materialien')} · {aggregated.length}</AppButton>
        <AppButton variant={view === 'tasks' ? 'secondary' : 'ghost'} size="sm" ariaPressed={view === 'tasks'} onClick={() => setView('tasks')}>{t('Tasks', 'Tâches', 'Aufgaben')} · {plannerTodoItems.length}</AppButton>
      </div>
      {view === 'goals' ? <><p className="planner-saved-work-hint">{t('Your saved crafts. Select one to reopen its configuration in the Fabricator.', 'Vos crafts enregistrés. Sélectionnez-en un pour retrouver sa configuration dans le Fabricateur.', 'Ihre gespeicherten Fertigungen. Wählen Sie eine aus, um ihre Konfiguration im Fabrikator zu öffnen.')}</p><GoalsList /></>
        : view === 'resources' ? <><p className="planner-saved-work-hint">{t('Materials from your craft queue and collection requests, combined in one checklist.', 'Les matériaux de votre file de craft et vos demandes de collecte, réunis dans une checklist.', 'Materialien aus Ihrer Fertigungswarteschlange und Ihren Sammelanfragen in einer Checkliste.')}</p><ResourcesList aggregated={aggregated} /></>
          : <PlannerTodoBoard />}
    </div>}
  </details>;
}
