import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AppIcon } from '../components/AppIcon';
import { DataTable } from '../components/DataTable';
import { api } from '../lib/api';
import { makeRequestId, money } from '../lib/format';
import { useWebPermissions } from '../lib/useWebPermissions';
import type { Customer, PaymentMethod, Product, ReceiptSummary, SaleSummary } from '../types';

interface PageProps { refreshToken: number; onChanged: () => void; }
interface CartItem { product_id: string; name: string; qty: number; unit_price: number; internal_code?: string; }

function todayInputValue(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function paymentMethodLabel(method: PaymentMethod): string {
  if (method === 'dinheiro') return 'Dinheiro';
  if (method === 'pix') return 'Pix';
  if (method === 'cartao') return 'Cartão';
  return 'Crediário';
}

function saleStatusLabel(status: string): string {
  if (status === 'finalizada') return 'Finalizada';
  if (status === 'cancelada') return 'Cancelada';
  if (status === 'quitada') return 'Quitada';
  if (status === 'aberto') return 'Em aberto';
  return status;
}

export function SalesPage({ refreshToken, onChanged }: PageProps): JSX.Element {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<SaleSummary[]>([]);
  const [receipts, setReceipts] = useState<ReceiptSummary[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCartProductId, setSelectedCartProductId] = useState<string | null>(null);
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState(1);
  const [customerId, setCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('dinheiro');
  const [installmentCount, setInstallmentCount] = useState(1);
  const [firstDueDate, setFirstDueDate] = useState(todayInputValue());
  const [discount, setDiscount] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [saving, setSaving] = useState(false);
  const [printingReceipt, setPrintingReceipt] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const permissions = useWebPermissions(refreshToken);
  const canOperate = permissions.canOperate;
  const customerSelectRef = useRef<HTMLSelectElement | null>(null);

  useEffect(() => {
    Promise.all([api.products(), api.customers(), api.sales(), api.receipts()])
      .then(([productRows, customerRows, saleRows, receiptRows]) => {
        setProducts(productRows.filter((item) => item.status === 'ativo'));
        setCustomers(customerRows.filter((row) => row.status === 'ativo'));
        setSales(saleRows);
        setReceipts(receiptRows);
      })
      .catch(() => undefined);
  }, [refreshToken]);

  async function reload() {
    const [productRows, customerRows, saleRows, receiptRows] = await Promise.all([
      api.products(),
      api.customers(),
      api.sales(),
      api.receipts(),
    ]);
    setProducts(productRows.filter((item) => item.status === 'ativo'));
    setCustomers(customerRows.filter((row) => row.status === 'ativo'));
    setSales(saleRows);
    setReceipts(receiptRows);
    onChanged();
  }

  const selectedProduct = useMemo(
    () => products.find((item) => item.id === productId) ?? null,
    [products, productId],
  );

  const selectedCustomer = useMemo(
    () => customers.find((item) => item.id === customerId) ?? null,
    [customers, customerId],
  );

  const selectedCartItem = useMemo(
    () => cart.find((item) => item.product_id === selectedCartProductId) ?? null,
    [cart, selectedCartProductId],
  );

  const latestReceipt = useMemo(() => {
    const latestSale = sales[0];
    if (!latestSale) return receipts[0] ?? null;
    return receipts.find((item) => item.sale_id === latestSale.id) ?? receipts[0] ?? null;
  }, [receipts, sales]);

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.qty * item.unit_price, 0),
    [cart],
  );
  const total = Math.max(0, subtotal - discount);
  const totalQty = useMemo(() => cart.reduce((sum, item) => sum + item.qty, 0), [cart]);
  const cashChange = paymentMethod === 'dinheiro' ? Math.max(0, amountPaid - total) : 0;

  useEffect(() => {
    if (paymentMethod === 'crediario') {
      setAmountPaid(0);
    } else if (total > 0 && amountPaid === 0) {
      setAmountPaid(total);
    }
  }, [amountPaid, paymentMethod, total]);

  function addItem() {
    if (!canOperate) {
      setMessage('');
      setError(permissions.readonlyMessage || 'Você não tem permissão para montar vendas.');
      return;
    }
    const product = selectedProduct;
    if (!product || qty <= 0) return;
    const currentQty = cart.find((item) => item.product_id === product.id)?.qty ?? 0;
    if (currentQty + qty > product.stock) {
      setError(`Estoque insuficiente para ${product.name}. Disponível: ${product.stock}.`);
      return;
    }
    setError('');
    setMessage('');
    setCart((current) => {
      const existingItem = current.find((item) => item.product_id === product.id);
      if (existingItem) {
        return current.map((item) => item.product_id === product.id ? { ...item, qty: item.qty + qty } : item);
      }
      return [
        ...current,
        {
          product_id: product.id,
          name: product.name,
          qty,
          unit_price: product.promo_price ?? product.price,
          internal_code: product.internal_code,
        },
      ];
    });
    setSelectedCartProductId(product.id);
    setProductId('');
    setQty(1);
  }

  function updateSelectedItem() {
    if (!canOperate) {
      setMessage('');
      setError(permissions.readonlyMessage || 'Você não tem permissão para alterar itens da venda.');
      return;
    }
    if (!selectedCartItem || qty <= 0) return;
    const product = products.find((item) => item.id === selectedCartItem.product_id);
    if (!product) return;
    const otherQty = cart
      .filter((item) => item.product_id !== selectedCartItem.product_id)
      .find((item) => item.product_id === product.id)?.qty ?? 0;
    if (qty + otherQty > product.stock) {
      setError(`Estoque insuficiente para ${product.name}. Disponível: ${product.stock}.`);
      return;
    }
    setError('');
    setCart((current) => current.map((item) => item.product_id === selectedCartItem.product_id ? { ...item, qty } : item));
  }

  function removeItem(productIdToRemove: string) {
    if (!canOperate) {
      setMessage('');
      setError(permissions.readonlyMessage || 'Você não tem permissão para remover itens da venda.');
      return;
    }
    setCart((current) => current.filter((item) => item.product_id !== productIdToRemove));
    if (selectedCartProductId === productIdToRemove) setSelectedCartProductId(null);
  }

  function clearSale() {
    setCart([]);
    setSelectedCartProductId(null);
    setDiscount(0);
    setAmountPaid(0);
    setMessage('');
    setError('');
  }

  async function printLatestReceipt() {
    if (printingReceipt) return;
    setError('');
    setMessage('');
    if (cart.length > 0) {
      setMessage('Finalize a venda para gerar o comprovante antes de imprimir.');
      return;
    }
    if (!latestReceipt) {
      setError('Nenhum comprovante disponível para impressão.');
      return;
    }
    setPrintingReceipt(true);
    try {
      const fileStem = `comprovante-venda-${latestReceipt.sale_number || latestReceipt.sale_id}`;
      const path = await api.exportHtmlPdf(latestReceipt.content, fileStem, true, undefined, latestReceipt.receipt_type);
      setMessage(`Comprovante da última venda enviado para PDF em ${path}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPrintingReceipt(false);
    }
  }

  async function finishSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (cart.length === 0 || saving) return;
    if (!canOperate) {
      setMessage('');
      setError(permissions.readonlyMessage || 'Você não tem permissão para finalizar vendas.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.createSale({
        request_id: makeRequestId('sale'),
        customer_id: customerId || null,
        payment_method: paymentMethod,
        discount,
        installment_count: paymentMethod === 'crediario' ? installmentCount : 0,
        first_due_date: paymentMethod === 'crediario' ? firstDueDate : null,
        items: cart,
      });
      clearSale();
      setCustomerId('');
      setPaymentMethod('dinheiro');
      setInstallmentCount(1);
      setFirstDueDate(todayInputValue());
      await reload();
      setMessage('Venda gravada com sucesso. O comprovante ficou disponível na aba de comprovantes.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack classic-sales-stack sales-light-v64 sales-pdv-v85">
      {error && <div className="error-box">{error}</div>}
      {message && <div className="notice">{message}</div>}
      {!canOperate && permissions.isWeb ? <div className="web-readonly-module-note"><strong>{permissions.roleLabel}</strong><span>{permissions.readonlyMessage}</span></div> : null}

      <form className="classic-sales-panel" onSubmit={finishSale}>
        <div className="light-section-note-v64 sales-helper-v64"><strong>Fluxo do PDV</strong><span>{canOperate ? '1. Adicione produtos · 2. Confira cliente e pagamento · 3. Finalize no resumo.' : 'Consulta liberada. Para vender ou alterar, entre com um perfil autorizado.'}</span></div>
        <div className="sales-mobile-pdv-guide"><strong>PDV no celular</strong><span>Busque o produto, toque em Adicionar e confira o total antes de finalizar. Os itens aparecem em cards para evitar corte lateral.</span></div>
        <section className="panel classic-panel">
          <div className="classic-fieldset-title">Adicionar produto</div>
          <div className="classic-sales-add-row">
            <label>
              <span>Código / SKU</span>
              <input value={selectedProduct?.internal_code ?? ''} readOnly />
            </label>
            <label className="classic-sales-product-field">
              <span>Descrição do produto</span>
              <select value={productId} onChange={(event) => setProductId(event.target.value)} disabled={!canOperate}>
                <option value="">Selecione um produto ou use o leitor de código de barras</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} | estoque {product.stock}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Quantidade</span>
              <input type="number" min="1" step="1" value={qty} onChange={(event) => setQty(Number(event.target.value) || 1)} readOnly={!canOperate} />
            </label>
            <label>
              <span>Preço unitário (R$)</span>
              <input value={selectedProduct ? (selectedProduct.promo_price ?? selectedProduct.price).toFixed(2).replace('.', ',') : '0,00'} readOnly />
            </label>
            <button type="button" className="primary-btn classic-add-btn" onClick={addItem} disabled={!canOperate}>
              <AppIcon name="novo_item_adicionar" size={16} className="app-icon-button-inline" />
              Adicionar
            </button>
          </div>
        </section>

        <section className="classic-sales-middle">
          <article className="panel classic-panel">
            <div className="classic-fieldset-title">Itens da venda ({cart.length} itens)</div>
            <DataTable<CartItem>
              rows={cart}
              empty="Nenhum item adicionado ainda. Busque um produto pelo código, nome ou leitor e toque em Adicionar."
              getRowKey={(row) => row.product_id}
              selectedRowKey={selectedCartProductId}
              onRowClick={(row) => {
                setSelectedCartProductId(row.product_id);
                setQty(row.qty);
                setProductId(row.product_id);
              }}
              columns={[
                { key: 'code', label: 'Código', render: (row) => row.internal_code || '-' },
                { key: 'name', label: 'Descrição do produto', render: (row) => row.name },
                { key: 'qty', label: 'Qtd.', align: 'right', render: (row) => row.qty.toFixed(3).replace('.', ',') },
                { key: 'unit', label: 'Unitário (R$)', align: 'right', render: (row) => money(row.unit_price) },
                { key: 'total', label: 'Total (R$)', align: 'right', render: (row) => money(row.unit_price * row.qty) },
              ]}
            />
            <div className="sales-mobile-cart-cards" aria-label="Itens da venda em cards para celular">
              {cart.length === 0 ? (
                <div className="empty-state-card">
                  <span className="empty-state-icon"><AppIcon name="buscar" size={24} className="app-icon-chip" /></span>
                  <strong>Nenhum item adicionado ainda.</strong>
                  <small>Busque um produto pelo código, nome ou leitor e toque em Adicionar.</small>
                </div>
              ) : cart.map((item, index) => (
                <button
                  type="button"
                  key={item.product_id}
                  className={`sales-mobile-cart-card ${selectedCartProductId === item.product_id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedCartProductId(item.product_id);
                    setQty(item.qty);
                    setProductId(item.product_id);
                  }}
                >
                  <span className="sales-mobile-cart-card-top"><small>ITEM {String(index + 1).padStart(2, '0')}</small><em>{money(item.unit_price * item.qty)}</em></span>
                  <strong>{item.name}</strong>
                  <span className="sales-mobile-cart-card-bottom"><span>Cód. {item.internal_code || '-'}</span><span>{item.qty.toFixed(3).replace('.', ',')} × {money(item.unit_price)}</span></span>
                </button>
              ))}
            </div>
            <div className="classic-sales-item-actions">
              <button type="button" className="ghost-btn" onClick={() => selectedCartItem && removeItem(selectedCartItem.product_id)} disabled={!selectedCartItem || !canOperate}>
                <AppIcon name="remover_menos" size={16} className="app-icon-button-inline" />
                Remover
              </button>
              <button type="button" className="ghost-btn" onClick={updateSelectedItem} disabled={!selectedCartItem || !canOperate}>
                <AppIcon name="editar" size={16} className="app-icon-button-inline" />
                Alterar
              </button>
              <button type="button" className="ghost-btn" onClick={clearSale} disabled={cart.length === 0 || !canOperate}>
                <AppIcon name="excluir" size={16} className="app-icon-button-inline" />
                Limpar venda
              </button>
            </div>
          </article>

          <aside className="panel classic-panel classic-customer-panel">
            <div className="classic-fieldset-title">Cliente</div>
            <div className="classic-customer-header">
              <button type="button" className="secondary-btn" onClick={() => customerSelectRef.current?.focus()}>
                <AppIcon name="clientes" size={16} className="app-icon-button-inline" />
                Buscar cliente (F3)
              </button>
            </div>
            <label>
              <span>Selecionar cliente</span>
              <select ref={customerSelectRef} value={customerId} onChange={(event) => setCustomerId(event.target.value)} disabled={!canOperate}>
                <option value="">Consumidor final / balcão</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
              </select>
            </label>
            <div className="classic-customer-grid">
              <label>
                <span>Código</span>
                <input value={selectedCustomer?.id.slice(0, 6).toUpperCase() ?? '000000'} readOnly />
              </label>
              <label>
                <span>Nome</span>
                <input value={selectedCustomer?.name ?? 'Consumidor Final'} readOnly />
              </label>
              <label>
                <span>Telefone</span>
                <input value={selectedCustomer?.phone ?? '-'} readOnly />
              </label>
              <label>
                <span>E-mail / WhatsApp</span>
                <input value={selectedCustomer?.whatsapp || '-'} readOnly />
              </label>
              <label className="span-2">
                <span>Tipo</span>
                <input value={customerId ? 'Cliente cadastrado' : 'Consumidor Final'} readOnly />
              </label>
            </div>
          </aside>
        </section>

        <section className="classic-sales-bottom">
          <article className="panel classic-panel">
            <div className="classic-fieldset-title">Formas de pagamento</div>
            <div className="classic-payment-options">
              <label className="classic-payment-row-option">
                <div className="classic-payment-title">
                  <input type="radio" checked={paymentMethod === 'dinheiro'} onChange={() => setPaymentMethod('dinheiro')} disabled={!canOperate} />
                  <strong><AppIcon name="dinheiro" size={16} className="app-icon-button-inline" />Dinheiro</strong>
                </div>
                <span>Valor pago (R$)</span>
                <input type="number" min="0" step="0.01" value={paymentMethod === 'dinheiro' ? amountPaid : 0} onChange={(event) => setAmountPaid(Number(event.target.value))} readOnly={!canOperate} />
                <span>Troco (R$)</span>
                <input value={money(cashChange).replace('R$ ', '')} readOnly />
              </label>

              <label className="classic-payment-row-option">
                <div className="classic-payment-title">
                  <input type="radio" checked={paymentMethod === 'cartao'} onChange={() => setPaymentMethod('cartao')} disabled={!canOperate} />
                  <strong><AppIcon name="cartao_debito" size={16} className="app-icon-button-inline" />Cartão Débito / Crédito</strong>
                </div>
                <span>Valor (R$)</span>
                <input type="number" min="0" step="0.01" value={paymentMethod === 'cartao' ? amountPaid : total} onChange={(event) => setAmountPaid(Number(event.target.value))} readOnly={!canOperate} />
                <span>Taxa (%)</span>
                <input value="0,00" readOnly />
              </label>

              <label className="classic-payment-row-option">
                <div className="classic-payment-title">
                  <input type="radio" checked={paymentMethod === 'pix'} onChange={() => setPaymentMethod('pix')} disabled={!canOperate} />
                  <strong><AppIcon name="pix" size={16} className="app-icon-button-inline" />Pix</strong>
                </div>
                <span>Valor (R$)</span>
                <input type="number" min="0" step="0.01" value={paymentMethod === 'pix' ? amountPaid : total} onChange={(event) => setAmountPaid(Number(event.target.value))} readOnly={!canOperate} />
                <span>Total (R$)</span>
                <input value={money(total).replace('R$ ', '')} readOnly />
              </label>

              <label className="classic-payment-row-option">
                <div className="classic-payment-title">
                  <input type="radio" checked={paymentMethod === 'crediario'} onChange={() => setPaymentMethod('crediario')} disabled={!canOperate} />
                  <strong><AppIcon name="crediario" size={16} className="app-icon-button-inline" />Crediário</strong>
                </div>
                <span>Parcelas</span>
                <input type="number" min="1" max="24" step="1" value={installmentCount} onChange={(event) => setInstallmentCount(Math.min(24, Math.max(1, Number(event.target.value) || 1)))} readOnly={!canOperate} />
                <span>Primeiro vencimento</span>
                <input type="date" value={firstDueDate} onChange={(event) => setFirstDueDate(event.target.value)} readOnly={!canOperate} />
              </label>
            </div>
          </article>

          <aside className="panel classic-panel classic-sale-summary-panel">
            <div className="classic-fieldset-title">Resumo da venda</div>
            <div className="classic-sale-summary-grid">
              <div><span>Total de itens:</span><strong>{cart.length}</strong></div>
              <div><span>Quantidade total:</span><strong>{totalQty.toFixed(3).replace('.', ',')}</strong></div>
              <div><span>Subtotal:</span><strong>{money(subtotal)}</strong></div>
              <div>
                <span>Descontos:</span>
                <input type="number" min="0" step="0.01" value={discount} onChange={(event) => setDiscount(Number(event.target.value) || 0)} readOnly={!canOperate} />
              </div>
            </div>
            <div className="classic-sale-total-box">
              <span>Total a pagar:</span>
              <strong>{money(total)}</strong>
              <small>Troco: {money(cashChange)}</small>
            </div>
            <div className="classic-sale-action-buttons">
              <button className="primary-btn big" disabled={saving || cart.length === 0 || !canOperate}>
                {saving ? 'Gravando venda...' : canOperate ? <><AppIcon name="finalizar_venda" size={24} className="app-icon-button-inline" />Finalizar venda (F9)</> : 'Somente leitura'}
              </button>
              <button type="button" className="ghost-btn big" onClick={clearSale} disabled={cart.length === 0 || !canOperate}>
                <AppIcon name="cancelar_venda" size={24} className="app-icon-button-inline" />
                Cancelar venda
              </button>
              <button type="button" className="secondary-btn big" onClick={printLatestReceipt} disabled={printingReceipt}>
                <AppIcon name="imprimir" size={24} className="app-icon-button-inline" />
                {printingReceipt ? 'Gerando comprovante...' : 'Imprimir prévia'}
              </button>
            </div>
          </aside>
        </section>
      </form>

      <section className="panel classic-panel">
        <div className="classic-panel-header">
          <h2>Últimas vendas registradas</h2>
        </div>
        <DataTable<SaleSummary>
          rows={sales.slice(0, 8)}
          empty="Nenhuma venda registrada ainda. Quando finalizar uma venda, ela aparecerá aqui."
          getRowKey={(row) => row.id}
          columns={[
            { key: 'number', label: 'Venda', render: (row) => `#${row.number}` },
            { key: 'customer', label: 'Cliente', render: (row) => row.customer_name || 'Balcão' },
            { key: 'method', label: 'Forma', render: (row) => paymentMethodLabel(row.payment_method) },
            { key: 'total', label: 'Total', align: 'right', render: (row) => money(row.total) },
            { key: 'status', label: 'Status', render: (row) => saleStatusLabel(row.status) },
          ]}
        />
      </section>
    </div>
  );
}
