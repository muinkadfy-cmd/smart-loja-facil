import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import {
  INITIAL_LIST_LIMIT,
  LOAD_MORE_STEP,
  canRunListSearch,
  limitForQuery,
  resetLimitForQuery,
  sortStockedFirst,
  useDebouncedValue,
} from '../../lib/listLimits';
import type { Customer, OrderSummary, Product } from '../../types';
import { EmptyState } from '../components/EmptyState';
import { InlineIcon } from '../components/InlineIcon';
import { ListCard } from '../components/ListCard';
import { StatCard } from '../components/StatCard';
import { formatCurrency, formatDateTime, formatNumber } from '../components/format';

type CartItem = {
  product_id: string;
  name: string;
  qty: number;
  unit_price: number;
  stock: number;
  image_data: string;
};

type OrderFilter = 'todos' | 'aberto' | 'separado' | 'entregue' | 'cancelado';
type FeedbackTone = 'success' | 'error' | 'info';

type Feedback = { tone: FeedbackTone; text: string };

interface OrdersScreenProps {
  refreshToken: number;
  onRefresh: () => void;
}

function requestId(prefix: string): string {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 12);
  return `${prefix}-${Date.now()}-${random}`;
}

function statusLabel(status: OrderSummary['status']): string {
  if (status === 'aberto') return 'Aberto';
  if (status === 'separado') return 'Separado';
  if (status === 'entregue') return 'Entregue';
  return 'Cancelado';
}

function statusTone(status: OrderSummary['status']): 'blue' | 'green' | 'orange' | 'slate' {
  if (status === 'entregue') return 'green';
  if (status === 'separado') return 'blue';
  if (status === 'cancelado') return 'slate';
  return 'orange';
}

function StatusFeedback({ feedback }: { feedback: Feedback | null }): JSX.Element | null {
  if (!feedback) return null;
  return <div className={`mapp-form-feedback mapp-form-feedback-${feedback.tone}`}>{feedback.text}</div>;
}

