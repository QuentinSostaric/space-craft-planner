import { sxToClass, type SxValue, type Theme } from '../system';

export type PrimePartStyles<Part extends string> = Partial<Record<Part, SxValue>>;

export function compilePrimeRootClass(
  theme: Theme,
  sx?: SxValue,
  className?: string,
): string | undefined {
  const generated = sx ? sxToClass(sx, theme) : '';
  return [generated, className].filter(Boolean).join(' ') || undefined;
}

export function compilePrimePartClasses<Part extends string>(
  theme: Theme,
  parts?: PrimePartStyles<Part>,
): Partial<Record<Part, { className: string }>> {
  if (!parts) return {};

  const compiled: Partial<Record<Part, { className: string }>> = {};
  for (const [part, sx] of Object.entries(parts) as Array<[Part, SxValue | undefined]>) {
    if (!sx) continue;
    const className = sxToClass(sx, theme);
    if (className) compiled[part] = { className };
  }
  return compiled;
}
