import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import type { AppStatus, CashSummary, Customer, PaymentMethod, Product, SaleSummary } from '../../types';
import { EmptyState } from '../components/EmptyState';
import { InlineIcon } from '../components/InlineIcon';
import { ListCard } from '../components/ListCard';
import { StatCard } from '../components/StatCard';
import { formatCurrency, formatDateTime, formatNumber } from '../components/format';

interface SalesScreenProps {
  status: AppStatus | null;
  refreshToken: number;
  onRefresh: () => void;
}

type CartItem = {
  product_id: string;
  name: string;
  qty: number;
  unit_price: number;
  stock: number;
};

function todayInputValue(): string {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function requestId(prefix: string): string {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 12);
  return `${prefix}-${Date.now()}-${random}`;
}

function paymentLabel(method: PaymentMethod): string {
  if (method === 'dinheiro') return 'Dinheiro';
  if (method === 'pix') return 'Pix';
  if (method === 'cartao') return 'Cartão';
  return 'Crediário';
}


const INSTALLMENT_OPTIONS = [1, 2, 3, 4, 5, 6, 10, 12];

function normalizeInstallmentCount(value: unknown): number {
  const numeric = Number(String(value ?? '').replace(/[^0-9]/g, ''));
  if (!Number.isFinite(numeric) || numeric <= 0) return 1;
  return Math.min(24, Math.max(1, Math.round(numeric)));
}

