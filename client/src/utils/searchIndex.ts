/** Build once per dataset, not once per keystroke. */
export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
export function createSearchIndex<T extends { label: string; description: string }>(
  options: readonly T[],
) {
  return options.map((option) => ({
    option,
    label: normalizeSearch(option.label),
    text: normalizeSearch(`${option.label} ${option.description}`),
  }));
}
export function searchIndex<T extends { label: string; description: string }>(
  index: ReturnType<typeof createSearchIndex<T>>,
  query: string,
  limit = 24,
): T[] {
  const normalized = normalizeSearch(query);
  if (!normalized) return index.slice(0, 12).map((entry) => entry.option);
  const tokens = normalized.split(' ');
  return index
    .filter((entry) => tokens.every((token) => entry.text.includes(token)))
    .map((entry) => ({
      ...entry,
      rank:
        entry.label === normalized
          ? 0
          : entry.label.startsWith(normalized)
            ? 1
            : tokens.every((token) => entry.label.includes(token))
              ? 2
              : 3,
    }))
    .sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map((entry) => entry.option);
}
