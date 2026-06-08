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


interface PngProductRow {
  qtd: string;
  produto: string;
  unitario: string;
  total: string;
}

function textFromCells(row: Element): string[] {
  return Array.from(row.querySelectorAll('th,td')).map((cell) => (cell.textContent ?? '').replace(/\s+/g, ' ').trim());
}

function extractProductRowsFromReceiptHtml(html: string): PngProductRow[] {
  if (typeof document === 'undefined' || !html) return [];
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  const tables = Array.from(wrapper.querySelectorAll('table'));
  for (const table of tables) {
    const headerRow = table.querySelector('thead tr') || table.querySelector('tr');
    const headers = headerRow ? textFromCells(headerRow).map((text) => text.toLowerCase()) : [];
    const productIndex = headers.findIndex((header) => /produto|item|descri/.test(header));
    if (productIndex < 0) continue;
    const qtyIndex = Math.max(0, headers.findIndex((header) => /qtd|quant/.test(header)));
    const unitIndex = headers.findIndex((header) => /un|unit/.test(header));
    const totalIndex = headers.findIndex((header) => /total|valor/.test(header));
    const bodyRows = Array.from(table.querySelectorAll('tbody tr')).length
      ? Array.from(table.querySelectorAll('tbody tr'))
      : Array.from(table.querySelectorAll('tr')).slice(1);
    const rows = bodyRows.map((row) => {
      const cells = textFromCells(row);
      return {
        qtd: cells[qtyIndex] || '1',
        produto: cleanSystemBrand(cells[productIndex] || cells.join(' ')).slice(0, 90),
        unitario: unitIndex >= 0 ? (cells[unitIndex] || '-') : '-',
        total: totalIndex >= 0 ? (cells[totalIndex] || '-') : (cells[cells.length - 1] || '-'),
      };
    }).filter((row) => row.produto && !/^produto$/i.test(row.produto));
    if (rows.length) return rows.slice(0, 8);
  }
  return [];
}

function saleFallbackProductRows(sale: SaleSummary, receipt: ReceiptSummary): PngProductRow[] {
  const name = sale.first_product_name?.trim() || `Venda #${String(receipt.sale_number || sale.number || 0).padStart(4, '0')}`;
  const qty = sale.item_count && sale.item_count > 1 ? `${sale.item_count}` : '1';
  return [{ qtd: qty, produto: name, unitario: '-', total: formatCurrency(receipt.total || sale.total) }];
}

function compactReceiptNoteLines(sale: SaleSummary, receipt: ReceiptSummary, productCount: number): string[] {
  const discount = Number(sale.discount || 0);
  const subtotal = Number(sale.subtotal || 0);
  const notes = [
    `Comprovante da venda #${String(receipt.sale_number || sale.number || 0).padStart(4, '0')} emitido em ${formatDateTime(receipt.created_at || sale.created_at)}.`,
    `Cliente: ${receipt.customer_name || sale.customer_name || 'Consumidor'}. Forma: ${paymentLabel(sale.payment_method)}.`,
    productCount > 1 ? `${productCount} produtos listados neste comprovante.` : 'Produto da venda listado neste comprovante.',
    subtotal > 0 ? `Subtotal: ${formatCurrency(subtotal)}.` : '',
    discount > 0 ? `Desconto aplicado: ${formatCurrency(discount)}.` : '',
    `Total final: ${formatCurrency(receipt.total || sale.total)}.`,
  ].filter(Boolean);
  return notes.slice(0, 6);
}

