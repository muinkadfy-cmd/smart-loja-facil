import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { DataTable } from '../components/DataTable';
import { TableFilters } from '../components/TableFilters';
import { api } from '../lib/api';
import { matchesFilterQuery } from '../lib/filter';
import { makeRequestId, money } from '../lib/format';
import {
  FRIENDLY_LIST_MESSAGES,
  INITIAL_LIST_LIMIT,
  LOAD_MORE_STEP,
  SEARCH_RESULT_LIMIT,
  canRunListSearch,
  limitForQuery,
  resetLimitForQuery,
  sortStockedFirst,
  useDebouncedValue,
} from '../lib/listLimits';
import { getRuntimeInfo } from '../lib/runtime';
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

function matchesProductQuery(product: Product, query: string): boolean {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  return [product.name, product.category, product.internal_code, product.barcode, product.color, product.size]
    .some((value) => String(value || '').toLowerCase().includes(term));
}

export function OrdersPage({ refreshToken, onChanged }: PageProps): JSX.Element {
  const runtimeInfo = useMemo(() => getRuntimeInfo(), []);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query);
  const [orderVisibleLimit, setOrderVisibleLimit] = useState(INITIAL_LIST_LIMIT);
  const [productQuery, setProductQuery] = useState('');
  const debouncedProductQuery = useDebouncedValue(productQuery);
  const [productVisibleLimit, setProductVisibleLimit] = useState(INITIAL_LIST_LIMIT);
  const [customerQuery, setCustomerQuery] = useState('');
  const debouncedCustomerQuery = useDebouncedValue(customerQuery);
  const [customerVisibleLimit, setCustomerVisibleLimit] = useState(INITIAL_LIST_LIMIT);
  const [statusFilter, setStatusFilter] = useState('todos');
  const [form, setForm] = useState({ customer_id: '', product_id: '', qty: 1 });
  const [cart, setCart] = useState<OrderCartItem[]>([]);
  const [busyOrderId, setBusyOrderId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const orderFormRef = useRef<HTMLElement | null>(null);
  const orderCustomerSelectRef = useRef<HTMLSelectElement | null>(null);

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

  function scrollToOrderForm() {
    window.requestAnimationFrame(() => {
      orderFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(() => orderCustomerSelectRef.current?.focus(), 260);
    });
  }

  function startNewOrder() {
    setError('');
    setMessage('Pronto para montar um novo pedido.');
    setForm({ customer_id: '', product_id: '', qty: 1 });
    setCart([]);
    scrollToOrderForm();
  }

  useEffect(() => {
    if (window.location.hash !== '#novo-pedido') return undefined;
    const timer = window.setTimeout(() => {
      startNewOrder();
      window.history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}`);
    }, 220);
    return () => window.clearTimeout(timer);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (cart.length === 0) return;
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
    setCart((current) => current.filter((item) => item.product_id !== productId));
  }

  async function cancel(order: OrderSummary) {
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
  useEffect(() => {
    setOrderVisibleLimit(resetLimitForQuery(debouncedQuery));
  }, [debouncedQuery, statusFilter]);

  useEffect(() => {
    setProductVisibleLimit(resetLimitForQuery(debouncedProductQuery));
  }, [debouncedProductQuery]);

  useEffect(() => {
    setCustomerVisibleLimit(resetLimitForQuery(debouncedCustomerQuery));
  }, [debouncedCustomerQuery]);

  const filteredOrders = useMemo(() => orders.filter((row) => {
    const matchesStatus = statusFilter === 'todos' || row.status === statusFilter;
    const matchesQuery = !canRunListSearch(debouncedQuery) ? true : matchesFilterQuery(debouncedQuery, [
      row.number,
      row.customer_name,
      row.total,
      row.status,
      row.id,
    ]);
    return matchesStatus && matchesQuery;
  }), [orders, debouncedQuery, statusFilter]);

  const visibleOrders = useMemo(() => filteredOrders.slice(0, limitForQuery(debouncedQuery, orderVisibleLimit)), [debouncedQuery, filteredOrders, orderVisibleLimit]);

  const filteredProductOptions = useMemo(() => {
    const sorted = sortStockedFirst(products);
    if (!canRunListSearch(debouncedProductQuery)) return sorted.slice(0, INITIAL_LIST_LIMIT);
    return sorted.filter((product) => matchesProductQuery(product, debouncedProductQuery)).slice(0, limitForQuery(debouncedProductQuery, productVisibleLimit));
  }, [debouncedProductQuery, productVisibleLimit, products]);

  const filteredCustomerOptions = useMemo(() => {
    if (!canRunListSearch(debouncedCustomerQuery)) return customers.slice(0, INITIAL_LIST_LIMIT);
    const term = debouncedCustomerQuery.trim().toLowerCase();
    return customers.filter((customer) => [customer.name, customer.phone, customer.whatsapp, customer.address, customer.id]
      .some((value) => String(value || '').toLowerCase().includes(term)))
      .slice(0, limitForQuery(debouncedCustomerQuery, customerVisibleLimit));
  }, [customerVisibleLimit, customers, debouncedCustomerQuery]);

  const canLoadMoreOrders = visibleOrders.length < filteredOrders.length && !debouncedQuery.trim();
  const canLoadMoreProducts = filteredProductOptions.length < products.length && !debouncedProductQuery.trim();
  const canLoadMoreCustomers = filteredCustomerOptions.length < customers.length && !debouncedCustomerQuery.trim();
  const manyOrderResults = debouncedQuery.trim() && filteredOrders.length > SEARCH_RESULT_LIMIT;

  return (
    <div className="stack classic-legacy-page">
      <div className="page-title classic-legacy-title">
        <div>
          <h1>{runtimeInfo.isWeb ? 'Pedidos Web' : 'Pedidos Locais'}</h1>
          <p>{runtimeInfo.isWeb ? 'Pedidos sincronizados na nuvem com separação, entrega, cancelamento e baixa segura de estoque.' : 'Pedido local com múltiplos itens, separação, entrega e baixa segura de estoque apenas na entrega.'}</p>
        </div>
      </div>
      <section className="panel classic-panel form-panel classic-legacy-form-panel" ref={orderFormRef}>
        <div className="panel-head panel-head-tight">
          <div>
            <h2>Montar pedido</h2>
          </div>
          <div className="table-actions">
            <span className="pill">Total previsto {money(total)}</span>
          </div>
        </div>
        <form className="form-grid compact" onSubmit={submit}>
          <label>Cliente<input value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} placeholder="Digite nome ou telefone para encontrar o cliente mais rápido." /><select ref={orderCustomerSelectRef} value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}><option value="">Balcão</option>{filteredCustomerOptions.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>{canLoadMoreCustomers ? <button type="button" className="ghost-btn small" onClick={() => setCustomerVisibleLimit((count) => count + LOAD_MORE_STEP)}>Carregar mais clientes</button> : null}</label>
          <label>Produto<input value={productQuery} onChange={(e) => setProductQuery(e.target.value)} placeholder="Digite nome, SKU ou código de barras para encontrar mais rápido." /><select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}><option value="">Selecione</option>{filteredProductOptions.map((row) => <option key={row.id} value={row.id}>{row.name} · estoque {row.stock}{row.stock <= 0 ? ' · Sem estoque' : ''}</option>)}</select>{canLoadMoreProducts ? <button type="button" className="ghost-btn small" onClick={() => setProductVisibleLimit((count) => count + LOAD_MORE_STEP)}>Carregar mais produtos</button> : null}</label>
          <label>Quantidade<input type="number" min="1" step="1" value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} /></label>
          <button type="button" className="secondary-btn" onClick={addItem}>Adicionar item</button>
          <div className="total-box"><span>Total previsto</span><strong>{money(total)}</strong></div>
          <div className="table-actions">
            <button className="primary-btn" disabled={cart.length === 0}>Criar pedido</button>
          </div>
        </form>
        <DataTable<OrderCartItem>
          rows={cart}
          empty="Nenhum item no pedido."
          columns={[
            { key: 'name', label: 'Produto', render: (row) => row.name },
            { key: 'qty', label: 'Qtd', align: 'right', render: (row) => row.qty },
            { key: 'unit', label: 'Preço', align: 'right', render: (row) => money(row.unit_price) },
            { key: 'sub', label: 'Subtotal', align: 'right', render: (row) => money(row.qty * row.unit_price) },
            { key: 'remove', label: 'Ação', align: 'right', render: (row) => <button type="button" className="ghost-btn small" onClick={() => removeItem(row.product_id)}>Remover</button> },
          ]}
        />
      </section>
      {error && <div className="error-box">{error}</div>}
      {message && <div className="notice">{message}</div>}
      <section className="panel classic-panel classic-legacy-table-panel">
        <div className="panel-head panel-head-tight">
          <div>
            <h2>Pedidos criados</h2>
          </div>
        </div>
        <TableFilters
          query={query}
          onQueryChange={setQuery}
          queryPlaceholder="Buscar por pedido, cliente, valor ou status"
          summary={`${visibleOrders.length} de ${filteredOrders.length} pedidos visíveis`}
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
          rows={visibleOrders}
          empty="Nenhum pedido criado."
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
                  {row.status === 'separado' && <button type="button" className="ghost-btn small" disabled={busyOrderId === row.id} onClick={() => reopen(row)}>Reabrir</button>}
                  {row.status === 'aberto' && <button type="button" className="secondary-btn small" disabled={busyOrderId === row.id} onClick={() => changeStatus(row, 'separado')}>Separar</button>}
                  {(row.status === 'aberto' || row.status === 'separado') && <button type="button" className="ghost-btn small" disabled={busyOrderId === row.id} onClick={() => changeStatus(row, 'entregue')}>Entregar</button>}
                  {row.status !== 'cancelado' && row.status !== 'entregue' && <button type="button" className="ghost-btn small" disabled={busyOrderId === row.id} onClick={() => cancel(row)}>Cancelar</button>}
                  {row.status === 'cancelado' && <span className="muted">Cancelado</span>}
                  {row.status === 'entregue' && <span className="muted">Entregue</span>}
                </div>
              ),
            },
          ]}
        />
        <div className="classic-table-footer">
          <span>{manyOrderResults ? FRIENDLY_LIST_MESSAGES.tooMany : FRIENDLY_LIST_MESSAGES.firstResults}</span>
          {canLoadMoreOrders ? <button type="button" className="secondary-btn small" onClick={() => setOrderVisibleLimit((count) => count + LOAD_MORE_STEP)}>Carregar mais</button> : null}
        </div>
      </section>
    </div>
  );
}
