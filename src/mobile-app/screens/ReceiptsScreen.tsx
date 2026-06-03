import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import type { PageKey, ReceiptSummary } from '../../types';
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

function receiptTitle(receipt: ReceiptSummary): string {
  return `Comprovante #${String(receipt.sale_number || 0).padStart(4, '0')}`;
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

export function ReceiptsScreen({ refreshToken, onNavigate, onRefresh }: ReceiptsScreenProps): JSX.Element {
  const [receipts, setReceipts] = useState<ReceiptSummary[]>([]);
  const [selected, setSelected] = useState<ReceiptSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const loadReceipts = async () => {
    setLoading(true);
    try {
      const rows = await api.receipts();
      setReceipts(rows);
      setSelected((current) => current ? rows.find((row) => row.id === current.id) ?? current : null);
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

  const totalReceipts = receipts.length;
  const totalValue = useMemo(() => receipts.reduce((sum, receipt) => sum + Number(receipt.total || 0), 0), [receipts]);
  const cancelCount = receipts.filter((receipt) => receipt.status === 'cancelada').length;

  async function exportReceipt(receipt: ReceiptSummary, printFormat: '80mm' | 'a4' = '80mm'): Promise<void> {
    const html = receipt.content || `<h1>${receiptTitle(receipt)}</h1><p>${receipt.customer_name || 'Consumidor'} - ${formatCurrency(receipt.total)}</p>`;
    setSaving(true);
    try {
      await api.exportHtmlPdf(html, `comprovante-${receipt.sale_number || receipt.id}`, true, undefined, printFormat);
      setFeedback({ tone: 'success', text: printFormat === 'a4' ? 'Prévia A4 aberta para salvar ou imprimir.' : 'Prévia 80mm aberta para salvar ou imprimir.' });
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  }

  async function shareReceipt(receipt: ReceiptSummary): Promise<void> {
    const text = `${receiptTitle(receipt)}\nCliente: ${receipt.customer_name || 'Consumidor'}\nTotal: ${formatCurrency(receipt.total)}\n${htmlToText(receipt.content).slice(0, 900)}`;
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

  return (
    <div className="mapp-screen mapp-receipts-screen">
      <section className="mapp-mini-stat-grid">
        <StatCard label="Comprovantes" value={formatNumber(totalReceipts)} detail="gerados" icon="comprovantes" tone="sky" />
        <StatCard label="Valor somado" value={formatCurrency(totalValue)} detail="lista atual" icon="dinheiro" tone="green" />
        <StatCard label="Cancelados" value={formatNumber(cancelCount)} detail="para conferência" icon="cancelar_venda" tone="orange" />
      </section>

      {loading ? <div className="mapp-inline-status">Carregando comprovantes...</div> : null}
      {feedback ? <div className={`mapp-form-feedback mapp-form-feedback-${feedback.tone}`}>{feedback.text}</div> : null}

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
            <span>Status <strong>{selected.status}</strong></span>
          </div>
          <iframe
            title={`Prévia segura do ${receiptTitle(selected)}`}
            className="mapp-receipt-frame"
            sandbox=""
            srcDoc={selected.content || '<p>Comprovante sem prévia HTML salva.</p>'}
          />
          <div className="mapp-button-grid">
            <button type="button" className="mapp-primary-button" onClick={() => void exportReceipt(selected, '80mm')} disabled={saving}>Imprimir 80mm</button>
            <button type="button" className="mapp-secondary-button" onClick={() => void exportReceipt(selected, 'a4')} disabled={saving}>A4 / PDF</button>
            <button type="button" className="mapp-secondary-button" onClick={() => void shareReceipt(selected)}>Compartilhar</button>
            <button type="button" className="mapp-secondary-button" onClick={() => setSelected(null)}>Fechar prévia</button>
          </div>
        </section>
      ) : null}

      {receipts.length ? (
        <section className="mapp-crud-list">
          {receipts.slice(0, 50).map((receipt) => (
            <article key={receipt.id} className="mapp-crud-card mapp-receipt-card">
              <span className="mapp-crud-icon tone-sky"><InlineIcon name="comprovantes" size={24} /></span>
              <div className="mapp-crud-main">
                <div className="mapp-crud-title-row">
                  <strong>{receiptTitle(receipt)}</strong>
                  <em className={receipt.status === 'cancelada' ? 'warn' : 'ok'}>{receipt.status}</em>
                </div>
                <p>{receipt.customer_name || 'Consumidor'} · {receipt.receipt_type} · {formatDateTime(receipt.created_at)}</p>
                <div className="mapp-crud-meta">
                  <span>{formatCurrency(receipt.total)}</span>
                  <span>{receipt.customer_whatsapp ? 'WhatsApp disponível' : 'sem WhatsApp'}</span>
                </div>
              </div>
              <div className="mapp-crud-side">
                <strong>{formatCurrency(receipt.total)}</strong>
                <div className="mapp-receipt-actions">
                  <button type="button" onClick={() => setSelected(receipt)}>Abrir</button>
                  <button type="button" onClick={() => void exportReceipt(receipt, '80mm')} disabled={saving}>80mm</button>
                  <button type="button" onClick={() => void shareReceipt(receipt)}>Enviar</button>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : !loading ? (
        <EmptyState icon="comprovantes" title="Nenhum comprovante ainda" detail="Depois de finalizar vendas, os comprovantes aparecerão aqui para reimprimir ou compartilhar." actionLabel="Ir para vendas" actionPage="sales" onNavigate={onNavigate} />
      ) : null}
    </div>
  );
}
