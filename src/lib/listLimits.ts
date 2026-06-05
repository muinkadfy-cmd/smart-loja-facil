import { useEffect, useState } from 'react';

export const INITIAL_LIST_LIMIT = 20;
export const SEARCH_RESULT_LIMIT = 30;
export const LOAD_MORE_STEP = 20;
export const COMPACT_CREDIT_LIMIT = 10;
export const DEBOUNCE_MS = 350;
export const MIN_SEARCH_CHARS = 2;

export const FRIENDLY_LIST_MESSAGES = {
  firstResults: 'Mostrando os primeiros resultados.',
  searchHint: 'Digite mais detalhes para encontrar mais rápido.',
  tooMany: 'Muitos resultados encontrados. Refine a busca.',
  empty: 'Nenhum resultado encontrado.',
  loading: 'Buscando...',
  error: 'Não foi possível carregar agora. Tente novamente.',
};

export function useDebouncedValue<T>(value: T, delay = DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);

  return debounced;
}

export function normalizeListQuery(value: string): string {
  return value.trim().toLowerCase();
}

export function isDirectCodeQuery(value: string): boolean {
  const term = value.trim();
  if (!term) return false;
  if (/\d/.test(term)) return true;
  return /^[a-z]{2,}[-_][a-z0-9_-]+$/i.test(term);
}

export function canRunListSearch(value: string): boolean {
  const term = value.trim();
  return term.length === 0 || term.length >= MIN_SEARCH_CHARS || isDirectCodeQuery(term);
}

export function limitForQuery(value: string, currentLimit: number): number {
  return value.trim() ? Math.min(currentLimit, SEARCH_RESULT_LIMIT) : currentLimit;
}

export function resetLimitForQuery(value: string, initialLimit = INITIAL_LIST_LIMIT): number {
  return value.trim() ? SEARCH_RESULT_LIMIT : initialLimit;
}

export function sortStockedFirst<T extends { stock?: number; updated_at?: string; created_at?: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const stockA = Number(a.stock || 0);
    const stockB = Number(b.stock || 0);
    if (stockA > 0 && stockB <= 0) return -1;
    if (stockA <= 0 && stockB > 0) return 1;
    const dateA = a.updated_at || a.created_at || '';
    const dateB = b.updated_at || b.created_at || '';
    return dateB.localeCompare(dateA);
  });
}

