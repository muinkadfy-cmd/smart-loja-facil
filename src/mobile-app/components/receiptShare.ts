import { api } from '../../lib/api';
import type { ReceiptSummary, SaleSummary } from '../../types';
import { formatCurrency, formatDateTime } from './format';

export type ReceiptShareFormat = 'pdf' | 'png' | 'share';

type ProductRow = { qtd: string; produto: string; unitario: string; total: string };
type ReceiptRenderData = {
  storeName: string;
  title: string;
  subtitle: string;
  status: string;
  saleNumber: string;
  customer: string;
  phone: string;
  date: string;
  payment: string;
  isCreditSale: boolean;
  subtotal: number;
  discount: number;
  total: number;
  productRows: ProductRow[];
  notes: string[];
};

const STORE_NAME = 'Jaque Confecções e Presentes';
const STORE_LOGO_URL = '/brand/jaque-receipt-logo-wide.png';
const CANVAS_WIDTH = 1080;
const RECEIPT_X = 28;
const RECEIPT_Y = 28;
const RECEIPT_W = CANVAS_WIDTH - RECEIPT_X * 2;
const INNER_X = RECEIPT_X + 28;
const INNER_W = RECEIPT_W - 56;
const BLACK = '#050505';
const INK = '#101116';
const MUTED = '#3f4652';
const PRODUCT_COLUMNS = [88, INNER_W - 88 - 142 - 154, 142, 154];
const PRODUCT_NAME_SIZE = 22;
const PRODUCT_NAME_WEIGHT = 650;
const PRODUCT_ROW_MIN_H = 98;
const PRODUCT_ROW_LINE_GAP = 8;
const PRODUCT_MAX_LINES = 3;

export function saleReceiptTitle(sale: SaleSummary): string {
  return `Comprovante #${String(sale.number || 0).padStart(4, '0')}`;
}

export function findReceiptForSale(receipts: ReceiptSummary[], sale: SaleSummary): ReceiptSummary | null {
  return receipts.find((receipt) => receipt.sale_id === sale.id || Number(receipt.sale_number || 0) === Number(sale.number || 0)) ?? null;
}

async function ensureShareSoraReady(): Promise<void> {
  const fontSet = document.fonts;
  if (!fontSet?.load) return;
  try {
    await Promise.race([
      Promise.all([
        fontSet.load('400 22px "Sora"'),
        fontSet.load('600 22px "Sora"'),
        fontSet.load('800 22px "Sora"'),
      ]),
      new Promise((resolve) => window.setTimeout(resolve, 900)),
    ]);
  } catch {
    // Mantém fallback seguro se a rede bloquear a fonte.
  }
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
  return String(value || '')
    .replace(/Smart Loja F(?:a|á)cil/gi, STORE_NAME)
    .replace(/Smart Loja/gi, STORE_NAME)
    .replace(/\s+/g, ' ')
    .trim();
}

function textFromHtml(html: string): string {
  if (typeof document === 'undefined') return cleanSystemBrand(html.replace(/<[^>]+>/g, ' '));
  const element = document.createElement('div');
  element.innerHTML = html || '';
  return cleanSystemBrand(element.textContent ?? '');
}

function safeText(value: string | number | null | undefined): string {
  return cleanSystemBrand(String(value ?? '-'))
    .normalize('NFC')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim() || '-';
}

function paymentLabel(method: SaleSummary['payment_method']): string {
  if (method === 'dinheiro') return 'Dinheiro';
  if (method === 'pix') return 'Pix';
  if (method === 'cartao') return 'Cartão';
  return 'Crediário';
}

function receiptStatusForShare(sale: SaleSummary, receipt: ReceiptSummary): string {
  const status = String(receipt.status || sale.status || '').toLowerCase();
  if (/(cancel|cancelad)/.test(status)) return 'Cancelado';
  if (/(pago|paid|quitado)/.test(status)) return 'Pago';
  if (/(parcial|partial)/.test(status)) return 'Parcial';
  if (/(venc|atras|overdue)/.test(status)) return 'Atrasado';
  if (sale.payment_method === 'crediario') return 'Emitido';
  return 'Emitido';
}

