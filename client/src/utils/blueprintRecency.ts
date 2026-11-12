import type { Blueprint } from '../types';

/** Unknown history sorts last. Equal builds keep a stable, readable name/id order. */
export function compareBlueprintRecency(left: Blueprint, right: Blueprint): number {
  const build = (value?: string | null) => value && /^\d+$/.test(value) ? Number(value) : 0;
  return build(right.introducedInBuild) - build(left.introducedInBuild)
    || left.name.localeCompare(right.name, undefined, { sensitivity: 'base', numeric: true })
    || left.id.localeCompare(right.id);
}
