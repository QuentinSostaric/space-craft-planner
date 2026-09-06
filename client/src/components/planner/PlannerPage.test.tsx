import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen } from '../../test/render';
import { LS_KEYS } from '../../types';
import { PlannerPage, type PlannerNote } from '../PlannerPage';

vi.mock('../../analytics/posthog', () => ({ trackEvent: vi.fn() }));
vi.mock('./PlannerSavedWork', () => ({ PlannerSavedWork: () => null }));

const originalBody = '# Launch plan\n\n- [ ] Collect materials\n- [ ] Deliver cargo\n\nKeep **this note** and @bp:test-blueprint unchanged.\n';
const note: PlannerNote = { id: 'saved-plan', title: 'Cargo run', body: originalBody, pinned: true, tag: 'route', updatedAt: 1700000000000 };

beforeEach(() => {
  localStorage.setItem(LS_KEYS.PLANNER_NOTES, JSON.stringify([note]));
});

describe('planner notebook daily workflow', () => {
  it('completes only the current task, moves to the next action and can undo without changing the note', () => {
    renderWithProviders(<PlannerPage />);
    expect(screen.getByRole('heading', { name: 'Collect materials' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Complete task' }));
    expect(screen.getByRole('heading', { name: 'Deliver cargo' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Checklist progress' })).toHaveAttribute('aria-valuenow', '1');
    expect(JSON.parse(localStorage.getItem(LS_KEYS.PLANNER_NOTES)!)[0].body).toBe(originalBody.replace('- [ ] Collect materials', '- [x] Collect materials'));

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('heading', { name: 'Collect materials' })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(LS_KEYS.PLANNER_NOTES)!)[0].body).toBe(originalBody);
  });

  it('keeps the complete checklist available and makes the entire task label clickable', () => {
    renderWithProviders(<PlannerPage />);
    fireEvent.click(screen.getByText('Full checklist & notes'));
    const checkbox = screen.getByRole('checkbox', { name: 'Deliver cargo' });
    fireEvent.click(checkbox.closest('label')!);
    expect(checkbox).toBeChecked();
    expect(screen.getByRole('heading', { name: 'Collect materials' })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(LS_KEYS.PLANNER_NOTES)!)[0].body).toBe(originalBody.replace('- [ ] Deliver cargo', '- [x] Deliver cargo'));
  });

  it('keeps editing and note management behind labeled controls without changing saved content on entry', () => {
    renderWithProviders(<PlannerPage />);
    expect(screen.queryByRole('textbox', { name: 'Note body' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete note' }).closest('details')).not.toHaveAttribute('open');
    fireEvent.click(screen.getByText('Organize & export'));
    expect(screen.getByRole('button', { name: 'Copy Markdown' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete note' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit note' }));
    expect(screen.getByRole('textbox', { name: 'Note body' })).toHaveValue(originalBody);
    expect(JSON.parse(localStorage.getItem(LS_KEYS.PLANNER_NOTES)!)).toEqual([note]);
  });

  it('starts with an honest empty state instead of a prefilled demonstration note', () => {
    localStorage.removeItem(LS_KEYS.PLANNER_NOTES);
    renderWithProviders(<PlannerPage />);
    expect(screen.getByRole('heading', { name: 'Prepare your next session' })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(LS_KEYS.PLANNER_NOTES)!)).toEqual([]);
  });
});
