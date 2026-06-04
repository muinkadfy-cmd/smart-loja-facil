import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import type { CreditSummary, PageKey, ReceiptSummary } from '../../types';
import { EmptyState } from '../components/EmptyState';
import { InlineIcon } from '../components/InlineIcon';
import { StatCard } from '../components/StatCard';
import { formatCurrency, formatDateTime, formatNumber } from '../components/format';

interface ReceiptsScreenProps {
  refreshToken: number;
  onNavigate: (page: PageKey) => void;
  onRefresh: () => void;
}

type Feedback = { tone: 'success' | 'error' | 'info'; text: string };
type ReceiptPrintFormat = '58mm' | '80mm' | 'a4';
type ReceiptFilter = 'todos' | 'vendas' | 'crediario' | 'parcelas' | 'pedidos' | 'caixa' | 'cancelados';
type ReceiptView = ReceiptSummary & {
  source_kind?: ReceiptFilter;
  installment_number?: number;
  installment_total?: number;
  installment_due_date?: string;
  installment_paid_amount?: number;
  installment_remaining?: number;
};

const receiptFilters: Array<{ key: ReceiptFilter; label: string }> = [
  { key: 'todos', label: 'Todos' },
  { key: 'vendas', label: 'Vendas' },
  { key: 'crediario', label: 'Crediário' },
  { key: 'parcelas', label: 'Parcelas' },
  { key: 'pedidos', label: 'Pedidos' },
  { key: 'caixa', label: 'Caixa' },
  { key: 'cancelados', label: 'Cancelados' },
];

function receiptTitle(receipt: ReceiptView): string {
  if (receipt.source_kind === 'parcelas') return `Parcela ${receipt.installment_number || ''}/${receipt.installment_total || ''} · Venda #${String(receipt.sale_number || 0).padStart(4, '0')}`;
  return `Comprovante #${String(receipt.sale_number || 0).padStart(4, '0')}`;
}

function receiptStatusLabel(status: string): string {
  const text = String(status || '').toLowerCase();
  if (/(cancel|cancelad|canceled)/.test(text)) return 'Cancelado';
  if (/(venc|overdue)/.test(text)) return 'Vencido';
  if (/(parcial|partial)/.test(text)) return 'Parcial';
  if (/(pend|open|aberto)/.test(text)) return 'Pendente';
  if (/(pago|paid|quitado)/.test(text)) return 'Pago';
  if (/(emit|gerad|generated|finaliz|finalized)/.test(text)) return 'Emitido';
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Emitido';
}

function receiptTone(status: string): 'ok' | 'warn' | 'danger' | 'neutral' {
  const label = receiptStatusLabel(status).toLowerCase();
  if (label.includes('cancel') || label.includes('venc')) return 'danger';
  if (label.includes('parcial') || label.includes('pend')) return 'warn';
  if (label.includes('pago')) return 'ok';
  return 'neutral';
}

function safeWhatsapp(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') ? digits : `55${digits}`;
}