function numberFromMoney(value: string): number {
  const clean = String(value || '').replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseMoneyAfter(text: string, label: RegExp): number {
  const match = text.match(new RegExp(`${label.source}[^0-9R$-]*(?:R\\$)?\\s*([0-9.]+,\\d{2}|[0-9]+(?:\\.\\d{2})?)`, 'i'));
  return match ? numberFromMoney(match[1]) : 0;
}

function cellTexts(row: Element): string[] {
  return Array.from(row.querySelectorAll('th,td')).map((cell) => safeText(cell.textContent || ''));
}

function extractProductRowsFromHtml(html: string): ProductRow[] {
  if (typeof document === 'undefined' || !html) return [];
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  const tables = Array.from(wrapper.querySelectorAll('table'));
  for (const table of tables) {
    const firstRow = table.querySelector('thead tr') || table.querySelector('tr');
    const headers = firstRow ? cellTexts(firstRow).map((header) => header.toLowerCase()) : [];
    const productIndex = headers.findIndex((header) => /produto|item|descri/.test(header));
    if (productIndex < 0) continue;
    const qtyIndex = Math.max(0, headers.findIndex((header) => /qtd|quant/.test(header)));
    const unitIndex = headers.findIndex((header) => /un|unit/.test(header));
    const totalIndex = headers.findIndex((header) => /total/.test(header));
    const bodyRows = Array.from(table.querySelectorAll('tbody tr')).length
      ? Array.from(table.querySelectorAll('tbody tr'))
      : Array.from(table.querySelectorAll('tr')).slice(1);
    const rows = bodyRows.map((row) => {
      const cells = cellTexts(row);
      const product = cells[productIndex] || cells.join(' ');
      return {
        qtd: cells[qtyIndex] || '1',
        produto: safeText(product).slice(0, 110),
        unitario: unitIndex >= 0 ? (cells[unitIndex] || '-') : '-',
        total: totalIndex >= 0 ? (cells[totalIndex] || '-') : (cells[cells.length - 1] || '-'),
      };
    }).filter((row) => row.produto && !/^produto$/i.test(row.produto) && row.produto !== '-');
    if (rows.length) return rows.slice(0, 10);
  }
  return [];
}

function fallbackProductRows(sale: SaleSummary, receipt: ReceiptSummary): ProductRow[] {
  const total = Number(receipt.total || sale.total || 0);
  const count = Math.max(1, Number(sale.item_count || 1));
  const firstName = safeText(sale.first_product_name || `Venda #${String(receipt.sale_number || sale.number || 0).padStart(4, '0')}`);
  const label = count > 1 ? `${firstName} + ${count - 1} itens` : firstName;
  return [{ qtd: String(count), produto: label, unitario: count > 1 ? '-' : formatCurrency(total), total: formatCurrency(total) }];
}

function parseData(sale: SaleSummary, receipt: ReceiptSummary): ReceiptRenderData {
  const rawText = textFromHtml(receipt.content || '');
  const saleNumber = String(receipt.sale_number || sale.number || 0).padStart(4, '0');
  const subtotalFromSale = Number(sale.subtotal || 0);
  const discountFromSale = Number(sale.discount || 0);
  const discountFromContent = parseMoneyAfter(rawText, /desconto/);
  const subtotalFromContent = parseMoneyAfter(rawText, /subtotal/);
  const total = Number(receipt.total || sale.total || 0);
  const discount = discountFromSale > 0 ? discountFromSale : discountFromContent;
  const subtotal = subtotalFromSale > 0 ? subtotalFromSale : subtotalFromContent > 0 ? subtotalFromContent : total + discount;
  const rows = extractProductRowsFromHtml(receipt.content || '');
  const productRows = rows.length ? rows : fallbackProductRows(sale, receipt);
  const status = receiptStatusForShare(sale, receipt);
  const customer = safeText(receipt.customer_name || sale.customer_name || 'Consumidor');
  const date = formatDateTime(receipt.created_at || sale.created_at);
  const isCreditSale = sale.payment_method === 'crediario';
  const notes: string[] = [];
  return {
    storeName: STORE_NAME,
    title: `COMPROVANTE #${saleNumber}`,
    subtitle: `Venda #${saleNumber}`,
    status,
    saleNumber,
    customer,
    phone: safeText(receipt.customer_whatsapp || '-'),
    date,
    payment: paymentLabel(sale.payment_method),
    isCreditSale,
    subtotal,
    discount,
    total,
    productRows,
    notes,
  };
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, size: number, weight = 700): string[] {
  ctx.font = `${weight} ${size}px "Sora", Arial, Helvetica, sans-serif`;
  const words = safeText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : ['-'];
}

function productDescriptionLines(ctx: CanvasRenderingContext2D, text: string): string[] {
  return wrapCanvasText(ctx, text, PRODUCT_COLUMNS[1] - 36, PRODUCT_NAME_SIZE, PRODUCT_NAME_WEIGHT).slice(0, PRODUCT_MAX_LINES);
}

function productRowHeight(ctx: CanvasRenderingContext2D, text: string): number {
  const lineCount = Math.max(1, productDescriptionLines(ctx, text).length);
  return Math.max(PRODUCT_ROW_MIN_H, 40 + lineCount * (PRODUCT_NAME_SIZE + PRODUCT_ROW_LINE_GAP) + 22);
}

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  return await new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, weight = 700, color = INK): void {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px "Sora", Arial, Helvetica, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(safeText(text), x, y);
}

