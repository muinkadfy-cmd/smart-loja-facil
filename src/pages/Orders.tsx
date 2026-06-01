import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { DataTable } from '../components/DataTable';
import { TableFilters } from '../components/TableFilters';
import { api } from '../lib/api';
import { matchesFilterQuery } from '../lib/filter';
import { makeRequestId, money } from '../lib/format';
import { getRuntimeInfo } from '../lib/runtime';
import { useWebPermissions } from '../lib/useWebPermissions';
import type { Customer, OrderSummary, Product } from '../types';

interface PageProps { refreshToken: number; onChanged: () => void; }
interface OrderCartItem { product_id: string; name: string; qty: number; unit_price: number; }

function orderStatusLabel(status: OrderSummary['status']): string {
  if (status === 'aberto') return 'Aberto';
  if (status === 'separado') return 'Separado';
  if (status === 'entregue') return 'Entregue';
  return 'Cancelado';
}

function orderStatusClass(status: OrderSummary['status']): string {
  if (status === 'entregue') return 'pill pill-success';
  if (status === 'separado') return 'pill pill-warning';
  if (status === 'cancelado') return 'pill pill-danger';
  return 'pill';
}

export function OrdersPage({ refreshToken, onChanged }: PageProps): JSX.Element {
  const runtimeInfo = useMemo(() => getRuntimeInfo(), []);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [form, setForm] = useState({ customer_id: '', product_id: '', qty: 1 });
  const [cart, setCart] = useState<OrderCartItem[]>([]);
  const [busyOrderId, setBusyOrderId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const permissions = useWebPermissions(refreshToken);
  const canOperate = permissions.canOperate;

  useEffect(() => {
    Promise.all([api.orders(), api.products(), api.customers()])
      .then(([o, p, c]) => {
        setOrders(o);
        setProducts(p.filter((row) => row.status === 'ativo'));
        setCustomers(c.filter((row) => row.status === 'ativo'));
      })
      .catch(() => undefined);
  }, [refreshToken]);

  async function reload() {
    const [o, p, c] = await Promise.all([api.orders(), api.products(), api.customers()]);
    setOrders(o);
    setProducts(p.filter((row) => row.status === 'ativo'));
    setCustomers(c.filter((row) => row.status === 'ativo'));
    onChanged();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (cart.length === 0) return;
    if (!canOperate) {
      setMessage('');
      setError(permissions.readonlyMessage || 'Você não tem permissão para criar pedidos.');
      return;
    }
    setError('');
    setMessage('');
    try {
      await api.createOrder({ request_id: makeRequestId('order'), customer_id: form.customer_id || null, items: cart.map((item) => ({ product_id: item.product_id, qty: item.qty })) });
      setForm({ customer_id: '', product_id: '', qty: 1 });
      setCart([]);
      await reload();
      setMessage('Pedido criado com sucesso.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function addItem() {
    if (!canOperate) {
      setMessage('');
      setError(permissions.readonlyMessage || 'Você não tem permissão para montar pedidos.');
      return;
    }
    const product = products.find((row) => row.id === form.product_id);
    if (!product || form.qty <= 0) return;
    const currentQty = cart.find((item) => item.product_id === product.id)?.qty ?? 0;
    if (currentQty + form.qty > product.stock) {
      setMessage('');
      setError(`Estoque insuficiente para ${product.name}. Disponível: ${product.stock}.`);
      return;
    }
    setError('');
    setMessage('');
    setCart((current) => {
      const existing = current.find((item) => item.product_id === product.id);
      if (existing) {
        return current.map((item) => item.product_id === product.id ? { ...item, qty: item.qty + form.qty } : item);
      }
      return [...current, { product_id: product.id, name: product.name, qty: form.qty, unit_price: product.promo_price ?? product.price }];
    });
    setForm((current) => ({ ...current, product_id: '', qty: 1 }));
  }

  function removeItem(productId: string) {
    if (!canOperate) {
      setMessage('');
      setError(permissions.readonlyMessage || 'Você não tem permissão para alterar pedidos.');
      return;
    }
    setCart((current) => current.filter((item) => item.product_id !== productId));
  }

  async function cancel(order: OrderSummary) {
    if (!canOperate) {
      setMessage('');
      setError(permissions.readonlyMessage || 'Você não tem permissão para cancelar pedidos.');
      return;
    }
    if (!confirm(`Cancelar pedido #${order.number}?`)) return;
    setBusyOrderId(order.id);
    setError('');
    setMessage('');
    try {
      await api.cancelOrder(order.id, 'Cancelamento manual pelo operador');
      await reload();
      setMessage('Pedido cancelado. Para corrigir, crie um novo pedido com os dados certos.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyOrderId('');
    }
  }

  async function changeStatus(order: OrderSummary, status: 'separado' | 'entregue') {
    if (!canOperate) {
      setMessage('');
      setError(permissions.readonlyMessage || 'Você não tem permissão para alterar status de pedidos.');
      return;
    }
    setBusyOrderId(order.id);
    setError('');
    setMessage('');
    try {
      await api.setOrderStatus(order.id, status);
      await reload();
      setMessage(status === 'separado'
        ? 'Pedido marcado como separado com validação de estoque.'
        : 'Pedido entregue com baixa segura no estoque.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyOrderId('');
    }
  }

  async function reopen(order: OrderSummary) {
    if (!canOperate) {
      setMessage('');
      setError(permissions.readonlyMessage || 'Você não tem permissão para reabrir pedidos.');
      return;
    }
    setBusyOrderId(order.id);
    setError('');
    setMessage('');
    try {
      await api.setOrderStatus(order.id, 'aberto');
      await reload();
      setMessage('Pedido voltou para aberto.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyOrderId('');
    }
  }

  const total = cart.reduce((sum, item) => sum + item.qty * item.unit_price, 0);
  const filteredOrders = useMemo(() => orders.filter((row) => {
    const matchesStatus = statusFilter === 'todos' || row.status === statusFilter;
    const matchesQuery = matchesFilterQuery(query, [
      row.number,
      row.customer_name,
      row.total,
      row.status,
      row.id,
    ]);
    return matchesStatus && matchesQuery;
  }), [orders, query, statusFilter]);

  return (
    <div className="stack classic-legacy-page orders-light-v64 orders-premium-v86">
      <div className="page-title classic-legacy-title">
        <div>
          <h1>Pedidos</h1>
          <p>{runtimeInfo.isWeb ? 'Acompanhe pedidos locais e entregas sem perder o fluxo da loja.' : 'Monte pedidos, acompanhe separação e conclua entregas com baixa segura de estoque.'}</p>
        </div>
      </div>
      {!canOperate && permissions.isWeb ? <div className="web-readonly-module-note"><strong>{permissions.roleLabel}</strong><span>{permissions.readonlyMessage}</span></div> : null}
      <div className="orders-helper-v86"><strong>Novo pedido</strong><span>1. Escolha cliente, produto e quantidade · 2. Monte o pedido · 3. Confirme em criar pedido.</span></div>
      <section className="panel classic-panel form-panel classic-legacy-form-panel orders-form-panel-v86">
                <div className="panel-head panel-head-tight">
          <div>
            <h2>Montar pedido</h2>
          </div>
          <div className="table-actions">
            <span className="pill pill-info">Total previsto {money(total)}</span>
          </div>
        </div>
        <form className="form-grid compact" onSubmit={submit}>
          <label>Cliente<select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })} disabled={!canOperate}><option value="">Balcão</option>{customers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
          <label>Produto<select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} disabled={!canOperate}><option value="">Selecione</option>{products.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
          <label>Quantidade<input type="number" min="1" step="1" value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} readOnly={!canOperate} /></label>
          <button type="button" className="secondary-btn order-add-btn-v86" onClick={addItem} disabled={!canOperate}>Adicionar item</button>
          <div className="total-box"><span>Total previsto</span><strong>{money(total)}</strong></div>
          <div className="table-actions">
            <button className="primary-btn order-create-btn-v86" disabled={cart.length === 0 || !canOperate}>{canOperate ? 'Criar pedido' : 'Somente leitura'}</button>
          </div>
        </form>
        <DataTable<OrderCartItem>
          rows={cart}
          empty="Nenhum item adicionado ao pedido."
          columns={[
            { key: 'name', label: 'Produto', render: (row) => row.name },
            { key: 'qty', label: 'Qtd.', align: 'right', render: (row) => row.qty },
            { key: 'unit', label: 'Preço', align: 'right', render: (row) => money(row.unit_price) },
            { key: 'sub', label: 'Subtotal', align: 'right', render: (row) => money(row.qty * row.unit_price) },
            { key: 'remove', label: 'Ação', align: 'right', render: (row) => <button type="button" className="ghost-btn small" onClick={() => removeItem(row.product_id)} disabled={!canOperate}>Remover</button> },
          ]}
        />
      </section>
      {error && <div className="error-box">{error}</div>}
      {message && <div className="notice">{message}</div>}
      <section className="panel classic-panel classic-legacy-table-panel orders-list-panel-v86">
        <div className="panel-head panel-head-tight">
          <div>
            <h2>Pedidos criados</h2>
          </div>
        </div>
        <TableFilters
          query={query}
          onQueryChange={setQuery}
          queryPlaceholder="Buscar por pedido, cliente, valor ou status"
          summary={`${filteredOrders.length} de ${orders.length} pedidos visíveis`}
          selects={[
            {
              label: 'Status',
              value: statusFilter,
              onChange: setStatusFilter,
              options: [
                { value: 'todos', label: 'Todos' },
                { value: 'aberto', label: 'Abertos' },
                { value: 'separado', label: 'Separados' },
                { value: 'entregue', label: 'Entregues' },
                { value: 'cancelado', label: 'Cancelados' },
              ],
            },
          ]}
        />
        <DataTable<OrderSummary>
          rows={filteredOrders}
          empty="Nenhum pedido criado. Assim que você montar um pedido, ele aparece aqui."
          columns={[
            { key: 'number', label: 'Pedido', render: (row) => `#${row.number}` },
            { key: 'customer', label: 'Cliente', render: (row) => row.customer_name || 'Balcão' },
            { key: 'total', label: 'Total', align: 'right', render: (row) => money(row.total) },
            { key: 'status', label: 'Status', render: (row) => <span className={orderStatusClass(row.status)}>{orderStatusLabel(row.status)}</span> },
            {
              key: 'action',
              label: 'Ação',
              align: 'right',
              render: (row) => (
                <div className="table-actions">
                  {canOperate && row.status === 'separado' && <button type="button" className="ghost-btn small" disabled={busyOrderId === row.id} onClick={() => reopen(row)}>Reabrir</button>}
                  {canOperate && row.status === 'aberto' && <button type="button" className="secondary-btn small" disabled={busyOrderId === row.id} onClick={() => changeStatus(row, 'separado')}>Separar</button>}
                  {canOperate && (row.status === 'aberto' || row.status === 'separado') && <button type="button" className="ghost-btn small" disabled={busyOrderId === row.id} onClick={() => changeStatus(row, 'entregue')}>Entregar</button>}
                  {canOperate && row.status !== 'cancelado' && row.status !== 'entregue' && <button type="button" className="ghost-btn small" disabled={busyOrderId === row.id} onClick={() => cancel(row)}>Cancelar</button>}
                  {!canOperate && row.status !== 'cancelado' && row.status !== 'entregue' && <span className="muted">Consulta</span>}
                  {row.status === 'cancelado' && <span className="muted">Cancelado</span>}
                  {row.status === 'entregue' && <span className="muted">Entregue</span>}
                </div>
              ),
            },
          ]}
        />
      </section>
    </div>
  );
}
