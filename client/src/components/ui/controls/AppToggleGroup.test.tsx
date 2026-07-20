import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '../../../test/render';
import { AppToggleGroup } from './AppToggleGroup';

function Controlled({ onChange }: { onChange: (value: string) => void }) {
  const [value, setValue] = useState('live');
  return (
    <AppToggleGroup
      value={value}
      options={[
        { label: 'LIVE', value: 'live' },
        { label: 'PTU', value: 'ptu' },
      ]}
      onValueChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      ariaLabel="Dataset channel"
    />
  );
}

describe('AppToggleGroup', () => {
  it('selects an option and reports its value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = renderWithProviders(<Controlled onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'PTU' }));
    expect(onChange).toHaveBeenCalledWith('ptu');
    expect((await axe(container)).violations).toEqual([]);
  });

  it('keeps a selection when empty selection is not allowed', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<Controlled onChange={onChange} />);

    // Clicking the already-active option must not clear the selection:
    // the group never emits an empty value.
    await user.click(screen.getByRole('button', { name: 'LIVE' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
