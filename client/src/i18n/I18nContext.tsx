import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useLocalPersist } from '../hooks/useLocalPersist';
import { LS_KEYS, type Lang } from '../types';
import { GERMAN_FALLBACKS } from './de';

export type { Lang } from '../types';

interface I18nState {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (en: string, fr: string, de?: string) => string;
}

const I18nContext = createContext<I18nState | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useLocalPersist<Lang>(LS_KEYS.LANG, 'en');

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback((en: string, fr: string, de?: string) => {
    if (lang === 'fr') {
      return fr;
    }
    if (lang === 'de') {
      return de ?? GERMAN_FALLBACKS[en] ?? en;
    }
    return en;
  }, [lang]);

  const value = useMemo<I18nState>(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nState {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}

export function loc(str: { en: string; fr: string; de?: string } | null | undefined, lang: Lang): string {
  if (!str) {
    return '';
  }

  if (lang === 'de') {
    return str.de ?? GERMAN_FALLBACKS[str.en] ?? str.en;
  }
  return str[lang] ?? str.en ?? '';
}