async function makePngBlob(sale: SaleSummary, receipt: ReceiptSummary): Promise<Blob> {
  const title = saleReceiptTitle(sale).toUpperCase();
  const storeName = 'Jaque Confecções e Presentes';
  const status = receiptStatusForShare(receipt.status || sale.status);
  const subtotal = Number(sale.subtotal || 0);
  const discount = Number(sale.discount || 0);
  const total = Number(receipt.total || sale.total || 0);
  const productRows = extractProductRowsFromReceiptHtml(receipt.content).length
    ? extractProductRowsFromReceiptHtml(receipt.content)
    : saleFallbackProductRows(sale, receipt);
  const noteLines = compactReceiptNoteLines(sale, receipt, productRows.length);

  const width = 1080;
  const margin = 72;
  const receiptX = margin;
  const receiptY = 56;
  const receiptW = width - margin * 2;
  const innerX = receiptX + 30;
  const innerW = receiptW - 60;
  const headerH = 226;
  const customerH = 156;
  const productHeaderH = 46;
  const productRowH = 54;
  const productH = productHeaderH + Math.max(1, productRows.length) * productRowH;
  const paymentH = discount > 0 ? 156 : 124;
  const notesH = 68 + noteLines.length * 34;
  const footerH = 76;
  const receiptH = headerH + customerH + 32 + productH + 32 + paymentH + 30 + notesH + footerH;
  const height = receiptH + 112;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas indisponível para gerar PNG.');
  const ctx: CanvasRenderingContext2D = context;

  function drawText(text: string, x: number, y: number, size: number, weight = 600, color = '#111111'): void {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(cleanSystemBrand(String(text || '')), x, y);
  }

  function drawCentered(text: string, x: number, y: number, boxW: number, size: number, weight = 800, color = '#111111'): void {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(cleanSystemBrand(String(text || '')), x + boxW / 2, y);
    ctx.textAlign = 'left';
  }

  function wrapForWidth(text: string, maxWidth: number, size: number, weight = 600): string[] {
    ctx.font = `${weight} ${size}px Arial, Helvetica, sans-serif`;
    const words = cleanSystemBrand(String(text || '-')).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    words.forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    });
    if (line) lines.push(line);
    return lines.length ? lines : ['-'];
  }

  function drawWrapped(text: string, x: number, y: number, maxWidth: number, size: number, weight = 600, lineGap = 8, color = '#111111', maxLines = 2): number {
    const lines = wrapForWidth(text, maxWidth, size, weight).slice(0, maxLines);
    let nextY = y;
    lines.forEach((line) => {
      drawText(line, x, nextY, size, weight, color);
      nextY += size + lineGap;
    });
    return nextY;
  }

  function drawBlackHeader(label: string, x: number, y: number, w: number, h = 44): void {
    ctx.fillStyle = '#050505';
    ctx.fillRect(x, y, w, h);
    drawText(label, x + 18, y + 29, 18, 900, '#ffffff');
  }

  function drawInfoRow(label: string, value: string, y: number): void {
    drawText(label, innerX + 28, y, 17, 900);
    drawWrapped(value, innerX + 190, y, innerW - 220, 19, 900, 5, '#111111', 1);
    ctx.beginPath();
    ctx.moveTo(innerX + 24, y + 13);
    ctx.lineTo(innerX + innerW - 24, y + 13);
    ctx.stroke();
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

  ctx.fillStyle = '#080808';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(receiptX, receiptY, receiptW, receiptH);
  ctx.strokeStyle = '#050505';
  ctx.lineWidth = 10;
  ctx.strokeRect(receiptX, receiptY, receiptW, receiptH);

  const logo = await loadLogo();
  if (logo) {
    ctx.drawImage(logo, innerX + 2, receiptY + 34, 310, 148);
  } else {
    drawCentered(storeName.toUpperCase(), innerX, receiptY + 104, 310, 24, 900);
  }
  drawCentered(storeName.toUpperCase(), innerX + 8, receiptY + 196, 300, 13, 900);

  const titleX = innerX + 370;
  const titleW = innerW - 390;
  let titleY = receiptY + 82;
  wrapForWidth(title, titleW, 41, 900).slice(0, 2).forEach((line) => {
    drawText(line, titleX, titleY, 41, 900, '#050505');
    titleY += 43;
  });
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(titleX, titleY - 23);
  ctx.lineTo(titleX + titleW, titleY - 23);
  ctx.stroke();
  drawText(`Comprovante salvo • ${formatDateTime(receipt.created_at || sale.created_at)}`, titleX, titleY + 8, 16, 700);
  drawText(`Status: ${status}`, titleX, titleY + 34, 18, 900);

  let y = receiptY + headerH;
  ctx.lineWidth = 4;
  ctx.strokeRect(innerX, y, innerW, customerH);
  drawInfoRow('CLIENTE', receipt.customer_name || sale.customer_name || 'Consumidor', y + 38);
  drawInfoRow('VENDA', `#${String(receipt.sale_number || sale.number || 0).padStart(4, '0')}`, y + 72);
  drawInfoRow('DATA', formatDateTime(receipt.created_at || sale.created_at), y + 106);
  drawInfoRow('FORMA', paymentLabel(sale.payment_method), y + 140);

  y += customerH + 32;
  drawBlackHeader('PRODUTOS COMPRADOS', innerX, y, innerW);
  y += productHeaderH;
  const tableCols = [84, 458, 160, innerW - 84 - 458 - 160];
  const headers = ['QTD.', 'PRODUTO', 'R$ UN', 'TOTAL'];
  ctx.lineWidth = 3;
  productRows.forEach((row, rowIndex) => {
    const rowTop = y + rowIndex * productRowH;
    ctx.strokeRect(innerX, rowTop, innerW, productRowH);
    let cx = innerX;
    tableCols.forEach((colW, colIndex) => {
      if (colIndex > 0) {
        ctx.beginPath();
        ctx.moveTo(cx, rowTop);
        ctx.lineTo(cx, rowTop + productRowH);
        ctx.stroke();
      }
      if (rowIndex === 0) drawCentered(headers[colIndex], cx, rowTop - 15, colW, 15, 900, '#111111');
      cx += colW;
    });
    drawCentered(row.qtd, innerX, rowTop + 35, tableCols[0], 18, 800);
    drawWrapped(row.produto, innerX + tableCols[0] + 16, rowTop + 28, tableCols[1] - 28, 18, 800, 2, '#111111', 2);
    drawCentered(row.unitario || '-', innerX + tableCols[0] + tableCols[1], rowTop + 35, tableCols[2], 17, 700);
    drawCentered(row.total || '-', innerX + tableCols[0] + tableCols[1] + tableCols[2], rowTop + 35, tableCols[3], 18, 900);
  });
  y += productH + 32;

  drawBlackHeader('PAGAMENTO', innerX, y, Math.floor(innerW * 0.72));
  drawBlackHeader('TOTAL', innerX + Math.floor(innerW * 0.72), y, innerW - Math.floor(innerW * 0.72));
  y += 44;
  ctx.strokeRect(innerX, y, Math.floor(innerW * 0.72), paymentH - 44);
  ctx.strokeRect(innerX + Math.floor(innerW * 0.72), y, innerW - Math.floor(innerW * 0.72), paymentH - 44);
  const methods = ['Pix', 'Dinheiro', 'Crédito', 'Débito', 'Crediário'];
  let mx = innerX + 28;
  methods.forEach((method) => {
    const active = method.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(paymentLabel(sale.payment_method).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
    drawText(active ? '●' : '♡', mx, y + 42, 24, 900, active ? '#050505' : '#888888');
    drawText(method, mx + 28, y + 42, 17, active ? 900 : 650);
    mx += 132;
  });
  if (subtotal > 0 || discount > 0) {
    drawText(`Subtotal: ${subtotal > 0 ? formatCurrency(subtotal) : formatCurrency(total + discount)}`, innerX + 28, y + 78, 16, 800);
    if (discount > 0) drawText(`Desconto: ${formatCurrency(discount)}`, innerX + 280, y + 78, 16, 800);
  }
  drawCentered(formatCurrency(total), innerX + Math.floor(innerW * 0.72), y + 58, innerW - Math.floor(innerW * 0.72), 32, 900);
  y += paymentH + 30;

  drawBlackHeader('ANOTAÇÕES', innerX, y, innerW);
  y += 44;
  ctx.strokeRect(innerX, y, innerW, notesH - 44);
  let noteY = y + 31;
  noteLines.forEach((note) => {
    wrapForWidth(`• ${note}`, innerW - 54, 17, 600).slice(0, 2).forEach((line) => {
      drawText(line, innerX + 28, noteY, 17, 600);
      noteY += 28;
    });
  });

  drawCentered('Obrigado pela preferência! · Jaque Confecções e Presentes', innerX, receiptY + receiptH - 34, innerW, 17, 700);
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
