import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { PrimeReactProvider } from 'primereact/api';
import { I18nProvider } from '../i18n/I18nContext';
import { primeConfig } from '../ui/prime/config';

function TestProviders({ children }: { children: ReactNode }) {
  return (
    <PrimeReactProvider value={primeConfig}>
      <I18nProvider>{children}</I18nProvider>
    </PrimeReactProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { wrapper: TestProviders, ...options });
}

export * from '@testing-library/react';
