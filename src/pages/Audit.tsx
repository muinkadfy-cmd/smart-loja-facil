import React, { useEffect, useMemo, useState } from 'react';
import { AppIcon } from '../components/AppIcon';
import { DataTable } from '../components/DataTable';
import { TableFilters } from '../components/TableFilters';
import { api } from '../lib/api';
import { matchesFilterQuery } from '../lib/filter';
import { dateTime } from '../lib/format';
import type { AuditEvent } from '../types';

interface PageProps { refreshToken: number; onChanged: () => void; }

export function AuditPage({ refreshToken }: PageProps): JSX.Element {
  const [rows, setRows] = useState<AuditEvent[]>([]);
  const [query, setQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState('todas');

  useEffect(() => { api.audit().then(setRows).catch(() => undefined); }, [refreshToken]);

  const entities = useMemo(() => (
    ['todas', ...Array.from(new Set(rows.map((row) => row.entity).filter(Boolean))).sort((a, b) => a.localeCompare(b))]
  ), [rows]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    const matchesEntity = entityFilter === 'todas' || row.entity === entityFilter;
    const matchesQuery = matchesFilterQuery(query, [row.created_at, row.entity, row.action, row.details, row.entity_id]);
    return matchesEntity && matchesQuery;
  }), [entityFilter, query, rows]);

  return (
    <div className="stack">
      <div className="page-title"><h1>Auditoria / Logs</h1><p>Histórico local das ações críticas.</p></div>
      <div className="hero-status">
        <span className="status-chip"><AppIcon name="auditoria_logs" size={16} className="app-icon-button-inline" />Histórico local</span>
        <span className="status-chip"><AppIcon name="bloqueio_seguro" size={16} className="app-icon-button-inline" />Ações críticas</span>
      </div>
      <section className="panel">
        <TableFilters
          query={query}
          onQueryChange={setQuery}
          queryPlaceholder="Buscar por entidade, ação, detalhe ou data"
          summary={`${filteredRows.length} de ${rows.length} eventos visíveis`}
          selects={[
            {
              label: 'Entidade',
              value: entityFilter,
              onChange: setEntityFilter,
              options: entities.map((option) => ({ value: option, label: option === 'todas' ? 'Todas' : option })),
            },
          ]}
        />
        <DataTable<AuditEvent>
          rows={filteredRows}
          empty="Nenhuma ação auditada ainda."
          columns={[
            { key: 'date', label: 'Data', render: (row) => dateTime(row.created_at) },
            { key: 'entity', label: 'Entidade', render: (row) => row.entity },
            { key: 'action', label: 'Ação', render: (row) => row.action },
            { key: 'details', label: 'Detalhes', render: (row) => row.details },
          ]}
        />
      </section>
    </div>
  );
}
