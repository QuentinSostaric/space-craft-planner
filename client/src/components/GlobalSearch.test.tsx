import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { renderWithProviders, screen } from '../test/render';
import { GlobalSearch } from './GlobalSearch';

const options = [
  { key: 'a', label: 'CQ7 Magazine', description: 'Behring', kind: 'blueprint' as const },
  { key: 'b', label: 'CQ7 Rifle', description: 'Behring / FPS Weapon', kind: 'blueprint' as const },
  { key: 'c', label: 'Aluminium', description: 'Métal', kind: 'resource' as const },
];
function setup() {
  const select = vi.fn();
  const activate = vi.fn();
  const result = renderWithProviders(
    <>
      <GlobalSearch options={options} onSelect={select} onActivate={activate} />
      <button>Outside</button>
    </>,
  );
  return {
    ...result,
    select,
    activate,
    user: userEvent.setup(),
    input: screen.getByRole('combobox', { name: 'Global search' }),
  };
}
describe('GlobalSearch', () => {
  it('filters immediately, ranks exact names and selects once on Enter', async () => {
    const { user, input, select } = setup();
    await user.type(input, 'cq7 rifle');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(input).toHaveValue('cq7 rifle');
    await user.keyboard('{Enter}');
    expect(select).toHaveBeenCalledExactlyOnceWith(options[1]);
    expect(input).toHaveValue('');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
  it('never navigates on blur and keeps the unfinished query', async () => {
    const { user, input, select } = setup();
    await user.type(input, 'CQ7 Rifle');
    await user.click(screen.getByRole('button', { name: 'Outside' }));
    expect(select).not.toHaveBeenCalled();
    expect(input).toHaveValue('CQ7 Rifle');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    await user.click(input);
    expect(screen.getByRole('option')).toBeInTheDocument();
  });
  it('supports arrows and Escape without committing stale results', async () => {
    const { user, input, select } = setup();
    await user.type(input, 'cq7');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(select).toHaveBeenCalledExactlyOnceWith(options[1]);
    select.mockClear();
    await user.type(input, 'no-such-object');
    await user.keyboard('{Enter}');
    expect(select).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });
  it('clicks a result once and exposes an accessible combobox', async () => {
    const { user, input, select, container } = setup();
    await user.type(input, 'metal');
    expect((await axe(container)).violations).toEqual([]);
    await user.click(screen.getByRole('option', { name: /Aluminium/ }));
    expect(select).toHaveBeenCalledExactlyOnceWith(options[2]);
  });
});
