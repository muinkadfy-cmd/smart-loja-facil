import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { AppIcon } from '../components/AppIcon';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { TableFilters } from '../components/TableFilters';
import { api } from '../lib/api';
import { matchesFilterQuery } from '../lib/filter';
import { money } from '../lib/format';
import { whatsappChatUrl, whatsappWebUrl } from '../lib/links';
import { describeProductPhotoStorage, isCloudProductImageValue, isInlineProductImageData } from '../lib/productPhotoStorage';
import { useWebPermissions } from '../lib/useWebPermissions';
import type { Customer, Product } from '../types';

interface PageProps { refreshToken: number; onChanged: () => void; }
interface ProductForm {
  id: string;
  name: string;
  category: string;
  price: number;
  promo_price: number | null;
  stock: number;
  unit: string;
  size: string;
  color: string;
  internal_code: string;
  barcode: string;
  image_data: string;
  status: Product['status'];
}

const presetCategories = [
  'Roupas',
  'Calçados',
  'Acessórios',
  'Presentes',
  'Infantil',
  'Feminino',
  'Masculino',
  'Moda íntima',
  'Beleza',
  'Utilidades',
];

const emptyProduct: ProductForm = {
  id: '',
  name: '',
  category: presetCategories[0],
  price: 0,
  promo_price: null,
  stock: 0,
  unit: 'un',
  size: '',
  color: '',
  internal_code: '',
  barcode: '',
  image_data: '',
  status: 'ativo',
};

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Não foi possível ler a foto selecionada.'));
    reader.readAsDataURL(file);
  });
}

async function copyTextToClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  }
}

function productDisplayPrice(product: Product): string {
  return money(product.promo_price ?? product.price);
}

function productDetailLines(product: Product): string[] {
  const lines = [
    `Produto: ${product.name}`,
    `Categoria: ${product.category || '-'}`,
    `Preço: ${productDisplayPrice(product)}`,
  ];
  if (product.promo_price && product.promo_price < product.price) {
    lines.push(`Preço original: ${money(product.price)}`);
  }
  if (product.color) lines.push(`Cor: ${product.color}`);
  if (product.size) lines.push(`Tamanho: ${product.size}`);
  if (product.stock > 0) lines.push('Estoque: disponível');
  if (product.internal_code) lines.push(`Código: ${product.internal_code}`);
  if (product.barcode) lines.push(`Código de barras: ${product.barcode}`);
  return lines;
}

function productWhatsappText(product: Product): string {
  return [
    'Olá! Segue a descrição completa do produto:',
    '',
    ...productDetailLines(product),
    '',
    'Para comprar ou reservar, me chame por aqui.',
  ].join('\n');
}

function productCopyText(product: Product): string {
  return productDetailLines(product).join('\n');
}

function normalizeWhatsapp(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55')) return digits;
  return `55${digits}`;
}

function customerContact(customer: Customer | undefined): string {
  return customer?.whatsapp || customer?.phone || '';
}

function customerLabel(customer: Customer): string {
  const contact = customerContact(customer);
  return contact ? `${customer.name} - ${contact}` : `${customer.name} - sem WhatsApp`;
}

function safePhotoFileName(product: Product): string {
  const base = (product.name || product.internal_code || 'produto')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'produto';
  const extension = product.image_data.startsWith('data:image/webp') ? 'webp' : product.image_data.startsWith('data:image/png') ? 'png' : 'jpg';
  return `${base}.${extension}`;
}

