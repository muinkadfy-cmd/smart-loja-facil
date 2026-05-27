import React from 'react';
import { AppIcon } from './AppIcon';

interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  empty: string;
  getRowKey?: (row: T, index: number) => string | number;
  selectedRowKey?: string | number | null;
  onRowClick?: (row: T, index: number) => void;
}

function cellClass(align?: Column<unknown>['align']): string | undefined {
  return align ? `align-${align}` : undefined;
}

function recordLabel(count: number): string {
  if (count === 0) return 'Nenhum registro';
  if (count === 1) return '1 registro';
  return `${count} registros`;
}

export function DataTable<T>({
  columns,
  rows,
  empty,
  getRowKey,
  selectedRowKey = null,
  onRowClick,
}: DataTableProps<T>): JSX.Element {
  const getKey = (row: T, index: number): string | number => (getRowKey ? getRowKey(row, index) : index);

  const emptyState = (
    <div className="empty-state-card">
      <span className="empty-state-icon"><AppIcon name="buscar" size={24} className="app-icon-chip" /></span>
      <strong>Nenhum registro encontrado</strong>
      <small>{empty}</small>
    </div>
  );

  return (
    <div className="data-table-shell">
      <div className="table-wrap desktop-table-wrap" role="region" aria-label="Tabela de dados" tabIndex={0}>
        <table className="data-table">
          <thead>
            <tr>{columns.map((column) => <th key={column.key} scope="col" className={cellClass(column.align)}>{column.label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="empty-cell">{emptyState}</td>
              </tr>
            ) : rows.map((row, index) => {
              const rowKey = getKey(row, index);
              return (
                <tr
                  key={rowKey}
                  className={[
                    'data-row',
                    onRowClick ? 'data-row-clickable' : '',
                    selectedRowKey === rowKey ? 'data-row-selected' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                >
                  {columns.map((column) => (
                    <td key={column.key} className={cellClass(column.align)}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mobile-data-list" aria-label="Lista de dados mobile">
        <div className="mobile-data-list-head">
          <span><AppIcon name="relatorios" size={16} className="app-icon-chip" />Lista otimizada</span>
          <strong>{recordLabel(rows.length)}</strong>
        </div>

        {rows.length === 0 ? (
          emptyState
        ) : rows.map((row, index) => {
          const rowKey = getKey(row, index);
          const content = (
            <>
              <span className="mobile-data-card-topline">
                <small>ITEM {String(index + 1).padStart(2, '0')}</small>
                {selectedRowKey === rowKey ? <strong>Selecionado</strong> : null}
              </span>
              {columns.map((column, columnIndex) => (
                <span key={column.key} className={["mobile-data-field", columnIndex === 0 ? 'mobile-data-field-primary' : '', column.align ? `align-${column.align}` : ''].filter(Boolean).join(' ')}>
                  <small>{column.label}</small>
                  <strong>{column.render(row)}</strong>
                </span>
              ))}
            </>
          );

          if (!onRowClick) {
            return (
              <article key={rowKey} className="mobile-data-card" aria-label={`Registro ${index + 1}`}>
                {content}
              </article>
            );
          }

          return (
            <button
              type="button"
              key={rowKey}
              className={[
                'mobile-data-card',
                'mobile-data-card-clickable',
                selectedRowKey === rowKey ? 'mobile-data-card-selected' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onRowClick(row, index)}
            >
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );
}
