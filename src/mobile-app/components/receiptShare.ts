import { api } from '../../lib/api';
import type { ReceiptSummary, SaleSummary } from '../../types';
import { formatCurrency, formatDateTime } from './format';

export type ReceiptShareFormat = 'pdf' | 'png';

export function saleReceiptTitle(sale: SaleSummary): string {
  return `Comprovante #${String(sale.number || 0).padStart(4, '0')}`;
}

export function findReceiptForSale(receipts: ReceiptSummary[], sale: SaleSummary): ReceiptSummary | null {
  return receipts.find((receipt) => receipt.sale_id === sale.id || Number(receipt.sale_number || 0) === Number(sale.number || 0)) ?? null;
}

function safeFilePart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 80) || 'comprovante';
}

function uniqueFileName(stem: string, ext: 'pdf' | 'png'): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
  return `${safeFilePart(stem)}-${stamp}.${ext}`;
}

function cleanSystemBrand(value: string): string {
  return value
    .replace(/Smart Loja F(?:a|á)cil/gi, 'Jaque Confecções e Presentes')
    .replace(/Smart Loja/gi, 'Jaque Confecções e Presentes');
}

function htmlToText(html: string): string {
  const raw = typeof window === 'undefined' ? html.replace(/<[^>]+>/g, ' ') : (() => {
    const element = document.createElement('div');
    element.innerHTML = html;
    return element.textContent ?? '';
  })();
  return cleanSystemBrand(raw).replace(/\s+/g, ' ').trim();
}

function normalizeLines(text: string, maxLines = 26): string[] {
  return text
    .replace(/R\$\s*/g, 'R$ ')
    .split(/(?=Subtotal|Desconto|Total|Status|Obrigado|Cliente|Forma|Venda|Data)|\n|\r/g)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, maxLines);
}

function receiptLines(sale: SaleSummary, receipt: ReceiptSummary): string[] {
  const title = saleReceiptTitle(sale);
  const body = normalizeLines(htmlToText(receipt.content), 20);
  const lines = [
    title,
    `Venda: #${String(receipt.sale_number || sale.number || 0).padStart(4, '0')}`,
    `Cliente: ${receipt.customer_name || sale.customer_name || 'Consumidor'}`,
    `Data: ${formatDateTime(receipt.created_at || sale.created_at)}`,
    `Forma: ${paymentLabel(sale.payment_method)}`,
    `Total: ${formatCurrency(receipt.total || sale.total)}`,
    ...body,
  ].filter(Boolean);
  return Array.from(new Set(lines)).slice(0, 30);
}

function paymentLabel(method: SaleSummary['payment_method']): string {
  if (method === 'dinheiro') return 'Dinheiro';
  if (method === 'pix') return 'Pix';
  if (method === 'cartao') return 'Cartão';
  return 'Crediário';
}

function pdfEscape(value: string): string {
  return value.replace(/[\\()]/g, '\\$&');
}

function safePdfText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/[•]/g, '-')
    .replace(/[^\x20-\x7E\n\r\t]/g, '');
}

function pdfText(commands: string[], x: number, y: number, text: string, size = 10, bold = false): void {
  commands.push('BT', `/${bold ? 'F2' : 'F1'} ${size} Tf`, `${x} ${y} Td`, `(${pdfEscape(safePdfText(text))}) Tj`, 'ET');
}

function pdfLine(commands: string[], x1: number, y1: number, x2: number, y2: number): void {
  commands.push(`${x1} ${y1} m ${x2} ${y2} l S`);
}

function pdfRect(commands: string[], x: number, y: number, w: number, h: number, fill = false): void {
  commands.push(`${x} ${y} ${w} ${h} re ${fill ? 'f' : 'S'}`);
}