export function ProductsPage({ refreshToken, onChanged }: PageProps): JSX.Element {
  const [rows, setRows] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [categoryFilter, setCategoryFilter] = useState('todas');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>({ ...emptyProduct });
  const [saving, setSaving] = useState(false);
  const [adjust, setAdjust] = useState({ productId: '', delta: 0, reason: '' });
  const [preview, setPreview] = useState<{ src: string; title: string } | null>(null);
  const [details, setDetails] = useState<Product | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const permissions = useWebPermissions(refreshToken);
  const canEdit = permissions.canOperate;

  useEffect(() => {
    Promise.all([api.products(), api.customers()])
      .then(([products, customerRows]) => {
        setRows(products);
        setCustomers(customerRows.filter((customer) => customer.status === 'ativo'));
      })
      .catch(() => undefined);
  }, [refreshToken]);

  const categoryOptions = useMemo(() => (
    ['todas', ...Array.from(new Set(rows.map((row) => row.category).filter(Boolean))).sort((a, b) => a.localeCompare(b))]
  ), [rows]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    const matchesStatus = statusFilter === 'todos' || row.status === statusFilter;
    const matchesCategory = categoryFilter === 'todas' || row.category === categoryFilter;
    const matchesQuery = matchesFilterQuery(query, [
      row.name,
      row.category,
      row.internal_code,
      row.barcode,
      row.color,
      row.size,
      row.unit,
      row.price,
      row.promo_price,
      row.stock,
      row.status,
    ]);
    return matchesStatus && matchesCategory && matchesQuery;
  }), [categoryFilter, query, rows, statusFilter]);

  const selectedProduct = useMemo(
    () => rows.find((row) => row.id === selectedProductId) ?? null,
    [rows, selectedProductId],
  );

  const summary = useMemo(() => {
    const active = rows.filter((row) => row.status === 'ativo');
    const low = active.filter((row) => row.stock <= 5);
    const totalStock = active.reduce((sum, row) => sum + row.stock, 0);
    const totalValue = active.reduce((sum, row) => sum + (row.promo_price ?? row.price) * row.stock, 0);
    return {
      totalProducts: rows.length,
      activeProducts: active.length,
      totalStock,
      lowStock: low.length,
      totalValue,
    };
  }, [rows]);

  async function reload() {
    setRows(await api.products());
    onChanged();
  }

  function resetForm() {
    setForm({ ...emptyProduct });
  }

  function editProduct(product: Product) {
    setError('');
    setMessage('');
    setSelectedProductId(product.id);
    setForm({
      id: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
      promo_price: product.promo_price,
      stock: product.stock,
      unit: product.unit,
      size: product.size,
      color: product.color,
      internal_code: product.internal_code,
      barcode: product.barcode,
      image_data: product.image_data,
      status: product.status,
    });
  }

  async function onImageSelected(event: ChangeEvent<HTMLInputElement>) {
    if (!canEdit) {
      event.target.value = '';
      setMessage('');
      setError(permissions.readonlyMessage || 'Você não tem permissão para alterar foto de produto.');
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Selecione um arquivo de imagem válido.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('A foto precisa ter no máximo 2 MB.');
      return;
    }
    setError('');
    const imageData = await fileToDataUrl(file);
    setForm((current) => ({ ...current, image_data: imageData }));
    setMessage('Foto pronta. Ao salvar o produto, o sistema tenta enviar para a nuvem e mantém fallback seguro se o Storage ainda não estiver configurado.');
    event.target.value = '';
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) return;
    if (!canEdit) {
      setMessage('');
      setError(permissions.readonlyMessage || 'Você não tem permissão para salvar produtos.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const hadInlinePhoto = isInlineProductImageData(form.image_data);
      const savedProduct = await api.saveProduct(form as Partial<Product>);
      const editing = Boolean(form.id);
      resetForm();
      await reload();
      if (hadInlinePhoto && isCloudProductImageValue(savedProduct.image_data)) {
        setMessage(editing ? 'Produto atualizado e foto enviada para a nuvem.' : 'Produto salvo e foto enviada para a nuvem.');
      } else if (hadInlinePhoto && isInlineProductImageData(savedProduct.image_data)) {
        setMessage('Produto salvo. A foto ficou em modo compatibilidade porque o Storage ainda não confirmou envio; configure o bucket product-photos para sincronizar fotos entre aparelhos.');
      } else {
        setMessage(editing ? 'Produto atualizado com sucesso.' : 'Produto salvo com código interno automático.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function inactivateProduct(product: Product) {
    if (!canEdit) {
      setMessage('');
      setError(permissions.readonlyMessage || 'Você não tem permissão para excluir/inativar produtos.');
      return;
    }
    if (!confirm(`Inativar o produto ${product.name}?`)) return;
    setError('');
    setMessage('');
    try {
      await api.inactivateProduct(product.id);
      if (form.id === product.id) resetForm();
      if (selectedProductId === product.id) setSelectedProductId(null);
      await reload();
      setMessage('Produto inativado.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function copyProductText(product: Product, mode: 'all' | 'price' | 'color' = 'all') {
    const text = mode === 'price'
      ? `Preço de ${product.name}: ${productDisplayPrice(product)}`
      : mode === 'color'
        ? [
            product.color ? `Cor: ${product.color}` : '',
            product.size ? `Tamanho: ${product.size}` : '',
            product.internal_code ? `Código: ${product.internal_code}` : '',
          ].filter(Boolean).join('\n') || 'Produto sem cor, tamanho ou código cadastrado.'
        : productCopyText(product);
    const copied = await copyTextToClipboard(text);
    setError('');
    setMessage(copied ? 'Informação copiada para colar no WhatsApp ou mensagem.' : 'Não foi possível copiar automaticamente.');
  }

  async function shareProduct(product: Product) {
    setMessage('');
    const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId);
    if (!selectedCustomer) {
      setDetails(product);
      setError('Selecione um cliente com WhatsApp/telefone cadastrado antes de enviar.');
      return;
    }
    const whatsapp = normalizeWhatsapp(customerContact(selectedCustomer));
    if (!whatsapp) {
      setError('Esse cliente não tem WhatsApp/telefone cadastrado. Cadastre o número antes de enviar.');
      return;
    }
    setError('');
    const fullText = productWhatsappText(product);
    await copyTextToClipboard(fullText);
    try {
      await api.openExternalUrl(whatsappChatUrl(whatsapp, fullText));
      setMessage(`WhatsApp aberto direto para ${selectedCustomer.name}. Confirme que esse número existe no WhatsApp antes de enviar.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function openWhatsappOnly() {
    setError('');
    setMessage('');
    try {
      await api.openExternalUrl(whatsappWebUrl());
      setMessage('WhatsApp Web aberto. Escolha a conversa para anexar a foto manualmente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function saveProductPhoto(product: Product, openAfter = true): Promise<string | null> {
    if (!product.image_data) {
      setError('Esse produto não tem foto cadastrada.');
      setMessage('');
      return null;
    }
    setError('');
    try {
      const path = await api.saveProductImage(product.image_data, product.name || product.internal_code || safePhotoFileName(product), openAfter);
      setMessage('Foto salva em arquivo local. A pasta foi aberta para você anexar no WhatsApp.');
      return path;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setMessage('');
      return null;
    }
  }

  async function sendPhotoSeparately(product: Product) {
    const path = await saveProductPhoto(product, true);
    if (!path) return;
    const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId);
    const whatsapp = selectedCustomer ? normalizeWhatsapp(customerContact(selectedCustomer)) : '';
    try {
      if (whatsapp) {
        await api.openExternalUrl(whatsappWebUrl(whatsapp));
        setMessage(`Foto salva e WhatsApp aberto direto para ${selectedCustomer?.name}. Anexe a foto que ficou selecionada na pasta.`);
      } else {
        await api.openExternalUrl(whatsappWebUrl());
        setMessage('Foto salva e WhatsApp Web aberto. Escolha a conversa e anexe a foto selecionada na pasta.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function adjustStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adjust.productId || !adjust.reason.trim() || adjust.delta === 0) return;
    if (!canEdit) {
      setMessage('');
      setError(permissions.readonlyMessage || 'Você não tem permissão para ajustar estoque.');
      return;
    }
    setError('');
    setMessage('');
    try {
      await api.adjustStock(adjust.productId, adjust.delta, adjust.reason);
      setAdjust({ productId: '', delta: 0, reason: '' });
      setMessage('Estoque ajustado com sucesso.');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="stack classic-products-stack products-clean-v62 products-final-v63 products-premium-v87">
      <TableFilters
        query={query}
        onQueryChange={setQuery}
        queryPlaceholder="Buscar por produto, código, categoria, cor ou tamanho"
        summary={`${filteredRows.length} de ${rows.length} produtos visíveis`}
        selects={[
          {
            label: 'Categoria',
            value: categoryFilter,
            onChange: setCategoryFilter,
            options: categoryOptions.map((option) => ({
              value: option,
              label: option === 'todas' ? 'Todas' : option,
            })),
          },
          {
            label: 'Status',
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: 'todos', label: 'Todos' },
              { value: 'ativo', label: 'Ativo' },
              { value: 'inativo', label: 'Inativo' },
            ],
          },
        ]}
      />

      <div className="products-clean-guide-v62" role="note">
        <span><AppIcon name="produtos" size={24} className="app-icon-button-inline" /></span>
        <div>
          <strong>Catálogo organizado</strong>
          <small>1. Busque ou filtre · 2. Selecione o produto · 3. Use ações, cadastro ou ajuste de estoque.</small>
        </div>
      </div>

      <section className="stats-grid classic-stats-grid">
        <div className="stat-card tone-yellow"><div className="stat-icon"><AppIcon name="produtos" size={48} className="app-icon-stat" /></div><div><span className="muted micro-label">Total de Produtos</span><strong>{summary.totalProducts}</strong><small>produtos cadastrados</small></div></div>
        <div className="stat-card tone-green"><div className="stat-icon"><AppIcon name="categorias" size={48} className="app-icon-stat" /></div><div><span className="muted micro-label">Ativos</span><strong>{summary.activeProducts}</strong><small>produtos ativos</small></div></div>
        <div className="stat-card tone-purple"><div className="stat-icon"><AppIcon name="manutencao_ajuste" size={48} className="app-icon-stat" /></div><div><span className="muted micro-label">Estoque Total</span><strong>{summary.totalStock}</strong><small>unidades em estoque</small></div></div>
        <div className="stat-card tone-red"><div className="stat-icon"><AppIcon name="estoque_baixo" size={48} className="app-icon-stat" /></div><div><span className="muted micro-label">Estoque Baixo</span><strong>{summary.lowStock}</strong><small>produtos críticos</small></div></div>
        <div className="stat-card tone-blue"><div className="stat-icon"><AppIcon name="arquivo_banco_sqlite" size={48} className="app-icon-stat" /></div><div><span className="muted micro-label">Valor Estoque</span><strong>{money(summary.totalValue)}</strong><small>valor de venda total</small></div></div>
      </section>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="notice">{message}</div>}
      {!canEdit && permissions.isWeb ? <div className="web-readonly-module-note"><strong>{permissions.roleLabel}</strong><span>{permissions.readonlyMessage}</span></div> : null}

      <section className="classic-products-layout">
        <article className="panel classic-panel">
          <div className="classic-panel-header">
            <h2>Lista de produtos</h2>
            <div className="classic-table-actions">
              <button type="button" className="secondary-btn" onClick={() => { resetForm(); setSelectedProductId(null); }} disabled={!canEdit}><AppIcon name="produtos" size={16} className="app-icon-button-inline" />Novo Produto</button>
              <button type="button" className="ghost-btn" onClick={() => selectedProduct && editProduct(selectedProduct)} disabled={!selectedProduct}><AppIcon name="editar" size={16} className="app-icon-button-inline" />Editar</button>
              <button type="button" className="ghost-btn" onClick={() => selectedProduct && void inactivateProduct(selectedProduct)} disabled={!selectedProduct || !canEdit}><AppIcon name="excluir" size={16} className="app-icon-button-inline" />Excluir</button>
              <button type="button" className="ghost-btn" onClick={() => void reload()}><AppIcon name="atualizar" size={16} className="app-icon-button-inline" />Atualizar</button>
            </div>
          </div>

          <DataTable<Product>
            rows={filteredRows}
            empty="Nenhum produto cadastrado. Cadastre o primeiro produto para começar o catálogo."
            getRowKey={(row) => row.id}
            selectedRowKey={selectedProductId}
            onRowClick={(row) => setSelectedProductId(row.id)}
            columns={[
              { key: 'code', label: 'Código', render: (row) => row.internal_code || row.barcode || '-' },
              { key: 'name', label: 'Nome do Produto', render: (row) => row.name },
              { key: 'category', label: 'Categoria', render: (row) => row.category || '-' },
              { key: 'stock', label: 'Estoque', align: 'right', render: (row) => row.stock },
              { key: 'price', label: 'Preço Venda', align: 'right', render: (row) => money(row.promo_price ?? row.price) },
              { key: 'status', label: 'Status', render: (row) => <span className={row.stock <= 5 ? 'classic-low-stock' : 'classic-ok-stock'}>{row.stock <= 5 ? 'Estoque Baixo' : row.status}</span> },
            ]}
          />

          <div className="classic-table-footer">
            <span>Página: 1</span>
            <span>Exibindo {filteredRows.length} de {rows.length} registros</span>
          </div>
        </article>

        <aside className="panel classic-panel classic-action-sidebar">
          <div className="classic-panel-header">
            <h2>Ações</h2>
          </div>
          <div className="classic-action-grid">
            <button type="button" onClick={() => { resetForm(); setSelectedProductId(null); }} disabled={!canEdit}><AppIcon name="produtos" size={24} className="app-icon-button-inline" />Novo Produto</button>
            <button type="button" onClick={() => selectedProduct && setAdjust((current) => ({ ...current, productId: selectedProduct.id }))} disabled={!selectedProduct || !canEdit}><AppIcon name="manutencao_ajuste" size={24} className="app-icon-button-inline" />Ajustar Estoque</button>
            <button type="button" onClick={() => selectedProduct && setDetails(selectedProduct)} disabled={!selectedProduct}><AppIcon name="buscar" size={24} className="app-icon-button-inline" />Abrir Produto</button>
            <button type="button" onClick={() => selectedProduct && void saveProductPhoto(selectedProduct, true)} disabled={!selectedProduct || !selectedProduct.image_data}><AppIcon name="imprimir" size={24} className="app-icon-button-inline" />Salvar Foto</button>
            <button type="button" onClick={() => selectedProduct && void shareProduct(selectedProduct)} disabled={!selectedProduct}><AppIcon name="whatsapp" size={24} className="app-icon-button-inline" />Enviar WhatsApp</button>
            <button type="button" onClick={() => void openWhatsappOnly()}><AppIcon name="whatsapp" size={24} className="app-icon-button-inline" />WhatsApp Web</button>
            <button type="button" onClick={() => void reload()}><AppIcon name="relatorios" size={24} className="app-icon-button-inline" />Relatório de Produtos</button>
          </div>
        </aside>
      </section>

      <section className="classic-products-bottom">
        <section className="panel classic-panel form-panel">
          <div className="classic-panel-header">
            <h2>Cadastro e edição</h2>
          </div>
          <form onSubmit={submit} className="product-form-grid">
            <div className="product-photo-card">
              <div className="product-photo-frame">
                {form.image_data ? <img src={form.image_data} alt="Prévia do produto" className="product-photo-preview" /> : <div className="product-photo-empty"><strong>Sem foto</strong><span>PNG, JPG ou WEBP até 2 MB</span></div>}
              </div>
              <label className="photo-upload-btn">
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onImageSelected} disabled={!canEdit} />
                Escolher foto
              </label>
              {form.image_data ? <div className="product-photo-sync-note"><AppIcon name="backup" size={16} className="app-icon-chip" /><span>{describeProductPhotoStorage(form.image_data)}</span></div> : null}
              {form.image_data && canEdit && <button type="button" className="ghost-btn" onClick={() => setForm((current) => ({ ...current, image_data: '' }))}>Remover foto</button>}
            </div>

            <div className="form-grid compact product-form-fields">
              <label>Produto<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required readOnly={!canEdit} /></label>
              <label>
                Categoria
                <input list="product-categories" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} readOnly={!canEdit} />
                <datalist id="product-categories">
                  {presetCategories.map((category) => <option key={category} value={category} />)}
                </datalist>
              </label>
              <label>Preço<input type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} readOnly={!canEdit} /></label>
              <label>Preço promocional<input type="number" min="0" step="0.01" value={form.promo_price ?? ''} onChange={(event) => setForm({ ...form, promo_price: event.target.value === '' ? null : Number(event.target.value) })} readOnly={!canEdit} /></label>
              <label>Estoque<input type="number" step="1" value={form.stock} onChange={(event) => setForm({ ...form, stock: Number(event.target.value) })} readOnly={!canEdit} /></label>
              <label>Unidade<input value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} readOnly={!canEdit} /></label>
              <label>Tamanho<input value={form.size} onChange={(event) => setForm({ ...form, size: event.target.value })} readOnly={!canEdit} /></label>
              <label>Cor<input value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} readOnly={!canEdit} /></label>
              <label>Código interno<input value={form.internal_code} readOnly placeholder="Gerado automaticamente ao salvar" /></label>
              <label>Código de barras<input value={form.barcode} onChange={(event) => setForm({ ...form, barcode: event.target.value })} readOnly={!canEdit} /></label>
              <label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Product['status'] })} disabled={!canEdit}><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select></label>
              <div className="table-actions">
                <button className="primary-btn" disabled={saving || !canEdit}>{saving ? 'Salvando...' : canEdit ? (form.id ? 'Salvar alterações' : 'Cadastrar produto') : 'Somente leitura'}</button>
                {form.id && <button type="button" className="ghost-btn" onClick={resetForm}>Cancelar edição</button>}
              </div>
            </div>
          </form>
        </section>

        <section className="panel classic-panel form-panel">
          <div className="classic-panel-header">
            <h2>Ajuste de estoque</h2>
          </div>
          <form onSubmit={adjustStock} className="form-grid compact adjust-grid">
            <label>Produto<select value={adjust.productId} onChange={(event) => setAdjust({ ...adjust, productId: event.target.value })} disabled={!canEdit}><option value="">Selecione</option>{rows.map((row) => <option key={row.id} value={row.id}>{row.name} {row.status === 'inativo' ? '(inativo)' : ''}</option>)}</select></label>
            <label>Quantidade (+/-)<input type="number" step="1" value={adjust.delta} onChange={(event) => setAdjust({ ...adjust, delta: Number(event.target.value) })} readOnly={!canEdit} /></label>
            <label className="span-2">Motivo obrigatório<input value={adjust.reason} onChange={(event) => setAdjust({ ...adjust, reason: event.target.value })} placeholder="Ex: contagem manual, perda ou entrada de mercadoria" readOnly={!canEdit} /></label>
            <button className="secondary-btn" disabled={!canEdit}>Ajustar estoque</button>
          </form>
        </section>
      </section>

      <Modal open={Boolean(details)} title={details ? `Produto - ${details.name}` : 'Produto'} onClose={() => setDetails(null)}>
        {details && (
          <div className="product-detail-modal">
            <div className="product-detail-photo">
              {details.image_data
                ? <button type="button" className="product-detail-photo-btn" onClick={() => setPreview({ src: details.image_data, title: details.name })}><img src={details.image_data} alt={details.name} /></button>
                : <div className="product-photo-empty"><strong>Sem foto</strong><span>Foto local apenas para visualização do produto.</span></div>}
              {details.image_data ? <small className="product-photo-cloud-status">{describeProductPhotoStorage(details.image_data)}</small> : null}
            </div>
            <div className="product-detail-info">
              <div className="product-detail-title">
                <small>Descrição para copiar</small>
                <strong>{details.name}</strong>
                <span>{details.category || 'Sem categoria'} - {productDisplayPrice(details)}</span>
              </div>
              <div className="product-detail-grid">
                <div><span>Preço</span><strong>{productDisplayPrice(details)}</strong></div>
                {details.promo_price && details.promo_price < details.price && <div><span>Preço original</span><strong>{money(details.price)}</strong></div>}
                {details.color && <div><span>Cor</span><strong>{details.color}</strong></div>}
                {details.size && <div><span>Tamanho</span><strong>{details.size}</strong></div>}
                <div><span>Estoque</span><strong>{details.stock}</strong></div>
                {(details.internal_code || details.barcode) && <div><span>Código</span><strong>{details.internal_code || details.barcode}</strong></div>}
              </div>
              <label className="product-whatsapp-customer">
                Cliente para WhatsApp direto
                <select value={selectedCustomerId} onChange={(event) => setSelectedCustomerId(event.target.value)}>
                  <option value="">Selecione um cliente com WhatsApp</option>
                  {customers.map((customer) => <option key={customer.id} value={customer.id}>{customerLabel(customer)}</option>)}
                </select>
                <small>O número precisa existir no WhatsApp. Use o campo WhatsApp do cadastro do cliente, ou telefone se for WhatsApp.</small>
              </label>
              <textarea className="product-copy-text" value={productCopyText(details)} readOnly />
              <div className="product-detail-actions">
                <button type="button" className="primary-btn" onClick={() => void shareProduct(details)}>Enviar descrição para cliente</button>
                <button type="button" className="secondary-btn" onClick={() => void copyProductText(details)}>Copiar tudo</button>
                {details.image_data && <button type="button" className="secondary-btn" onClick={() => void sendPhotoSeparately(details)}>Salvar foto separada</button>}
                {details.image_data && <button type="button" className="ghost-btn" onClick={() => void saveProductPhoto(details, true)}>Salvar/abrir foto</button>}
                <button type="button" className="ghost-btn" onClick={() => void copyProductText(details, 'price')}>Copiar preço</button>
                <button type="button" className="ghost-btn" onClick={() => void copyProductText(details, 'color')}>Copiar cor/tamanho</button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(preview)} title={preview?.title ?? 'Foto do produto'} onClose={() => setPreview(null)}>
        {preview && <div className="product-preview-modal"><img src={preview.src} alt={preview.title} className="product-preview-large" /></div>}
      </Modal>
    </div>
  );
}