function addDaysInputValue(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

export function SalesScreen({ status, refreshToken, onRefresh }: SalesScreenProps): JSX.Element {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<SaleSummary[]>([]);
  const [cash, setCash] = useState<CashSummary | null>(null);
  const [query, setQuery] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('dinheiro');
  const [discount, setDiscount] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [installmentCount, setInstallmentCount] = useState(1);
  const [firstDueDate, setFirstDueDate] = useState(todayInputValue());
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [productRows, customerRows, saleRows, cashSummary] = await Promise.all([
        api.products(),
        api.customers(),
        api.sales(),
        api.cashSummary(),
      ]);
      setProducts(productRows.filter((product) => product.status === 'ativo'));
      setCustomers(customerRows.filter((customer) => customer.status === 'ativo'));
      setSales(saleRows);
      setCash(cashSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [refreshToken]);

  const filteredProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    const source = term
      ? products.filter((product) => [
        product.name,
        product.category,
        product.internal_code,
        product.barcode,
      ].some((value) => value.toLowerCase().includes(term)))
      : products;
    return source.slice(0, 8);
  }, [products, query]);

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.qty * item.unit_price, 0), [cart]);
  const total = Math.max(0, subtotal - Math.max(0, discount));
  const totalQty = useMemo(() => cart.reduce((sum, item) => sum + item.qty, 0), [cart]);
  const change = paymentMethod === 'dinheiro' ? Math.max(0, amountPaid - total) : 0;
  const selectedCustomer = customers.find((customer) => customer.id === customerId) ?? null;

  useEffect(() => {
    if (paymentMethod === 'crediario') return;
    if (total > 0) setAmountPaid(total);
  }, [paymentMethod, total]);

  function addProduct(product: Product): void {
    setError(null);
    setFeedback(null);
    if (product.stock <= 0) {
      setError(`${product.name} está sem estoque.`);
      return;
    }
    setCart((current) => {
      const existing = current.find((item) => item.product_id === product.id);
      if (existing) {
        if (existing.qty + 1 > product.stock) {
          setError(`Estoque insuficiente. Disponível: ${product.stock}.`);
          return current;
        }
        return current.map((item) => item.product_id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [
        ...current,
        {
          product_id: product.id,
          name: product.name,
          qty: 1,
          unit_price: product.promo_price ?? product.price,
          stock: product.stock,
        },
      ];
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

  async function finishSale(): Promise<void> {
    if (saving || cart.length === 0) return;
    if (paymentMethod === 'crediario' && !customerId) {
      setError('Selecione um cliente cadastrado para vender no crediário.');
      return;
    }
    if (paymentMethod === 'crediario' && !firstDueDate) {
      setError('Escolha o primeiro vencimento do crediário.');
      return;
    }
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      await api.createSale({
        request_id: requestId('mobile-sale'),
        customer_id: customerId || null,
        payment_method: paymentMethod,
        discount,
        installment_count: paymentMethod === 'crediario' ? normalizeInstallmentCount(installmentCount) : 1,
        first_due_date: paymentMethod === 'crediario' ? firstDueDate : null,
        items: cart.map((item) => ({
          product_id: item.product_id,
          qty: item.qty,
          unit_price: item.unit_price,
        })),
      });
      setCart([]);
      setDiscount(0);
      setAmountPaid(0);
      setCustomerId('');
      setPaymentMethod('dinheiro');
      setFeedback('Venda finalizada. Estoque, caixa e comprovante serão sincronizados pela nuvem.');
      await loadData();
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mapp-screen mapp-sales-screen">
      <section className="mapp-mini-stat-grid mapp-sales-stats">
        <StatCard label="Vendas hoje" value={formatCurrency(status?.dashboard.today_sales_total)} detail={`${formatNumber(status?.dashboard.today_sales_count)} venda(s)`} icon="vendas_pdv" tone="blue" />
        <StatCard label="Itens no carrinho" value={formatNumber(totalQty)} detail={formatCurrency(total)} icon="caixa" tone="green" />
      </section>

      {loading ? <div className="mapp-inline-status">Carregando PDV...</div> : null}
      {feedback ? <div className="mapp-form-feedback mapp-form-feedback-success">{feedback}</div> : null}
      {error ? <div className="mapp-form-feedback mapp-form-feedback-error">{error}</div> : null}

      <section className="mapp-panel mapp-pdv-search">
        <div className="mapp-form-head">
          <span className="mapp-form-icon tone-blue"><InlineIcon name="buscar" size={32} /></span>
          <div>
            <strong>Buscar produto</strong>
            <p>Nome, código, categoria ou barras.</p>
          </div>
        </div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Digite para buscar produto" />
        <div className="mapp-product-pick-list">
          {filteredProducts.map((product) => {
            const price = product.promo_price ?? product.price;
            return (
              <button key={product.id} type="button" onClick={() => addProduct(product)}>
                <span className={product.stock <= 0 ? 'is-empty' : ''}><InlineIcon name="produtos" size={24} /></span>
                <strong>{product.name}</strong>
                <small>{product.internal_code || product.category || 'Produto'} · Estoque {formatNumber(product.stock)}</small>
                <b>{formatCurrency(price)}</b>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mapp-panel mapp-pdv-cart">
        <div className="mapp-section-title">
          <h2>Carrinho</h2>
          {cart.length ? <button type="button" onClick={() => setCart([])}>Limpar</button> : null}
        </div>
        {cart.length ? (
          <div className="mapp-cart-list">
            {cart.map((item) => (
              <article key={item.product_id} className="mapp-cart-item">
                <span><InlineIcon name="vendas_pdv" size={24} /></span>
                <div>
                  <strong>{item.name}</strong>
                  <small>{formatCurrency(item.unit_price)} cada · estoque {formatNumber(item.stock)}</small>
                </div>
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
          <EmptyState icon="vendas_pdv" title="Carrinho vazio" detail="Adicione produtos para montar a venda." actionLabel="Buscar produto" actionPage="sales" onNavigate={() => undefined} />
        )}
      </section>

      <section className="mapp-panel mapp-pdv-checkout">
        <div className="mapp-section-title"><h2>Pagamento</h2><button type="button" onClick={() => setPaymentMethod('dinheiro')}>Padrão</button></div>
        <div className={cash?.open_cash ? 'mapp-cash-readiness is-open' : 'mapp-cash-readiness'}>
          <span><InlineIcon name="caixa" size={24} /></span>
          <div>
            <strong>{cash?.open_cash ? 'Caixa aberto' : 'Caixa fechado'}</strong>
            <small>{cash?.open_cash ? `Saldo esperado: ${formatCurrency(cash.expected_total)}` : 'Abra o caixa para controlar entradas do PDV.'}</small>
          </div>
        </div>
        <label className="mapp-wide-field">
          <span>Cliente</span>
          <select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
            <option value="">Consumidor final</option>
            {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
          </select>
        </label>
        <div className="mapp-payment-segments">
          {(['dinheiro', 'pix', 'cartao', 'crediario'] as PaymentMethod[]).map((method) => (
            <button key={method} type="button" className={paymentMethod === method ? 'active' : ''} onClick={() => setPaymentMethod(method)}>
              {paymentLabel(method)}
            </button>
          ))}
        </div>
        <div className="mapp-form-grid">
          <label>
            <span>Desconto</span>
            <input inputMode="decimal" type="number" min="0" step="0.01" value={discount} onChange={(event) => setDiscount(Number(event.target.value) || 0)} />
          </label>
          <label>
            <span>Valor pago</span>
            <input inputMode="decimal" type="number" min="0" step="0.01" value={paymentMethod === 'crediario' ? 0 : amountPaid} onChange={(event) => setAmountPaid(Number(event.target.value) || 0)} disabled={paymentMethod === 'crediario'} />
          </label>
          {paymentMethod === 'crediario' ? (
            <>
              <label>
                <span>Parcelas</span>
                <input
                  inputMode="numeric"
                  type="number"
                  min="1"
                  max="24"
                  value={installmentCount}
                  onChange={(event) => setInstallmentCount(normalizeInstallmentCount(event.target.value))}
                />
              </label>
              <label>
                <span>Primeiro vencimento</span>
                <input type="date" value={firstDueDate} onChange={(event) => setFirstDueDate(event.target.value)} />
              </label>
              <div className="mapp-credit-installment-box span-2">
                <div>
                  <strong>{normalizeInstallmentCount(installmentCount)}x de {formatCurrency(total / normalizeInstallmentCount(installmentCount))}</strong>
                  <p>Total {formatCurrency(total)} · primeira parcela em {firstDueDate ? new Date(`${firstDueDate}T00:00:00`).toLocaleDateString('pt-BR') : 'data não definida'}</p>
                </div>
                <div className="mapp-installment-shortcuts" aria-label="Atalhos de parcelas">
                  {INSTALLMENT_OPTIONS.map((count) => (
                    <button
                      key={count}
                      type="button"
                      className={normalizeInstallmentCount(installmentCount) === count ? 'active' : ''}
                      onClick={() => setInstallmentCount(count)}
                    >
                      {count}x
                    </button>
                  ))}
                </div>
                <div className="mapp-due-date-shortcuts" aria-label="Atalhos de vencimento">
                  <button type="button" onClick={() => setFirstDueDate(todayInputValue())}>Hoje</button>
                  <button type="button" onClick={() => setFirstDueDate(addDaysInputValue(15))}>+15 dias</button>
                  <button type="button" onClick={() => setFirstDueDate(addDaysInputValue(30))}>+30 dias</button>
                </div>
              </div>
            </>
          ) : null}
        </div>
        <section className="mapp-sale-total-box">
          <div><span>Subtotal</span><strong>{formatCurrency(subtotal)}</strong></div>
          <div><span>Total</span><strong>{formatCurrency(total)}</strong></div>
          <div><span>Troco</span><strong>{formatCurrency(change)}</strong></div>
          <small>{selectedCustomer ? `Cliente: ${selectedCustomer.name}` : 'Venda para consumidor final'}</small>
        </section>
        <button type="button" className="mapp-primary-button mapp-finish-sale" disabled={saving || cart.length === 0} onClick={() => void finishSale()}>
          {saving ? 'Finalizando...' : 'Finalizar venda'}
        </button>
      </section>

      <section className="mapp-section-block">
        <div className="mapp-section-title"><h2>Vendas recentes</h2><button type="button" onClick={() => void loadData()}>Atualizar</button></div>
        {sales.length ? (
          <div className="mapp-list-stack">
            {sales.slice(0, 6).map((sale) => (
              <ListCard
                key={sale.id}
                icon="vendas_pdv"
                title={`Venda #${String(sale.number).padStart(4, '0')}`}
                subtitle={`${sale.customer_name || 'Balcão'} · ${paymentLabel(sale.payment_method)} · ${formatDateTime(sale.created_at)}`}
                value={formatCurrency(sale.total)}
                tone={sale.status === 'cancelada' ? 'orange' : 'blue'}
              />
            ))}
          </div>
        ) : (
          <EmptyState icon="vendas_pdv" title="Nenhuma venda registrada" detail="Finalize uma venda para acompanhar aqui." actionLabel="Nova venda" actionPage="sales" onNavigate={() => undefined} />
        )}
      </section>
    </div>
  );
}
