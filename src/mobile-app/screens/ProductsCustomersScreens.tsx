import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { api } from '../../lib/api';
import { INITIAL_LIST_LIMIT, LOAD_MORE_STEP, SEARCH_RESULT_LIMIT } from '../../lib/listLimits';
import type { AppStatus, Customer, Product } from '../../types';
import { EmptyState } from '../components/EmptyState';
import { InlineIcon } from '../components/InlineIcon';
import { StatCard } from '../components/StatCard';
import { formatCurrency, formatNumber } from '../components/format';
import { notifyMobileAction } from '../components/actionToast';

interface ProductsCustomersScreenProps {
  status: AppStatus | null;
  refreshToken: number;
  onRefresh: () => void;
}

type FeedbackTone = 'success' | 'error' | 'info' | 'warning';

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
  cost_price: string;
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
  cost_price: '',
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


type ProductPreset = {
  label: string;
  category: string;
  size: string;
  color: string;
  nameHint: string;
};

const PRODUCT_PRESETS: ProductPreset[] = [
  { label: 'Camiseta feminina', category: 'Roupas femininas', size: 'M', color: 'Variada', nameHint: 'Camiseta feminina' },
  { label: 'Blusa feminina', category: 'Roupas femininas', size: 'M', color: 'Variada', nameHint: 'Blusa feminina' },
  { label: 'Vestido', category: 'Roupas femininas', size: 'M', color: 'Estampado', nameHint: 'Vestido feminino' },
  { label: 'Camiseta masculina', category: 'Roupas masculinas', size: 'G', color: 'Preta', nameHint: 'Camiseta masculina' },
  { label: 'Infantil', category: 'Roupas infantis', size: '4', color: 'Variada', nameHint: 'Roupa infantil' },
  { label: 'Lingerie', category: 'Lingeries', size: 'M', color: 'Variada', nameHint: 'Lingerie' },
  { label: 'Acessório', category: 'Acessórios', size: 'Único', color: 'Sortido', nameHint: 'Acessório' },
  { label: 'Presente', category: 'Presentes', size: 'Único', color: 'Sortido', nameHint: 'Presente' },
  { label: 'Utilitário', category: 'Utilitários', size: 'Único', color: 'Sortido', nameHint: 'Utilitário' },
];

const PRODUCT_CATEGORY_OPTIONS = [
  'Roupas femininas',
  'Roupas masculinas',
  'Roupas infantis',
  'Lingeries',
  'Acessórios',
  'Presentes',
  'Utilitários',
  'Calçados',
  'Bolsas',
  'Outros',
];

const PRODUCT_SIZE_OPTIONS = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'Único', 'RN', '1', '2', '4', '6', '8', '10', '12', '14', '16'];
const PRODUCT_COLOR_OPTIONS = ['Preto', 'Branco', 'Azul', 'Rosa', 'Vermelho', 'Verde', 'Bege', 'Marrom', 'Cinza', 'Estampado', 'Sortido', 'Variada'];
const MAX_PRODUCT_PHOTO_SOURCE_BYTES = 12 * 1024 * 1024;
const TARGET_PRODUCT_PHOTO_BYTES = 1.65 * 1024 * 1024;
const PRODUCT_PHOTO_MAX_EDGE = 1600;
const CRUD_VISIBLE_BATCH = INITIAL_LIST_LIMIT;


function normalizeSkuPart(value: string, fallback: string): string {
  const text = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase()
    .slice(0, 4);
  return text || fallback;
}

function ean13Checksum(first12: string): string {
  const sum = first12.split('').reduce((total, digit, index) => total + (Number(digit) || 0) * (index % 2 === 0 ? 1 : 3), 0);
  return String((10 - (sum % 10)) % 10);
}

function generateProductBarcode(seed = Date.now()): string {
  const raw = `${Math.abs(seed)}${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`.replace(/\D/g, '');
  const first12 = (`20${raw}`).slice(0, 12).padEnd(12, '0');
  return `${first12}${ean13Checksum(first12)}`;
}

function generateProductSku(name = '', category = '', seed = Date.now()): string {
  const categoryPart = normalizeSkuPart(category, 'LOJA');
  const namePart = normalizeSkuPart(name, 'PROD');
  const suffix = Math.abs(seed).toString(36).toUpperCase().slice(-5).padStart(5, '0');
  return `${categoryPart}-${namePart}-${suffix}`;
}

