export function normalizeSearchValue(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function onlyDigits(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '');
}

export function matchesSearch(query: string, values: unknown[]): boolean {
  const normalizedQuery = normalizeSearchValue(query);
  const compactQuery = normalizedQuery.replace(/\s/g, '');
  const digitQuery = onlyDigits(query);

  if (!normalizedQuery && !digitQuery) return true;

  return values.some(value => {
    const normalizedValue = normalizeSearchValue(value);
    const compactValue = normalizedValue.replace(/\s/g, '');
    const digitValue = onlyDigits(value);

    return Boolean(
      (normalizedQuery && normalizedValue.includes(normalizedQuery)) ||
      (compactQuery && compactValue.includes(compactQuery)) ||
      (digitQuery && digitValue.includes(digitQuery))
    );
  });
}
