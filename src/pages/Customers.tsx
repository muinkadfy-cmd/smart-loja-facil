import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { DataTable } from '../components/DataTable';
import { TableFilters } from '../components/TableFilters';
import { api } from '../lib/api';
import { matchesFilterQuery } from '../lib/filter';
import { money } from '../lib/format';
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
    <div className="stack classic-legacy-page">
      <div className="page-title classic-legacy-title">
        <div>
          <h1>Clientes</h1>
          <p>Cadastro local com limite de crediario, WhatsApp e status controlado.</p>
        </div>
      </div>
      <section className="panel classic-panel form-panel classic-legacy-form-panel">
        <form onSubmit={submit} className="form-grid compact">
          <label>Nome<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label>Telefone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          <label>WhatsApp<input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></label>
          <label>Limite crediario<input type="number" min="0" step="0.01" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: Number(e.target.value) })} /></label>
          <label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Customer['status'] })}><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select></label>
          <label className="span-2">Endereco<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
          <label className="span-2">Observacoes<input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          <div className="table-actions">
            <button className="primary-btn" disabled={saving}>{saving ? 'Salvando...' : form.id ? 'Salvar alteracoes' : 'Cadastrar cliente'}</button>
            {form.id && <button type="button" className="ghost-btn" onClick={resetForm}>Cancelar edicao</button>}
          </div>
        </form>
      </section>
      {error && <div className="error-box">{error}</div>}
      {message && <div className="notice">{message}</div>}
      <section className="panel classic-panel classic-legacy-table-panel">
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
          empty="Nenhum cliente cadastrado."
          columns={[
            { key: 'name', label: 'Nome', render: (row) => row.name },
            { key: 'phone', label: 'Telefone', render: (row) => row.phone || '-' },
            { key: 'whatsapp', label: 'WhatsApp', render: (row) => row.whatsapp || '-' },
            { key: 'limit', label: 'Limite', align: 'right', render: (row) => money(row.credit_limit) },
            { key: 'status', label: 'Status', render: (row) => <span className="pill">{row.status}</span> },
            {
              key: 'action',
              label: 'Acao',
              align: 'right',
              render: (row) => (
                <div className="table-actions">
                  <button type="button" className="secondary-btn small" onClick={() => editCustomer(row)}>Editar</button>
                  {row.status === 'ativo' && <button type="button" className="ghost-btn small" onClick={() => inactivateCustomer(row)}>Inativar</button>}
                </div>
              ),
            },
          ]}
        />
      </section>
    </div>
  );
}
