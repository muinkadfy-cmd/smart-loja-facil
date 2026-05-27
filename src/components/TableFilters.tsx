import React from 'react';
import { AppIcon } from './AppIcon';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterSelect {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
}

interface TableFiltersProps {
  query: string;
  onQueryChange: (value: string) => void;
  queryPlaceholder?: string;
  summary: string;
  selects?: FilterSelect[];
}

export function TableFilters({
  query,
  onQueryChange,
  queryPlaceholder = 'Buscar na lista',
  summary,
  selects = [],
}: TableFiltersProps): JSX.Element {
  const hasQuery = query.trim().length > 0;

  return (
    <div className="table-filters premium-table-filters">
      <div className="table-filters-row">
        <label className="table-filter-search">
          <span>Buscar</span>
          <div className="table-filter-control table-filter-search-control">
            <AppIcon name="buscar" size={16} className="app-icon-chip" />
            <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={queryPlaceholder} />
            {hasQuery ? (
              <button type="button" className="table-filter-clear" onClick={() => onQueryChange('')} aria-label="Limpar busca">
                <AppIcon name="remover_menos" size={16} className="app-icon-chip" />
              </button>
            ) : null}
          </div>
        </label>
        {selects.map((select) => (
          <label key={select.label} className="table-filter-select">
            <span>{select.label}</span>
            <div className="table-filter-control table-filter-select-control">
              <AppIcon name="filtro" size={16} className="app-icon-chip" />
              <select value={select.value} onChange={(event) => select.onChange(event.target.value)}>
                {select.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
          </label>
        ))}
      </div>
      <div className="table-filter-summary"><AppIcon name="filtro" size={16} className="app-icon-chip" />{summary}</div>
    </div>
  );
}