function makePdfBlob(sale: SaleSummary, receipt: ReceiptSummary): Blob {
  const lines = receiptLines(sale, receipt);
  const commands: string[] = ['q', '1 w', '0 0 0 RG', '0 0 0 rg'];
  pdfRect(commands, 46, 48, 503, 748, false);
  pdfText(commands, 68, 752, 'JAQUE CONFECCOES E PRESENTES', 15, true);
  pdfText(commands, 68, 731, saleReceiptTitle(sale).toUpperCase(), 21, true);
  pdfLine(commands, 68, 716, 527, 716);
  pdfText(commands, 68, 695, `Cliente: ${receipt.customer_name || sale.customer_name || 'Consumidor'}`, 12, true);
  pdfText(commands, 68, 676, `Venda: #${String(receipt.sale_number || sale.number || 0).padStart(4, '0')}`, 10, false);
  pdfText(commands, 315, 676, `Data: ${formatDateTime(receipt.created_at || sale.created_at)}`, 10, false);
  pdfText(commands, 68, 657, `Forma: ${paymentLabel(sale.payment_method)}`, 10, false);
  pdfText(commands, 315, 657, `Total: ${formatCurrency(receipt.total || sale.total)}`, 12, true);
  pdfRect(commands, 68, 611, 459, 28, true);
  commands.push('1 1 1 rg');
  pdfText(commands, 82, 620, 'COMPROVANTE / RESUMO', 10, true);
  commands.push('0 0 0 rg');
  let y = 591;
  normalizeLines(lines.slice(6).join('\n'), 22).forEach((line) => {
    const chunks = wrapText(line, 78);
    chunks.forEach((chunk) => {
      if (y > 110) {
        pdfText(commands, 82, y, chunk, 8.8, /^(total|desconto|subtotal|status)/i.test(chunk));
        y -= 15;
      }
    });
  });
  pdfLine(commands, 68, 94, 527, 94);
  pdfText(commands, 68, 76, 'Arquivo gerado pelo sistema da loja. Compartilhe este PDF pronto, sem link e sem texto extra.', 8, false);
  commands.push('Q');
  const stream = commands.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

function wrapText(value: string, maxChars: number): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : ['-'];
}

async function makePngBlob(sale: SaleSummary, receipt: ReceiptSummary): Promise<Blob> {
  const lines = receiptLines(sale, receipt).slice(0, 24);
  const width = 900;
  const height = Math.max(980, 250 + lines.length * 30);
  const escaped = lines.map((line) => line.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char] || char)));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#111"/><rect x="46" y="46" width="808" height="${height - 92}" rx="0" fill="#fff" stroke="#000" stroke-width="8"/><text x="90" y="116" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="900" fill="#111">JAQUE CONFECÇÕES E PRESENTES</text><text x="90" y="166" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="900" fill="#111">${saleReceiptTitle(sale).toUpperCase()}</text><line x1="90" y1="190" x2="810" y2="190" stroke="#111" stroke-width="4"/>${escaped.map((line, index) => `<text x="90" y="${240 + index * 30}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="${/^(total|desconto|subtotal|status|cliente|venda)/i.test(line) ? '800' : '500'}" fill="#111">${line}</text>`).join('')}<text x="90" y="${height - 86}" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="#333">Comprovante pronto para WhatsApp - sem link e sem texto extra.</text></svg>`;
  const image = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Não foi possível gerar PNG do comprovante.'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas indisponível para gerar PNG.');
    context.drawImage(image, 0, 0);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Não foi possível finalizar o PNG.')), 'image/png', 0.96);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function shareFile(file: File, title: string): Promise<boolean> {
  const payload = { title, files: [file] } as ShareData & { files: File[] };
  const mobileNavigator = navigator as Navigator & { canShare?: (data: ShareData & { files?: File[] }) => boolean };
  if (!navigator.share || !mobileNavigator.canShare?.(payload)) return false;
  try {
    await navigator.share(payload);
    return true;
  } catch {
    return false;
  }
}

export async function shareSaleReceipt(sale: SaleSummary, receipt: ReceiptSummary | null, format: ReceiptShareFormat = 'pdf'): Promise<string> {
  if (!receipt) return 'Ainda não encontrei comprovante para essa venda. Abra Comprovantes e atualize a lista.';
  const title = saleReceiptTitle(sale);
  if (format === 'png') {
    const blob = await makePngBlob(sale, receipt);
    const fileName = uniqueFileName(`comprovante-venda-${receipt.sale_number || sale.number}`, 'png');
    const shared = await shareFile(new File([blob], fileName, { type: 'image/png' }), title);
    if (shared) return 'Imagem PNG do comprovante aberta no compartilhamento do celular.';
    downloadBlob(blob, fileName);
    return `PNG baixado como ${fileName}. Anexe essa imagem no WhatsApp.`;
  }
  const blob = makePdfBlob(sale, receipt);
  const fileName = uniqueFileName(`comprovante-venda-${receipt.sale_number || sale.number}`, 'pdf');
  const shared = await shareFile(new File([blob], fileName, { type: 'application/pdf' }), title);
  if (shared) return 'PDF do comprovante aberto no compartilhamento do celular.';
  downloadBlob(blob, fileName);
  return `PDF baixado como ${fileName}. Anexe esse arquivo no WhatsApp.`;
}

export async function openReceiptInComprovantes(sale: SaleSummary): Promise<void> {
  const params = new URLSearchParams();
  params.set('source', 'sale');
  params.set('view', 'receipts');
  params.set('sale', String(sale.number || ''));
  params.set('sale_id', sale.id);
  window.history.replaceState(null, '', `?${params.toString()}`);
  await api.openExternalUrl(`/?${params.toString()}`).catch(() => undefined);
}
