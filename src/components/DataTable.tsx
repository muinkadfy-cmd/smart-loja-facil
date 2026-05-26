import React from 'react';
import { AppIcon } from './AppIcon';

interface Column<T> { key: string; label: string; render: (row: T) => React.ReactNode; align?: 'left' | 'right' | 'center'; }
interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  empty: string;
  getRowKey?: (row: T, index: number) => string | number;
  selectedRowKey?: string | number | null;
  onRowClick?: (row: T, index: number) => void;
}

export function DataTable<T>({
  columns,
  rows,
  empty,
  getRowKey,
  selectedRowKey = null,
  onRowClick,
}: DataTableProps<T>): JSX.Element {
  return (
    <div className="table-wrap" role="region" aria-label="Tabela de dados" tabIndex={0}>
      <table className="data-table">
        <thead><tr>{columns.map((column) => <th key={column.key} scope="col" className={column.align ? `align-${column.align}` : undefined}>{column.label}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="empty-cell">
                <div className="empty-state-card">
                  <span className="empty-state-icon"><AppIcon name="buscar" size={24} className="app-icon-chip" /></span>
                  <strong>Nenhum registro encontrado</strong>
                  <small>{empty}</small>
                </div>
              </td>
            </tr>
          ) : rows.map((row, index) => {
            const rowKey = getRowKey ? getRowKey(row, index) : index;
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
                  <td key={column.key} className={column.align ? `align-${column.align}` : undefined}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
