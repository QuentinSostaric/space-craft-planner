import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '../../../test/render';
import { AppSnackbar } from './AppSnackbar';

describe('AppSnackbar', () => {
  it('starts one timer and clears it when closed', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const { rerender } = renderWithProviders(
      <AppSnackbar open autoHideDuration={1000} onClose={onClose}>Saved</AppSnackbar>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    act(() => vi.advanceTimersByTime(999));
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledWith('timeout');

    rerender(<AppSnackbar open={false} autoHideDuration={1000} onClose={onClose}>Saved</AppSnackbar>);
    act(() => vi.runOnlyPendingTimers());
    expect(onClose).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('restarts the lifecycle when duration changes', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const { rerender } = renderWithProviders(
      <AppSnackbar open autoHideDuration={1000} onClose={onClose}>Updated</AppSnackbar>,
    );

    act(() => vi.advanceTimersByTime(500));
    rerender(<AppSnackbar open autoHideDuration={2000} onClose={onClose}>Updated</AppSnackbar>);
    act(() => vi.advanceTimersByTime(1500));
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(500));
    expect(onClose).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