function drawCentered(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, size: number, weight = 800, color = INK): void {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px "Sora", Arial, Helvetica, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(safeText(text), x + width / 2, y);
  ctx.textAlign = 'left';
}

function drawLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, width = 4, color = BLACK): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, width = 4): void {
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = width;
  ctx.strokeRect(x, y, w, h);
}

function drawMiniReceiptGlyph(ctx: CanvasRenderingContext2D, cx: number, cy: number, kind: 'user' | 'phone' | 'pin' | 'bag' | 'card'): void {
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (kind === 'user') {
    ctx.beginPath();
    ctx.arc(cx, cy - 8, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy + 18);
    ctx.quadraticCurveTo(cx, cy + 4, cx + 16, cy + 18);
    ctx.stroke();
  } else if (kind === 'phone') {
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy - 13);
    ctx.quadraticCurveTo(cx - 18, cy - 2, cx - 9, cy + 10);
    ctx.quadraticCurveTo(cx + 2, cy + 20, cx + 13, cy + 11);
    ctx.stroke();
  } else if (kind === 'pin') {
    ctx.beginPath();
    ctx.arc(cx, cy - 4, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy - 4, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx, cy + 18);
    ctx.lineTo(cx - 9, cy + 6);
    ctx.lineTo(cx + 9, cy + 6);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'bag') {
    ctx.strokeRect(cx - 12, cy - 7, 24, 22);
    ctx.beginPath();
    ctx.arc(cx, cy - 8, 8, Math.PI, 0);
    ctx.stroke();
  } else {
    ctx.strokeRect(cx - 14, cy - 10, 28, 22);
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy - 2);
    ctx.lineTo(cx + 14, cy - 2);
    ctx.moveTo(cx - 8, cy + 7);
    ctx.lineTo(cx + 4, cy + 7);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPinkReceiptIcon(ctx: CanvasRenderingContext2D, x: number, y: number, kind: 'user' | 'phone' | 'pin'): void {
  const gradient = ctx.createLinearGradient(x, y, x + 52, y + 52);
  gradient.addColorStop(0, '#ff3f86');
  gradient.addColorStop(1, '#e91862');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(x, y, 52, 52, 12);
  ctx.fill();
  drawMiniReceiptGlyph(ctx, x + 26, y + 26, kind);
}