export function OrdersScreen({ refreshToken, onRefresh }: OrdersScreenProps): JSX.Element {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query);
  const [productVisibleLimit, setProductVisibleLimit] = useState(INITIAL_LIST_LIMIT);
  const [customerQuery, setCustomerQuery] = useState('');
  const debouncedCustomerQuery = useDebouncedValue(customerQuery);
  const [customerVisibleLimit, setCustomerVisibleLimit] = useState(INITIAL_LIST_LIMIT);
  const [filter, setFilter] = useState<OrderFilter>('todos');
  const [orderVisibleLimit, setOrderVisibleLimit] = useState(INITIAL_LIST_LIMIT);
  const [customerId, setCustomerId] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const [orderRows, productRows, customerRows] = await Promise.all([api.orders(), api.products(), api.customers()]);
      setOrders(orderRows);
      setProducts(productRows.filter((product) => product.status === 'ativo'));
      setCustomers(customerRows.filter((customer) => customer.status === 'ativo'));
      setFeedback(null);
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, [refreshToken]);

  const filteredProducts = useMemo(() => {
    const term = debouncedQuery.trim().toLowerCase();
    const source = term && canRunListSearch(debouncedQuery)
      ? products.filter((product) => [product.name, product.category, product.internal_code, product.barcode].some((value) => value.toLowerCase().includes(term)))
      : sortStockedFirst(products);
    return source.slice(0, limitForQuery(debouncedQuery, productVisibleLimit));
  }, [debouncedQuery, productVisibleLimit, products]);

  const filteredOrders = useMemo(() => orders.filter((order) => filter === 'todos' || order.status === filter), [filter, orders]);
  const visibleOrders = useMemo(() => filteredOrders.slice(0, orderVisibleLimit), [filteredOrders, orderVisibleLimit]);
  const filteredCustomers = useMemo(() => {
    const term = debouncedCustomerQuery.trim().toLowerCase();
    const source = term && canRunListSearch(debouncedCustomerQuery)
      ? customers.filter((customer) => [customer.name, customer.phone, customer.whatsapp, customer.address].some((value) => String(value || '').toLowerCase().includes(term)))
      : customers;
    return source.slice(0, limitForQuery(debouncedCustomerQuery, customerVisibleLimit));
  }, [customerVisibleLimit, customers, debouncedCustomerQuery]);
  useEffect(() => {
    setProductVisibleLimit(resetLimitForQuery(debouncedQuery));
  }, [debouncedQuery]);
  useEffect(() => {
    setCustomerVisibleLimit(resetLimitForQuery(debouncedCustomerQuery));
  }, [debouncedCustomerQuery]);
  useEffect(() => {
    setOrderVisibleLimit(INITIAL_LIST_LIMIT);
  }, [filter]);
  const openCount = orders.filter((order) => order.status === 'aberto').length;
  const separatedCount = orders.filter((order) => order.status === 'separado').length;
  const deliveredToday = orders.filter((order) => order.status === 'entregue').length;
  const total = useMemo(() => cart.reduce((sum, item) => sum + item.qty * item.unit_price, 0), [cart]);
  const totalQty = useMemo(() => cart.reduce((sum, item) => sum + item.qty, 0), [cart]);

  function addProduct(product: Product): void {
    setFeedback(null);
    if (product.stock <= 0) {
      setFeedback({ tone: 'error', text: `${product.name} está sem estoque para pedido.` });
      return;
    }
    setCart((current) => {
      const existing = current.find((item) => item.product_id === product.id);
      if (existing) {
        if (existing.qty + 1 > product.stock) {
          setFeedback({ tone: 'error', text: `Estoque insuficiente. Disponível: ${product.stock}.` });
          return current;
        }
        return current.map((item) => item.product_id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...current, { product_id: product.id, name: product.name, qty: 1, unit_price: product.promo_price ?? product.price, stock: product.stock, image_data: product.image_data || '' }];
    });
  }

  function updateQty(productId: string, delta: number): void {
    setCart((current) => current.flatMap((item) => {
      if (item.product_id !== productId) return item;
      const nextQty = Math.max(0, Math.min(item.stock, item.qty + delta));
      if (nextQty === 0) return [];
      return { ...item, qty: nextQty };
    }));
  }

  async function createOrder(): Promise<void> {
    if (cart.length === 0) {
      setFeedback({ tone: 'error', text: 'Adicione pelo menos um produto ao pedido.' });
      return;
    }
    setSaving(true);
    try {
      await api.createOrder({
        request_id: requestId('mobile-order'),
        customer_id: customerId || null,
        items: cart.map((item) => ({ product_id: item.product_id, qty: item.qty })),
      });
      setCart([]);
      setCustomerId('');
      setShowForm(false);
      setFeedback({ tone: 'success', text: 'Pedido criado e sincronizado. Ele aparece nos outros aparelhos da loja.' });
      await loadOrders();
      onRefresh();
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(order: OrderSummary, nextStatus: OrderSummary['status']): Promise<void> {
    if (saving) return;
    if (nextStatus === 'cancelado') {
      const ok = window.confirm(`Cancelar o pedido #${String(order.number).padStart(4, '0')}?`);
      if (!ok) return;
    }
    if (nextStatus === 'entregue') {
      const ok = window.confirm('Marcar como entregue? Isso pode baixar o estoque, conforme regra do sistema.');
      if (!ok) return;
    }
    setSaving(true);
    try {
      if (nextStatus === 'cancelado') await api.cancelOrder(order.id, 'Cancelado pelo mobile');
      else await api.setOrderStatus(order.id, nextStatus);
      setFeedback({ tone: 'success', text: `Pedido #${String(order.number).padStart(4, '0')} atualizado para ${statusLabel(nextStatus)}.` });
      await loadOrders();
      onRefresh();
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mapp-screen mapp-orders-screen">
      <section className="mapp-panel mapp-action-panel mapp-crud-hero">
        <span className="mapp-panel-icon tone-orange"><InlineIcon name="pedidos" size={24} /></span>
        <div>
          <strong>Pedidos da loja</strong>
          <p>Pedido reserva/organiza uma entrega. Venda finalizada já movimenta pagamento, caixa e comprovante.</p>
        </div>
        <button type="button" onClick={() => setShowForm((value) => !value)}>{showForm ? 'Fechar cadastro' : 'Novo pedido'}</button>
      </section>

      <section className="mapp-mini-stat-grid">
        <StatCard label="Pedidos" value={formatNumber(orders.length)} detail="registrados" icon="pedidos" tone="orange" />
        <StatCard label="Abertos" value={formatNumber(openCount)} detail="aguardando ação" icon="observacao" tone="orange" />
        <StatCard label="Separados" value={formatNumber(separatedCount)} detail="prontos para entrega" icon="transferir_estoque" tone="blue" />
        <StatCard label="Entregues" value={formatNumber(deliveredToday)} detail="histórico visível" icon="loja_ativa" tone="green" />
      </section>

      {loading ? <div className="mapp-inline-status">Carregando pedidos...</div> : null}
      <StatusFeedback feedback={feedback} />

      {showForm ? (
        <section className="mapp-form-panel">
          <div className="mapp-form-head">
            <span className="mapp-form-icon tone-orange"><InlineIcon name="novo_item_adicionar" size={24} /></span>
            <div>
              <strong>Novo pedido</strong>
              <p>Monte uma lista simples. A entrega baixa estoque conforme regra do sistema.</p>
            </div>
          </div>
          <label className="mapp-wide-field">
            <span>Cliente</span>
            <input value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} placeholder="Digite nome ou telefone para encontrar o cliente mais rápido." />
            <select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
              <option value="">Balcão / consumidor final</option>
              {filteredCustomers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </select>
            {!debouncedCustomerQuery.trim() && filteredCustomers.length < customers.length ? <button type="button" className="mapp-secondary-button compact" onClick={() => setCustomerVisibleLimit((count) => count + LOAD_MORE_STEP)}>Carregar mais clientes</button> : null}
          </label>
          <section className="mapp-panel mapp-pdv-search mapp-nested-panel">
            <div className="mapp-form-head">
              <span className="mapp-form-icon tone-sky"><InlineIcon name="buscar" size={24} /></span>
              <div><strong>Adicionar produtos</strong><p>Busque pelo nome, categoria, código ou barras.</p></div>
            </div>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar produto para pedido" />
            {query.trim() && !canRunListSearch(query) ? <div className="mapp-inline-status">Digite ao menos 2 letras, SKU ou código de barras para buscar.</div> : null}
            <div className="mapp-product-pick-list">
              {filteredProducts.map((product) => (
                <button key={product.id} type="button" onClick={() => addProduct(product)}>
                  {product.image_data ? (
                    <span className="mapp-product-mini-thumb">
                      <img src={product.image_data} alt={product.name} loading="lazy" />
                    </span>
                  ) : (
                    <span className={product.stock <= 0 ? 'is-empty' : ''}><InlineIcon name="produtos" size={24} /></span>
                  )}
                  <strong>{product.name}</strong>
                  <small>{product.category || product.internal_code || 'Produto'} · Estoque {formatNumber(product.stock)}</small>
                  <b>{formatCurrency(product.promo_price ?? product.price)}</b>
                </button>
              ))}
            </div>
            {!debouncedQuery.trim() && filteredProducts.length < products.length ? <button type="button" className="mapp-secondary-button mapp-list-more-button" onClick={() => setProductVisibleLimit((count) => count + LOAD_MORE_STEP)}>Carregar mais produtos</button> : null}
          </section>
          <section className="mapp-panel mapp-pdv-cart mapp-nested-panel">
            <div className="mapp-section-title"><h2>Itens do pedido</h2>{cart.length ? <button type="button" onClick={() => { if (window.confirm('Limpar todos os itens deste pedido?')) setCart([]); }}>Limpar</button> : null}</div>
            {cart.length ? (
              <div className="mapp-cart-list">
                {cart.map((item) => (
                  <article key={item.product_id} className="mapp-cart-item">
                    {item.image_data ? (
                      <span className="mapp-product-mini-thumb">
                        <img src={item.image_data} alt={item.name} loading="lazy" />
                      </span>
                    ) : (
                      <span><InlineIcon name="pedidos" size={24} /></span>
                    )}
                    <div><strong>{item.name}</strong><small>{formatCurrency(item.unit_price)} cada · estoque {formatNumber(item.stock)}</small></div>
                    <div className="mapp-stepper">
                      <button type="button" onClick={() => updateQty(item.product_id, -1)}>-</button>
                      <b>{formatNumber(item.qty)}</b>
                      <button type="button" onClick={() => updateQty(item.product_id, 1)}>+</button>
                    </div>
                    <em>{formatCurrency(item.qty * item.unit_price)}</em>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState icon="pedidos" title="Pedido vazio" detail="Adicione produtos para criar o pedido." />
            )}
          </section>
          <section className="mapp-sale-total-box">
            <div><span>Itens</span><strong>{formatNumber(totalQty)}</strong></div>
            <div><span>Total previsto</span><strong>{formatCurrency(total)}</strong></div>
          </section>
          <div className="mapp-form-actions">
            <button type="button" className="mapp-secondary-button" onClick={() => setShowForm(false)}>Cancelar</button>
            <button type="button" className="mapp-primary-button" onClick={() => void createOrder()} disabled={saving || cart.length === 0}>{saving ? 'Criando...' : 'Criar pedido'}</button>
          </div>
        </section>
      ) : null}

      <section className="mapp-crud-toolbar mapp-compact-toolbar">
        <label>
          <span>Filtrar pedidos</span>
          <select value={filter} onChange={(event) => setFilter(event.target.value as OrderFilter)}>
            <option value="todos">Todos</option>
            <option value="aberto">Abertos</option>
            <option value="separado">Separados</option>
            <option value="entregue">Entregues</option>
            <option value="cancelado">Cancelados</option>
          </select>
        </label>
        <button type="button" onClick={() => void loadOrders()}>Atualizar</button>
      </section>

      {filteredOrders.length ? (
        <section className="mapp-crud-list">
          {visibleOrders.map((order) => (
            <article key={order.id} className={`mapp-crud-card mapp-order-card status-${order.status}`}>
              <span className={`mapp-crud-icon tone-${statusTone(order.status)}`}><InlineIcon name="pedidos" size={24} /></span>
              <div className="mapp-crud-main">
                <div className="mapp-crud-title-row">
                  <strong>Pedido #{String(order.number).padStart(4, '0')}</strong>
                  <em className={order.status === 'cancelado' ? 'warn' : 'ok'}>{statusLabel(order.status)}</em>
                </div>
                <p>{order.customer_name || 'Balcão'} · {formatDateTime(order.created_at)}</p>
                <div className="mapp-crud-meta"><span>{formatCurrency(order.total)}</span><span>Atualiza nos aparelhos</span></div>
              </div>
              <div className="mapp-crud-side">
                <strong>{formatCurrency(order.total)}</strong>
                <div className="mapp-order-actions">
                  {order.status === 'aberto' ? <button type="button" onClick={() => void changeStatus(order, 'separado')} disabled={saving}>Separar</button> : null}
                  {order.status === 'separado' || order.status === 'aberto' ? <button type="button" onClick={() => void changeStatus(order, 'entregue')} disabled={saving}>Entregar</button> : null}
                  {order.status !== 'entregue' && order.status !== 'cancelado' ? <button type="button" onClick={() => void changeStatus(order, 'cancelado')} disabled={saving}>Cancelar</button> : null}
                </div>
              </div>
            </article>
          ))}
          {visibleOrders.length < filteredOrders.length ? (
            <button type="button" className="mapp-secondary-button mapp-list-more-button" onClick={() => setOrderVisibleLimit((count) => count + LOAD_MORE_STEP)}>
              Carregar mais pedidos ({formatNumber(visibleOrders.length)} de {formatNumber(filteredOrders.length)})
            </button>
          ) : null}
        </section>
      ) : !loading ? (
        <EmptyState icon="pedidos" title="Nenhum pedido encontrado" detail="Crie pedidos para separar produtos e acompanhar entregas." actionLabel="Novo pedido" actionPage="orders" onNavigate={() => setShowForm(true)} />
      ) : null}
    </div>
  );
}
