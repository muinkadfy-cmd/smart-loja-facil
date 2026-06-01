export function normalizeFilterText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function matchesFilterQuery(query: string, values: unknown[]): boolean {
  const normalizedQuery = normalizeFilterText(query);
  if (!normalizedQuery) return true;
  return values.some((value) => normalizeFilterText(value).includes(normalizedQuery));
}
