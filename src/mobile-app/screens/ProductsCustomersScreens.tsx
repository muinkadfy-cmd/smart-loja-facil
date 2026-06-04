import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { api } from '../../lib/api';
import type { AppStatus, Customer, Product } from '../../types';
import { EmptyState } from '../components/EmptyState';
import { InlineIcon } from '../components/InlineIcon';
import { StatCard } from '../components/StatCard';
import { formatCurrency, formatNumber } from '../components/format';

interface ProductsCustomersScreenProps {
  status: AppStatus | null;
  refreshToken: number;
  onRefresh: () => void;
}

type FeedbackTone = 'success' | 'error' | 'info';

type Feedback = {
  tone: FeedbackTone;
  text: string;
};

type ProductFilter = 'todos' | 'ativos' | 'baixo' | 'inativos';
type CustomerFilter = 'todos' | 'ativos' | 'contato' | 'limite' | 'inativos';

type ProductFormState = {
  id?: string;
  name: string;
  category: string;
  internal_code: string;
  barcode: string;
  price: string;
  promo_price: string;
  stock: string;
  unit: string;
  size: string;
  color: string;
  image_data: string;
  status: Product['status'];
};

type CustomerFormState = {
  id?: string;
  name: string;
  phone: string;
  whatsapp: string;
  address: string;
  credit_limit: string;
  status: Customer['status'];
  notes: string;
};

const emptyProductForm: ProductFormState = {
  name: '',
  category: '',
  internal_code: '',
  barcode: '',
  price: '',
  promo_price: '',
  stock: '0',
  unit: 'un',
  size: '',
  color: '',
  image_data: '',
  status: 'ativo',
};

const emptyCustomerForm: CustomerFormState = {
  name: '',
  phone: '',
  whatsapp: '',
  address: '',
  credit_limit: '',
  status: 'ativo',
  notes: '',
};

function moneyToNumber(value: string): number {
  const normalized = value.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function intToNumber(value: string): number {
  const parsed = Number(value.replace(/[^0-9-]/g, ''));
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function isProductPhotoData(value: string | null | undefined): boolean {
  return /^data:image\/(png|jpe?g|webp);base64,/i.test(String(value ?? '').trim());
}

function hasProductPhoto(product: Pick<Product, 'image_data'> | ProductFormState): boolean {
  return Boolean(String(product.image_data ?? '').trim());
}

function productPhotoLabel(value: string | null | undefined): string {
  const photo = String(value ?? '').trim();
  if (!photo) return 'Sem foto';
  if (isProductPhotoData(photo)) return 'Foto pronta para salvar';
  return 'Foto na nuvem';
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Não foi possível ler a foto selecionada.'));
    reader.readAsDataURL(file);
  });
}

function productToForm(product: Product): ProductFormState {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    internal_code: product.internal_code,
    barcode: product.barcode,
    price: String(product.price || ''),
    promo_price: product.promo_price === null || product.promo_price === undefined ? '' : String(product.promo_price),
    stock: String(product.stock ?? 0),
    unit: product.unit || 'un',
    size: product.size,
    color: product.color,
    image_data: product.image_data || '',
    status: product.status,
  };
}

function customerToForm(customer: Customer): CustomerFormState {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    whatsapp: customer.whatsapp,
    address: customer.address,
    credit_limit: customer.credit_limit ? String(customer.credit_limit) : '',
    status: customer.status,
    notes: customer.notes,
  };
}

function StatusFeedback({ feedback }: { feedback: Feedback | null }): JSX.Element | null {
  if (!feedback) return null;
  return <div className={`mapp-form-feedback mapp-form-feedback-${feedback.tone}`}>{feedback.text}</div>;
}

function scrollPanelIntoPage<TElement extends HTMLElement>(
  panelRef: RefObject<HTMLElement>,
  focusRef?: RefObject<TElement>,
) {
  window.setTimeout(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const pageScroller = document.getElementById('mapp-page-scroll');
    if (pageScroller) {
      const scrollerRect = pageScroller.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      pageScroller.scrollTo({
        top: Math.max(0, pageScroller.scrollTop + panelRect.top - scrollerRect.top - 14),
        behavior: 'smooth',
      });
    } else {
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    window.setTimeout(() => focusRef?.current?.focus({ preventScroll: true }), 320);
  }, 90);
}