function drawMetaReceiptIcon(ctx: CanvasRenderingContext2D, x: number, y: number, kind: 'calendar' | 'tag'): void {
  ctx.fillStyle = '#faedf2';
  ctx.beginPath();
  ctx.arc(x + 22, y + 22, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#f2d3dd';
  ctx.stroke();
  ctx.save();
  ctx.strokeStyle = '#111111';
  ctx.fillStyle = '#111111';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (kind === 'calendar') {
    ctx.strokeRect(x + 11, y + 14, 22, 19);
    ctx.beginPath();
    ctx.moveTo(x + 16, y + 11);
    ctx.lineTo(x + 16, y + 17);
    ctx.moveTo(x + 28, y + 11);
    ctx.lineTo(x + 28, y + 17);
    ctx.moveTo(x + 11, y + 20);
    ctx.lineTo(x + 33, y + 20);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + 17, y + 25, 1.6, 0, Math.PI * 2);
    ctx.arc(x + 23, y + 25, 1.6, 0, Math.PI * 2);
    ctx.arc(x + 29, y + 25, 1.6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(x + 12, y + 22);
    ctx.lineTo(x + 22, y + 12);
    ctx.lineTo(x + 32, y + 22);
    ctx.lineTo(x + 22, y + 32);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + 20, y + 20, 2.2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function fillBlackHeader(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, w: number, h = 54): void {
  ctx.fillStyle = BLACK;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x + 30, y + h / 2, 24, 0, Math.PI * 2);
  ctx.fill();
  const kind = label.toLowerCase().includes('parcela') ? 'card' : 'bag';
  ctx.save();
  ctx.strokeStyle = '#e91862';
  ctx.fillStyle = '#e91862';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (kind === 'bag') {
    ctx.strokeRect(x + 18, y + h / 2 - 8, 24, 22);
    ctx.beginPath();
    ctx.arc(x + 30, y + h / 2 - 9, 8, Math.PI, 0);
    ctx.stroke();
  } else {
    ctx.strokeRect(x + 16, y + h / 2 - 11, 28, 22);
    ctx.beginPath();
    ctx.moveTo(x + 16, y + h / 2 - 3);
    ctx.lineTo(x + 44, y + h / 2 - 3);
    ctx.moveTo(x + 22, y + h / 2 + 7);
    ctx.lineTo(x + 34, y + h / 2 + 7);
    ctx.stroke();
  }
  ctx.restore();
  drawText(ctx, label, x + 72, y + 34, 22, 900, '#ffffff');
}

function drawWrapped(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, size: number, weight = 700, maxLines = 2, lineGap = 7): number {
  let cursor = y;
  wrapCanvasText(ctx, text, maxWidth, size, weight).slice(0, maxLines).forEach((line) => {
    drawText(ctx, line, x, cursor, size, weight);
    cursor += size + lineGap;
  });
  return cursor;
}

function drawStatusBadge(ctx: CanvasRenderingContext2D, status: string, x: number, y: number, w = 132, h = 36): void {
  const clean = safeText(status).toUpperCase();
  const isPaid = clean.includes('PAGO') || clean.includes('PAGA') || clean.includes('QUIT');
  const isPartial = clean.includes('PARCIAL');
  const isCancel = clean.includes('CANCEL');
  const isOpen = clean.includes('ABERTA') || clean.includes('ABERTO');
  const label = isPaid ? 'PAGO' : isPartial ? 'PARCIAL' : isCancel ? 'CANCELADO' : isOpen ? 'ABERTA' : clean;
  ctx.fillStyle = isPaid ? BLACK : isOpen ? '#e91862' : '#ffffff';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = isPaid ? BLACK : isPartial ? '#9a5a05' : isCancel ? '#8a1c1c' : isOpen ? '#e91862' : BLACK;
  ctx.lineWidth = 4;
  ctx.strokeRect(x, y, w, h);
  const fontSize = label.length >= 7 ? 17 : 18;
  drawCentered(ctx, label, x, y + Math.round(h * 0.62), w, fontSize, 800, isPaid || isOpen ? '#ffffff' : isPartial ? '#8a5206' : INK);
}


async function ensureSoraReceiptFont(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  await Promise.allSettled([
    document.fonts.load('400 19px "Sora"'),
    document.fonts.load('600 19px "Sora"'),
    document.fonts.load('850 24px "Sora"'),
  ]);
}

async function renderReceiptCanvas(data: ReceiptRenderData): Promise<HTMLCanvasElement> {
  await ensureSoraReceiptFont();
  const productRows = data.productRows.slice(0, 8);
  const measurer = document.createElement('canvas').getContext('2d');
  if (!measurer) throw new Error('Canvas indisponível para medir comprovante.');
  const productRowHeights = productRows.map((row) => productRowHeight(measurer, row.produto));
  const productsTableH = 64 + productRowHeights.reduce((total, itemHeight) => total + itemHeight, 0);
  const discountBlockH = data.discount > 0.009 ? 104 : 0;
  const receiptH = 316 + 236 + 26 + 54 + productsTableH + 26 + discountBlockH + 132 + 32 + 86;
  const height = receiptH + RECEIPT_Y * 2;
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível para gerar comprovante.');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(RECEIPT_X, RECEIPT_Y, RECEIPT_W, receiptH);
  drawRect(ctx, RECEIPT_X, RECEIPT_Y, RECEIPT_W, receiptH, 5);

  const logo = await loadImage(STORE_LOGO_URL);
  if (logo) {
    ctx.drawImage(logo, INNER_X + 4, RECEIPT_Y + 16, 410, 214);
  } else {
    drawCentered(ctx, data.storeName.toUpperCase(), INNER_X, RECEIPT_Y + 130, 410, 27, 900);
  }
  drawCentered(ctx, data.storeName.toUpperCase(), INNER_X + 4, RECEIPT_Y + 250, 410, 20, 900);
  drawLine(ctx, INNER_X + 22, RECEIPT_Y + 282, INNER_X + 192, RECEIPT_Y + 282, 2);
  drawCentered(ctx, '♥', INNER_X + 190, RECEIPT_Y + 288, 44, 24, 900, '#e91862');
  drawLine(ctx, INNER_X + 236, RECEIPT_Y + 282, INNER_X + 416, RECEIPT_Y + 282, 2);

  const titleX = INNER_X + 492;
  const titleW = INNER_W - 512;
  let titleY = RECEIPT_Y + 98;
  wrapCanvasText(ctx, data.title, titleW, 54, 950).slice(0, 2).forEach((line) => {
    drawCentered(ctx, line, titleX, titleY, titleW, 43, 950);
    titleY += 46;
  });
  drawLine(ctx, titleX, titleY - 14, titleX + titleW, titleY - 14, 4);
  drawMetaReceiptIcon(ctx, titleX + 6, titleY + 4, 'calendar');
  drawText(ctx, `${data.subtitle} - ${data.date}`, titleX + 64, titleY + 36, 20, 700, MUTED);
  drawMetaReceiptIcon(ctx, titleX + 6, titleY + 60, 'tag');
  drawText(ctx, 'Status:', titleX + 64, titleY + 92, 24, 750);
  drawText(ctx, data.status, titleX + 148, titleY + 92, 24, 850, '#e91862');

  let y = RECEIPT_Y + 316;
  drawRect(ctx, INNER_X, y, INNER_W, 236, 4);
  const labelX = INNER_X + 86;
  const valueX = INNER_X + 318;
  const splitX = INNER_X + 292;
  drawLine(ctx, splitX, y, splitX, y + 236, 2);
  drawLine(ctx, INNER_X, y + 78, INNER_X + INNER_W, y + 78, 2);
  drawLine(ctx, INNER_X, y + 156, INNER_X + INNER_W, y + 156, 2);
  drawPinkReceiptIcon(ctx, INNER_X + 18, y + 14, 'user');
  drawPinkReceiptIcon(ctx, INNER_X + 18, y + 92, 'phone');
  drawPinkReceiptIcon(ctx, INNER_X + 18, y + 170, 'pin');
  drawText(ctx, 'CLIENTE', labelX, y + 50, 23, 950);
  drawWrapped(ctx, data.customer, valueX, y + 56, INNER_W - 350, 36, 950, 1);
  drawText(ctx, 'TELEFONE', labelX, y + 128, 23, 950);
  drawText(ctx, data.phone || '-', valueX, y + 128, 27, 850);
  drawText(ctx, data.isCreditSale ? 'TIPO' : 'FORMA', labelX, y + 206, 23, 950);
  drawText(ctx, data.isCreditSale ? 'Venda no crediário' : data.payment, valueX, y + 206, 27, 900);

  y += 262;
  fillBlackHeader(ctx, 'PRODUTOS COMPRADOS', INNER_X, y, INNER_W, 54);
  y += 54;
  const columns = PRODUCT_COLUMNS;
  const headers = ['QTD', 'PRODUTO', 'R$ UN', 'TOTAL'];
  const headerGradient = ctx.createLinearGradient(INNER_X, y, INNER_X + INNER_W, y + 64);
  headerGradient.addColorStop(0, '#f04f7d');
  headerGradient.addColorStop(1, '#e12b67');
  ctx.fillStyle = headerGradient;
  ctx.fillRect(INNER_X, y, INNER_W, 64);
  let x = INNER_X;
  headers.forEach((header, index) => {
    drawCentered(ctx, header, x, y + 43, columns[index], 23, 950, '#ffffff');
    x += columns[index];
  });
  const tableH = productsTableH;
  drawRect(ctx, INNER_X, y, INNER_W, tableH, 4);
  x = INNER_X;
  columns.slice(0, -1).forEach((w) => {
    x += w;
    drawLine(ctx, x, y, x, y + tableH, 3);
  });
  let rowY = y + 64;
  productRows.forEach((row, index) => {
    const rowH = productRowHeights[index] ?? PRODUCT_ROW_MIN_H;
    drawLine(ctx, INNER_X, rowY + rowH, INNER_X + INNER_W, rowY + rowH, 3);
    drawCentered(ctx, row.qtd, INNER_X, rowY + Math.floor(rowH / 2) + 10, columns[0], 22, 650);
    let productTextY = rowY + 43;
    productDescriptionLines(ctx, row.produto).forEach((line) => {
      drawText(ctx, line, INNER_X + columns[0] + 18, productTextY, PRODUCT_NAME_SIZE, PRODUCT_NAME_WEIGHT);
      productTextY += PRODUCT_NAME_SIZE + PRODUCT_ROW_LINE_GAP;
    });
    const valueY = rowY + Math.floor(rowH / 2) + 10;
    drawCentered(ctx, row.unitario || '-', INNER_X + columns[0] + columns[1], valueY, columns[2], 22, 650);
    drawCentered(ctx, row.total || '-', INNER_X + columns[0] + columns[1] + columns[2], valueY, columns[3], 22, 650);
    rowY += rowH;
  });
  y += tableH + 28;

  if (data.discount > 0.009) {
    const gap = 16;
    const boxW = (INNER_W - gap * 2) / 3;
    const items: Array<[string, string, string]> = [
      ['SUBTOTAL', formatCurrency(data.subtotal || data.total + data.discount), BLACK],
      ['DESCONTO', formatCurrency(data.discount), '#e12b67'],
      ['TOTAL FINAL', formatCurrency(data.total), BLACK],
    ];
    items.forEach(([label, value, color], index) => {
      const x = INNER_X + index * (boxW + gap);
      drawRect(ctx, x, y, boxW, 78, 3);
      drawCentered(ctx, label, x, y + 28, boxW, 16, 900, INK);
      drawLine(ctx, x + 14, y + 38, x + boxW - 14, y + 38, 2, '#e85f8a');
      drawCentered(ctx, value, x, y + 65, boxW, 24, 850, color);
    });
    y += 104;
  }

  const paymentGap = 14;
  const paymentW = data.isCreditSale ? Math.floor(INNER_W * 0.58) : Math.floor(INNER_W * 0.68);
  const totalW = INNER_W - paymentW - paymentGap;
  fillBlackHeader(ctx, data.isCreditSale ? 'RESUMO DO CREDIÁRIO' : 'PAGAMENTO', INNER_X, y, paymentW, 54);
  fillBlackHeader(ctx, 'TOTAL', INNER_X + paymentW + paymentGap, y, totalW, 54);
  y += 54;
  drawRect(ctx, INNER_X, y, paymentW, 112, 4);
  drawRect(ctx, INNER_X + paymentW + paymentGap, y, totalW, 112, 4);
  if (data.isCreditSale) {
    drawText(ctx, 'Venda registrada no crediário', INNER_X + 28, y + 42, 24, 900);
    wrapCanvasText(ctx, 'Acompanhe vencimentos e pagamentos na aba Crediário.', paymentW - 56, 20, 700).slice(0, 2).forEach((line, index) => {
      drawText(ctx, line, INNER_X + 28, y + 78 + index * 27, 20, 700, MUTED);
    });
  } else {
    const methods = ['Pix', 'Dinheiro', 'Cartão'];
    const activePayment = data.payment.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let methodX = INNER_X + 28;
    methods.forEach((method) => {
      const methodKey = method.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const active = activePayment.includes(methodKey) || (methodKey === 'cartao' && activePayment.includes('cart'));
      drawText(ctx, active ? '●' : '♡', methodX, y + 44, 30, 950, active ? BLACK : '#888888');
      drawText(ctx, method, methodX + 38, y + 44, 23, active ? 950 : 750);
      methodX += 165;
    });
  }
  drawCentered(ctx, formatCurrency(data.total), INNER_X + paymentW + paymentGap, y + 72, totalW, 42, 900);
  y += 146;

  drawLine(ctx, INNER_X, RECEIPT_Y + receiptH - 64, INNER_X + INNER_W / 2 - 28, RECEIPT_Y + receiptH - 64, 2);
  drawCentered(ctx, '♥', INNER_X + INNER_W / 2 - 28, RECEIPT_Y + receiptH - 56, 56, 22, 900, '#e91862');
  drawLine(ctx, INNER_X + INNER_W / 2 + 28, RECEIPT_Y + receiptH - 64, INNER_X + INNER_W, RECEIPT_Y + receiptH - 64, 2);
  drawCentered(ctx, 'Obrigado pela preferência! - Jaque Confecções e Presentes', INNER_X, RECEIPT_Y + receiptH - 34, INNER_W, 20, 800);
  return canvas;
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: 'image/png' | 'image/jpeg', quality = 0.96): Promise<Blob> {
  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Não foi possível finalizar o arquivo.')), type, quality);
  });
}

