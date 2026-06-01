export function money(value: number | null | undefined): string {
  const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
  return safe.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function dateTime(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function makeRequestId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${random}`;
}
