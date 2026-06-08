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


function receiptStatusForShare(status: string): string {
  const clean = String(status || '').toLowerCase();
  if (/(pago|paid|quitado)/.test(clean)) return 'Pago';
  if (/(parcial|partial)/.test(clean)) return 'Parcial';
  if (/(venc|atras|overdue)/.test(clean)) return 'Atrasado';
  if (/(cancel)/.test(clean)) return 'Cancelado';
  return 'Emitido';
}

async function makePngBlob(sale: SaleSummary, receipt: ReceiptSummary): Promise<Blob> {
  const title = saleReceiptTitle(sale).toUpperCase();
  const storeName = 'Jaque Confecções e Presentes';
  const lines = receiptLines(sale, receipt);
  const summaryRows = [
    ['CLIENTE', receipt.customer_name || sale.customer_name || 'Consumidor'],
    ['VENDA', `#${String(receipt.sale_number || sale.number || 0).padStart(4, '0')}`],
    ['DATA', formatDateTime(receipt.created_at || sale.created_at)],
    ['FORMA', paymentLabel(sale.payment_method)],
    ['TOTAL', formatCurrency(receipt.total || sale.total)],
  ];
  const detailLines = normalizeLines(lines.slice(6).join('\n'), 18);
  const width = 900;
  const receiptX = 54;
  const receiptY = 44;
  const receiptW = 792;
  const detailsH = Math.max(250, 70 + detailLines.length * 30);
  const receiptH = 250 + 220 + detailsH + 86;
  const height = receiptH + 88;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas indisponível para gerar PNG.');
  const ctx: CanvasRenderingContext2D = context;

  function drawText(text: string, x: number, y: number, size: number, weight = 600, color = '#111827'): void {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px Arial, Helvetica, sans-serif`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, x, y);
  }

  function drawCentered(text: string, x: number, y: number, boxW: number, size: number, weight = 700, color = '#111827'): void {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, x + boxW / 2, y);
    ctx.textAlign = 'left';
  }

  function wrapCanvas(text: string, maxWidth: number): string[] {
    ctx.font = '600 20px Arial, Helvetica, sans-serif';
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const out: string[] = [];
    let line = '';
    words.forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        out.push(line);
        line = word;
      } else {
        line = next;
      }
    });
    if (line) out.push(line);
    return out.length ? out : ['-'];
  }

  async function loadLogo(): Promise<HTMLImageElement | null> {
    return await new Promise((resolve) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = '/brand/jaque-receipt-logo-wide.png';
    });
  }

  ctx.fillStyle = '#090909';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(receiptX, receiptY, receiptW, receiptH);
  ctx.strokeStyle = '#050505';
  ctx.lineWidth = 8;
  ctx.strokeRect(receiptX, receiptY, receiptW, receiptH);

  const logo = await loadLogo();
  if (logo) {
    ctx.drawImage(logo, receiptX + 34, receiptY + 38, 260, 136);
  } else {
    drawText(storeName.toUpperCase(), receiptX + 42, receiptY + 112, 24, 900);
  }
  drawCentered(storeName.toUpperCase(), receiptX + 40, receiptY + 192, 260, 13, 900);
  drawCentered(title, receiptX + 350, receiptY + 94, 398, 42, 900, '#050505');
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(receiptX + 350, receiptY + 122);
  ctx.lineTo(receiptX + 748, receiptY + 122);
  ctx.stroke();
  drawText(`Comprovante salvo • ${formatDateTime(receipt.created_at || sale.created_at)}`, receiptX + 354, receiptY + 156, 17, 700);
  drawText(`Status: ${receiptStatusForShare(receipt.status)}`, receiptX + 354, receiptY + 184, 18, 900);

  let y = receiptY + 250;
  ctx.strokeStyle = '#050505';
  ctx.lineWidth = 4;
  ctx.strokeRect(receiptX + 20, y, receiptW - 40, 178);
  let rowY = y + 34;
  summaryRows.forEach(([label, value], index) => {
    drawText(label, receiptX + 46, rowY, 16, 900);
    drawText(String(value), receiptX + 190, rowY, index === summaryRows.length - 1 ? 24 : 20, 900);
    if (index < summaryRows.length - 1) {
      ctx.beginPath();
      ctx.moveTo(receiptX + 36, rowY + 14);
      ctx.lineTo(receiptX + receiptW - 36, rowY + 14);
      ctx.stroke();
    }
    rowY += 34;
  });

  y += 214;
  ctx.fillStyle = '#050505';
  ctx.fillRect(receiptX + 20, y, receiptW - 40, 42);
  drawText('DETALHES DO COMPROVANTE', receiptX + 42, y + 29, 19, 900, '#ffffff');
  y += 42;
  ctx.strokeStyle = '#050505';
  ctx.lineWidth = 4;
  ctx.strokeRect(receiptX + 20, y, receiptW - 40, detailsH - 42);
  let detailY = y + 32;
  detailLines.forEach((line) => {
    wrapCanvas(`• ${line}`, receiptW - 80).slice(0, 2).forEach((chunk) => {
      drawText(chunk, receiptX + 42, detailY, 19, /^(•\s*)?(total|desconto|subtotal|status|cliente|venda)/i.test(chunk) ? 850 : 550);
      detailY += 30;
    });
  });

  drawCentered('Comprovante pronto para WhatsApp — sem link e sem texto extra.', receiptX + 20, receiptY + receiptH - 34, receiptW - 40, 17, 600);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Não foi possível finalizar o PNG.')), 'image/png', 0.98);
  });
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
