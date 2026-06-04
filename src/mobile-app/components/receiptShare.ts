import { api } from '../../lib/api';
import type { ReceiptSummary, SaleSummary } from '../../types';
import { formatCurrency } from './format';

export function saleReceiptTitle(sale: SaleSummary): string {
  return `Comprovante #${String(sale.number || 0).padStart(4, '0')}`;
}

export function findReceiptForSale(receipts: ReceiptSummary[], sale: SaleSummary): ReceiptSummary | null {
  return receipts.find((receipt) => receipt.sale_id === sale.id || Number(receipt.sale_number || 0) === Number(sale.number || 0)) ?? null;
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

export async function shareSaleReceipt(sale: SaleSummary, receipt: ReceiptSummary | null): Promise<string> {
  if (!receipt) return 'Ainda não encontrei comprovante para essa venda. Abra Comprovantes e atualize a lista.';
  const title = saleReceiptTitle(sale);
  const text = `${title}
Cliente: ${receipt.customer_name || sale.customer_name || 'Consumidor'}
Total: ${formatCurrency(receipt.total || sale.total)}
${htmlToText(receipt.content).slice(0, 900)}`;
  const phone = safeWhatsapp(receipt.customer_whatsapp || '');
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return 'Comprovante enviado pelo compartilhamento do celular.';
    } catch {
      // Se o usuário cancelar ou o navegador negar, ainda tentamos WhatsApp/cópia.
    }
  }
  if (phone) {
    await api.openExternalUrl(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`);
    return 'WhatsApp aberto com o comprovante preenchido.';
  }
  await navigator.clipboard?.writeText(text).catch(() => undefined);
  return 'Texto do comprovante copiado. Cole no WhatsApp ou em outro app.';
}