function clearNavigationIntent() {
  window.history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}`);
}

function ProductForm({
  form,
  saving,
  panelRef,
  nameInputRef,
  onChange,
  onCancel,
  onSubmit,
  onPhotoSelected,
  onPreviewPhoto,
}: {
  form: ProductFormState;
  saving: boolean;
  panelRef: RefObject<HTMLElement>;
  nameInputRef: RefObject<HTMLInputElement>;
  onChange: (next: ProductFormState) => void;
  onCancel: () => void;
  onSubmit: () => void;
  onPhotoSelected: (file: File) => void;
  onPreviewPhoto: (src: string, title: string) => void;
}): JSX.Element {
  return (
    <section className="mapp-form-panel" aria-label="Cadastro de produto" ref={panelRef}>
      <div className="mapp-form-head">
        <span className="mapp-form-icon tone-sky"><InlineIcon name="produtos" size={24} /></span>
        <div>
          <strong>{form.id ? 'Editar produto' : 'Novo produto'}</strong>
          <p>Preencha só o essencial para vender no celular e no computador.</p>
        </div>
      </div>

      <div className="mapp-form-grid">
        <label className="span-2">
          <span>Nome do produto *</span>
          <input ref={nameInputRef} value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} placeholder="Ex.: Camiseta feminina" />
        </label>
        <label>
          <span>Categoria</span>
          <input value={form.category} onChange={(event) => onChange({ ...form, category: event.target.value })} placeholder="Roupas, presentes..." />
        </label>
        <label>
          <span>Código interno</span>
          <input value={form.internal_code} onChange={(event) => onChange({ ...form, internal_code: event.target.value })} placeholder="Opcional" />
        </label>
        <label>
          <span>Preço *</span>
          <input inputMode="decimal" value={form.price} onChange={(event) => onChange({ ...form, price: event.target.value })} placeholder="0,00" />
        </label>
        <label>
          <span>Preço promo.</span>
          <input inputMode="decimal" value={form.promo_price} onChange={(event) => onChange({ ...form, promo_price: event.target.value })} placeholder="Opcional" />
        </label>
        <label>
          <span>Estoque</span>
          <input inputMode="numeric" value={form.stock} onChange={(event) => onChange({ ...form, stock: event.target.value })} placeholder="0" />
        </label>
        <label>
          <span>Unidade</span>
          <input value={form.unit} onChange={(event) => onChange({ ...form, unit: event.target.value })} placeholder="un" />
        </label>
        <label>
          <span>Tamanho</span>
          <input value={form.size} onChange={(event) => onChange({ ...form, size: event.target.value })} placeholder="P, M, G..." />
        </label>
        <label>
          <span>Cor</span>
          <input value={form.color} onChange={(event) => onChange({ ...form, color: event.target.value })} placeholder="Preto, azul..." />
        </label>
        <div className="mapp-product-photo-field span-2">
          <div className="mapp-product-photo-preview-wrap">
            {hasProductPhoto(form) ? (
              <button
                type="button"
                className="mapp-product-photo-preview-button"
                onClick={() => onPreviewPhoto(form.image_data, form.name || 'Foto do produto')}
                aria-label="Ampliar foto do produto"
              >
                <img src={form.image_data} alt={form.name || 'Prévia do produto'} />
              </button>
            ) : (
              <div className="mapp-product-photo-placeholder">
                <InlineIcon name="produtos" size={32} />
                <strong>Sem foto</strong>
              </div>
            )}
          </div>
          <div className="mapp-product-photo-actions">
            <strong>Foto do produto</strong>
            <p>PNG, JPG ou WEBP até 2 MB. A miniatura aparece na lista e toca para ampliar.</p>
            <label className="mapp-photo-upload-button">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.currentTarget.value = '';
                  if (file) onPhotoSelected(file);
                }}
              />
              Escolher foto
            </label>
            {hasProductPhoto(form) ? (
              <button type="button" className="mapp-secondary-button compact" onClick={() => onChange({ ...form, image_data: '' })}>Remover foto</button>
            ) : null}
            {hasProductPhoto(form) ? <span className="mapp-photo-status">{productPhotoLabel(form.image_data)}</span> : null}
          </div>
        </div>
        <label className="span-2">
          <span>Código de barras</span>
          <input value={form.barcode} onChange={(event) => onChange({ ...form, barcode: event.target.value })} placeholder="Opcional" />
        </label>
        <label>
          <span>Status</span>
          <select value={form.status} onChange={(event) => onChange({ ...form, status: event.target.value as Product['status'] })}>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>
        </label>
      </div>

      <div className="mapp-form-actions">
        <button type="button" className="mapp-secondary-button" onClick={onCancel}>Cancelar</button>
        <button type="button" className="mapp-primary-button" onClick={onSubmit} disabled={saving}>{saving ? 'Salvando...' : 'Salvar produto'}</button>
      </div>
    </section>
  );
}

function CustomerForm({
  form,
  saving,
  panelRef,
  nameInputRef,
  onChange,
  onCancel,
  onSubmit,
}: {
  form: CustomerFormState;
  saving: boolean;
  panelRef: RefObject<HTMLElement>;
  nameInputRef: RefObject<HTMLInputElement>;
  onChange: (next: CustomerFormState) => void;
  onCancel: () => void;
  onSubmit: () => void;
}): JSX.Element {
  return (
    <section className="mapp-form-panel" aria-label="Cadastro de cliente" ref={panelRef}>
      <div className="mapp-form-head">
        <span className="mapp-form-icon tone-purple"><InlineIcon name="clientes" size={24} /></span>
        <div>
          <strong>{form.id ? 'Editar cliente' : 'Novo cliente'}</strong>
          <p>Dados rápidos para vendas, pedidos e crediário.</p>
        </div>
      </div>

      <div className="mapp-form-grid">
        <label className="span-2">
          <span>Nome do cliente *</span>
          <input ref={nameInputRef} value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} placeholder="Nome completo" />
        </label>
        <label>
          <span>Telefone</span>
          <input inputMode="tel" value={form.phone} onChange={(event) => onChange({ ...form, phone: event.target.value })} placeholder="(00) 00000-0000" />
        </label>
        <label>
          <span>WhatsApp</span>
          <input inputMode="tel" value={form.whatsapp} onChange={(event) => onChange({ ...form, whatsapp: event.target.value })} placeholder="(00) 00000-0000" />
        </label>
        <label className="span-2">
          <span>Endereço</span>
          <input value={form.address} onChange={(event) => onChange({ ...form, address: event.target.value })} placeholder="Rua, número, bairro" />
        </label>
        <label>
          <span>Limite crediário</span>
          <input inputMode="decimal" value={form.credit_limit} onChange={(event) => onChange({ ...form, credit_limit: event.target.value })} placeholder="0,00" />
        </label>
        <label>
          <span>Status</span>
          <select value={form.status} onChange={(event) => onChange({ ...form, status: event.target.value as Customer['status'] })}>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>
        </label>
        <label className="span-2">
          <span>Observações</span>
          <textarea value={form.notes} onChange={(event) => onChange({ ...form, notes: event.target.value })} placeholder="Preferências, endereço de entrega ou observações importantes" rows={3} />
        </label>
      </div>

      <div className="mapp-form-actions">
        <button type="button" className="mapp-secondary-button" onClick={onCancel}>Cancelar</button>
        <button type="button" className="mapp-primary-button" onClick={onSubmit} disabled={saving}>{saving ? 'Salvando...' : 'Salvar cliente'}</button>
      </div>
    </section>
  );
}

export function ProductsScreen({ status, refreshToken, onRefresh }: ProductsCustomersScreenProps): JSX.Element {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ProductFilter>('todos');
  const [form, setForm] = useState<ProductFormState | null>(null);
  const [stockAdjust, setStockAdjust] = useState<{ product: Product; delta: string; reason: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingStock, setSavingStock] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [photoPreview, setPhotoPreview] = useState<{ src: string; title: string } | null>(null);
  const productFormRef = useRef<HTMLElement>(null);
  const productNameInputRef = useRef<HTMLInputElement>(null);
  const stockAdjustRef = useRef<HTMLElement>(null);
  const stockAdjustInputRef = useRef<HTMLInputElement>(null);

  const lowLimit = status?.settings.low_stock_limit ?? 3;

  function openProductForm(next: ProductFormState, feedbackText: string) {
    setStockAdjust(null);
    setForm(next);
    setFeedback({ tone: 'info', text: feedbackText });
    scrollPanelIntoPage(productFormRef, productNameInputRef);
  }

  function startNewProduct() {
    openProductForm({ ...emptyProductForm }, 'Pronto para cadastrar um novo produto.');
  }

  const handleProductPhotoSelected = async (file: File) => {
    if (!form) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setFeedback({ tone: 'error', text: 'Escolha uma foto em PNG, JPG ou WEBP.' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setFeedback({ tone: 'error', text: 'A foto precisa ter no máximo 2 MB para salvar e sincronizar bem no celular.' });
      return;
    }
    try {
      const imageData = await fileToDataUrl(file);
      setForm({ ...form, image_data: imageData });
      setFeedback({ tone: 'info', text: 'Foto carregada. Salve o produto para enviar para a nuvem.' });
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    }
  };

  function openStockAdjust(product: Product, delta = '+1', reason = 'Reposição rápida pelo celular') {
    setForm(null);
    setStockAdjust({ product, delta, reason });
    setFeedback({ tone: 'info', text: `Ajuste rápido aberto para ${product.name}.` });
    scrollPanelIntoPage(stockAdjustRef, stockAdjustInputRef);
  }

  const loadProducts = async () => {
    setLoading(true);
    try {
      const rows = await api.products();
      setProducts(rows);
      setFeedback(null);
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProducts();
  }, [refreshToken]);

  useEffect(() => {
    if (window.location.hash === '#novo-produto') {
      const timer = window.setTimeout(() => {
        setStockAdjust(null);
        setForm({ ...emptyProductForm });
        setFeedback({ tone: 'info', text: 'Pronto para cadastrar um novo produto.' });
        scrollPanelIntoPage(productFormRef, productNameInputRef);
        clearNavigationIntent();
      }, 260);
      return () => window.clearTimeout(timer);
    }

    if (window.location.hash === '#baixo-estoque') {
      setFilter('baixo');
      clearNavigationIntent();
    }

    return undefined;
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesTerm = !term || [product.name, product.category, product.internal_code, product.barcode].some((value) => value.toLowerCase().includes(term));
      const matchesFilter =
        filter === 'todos'
        || (filter === 'ativos' && product.status === 'ativo')
        || (filter === 'baixo' && product.status === 'ativo' && product.stock <= lowLimit)
        || (filter === 'inativos' && product.status === 'inativo');
      return matchesTerm && matchesFilter;
    });
  }, [filter, lowLimit, products, query]);

  const lowStock = products.filter((product) => product.status === 'ativo' && product.stock <= lowLimit).length;
  const activeProducts = products.filter((product) => product.status === 'ativo').length;
  const inactiveProducts = products.filter((product) => product.status === 'inativo').length;
  const stockValue = products
    .filter((product) => product.status === 'ativo')
    .reduce((sum, product) => sum + product.stock * (product.promo_price ?? product.price), 0);

  const saveProduct = async () => {
    if (!form) return;
    const name = form.name.trim();
    if (!name) {
      setFeedback({ tone: 'error', text: 'Informe o nome do produto antes de salvar.' });
      return;
    }
    setSaving(true);
    try {
      await api.saveProduct({
        id: form.id,
        name,
        category: form.category.trim(),
        internal_code: form.internal_code.trim(),
        barcode: form.barcode.trim(),
        price: moneyToNumber(form.price),
        promo_price: form.promo_price.trim() ? moneyToNumber(form.promo_price) : null,
        stock: intToNumber(form.stock),
        unit: form.unit.trim() || 'un',
        size: form.size.trim(),
        color: form.color.trim(),
        image_data: form.image_data.trim(),
        status: form.status,
      });
      setFeedback({ tone: 'success', text: hasProductPhoto(form) ? 'Produto e foto salvos. A miniatura deve aparecer nos aparelhos sincronizados.' : (form.id ? 'Produto atualizado e sincronizado.' : 'Produto cadastrado e sincronizado.') });
      setForm(null);
      await loadProducts();
      onRefresh();
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  };

  const changeProductStatus = async (product: Product, nextStatus: Product['status']) => {
    setSaving(true);
    try {
      if (nextStatus === 'inativo') {
        await api.inactivateProduct(product.id);
        setFeedback({ tone: 'success', text: 'Produto inativado. Ele saiu das vendas, mas continua no histórico.' });
      } else {
        await api.saveProduct({ ...product, status: 'ativo' });
        setFeedback({ tone: 'success', text: 'Produto reativado e pronto para vender.' });
      }
      await loadProducts();
      onRefresh();
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  };

  const submitStockAdjust = async () => {
    if (!stockAdjust) return;
    const delta = Number(stockAdjust.delta.replace(',', '.'));
    const reason = stockAdjust.reason.trim() || (delta > 0 ? 'Entrada rápida pelo celular' : 'Saída rápida pelo celular');
    if (!Number.isFinite(delta) || delta === 0) {
      setFeedback({ tone: 'error', text: 'Informe uma quantidade positiva ou negativa para ajustar o estoque.' });
      return;
    }
    setSavingStock(true);
    try {
      await api.adjustStock(stockAdjust.product.id, Math.round(delta), reason);
      setFeedback({ tone: 'success', text: `Estoque de ${stockAdjust.product.name} ajustado e sincronizado.` });
      setStockAdjust(null);
      await loadProducts();
      onRefresh();
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSavingStock(false);
    }
  };

  return (
    <div className="mapp-screen mapp-crud-screen mapp-products-screen">
      <section className="mapp-panel mapp-action-panel mapp-crud-hero">
        <span className="mapp-panel-icon tone-sky"><InlineIcon name="produtos" size={24} /></span>
        <div>
          <strong>Produtos prontos para vender</strong>
          <p>Cadastre, edite, busque e acompanhe estoque baixo sem sair da interface nova.</p>
        </div>
        <button type="button" onClick={startNewProduct}>Novo produto</button>
      </section>

      <section className="mapp-mini-stat-grid">
        <StatCard label="Produtos" value={formatNumber(products.length)} detail="no catálogo" icon="produtos" tone="sky" />
        <StatCard label="Ativos" value={formatNumber(activeProducts)} detail="prontos para venda" icon="loja_ativa" tone="green" />
        <StatCard label="Estoque baixo" value={formatNumber(lowStock)} detail="precisam atenção" icon="auditoria_logs" tone="orange" />
        <StatCard label="Valor em estoque" value={formatCurrency(stockValue)} detail={`${formatNumber(inactiveProducts)} inativo(s)`} icon="caixa" tone="purple" />
      </section>

      {lowStock ? (
        <section className="mapp-stock-alert">
          <span><InlineIcon name="auditoria_logs" size={24} /></span>
          <div>
            <strong>{formatNumber(lowStock)} produto(s) com estoque baixo</strong>
            <p>Revise reposição antes de vender no PDV para evitar ruptura.</p>
          </div>
          <button type="button" onClick={() => setFilter('baixo')}>Ver baixo estoque</button>
        </section>
      ) : null}

      <StatusFeedback feedback={feedback} />

      <section className="mapp-crud-toolbar">
        <label>
          <span>Buscar produto</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, código ou categoria" />
        </label>
        <button type="button" onClick={() => void loadProducts()}>Atualizar</button>
        <div className="mapp-product-filter-row">
          {[
            ['todos', `Todos ${formatNumber(products.length)}`],
            ['ativos', `Ativos ${formatNumber(activeProducts)}`],
            ['baixo', `Baixo ${formatNumber(lowStock)}`],
            ['inativos', `Inativos ${formatNumber(inactiveProducts)}`],
          ].map(([key, label]) => (
            <button key={key} type="button" className={filter === key ? 'active' : ''} onClick={() => setFilter(key as ProductFilter)}>
              {label}
            </button>
          ))}
        </div>
      </section>

      {form ? (
        <ProductForm
          form={form}
          saving={saving}
          panelRef={productFormRef}
          nameInputRef={productNameInputRef}
          onChange={setForm}
          onCancel={() => setForm(null)}
          onSubmit={() => void saveProduct()}
          onPhotoSelected={(file) => void handleProductPhotoSelected(file)}
          onPreviewPhoto={(src, title) => setPhotoPreview({ src, title })}
        />
      ) : null}

      {stockAdjust ? (
        <section className="mapp-form-panel mapp-stock-adjust-panel" aria-label="Ajuste rápido de estoque" ref={stockAdjustRef}>
          <div className="mapp-form-head">
            <span className="mapp-form-icon tone-orange"><InlineIcon name="caixa" size={24} /></span>
            <div>
              <strong>Ajustar estoque</strong>
              <p>{stockAdjust.product.name} · atual {formatNumber(stockAdjust.product.stock)} {stockAdjust.product.unit || 'un'}</p>
            </div>
          </div>
          <div className="mapp-stock-shortcuts">
            {['+1', '+5', '+10', '-1'].map((value) => (
              <button key={value} type="button" onClick={() => setStockAdjust({ ...stockAdjust, delta: value })}>{value}</button>
            ))}
          </div>
          <div className="mapp-form-grid">
            <label>
              <span>Quantidade</span>
              <input ref={stockAdjustInputRef} inputMode="numeric" value={stockAdjust.delta} onChange={(event) => setStockAdjust({ ...stockAdjust, delta: event.target.value })} placeholder="+5 ou -2" />
            </label>
            <label>
              <span>Motivo</span>
              <input value={stockAdjust.reason} onChange={(event) => setStockAdjust({ ...stockAdjust, reason: event.target.value })} placeholder="Reposição, perda, conferência..." />
            </label>
          </div>
          <div className="mapp-form-actions">
            <button type="button" className="mapp-secondary-button" onClick={() => setStockAdjust(null)}>Cancelar</button>
            <button type="button" className="mapp-primary-button" onClick={() => void submitStockAdjust()} disabled={savingStock}>{savingStock ? 'Ajustando...' : 'Salvar ajuste'}</button>
          </div>
        </section>
      ) : null}

      {loading ? <div className="mapp-inline-status">Carregando produtos...</div> : null}

      {filtered.length ? (
        <section className="mapp-crud-list" aria-label="Lista de produtos">
          {filtered.map((product) => {
            const price = product.promo_price ?? product.price;
            const low = product.stock <= lowLimit;
            return (
              <article key={product.id} className={`mapp-crud-card ${product.status === 'inativo' ? 'is-inactive' : ''}`}>
                {hasProductPhoto(product) ? (
                  <button
                    type="button"
                    className="mapp-product-thumb"
                    onClick={() => setPhotoPreview({ src: product.image_data, title: product.name })}
                    aria-label={`Ampliar foto de ${product.name}`}
                  >
                    <img src={product.image_data} alt={product.name} loading="lazy" />
                  </button>
                ) : (
                  <span className={`mapp-crud-icon ${low ? 'tone-orange' : 'tone-sky'}`}><InlineIcon name="produtos" size={24} /></span>
                )}
                <div className="mapp-crud-main">
                  <div className="mapp-crud-title-row">
                    <strong>{product.name}</strong>
                    <em className={low ? 'warn' : 'ok'}>{low ? 'Estoque baixo' : product.status}</em>
                  </div>
                  <p>{product.category || 'Sem categoria'} · Estoque {formatNumber(product.stock)} {product.unit || 'un'}</p>
                  <div className="mapp-crud-meta">
                    <span>{product.internal_code || 'Sem código'}</span>
                    <span>{product.barcode || 'Sem barras'}</span>
                    <span>{productPhotoLabel(product.image_data)}</span>
                  </div>
                </div>
                <div className="mapp-crud-side">
                  <strong>{formatCurrency(price)}</strong>
                  <div className="mapp-product-actions">
                    <button type="button" onClick={() => openProductForm(productToForm(product), `Editando ${product.name}.`)}>Editar</button>
                    <button type="button" onClick={() => openStockAdjust(product)}>Estoque</button>
                    <button type="button" onClick={() => void changeProductStatus(product, product.status === 'ativo' ? 'inativo' : 'ativo')} disabled={saving}>
                      {product.status === 'ativo' ? 'Inativar' : 'Ativar'}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : !loading ? (
        <EmptyState icon="produtos" title="Nenhum produto encontrado" detail={query ? 'Tente buscar por outro nome, código ou categoria.' : 'Cadastre o primeiro produto para começar a vender.'} actionLabel="Novo produto" actionPage="products" onNavigate={startNewProduct} />
      ) : null}

      {photoPreview ? (
        <div className="mapp-photo-modal" role="dialog" aria-modal="true" aria-label="Foto ampliada do produto" onClick={() => setPhotoPreview(null)}>
          <div className="mapp-photo-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="mapp-photo-modal-head">
              <div>
                <strong>{photoPreview.title}</strong>
                <p>Foto ampliada do produto</p>
              </div>
              <button type="button" onClick={() => setPhotoPreview(null)}>Fechar</button>
            </div>
            <img src={photoPreview.src} alt={photoPreview.title} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function CustomersScreen({ refreshToken, onRefresh }: ProductsCustomersScreenProps): JSX.Element {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CustomerFilter>('todos');
  const [form, setForm] = useState<CustomerFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const customerFormRef = useRef<HTMLElement>(null);
  const customerNameInputRef = useRef<HTMLInputElement>(null);

  function openCustomerForm(next: CustomerFormState, feedbackText: string) {
    setForm(next);
    setFeedback({ tone: 'info', text: feedbackText });
    scrollPanelIntoPage(customerFormRef, customerNameInputRef);
  }

  function startNewCustomer() {
    openCustomerForm({ ...emptyCustomerForm }, 'Pronto para cadastrar um novo cliente.');
  }

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const rows = await api.customers();
      setCustomers(rows);
      setFeedback(null);
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCustomers();
  }, [refreshToken]);

  useEffect(() => {
    if (window.location.hash !== '#novo-cliente') return undefined;
    const timer = window.setTimeout(() => {
      setForm({ ...emptyCustomerForm });
      setFeedback({ tone: 'info', text: 'Pronto para cadastrar um novo cliente.' });
      scrollPanelIntoPage(customerFormRef, customerNameInputRef);
      clearNavigationIntent();
    }, 260);
    return () => window.clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return customers.filter((customer) => {
      const matchesTerm = !term || [customer.name, customer.phone, customer.whatsapp, customer.address].some((value) => value.toLowerCase().includes(term));
      const matchesFilter =
        filter === 'todos'
        || (filter === 'ativos' && customer.status === 'ativo')
        || (filter === 'contato' && Boolean(customer.phone || customer.whatsapp))
        || (filter === 'limite' && Number(customer.credit_limit || 0) > 0)
        || (filter === 'inativos' && customer.status === 'inativo');
      return matchesTerm && matchesFilter;
    });
  }, [customers, filter, query]);

  const activeCustomers = customers.filter((customer) => customer.status === 'ativo').length;
  const withContact = customers.filter((customer) => customer.phone || customer.whatsapp).length;
  const withCreditLimit = customers.filter((customer) => Number(customer.credit_limit || 0) > 0).length;
  const inactiveCustomers = customers.filter((customer) => customer.status === 'inativo').length;
  const totalCreditLimit = customers.reduce((sum, customer) => sum + Number(customer.credit_limit || 0), 0);

  const saveCustomer = async () => {
    if (!form) return;
    const name = form.name.trim();
    if (!name) {
      setFeedback({ tone: 'error', text: 'Informe o nome do cliente antes de salvar.' });
      return;
    }
    setSaving(true);
    try {
      await api.saveCustomer({
        id: form.id,
        name,
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim(),
        address: form.address.trim(),
        credit_limit: moneyToNumber(form.credit_limit),
        status: form.status,
        notes: form.notes.trim(),
      });
      setFeedback({ tone: 'success', text: form.id ? 'Cliente atualizado e sincronizado.' : 'Cliente cadastrado e sincronizado.' });
      setForm(null);
      await loadCustomers();
      onRefresh();
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  };

  const changeCustomerStatus = async (customer: Customer, nextStatus: Customer['status']) => {
    setSaving(true);
    try {
      if (nextStatus === 'inativo') {
        await api.inactivateCustomer(customer.id);
        setFeedback({ tone: 'success', text: 'Cliente inativado. O histórico permanece preservado.' });
      } else {
        await api.saveCustomer({ ...customer, status: 'ativo' });
        setFeedback({ tone: 'success', text: 'Cliente reativado e disponível para vendas.' });
      }
      await loadCustomers();
      onRefresh();
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  };

  const copyCustomerContact = async (customer: Customer) => {
    const text = [
      customer.name,
      customer.whatsapp ? `WhatsApp: ${customer.whatsapp}` : '',
      customer.phone ? `Telefone: ${customer.phone}` : '',
      customer.address ? `Endereço: ${customer.address}` : '',
    ].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(text || customer.name);
      setFeedback({ tone: 'success', text: 'Contato copiado.' });
    } catch {
      setFeedback({ tone: 'info', text: text || customer.name });
    }
  };

  return (
    <div className="mapp-screen mapp-crud-screen mapp-customers-screen">
      <section className="mapp-panel mapp-action-panel mapp-crud-hero">
        <span className="mapp-panel-icon tone-purple"><InlineIcon name="clientes" size={24} /></span>
        <div>
          <strong>Clientes organizados</strong>
          <p>Cadastre contatos, WhatsApp e limite para vendas, pedidos e crediário.</p>
        </div>
        <button type="button" onClick={startNewCustomer}>Novo cliente</button>
      </section>

      <section className="mapp-mini-stat-grid">
        <StatCard label="Clientes" value={formatNumber(customers.length)} detail="na base" icon="clientes" tone="purple" />
        <StatCard label="Ativos" value={formatNumber(activeCustomers)} detail="para atendimento" icon="loja_ativa" tone="green" />
        <StatCard label="Com contato" value={formatNumber(withContact)} detail="telefone ou WhatsApp" icon="comprovantes" tone="sky" />
        <StatCard label="Limite total" value={formatCurrency(totalCreditLimit)} detail={`${formatNumber(withCreditLimit)} com limite`} icon="crediario" tone="orange" />
      </section>

      <StatusFeedback feedback={feedback} />

      <section className="mapp-crud-toolbar">
        <label>
          <span>Buscar cliente</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, telefone ou endereço" />
        </label>
        <button type="button" onClick={() => void loadCustomers()}>Atualizar</button>
        <div className="mapp-product-filter-row">
          {[
            ['todos', `Todos ${formatNumber(customers.length)}`],
            ['ativos', `Ativos ${formatNumber(activeCustomers)}`],
            ['contato', `Contato ${formatNumber(withContact)}`],
            ['limite', `Limite ${formatNumber(withCreditLimit)}`],
            ['inativos', `Inativos ${formatNumber(inactiveCustomers)}`],
          ].map(([key, label]) => (
            <button key={key} type="button" className={filter === key ? 'active' : ''} onClick={() => setFilter(key as CustomerFilter)}>
              {label}
            </button>
          ))}
        </div>
      </section>

      {form ? (
        <CustomerForm
          form={form}
          saving={saving}
          panelRef={customerFormRef}
          nameInputRef={customerNameInputRef}
          onChange={setForm}
          onCancel={() => setForm(null)}
          onSubmit={() => void saveCustomer()}
        />
      ) : null}

      {loading ? <div className="mapp-inline-status">Carregando clientes...</div> : null}

      {filtered.length ? (
        <section className="mapp-crud-list" aria-label="Lista de clientes">
          {filtered.map((customer) => (
            <article key={customer.id} className={`mapp-crud-card ${customer.status === 'inativo' ? 'is-inactive' : ''}`}>
              <span className="mapp-crud-icon tone-purple"><InlineIcon name="clientes" size={24} /></span>
              <div className="mapp-crud-main">
                <div className="mapp-crud-title-row">
                  <strong>{customer.name}</strong>
                  <em className={customer.status === 'ativo' ? 'ok' : 'warn'}>{customer.status}</em>
                </div>
                <p>{customer.phone || customer.whatsapp || 'Sem telefone'} · {customer.address || 'Sem endereço'}</p>
                <div className="mapp-crud-meta">
                  <span>WhatsApp: {customer.whatsapp || 'não informado'}</span>
                  <span>Limite: {formatCurrency(customer.credit_limit)}</span>
                </div>
              </div>
              <div className="mapp-crud-side">
                <strong>{customer.credit_limit ? formatCurrency(customer.credit_limit) : 'Sem limite'}</strong>
                <div className="mapp-product-actions mapp-customer-actions">
                  <button type="button" onClick={() => openCustomerForm(customerToForm(customer), `Editando ${customer.name}.`)}>Editar</button>
                  <button type="button" onClick={() => void copyCustomerContact(customer)}>Copiar</button>
                  <button type="button" onClick={() => void changeCustomerStatus(customer, customer.status === 'ativo' ? 'inativo' : 'ativo')} disabled={saving}>
                    {customer.status === 'ativo' ? 'Inativar' : 'Ativar'}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : !loading ? (
        <EmptyState icon="clientes" title="Nenhum cliente encontrado" detail={query ? 'Tente buscar por outro nome ou telefone.' : 'Cadastre o primeiro cliente para vender e acompanhar crediário.'} actionLabel="Novo cliente" actionPage="customers" onNavigate={startNewCustomer} />
      ) : null}
    </div>
  );
}
