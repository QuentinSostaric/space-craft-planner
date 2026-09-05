import { useEffect, useRef, type ReactNode } from 'react';

/** The number itself stays exact; only its presentation acknowledges changes. */
export function ValueFeedback({ value }: { value: ReactNode }) {
  const element = useRef<HTMLSpanElement>(null);
  const previous = useRef(value);
  useEffect(() => {
    const changed = previous.current !== value;
    previous.current = value;
    if (!changed || (typeof value !== 'number' && typeof value !== 'string')) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animation = element.current?.animate?.(
      [
        { opacity: 0.55, transform: 'translateY(3px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' },
    );
    return () => animation?.cancel();
  }, [value]);
  return (
    <span ref={element} className="value-feedback">
      {value}
    </span>
  );
}