function withAutomaticProductCodes(form: ProductFormState, force = false): ProductFormState {
  const seed = Date.now();
  return {
    ...form,
    internal_code: force || !form.internal_code.trim() ? generateProductSku(form.name, form.category, seed) : form.internal_code,
    barcode: force || !form.barcode.trim() ? generateProductBarcode(seed) : form.barcode,
  };
}

function freshProductForm(): ProductFormState {
  return withAutomaticProductCodes({ ...emptyProductForm }, true);
}

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

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Não foi possível ler a foto selecionada.'));
    reader.readAsDataURL(blob);
  });
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível abrir a foto. Tente outra imagem.'));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Não foi possível preparar a foto para salvar.'));
    }, type, quality);
  });
}

async function compressProductPhoto(file: File): Promise<{ dataUrl: string; originalBytes: number; outputBytes: number; compressed: boolean }> {
  if (file.size <= TARGET_PRODUCT_PHOTO_BYTES && file.type !== 'image/png') {
    const dataUrl = await blobToDataUrl(file);
    return { dataUrl, originalBytes: file.size, outputBytes: file.size, compressed: false };
  }

  const image = await loadImageFromFile(file);
  const sourceWidth = Math.max(1, image.naturalWidth || image.width);
  const sourceHeight = Math.max(1, image.naturalHeight || image.height);
  const scale = Math.min(1, PRODUCT_PHOTO_MAX_EDGE / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Este aparelho não conseguiu preparar a foto. Tente uma imagem menor.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  let bestBlob = await canvasToBlob(canvas, 'image/jpeg', 0.86);
  for (const quality of [0.78, 0.68, 0.58, 0.48]) {
    if (bestBlob.size <= TARGET_PRODUCT_PHOTO_BYTES) break;
    bestBlob = await canvasToBlob(canvas, 'image/jpeg', quality);
  }

  const dataUrl = await blobToDataUrl(bestBlob);
  return {
    dataUrl,
    originalBytes: file.size,
    outputBytes: bestBlob.size,
    compressed: bestBlob.size < file.size || scale < 1 || file.type === 'image/png',
  };
}

function fileSizeLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function productToForm(product: Product): ProductFormState {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    internal_code: product.internal_code,
    barcode: product.barcode || generateProductBarcode(),
    cost_price: product.cost_price ? String(product.cost_price) : '',
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
          <p>Informe custo e venda. Se deixar SKU ou barras em branco, o app gera sozinho.</p>
        </div>
      </div>

      <div className="mapp-form-grid">
        <div className="mapp-product-assist span-2">
          <div>
            <strong>Preenchimento rápido</strong>
            <p>Toque em um modelo para preencher categoria, tamanho e cor. Depois ajuste o que precisar.</p>
          </div>
          <div className="mapp-assist-chip-grid" aria-label="Modelos rápidos de produto">
            {PRODUCT_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => onChange({
                  ...form,
                  name: form.name.trim() ? form.name : preset.nameHint,
                  category: preset.category,
                  unit: form.unit.trim() || 'un',
                  size: form.size.trim() ? form.size : preset.size,
                  color: form.color.trim() ? form.color : preset.color,
                })}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <label className="span-2">
          <span>Nome do produto *</span>
          <input ref={nameInputRef} value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} placeholder="Ex.: Camiseta feminina preta M" />
        </label>
        <label>
          <span>Categoria</span>
          <select value={form.category} onChange={(event) => onChange({ ...form, category: event.target.value })}>
            <option value="">Escolha uma categoria</option>
            {PRODUCT_CATEGORY_OPTIONS.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
        <label>
          <span>SKU automático</span>
          <div className="mapp-input-with-action">
            <input value={form.internal_code} onChange={(event) => onChange({ ...form, internal_code: event.target.value.toUpperCase() })} placeholder="Gerado automaticamente" />
            <button type="button" onClick={() => onChange(withAutomaticProductCodes(form, true))}>Gerar</button>
          </div>
        </label>
        <label>
          <span>Preço de custo</span>
          <input inputMode="decimal" value={form.cost_price} onChange={(event) => onChange({ ...form, cost_price: event.target.value })} placeholder="0,00" />
        </label>
        <label>
          <span>Preço de venda *</span>
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
          <input value={form.size} onChange={(event) => onChange({ ...form, size: event.target.value })} placeholder="P, M, G, 4, 6..." />
        </label>
        <label>
          <span>Cor</span>
          <input value={form.color} onChange={(event) => onChange({ ...form, color: event.target.value })} placeholder="Preto, azul..." />
        </label>
        <div className="mapp-form-quick-picks span-2">
          <span>Tamanhos rápidos</span>
          <div>
            {PRODUCT_SIZE_OPTIONS.map((size) => (
              <button key={size} type="button" className={form.size === size ? 'active' : ''} onClick={() => onChange({ ...form, size })}>{size}</button>
            ))}
          </div>
        </div>
        <div className="mapp-form-quick-picks span-2">
          <span>Cores rápidas</span>
          <div>
            {PRODUCT_COLOR_OPTIONS.map((color) => (
              <button key={color} type="button" className={form.color === color ? 'active' : ''} onClick={() => onChange({ ...form, color })}>{color}</button>
            ))}
          </div>
        </div>
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
            <p>Dica: use foto clara, sem sombra, até 12 MB; o app reduz automaticamente para salvar rápido e entrar no backup quando possível.</p>
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
          <span>Código de barras automático</span>
          <div className="mapp-input-with-action">
            <input inputMode="numeric" value={form.barcode} onChange={(event) => onChange({ ...form, barcode: event.target.value.replace(/\D/g, '') })} placeholder="Gerado automaticamente" />
            <button type="button" onClick={() => onChange({ ...form, barcode: generateProductBarcode() })}>Gerar</button>
          </div>
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

function normalizeCriticalConfirmation(value: string): string {
  return String(value || '').replace(/\s+/g, '').toUpperCase();
}

export function ProductsScreen({ status, refreshToken, onRefresh }: ProductsCustomersScreenProps): JSX.Element {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ProductFilter>('todos');
  const [form, setForm] = useState<ProductFormState | null>(null);
  const [stockAdjust, setStockAdjust] = useState<{ product: Product; delta: string; reason: string } | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<{ product: Product; reason: string; confirmation: string } | null>(null);
  const [deleteProductFeedback, setDeleteProductFeedback] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingStock, setSavingStock] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [photoPreview, setPhotoPreview] = useState<{ src: string; title: string } | null>(null);
  const [visibleProductCount, setVisibleProductCount] = useState(CRUD_VISIBLE_BATCH);
  const [expandedProductIds, setExpandedProductIds] = useState<Record<string, boolean>>({});
  const productFormRef = useRef<HTMLElement>(null);
  const productNameInputRef = useRef<HTMLInputElement>(null);
  const stockAdjustRef = useRef<HTMLElement>(null);
  const stockAdjustInputRef = useRef<HTMLInputElement>(null);

  const lowLimit = status?.settings.low_stock_limit ?? 3;

  function toggleProductDetails(productId: string): void {
    setExpandedProductIds((current) => ({ ...current, [productId]: !current[productId] }));
  }

  function openProductForm(next: ProductFormState, feedbackText: string) {
    setStockAdjust(null);
    setDeleteProduct(null);
    setForm(next);
    setFeedback({ tone: 'info', text: feedbackText });
    scrollPanelIntoPage(productFormRef, productNameInputRef);
  }

  function startNewProduct() {
    openProductForm(freshProductForm(), 'Pronto para cadastrar um novo produto.');
  }

  const handleProductPhotoSelected = async (file: File) => {
    if (!form) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setFeedback({ tone: 'error', text: 'Escolha uma foto em PNG, JPG ou WEBP.' });
      return;
    }
    if (file.size > MAX_PRODUCT_PHOTO_SOURCE_BYTES) {
      setFeedback({ tone: 'error', text: 'Essa foto está grande demais para celular. Escolha uma imagem até 12 MB ou tire outra foto mais leve.' });
      return;
    }
    try {
      setFeedback({ tone: 'info', text: 'Preparando a foto para salvar sem pesar no celular...' });
      const prepared = await compressProductPhoto(file);
      setForm({ ...form, image_data: prepared.dataUrl });
      const sizeMessage = prepared.compressed
        ? `Foto reduzida de ${fileSizeLabel(prepared.originalBytes)} para ${fileSizeLabel(prepared.outputBytes)}. Salve o produto para enviar para a nuvem.`
        : `Foto carregada com ${fileSizeLabel(prepared.outputBytes)}. Salve o produto para enviar para a nuvem.`;
      setFeedback({ tone: 'info', text: sizeMessage });
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    }
  };

  function openStockAdjust(product: Product, delta = '+1', reason = 'Reposição rápida pelo celular') {
    setForm(null);
    setDeleteProduct(null);
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
        setForm(freshProductForm());
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
  const visibleProducts = useMemo(() => filtered.slice(0, query.trim() ? Math.min(visibleProductCount, SEARCH_RESULT_LIMIT) : visibleProductCount), [filtered, query, visibleProductCount]);

  useEffect(() => {
    setVisibleProductCount(CRUD_VISIBLE_BATCH);
  }, [filter, query]);

  const lowStock = products.filter((product) => product.status === 'ativo' && product.stock <= lowLimit).length;
  const zeroStock = products.filter((product) => product.status === 'ativo' && product.stock <= 0).length;
  const activeProducts = products.filter((product) => product.status === 'ativo').length;
  const inactiveProducts = products.filter((product) => product.status === 'inativo').length;
  const stockValue = products
    .filter((product) => product.status === 'ativo')
    .reduce((sum, product) => sum + product.stock * (product.promo_price ?? product.price), 0);
  const stockCostValue = products
    .filter((product) => product.status === 'ativo')
    .reduce((sum, product) => sum + product.stock * Number(product.cost_price || 0), 0);

  const saveProduct = async () => {
    if (!form) return;
    const name = form.name.trim();
    if (!name) {
      setFeedback({ tone: 'error', text: 'Informe o nome do produto antes de salvar.' });
      return;
    }
    setSaving(true);
    try {
      const prepared = withAutomaticProductCodes(form);
      const previousPhoto = form.id ? products.find((product) => product.id === form.id)?.image_data ?? '' : '';
      const requestedInlinePhoto = isProductPhotoData(prepared.image_data);
      const savedProduct = await api.saveProduct({
        id: prepared.id,
        name,
        category: prepared.category.trim(),
        internal_code: prepared.internal_code.trim(),
        barcode: prepared.barcode.trim(),
        cost_price: moneyToNumber(prepared.cost_price),
        price: moneyToNumber(prepared.price),
        promo_price: prepared.promo_price.trim() ? moneyToNumber(prepared.promo_price) : null,
        stock: intToNumber(prepared.stock),
        unit: prepared.unit.trim() || 'un',
        size: prepared.size.trim(),
        color: prepared.color.trim(),
        image_data: prepared.image_data.trim(),
        status: prepared.status,
      });
      const photoConfirmed = !requestedInlinePhoto || (savedProduct.image_data && savedProduct.image_data !== previousPhoto && !isProductPhotoData(savedProduct.image_data));
      const feedbackText = requestedInlinePhoto && !photoConfirmed
        ? 'Produto salvo. A foto não foi enviada agora; tente escolher a foto novamente quando a internet estiver estável.'
        : hasProductPhoto(form)
          ? 'Produto e foto salvos. A miniatura deve aparecer nos aparelhos sincronizados.'
          : (form.id ? 'Produto atualizado e sincronizado.' : 'Produto cadastrado e sincronizado.');
      setFeedback({ tone: requestedInlinePhoto && !photoConfirmed ? 'warning' : 'success', text: feedbackText });
      notifyMobileAction({ title: form.id ? 'Produto atualizado' : 'Produto cadastrado', message: `${name} está salvo e pronto para aparecer nos aparelhos sincronizados.`, tone: 'success', page: 'products', actionLabel: 'Ver produtos' });
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
    if (nextStatus === 'inativo') {
      const ok = window.confirm(`Inativar ${product.name}? Ele sai do PDV, mas o histórico de vendas continua guardado.`);
      if (!ok) return;
    }
    setSaving(true);
    try {
      if (nextStatus === 'inativo') {
        await api.inactivateProduct(product.id);
        setFeedback({ tone: 'success', text: 'Tudo certo: produto inativado. Ele saiu das vendas, mas continua no histórico.' });
        notifyMobileAction({ title: 'Produto inativado', message: `${product.name} saiu do PDV, com histórico preservado.`, tone: 'warning', page: 'products', actionLabel: 'Ver produtos' });
      } else {
        await api.saveProduct({ ...product, status: 'ativo' });
        setFeedback({ tone: 'success', text: 'Produto reativado e pronto para vender.' });
        notifyMobileAction({ title: 'Produto reativado', message: `${product.name} voltou para o PDV.`, tone: 'success', page: 'products', actionLabel: 'Ver produtos' });
      }
      await loadProducts();
      onRefresh();
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  };

  const openDeleteProduct = (product: Product) => {
    if (product.status !== 'inativo') {
      setFeedback({ tone: 'warning', text: 'Inative o produto antes de tentar excluir o cadastro.' });
      return;
    }
    setForm(null);
    setStockAdjust(null);
    setDeleteProduct({ product, reason: '', confirmation: '' });
    setDeleteProductFeedback({ tone: 'info', text: 'Informe o motivo e digite EXCLUIR. O botão mostrará qualquer bloqueio dentro deste painel.' });
    setFeedback(null);
  };

  const submitDeleteProduct = async () => {
    if (!deleteProduct || saving) return;
    const reason = deleteProduct.reason.trim();
    const confirmation = normalizeCriticalConfirmation(deleteProduct.confirmation);
    if (reason.length < 6) {
      setDeleteProductFeedback({ tone: 'error', text: 'Informe um motivo com pelo menos 6 letras. O produto ainda não foi excluído.' });
      return;
    }
    if (confirmation !== 'EXCLUIR') {
      setDeleteProductFeedback({ tone: 'error', text: 'Digite exatamente EXCLUIR. O produto ainda não foi excluído.' });
      return;
    }
    setDeleteProductFeedback({ tone: 'info', text: 'Verificando histórico e excluindo o cadastro. Aguarde...' });
    setSaving(true);
    try {
      const result = await api.deleteProductSafe(deleteProduct.product.id, reason);
      setDeleteProduct(null);
      setDeleteProductFeedback(null);
      setFeedback({ tone: 'success', text: result.message });
      notifyMobileAction({ title: 'Produto excluído', message: `${result.product_name} saiu das listas.`, tone: 'warning', page: 'products', actionLabel: 'Ver produtos' });
      await loadProducts();
      onRefresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setDeleteProductFeedback({ tone: 'error', text: message });
      setFeedback({ tone: 'error', text: message });
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
      setFeedback({ tone: 'success', text: `Tudo certo: estoque de ${stockAdjust.product.name} ajustado e sincronizado.` });
      notifyMobileAction({ title: 'Estoque atualizado', message: `${stockAdjust.product.name}: ajuste de ${Math.round(delta)} unidade(s) sincronizado.`, tone: delta < 0 ? 'warning' : 'success', page: 'products', actionLabel: 'Ver estoque' });
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
          <p>Produtos em cartões compactos. Toque em Detalhes para ver código, custo, foto e ações.</p>
        </div>
        <button type="button" onClick={startNewProduct}>Novo produto</button>
      </section>

      <section className="mapp-mini-stat-grid">
        <StatCard label="Produtos" value={formatNumber(products.length)} detail="no catálogo" icon="produtos" tone="sky" />
        <StatCard label="Ativos" value={formatNumber(activeProducts)} detail="prontos para venda" icon="loja_ativa" tone="green" />
        <StatCard label="Zerados" value={formatNumber(zeroStock)} detail={zeroStock ? 'sem estoque' : `${formatNumber(lowStock)} baixos`} icon="auditoria_logs" tone="orange" />
        <StatCard label="Venda em estoque" value={formatCurrency(stockValue)} detail={`Custo: ${formatCurrency(stockCostValue)}`} icon="caixa" tone="purple" />
      </section>

      {lowStock ? (
        <section className={`mapp-stock-alert ${zeroStock ? 'danger' : ''}`}>
          <span><InlineIcon name="auditoria_logs" size={24} /></span>
          <div>
            <strong>
              {zeroStock
                ? `${formatNumber(zeroStock)} produto(s) zerado(s)`
                : `${formatNumber(lowStock)} produto(s) com estoque baixo`}
            </strong>
            <p>{zeroStock ? 'Produto zerado fica em vermelho para repor antes de vender.' : 'Revise reposição antes de vender no PDV para evitar ruptura.'}</p>
          </div>
          <button type="button" onClick={() => setFilter('baixo')}>Ver baixo estoque</button>
        </section>
      ) : null}

      <section className="mapp-success-card mapp-products-help-card">
        <strong>Dica de estoque mínimo</strong>
        <span>Quando o estoque ficar em {formatNumber(lowLimit)} ou menos, o produto aparece em Atenção para reposição.</span>
      </section>

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
          {visibleProducts.map((product) => {
            const price = product.promo_price ?? product.price;
            const zero = product.status === 'ativo' && product.stock <= 0;
            const low = product.status === 'ativo' && product.stock <= lowLimit;
            const expanded = expandedProductIds[product.id] ?? false;
            return (
              <article key={product.id} className={`mapp-crud-card ${expanded ? 'is-expanded' : 'is-compact'} ${product.status === 'inativo' ? 'is-inactive' : ''} ${zero ? 'is-zero-stock' : ''}`}>
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
                  <span className={`mapp-crud-icon ${zero || low ? 'tone-orange' : 'tone-sky'}`}><InlineIcon name="produtos" size={24} /></span>
                )}
                <div className="mapp-crud-main">
                  <div className="mapp-crud-title-row">
                    <strong>{product.name}</strong>
                    <em className={zero ? 'danger' : low ? 'warn' : 'ok'}>{zero ? 'Zerado' : low ? 'Estoque baixo' : product.status}</em>
                  </div>
                  <p>{product.category || 'Sem categoria'} · Estoque {formatNumber(product.stock)} {product.unit || 'un'}</p>
                  {expanded ? (
                    <div className="mapp-crud-meta">
                      <span>{product.internal_code || 'Sem código'}</span>
                      <span>{product.barcode || 'Sem código de barras'}</span>
                      <span>Custo {formatCurrency(product.cost_price || 0)}</span>
                      <span>{productPhotoLabel(product.image_data)}</span>
                    </div>
                  ) : <small className="mapp-compact-hint">Toque em detalhes para ver código, custo, foto e ações.</small>}
                </div>
                <div className="mapp-crud-side">
                  <strong>{formatCurrency(price)}</strong>
                  <div className="mapp-product-actions">
                    <button type="button" onClick={() => toggleProductDetails(product.id)}>{expanded ? 'Recolher' : 'Detalhes'}</button>
                    {expanded ? (
                      <>
                        <button type="button" onClick={() => openProductForm(productToForm(product), `Editando ${product.name}.`)}>Editar</button>
                        <button type="button" onClick={() => openStockAdjust(product)}>Estoque</button>
                        <button type="button" onClick={() => void changeProductStatus(product, product.status === 'ativo' ? 'inativo' : 'ativo')} disabled={saving}>
                          {product.status === 'ativo' ? 'Inativar' : 'Ativar'}
                        </button>
                        {product.status === 'inativo' ? <button type="button" className="mapp-danger-button" onClick={() => openDeleteProduct(product)} disabled={saving}>Excluir cadastro</button> : null}
                      </>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
          {visibleProducts.length < filtered.length ? (
            <button type="button" className="mapp-secondary-button mapp-list-more-button" onClick={() => setVisibleProductCount((count) => count + LOAD_MORE_STEP)}>
              Mostrar mais produtos ({formatNumber(visibleProducts.length)} de {formatNumber(filtered.length)})
            </button>
          ) : null}
        </section>
      ) : !loading ? (
        <EmptyState icon="produtos" title="Nenhum produto encontrado" detail={query ? 'Tente buscar por outro nome, código ou categoria.' : 'Cadastre o primeiro produto para começar a vender.'} actionLabel="Novo produto" actionPage="products" onNavigate={startNewProduct} />
      ) : null}

      {deleteProduct ? (
        <div className="mapp-credit-receive-backdrop" role="presentation" onClick={() => { if (!saving) { setDeleteProduct(null); setDeleteProductFeedback(null); } }}>
          <form className="mapp-form-panel mapp-receive-panel mapp-receive-drawer mapp-delete-product-panel mapp-critical-dialog" role="dialog" aria-modal="true" aria-label="Excluir cadastro do produto" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); void submitDeleteProduct(); }}>
            <span className="mapp-receive-drawer-grip" aria-hidden="true" />
            <div className="mapp-form-head">
              <span className="mapp-form-icon tone-orange"><InlineIcon name="excluir" size={24} /></span>
              <div><strong>Excluir cadastro do produto</strong><p>{deleteProduct.product.name}</p></div>
            </div>
            <section className="mapp-credit-cancel-warning">
              <strong>Proteção de histórico</strong>
              <p>A exclusão só será permitida se o produto nunca apareceu em venda, pedido ou movimento de estoque. Se houver histórico, use Inativar.</p>
            </section>
            <div className="mapp-form-grid">
              <label className="span-2"><span>Motivo obrigatório</span><textarea value={deleteProduct.reason} onChange={(event) => { setDeleteProduct({ ...deleteProduct, reason: event.target.value }); setDeleteProductFeedback(null); }} rows={2} placeholder="Ex.: cadastro duplicado criado por engano" /></label>
              <label className="span-2"><span>Digite EXCLUIR para confirmar</span><input value={deleteProduct.confirmation} onChange={(event) => { setDeleteProduct({ ...deleteProduct, confirmation: event.target.value }); setDeleteProductFeedback(null); }} autoComplete="off" autoCapitalize="characters" autoCorrect="off" enterKeyHint="done" spellCheck={false} /></label>
            </div>
            <div className="mapp-form-actions mapp-critical-dialog-actions">
              {deleteProductFeedback ? (
                <div className={`mapp-critical-inline-feedback ${deleteProductFeedback.tone}`} role={deleteProductFeedback.tone === 'error' ? 'alert' : 'status'} aria-live="assertive">
                  {deleteProductFeedback.text}
                </div>
              ) : null}
              <button type="button" className="mapp-secondary-button" onClick={() => { setDeleteProduct(null); setDeleteProductFeedback(null); }} disabled={saving}>Voltar</button>
              <button type="submit" className="mapp-danger-button" disabled={saving}>{saving ? 'Excluindo...' : 'Excluir cadastro'}</button>
            </div>
          </form>
        </div>
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
  const [visibleCustomerCount, setVisibleCustomerCount] = useState(CRUD_VISIBLE_BATCH);
  const [expandedCustomerIds, setExpandedCustomerIds] = useState<Record<string, boolean>>({});
  const customerFormRef = useRef<HTMLElement>(null);
  const customerNameInputRef = useRef<HTMLInputElement>(null);

  function toggleCustomerDetails(customerId: string): void {
    setExpandedCustomerIds((current) => ({ ...current, [customerId]: !current[customerId] }));
  }

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
  const visibleCustomers = useMemo(() => filtered.slice(0, query.trim() ? Math.min(visibleCustomerCount, SEARCH_RESULT_LIMIT) : visibleCustomerCount), [filtered, query, visibleCustomerCount]);

  useEffect(() => {
    setVisibleCustomerCount(CRUD_VISIBLE_BATCH);
  }, [filter, query]);

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
      notifyMobileAction({ title: form.id ? 'Cliente atualizado' : 'Cliente cadastrado', message: `${name} está salvo e disponível para vendas/crediário.`, tone: 'success', page: 'customers', actionLabel: 'Ver clientes' });
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
    if (nextStatus === 'inativo') {
      const ok = window.confirm(`Inativar ${customer.name}? O cliente sai das listas principais, mas vendas e crediário continuam preservados.`);
      if (!ok) return;
    }
    setSaving(true);
    try {
      if (nextStatus === 'inativo') {
        await api.inactivateCustomer(customer.id);
        setFeedback({ tone: 'success', text: 'Tudo certo: cliente inativado. O histórico permanece preservado.' });
        notifyMobileAction({ title: 'Cliente inativado', message: `${customer.name} saiu das listas principais, com histórico preservado.`, tone: 'warning', page: 'customers', actionLabel: 'Ver clientes' });
      } else {
        await api.saveCustomer({ ...customer, status: 'ativo' });
        setFeedback({ tone: 'success', text: 'Cliente reativado e disponível para vendas.' });
        notifyMobileAction({ title: 'Cliente reativado', message: `${customer.name} voltou para vendas e crediário.`, tone: 'success', page: 'customers', actionLabel: 'Ver clientes' });
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

  const openCustomerWhatsapp = async (customer: Customer) => {
    const phone = (customer.whatsapp || customer.phone).replace(/\D/g, '');
    if (!phone) return;
    const safePhone = phone.startsWith('55') ? phone : `55${phone}`;
    await api.openExternalUrl(`https://wa.me/${safePhone}`);
    setFeedback({ tone: 'success', text: 'WhatsApp aberto para este cliente.' });
  };

  return (
    <div className="mapp-screen mapp-crud-screen mapp-customers-screen">
      <section className="mapp-panel mapp-action-panel mapp-crud-hero">
        <span className="mapp-panel-icon tone-purple"><InlineIcon name="clientes" size={24} /></span>
        <div>
          <strong>Clientes organizados</strong>
          <p>Clientes em cartões compactos. Toque em Detalhes para abrir endereço, limite, WhatsApp e ações.</p>
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
          {visibleCustomers.map((customer) => {
            const expanded = expandedCustomerIds[customer.id] ?? false;
            return (
            <article key={customer.id} className={`mapp-crud-card ${expanded ? 'is-expanded' : 'is-compact'} ${customer.status === 'inativo' ? 'is-inactive' : ''}`}>
              <span className="mapp-crud-icon tone-purple"><InlineIcon name="clientes" size={24} /></span>
              <div className="mapp-crud-main">
                <div className="mapp-crud-title-row">
                  <strong>{customer.name}</strong>
                  <em className={customer.status === 'ativo' ? 'ok' : 'warn'}>{customer.status}</em>
                </div>
                <p>{customer.phone || customer.whatsapp || 'Sem telefone'} · {customer.address || 'Sem endereço'}</p>
                {expanded ? (
                  <div className="mapp-crud-meta">
                    <span>WhatsApp: {customer.whatsapp || 'não informado'}</span>
                    <span>Limite: {formatCurrency(customer.credit_limit)}</span>
                    <span>{customer.notes || 'Sem observações'}</span>
                  </div>
                ) : <small className="mapp-compact-hint">Toque em detalhes para ver endereço, limite, WhatsApp e ações.</small>}
              </div>
              <div className="mapp-crud-side">
                <strong>{customer.credit_limit ? formatCurrency(customer.credit_limit) : 'Sem limite'}</strong>
                <div className="mapp-product-actions mapp-customer-actions">
                  <button type="button" onClick={() => toggleCustomerDetails(customer.id)}>{expanded ? 'Recolher' : 'Detalhes'}</button>
                  {expanded ? (
                    <>
                      <button type="button" onClick={() => openCustomerForm(customerToForm(customer), `Editando ${customer.name}.`)}>Editar</button>
                      {customer.whatsapp || customer.phone ? <button type="button" onClick={() => void openCustomerWhatsapp(customer)}>WhatsApp</button> : null}
                      <button type="button" onClick={() => void copyCustomerContact(customer)}>Copiar</button>
                      <button type="button" onClick={() => void changeCustomerStatus(customer, customer.status === 'ativo' ? 'inativo' : 'ativo')} disabled={saving}>
                        {customer.status === 'ativo' ? 'Inativar' : 'Ativar'}
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </article>
            );
          })}
          {visibleCustomers.length < filtered.length ? (
            <button type="button" className="mapp-secondary-button mapp-list-more-button" onClick={() => setVisibleCustomerCount((count) => count + LOAD_MORE_STEP)}>
              Mostrar mais clientes ({formatNumber(visibleCustomers.length)} de {formatNumber(filtered.length)})
            </button>
          ) : null}
        </section>
      ) : !loading ? (
        <EmptyState icon="clientes" title="Nenhum cliente encontrado" detail={query ? 'Tente buscar por outro nome ou telefone.' : 'Cadastre o primeiro cliente para vender e acompanhar crediário.'} actionLabel="Novo cliente" actionPage="customers" onNavigate={startNewCustomer} />
      ) : null}
    </div>
  );
}
