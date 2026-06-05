import React, { useEffect, useMemo, useState } from 'react';
import { AppIcon } from '../components/AppIcon';
import { DataTable } from '../components/DataTable';
import { TableFilters } from '../components/TableFilters';
import { api } from '../lib/api';
import { matchesFilterQuery } from '../lib/filter';
import { dateTime } from '../lib/format';
import {
  FRIENDLY_LIST_MESSAGES,
  LOAD_MORE_STEP,
  SEARCH_RESULT_LIMIT,
  canRunListSearch,
  limitForQuery,
  resetLimitForQuery,
  useDebouncedValue,
} from '../lib/listLimits';
import type { AuditEvent } from '../types';

interface PageProps { refreshToken: number; onChanged: () => void; }

export function AuditPage({ refreshToken }: PageProps): JSX.Element {
  const [rows, setRows] = useState<AuditEvent[]>([]);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query);
  const [visibleLimit, setVisibleLimit] = useState(SEARCH_RESULT_LIMIT);
  const [entityFilter, setEntityFilter] = useState('todas');
  const [typeFilter, setTypeFilter] = useState('todos');

  useEffect(() => { api.audit().then(setRows).catch(() => undefined); }, [refreshToken]);

  useEffect(() => {
    setVisibleLimit(resetLimitForQuery(debouncedQuery, SEARCH_RESULT_LIMIT));
  }, [debouncedQuery, entityFilter, typeFilter]);

  const entities = useMemo(() => (
    ['todas', ...Array.from(new Set(rows.map((row) => row.entity).filter(Boolean))).sort((a, b) => a.localeCompare(b))]
  ), [rows]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    const matchesEntity = entityFilter === 'todas' || row.entity === entityFilter;
    const matchesType = typeFilter === 'todos' || auditType(row) === typeFilter;
    const matchesQuery = !canRunListSearch(debouncedQuery) ? true : matchesFilterQuery(debouncedQuery, [row.created_at, row.entity, row.action, row.details, row.entity_id]);
    return matchesEntity && matchesType && matchesQuery;
  }), [debouncedQuery, entityFilter, rows, typeFilter]);

  const visibleRows = useMemo(() => filteredRows.slice(0, limitForQuery(debouncedQuery, visibleLimit)), [debouncedQuery, filteredRows, visibleLimit]);
  const canLoadMore = visibleRows.length < filteredRows.length && !debouncedQuery.trim();

  function auditType(row: AuditEvent): string {
    const text = `${row.entity} ${row.action} ${row.details}`.toLowerCase();
    if (/erro|falha|error|danger|bloque/.test(text)) return 'erro';
    if (/aviso|aten|warn|pendente/.test(text)) return 'aviso';
    if (/sync|sincron|nuvem|supabase|outbox/.test(text)) return 'sincronizacao';
    return 'sistema';
  }

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
              label: 'Tipo',
              value: typeFilter,
              onChange: setTypeFilter,
              options: [
                { value: 'todos', label: 'Todos' },
                { value: 'erro', label: 'Erro' },
                { value: 'aviso', label: 'Aviso' },
                { value: 'sincronizacao', label: 'Sincronização' },
                { value: 'sistema', label: 'Sistema' },
              ],
            },
            {
              label: 'Entidade',
              value: entityFilter,
              onChange: setEntityFilter,
              options: entities.map((option) => ({ value: option, label: option === 'todas' ? 'Todas' : option })),
            },
          ]}
        />
        <DataTable<AuditEvent>
          rows={visibleRows}
          empty="Nenhuma ação auditada ainda."
          columns={[
            { key: 'date', label: 'Data', render: (row) => dateTime(row.created_at) },
            { key: 'entity', label: 'Entidade', render: (row) => row.entity },
            { key: 'action', label: 'Ação', render: (row) => row.action },
            { key: 'details', label: 'Detalhes', render: (row) => row.details },
          ]}
        />
        <div className="classic-table-footer">
          <span>{FRIENDLY_LIST_MESSAGES.firstResults}</span>
          {canLoadMore ? <button type="button" className="secondary-btn small" onClick={() => setVisibleLimit((count) => count + LOAD_MORE_STEP)}>Carregar mais logs</button> : null}
        </div>
      </section>
    </div>
  );
}
