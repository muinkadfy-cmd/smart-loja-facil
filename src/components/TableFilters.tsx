import React from 'react';

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
  return (
    <div className="table-filters">
      <div className="table-filters-row">
        <label className="table-filter-search">
          <span>Buscar</span>
          <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={queryPlaceholder} />
        </label>
        {selects.map((select) => (
          <label key={select.label} className="table-filter-select">
            <span>{select.label}</span>
            <select value={select.value} onChange={(event) => select.onChange(event.target.value)}>
              {select.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        ))}
      </div>
      <div className="table-filter-summary">{summary}</div>
    </div>
  );
}