function binaryFromDataUrl(dataUrl: string): string {
  const base64 = dataUrl.split(',')[1] || '';
  return atob(base64);
}

function makePdfFromJpeg(jpegData: string, imageWidth: number, imageHeight: number): Blob {
  const pageW = 595;
  const pageH = 842;
  const margin = 30;
  const ratio = Math.min((pageW - margin * 2) / imageWidth, (pageH - margin * 2) / imageHeight);
  const drawW = Math.round(imageWidth * ratio);
  const drawH = Math.round(imageHeight * ratio);
  const drawX = Math.round((pageW - drawW) / 2);
  const drawY = Math.round((pageH - drawH) / 2);
  const content = `q\n${drawW} 0 0 ${drawH} ${drawX} ${drawY} cm\n/Im0 Do\nQ`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>',
    `<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegData.length} >>\nstream\n${jpegData}\nendstream`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
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
  const bytes = new Uint8Array(pdf.length);
  for (let index = 0; index < pdf.length; index += 1) bytes[index] = pdf.charCodeAt(index) & 0xff;
  return new Blob([bytes], { type: 'application/pdf' });
}

async function makePngBlob(sale: SaleSummary, receipt: ReceiptSummary): Promise<Blob> {
  const canvas = await renderReceiptCanvas(parseData(sale, receipt));
  return await canvasToBlob(canvas, 'image/png', 0.98);
}

async function makePdfBlob(sale: SaleSummary, receipt: ReceiptSummary): Promise<Blob> {
  const canvas = await renderReceiptCanvas(parseData(sale, receipt));
  const jpegData = binaryFromDataUrl(canvas.toDataURL('image/jpeg', 0.93));
  return makePdfFromJpeg(jpegData, canvas.width, canvas.height);
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

async function shareFile(file: File, _title: string): Promise<boolean> {
  const payload = { files: [file] } as ShareData & { files: File[] };
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
    if (shared) return 'PNG enviado apenas como imagem, sem texto ou link junto.';
    downloadBlob(blob, fileName);
    return `PNG baixado como ${fileName}. Anexe essa imagem no WhatsApp.`;
  }
  const blob = await makePdfBlob(sale, receipt);
  const fileName = uniqueFileName(`comprovante-venda-${receipt.sale_number || sale.number}`, 'pdf');
  const shared = await shareFile(new File([blob], fileName, { type: 'application/pdf' }), title);
  if (shared) return 'PDF enviado apenas como arquivo, sem texto ou link junto.';
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
