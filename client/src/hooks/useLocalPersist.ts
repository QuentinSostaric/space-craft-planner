import { useState, useEffect, useCallback, useRef } from 'react';

export function useLocalPersist<T>(key: string, defaultValue: T) {
  // Capture the initial default once so reset() is always stable.
  const initialRef = useRef(defaultValue);

  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? (JSON.parse(stored) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // quota exceeded or private browsing – silently ignore
    }
  }, [key, value]);

  const reset = useCallback(() => setValue(initialRef.current), []);

  return [value, setValue, reset] as const;
}
