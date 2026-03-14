import { createContext, useContext, useCallback, useEffect, type ReactNode } from 'react';
import { useLocalPersist } from '../hooks/useLocalPersist';
import { LS_KEYS, type Lang } from '../types';
export type { Lang } from '../types';

interface I18nState {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Inline bilingual helper — pass English string first, French second */
  t: (en: string, fr: string) => string;
}

const I18nContext = createContext<I18nState | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useLocalPersist<Lang>(LS_KEYS.LANG, 'en');

  // Keep the HTML lang attribute in sync for accessibility and SEO.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback(
    (en: string, fr: string) => (lang === 'en' ? en : fr),
    [lang],
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nState {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}

/** Helper to read a LocalizedString object */
export function loc(str: { en: string; fr: string }, lang: Lang): string {
  return str[lang];
}