function htmlToText(html: string): string {
  if (typeof window === 'undefined') return html.replace(/<[^>]+>/g, ' ');
  const element = document.createElement('div');
  element.innerHTML = html;
  return element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function remaining(amount: number, paid: number): number {
  return Math.max(0, Number((amount - paid).toFixed(2)));
}

function installmentStatus(amount: number, paid: number, dueDate: string, originalStatus: string): string {
  const rest = remaining(amount, paid);
  if (rest <= 0.009) return 'pago';
  if (paid > 0) return 'parcial';
  const due = new Date(`${dueDate}T23:59:59`);
  if (dueDate && !Number.isNaN(due.getTime()) && due.getTime() < Date.now()) return 'vencido';
  return originalStatus || 'pendente';
}

function buildInstallmentReceiptContent(credit: CreditSummary, installmentIndex: number): string {
  const installment = credit.installments[installmentIndex];
  const paid = Number(installment.paid_amount || 0);
  const rest = remaining(Number(installment.amount || 0), paid);
  const status = receiptStatusLabel(installmentStatus(Number(installment.amount || 0), paid, installment.due_date, installment.status));
  const next = paid > Number(installment.amount || 0) ? paid - Number(installment.amount || 0) : 0;
  return `
    <section class="slf-receipt">
      <div class="slf-receipt-head">
        <div class="slf-receipt-brand"><div><div class="slf-receipt-title">Smart Loja Fácil</div><div class="slf-receipt-sub">Comprovante de crediário por parcela</div></div></div>
        <strong class="slf-receipt-badge">${escapeHtml(status.toUpperCase())}</strong>
      </div>
      <div class="slf-receipt-grid">
        <div class="slf-receipt-info"><span>Cliente</span><strong>${escapeHtml(credit.customer_name || 'Cliente')}</strong></div>
        <div class="slf-receipt-info"><span>Venda</span><strong>#${String(credit.sale_number || 0).padStart(4, '0')}</strong></div>
        <div class="slf-receipt-info"><span>Parcela</span><strong>${installment.number}/${credit.installments.length}</strong></div>
        <div class="slf-receipt-info"><span>Vencimento</span><strong>${escapeHtml(installment.due_date || '-')}</strong></div>
      </div>
      <table class="slf-receipt-table">
        <tbody>
          <tr><th>Valor original</th><td class="num">${formatCurrency(installment.amount)}</td></tr>
          <tr><th>Total já pago</th><td class="num">${formatCurrency(paid)}</td></tr>
          <tr><th>Restante</th><td class="num">${formatCurrency(rest)}</td></tr>
          <tr><th>Status</th><td class="num">${escapeHtml(status)}</td></tr>
          ${installment.paid_at ? `<tr><th>Pagamento</th><td class="num">${escapeHtml(formatDateTime(installment.paid_at))}</td></tr>` : ''}
        </tbody>
      </table>
      ${next > 0 ? `<div class="slf-receipt-note">Houve abatimento em próxima parcela: ${formatCurrency(next)}.</div>` : ''}
      <div class="slf-receipt-note">Envie este comprovante para o cliente acompanhar o que já pagou e o que falta.</div>
      <div class="slf-receipt-footer">Gerado pelo Smart Loja Fácil</div>
    </section>`;
}

function receiptCategory(receipt: ReceiptView): ReceiptFilter {
  if (receipt.source_kind) return receipt.source_kind;
  const type = `${receipt.receipt_type || ''} ${receipt.status || ''} ${receipt.content || ''}`.toLowerCase();
  if (/cancel/.test(type)) return 'cancelados';
  if (/parcela|installment/.test(type)) return 'parcelas';
  if (/credi|credit/.test(type)) return 'crediario';
  if (/pedido|order/.test(type)) return 'pedidos';
  if (/caixa|cash/.test(type)) return 'caixa';
  return 'vendas';
}

function buildInstallmentReceiptViews(credits: CreditSummary[]): ReceiptView[] {
  return credits.flatMap((credit) => credit.installments.map((installment, index) => {
    const paid = Number(installment.paid_amount || 0);
    const amount = Number(installment.amount || 0);
    const status = installmentStatus(amount, paid, installment.due_date, installment.status);
    return {
      id: `credit-installment-${installment.id}`,
      sale_id: credit.sale_id,
      sale_number: credit.sale_number,
      customer_name: credit.customer_name,
      customer_whatsapp: credit.customer_whatsapp || credit.customer_phone || '',
      receipt_type: 'parcela-crediario',
      total: amount,
      status,
      created_at: installment.paid_at || installment.due_date || credit.created_at,
      content: buildInstallmentReceiptContent(credit, index),
      source_kind: 'parcelas',
      installment_number: installment.number,
      installment_total: credit.installments.length,
      installment_due_date: installment.due_date,
      installment_paid_amount: paid,
      installment_remaining: remaining(amount, paid),
    } satisfies ReceiptView;
  }));
}

export function ReceiptsScreen({ refreshToken, onNavigate }: ReceiptsScreenProps): JSX.Element {
  const [receipts, setReceipts] = useState<ReceiptView[]>([]);
  const [selected, setSelected] = useState<ReceiptView | null>(null);
  const [filter, setFilter] = useState<ReceiptFilter>('todos');
  const [visibleCount, setVisibleCount] = useState(30);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const loadReceipts = async () => {
    setLoading(true);
    try {
      const [rows, credits] = await Promise.all([api.receipts(), api.credits().catch(() => [])]);
      const combined = [...(rows as ReceiptView[]), ...buildInstallmentReceiptViews(credits as CreditSummary[])];
      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setReceipts(combined);
      setSelected((current) => current ? combined.find((row) => row.id === current.id) ?? current : null);
      setFeedback(null);
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReceipts();
  }, [refreshToken]);

  useEffect(() => {
    setVisibleCount(30);
  }, [filter]);

  const filteredReceipts = useMemo(() => receipts.filter((receipt) => {
    const category = receiptCategory(receipt);
    if (filter === 'todos') return true;
    if (filter === 'crediario') return category === 'crediario' || category === 'parcelas';
    if (filter === 'cancelados') return category === 'cancelados' || receiptStatusLabel(receipt.status) === 'Cancelado';
    return category === filter;
  }), [filter, receipts]);

  const totalReceipts = receipts.length;
  const totalValue = useMemo(() => receipts.reduce((sum, receipt) => sum + Number(receipt.total || 0), 0), [receipts]);
  const pendingCount = receipts.filter((receipt) => ['Pendente', 'Parcial', 'Vencido'].includes(receiptStatusLabel(receipt.status))).length;

  async function exportReceipt(receipt: ReceiptView, printFormat: ReceiptPrintFormat = '80mm'): Promise<void> {
    const html = receipt.content || `<h1>${receiptTitle(receipt)}</h1><p>${receipt.customer_name || 'Consumidor'} - ${formatCurrency(receipt.total)}</p>`;
    setSaving(true);
    try {
      await api.exportHtmlPdf(html, `comprovante-${receipt.sale_number || receipt.id}`, true, undefined, printFormat);
      const label = printFormat === 'a4' ? 'A4/PDF' : printFormat;
      setFeedback({ tone: 'success', text: `Prévia ${label} aberta para salvar, imprimir ou enviar.` });
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  }

  function openFullPreview(receipt: ReceiptView): void {
    const html = receipt.content || `<p>Comprovante sem prévia HTML salva.</p>`;
    const popup = window.open('', '_blank', 'noopener,noreferrer');
    if (!popup) {
      setFeedback({ tone: 'info', text: 'O navegador bloqueou a tela cheia. Use A4/PDF ou Compartilhar.' });
      return;
    }
    popup.document.open();
    popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(receiptTitle(receipt))}</title><style>body{margin:0;background:#f2f6fb;font-family:Arial,sans-serif}.wrap{max-width:920px;margin:auto;padding:16px}.paper{background:#fff;border-radius:18px;padding:18px;box-shadow:0 18px 48px rgba(15,23,42,.16);overflow:auto}.top{position:sticky;top:0;background:#0f172a;color:white;padding:12px 16px;font-weight:800}</style></head><body><div class="top">Prévia em tela cheia</div><main class="wrap"><div class="paper">${html}</div></main></body></html>`);
    popup.document.close();
  }

  async function shareReceipt(receipt: ReceiptView): Promise<void> {
    const status = receiptStatusLabel(receipt.status);
    const text = `${receiptTitle(receipt)}\nStatus: ${status}\nCliente: ${receipt.customer_name || 'Consumidor'}\nTotal/Parcela: ${formatCurrency(receipt.total)}\n${htmlToText(receipt.content).slice(0, 900)}`;
    const phone = safeWhatsapp(receipt.customer_whatsapp || '');
    if (navigator.share) {
      try {
        await navigator.share({ title: receiptTitle(receipt), text });
        setFeedback({ tone: 'success', text: 'Comprovante enviado pelo compartilhamento do celular.' });
        return;
      } catch {
        // continua para WhatsApp/copia quando o usuário cancela ou o navegador não permite.
      }
    }
    if (phone) {
      await api.openExternalUrl(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`);
      setFeedback({ tone: 'success', text: 'WhatsApp aberto com o comprovante preenchido.' });
      return;
    }
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    setFeedback({ tone: 'info', text: 'Texto do comprovante copiado. Cole no WhatsApp ou em outro app.' });
  }

  const visibleReceipts = filteredReceipts.slice(0, visibleCount);

  return (
    <div className="mapp-screen mapp-receipts-screen">
      <section className="mapp-mini-stat-grid">
        <StatCard label="Comprovantes" value={formatNumber(totalReceipts)} detail="vendas e parcelas" icon="comprovantes" tone="sky" />
        <StatCard label="Valor somado" value={formatCurrency(totalValue)} detail="lista atual" icon="dinheiro" tone="green" />
        <StatCard label="Atenção" value={formatNumber(pendingCount)} detail="pendentes/parciais" icon="crediario" tone="orange" />
      </section>

      {loading ? <div className="mapp-inline-status">Carregando comprovantes...</div> : null}
      {feedback ? <div className={`mapp-form-feedback mapp-form-feedback-${feedback.tone}`}>{feedback.text}</div> : null}

      <section className="mapp-success-card">
        <strong>Ajuda rápida: comprovante certo para cada situação</strong>
        <span>Use 58mm para bobina estreita, 80mm para bobina maior e A4/PDF para folha comum. Parcelas aparecem separadas com status Pago, Parcial, Pendente ou Vencido.</span>
      </section>

      <div className="mapp-filter-pills" role="tablist" aria-label="Filtrar comprovantes">
        {receiptFilters.map((item) => (
          <button key={item.key} type="button" className={filter === item.key ? 'active' : ''} onClick={() => setFilter(item.key)}>
            {item.label}
          </button>
        ))}
      </div>

      {selected ? (
        <section className="mapp-form-panel mapp-receipt-preview">
          <div className="mapp-form-head">
            <span className="mapp-form-icon tone-sky"><InlineIcon name="comprovantes" size={24} /></span>
            <div>
              <strong>{receiptTitle(selected)}</strong>
              <p>{selected.customer_name || 'Consumidor'} · {formatDateTime(selected.created_at)}</p>
            </div>
          </div>
          <div className="mapp-receipt-summary">
            <span>Total <strong>{formatCurrency(selected.total)}</strong></span>
            <span>Tipo <strong>{selected.receipt_type || '80mm'}</strong></span>
            <span>Status <strong>{receiptStatusLabel(selected.status)}</strong></span>
            {selected.source_kind === 'parcelas' ? <span>Restante <strong>{formatCurrency(selected.installment_remaining || 0)}</strong></span> : null}
          </div>
          <iframe
            title={`Prévia segura do ${receiptTitle(selected)}`}
            className="mapp-receipt-frame"
            sandbox=""
            srcDoc={selected.content || '<p>Comprovante sem prévia HTML salva.</p>'}
          />
          <div className="mapp-button-grid mapp-receipt-button-grid">
            <button type="button" className="mapp-primary-button" onClick={() => void exportReceipt(selected, '58mm')} disabled={saving}>58mm</button>
            <button type="button" className="mapp-secondary-button" onClick={() => void exportReceipt(selected, '80mm')} disabled={saving}>80mm</button>
            <button type="button" className="mapp-secondary-button" onClick={() => void exportReceipt(selected, 'a4')} disabled={saving}>A4 / PDF</button>
            <button type="button" className="mapp-secondary-button" onClick={() => openFullPreview(selected)}>Tela cheia</button>
            <button type="button" className="mapp-secondary-button" onClick={() => void shareReceipt(selected)}>WhatsApp / compartilhar</button>
            <button type="button" className="mapp-secondary-button" onClick={() => setSelected(null)}>Fechar prévia</button>
          </div>
        </section>
      ) : null}

      {visibleReceipts.length ? (
        <section className="mapp-crud-list">
          {visibleReceipts.map((receipt) => (
            <article key={receipt.id} className="mapp-crud-card mapp-receipt-card">
              <span className="mapp-crud-icon tone-sky"><InlineIcon name="comprovantes" size={24} /></span>
              <div className="mapp-crud-main">
                <div className="mapp-crud-title-row">
                  <strong>{receiptTitle(receipt)}</strong>
                  <em className={receiptTone(receipt.status)}>{receiptStatusLabel(receipt.status)}</em>
                </div>
                <p>{receipt.customer_name || 'Consumidor'} · {receipt.receipt_type} · {formatDateTime(receipt.created_at)}</p>
                <div className="mapp-crud-meta">
                  <span>{formatCurrency(receipt.total)}</span>
                  {receipt.source_kind === 'parcelas' ? <span>Restante {formatCurrency(receipt.installment_remaining || 0)}</span> : null}
                  <span>{receipt.customer_whatsapp ? 'WhatsApp disponível' : 'sem WhatsApp'}</span>
                </div>
              </div>
              <div className="mapp-crud-side">
                <strong>{formatCurrency(receipt.total)}</strong>
                <div className="mapp-receipt-actions">
                  <button type="button" onClick={() => setSelected(receipt)}>Ver</button>
                  <button type="button" onClick={() => void exportReceipt(receipt, '58mm')} disabled={saving}>58</button>
                  <button type="button" onClick={() => void exportReceipt(receipt, '80mm')} disabled={saving}>80</button>
                  <button type="button" onClick={() => void shareReceipt(receipt)}>Enviar</button>
                </div>
              </div>
            </article>
          ))}
          {filteredReceipts.length > visibleCount ? (
            <button type="button" className="mapp-secondary-button mapp-load-more" onClick={() => setVisibleCount((count) => count + 30)}>
              Ver mais comprovantes ({filteredReceipts.length - visibleCount} restantes)
            </button>
          ) : null}
        </section>
      ) : !loading ? (
        <EmptyState icon="comprovantes" title="Nenhum comprovante neste filtro" detail="Depois de finalizar vendas ou receber parcelas, os comprovantes aparecerão aqui para reimprimir ou compartilhar." actionLabel="Ir para vendas" actionPage="sales" onNavigate={onNavigate} />
      ) : null}
    </div>
  );
}
