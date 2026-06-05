import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import type { AppStatus, CashSummary, Customer, PaymentMethod, Product, ReceiptSummary, SaleSummary } from '../../types';
import { InlineIcon } from '../components/InlineIcon';
import { ListCard } from '../components/ListCard';
import { StatCard } from '../components/StatCard';
import { formatCurrency, formatDateTime, formatNumber } from '../components/format';
import { findReceiptForSale, shareSaleReceipt } from '../components/receiptShare';
import { notifyMobileAction } from '../components/actionToast';

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
  image_data: string;
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
const DUE_DAY_OPTIONS = Array.from({ length: 31 }, (_, index) => index + 1);

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

function dayFromDateValue(value: string): number {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return new Date().getDate();
  return parsed.getDate();
}

function dueDateForDay(day: number): string {
  const today = new Date();
  const targetDay = Math.max(1, Math.min(31, Math.round(day)));
  const month = targetDay >= today.getDate() ? today.getMonth() : today.getMonth() + 1;
  const year = today.getFullYear() + Math.floor(month / 12);
  const normalizedMonth = month % 12;
  const lastDay = new Date(year, normalizedMonth + 1, 0).getDate();
  const date = new Date(year, normalizedMonth, Math.min(targetDay, lastDay));
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

export function SalesScreen({ status, refreshToken, onRefresh }: SalesScreenProps): JSX.Element {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<SaleSummary[]>([]);
  const [receipts, setReceipts] = useState<ReceiptSummary[]>([]);
  const [cash, setCash] = useState<CashSummary | null>(null);
  const [query, setQuery] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('dinheiro');
  const [discount, setDiscount] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [installmentCount, setInstallmentCount] = useState(1);
  const [firstDueDate, setFirstDueDate] = useState(todayInputValue());
  const [dueDay, setDueDay] = useState(dayFromDateValue(todayInputValue()));
  const [cart, setCart] = useState<CartItem[]>([]);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [productRows, customerRows, saleRows, cashSummary, receiptRows] = await Promise.all([
        api.products(),
        api.customers(),
        api.sales(),
        api.cashSummary(),
        api.receipts(),
      ]);
      setProducts(productRows.filter((product) => product.status === 'ativo'));
      setCustomers(customerRows.filter((customer) => customer.status === 'ativo'));
      setSales(saleRows);
      setCash(cashSummary);
      setReceipts(receiptRows);
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
  const availableProductsCount = products.filter((product) => product.stock > 0).length;
  const outOfStockCount = products.length - availableProductsCount;
  const isCreditSale = paymentMethod === 'crediario';
  const canFinishSale = cart.length > 0 && (!isCreditSale || Boolean(customerId)) && total > 0;
  const currentStep = cart.length === 0 ? 1 : canFinishSale ? 4 : 3;
  const paymentHelper = isCreditSale
    ? selectedCustomer
      ? `${normalizeInstallmentCount(installmentCount)}x · primeiro vencimento ${firstDueDate ? new Date(`${firstDueDate}T00:00:00`).toLocaleDateString('pt-BR') : 'não definido'}`
      : 'Selecione um cliente cadastrado para liberar o crediário.'
    : `Recebimento em ${paymentLabel(paymentMethod)}${paymentMethod === 'dinheiro' && change > 0 ? ` · troco ${formatCurrency(change)}` : ''}`;

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
          image_data: product.image_data || '',
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
    if (saving) return;
    if (cart.length === 0) {
      setError('Falta preencher: escolha pelo menos um produto antes de finalizar.');
      return;
    }
    if (paymentMethod === 'crediario' && !customerId) {
      setError('Falta preencher: selecione um cliente cadastrado para vender no crediário.');
      return;
    }
    if (paymentMethod === 'crediario' && !firstDueDate) {
      setError('Escolha o primeiro vencimento do crediário.');
      return;
    }
    if (paymentMethod !== 'crediario') {
      if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
        setError('Informe um valor maior que R$ 0,00.');
        return;
      }
      if (amountPaid + 0.009 < total) {
        setError(`Você está recebendo menos que o total da venda. Total: ${formatCurrency(total)} · Valor pago: ${formatCurrency(amountPaid)}. Use crediário se o cliente vai ficar devendo.`);
        return;
      }
      if (amountPaid > total + 0.009) {
        if (paymentMethod !== 'dinheiro') {
          setError(`Esse valor parece maior que o total da venda. Para ${paymentLabel(paymentMethod)}, use o valor exato: ${formatCurrency(total)}.`);
          return;
        }
        const okOverpaid = window.confirm(`Esse valor parece maior que o total da venda. Confira antes de finalizar.\n\nTotal da venda: ${formatCurrency(total)}\nValor digitado: ${formatCurrency(amountPaid)}\nTroco: ${formatCurrency(amountPaid - total)}\n\nConfirmar venda com esse troco?`);
        if (!okOverpaid) return;
      }
    }
    const confirmed = window.confirm(`Finalizar venda de ${formatCurrency(total)} em ${paymentLabel(paymentMethod)}? Confira o carrinho e o pagamento antes de confirmar.`);
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const finishedSale = await api.createSale({
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
      setFirstDueDate(todayInputValue());
      setDueDay(dayFromDateValue(todayInputValue()));
      setFeedback('Tudo certo: venda finalizada. Estoque, caixa e comprovante estão sendo enviados para a nuvem.');
      notifyMobileAction({
        title: 'Venda concluída',
        message: `${finishedSale?.number ? `Venda #${String(finishedSale.number).padStart(4, '0')}` : 'Venda'} de ${formatCurrency(total)} finalizada. Estoque, caixa e comprovante foram atualizados.`,
        tone: 'success',
        page: 'receipts',
        actionLabel: 'Comprovante',
      });
      await loadData();
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function shareRecentSale(sale: SaleSummary): Promise<void> {
    const receipt = findReceiptForSale(receipts, sale);
    const message = await shareSaleReceipt(sale, receipt);
    setFeedback(message);
    notifyMobileAction({ title: 'Comprovante', message, tone: message.startsWith('Ainda') ? 'warning' : 'success', page: 'receipts', actionLabel: 'Abrir' });
  }

  function setDueDaySelection(day: number): void {
    setDueDay(day);
    setFirstDueDate(dueDateForDay(day));
  }

  function setShortcutDueDate(value: string): void {
    setFirstDueDate(value);
    setDueDay(dayFromDateValue(value));
  }

  return (
    <div className="mapp-screen mapp-sales-screen">
      <section className="mapp-mini-stat-grid mapp-sales-stats">
        <StatCard label="Vendas hoje" value={formatCurrency(status?.dashboard.today_sales_total)} detail={`${formatNumber(status?.dashboard.today_sales_count)} venda(s)`} icon="vendas_pdv" tone="blue" />
        <StatCard label="Carrinho agora" value={formatNumber(totalQty)} detail={totalQty ? `${formatCurrency(total)} para finalizar` : 'Nenhum item selecionado'} icon="caixa" tone={totalQty ? 'green' : 'slate'} />
      </section>

      <section className="mapp-sales-flow-summary" aria-label="Resumo do fluxo de venda">
        <div className="mapp-sales-flow-copy">
          <span>PDV guiado</span>
          <strong>{currentStep === 4 ? 'Venda pronta para conferir' : currentStep === 3 ? 'Confira pagamento e cliente' : 'Comece escolhendo o produto'}</strong>
          <small>{cart.length ? `${formatNumber(totalQty)} item(ns) · ${formatCurrency(total)}` : 'Busque, toque no produto e finalize em poucos passos.'}</small>
        </div>
        <div className="mapp-sales-flow-steps">
          {[
            ['1', 'Produto'],
            ['2', 'Carrinho'],
            ['3', 'Pagamento'],
            ['4', 'Finalizar'],
          ].map(([number, label]) => (
            <span key={number} className={Number(number) <= currentStep ? 'active' : ''}>
              <b>{number}</b>
              {label}
            </span>
          ))}
        </div>
      </section>

      {loading ? <div className="mapp-inline-status">Carregando PDV...</div> : null}
      {feedback ? <div className="mapp-form-feedback mapp-form-feedback-success">{feedback}</div> : null}
      {error ? <div className="mapp-form-feedback mapp-form-feedback-error">{error}</div> : null}

      <section className="mapp-panel mapp-pdv-search">
        <div className="mapp-form-head mapp-pdv-head">
          <span className="mapp-form-icon tone-blue"><InlineIcon name="buscar" size={32} /></span>
          <div>
            <strong>1. Escolha o produto</strong>
            <p>{availableProductsCount} produto(s) disponíveis{outOfStockCount ? ` · ${outOfStockCount} sem estoque` : ''}</p>
          </div>
        </div>
        <label className="mapp-pdv-search-box" aria-label="Buscar produto">
          <InlineIcon name="buscar" size={24} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, código ou barras" />
        </label>
        <div className="mapp-product-pick-list">
          {filteredProducts.map((product) => {
            const price = product.promo_price ?? product.price;
            const inCartQty = cart.find((item) => item.product_id === product.id)?.qty ?? 0;
            return (
              <button key={product.id} type="button" className={product.stock <= 0 ? 'is-out-of-stock' : ''} onClick={() => addProduct(product)}>
                {product.image_data ? (
                  <span className="mapp-product-mini-thumb">
                    <img src={product.image_data} alt={product.name} loading="lazy" />
                  </span>
                ) : (
                  <span className={product.stock <= 0 ? 'is-empty' : ''}><InlineIcon name="produtos" size={24} /></span>
                )}
                <strong>{product.name}</strong>
                <small>{product.internal_code || product.category || 'Produto'} · estoque {formatNumber(product.stock)}{inCartQty ? ` · no carrinho ${formatNumber(inCartQty)}` : ''}</small>
                <b>{formatCurrency(price)}</b>
                <em>{product.stock <= 0 ? 'Sem estoque' : 'Adicionar'}</em>
              </button>
            );
          })}
        </div>
        {!filteredProducts.length ? (
          <div className="mapp-pdv-compact-empty">
            <strong>Nenhum produto encontrado</strong>
            <small>Revise a busca ou cadastre o produto antes de vender.</small>
          </div>
        ) : null}
      </section>

      <section className="mapp-panel mapp-pdv-cart">
        <div className="mapp-section-title mapp-section-title-compact">
          <div>
            <h2>2. Carrinho</h2>
            <small>{cart.length ? `${formatNumber(totalQty)} item(ns) selecionados` : 'Carrinho vazio'}</small>
          </div>
          {cart.length ? <button type="button" onClick={() => { if (window.confirm('Limpar todos os produtos do carrinho?')) setCart([]); }}>Limpar</button> : null}
        </div>
        {cart.length ? (
          <div className="mapp-cart-list">
            {cart.map((item) => (
              <article key={item.product_id} className="mapp-cart-item">
                {item.image_data ? (
                  <span className="mapp-product-mini-thumb">
                    <img src={item.image_data} alt={item.name} loading="lazy" />
                  </span>
                ) : (
                  <span><InlineIcon name="vendas_pdv" size={24} /></span>
                )}
                <div>
                  <strong>{item.name}</strong>
                  <small>{formatCurrency(item.unit_price)} cada · estoque {formatNumber(item.stock)}</small>
                </div>
                <div className="mapp-stepper" aria-label={`Quantidade de ${item.name}`}>
                  <button type="button" onClick={() => updateQty(item.product_id, -1)}>-</button>
                  <b>{formatNumber(item.qty)}</b>
                  <button type="button" onClick={() => updateQty(item.product_id, 1)}>+</button>
                </div>
                <em>{formatCurrency(item.qty * item.unit_price)}</em>
              </article>
            ))}
          </div>
        ) : (
          <div className="mapp-pdv-compact-empty mapp-pdv-cart-empty">
            <span><InlineIcon name="vendas_pdv" size={24} /></span>
            <div>
              <strong>Nenhum produto no carrinho</strong>
              <small>Toque em um produto acima para montar a venda.</small>
            </div>
          </div>
        )}
      </section>

      <section className="mapp-panel mapp-pdv-checkout">
        <div className="mapp-section-title mapp-section-title-compact">
          <div>
            <h2>3. Pagamento</h2>
            <small>{paymentHelper}</small>
          </div>
          <button type="button" onClick={() => setPaymentMethod('dinheiro')}>Padrão</button>
        </div>
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
        {isCreditSale && !customerId ? (
          <div className="mapp-pdv-warning">Selecione um cliente cadastrado para vender no crediário e gerar parcelas.</div>
        ) : null}
        <div className="mapp-form-grid mapp-pdv-money-grid">
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
                <input type="date" value={firstDueDate} onChange={(event) => { setFirstDueDate(event.target.value); setDueDay(dayFromDateValue(event.target.value)); }} />
              </label>
              <label>
                <span>Dia do vencimento</span>
                <select value={dueDay} onChange={(event) => setDueDaySelection(Number(event.target.value))}>
                  {DUE_DAY_OPTIONS.map((day) => <option key={day} value={day}>Dia {day}</option>)}
                </select>
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
                  <button type="button" onClick={() => setShortcutDueDate(todayInputValue())}>Hoje</button>
                  <button type="button" onClick={() => setShortcutDueDate(addDaysInputValue(15))}>+15 dias</button>
                  <button type="button" onClick={() => setShortcutDueDate(addDaysInputValue(30))}>+30 dias</button>
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
        <button type="button" className="mapp-primary-button mapp-finish-sale" disabled={saving || !canFinishSale} onClick={() => void finishSale()}>
          {saving ? 'Enviando para a nuvem...' : '4. Finalizar venda'}
        </button>
      </section>

      <section className="mapp-section-block mapp-recent-sales-block">
        <div className="mapp-section-title mapp-section-title-compact">
          <div>
            <h2>Vendas recentes</h2>
            <small>Toque em uma venda para abrir ações e comprovante.</small>
          </div>
          <button type="button" onClick={() => void loadData()}>Atualizar</button>
        </div>
        {sales.length ? (
          <div className="mapp-list-stack">
            {sales.slice(0, 6).map((sale) => (
              <ListCard
                key={sale.id}
                icon="vendas_pdv"
                title={`Venda #${String(sale.number).padStart(4, '0')}`}
                subtitle={`${sale.first_product_name || sale.customer_name || 'Balcão'} · ${paymentLabel(sale.payment_method)} · ${formatDateTime(sale.created_at)}`}
                value={formatCurrency(sale.total)}
                tone={sale.status === 'cancelada' ? 'orange' : 'blue'}
                thumbnailSrc={sale.thumbnail_url}
                thumbnailAlt={sale.first_product_name || `Venda #${sale.number}`}
                expanded={expandedSaleId === sale.id}
                onClick={() => setExpandedSaleId((current) => current === sale.id ? null : sale.id)}
              >
                <div className="mapp-sale-detail-grid">
                  <span>Cliente <b>{sale.customer_name || 'Balcão'}</b></span>
                  <span>Forma <b>{paymentLabel(sale.payment_method)}</b></span>
                  <span>Itens <b>{formatNumber(sale.item_count || 1)}</b></span>
                  <span>Data <b>{formatDateTime(sale.created_at)}</b></span>
                </div>
                <div className="mapp-sale-detail-actions">
                  <button type="button" onClick={() => void shareRecentSale(sale)}>Compartilhar comprovante</button>
                </div>
              </ListCard>
            ))}
          </div>
        ) : (
          <div className="mapp-pdv-compact-empty">
            <strong>Nenhuma venda registrada</strong>
            <small>Finalize uma venda para acompanhar aqui.</small>
          </div>
        )}
      </section>
    </div>
  );
}
