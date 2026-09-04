import { useEffect, useMemo, useRef, useState } from 'react';
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
import type { AppStatus, CashSummary, Customer, PaymentMethod, Product, ReceiptSummary, SaleSummary } from '../../types';
import { InlineIcon } from '../components/InlineIcon';
import { RecentSaleCard } from '../components/RecentSaleCard';
import { formatCurrency, formatNumber } from '../components/format';
import { findReceiptForSale, shareSaleReceipt, type ReceiptShareFormat } from '../components/receiptShare';
import { notifyMobileAction } from '../components/actionToast';
import { useDialogAccessibility } from '../hooks/useDialogAccessibility';

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

type QuickCustomerForm = {
  name: string;
  phone: string;
  whatsapp: string;
  address: string;
};

const emptyQuickCustomerForm: QuickCustomerForm = { name: '', phone: '', whatsapp: '', address: '' };

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


function parseCurrencyInput(value: string): number {
  const digits = value.replace(/\D/g, '');
  if (!digits) return 0;
  return Number(digits) / 100;
}

function formatCurrencyInput(value: number): string {
  const safe = Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  return safe.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function maskCurrencyInput(value: string): string {
  return formatCurrencyInput(parseCurrencyInput(value));
}

function paymentLabel(method: PaymentMethod): string {
  if (method === 'dinheiro') return 'Dinheiro';
  if (method === 'pix') return 'Pix';
  if (method === 'cartao') return 'Cartão';
  return 'Crediário';
}


const INSTALLMENT_OPTIONS = [1, 2, 3, 4, 5, 6, 10, 12];
const DUE_DAY_OPTIONS = Array.from({ length: 31 }, (_, index) => index + 1);
const SALES_PRODUCT_INITIAL_LIMIT = 5;
const SALES_PRODUCT_LIMIT_STEP = 5;

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
  const debouncedQuery = useDebouncedValue(query);
  const [categoryFilter, setCategoryFilter] = useState('todos');
  const [productVisibleLimit, setProductVisibleLimit] = useState(SALES_PRODUCT_INITIAL_LIMIT);
  const [customerQuery, setCustomerQuery] = useState('');
  const debouncedCustomerQuery = useDebouncedValue(customerQuery);
  const [customerVisibleLimit, setCustomerVisibleLimit] = useState(INITIAL_LIST_LIMIT);
  const [customerId, setCustomerId] = useState('');
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [quickCustomer, setQuickCustomer] = useState<QuickCustomerForm>(emptyQuickCustomerForm);
  const [savingQuickCustomer, setSavingQuickCustomer] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('dinheiro');
  const [discount, setDiscount] = useState(0);
  const [discountInput, setDiscountInput] = useState('0,00');
  const [amountPaid, setAmountPaid] = useState(0);
  const [amountPaidInput, setAmountPaidInput] = useState('0,00');
  const [installmentCount, setInstallmentCount] = useState(1);
  const [firstDueDate, setFirstDueDate] = useState(todayInputValue());
  const [dueDay, setDueDay] = useState(dayFromDateValue(todayInputValue()));
  const [cart, setCart] = useState<CartItem[]>([]);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [recentSaleLimit, setRecentSaleLimit] = useState(3);
  const [salesLoadError, setSalesLoadError] = useState<string | null>(null);
  const [saleShareFeedback, setSaleShareFeedback] = useState<string | null>(null);
  const [saleShareError, setSaleShareError] = useState(false);
  const [sharingSaleId, setSharingSaleId] = useState<string | null>(null);
  const sharingSaleRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    setSalesLoadError(null);
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
      setSalesLoadError('Não foi possível atualizar as vendas. Tente novamente.');
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [refreshToken]);

  useEffect(() => {
    setProductVisibleLimit(SALES_PRODUCT_INITIAL_LIMIT);
  }, [debouncedQuery, categoryFilter]);

  useEffect(() => {
    setCustomerVisibleLimit(resetLimitForQuery(debouncedCustomerQuery));
  }, [debouncedCustomerQuery]);

  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    products.forEach((product) => {
      const category = String(product.category || 'Sem categoria').trim() || 'Sem categoria';
      counts.set(category, (counts.get(category) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'pt-BR'))
      .slice(0, 4)
      .map(([category, count]) => ({ category, count }));
  }, [products]);

  const filteredProductPool = useMemo(() => {
    const term = debouncedQuery.trim().toLowerCase();
    const source = term && canRunListSearch(debouncedQuery)
      ? products.filter((product) => [
        product.name,
        product.category,
        product.internal_code,
        product.barcode,
      ].some((value) => value.toLowerCase().includes(term)))
      : sortStockedFirst(products);
    return categoryFilter === 'todos'
      ? source
      : source.filter((product) => (String(product.category || 'Sem categoria').trim() || 'Sem categoria') === categoryFilter);
  }, [categoryFilter, debouncedQuery, products]);

  const filteredProducts = useMemo(() => (
    filteredProductPool.slice(0, productVisibleLimit)
  ), [debouncedQuery, filteredProductPool, productVisibleLimit]);

  const filteredCustomers = useMemo(() => {
    const term = debouncedCustomerQuery.trim().toLowerCase();
    const source = term && canRunListSearch(debouncedCustomerQuery)
      ? customers.filter((customer) => [customer.name, customer.phone, customer.whatsapp, customer.address]
        .some((value) => String(value || '').toLowerCase().includes(term)))
      : customers;
    return source.slice(0, limitForQuery(debouncedCustomerQuery, customerVisibleLimit));
  }, [customerVisibleLimit, customers, debouncedCustomerQuery]);

  const canLoadMoreProducts = !debouncedQuery.trim() && filteredProducts.length < filteredProductPool.length;
  const canLoadMoreCustomers = !debouncedCustomerQuery.trim() && filteredCustomers.length < customers.length;

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.qty * item.unit_price, 0), [cart]);
  const total = Math.max(0, subtotal - Math.max(0, discount));
  const totalQty = useMemo(() => cart.reduce((sum, item) => sum + item.qty, 0), [cart]);
  const change = paymentMethod === 'dinheiro' ? Math.max(0, amountPaid - total) : 0;
  const selectedCustomer = customers.find((customer) => customer.id === customerId) ?? null;
  const availableProductsCount = products.filter((product) => product.stock > 0).length;
  const outOfStockCount = products.length - availableProductsCount;
  const isCreditSale = paymentMethod === 'crediario';
  const canFinishSale = cart.length > 0 && (!isCreditSale || Boolean(customerId && firstDueDate)) && total > 0;
  const currentStep = cart.length === 0 ? 1 : canFinishSale ? 4 : 3;
  const finishSaleGuidance = saving
    ? 'Enviando a venda para a nuvem...'
    : cart.length === 0
      ? 'Adicione um produto para finalizar'
      : total <= 0
        ? 'Revise o desconto para finalizar'
        : isCreditSale && !customerId
          ? 'Selecione o cliente para finalizar'
          : isCreditSale && !firstDueDate
            ? 'Informe o vencimento para finalizar'
            : 'Pronto para finalizar a venda';
  const paymentHelper = isCreditSale
    ? selectedCustomer
      ? `${normalizeInstallmentCount(installmentCount)}x · primeiro vencimento ${firstDueDate ? new Date(`${firstDueDate}T00:00:00`).toLocaleDateString('pt-BR') : 'não definido'}`
      : 'Selecione um cliente cadastrado para liberar o crediário.'
    : `Recebimento em ${paymentLabel(paymentMethod)}${paymentMethod === 'dinheiro' && change > 0 ? ` · troco ${formatCurrency(change)}` : ''}`;
  const setActiveDialogNode = useDialogAccessibility({
    open: quickCustomerOpen,
    onClose: () => { if (!savingQuickCustomer) setQuickCustomerOpen(false); },
  });

  useEffect(() => {
    if (paymentMethod === 'crediario') {
      setAmountPaid(0);
      setAmountPaidInput('0,00');
      return;
    }
    if (total > 0) {
      setAmountPaid(total);
      setAmountPaidInput(formatCurrencyInput(total));
    }
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

  function openQuickCustomerForm(): void {
    setError(null);
    setFeedback(null);
    setPaymentMethod('crediario');
    setQuickCustomerOpen(true);
  }

  async function saveQuickCustomer(): Promise<void> {
    if (savingQuickCustomer) return;
    const name = quickCustomer.name.trim();
    if (!name) {
      setError('Informe o nome do cliente para salvar e continuar a venda no crediário.');
      return;
    }
    setSavingQuickCustomer(true);
    setError(null);
    setFeedback(null);
    try {
      const saved = await api.saveCustomer({
        name,
        phone: quickCustomer.phone.trim(),
        whatsapp: quickCustomer.whatsapp.trim() || quickCustomer.phone.trim(),
        address: quickCustomer.address.trim(),
        credit_limit: 0,
        status: 'ativo',
        notes: 'Cliente criado rapidamente dentro da venda.',
      });
      setCustomers((current) => [saved, ...current.filter((customer) => customer.id !== saved.id)]);
      setCustomerId(saved.id);
      setCustomerQuery(saved.name);
      setQuickCustomer(emptyQuickCustomerForm);
      setQuickCustomerOpen(false);
      setFeedback(`Cliente ${saved.name} cadastrado e selecionado nesta venda. Agora é só conferir as parcelas e finalizar.`);
      notifyMobileAction({ title: 'Cliente cadastrado', message: `${saved.name} já ficou selecionado para esta venda no crediário.`, tone: 'success', page: 'sales', actionLabel: 'Continuar' });
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingQuickCustomer(false);
    }
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
      setDiscountInput('0,00');
      setAmountPaid(0);
      setAmountPaidInput('0,00');
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

  async function shareRecentSale(sale: SaleSummary, format: ReceiptShareFormat = 'pdf'): Promise<void> {
    if (sharingSaleRef.current) return;
    sharingSaleRef.current = true;
    setSharingSaleId(sale.id);
    setSaleShareError(false);
    setSaleShareFeedback('Preparando comprovante…');
    try {
      const receipt = findReceiptForSale(receipts, sale);
      const message = await shareSaleReceipt(sale, receipt, format);
      setSaleShareFeedback(message);
      setFeedback(message);
      notifyMobileAction({ title: format === 'png' ? 'Imagem do comprovante' : 'Comprovante PDF', message, tone: message.startsWith('Ainda') ? 'warning' : 'success', page: 'receipts', actionLabel: 'Abrir' });
    } catch (err) {
      setSaleShareError(true);
      setSaleShareFeedback(err instanceof Error ? err.message : 'Não foi possível preparar o comprovante. Tente novamente.');
    } finally {
      sharingSaleRef.current = false;
      setSharingSaleId(null);
    }
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
      <section className="mapp-sales-flow-summary mapp-sales-flow-premium" aria-label="Resumo do fluxo de venda">
        <div className="mapp-sales-flow-copy">
          <span>PDV guiado</span>
          <strong>{currentStep === 4 ? 'Venda pronta para conferir' : currentStep === 3 ? 'Confira pagamento e cliente' : 'Comece escolhendo o produto'}</strong>
          <small>{cart.length ? `${formatNumber(totalQty)} ${totalQty === 1 ? 'item' : 'itens'} · ${formatCurrency(total)}` : 'Busque, toque no produto e finalize em poucos passos.'}</small>
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

      <section className="mapp-sales-topbar" aria-label="Resumo rápido da venda">
        <button type="button" className="mapp-sales-topbar-item" onClick={() => document.getElementById('mapp-mini-cart-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
          <span><InlineIcon name="vendas_pdv" size={24} /></span>
          <div>
            <small>Carrinho</small>
            <strong>{totalQty ? `${formatNumber(totalQty)} ${totalQty === 1 ? 'item' : 'itens'}` : 'Vazio'}</strong>
          </div>
          <b>›</b>
        </button>
        <div className="mapp-sales-topbar-item">
          <span><InlineIcon name="caixa" size={24} /></span>
          <div>
            <small>Subtotal</small>
            <strong>{formatCurrency(subtotal)}</strong>
          </div>
        </div>
        <label className="mapp-sales-topbar-item mapp-sales-customer-compact">
          <span><InlineIcon name="clientes" size={24} /></span>
          <div>
            <small>Cliente</small>
            <strong>{selectedCustomer?.name || 'Consumidor final'}</strong>
          </div>
          <select aria-label="Selecionar cliente da venda" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
            <option value="">Consumidor final</option>
            {filteredCustomers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
          </select>
        </label>
      </section>

      <section className="mapp-sales-premium-layout">
        <div className="mapp-sales-products-column">

      <section className="mapp-panel mapp-pdv-search mapp-sales-product-browser">
        <label className="mapp-pdv-search-box" aria-label="Buscar produto">
          <InlineIcon name="buscar" size={24} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar produto, código ou barra" />
          <InlineIcon name="relatorios" size={24} />
        </label>
        <div className="mapp-sales-category-row" aria-label="Categorias rápidas">
          <button type="button" className={categoryFilter === 'todos' ? 'active' : ''} onClick={() => setCategoryFilter('todos')}>Todos</button>
          {categoryOptions.map((item) => (
            <button key={item.category} type="button" className={categoryFilter === item.category ? 'active' : ''} onClick={() => setCategoryFilter(item.category)}>
              {item.category}
            </button>
          ))}
          <button type="button" className="mapp-sales-filter-button" onClick={() => setQuery('')}>Filtrar</button>
        </div>
        {query.trim() && !canRunListSearch(query) ? <div className="mapp-inline-status">Digite ao menos 2 letras, SKU ou código de barras para buscar.</div> : null}
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
                <div className="mapp-sales-product-info">
                  <span className="mapp-sales-product-name">{product.name}</span>
                  <span className="mapp-sales-product-code">{product.internal_code || product.category || 'Produto'}</span>
                  <span className={product.stock <= 0 ? 'mapp-sales-product-stock danger' : 'mapp-sales-product-stock'}>
                    {product.stock <= 0 ? 'Sem estoque' : 'Em estoque'}{inCartQty ? ` · carrinho ${formatNumber(inCartQty)}` : ''}
                  </span>
                </div>
                <div className="mapp-sales-product-price">{formatCurrency(price)}</div>
                <div className={product.stock <= 0 ? 'mapp-sales-product-action danger' : 'mapp-sales-product-action'}>{product.stock <= 0 ? 'Sem estoque' : 'Adicionar'}</div>
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
        {canLoadMoreProducts ? (
          <button type="button" className="mapp-secondary-button mapp-list-more-button mapp-sales-show-more-products" onClick={() => setProductVisibleLimit((count) => count + SALES_PRODUCT_LIMIT_STEP)}>
            Mostrar mais produtos ({Math.max(0, filteredProductPool.length - filteredProducts.length)} restantes)
          </button>
        ) : null}
      </section>
        </div>

        <aside className="mapp-sales-side-column">
      <section className="mapp-panel mapp-pdv-cart mapp-sales-mini-cart" id="mapp-mini-cart-panel">
        <div className="mapp-section-title mapp-section-title-compact">
          <div>
            <h2>Mini carrinho</h2>
            <small>{cart.length ? `${formatNumber(totalQty)} ${totalQty === 1 ? 'item selecionado' : 'itens selecionados'}` : 'Carrinho vazio'}</small>
          </div>
          {cart.length ? <button type="button" onClick={() => { if (window.confirm('Limpar todos os produtos do carrinho?')) setCart([]); }}>Limpar carrinho</button> : null}
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
        <div className="mapp-sales-mini-cart-summary">
          <span>Subtotal <b>{formatCurrency(subtotal)}</b></span>
          <span>Desconto <b>{formatCurrency(discount)}</b></span>
          <strong>Total <b>{formatCurrency(total)}</b></strong>
        </div>
        <button type="button" className="mapp-primary-button mapp-sales-payment-jump" disabled={!cart.length} onClick={() => document.getElementById('mapp-payment-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
          {cart.length ? 'Ir para pagamento' : 'Adicione um produto para pagar'}
        </button>
        <div className="mapp-sales-mini-cart-actions">
          {cart.length ? <button type="button" className="danger" onClick={() => { if (window.confirm('Limpar todos os produtos do carrinho?')) setCart([]); }}>Limpar carrinho</button> : null}
          <button type="button" onClick={openQuickCustomerForm}>Mais ações</button>
        </div>
      </section>

      <section className="mapp-panel mapp-pdv-quick-payment">
        <div className="mapp-section-title mapp-section-title-compact">
          <div>
            <h2>Pagamento rápido</h2>
            <small>Escolha a forma antes de finalizar.</small>
          </div>
        </div>
        <div className="mapp-sales-quick-pay-grid">
          {(['dinheiro', 'pix', 'cartao', 'crediario'] as PaymentMethod[]).map((method) => (
            <button key={method} type="button" className={paymentMethod === method ? 'active' : ''} onClick={() => setPaymentMethod(method)}>
              <InlineIcon name={method === 'dinheiro' ? 'caixa' : method === 'pix' ? 'comprovantes' : method === 'cartao' ? 'vendas_pdv' : 'crediario'} size={24} />
              <span>{paymentLabel(method)}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="mapp-panel mapp-pdv-checkout" id="mapp-payment-panel">
        <div className="mapp-section-title mapp-section-title-compact">
          <div>
            <h2>Pagamento e finalização</h2>
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
          <input value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} placeholder="Digite nome ou telefone para encontrar mais rápido." />
          <select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
            <option value="">Consumidor final</option>
            {filteredCustomers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
          </select>
          <div className="mapp-inline-actions mapp-customer-quick-actions">
            {canLoadMoreCustomers ? <button type="button" className="mapp-secondary-button compact" onClick={() => setCustomerVisibleLimit((count) => count + LOAD_MORE_STEP)}>Carregar mais clientes</button> : null}
            <button type="button" className="mapp-secondary-button compact strong" onClick={openQuickCustomerForm}>+ Criar cliente rápido</button>
          </div>
        </label>
        <div className="mapp-payment-segments">
          {(['dinheiro', 'pix', 'cartao', 'crediario'] as PaymentMethod[]).map((method) => (
            <button key={method} type="button" className={paymentMethod === method ? 'active' : ''} onClick={() => setPaymentMethod(method)}>
              {paymentLabel(method)}
            </button>
          ))}
        </div>
        {isCreditSale && !customerId ? (
          <div className="mapp-pdv-warning mapp-pdv-warning-action">
            <span>Selecione um cliente cadastrado para vender no crediário ou cadastre sem sair da venda.</span>
            <button type="button" onClick={openQuickCustomerForm}>Criar cliente agora</button>
          </div>
        ) : null}
        <div className="mapp-form-grid mapp-pdv-money-grid">
          <label>
            <span>Desconto</span>
            <input inputMode="decimal" type="text" value={discountInput} onChange={(event) => { const masked = maskCurrencyInput(event.target.value); setDiscountInput(masked); setDiscount(parseCurrencyInput(masked)); }} onBlur={() => setDiscountInput(formatCurrencyInput(discount))} placeholder="0,00" />
          </label>
          <label>
            <span>Valor pago</span>
            <input inputMode="decimal" type="text" value={paymentMethod === 'crediario' ? '0,00' : amountPaidInput} onChange={(event) => { const masked = maskCurrencyInput(event.target.value); setAmountPaidInput(masked); setAmountPaid(parseCurrencyInput(masked)); }} onBlur={() => setAmountPaidInput(formatCurrencyInput(amountPaid))} disabled={paymentMethod === 'crediario'} placeholder="0,00" />
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
        <p id="mapp-finish-sale-guidance" className={canFinishSale ? 'mapp-finish-sale-guidance is-ready' : 'mapp-finish-sale-guidance'} aria-live="polite">{finishSaleGuidance}</p>
        <button type="button" className="mapp-primary-button mapp-finish-sale" disabled={saving || !canFinishSale} aria-describedby="mapp-finish-sale-guidance" onClick={() => void finishSale()}>
          {saving ? 'Enviando para a nuvem...' : canFinishSale ? '4. Finalizar venda' : finishSaleGuidance}
        </button>
      </section>

      {quickCustomerOpen ? (
        <div className="mapp-bottom-sheet-backdrop mapp-dialog-backdrop" role="presentation" onClick={() => { if (!savingQuickCustomer) setQuickCustomerOpen(false); }}>
          <section ref={setActiveDialogNode} className="mapp-bottom-sheet mapp-quick-customer-sheet mapp-dialog-frame" role="dialog" aria-modal="true" aria-label="Criar cliente rápido" aria-busy={savingQuickCustomer} tabIndex={-1} onClick={(event) => event.stopPropagation()}>
            <header className="mapp-bottom-sheet-head mapp-dialog-header">
              <div>
                <strong>Criar cliente para esta venda</strong>
                <p>Salva e já seleciona no crediário sem perder o carrinho.</p>
              </div>
              <button type="button" onClick={() => setQuickCustomerOpen(false)} disabled={savingQuickCustomer}>Fechar</button>
            </header>
            <div className="mapp-dialog-body">
            <div className="mapp-form-grid mapp-quick-customer-grid">
              <label className="span-2">
                <span>Nome do cliente *</span>
                <input value={quickCustomer.name} onChange={(event) => setQuickCustomer((current) => ({ ...current, name: event.target.value }))} placeholder="Ex.: Maria Silva" />
              </label>
              <label>
                <span>Telefone</span>
                <input inputMode="tel" value={quickCustomer.phone} onChange={(event) => setQuickCustomer((current) => ({ ...current, phone: event.target.value }))} placeholder="(43) 99999-0000" />
              </label>
              <label>
                <span>WhatsApp</span>
                <input inputMode="tel" value={quickCustomer.whatsapp} onChange={(event) => setQuickCustomer((current) => ({ ...current, whatsapp: event.target.value }))} placeholder="Pode deixar igual telefone" />
              </label>
              <label className="span-2">
                <span>Endereço</span>
                <input value={quickCustomer.address} onChange={(event) => setQuickCustomer((current) => ({ ...current, address: event.target.value }))} placeholder="Rua, número, bairro" />
              </label>
            </div>
            </div>
            <footer className="mapp-bottom-sheet-actions mapp-dialog-footer">
              {error ? <div className="mapp-form-feedback mapp-form-feedback-error mapp-dialog-feedback" role="alert">{error}</div> : null}
              <button type="button" className="mapp-secondary-button" onClick={() => setQuickCustomerOpen(false)} disabled={savingQuickCustomer}>Cancelar</button>
              <button type="button" className="mapp-primary-button" disabled={savingQuickCustomer} onClick={() => void saveQuickCustomer()}>{savingQuickCustomer ? 'Salvando...' : 'Salvar e usar na venda'}</button>
            </footer>
          </section>
        </div>
      ) : null}

      <section className="mapp-section-block mapp-recent-sales-block mapp-sales-recent-side mapp-recent-list" aria-labelledby="recent-sales-title" aria-busy={loading}>
        <div className="mapp-recent-list-heading">
          <div>
            <h2 id="recent-sales-title">Vendas recentes</h2>
            <p>Mais recentes primeiro. Toque para ver cliente, itens e comprovantes.</p>
          </div>
          <button type="button" aria-label="Atualizar vendas recentes" disabled={loading} onClick={() => void loadData()}>{loading ? 'Atualizando…' : 'Atualizar'}</button>
        </div>
        {salesLoadError ? <p className="mapp-recent-list-message is-error" role="alert">{salesLoadError}{sales.length ? ' A lista anterior foi mantida.' : ''}</p> : null}
        {saleShareFeedback ? <p className={`mapp-recent-list-message ${saleShareError ? 'is-error' : ''}`} role={saleShareError ? 'alert' : 'status'}>{saleShareFeedback}</p> : null}
        {loading ? <p className="mapp-recent-list-message" role="status">Atualizando vendas…</p> : null}
        {sales.length ? (
          <ul className="mapp-recent-list-items">
            {sales.slice(0, recentSaleLimit).map((sale) => (
              <li key={sale.id}><RecentSaleCard
                sale={sale}
                expanded={expandedSaleId === sale.id}
                onToggle={() => setExpandedSaleId((current) => current === sale.id ? null : sale.id)}
              >
                <button type="button" disabled={sharingSaleId !== null} onClick={() => void shareRecentSale(sale, 'pdf')}>{sharingSaleId === sale.id ? 'Preparando…' : 'Comprovante PDF'}</button>
                <button type="button" disabled={sharingSaleId !== null} onClick={() => void shareRecentSale(sale, 'png')}>Extrato PNG</button>
                <button type="button" disabled={sharingSaleId !== null} onClick={() => void shareRecentSale(sale, 'share')}>Compartilhar</button>
              </RecentSaleCard></li>
            ))}
          </ul>
        ) : !loading && !salesLoadError ? (
          <div className="mapp-recent-list-empty">
            <strong>Nenhuma venda registrada</strong>
            <small>Finalize uma venda para acompanhar aqui.</small>
          </div>
        ) : null}
        {recentSaleLimit < sales.length ? (
          <button type="button" className="mapp-recent-list-more" onClick={() => setRecentSaleLimit((limit) => limit + 3)}>Mostrar mais vendas ({Math.min(3, sales.length - recentSaleLimit)})</button>
        ) : null}
      </section>
        </aside>
      </section>
    </div>
  );
}
