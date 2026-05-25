import React from 'react';

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
    <div className="table-wrap">
      <table className="data-table">
        <thead><tr>{columns.map((column) => <th key={column.key} scope="col" className={column.align ? `align-${column.align}` : undefined}>{column.label}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="empty-cell">{empty}</td>
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
