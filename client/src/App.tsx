import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';

type PlannerStatus = 'planned' | 'active' | 'complete';

type PlannerTask = {
  _id: string;
  title: string;
  objective: string;
  launchDate: string;
  crew: string;
  status: PlannerStatus;
};

type ApiState = {
  items: PlannerTask[];
  databaseConnected: boolean;
  message: string;
};

const emptyForm = {
  title: '',
  objective: '',
  launchDate: '',
  crew: '',
};

const statusLabel: Record<PlannerStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  complete: 'Complete',
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...init,
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(errorPayload?.message ?? 'Unexpected API error');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export default function App() {
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [databaseConnected, setDatabaseConnected] = useState(false);
  const [message, setMessage] = useState('Loading mission control...');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    void loadTasks();
  }, []);

  const activeCount = useMemo(
    () => tasks.filter((task) => task.status === 'active').length,
    [tasks],
  );

  const completionRate = useMemo(() => {
    if (tasks.length === 0) {
      return 0;
    }

    const completeCount = tasks.filter((task) => task.status === 'complete').length;
    return Math.round((completeCount / tasks.length) * 100);
  }, [tasks]);

  async function loadTasks() {
    setIsLoading(true);
    setError('');

    try {
      const payload = await request<ApiState>('/api/tasks');
      setTasks(payload.items);
      setDatabaseConnected(payload.databaseConnected);
      setMessage(payload.message);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const payload = await request<{ item: PlannerTask }>('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(form),
      });

      setTasks((current) => [payload.item, ...current]);
      setForm(emptyForm);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function updateTaskStatus(taskId: string, status: PlannerStatus) {
    setError('');

    try {
      const payload = await request<{ item: PlannerTask }>(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });

      setTasks((current) =>
        current.map((task) => (task._id === taskId ? payload.item : task)),
      );
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update task');
    }
  }

  async function deleteTask(taskId: string) {
    setError('');

    try {
      await request(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });

      setTasks((current) => current.filter((task) => task._id !== taskId));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete task');
    }
  }

  return (
    <main className="shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Space Craft Planner</p>
          <h1>Plan missions, track launches, and keep Atlas as your source of truth.</h1>
          <p className="hero-text">
            React drives the console. Express exposes the mission API. MongoDB Atlas stores
            each launch task once your connection string is configured.
          </p>
        </div>

        <div className="stats-grid">
          <article className="stat-card">
            <span className="stat-label">Mission queue</span>
            <strong>{tasks.length}</strong>
          </article>
          <article className="stat-card">
            <span className="stat-label">Active flights</span>
            <strong>{activeCount}</strong>
          </article>
          <article className="stat-card">
            <span className="stat-label">Completion</span>
            <strong>{completionRate}%</strong>
          </article>
        </div>
      </section>

      <section className="status-banner">
        <div>
          <p className={`badge ${databaseConnected ? 'ok' : 'warning'}`}>
            {databaseConnected ? 'Atlas connected' : 'Atlas setup required'}
          </p>
          <p>{message}</p>
        </div>
        <button type="button" className="ghost-button" onClick={() => void loadTasks()}>
          Refresh
        </button>
      </section>

      {error ? <p className="error-box">{error}</p> : null}

      <section className="content-grid">
        <form className="composer-card" onSubmit={handleSubmit}>
          <div className="card-header">
            <p className="eyebrow">New launch item</p>
            <h2>Create a mission</h2>
          </div>

          <label>
            Mission name
            <input
              required
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Europa Mapping Run"
            />
          </label>

          <label>
            Objective
            <textarea
              required
              rows={4}
              value={form.objective}
              onChange={(event) =>
                setForm((current) => ({ ...current, objective: event.target.value }))
              }
              placeholder="Scan the polar ice fields and transmit anomaly reports."
            />
          </label>

          <div className="field-row">
            <label>
              Launch date
              <input
                required
                type="date"
                value={form.launchDate}
                onChange={(event) =>
                  setForm((current) => ({ ...current, launchDate: event.target.value }))
                }
              />
            </label>

            <label>
              Crew
              <input
                required
                value={form.crew}
                onChange={(event) => setForm((current) => ({ ...current, crew: event.target.value }))}
                placeholder="Orion Crew"
              />
            </label>
          </div>

          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Add mission'}
          </button>
        </form>

        <section className="feed-card">
          <div className="card-header">
            <p className="eyebrow">Mission feed</p>
            <h2>Current planner items</h2>
          </div>

          {isLoading ? <p className="empty-state">Loading tasks from mission control...</p> : null}

          {!isLoading && tasks.length === 0 ? (
            <p className="empty-state">
              No missions yet. Add your Atlas URI, start the server, then create the first task.
            </p>
          ) : null}

          <div className="task-list">
            {tasks.map((task) => (
              <article key={task._id} className="task-card">
                <div className="task-meta">
                  <span className={`status-pill ${task.status}`}>{statusLabel[task.status]}</span>
                  <span>{new Date(task.launchDate).toLocaleDateString('fr-FR')}</span>
                </div>

                <h3>{task.title}</h3>
                <p>{task.objective}</p>

                <dl>
                  <div>
                    <dt>Crew</dt>
                    <dd>{task.crew}</dd>
                  </div>
                </dl>

                <div className="task-actions">
                  <select
                    aria-label={`Update ${task.title} status`}
                    value={task.status}
                    onChange={(event) =>
                      void updateTaskStatus(task._id, event.target.value as PlannerStatus)
                    }
                  >
                    <option value="planned">Planned</option>
                    <option value="active">Active</option>
                    <option value="complete">Complete</option>
                  </select>
                  <button
                    type="button"
                    className="ghost-button danger"
                    onClick={() => void deleteTask(task._id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
