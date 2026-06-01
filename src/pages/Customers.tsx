import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { DataTable } from '../components/DataTable';
import { TableFilters } from '../components/TableFilters';
import { api } from '../lib/api';
import { matchesFilterQuery } from '../lib/filter';
import { money } from '../lib/format';
import { useWebPermissions } from '../lib/useWebPermissions';
import type { Customer } from '../types';

interface PageProps { refreshToken: number; onChanged: () => void; }
interface CustomerForm {
  id: string;
  name: string;
  phone: string;
  whatsapp: string;
  address: string;
  credit_limit: number;
  status: Customer['status'];
  notes: string;
}

const emptyCustomer: CustomerForm = {
  id: '',
  name: '',
  phone: '',
  whatsapp: '',
  address: '',
  credit_limit: 0,
  status: 'ativo' as const,
  notes: '',
};

export function CustomersPage({ refreshToken, onChanged }: PageProps): JSX.Element {
  const [rows, setRows] = useState<Customer[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [form, setForm] = useState<CustomerForm>({ ...emptyCustomer });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const permissions = useWebPermissions(refreshToken);
  const canEdit = permissions.canOperate;

  useEffect(() => {
    api.customers().then(setRows).catch(() => undefined);
  }, [refreshToken]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    const matchesStatus = statusFilter === 'todos' || row.status === statusFilter;
    const matchesQuery = matchesFilterQuery(query, [
      row.name,
      row.phone,
      row.whatsapp,
      row.address,
      row.notes,
      row.credit_limit,
      row.status,
    ]);
    return matchesStatus && matchesQuery;
  }), [query, rows, statusFilter]);

  async function reload() {
    setRows(await api.customers());
    onChanged();
  }

  function resetForm() {
    setForm({ ...emptyCustomer });
  }

  function editCustomer(customer: Customer) {
    setError('');
    setMessage('');
    setForm({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      whatsapp: customer.whatsapp,
      address: customer.address,
      credit_limit: customer.credit_limit,
      status: customer.status,
      notes: customer.notes,
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) {
      setMessage('');
      setError(permissions.readonlyMessage || 'Você não tem permissão para salvar clientes.');
      return;
    }
    if (!form.name.trim()) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.saveCustomer(form as Partial<Customer>);
      const editing = Boolean(form.id);
      resetForm();
      await reload();
      setMessage(editing ? 'Cliente atualizado com sucesso.' : 'Cliente cadastrado com sucesso.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function inactivateCustomer(customer: Customer) {
    if (!canEdit) {
      setMessage('');
      setError(permissions.readonlyMessage || 'Você não tem permissão para inativar clientes.');
      return;
    }
    if (!confirm(`Inativar o cliente ${customer.name}?`)) return;
    setError('');
    setMessage('');
    try {
      await api.inactivateCustomer(customer.id);
      if (form.id === customer.id) resetForm();
      await reload();
      setMessage('Cliente inativado.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="stack classic-legacy-page customers-light-v64 customers-premium-v89">
      <div className="page-title classic-legacy-title">
        <div>
          <h1>Clientes</h1>
          <p>Cadastre, encontre e acompanhe clientes com contato, limite e status em poucos toques.</p>
        </div>
      </div>
      {!canEdit && permissions.isWeb ? <div className="web-readonly-module-note"><strong>{permissions.roleLabel}</strong><span>{permissions.readonlyMessage}</span></div> : null}
      <div className="customers-helper-v89"><strong>Cadastro de clientes</strong><span>1. Preencha nome e contato · 2. Defina limite se usar crediário · 3. Salve e acompanhe na lista.</span></div>
      <section className="panel classic-panel form-panel classic-legacy-form-panel customers-form-panel-v89">
        <div className="light-section-note-v64 customers-note-v89"><strong>{form.id ? 'Editando cliente' : 'Novo cliente'}</strong><span>{canEdit ? 'Use nome, telefone e WhatsApp para localizar rápido na venda e no crediário.' : 'Consulta liberada. Alterações ficam bloqueadas para proteger os dados da loja.'}</span></div>
        <form onSubmit={submit} className="form-grid compact">
          <label>Nome<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required readOnly={!canEdit} /></label>
          <label>Telefone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} readOnly={!canEdit} /></label>
          <label>WhatsApp<input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} readOnly={!canEdit} /></label>
          <label>Limite crediário<input type="number" min="0" step="0.01" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: Number(e.target.value) })} readOnly={!canEdit} /></label>
          <label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Customer['status'] })} disabled={!canEdit}><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select></label>
          <label className="span-2">Endereço<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} readOnly={!canEdit} /></label>
          <label className="span-2">Observações<input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} readOnly={!canEdit} /></label>
          <div className="table-actions">
            <button className="primary-btn customer-save-btn-v89" disabled={saving || !canEdit}>{saving ? 'Salvando...' : canEdit ? (form.id ? 'Salvar alterações' : 'Cadastrar cliente') : 'Somente leitura'}</button>
            {form.id && <button type="button" className="ghost-btn" onClick={resetForm}>Cancelar edição</button>}
          </div>
        </form>
      </section>
      {error && <div className="error-box">{error}</div>}
      {message && <div className="notice">{message}</div>}
      <section className="panel classic-panel classic-legacy-table-panel customers-list-panel-v89">
        <div className="panel-head panel-head-tight">
          <div>
            <h2>Lista de clientes</h2>
          </div>
        </div>
        <TableFilters
          query={query}
          onQueryChange={setQuery}
          queryPlaceholder="Buscar por nome, telefone, WhatsApp ou observação"
          summary={`${filteredRows.length} de ${rows.length} clientes visíveis`}
          selects={[
            {
              label: 'Status',
              value: statusFilter,
              onChange: setStatusFilter,
              options: [
                { value: 'todos', label: 'Todos' },
                { value: 'ativo', label: 'Ativos' },
                { value: 'inativo', label: 'Inativos' },
              ],
            },
          ]}
        />
        <DataTable<Customer>
          rows={filteredRows}
          empty="Nenhum cliente cadastrado. Cadastre o primeiro cliente para agilizar vendas e crediário."
          columns={[
            { key: 'name', label: 'Nome', render: (row) => row.name },
            { key: 'phone', label: 'Telefone', render: (row) => row.phone || '-' },
            { key: 'whatsapp', label: 'WhatsApp', render: (row) => row.whatsapp || '-' },
            { key: 'limit', label: 'Limite', align: 'right', render: (row) => money(row.credit_limit) },
            { key: 'status', label: 'Status', render: (row) => <span className={row.status === 'ativo' ? 'pill pill-success' : 'pill pill-danger'}>{row.status === 'ativo' ? 'Ativo' : 'Inativo'}</span> },
            {
              key: 'action',
              label: 'Ação',
              align: 'right',
              render: (row) => (
                <div className="table-actions">
                  <button type="button" className="secondary-btn small" onClick={() => editCustomer(row)}>{canEdit ? 'Editar' : 'Ver'}</button>
                  {canEdit && row.status === 'ativo' && <button type="button" className="ghost-btn small" onClick={() => inactivateCustomer(row)}>Inativar</button>}
                </div>
              ),
            },
          ]}
        />
      </section>
    </div>
  );
}
