import { createContext, useContext } from 'react';
import type { Theme } from './useTheme';

interface ThemeModeContextValue {
  mode: Theme;
  setMode: (m: Theme) => void;
  toggle: () => void;
}

export const ThemeModeContext = createContext<ThemeModeContextValue>({
  mode: 'dark',
  setMode: () => {},
  toggle: () => {},
});

export function useThemeMode(): ThemeModeContextValue {
  return useContext(ThemeModeContext);
}
