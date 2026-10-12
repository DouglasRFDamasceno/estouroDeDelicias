/** Normaliza apenas a comparação; preserva o texto exibido e armazenado. */
export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function searchPattern(value: string): string {
  return `%${normalizeSearch(value.trim()).replace(/[\\%_*]/g, '\\$&')}%`;
}
