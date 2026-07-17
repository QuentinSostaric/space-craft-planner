import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '../../../test/render';
import { AppCheckbox } from './AppCheckbox';
import { AppSelect } from './AppSelect';
import { AppSlider } from './AppSlider';
import { AppTextField } from './AppTextField';

function ControlledTextField() {
  const [value, setValue] = useState('');
  return (
    <AppTextField
      label="Craft name"
      value={value}
      onValueChange={setValue}
      helperText="Use a recognizable name."
    />
  );
}

function ControlledSelect({ onChange }: { onChange: (value: string | null) => void }) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <AppSelect
      label="Quality"
      value={value}
      options={[
        { label: 'Standard', value: 'standard' },
        { label: 'Premium', value: 'premium' },
      ]}
      onValueChange={(nextValue) => {
        setValue(nextValue);
        onChange(nextValue);
      }}
    />
  );
}

describe('Prime-native controls', () => {
  it('wires labels and emits direct text values', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<ControlledTextField />);
    const input = screen.getByRole('textbox', { name: 'Craft name' });

    await user.type(input, 'Hornet');

    expect(input).toHaveValue('Hornet');
    expect(input).toHaveAccessibleDescription('Use a recognizable name.');
    expect((await axe(container)).violations).toEqual([]);
  });

  it('delegates dropdown keyboard behavior and emits the selected value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<ControlledSelect onChange={onChange} />);
    const select = screen.getByRole('textbox', { name: 'Quality' });

    await user.tab();
    expect(select).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    const option = await screen.findByRole('option', { name: 'Standard', hidden: true });
    await user.click(option);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('standard'));
  });

  it('toggles a labelled checkbox from the keyboard', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <AppCheckbox
        label="Include recycled materials"
        checked={false}
        onCheckedChange={onChange}
      />,
    );
    const checkbox = screen.getByRole('checkbox', { name: 'Include recycled materials' });

    await user.tab();
    expect(checkbox).toHaveFocus();
    await user.keyboard(' ');

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('exposes slider value text and visible marks', async () => {
    const { container } = renderWithProviders(
      <AppSlider
        label="Efficiency"
        value={50}
        onValueChange={() => undefined}
        formatValue={(value) => `${value}%`}
        marks={[
          { value: 0, label: 'Low' },
          { value: 100, label: 'High' },
        ]}
      />,
    );

    const slider = screen.getByRole('slider', { name: 'Efficiency' });
    expect(slider).toHaveAttribute('aria-valuetext', '50%');
    expect(screen.getByText('Low')).toBeVisible();
    expect(screen.getByText('High')).toBeVisible();
    expect((await axe(container)).violations).toEqual([]);
  });
});
