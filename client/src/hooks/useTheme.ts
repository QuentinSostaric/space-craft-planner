import { useEffect } from 'react';
import { useLocalPersist } from './useLocalPersist';
import { LS_KEYS } from '../types';
import { setSystemMode } from '../ui/system';

export type Theme = 'dark' | 'light';

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useLocalPersist<Theme>(LS_KEYS.THEME, 'dark');

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    setSystemMode(theme);
    // Swap the PrimeReact widget theme to match.
    const link = document.getElementById('prime-theme') as HTMLLinkElement | null;
    const href = `/themes/lara-${theme}-indigo/theme.css`;
    if (link && !link.href.endsWith(href)) link.href = href;
  }, [theme]);

  return [theme, setTheme];
}
