import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { creditPaymentMethodLabel, remainingInstallmentAmount } from '../../lib/creditPaymentGuard';
import type { AppStatus, CreditInstallment, CreditSummary, PageKey, ReceiptSummary, Settings } from '../../types';
import { EmptyState } from '../components/EmptyState';
import { InlineIcon } from '../components/InlineIcon';
import { StatCard } from '../components/StatCard';
import { formatCurrency, formatDateTime, formatNumber } from '../components/format';
import { notifyMobileAction } from '../components/actionToast';

interface ReceiptsScreenProps {
  status: AppStatus | null;
  refreshToken: number;
  onNavigate: (page: PageKey) => void;
  onRefresh: () => void;
}

type Feedback = { tone: 'success' | 'error' | 'info'; text: string };
type ReceiptPrintFormat = 'a4';
type ReceiptVisualTone = 'paid' | 'partial' | 'pending' | 'overdue' | 'danger' | 'neutral';
type ReceiptFilter = 'todos' | 'vendas' | 'crediario' | 'parcelas' | 'pedidos' | 'caixa' | 'cancelados';
type ReceiptPreviewKind = 'salvo' | 'nota' | 'parcela';
type ReceiptStoreInfo = Pick<Settings, 'store_name' | 'phone' | 'whatsapp' | 'receipt_message'> & { logo_url?: string };

const DEFAULT_RECEIPT_LOGO_URL = '/brand/jaque-receipt-logo-wide.png';

type ReceiptView = ReceiptSummary & {
  source_kind?: ReceiptFilter;
  installment_number?: number;
  installment_total?: number;
  installment_due_date?: string;
  installment_paid_amount?: number;
  installment_remaining?: number;
};

type CreditCustomerGroup = {
  customerKey: string;
  customerName: string;
  contact: string;
  credits: CreditSummary[];
  total: number;
  paid: number;
  balance: number;
  notesCount: number;
  openNotes: number;
  overdueInstallments: number;
  partialInstallments: number;
};

type ReceiptPreview =
  | { kind: 'salvo'; id: string; title: string; customer: string; createdAt: string; total: number; status: string; html: string; phone: string; fileStem: string }
  | { kind: 'nota'; id: string; title: string; customer: string; createdAt: string; total: number; status: string; html: string; phone: string; credit: CreditSummary; fileStem: string }
  | { kind: 'parcela'; id: string; title: string; customer: string; createdAt: string; total: number; status: string; html: string; phone: string; credit: CreditSummary; installment: CreditInstallment; fileStem: string };

const receiptFilters: Array<{ key: ReceiptFilter; label: string }> = [
  { key: 'todos', label: 'Todos' },
  { key: 'vendas', label: 'Vendas' },
  { key: 'crediario', label: 'Crediário' },
  { key: 'parcelas', label: 'Parcelas' },
  { key: 'pedidos', label: 'Pedidos' },
  { key: 'caixa', label: 'Caixa' },
  { key: 'cancelados', label: 'Cancelados' },
];

const RECEIPTS_FOCUS_SALE_KEY = 'smart-loja:receipts-focus-sale-v1';

type ReceiptFocusPayload = { sale_number?: number; credit_id?: string; created_at?: number };

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

function safeWhatsapp(value: string): string {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') ? digits : `55${digits}`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function openHtmlDocument(html: string, fileStem: string): 'opened' | 'downloaded' {
  const safeName = `${fileStem || 'comprovante'}.html`.replace(/[^a-z0-9._-]+/gi, '-').replace(/-+/g, '-');
  const documentHtml = html || '<!doctype html><html lang="pt-BR"><body><p>Comprovante sem prévia HTML salva.</p></body></html>';
  const blob = new Blob([documentHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const cleanup = () => window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);

  const popup = window.open(url, '_blank', 'noopener,noreferrer');
  if (popup) {
    cleanup();
    window.setTimeout(() => { try { popup.focus(); } catch { /* sem ação */ } }, 80);
    return 'opened';
  }

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.download = safeName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  cleanup();
  return 'downloaded';
}

function wrapPdfLines(text: string, max = 84): string[] {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E\n]/g, ' ')
    .replace(/[ 	]+/g, ' ')
    .trim();
  const lines: string[] = [];
  for (const sourceLine of normalized.split(/\n+/)) {
    let line = sourceLine.trim();
    while (line.length > max) {
      const cut = line.slice(0, max + 1).lastIndexOf(' ');
      const index = cut > 24 ? cut : max;
      lines.push(line.slice(0, index).trim());
      line = line.slice(index).trim();
    }
    if (line) lines.push(line);
  }
  return lines.slice(0, 54);
}

function pdfEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

const PDF_LOGO_JPEG_BASE64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAQDAwMDAgQDAwMEBAQFBgoGBgUFBgwICQcKDgwPDg4MDQ0PERYTDxAVEQ0NExoTFRcYGRkZDxIbHRsYHRYYGRj/2wBDAQQEBAYFBgsGBgsYEA0QGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBj/wAARCAB4AK0DASIAAhEBAxEB/8QAHAAAAgMBAQEBAAAAAAAAAAAAAAcFBggEAwIB/8QARRAAAQMCBQEFBgMGAwQLAAAAAQIDBAURAAYHEiExEyJBUWEIFDJxgZEVUqEjQmJyscGCstEWM5KiFyRDU1Rzg8LD4fD/xAAcAQABBQEBAQAAAAAAAAAAAAAFAAIDBAYBBwj/xAA3EQABAwIEBAMHBAIBBQAAAAABAgMRAAQFEiExQVFhcQaBkRMiobHB0fAUMkJyFTMWU2KS4fH/2gAMAwEAAhEDEQA/AN/YMGDCpUYMGDCpUYMGDCpUYMGDCpUYMGDCpV+EgC5Nhj9xQ9SMyyaFRT7yxJiU1zuuVNhIdLSuqE7bgpuoAbjceHUjHujPppWS6fV820qRTZMwhDcVNlLcVt3fCSNlwCdqjcdOuGhUqyiiKcLfWyh5AnMSABvp+a8tJiRVazzqXlqNn9rJ9Qqc6GiOpC5Smo7hbWpQulKlpHCQCCbeNr9MWx/NlKpCYC0TUyIUhaWu0C94QCdoVfyB6/XywktR85RJmaWa9E0ur8vuhuS88lAQ6gDg2TuBUOnxAWwrhU6q/LfdydljNrMB9RLsF+Kp1hBPBU24T3VD5kcWx53jTt9h9y7dJTBJTCjOXKD+3kmR6me9egWvhJq6tmSqUAD3pKSCrjqDIPKZ0gaVuGo1KJS4Cpc10NoBCRxcqUeiQPEnyxzJlSJMD3kSERQpNwkgKI+Z/wBMZJzfrfIfzqii0qa5FEeM2iOrMl0lhyxCyUoSCpXT4vXwOP1yUlqiPVTOmt8CeuSnskU2OUJbTfwF+U/MW9Tiw/4kdefISnK1Hu75lE8RHDkJHPoBqPA7yGkLfXlKuilfAAgdZI+p1VlauSazFltzWENSYj5ZVsvZxNgUrAPS9zx6HE/hTaFZZgZfytOlxcww6mqoOJdLMOWmQ1HCQQAClRG43ubcdBza+GdHnx5MyTHbcBWwpKVjyJF8azCy8i1aTdqlyI10J8ucb1lMXtmmbx1u3OZCeMRynTvXXgwYMEqF0YMGDCpUYMGDCpUYMGDCpUYMeEuYxCjLfkLCUpBJwgtWfaFp+UIamGXtjyweyZa7zzvqAfhH8SuPQ46BxolhmE3OJOezt0z14CnjVcwUaiR1PVOoMR0jruUL4WNZ16p0d15uhUOTUUo494ccDbd/kATjMuRpOePaA1IDVRqkihZVjHtKhLacKTt8Gg6rq4ryFrAE24x663ZkhZfUnJWSW3GhKPZMttm60MX2pSPHco+PX6nDklETW+wzwhZN3P6a5JcWBJiQlPcjWfOmwfa/po1BgUNvLj8yK4oNSjBCn3m1/vFAHx2/KAT15vjS0KbHqEBqZGUS06kLTuSUkAi9iDyDz0PTGdtAdCYWWMut1OqspVVH0gyH7XIvz2SD4JHj5n6W0VHiR4jIbYbDaEjgDDJmsv4nThjbwaw9EZdCZJB9aj6mzS69Fdo0wtOtubVFskHdsWFcediBhUe0zHkf9HNPqXZ7oUOXeSRyobxtQQkcnk+HTDej0yA3WH6ow0gSHkpQ4sde7f8A/H5DyxQNepbcTSlC3fhVPYTz9T/bELJdSklyJ125cKj8MvFvFrb2evvDQ9dD8PkO1Y8i5jgskmBWRHcAvZDxZV9rjGtK/UXaV7Nz7rEwuOtUdtlL6F7j2ikJRuCvO6uuM6PqpFSQWXocSQpfdTvbSo3PA8MW3UvKdApemqkw2FRFuPx46uwcLe7vAnp6JOMp4jvFruLS3A/crXtIH1r1zxHbN39xatuSk5uUzqOMj61CRomW32yxUMrUqSi/JQlTKj6kpNifUjFSzCqDSNQ6RQcsU5MaNM2Kfbkq95tdZBCbgADak4j48GpRxenZnqDQHREja8n/AJhfENl9VQzJqW1MrMnt0x2XFHYns07UJsOn82D2IpT+kdWtIISk8OMaVoFWhZJczEiNpMeh0rQHs8U6Y7qBnasxXzFYYSinx3dl2gsrupIHAuNqb25G71w3abKrz2blxWYrFOVA/ZypKdzvvBUdwABPeuDuueRfFJ0AytTF+zkxMqkVwsS570+zQVcjtbAd3kpIQAR4gnD7iwI0dSnWmgkrsTxa1gAP0GIX8IS8tkqUR7ONidYEeWsbROxrxXxJiaFYg+SMxnLttlAHnOuhGle0dalx0qWoKVbkgWx64+UoSkkgAE8nH1gyNKxR30owYMGFXKMfhNkk2J+WP3HBPqkeFIYZdXtLirE+CR0BJ8Bewv5nEbjqWk5lmBTkpKjAqi1PUpiDnqNDLb5/aGGqlhhZluKUNwdSi3KRt8+QSb8WwwjKQIQkFC0ggEJULKuegtiClZUiy81sZhXtE1mIuIhzbyEqWlR/ofuceGdJjtHyo24lZNl7N/qUkD+/1w5sE70VcRb3KmWrYQo6HvVC151ch6a6cvPNhuTWqgFR4jKuQDblRH5U/qcZI0k0srmtOd38wZkkyXKYl7/rD5NlyV/92g/upAtcjoOBz0/df51UzPrlBpK3FFJYYYihXS7irEj6/wBMbKypR6VpfokhcFpKBFjBpnjlSzxc+ZJO4/XDXASrIK9Dy/8AHsNbbthL7x377enz1qnZlFCylSBQKVHYh0uktEuIaSEp3AXJt6Dj5388IbQ2gSdUdfZ+c6i2VxYjt2AoXAWeED/CgFXzIx3a1ZqXC0+kRkvH3ipu9je/O095Z+39cNX2f6LJyHonBq/4fZb4L7rzqeC454AcbrJ2p6gCx5w9Q1CBwq++leGYWrKZcX7oPEk7+prSsSM1Dhtx2UhKEJCQBj2wjKFro1X80z6bSJ8OomAAuW2y0VJaSVbfjHF78cE84u2XNUqLWM5uZVluNRKn7oqeyhStocaSras89Cng2ueDfwOHRpNeXXeB3rAUtxMxqener4AB0AGKdqZkJrUbJP4A7U3acUPokofbbDllJBFikkXFlHxGI/P+oD2VqF+IJDcSOpKlJkSLA7U9VkH4U+VwSfTCx0312rGd6jVZcGW7IpdN2IcfkQkpbfcXfahuxSq9kqVzYWHqMdA2q7heE4ghIxK2UElBkHjM8BBG/OqUdDs75azbBkPuw6hTmJSFuuNlTa9iVAmySCCeOm7HbrU5Pm5PgMU2mz3ymd2rwajrUUJDagCbDpdWHZlTVKNmzNtZyihDDdWprLUpaiglsMuA8kX+JJFiL87knzxW3NS6PD1soOQ63HjvuV0OpbWltKVMLSLoJ2+CyFJ58bc9cDLrC2ri5avHCczew4eelbBvxJibl2l68aClsjNA0kRM6VkH8RdaJacUWl9ClwFBH0POL1pTp/mCuS6lJRTpMePKjKjsSFt9dx5UlJsSAAPT1xovPdSyvRauuKqjQpKmk9ortQVWFri5tZPT14scWbKGc8sVzT6lV7KYjj8TYLqPeFWDG0lKu0PWyVJIsPiI48SCN20LhksrEBUbdCDRnF/HD79khbNqU59iTpz+leGWaJmzK+Rqdlag0xhqNCYDCHpj4SpVuqjtB5JJPAx8yKZrKD20aoZZXY37FT8kXH823r9MJbMOsVZna003IsSvVNyozHdizAe7FqIjaVBSgnrwLkeCeSfN16TagjNcao0CpTUv1ukKb7e6bKWy4nc2s24J+JJt4p9cQrtW1yVGfM/npWHxCwu7No3a0oUTqrQk+8dzPWo1rUnNGW67EpefssO0hMpwMRp6XxIhvuHhKO2HLSj4bxY+nXDSp8+PU6e3MjFWxVwUrFlIUDYpUPAg3BGOXMdAp+aMqT8v1RlLsSayplwEXtccKHkQbEHwIGKjpfKlLhOx5j/aurhQ5SyeqnFN7HFH1UWwr5k4pCbV9DYUSlciDrBAnTpAOnaOMhHxb3dsq4aQELRGYCYIOgImSOup26wGFgx8KdaQ4lCnEJUr4UkgE/LH3glNBKDyMUjM2X50+qx0QKhKZiSndk9ppfxIAJ7v5SSNpt4HzxdyLixx5Nx2mlKUhIBUdx+eKt5ZNXaPZvCR+fPY9Ks21yq3VnTv+fgryisM0+nNstIUlDaQANxWeB5m5OPypQIlVo8inzWg7HfQULQrxH9j5HwOKDqFq1AybH7OLGTKfLZc7Z5WxhCQbFRV1V0PTj1xjvUL2k81ZjfdhU6ovOMqO24u2z142tptu+asW0oS2kDYVqMF8I32JAXE5EzOY7+Q+5FW/UzSWZGz/DqDuq9OXDgSA9GRObS7IjgKCrbm7FY4/esfPzw09Q87wqvknL0WkSC7GfbMsr2lO9IJQk28rhdvMAYzPlbR3UvUiY1OzBJepVJUe0dkziUlLY5UpLQ8gCebYZeZ6tTqfGmVkMiPSKdHS1GjdNjDaQhloepASPmScdaCSSuvRE2LTlwylx32imZJMACToBA4nffh1qsRcuRdRtaS3WiVZcy3HQ9NbCre8OrN0MA+BVYXPglK/G2J7XnVOvzYdL01y26Uy5yQgtxQGw00o7UoSB03ci/gkYi9J3JMvS1yotq7WfVq1KkSdv5kIbCE/IBxZ/xYkaTkyTRtfMy6lZ7jKgZdpiQIMh8gCZ3UpQGebm6R1HTcfHjDVyUyOPyp10Wjce3f1KZyJ6jTQcyfhHKmBp9p5SdKtMkwS4lyrVFCJdSlKNrhIOxAH7qU3UfXcCcLXTOSvMmqmYNXZi1GPAcVSqI0T3VLKTuWfMIQb2/M6nyxPasZgzMrLdfMaNJkSZJMOOlhoklS1BuyQPAAqt8hiW01yoxS9F6FRZqmzJjF9UoR1hQQ8t0laSR1UlIQg+qbY6EjMEcBrVH2ZaZK7hUqdIzRyiSO2ye1K/Vev5h1N1Ngab0uY87ZSXJrq1FQva/e/hQk3t4kjDldpeW9JtPkZdpyQ1HpzSpk51Rut6QUgqUs/mACU26C3GKfkbKM/TjOObM85kEOVVJkpwUpll5L4U1vKu2Xt+FAujunkkAEDFB1izfKmUJFIXJUZNUf/bLJuSi9yT8yRjiUkBTqqvM2ovFIDX+lHLif/Q07npTQ0qnO0PJL2Yp6LVnNz5qkhR4U3HuURmvlt3L+S04hdDEuahe09XdUZ5vBo6VMQCeQlRSUgj5I3q+axibzJRK7Op2YoWWIC3noUNyDBabISe42Gm0puRzsFx/944MihOm2nzWRI77AzKYn4nVWG1hfY7nEoDZUDYq7yb24smw8cJSDKUVQeZQ40ttoj2roE9ArfyAgDyFRvtC5nlUukT3EPXmVZwsshJ5Sg9bfJPH1GGTSclDS/wBmilw47EqfWGWA85DZSXFSJToKy2lI54JCR8ifE4z9nmFWsy6nQqvXlJgUCjoademSBZskr3bED95SrJTYfXDl1ZrGY87adzaflQyW6o2kSGW4zm1x+yhvQgg3JKCqw6mxA62w/wB4qUrloKmv7R1It2EkBCP3HhoIHlG/rS5pAoujdMqWas7z49Q1ArCXN0KO6l1UNC/iRcEjeropXRKe6Lm+GT7JtIr87MVf1DrLa21VspDSSCB2SL2I/huQB6Jv44pGnGiGT6blpjPOpcx5Sy0JK4tRuylBtchSFd5RB4732xNacan5gzp7VUKTkxtUPKVLjOMSW1jah2Of3lDoFFYRsHgEn1xAkwBwFVsUm4tLhpj3jHvLOg02Sn87yTWvcwT/AMNy5KkhYS5sKGiTbvq4T+pv9MKmh5riZeYq1U7VlvtQmNF7U2bbZjpst5Z8EJ3G/mbJHJxE6xaoQ4LaYoeWhKDZptJ7ziyOVWPSw6X6XucV7JuV5FZpH+2eoF6fl1na6zT18GbsuptJSf8Ask8kJPxKJWryxlXbtd5eF5kwhsEJJ2k/uX2SNBzJ5Vm8MwIMYcbi80SsjTiriEpHEk+nGN6l5UrNmYWmc3O1GbSqfJc92pFLJCH6gpwFIkyVHlIAO9CBYJSi5xoCDOhVCEmTAmsS2DcB5hxK0qI4PKeMJp6kQ83wpeoOo6VwsqQmVOQaQ6ShKmQOXHR1UV8BKPHxHetjr9nyimiZMqb3u6oMebLL7cLomOSSooA/hCkIPqjBrD2gzqB+7nvA4nqZnzAqnjNu0/Zl0EJU0QMoAy+9/HNOpSBKjB1J1iKceFdq5n5WW47VFhFJlSWytzdyAk8AH0PJPyA8ThlmXGE4QjIa95KO0DO8b9t7btvW1+L4zDr+zNg6rty30qEeZEQWFeB2cKHzBN7eowZaAUqqfg/Dmr7EkNP7QSBzI4fXyrPGumpNczlnI0+ZKAjRG0tqaaTsRcC+0JH7ov087nDv9nn2fokWmRs3ZojIcqDqA82h5N0xEEXFgf37ck+HQeJwr8yZBh5wmQKnTJLNOqDLaWpIeQXGpG03Qvu8pVbuqHINgeDfD5rutcKg5UbgOTIdNbQgBxaV3cWrx2p6/K+IVtqKzm2r07G0XZtkWOGIy8D0A+++nnV7zbOpiIL1AgtpSyRtkKJtcDmx+drn0t5kYxXqxmlvOGbY+S8mtmTERICSWeRLkfCLfwJ5sfMqPS2PXO+r1ezvI/2aypHltRX1bD2QJflenHIB8vvhk5DyJkzRhbdZz7W238yOJsIMRoOe7cctpUfiX4KKQQOl+t61zdNswjnwAk1Dh9gMHaAUStxUwkSSTzMf/B3qz0PSHOGS9G4juSkRZdXYPbyY0sHsZalCy7KuNihwEnoQLHwIVtXyHrlqhXWoWY6T+DU9pd+zBSlpB/MEpUStXkSbfLGg2tfZr0cM0HIGa5zAG1KxDSlNvMXTjqpurmZ/eQ4vTKutDzciC/3Sf7YrfridPZLjsPvNDmbnGWCtxxhGY7SpII+NJvO9G1/ppFEocJFQiONhCKrHShEkCwBDhKgEq694DnrwcfGW9MNackabOu5eqjD0510vu0uUkONC45KFq6L8TzY/S50Yzqkt5AVU8jVXffqmOq4+4/viZOpeXfwh1TlPqcXY0peyRDWEggX5PliZN22o6kg9QR8xQ9zHMTQgN/pUnXWIM+hNZcodAz5EyxOrWd+3erlVe7Io3JUmLEaN9oCeE73eSB4NJvhd5JormpXtEFwIL1NpneHF0nabIH1Xc/JOHNqvqDSWcoV0U2pR0y1x1sxSXkjd4XTzySLnjxOPz2T8v06l5ZRUZzzaJU9wyFbwb7BwhP2uf8WLNw6hoJQtQHc1p1Xz1phjlw4jKo6x5fQQPKufPGX9d8sVKVHyOmNPpMyykOLQ37xGNrFN1kAgeCuTawPTFdyZ7P2f24tSzPPrDrGZZLauzUVF5AJIJ7Yn472APgOouQMbeVJgLaso7k/yH/THA/mbLUI9m/UGWykcJKT/AKYruXlsjVboHdQ+9YVnxheZMjTAzcSBqY51hY6J6xZ4zA1Dzm63DpzC7kMLSpJ9UITxc+aun6YseZsh60ZGcTFypDYrtICQGW5SAZEcW+EkqTvA8Dcnz6Y1PP1MypA3rb7R1XispDaD/iVbC8zH7ROUWGFsKnwirwYiuJcX9Vnuj7YGPeI7FswhZWrkkFXxGnqaO2mMY5eOD2drKeUfhrNx0w1t1DqTMfNSjTYalCzKiCT/ACtIJKj/ADGw8xhy0inUDSPLByzllhNQra++6krTsQu1u1kvHu3HgL7U+G44rlU1azLmpC4GVolQhR3u6s0iE5JkPDyU8sBI+mOSm6e57ds6nLtOpClG/wCIZvqCXVg/mSyTtB+YOBbtxf4mcobUlHLYnueA7TWhetnFoH+TWhtI2RO/9tQSOiZPyq3Zay9leLV/9rczyk5wrijdAbummxDfoFqH7VQ690K58uuJOualZOanpqGca0zWX2DeNQqUA6lJHQKIOxIuBwVHpzfoIem6EUSsSBO1B1iTVVnhTEOShtsD8oUSQB6BIw4Ml6b6P5aW2cuRKPJlJ+GQ5ITJeB9Com30Awct8NcSgBYAA4DYd+J84HSs9iuJYa2v2rrjjqgIGVOVIHIKUBlH9UAnnNUWmsZ+1rrUSoVynOZfyrFdD0WGoH9oodFquAXFjwJAQnqAo4flNpsSl0xmBDaDbLSdqU/3+Z88dSUpSO6LY+sE22shzEyTxrzzFMWN7lbbQG2k/tSNh1JOpJ4k0itYIEilZ7g5hUlx1l9IDLrbhZeiuoFj2TqeUEp5I5Sebg44KxnHLWcclmgZzQ/LR8SZDjXZvtrtwtLjXAUPMJHqPDF61jrlDjZQVRJiEyKhJIXHaSeWSD/vSfADket7dL4zvMd2Mm3W2Ad0VMvn2SyJ1Mc+x0r0Lw5YpxKyZW+kpUjRKhoYGxHy6xS7zdlqBR5i0U/WVxqOrlEaZHc7YDyugDd87DC/dpGXEF2TNr9SrLiQVbWGOxCrea3CSPonGh8yZHyjWMoZWkVikOe9yITji58F3spH++VtBuClaQOgUL+RGKcrR7KjgWI+fJkQKBGydSSu3+JtZB+2LVliFutM3K1T2kfAE/KtvaX6MsOqWQCRMTsSP4ieHGml7MmXNM825Pk1GiUn3KoxlhmcxIV2ro3C6SHP3kKF/LkEWxdqtpnXKPnhzMlMhU2rulAaDk66HtifhTvsQSL23WBPjfC60SodI0gm1KSM8U+rJmhqyERX2Nuzd1uk3vuw63NY6UsARzDKvNXan/2YrvXFq9lJKgobEBU/L5159if+TRfuOWiVONqH8gRpxGsHevOBXc0NlLcvThokcFSKq2R9lJxYY02uzRtGT6bEJ8XpYXb/AIEf3xXF6tQi2Ul5Fz07GGpX+dQxwvaqg37IVB2/mppkf8qSf1xI28vZOdXcJHzANBl4ZdvGRahJ7r+qopgxqPUpBvLchRk/ljR7n7rJ/oMdS6fQmkKakvMqWRz2rgKrePHT9MJyqaiVllYbcpaI6iNyTMW64q17XspQ448sQErOuYpKTeeWUE9I7aWx9wMWU+3OzYHdU/CPrT2fC16/CysJH5ymuKqezDpSM2yaomZOVFccLggpWrsW7m5SLJB2+m7DBjK08oFLbglCFoZQEIQdiQABYAC5OFtN/GXacKnKbmuRVK2iQ5uKCfmfkfscWBrKdNfyQxWJMmWz21PkTFSSpIZZW2rahB453ngAG/ocSi1eUPfUPIfcn5Vo7m1WG0frbpShOXTnH2HfzrpqWY9Od6ttADh80uuC/wDwgf1xU6hmLIZ3Jbyahz+d98//AC47RpvVlzXY8mqU1vsChMlTa1O+7KWQEBYAFgQSom9glJJ8seEXTJdRj0yQxWW5EaWXC7JjIStlkNpWpad+747IFgoAHd14OHJwu3nMvU9h9AKv25wq3Em4UY/7l8p4dBPaqnLrWUSSWtPaKs+b7Zd/zKVjlTn1FNINNyflmKU9NtNaNvrtxeaTptlqqvRnG63UJUaVOYgtqjIbsFOMlxV18hQQQblNwrwx4Oad5dqVJpHZtvxOxo0irTJJc5lAPFCU/AdtrA3AO1N+CecX27e3RoB86KDFMJT7iwpQ4zmMSCeJ6R3qqT9dM5SKA9SEJhwmnk7S9T2hGdSP4Vp5T8xzhWSfdJk8PSH6sl5xQSXlv+88k2uoKCVWufAnDQzLkCgxcj1fMFBqFQmiFIsW5SBGW2yXEobcLa0guJUd43JIIITdPWyzhltNUZdcsW2N0ld/JtJX/VIH1xZ91CCpvSPzjWnwVOHKaW9YIywTOkGQAdR2I3FcjKiX3WC5vU04pskEkEpJBt6cY9whwOhLW8LUbJDd9xJ6AW8ccdAgzFxkuiO84pZK1KSgnk4vOX/xPLOaKbmRNLW+IbyXi043cKHiORwbE2PgbHBBLhKATuRRZ54toJEFUaCYk8vOtRaAZKrGVcnuS8xT571Rm7Ve6PSFrbiI5IQEk23nqo/IeBu4sQ+WJ1PquWIdWpjwdiy2kvNr8wel/XwI874mMBXFFSiTXyrjF47e3jj74hROo2jhEdKUuc9Kk1OtP1hioSnHX1blhawop9Bu4I9Li2FBmXJOYqW4st06dKbH7zUVSv8ALfGuFJChYi4OON6mRHgSWwCfEcYEuYY2pWZJI/OtH8J8Y3dkEoX7yRpBrKtZdc/DMvxHG1tqjUppCm1gpUlRJUQQeh5xKVOkNwXcv0CnUiJUJdYgpeW88Fby46SElCge6lHB4HPN+MWXUzIc2FPdrfvC1xFXBWlhbnZi5PeCAVAc9bEfLC1RXqm7Cap1NzlT3mI5/Ztx6k0FN87to3ELSLgHbwLjkYC26Dbyl0EHt19K39k+m/t23LZYgSSCSBJniORMxpPMVZm9P21peeRXECNHMtDzqo54XHAK9o3XKSFcHg+nOJ6FlSFT6dPp0Z/t58qXCiR5L8ZNkJkNldiFE24PJHIsLYoMmq5zlLeU/VXXA80tlex9kJUhZCliyTbvEAk9T54/anmPMUyhpp8l1IX7wiU7MXJR2ri20bGwDcBISny5J5vgqy9bj9tcds8QeCUrfSQeRGkEEE6CdNCOOmm5q4jLdITEny4TsuqqgBKXYTKgHCovFu+4Agjam5sDZRCSeDjoZpdBjzqCqdFApE1CHXao9KKQhwqVdkkHaLbQk+I5Ve2E9Prjy5Tkup5mbW+4nYt1+ppKyn8pO+9vTEXIzvQolMFPXX4yoyXO17GOkuXVYgElKebAmwvYXPngg24g7VZGBXbiYL8zynQRGkRsdRI12MxTxiVfJcCOXZBgM1wQUqXtXdgOh8nZuSHAF9kADYHgkcE4gK5m2k1HJqIDaSieH+0QmE24wwlBWtRC0KJSSCobSObHm1rYSEnU6hxhtiw5sjyO1LSf1N/0xFK1HrlQc7Ki5fSpR4HxvK+yQMTpM1cY8LobWHVqUSCDqdBHDX+PSfOntmLOgrNDgwGIr0MtMMsvhDiA06WgQlVgncfiJAKrAknknEJVsySKhSqRAXHabapbSm2lJUo79yysqUDwDcnphXxqNrVmBY91pc2M2rxDSI4H1VziVZ0U1BeHa16kzKkTyQmpp/ym39cRv3JZRmSgqPIR9asM22G2sJzpEEkSriRHPlprVrqeqM5E+qypdbpjSqmpK5TLjbSm1FJukhC9wBT4HriERqdO2x0wszzD7uoLbMMKBCgnYFEoTdSgkkAkng2x9U/TyPSpAFUy9IpISeVuU9SwP/UQHB97YYVEyVk+ppShuuMSD07Nuoov/wAIUkj7YGKxpSNXEhv+0/YD41117CrROYtBQ5hIOwjftp2pVuZ6qnvHvBm5hcdDvbhwIfv2ltu8eStvF/AcYinc9yY62lCfXIvYJUllREhHZA9Qkj4b+NuuNNx9HMquM3VEkrNuqXHlf0OIDMmm1Do8NTkd6sx7C47NLi0/XtBt+5w4YutScyHWz+f2NQW/ifCnFhptog/1EfCs5HNrFTiCnnMRVHSsuCPIkuoRvJuVWWNu65PJ5xddKsrRM3ahOUupsOLgqguFwIXt3hRA4Wk9OOoOLPlPRmjaiVaS9I7ZaEWSZkAJabUr8gNilagOVFPdBIAPWz7000LoGnj70inqmLceASsyXguw690AAC/Fzgna3SrhgLWInhTMe8YWdjbvWzZh0jSBEE8Zn6TXDTdE8osspQxl1O23G990j9V4nmNIcthvslUZlCfIOuj+isMxCQhASkWAFsfWJvaK514w74jxBwyXVf8AkfvUHlbLcHKlCFHpjSmoiXFOJbLqnAkqNyBu5Avc29cTmDBhpJJk0HedW8suOGVHUnnRgwYMcqOvh1pt5G1xNxil5i0qybmZZXV6BTJiz1cfjIUv6KsD+uDBjhANWLa7etlZ2VlJ6Uvaj7LGm8taltUb3e56MyXUfpcjEE77JGSFG6GqigeQmf6jBgxzKKPN+L8YQIFwr1NeI9krJiF3IqJHkZf+gxJRvZWyG1ZS6Y+9/wCZLWf0vgwYdUq/F+Lkavq9TVipvs85DguJU3lqnhQ6Kda3n7m+LnT9OKNATsYisMpHQNNgD+2DBhULuMbvn/8AY6T3NTTOWKc0kWb7w+Vsdgo8AC3u6PngwYVDlXLqt1GvhdCpjlyqKi58elvtiFqOnOU6ugoqdHhzAfB9hC/1UCcGDHCAd6kavX2jLayD3qCOimS0LJiU5UO//hJTzA+yFgYE6K5NU8lcumpnAG9pz7skfZxSh+mDBiA2rJM5R6Vd/wA9iP8A11epq80ujQaRHSzDYQ2hI2pCUhISB0AA4A+WJDBgxOABoKFrWpZzKMmjBgwY7TKMGDBhUq//2Q==';
const PDF_LOGO_WIDTH = 173;
const PDF_LOGO_HEIGHT = 120;

function asciiBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) bytes[index] = value.charCodeAt(index) & 0xff;
  return bytes;
}

function base64Bytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index) & 0xff;
  return bytes;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function pdfSafeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/[\s]+/g, ' ')
    .trim();
}

function pdfTextCommand(value: unknown): string {
  return pdfEscape(pdfSafeText(value));
}

function pdfTextAt(commands: string[], x: number, y: number, text: unknown, size = 10, bold = false): void {
  commands.push('BT', `/${bold ? 'F2' : 'F1'} ${size} Tf`, `${x} ${y} Td`, `(${pdfTextCommand(text)}) Tj`, 'ET');
}

function pdfCenteredText(commands: string[], x: number, y: number, width: number, text: unknown, size = 10, bold = false): void {
  const safe = pdfSafeText(text);
  const estimate = safe.length * size * 0.52;
  pdfTextAt(commands, x + Math.max(0, (width - estimate) / 2), y, safe, size, bold);
}

function pdfRect(commands: string[], x: number, y: number, width: number, height: number, fill = false): void {
  commands.push(`${x} ${y} ${width} ${height} re ${fill ? 'f' : 'S'}`);
}

function pdfLine(commands: string[], x1: number, y1: number, x2: number, y2: number): void {
  commands.push(`${x1} ${y1} m ${x2} ${y2} l S`);
}

function pdfMoney(value: number): string {
  return formatCurrency(Number(value || 0)).replace(/\s+/g, ' ');
}

function pdfStatusLabel(status: string): string {
  const label = receiptStatusLabel(status);
  if (label.toLowerCase().includes('emit')) return 'Pendente';
  return label;
}
function pdfTitleLines(title: string): string[] {
  const clean = pdfSafeText(title).toUpperCase();
  if (clean.includes('EXTRATO')) return ['EXTRATO DO', 'CREDIARIO'];
  if (clean.includes('PAGAMENTO')) return ['COMPROVANTE', 'DE PAGAMENTO'];
  if (clean.includes('PARCIAL')) return ['COMPROVANTE', 'PARCIAL'];
  if (clean.includes('ATRAS')) return ['PARCELA', 'ATRASADA'];
  if (clean.includes('ABERTO')) return ['PARCELA', 'EM ABERTO'];
  if (clean.includes('VENDA')) return ['COMPROVANTE', 'DE VENDA'];
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length <= 2) return [clean];
  const middle = Math.ceil(words.length / 2);
  return [words.slice(0, middle).join(' '), words.slice(middle).join(' ')];
}

function buildPdfReceiptFile(preview: ReceiptPreview): { fileName: string; blob: Blob } {
  const data = getPdfReceiptData(preview);
  const commands: string[] = [
    '2 w',
    '0 0 0 RG',
    '0 0 0 rg',
  ];

  const pageX = 34;
  const pageW = 527;
  pdfRect(commands, pageX, 48, pageW, 748, false);

  // Logo e cabeçalho fiel ao recibo preto/branco, sem sobreposição.
  commands.push('q', '176 0 0 122 54 670 cm', '/Logo Do', 'Q');
  const titleLines = pdfTitleLines(data.title);
  let titleY = titleLines.length > 1 ? 760 : 744;
  titleLines.forEach((line) => {
    pdfTextAt(commands, 306, titleY, line, 24, true);
    titleY -= 28;
  });
  pdfLine(commands, 306, titleY + 8, 544, titleY + 8);
  pdfTextAt(commands, 306, titleY - 10, data.subtitle, 9, false);
  pdfTextAt(commands, 306, titleY - 24, `Status: ${data.status}`, 10, true);

  if (data.paidStamp) {
    commands.push('q', '0.15 w', '0 0 0 RG', '0 0 0 rg');
    pdfRect(commands, 400, 666, 126, 42, true);
    commands.push('1 1 1 rg');
    pdfCenteredText(commands, 400, 691, 126, 'PAGO', 19, true);
    pdfCenteredText(commands, 400, 675, 126, data.paidStamp, 8, true);
    commands.push('Q');
  } else {
    const statusClean = pdfSafeText(data.status).toUpperCase();
    const badgeWidth = Math.min(178, Math.max(92, statusClean.length * 8 + 24));
    pdfRect(commands, 306, 666, badgeWidth, 32, false);
    pdfCenteredText(commands, 306, 676, badgeWidth, statusClean, 10, true);
  }

  // Dados do cliente.
  const boxX = 46;
  const boxW = 502;
  let y = 636;
  pdfRect(commands, boxX, y - 88, boxW, 88, false);
  pdfTextAt(commands, boxX + 18, y - 26, 'CLIENTE', 9, true);
  pdfTextAt(commands, boxX + 128, y - 26, data.customer, 12, true);
  pdfLine(commands, boxX + 12, y - 38, boxX + boxW - 12, y - 38);
  pdfTextAt(commands, boxX + 18, y - 56, 'TELEFONE', 9, true);
  pdfTextAt(commands, boxX + 128, y - 56, data.phone, 11, true);
  pdfLine(commands, boxX + 12, y - 68, boxX + boxW - 12, y - 68);
  pdfTextAt(commands, boxX + 18, y - 80, 'ENDERECO', 9, true);
  pdfTextAt(commands, boxX + 128, y - 80, data.address || '-', 10, false);

  // Tabela.
  y = 520;
  const tableX = 46;
  const tableW = 502;
  const col = [tableX, tableX + 82, tableX + 222, tableX + 332, tableX + tableW];
  const headerH = 30;
  const rows = data.rows.slice(0, 10);
  const rowH = rows.length > 7 ? 24 : 32;
  commands.push('0 0 0 rg');
  pdfRect(commands, tableX, y - headerH, tableW, headerH, true);
  commands.push('1 1 1 rg');
  pdfCenteredText(commands, col[0], y - 20, col[1] - col[0], 'PARCELA', 9, true);
  pdfCenteredText(commands, col[1], y - 20, col[2] - col[1], 'VENCIMENTO', 9, true);
  pdfCenteredText(commands, col[2], y - 20, col[3] - col[2], 'VALOR', 9, true);
  pdfCenteredText(commands, col[3], y - 20, col[4] - col[3], 'STATUS', 9, true);
  commands.push('0 0 0 rg');
  pdfRect(commands, tableX, y - headerH - rows.length * rowH, tableW, headerH + rows.length * rowH, false);
  for (let i = 1; i < col.length - 1; i += 1) pdfLine(commands, col[i], y, col[i], y - headerH - rows.length * rowH);
  rows.forEach((row, index) => {
    const rowTop = y - headerH - index * rowH;
    pdfLine(commands, tableX, rowTop - rowH, tableX + tableW, rowTop - rowH);
    pdfCenteredText(commands, col[0], rowTop - 20, col[1] - col[0], row.parcela, 10, false);
    pdfCenteredText(commands, col[1], rowTop - 20, col[2] - col[1], row.vencimento, 10, false);
    pdfCenteredText(commands, col[2], rowTop - 20, col[3] - col[2], row.valor, 10, false);
    addPdfStatusToken(commands, col[3] + 20, rowTop - 20, row.status);
  });

  // Cards de resumo.
  y = y - headerH - rows.length * rowH - 24;
  const cardW = 154;
  const cardH = 58;
  const cards = [
    [data.totalLabel, data.totalValue],
    [data.paidLabel, data.paidValue],
    [data.balanceLabel, data.balanceValue],
  ];
  cards.forEach(([label, value], index) => {
    const x = tableX + index * (cardW + 20);
    pdfRect(commands, x, y - cardH, cardW, cardH, false);
    pdfCenteredText(commands, x, y - 20, cardW, label, 9, true);
    pdfLine(commands, x + 12, y - 30, x + cardW - 12, y - 30);
    pdfCenteredText(commands, x, y - 48, cardW, value, 14, true);
  });

  y = y - cardH - 18;
  y = addPdfNotes(commands, tableX, y, tableW, data.notes);
  pdfCenteredText(commands, tableX, Math.max(44, y), tableW, 'Obrigado pela preferencia - Gerado pelo Smart Loja Facil', 9, false);

  const stream = commands.join('\n');
  const streamBytes = asciiBytes(stream);
  const logoBytes = base64Bytes(PDF_LOGO_JPEG_BASE64);
  const objects: Uint8Array[][] = [
    [asciiBytes('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')],
    [asciiBytes('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n')],
    [asciiBytes('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 7 0 R >> /XObject << /Logo 6 0 R >> >> /Contents 5 0 R >>\nendobj\n')],
    [asciiBytes('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n')],
    [asciiBytes(`5 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`), streamBytes, asciiBytes('\nendstream\nendobj\n')],
    [
      asciiBytes(`6 0 obj\n<< /Type /XObject /Subtype /Image /Width ${PDF_LOGO_WIDTH} /Height ${PDF_LOGO_HEIGHT} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logoBytes.length} >>\nstream\n`),
      logoBytes,
      asciiBytes('\nendstream\nendobj\n'),
    ],
    [asciiBytes('7 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n')],
  ];
  const parts: Uint8Array[] = [asciiBytes('%PDF-1.4\n% Smart Loja Facil\n')];
  const offsets = [0];
  let currentLength = parts[0].length;
  for (const objectParts of objects) {
    offsets.push(currentLength);
    for (const objectPart of objectParts) {
      parts.push(objectPart);
      currentLength += objectPart.length;
    }
  }
  const xrefAt = currentLength;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) xref += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  parts.push(asciiBytes(xref));
  const fileName = uniquePdfFileName(preview.fileStem || 'comprovante');
  const pdfBytes = concatBytes(parts);
  const pdfBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;
  return { fileName, blob: new Blob([pdfBuffer], { type: 'application/pdf' }) };
}

function triggerPdfDownload(file: { fileName: string; blob: Blob }): void {
  const url = URL.createObjectURL(file.blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}


type PdfReceiptRow = { parcela: string; vencimento: string; valor: string; status: string };
type PdfReceiptData = {
  title: string;
  subtitle: string;
  customer: string;
  phone: string;
  address: string;
  rows: PdfReceiptRow[];
  totalLabel: string;
  totalValue: string;
  paidLabel: string;
  paidValue: string;
  balanceLabel: string;
  balanceValue: string;
  status: string;
  notes: string[];
  paidStamp?: string;
};

function getPdfReceiptData(preview: ReceiptPreview): PdfReceiptData {
  const now = new Date().toLocaleString('pt-BR');
  if (preview.kind === 'nota') {
    const credit = preview.credit;
    const paid = creditPaidTotal(credit);
    const balance = Math.max(0, Number(credit.balance || 0));
    const status = pdfStatusLabel(preview.status);
    const paidCount = credit.installments.filter((item) => installmentStatusLabel(item) === 'Paga').length;
    const partialCount = credit.installments.filter((item) => installmentStatusLabel(item).toLowerCase().includes('parcial')).length;
    const overdueCount = credit.installments.filter(isOverdue).length;
    return {
      title: 'EXTRATO DO CREDIARIO',
      subtitle: `Nota #${String(credit.sale_number || 0).padStart(4, '0')} - ${formatDateTime(credit.created_at)}`,
      customer: credit.customer_name || preview.customer || 'Cliente',
      phone: credit.customer_whatsapp || credit.customer_phone || preview.phone || '-',
      address: '-',
      rows: credit.installments.map((installment) => ({
        parcela: `${installment.number}/${credit.installments.length}`,
        vencimento: dateOnly(installment.due_date),
        valor: pdfMoney(installment.amount),
        status: installmentStatusLabel(installment),
      })),
      totalLabel: 'TOTAL DA NOTA',
      totalValue: pdfMoney(credit.total),
      paidLabel: 'TOTAL PAGO',
      paidValue: pdfMoney(paid),
      balanceLabel: 'SALDO',
      balanceValue: pdfMoney(balance),
      status,
      notes: [
        `Extrato da nota #${String(credit.sale_number || 0).padStart(4, '0')} gerado em ${now}.`,
        `Parcelas pagas: ${paidCount}/${credit.installments.length}.`,
        `Total da nota: ${pdfMoney(credit.total)}. Total pago: ${pdfMoney(paid)}.`,
        balance > 0.009 ? `Saldo para acompanhar no crediario: ${pdfMoney(balance)}.` : 'Nota quitada sem saldo pendente.',
        partialCount ? `${partialCount} parcela(s) com pagamento parcial.` : '',
        overdueCount ? `${overdueCount} parcela(s) atrasada(s).` : '',
      ].filter(Boolean),
      paidStamp: balance <= 0.009 ? now : undefined,
    };
  }
  if (preview.kind === 'parcela') {
    const credit = preview.credit;
    const installment = preview.installment;
    const paid = paidOf(installment);
    const rest = remainingOf(installment);
    const status = installmentStatusLabel(installment);
    const paidDate = installment.paid_at ? formatDateTime(installment.paid_at) : undefined;
    return {
      title: status === 'Paga' ? 'COMPROVANTE DE PAGAMENTO' : status.toLowerCase().includes('parcial') ? 'COMPROVANTE PARCIAL' : status.toLowerCase().includes('venc') ? 'PARCELA ATRASADA' : 'PARCELA EM ABERTO',
      subtitle: `Venda #${String(credit.sale_number || 0).padStart(4, '0')} - Parcela ${installment.number}/${credit.installments.length}`,
      customer: credit.customer_name || preview.customer || 'Cliente',
      phone: credit.customer_whatsapp || credit.customer_phone || preview.phone || '-',
      address: '-',
      rows: [{
        parcela: `${installment.number}/${credit.installments.length}`,
        vencimento: dateOnly(installment.due_date),
        valor: pdfMoney(installment.amount),
        status,
      }],
      totalLabel: 'VALOR',
      totalValue: pdfMoney(installment.amount),
      paidLabel: 'PAGO',
      paidValue: pdfMoney(paid),
      balanceLabel: 'SALDO',
      balanceValue: pdfMoney(rest),
      status,
      notes: [
        `Venda/nota #${String(credit.sale_number || 0).padStart(4, '0')} - parcela ${installment.number}/${credit.installments.length}.`,
        `Vencimento: ${dateOnly(installment.due_date)}.`,
        `Status: ${status}${paidDate ? ` em ${paidDate}` : ''}.`,
        rest > 0.009 ? `Saldo da parcela: ${pdfMoney(rest)}.` : 'Parcela quitada sem saldo pendente.',
      ],
      paidStamp: status === 'Paga' ? (paidDate || now) : undefined,
    };
  }

  const status = pdfStatusLabel(preview.status);
  const bodyText = htmlToText(preview.html).slice(0, 240);
  return {
    title: preview.title || 'COMPROVANTE DE VENDA',
    subtitle: `Comprovante salvo - ${formatDateTime(preview.createdAt)}`,
    customer: preview.customer || 'Consumidor',
    phone: preview.phone || '-',
    address: '-',
    rows: [{ parcela: '1', vencimento: dateOnly(preview.createdAt), valor: pdfMoney(preview.total), status }],
    totalLabel: 'TOTAL',
    totalValue: pdfMoney(preview.total),
    paidLabel: 'STATUS',
    paidValue: status,
    balanceLabel: 'DATA',
    balanceValue: dateOnly(preview.createdAt),
    status,
    notes: [
      `Comprovante gerado em ${now}.`,
      `Status: ${status}. Total: ${pdfMoney(preview.total)}.`,
      bodyText || 'Registro salvo em Comprovantes.',
    ],
    paidStamp: status.toLowerCase().includes('pago') ? now : undefined,
  };
}

function addPdfStatusToken(commands: string[], x: number, y: number, label: string): void {
  const clean = pdfSafeText(label).toUpperCase();
  const isPaid = clean.includes('PAGA') || clean.includes('PAGO') || clean.includes('QUIT');
  const isPartial = clean.includes('PARCIAL');
  const isOverdue = clean.includes('VENC') || clean.includes('ATRAS');
  const width = isPartial ? 72 : isOverdue ? 78 : 64;
  commands.push('0 0 0 RG', `${isPaid ? '0 0 0 rg' : '1 1 1 rg'}`);
  pdfRect(commands, x, y - 5, width, 18, isPaid);
  commands.push(isPaid ? '1 1 1 rg' : '0 0 0 rg');
  pdfCenteredText(commands, x, y, width, isPaid ? 'PAGA' : isPartial ? 'PARCIAL' : isOverdue ? 'VENCIDA' : 'PENDENTE', 8, true);
  commands.push('0 0 0 rg');
}

function addPdfNotes(commands: string[], x: number, y: number, width: number, notes: string[]): number {
  const height = Math.max(68, 24 + notes.length * 14);
  commands.push('0 0 0 rg');
  pdfRect(commands, x, y - height, width, height, false);
  commands.push('0 0 0 rg');
  pdfRect(commands, x, y - 20, width, 20, true);
  commands.push('1 1 1 rg');
  pdfTextAt(commands, x + 12, y - 14, 'ANOTACOES', 10, true);
  commands.push('0 0 0 rg');
  let cursor = y - 38;
  notes.slice(0, 7).forEach((note) => {
    const wrapped = wrapPdfLines(`- ${note}`, 82).slice(0, 2);
    wrapped.forEach((line) => {
      pdfTextAt(commands, x + 12, cursor, line, 8, false);
      cursor -= 12;
    });
  });
  return y - height - 14;
}

function uniquePdfFileName(stem: string): string {
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  const safeStem = (stem || 'comprovante').replace(/[^a-z0-9._-]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `${safeStem}-${stamp}.pdf`;
}

function downloadPreviewPdf(preview: ReceiptPreview): string {
  const file = buildPdfReceiptFile(preview);
  triggerPdfDownload(file);
  return file.fileName;
}

function readReceiptFocusPayload(): ReceiptFocusPayload | null {
  try {
    const raw = window.localStorage.getItem(RECEIPTS_FOCUS_SALE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReceiptFocusPayload;
    if (!parsed || typeof parsed !== 'object') return null;
    const createdAt = Number(parsed.created_at || 0);
    if (createdAt && Date.now() - createdAt > 10 * 60 * 1000) {
      window.localStorage.removeItem(RECEIPTS_FOCUS_SALE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function htmlToText(html: string): string {
  const cleanHtml = String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<template[\s\S]*?<\/template>/gi, ' ');
  if (typeof window === 'undefined') return cleanHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const element = document.createElement('div');
  element.innerHTML = cleanHtml;
  return element.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function dateOnly(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value || '-';
  return date.toLocaleDateString('pt-BR');
}

function remainingOf(installment: CreditInstallment): number {
  return remainingInstallmentAmount(installment);
}

function paidOf(installment: CreditInstallment): number {
  return Math.max(0, Number(installment.paid_amount || 0));
}

function isOverdue(installment: CreditInstallment): boolean {
  if (installment.status === 'pago') return false;
  const dueDate = new Date(`${installment.due_date}T00:00:00`);
  if (Number.isNaN(dueDate.getTime())) return false;
  return dueDate < startOfToday();
}

function installmentStatusLabel(installment: CreditInstallment): string {
  if (installment.status === 'pago' || remainingOf(installment) <= 0.009) return 'Paga';
  if (isOverdue(installment)) return paidOf(installment) > 0 ? 'Parcial vencida' : 'Vencida';
  if (installment.status === 'parcial' || paidOf(installment) > 0) return 'Parcial';
  return 'Pendente';
}

function installmentStatusTone(installment: CreditInstallment): 'ok' | 'warn' | 'danger' | 'neutral' {
  const label = installmentStatusLabel(installment).toLowerCase();
  if (label.includes('paga')) return 'ok';
  if (label.includes('venc')) return 'danger';
  if (label.includes('parcial') || label.includes('pend')) return 'warn';
  return 'neutral';
}

function receiptStatusTone(label: string): ReceiptVisualTone {
  const lower = label.toLowerCase();
  if (lower.includes('paga') || lower.includes('quit')) return 'paid';
  if (lower.includes('venc') || lower.includes('atras')) return 'overdue';
  if (lower.includes('parcial')) return 'partial';
  if (lower.includes('pend') || lower.includes('abert') || lower.includes('open')) return 'pending';
  if (lower.includes('cancel')) return 'danger';
  return 'neutral';
}

function creditPaidTotal(credit: CreditSummary): number {
  return Math.max(0, Number(credit.total || 0) - Number(credit.balance || 0));
}

function creditNoteStatusDetails(credit: CreditSummary): { label: string; tone: ReceiptVisualTone; detail: string; overdueCount: number; partialCount: number; paidCount: number } {
  const installments = credit.installments || [];
  const balance = Math.max(0, Number(credit.balance || 0));
  const paidCount = installments.filter((installment) => installmentStatusLabel(installment) === 'Paga').length;
  const overdueCount = installments.filter(isOverdue).length;
  const partialCount = installments.filter((installment) => remainingOf(installment) > 0.009 && paidOf(installment) > 0).length;
  if (balance <= 0.009) return { label: 'Paga', tone: 'paid', detail: 'Nota quitada, sem saldo restante.', overdueCount, partialCount, paidCount };
  if (overdueCount > 0) return { label: 'Atrasada', tone: 'overdue', detail: `${formatNumber(overdueCount)} parcela(s) atrasada(s).`, overdueCount, partialCount, paidCount };
  if (partialCount > 0) return { label: 'Parcial', tone: 'partial', detail: `${formatNumber(partialCount)} parcela(s) com pagamento parcial.`, overdueCount, partialCount, paidCount };
  return { label: 'Aberta', tone: 'pending', detail: 'Aguardando pagamento.', overdueCount, partialCount, paidCount };
}

function customerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? 'L';
  const second = parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1];
  return `${first ?? 'L'}${second ?? 'J'}`.toUpperCase();
}

function normalizeReceiptStore(settings: Settings | null | undefined): ReceiptStoreInfo {
  const source = settings as (Settings & { logo_url?: string }) | null | undefined;
  const name = source?.store_name?.trim() || 'Jaque Confecções e Presentes';
  return {
    store_name: name,
    phone: source?.phone?.trim() || '',
    whatsapp: source?.whatsapp?.trim() || '',
    receipt_message: source?.receipt_message?.trim() || 'Obrigado pela preferência.',
    logo_url: source?.logo_url?.trim() || DEFAULT_RECEIPT_LOGO_URL,
  };
}

function buildReceiptBrand(store: ReceiptStoreInfo): string {
  const logoUrl = store.logo_url || DEFAULT_RECEIPT_LOGO_URL;
  return `<img class="slf-logo-img" src="${escapeHtml(logoUrl)}" alt="Logo Jaque Confecções e Presentes">`;
}

function formatReceiptContact(store: ReceiptStoreInfo): string {
  const primary = store.whatsapp || store.phone || '';
  const digits = primary.replace(/\D/g, '');
  if (digits.length >= 10) {
    const local = digits.startsWith('55') ? digits.slice(2) : digits;
    if (local.length >= 10) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7, 11)}`;
  }
  return primary || '(43) 99607-9372';
}

function receiptStoreName(store: ReceiptStoreInfo): string {
  return (store.store_name || 'Jaque Confecções e Presentes').replace(/\s+/g, ' ').trim();
}

function receiptStatusStamp(status: string, tone: ReceiptVisualTone, dateLabel?: string): string {
  if (tone !== 'paid') return '';
  return `<div class="slf-paid-stamp"><strong>PAGO</strong>${dateLabel ? `<span>${escapeHtml(dateLabel)}</span>` : ''}</div>`;
}

function receiptStatusToken(label: string, tone: ReceiptVisualTone): string {
  const icon = tone === 'paid' ? '✓' : tone === 'partial' ? '◔' : tone === 'overdue' || tone === 'danger' ? '!' : '⌛';
  return `<span class="slf-status-token ${tone}"><b>${icon}</b>${escapeHtml(label.toUpperCase())}</span>`;
}

function buildPaymentRow(method: string): string {
  const normalized = method.toLowerCase();
  const options = [
    ['pix', 'Pix'],
    ['dinheiro', 'Dinheiro'],
    ['credito', 'Crédito'],
    ['debito', 'Débito'],
  ];
  return `<div class="slf-payment-row">${options.map(([key, label]) => {
    const active = normalized.includes(key) || (key === 'credito' && normalized.includes('cart')) || (key === 'debito' && normalized.includes('cart'));
    return `<span class="${active ? 'active' : ''}">♥ ${label}</span>`;
  }).join('')}</div>`;
}

function receiptTitleForInstallment(status: string, tone: ReceiptVisualTone): string {
  if (tone === 'paid') return 'COMPROVANTE DE PAGAMENTO';
  if (tone === 'partial') return 'COMPROVANTE PARCIAL';
  if (tone === 'overdue' || tone === 'danger') return 'PARCELA ATRASADA';
  return 'PARCELA EM ABERTO';
}

function buildReceiptStyles(): string {
  return `
    <style>
      *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      :root{color-scheme:light;--ink:#050505;--paper:#fff;--line:#111;--muted:#4b5563;--pink:#f04f7d;--pink-dark:#c01655;--gold:#f5b23b;--green:#058344;--orange:#b85c00;--blue:#174ea6;--red:#b91c1c}
      body{margin:0;background:#050505;color:var(--ink);font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Courier New',monospace;min-height:100vh;overflow-x:hidden;padding:12px}
      .slf-mode-tip{display:none}
      .slf-app-shell{width:min(760px,100%);margin:0 auto;padding-bottom:18px}
      .slf-appbar{height:58px;display:grid;grid-template-columns:56px 1fr 112px;gap:10px;align-items:center;color:#fff;margin-bottom:10px}
      .slf-appbar-btn{width:52px;height:52px;border:1px solid rgba(255,255,255,.34);border-radius:14px;display:grid;place-items:center;font-size:24px;background:rgba(255,255,255,.03)}
      .slf-appbar-title{text-align:center;font-size:clamp(16px,4vw,26px);font-weight:950;letter-spacing:.1em;line-height:1.05;text-transform:uppercase;white-space:normal}.slf-appbar-actions{display:flex;gap:8px;justify-content:end}
      .slf-receipt{position:relative;background:var(--paper);border:2px solid var(--line);border-radius:0;padding:clamp(14px,3.5vw,30px);box-shadow:0 18px 48px rgba(0,0,0,.24);overflow:hidden;clip-path:polygon(0 12px,1.5% 0,3% 12px,4.5% 0,6% 12px,7.5% 0,9% 12px,10.5% 0,12% 12px,13.5% 0,15% 12px,16.5% 0,18% 12px,19.5% 0,21% 12px,22.5% 0,24% 12px,25.5% 0,27% 12px,28.5% 0,30% 12px,31.5% 0,33% 12px,34.5% 0,36% 12px,37.5% 0,39% 12px,40.5% 0,42% 12px,43.5% 0,45% 12px,46.5% 0,48% 12px,49.5% 0,51% 12px,52.5% 0,54% 12px,55.5% 0,57% 12px,58.5% 0,60% 12px,61.5% 0,63% 12px,64.5% 0,66% 12px,67.5% 0,69% 12px,70.5% 0,72% 12px,73.5% 0,75% 12px,76.5% 0,78% 12px,79.5% 0,81% 12px,82.5% 0,84% 12px,85.5% 0,87% 12px,88.5% 0,90% 12px,91.5% 0,93% 12px,94.5% 0,96% 12px,97.5% 0,100% 12px,100% calc(100% - 12px),97.5% 100%,96% calc(100% - 12px),94.5% 100%,93% calc(100% - 12px),91.5% 100%,90% calc(100% - 12px),88.5% 100%,87% calc(100% - 12px),85.5% 100%,84% calc(100% - 12px),82.5% 100%,81% calc(100% - 12px),79.5% 100%,78% calc(100% - 12px),76.5% 100%,75% calc(100% - 12px),73.5% 100%,72% calc(100% - 12px),70.5% 100%,69% calc(100% - 12px),67.5% 100%,66% calc(100% - 12px),64.5% 100%,63% calc(100% - 12px),61.5% 100%,60% calc(100% - 12px),58.5% 100%,57% calc(100% - 12px),55.5% 100%,54% calc(100% - 12px),52.5% 100%,51% calc(100% - 12px),49.5% 100%,48% calc(100% - 12px),46.5% 100%,45% calc(100% - 12px),43.5% 100%,42% calc(100% - 12px),40.5% 100%,39% calc(100% - 12px),37.5% 100%,36% calc(100% - 12px),34.5% 100%,33% calc(100% - 12px),31.5% 100%,30% calc(100% - 12px),28.5% 100%,27% calc(100% - 12px),25.5% 100%,24% calc(100% - 12px),22.5% 100%,21% calc(100% - 12px),19.5% 100%,18% calc(100% - 12px),16.5% 100%,15% calc(100% - 12px),13.5% 100%,12% calc(100% - 12px),10.5% 100%,9% calc(100% - 12px),7.5% 100%,6% calc(100% - 12px),4.5% 100%,3% calc(100% - 12px),1.5% 100%,0 calc(100% - 12px))}
      .slf-head{display:grid;grid-template-columns:minmax(150px,35%) 1fr;gap:18px;align-items:center;border:0;margin:0 0 14px;padding-top:16px}.slf-logo-img{display:block;width:min(210px,100%);max-height:128px;object-fit:contain;margin-inline:auto}.slf-doc-title{min-width:0}.slf-doc-title h1{font-size:clamp(30px,7.4vw,64px);line-height:1.05;margin:0;text-transform:uppercase;letter-spacing:.07em;font-weight:950}.slf-doc-title p{font-size:clamp(12px,2.5vw,18px);margin:8px 0 0;border-top:2px dashed var(--line);padding-top:8px;color:#111;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.slf-badge{display:inline-flex;align-items:center;justify-content:center;border-radius:8px;padding:8px 12px;font-size:13px;font-weight:950;border:2px solid var(--line);background:#fff;color:#111;text-transform:uppercase}.slf-badge.paid{background:#050505;color:#fff}.slf-badge.partial{border-color:var(--orange);color:var(--orange);background:#fff9ed}.slf-badge.pending{border-color:var(--blue);color:var(--blue);background:#eff6ff}.slf-badge.overdue,.slf-badge.danger{border-color:var(--red);color:var(--red);background:#fff1f2}.slf-badge.neutral{background:#fff;color:#111}
      .slf-customer-box{border:2px solid var(--line);border-radius:10px;margin:12px 0 14px;padding:10px 14px}.slf-customer-row{display:grid;grid-template-columns:42px 120px 1fr;align-items:center;gap:12px;padding:10px 0;border-bottom:1.5px dashed #777}.slf-customer-row:last-child{border-bottom:0}.slf-customer-icon{width:34px;height:34px;border-radius:999px;background:#050505;color:#fff;display:grid;place-items:center;font-family:Arial,sans-serif;font-size:17px}.slf-customer-label{font-weight:950;text-transform:uppercase;font-size:15px;letter-spacing:.04em}.slf-customer-value{font-size:clamp(16px,3vw,24px);font-weight:950;overflow-wrap:anywhere}
      .slf-table{width:100%;border-collapse:separate;border-spacing:0;margin:12px 0 14px;border:2px solid var(--line);border-radius:10px;overflow:hidden;font-size:clamp(12px,2.2vw,16px)}.slf-table th{background:#050505;color:#fff;text-align:center;font-weight:950;letter-spacing:.07em;text-transform:uppercase;padding:12px 8px;border-right:1px dashed #555}.slf-table th:last-child{border-right:0}.slf-table td{padding:12px 8px;border-top:1px dashed #aaa;border-right:1px dashed #aaa;vertical-align:middle;text-align:center}.slf-table td:last-child{border-right:0}.slf-table .num{text-align:right;white-space:nowrap}.slf-table .left{text-align:left}.slf-status-token{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:2px solid var(--line);border-radius:7px;padding:6px 10px;min-width:112px;font-weight:950;background:#fff;color:#111}.slf-status-token b{width:22px;height:22px;border-radius:999px;display:grid;place-items:center;background:#050505;color:#fff;font-family:Arial,sans-serif;font-size:14px}.slf-status-token.paid{background:#050505;color:#fff}.slf-status-token.paid b{background:#fff;color:#050505}.slf-status-token.partial{border-color:var(--orange);color:var(--orange)}.slf-status-token.pending{border-color:#111;color:#111}.slf-status-token.overdue,.slf-status-token.danger{border-color:var(--red);color:var(--red);background:#fff1f2}
      .slf-summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:12px 0 14px}.slf-summary-card{border:2px solid var(--line);border-radius:10px;min-height:118px;text-align:center;padding:14px 10px;display:grid;align-content:center;gap:9px}.slf-summary-card .icon{width:44px;height:44px;margin:0 auto;border-radius:999px;background:#050505;color:#fff;display:grid;place-items:center;font-family:Arial,sans-serif;font-size:20px}.slf-summary-card span{font-weight:950;text-transform:uppercase;letter-spacing:.06em}.slf-summary-card strong{font-size:clamp(24px,5vw,38px);line-height:1;white-space:nowrap}.slf-payment{border:2px solid var(--line);border-radius:8px;margin:12px 0 0;overflow:hidden}.slf-payment-head{display:grid;grid-template-columns:1fr 170px;background:#050505;color:#fff;text-align:center;font-weight:950;font-size:17px;text-transform:uppercase}.slf-payment-head span{padding:10px;border-right:1px solid #fff}.slf-payment-head span:last-child{border-right:0}.slf-payment-row{display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap;padding:12px;font-family:Arial,sans-serif;color:#111}.slf-payment-row span{font-weight:700;color:#333}.slf-payment-row span.active{color:var(--pink-dark);font-weight:950}.slf-payment-total{font-size:clamp(28px,5vw,44px);font-weight:950;padding:10px;text-align:center;border-left:2px solid var(--line)}
      .slf-note{border:2px solid var(--line);border-radius:8px;overflow:hidden;margin:14px 0 0;background:#fff}.slf-note-title{background:#050505;color:#fff;padding:10px 14px;font-weight:950;text-transform:uppercase;letter-spacing:.06em;font-size:17px}.slf-note ul{margin:0;padding:14px 18px 14px 30px;line-height:1.55;font-size:clamp(12px,2.1vw,16px)}.slf-note.ok .slf-note-title{background:#050505}.slf-note.danger .slf-note-title{background:#7f1d1d}.slf-note.warn .slf-note-title{background:#92400e}.slf-paid-stamp{position:absolute;right:8%;top:42%;transform:rotate(-4deg);border:4px solid #050505;color:#050505;border-radius:10px;padding:8px 22px;text-align:center;opacity:.82;font-weight:950;letter-spacing:.08em;font-size:clamp(26px,6vw,54px);line-height:.9;z-index:2;pointer-events:none}.slf-paid-stamp span{display:block;font-size:clamp(10px,2vw,16px);margin-top:8px}.slf-footer{margin-top:14px;text-align:center;color:#111;font-weight:900;font-size:12px}.slf-print-tip{margin-top:10px;border:2px dashed #111;border-radius:10px;padding:10px;text-align:center;font-size:12px;color:#111;background:#fff}
      @media (max-width:720px){body{padding:0;background:#050505}.slf-app-shell{width:100%;padding:0 8px 10px}.slf-appbar{height:54px;grid-template-columns:48px 1fr 96px;margin-bottom:4px}.slf-appbar-btn{width:44px;height:44px;border-radius:12px;font-size:21px}.slf-appbar-title{font-size:15px;letter-spacing:.06em}.slf-receipt{padding:12px 10px}.slf-head{grid-template-columns:36% 1fr;gap:10px;padding-top:14px}.slf-logo-img{max-height:94px}.slf-doc-title h1{font-size:clamp(25px,8vw,34px);letter-spacing:.04em}.slf-doc-title p{font-size:11px}.slf-customer-box{padding:8px 10px}.slf-customer-row{grid-template-columns:32px 76px 1fr;gap:8px;padding:8px 0}.slf-customer-icon{width:28px;height:28px;font-size:14px}.slf-customer-label{font-size:11px}.slf-customer-value{font-size:14px}.slf-table{font-size:11px}.slf-table th,.slf-table td{padding:8px 4px}.slf-status-token{min-width:76px;padding:5px 6px;font-size:10px;gap:4px}.slf-status-token b{width:18px;height:18px;font-size:11px}.slf-summary-grid{grid-template-columns:1fr;gap:8px}.slf-summary-card{min-height:84px;display:grid;grid-template-columns:42px 1fr;align-items:center;text-align:left;padding:10px}.slf-summary-card .icon{margin:0;width:36px;height:36px}.slf-summary-card strong{font-size:24px}.slf-payment-head{grid-template-columns:1fr 120px;font-size:14px}.slf-payment-row{font-size:12px;gap:8px}.slf-payment-total{font-size:26px}.slf-note ul{font-size:12px;padding:12px 12px 12px 25px}.slf-paid-stamp{right:6%;top:46%;font-size:30px;padding:7px 15px}}
      @media print{body{background:#fff;padding:0}.slf-appbar,.slf-mode-tip,.slf-print-tip{display:none!important}.slf-app-shell{width:100%;padding:0}.slf-receipt{box-shadow:none;border:1px solid #111;width:100%;max-width:100%;clip-path:none;page-break-inside:avoid}.slf-paid-stamp{opacity:.75}}
    </style>`;
}

function buildReceiptDocument(store: ReceiptStoreInfo, title: string, subtitle: string, createdAt: string, status: string, tone: ReceiptVisualTone, body: string, stampDate?: string): string {
  const storeName = receiptStoreName(store);
  const contact = formatReceiptContact(store);
  const generatedAt = createdAt ? formatDateTime(createdAt) : new Date().toLocaleString('pt-BR');
  const appTitle = storeName.toUpperCase().replace(/\s+E\s+/, ' E ');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>${buildReceiptStyles()}</head><body><div class="slf-app-shell"><div class="slf-appbar"><div class="slf-appbar-btn">☰</div><strong class="slf-appbar-title">${escapeHtml(appTitle)}</strong><div class="slf-appbar-actions"><div class="slf-appbar-btn">↻</div><div class="slf-appbar-btn">♢</div></div></div><main class="slf-receipt">${receiptStatusStamp(status, tone, stampDate)}<header class="slf-head"><div>${buildReceiptBrand(store)}</div><div class="slf-doc-title"><h1>${escapeHtml(title)}</h1><p>▣ ${escapeHtml(generatedAt)} · WhatsApp ${escapeHtml(contact)}</p><span class="slf-badge ${tone}">${escapeHtml(status.toUpperCase())}</span></div></header>${body}<footer class="slf-footer">${escapeHtml(store.receipt_message || 'Obrigado pela preferência.')} · Smart Loja Fácil</footer><div class="slf-print-tip">Visualização interna do app. Use PDF para baixar arquivo ou Enviar para compartilhar.</div></main></div></body></html>`;
}

function buildCustomerBox(name: string, phone: string, address = '-'): string {
  return `<section class="slf-customer-box"><div class="slf-customer-row"><span class="slf-customer-icon">●</span><span class="slf-customer-label">Cliente</span><strong class="slf-customer-value">${escapeHtml(name || 'Cliente')}</strong></div><div class="slf-customer-row"><span class="slf-customer-icon">☎</span><span class="slf-customer-label">Telefone</span><strong class="slf-customer-value">${escapeHtml(phone || '-')}</strong></div><div class="slf-customer-row"><span class="slf-customer-icon">◆</span><span class="slf-customer-label">Endereço</span><strong class="slf-customer-value">${escapeHtml(address || '-')}</strong></div></section>`;
}

function buildSummaryCards(cards: Array<{ icon: string; label: string; value: string }>): string {
  return `<section class="slf-summary-grid">${cards.map((card) => `<div class="slf-summary-card"><span class="icon">${escapeHtml(card.icon)}</span><span>${escapeHtml(card.label)}</span><strong>${escapeHtml(card.value)}</strong></div>`).join('')}</section>`;
}

function dueDateHint(installment: CreditInstallment): string {
  const dueDate = new Date(`${installment.due_date}T00:00:00`);
  if (Number.isNaN(dueDate.getTime())) return '';
  const days = Math.floor((startOfToday().getTime() - dueDate.getTime()) / 86400000);
  if (days > 0 && installmentStatusLabel(installment).toLowerCase().includes('venc')) return `Vencida há ${formatNumber(days)} dia(s)`;
  return '';
}

function buildInstallmentReceiptHtml(store: ReceiptStoreInfo, credit: CreditSummary, installment: CreditInstallment): string {
  const paid = paidOf(installment);
  const rest = remainingOf(installment);
  const status = installmentStatusLabel(installment);
  const tone = receiptStatusTone(status);
  const paidDate = installment.paid_at ? formatDateTime(installment.paid_at) : '';
  const method = installment.payment_method ? creditPaymentMethodLabel(String(installment.payment_method)) : 'Não informado';
  const title = receiptTitleForInstallment(status, tone);
  const dueHint = dueDateHint(installment);
  const noteTone = tone === 'paid' ? 'ok' : tone === 'overdue' || tone === 'danger' ? 'danger' : tone === 'partial' ? 'warn' : '';
  const body = `
    ${buildCustomerBox(credit.customer_name || 'Cliente', credit.customer_whatsapp || credit.customer_phone || '-')}
    <table class="slf-table" aria-label="Resumo da parcela"><thead><tr><th>Parcela</th><th>Vencimento</th><th class="num">Valor</th><th>Status</th></tr></thead><tbody>
      <tr><td>${installment.number}/${credit.installments.length}</td><td>${escapeHtml(dateOnly(installment.due_date))}</td><td class="num">${formatCurrency(installment.amount)}</td><td>${receiptStatusToken(status, tone)}</td></tr>
    </tbody></table>
    ${buildSummaryCards([
      { icon: '▣', label: 'Valor da parcela', value: formatCurrency(installment.amount) },
      { icon: '◉', label: tone === 'paid' ? 'Pago em' : 'Total pago', value: tone === 'paid' && paidDate ? dateOnly(installment.paid_at || '') : formatCurrency(paid) },
      { icon: '$', label: 'Situação', value: status },
    ])}
    <section class="slf-payment"><div class="slf-payment-head"><span>Pagamento</span><span>Total</span></div><div style="display:grid;grid-template-columns:1fr 170px;align-items:stretch">${buildPaymentRow(method)}<div class="slf-payment-total">${formatCurrency(tone === 'paid' ? paid : installment.amount)}</div></div></section>
    <section class="slf-note ${noteTone}"><div class="slf-note-title">Anotações</div><ul>
      <li>Venda/nota #${String(credit.sale_number || 0).padStart(4, '0')} · Parcela ${installment.number}/${credit.installments.length}.</li>
      <li>Vencimento: ${escapeHtml(dateOnly(installment.due_date))}${dueHint ? ` · ${escapeHtml(dueHint)}` : ''}.</li>
      <li>Status: ${escapeHtml(status)}${tone === 'paid' && paidDate ? ` em ${escapeHtml(paidDate)}` : ''}.</li>
      ${rest > 0.009 ? `<li>Valor ainda a acompanhar no crediário: ${formatCurrency(rest)}.</li>` : '<li>Parcela quitada sem saldo pendente.</li>'}
    </ul></section>`;
  return buildReceiptDocument(store, title, `Parcela ${installment.number}/${credit.installments.length}`, installment.paid_at || installment.due_date || credit.created_at, status, tone, body, tone === 'paid' && paidDate ? paidDate : undefined);
}

function savedReceiptHtmlBody(html: string): string {
  const source = html || '<p>Comprovante sem conteúdo salvo.</p>';
  const match = source.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match?.[1] || source;
}

function buildSavedReceiptHtml(store: ReceiptStoreInfo, receipt: ReceiptView): string {
  const status = receiptStatusLabel(receipt.status);
  const tone = receiptStatusTone(status);
  const bodyText = htmlToText(savedReceiptHtmlBody(receipt.content || '')).slice(0, 520);
  const body = `
    ${buildCustomerBox(receipt.customer_name || 'Consumidor', receipt.customer_whatsapp || '-')}
    <table class="slf-table" aria-label="Comprovante da venda"><thead><tr><th>Qtd.</th><th>Produto</th><th class="num">R$ un</th><th class="num">Total</th></tr></thead><tbody>
      <tr><td>1</td><td class="left">Venda #${String(receipt.sale_number || 0).padStart(4, '0')}</td><td class="num">${formatCurrency(receipt.total)}</td><td class="num">${formatCurrency(receipt.total)}</td></tr>
    </tbody></table>
    <section class="slf-payment"><div class="slf-payment-head"><span>Pagamento</span><span>Total</span></div><div style="display:grid;grid-template-columns:1fr 170px;align-items:stretch">${buildPaymentRow(receipt.receipt_type || '')}<div class="slf-payment-total">${formatCurrency(receipt.total)}</div></div></section>
    <section class="slf-note ${tone === 'paid' ? 'ok' : tone === 'overdue' || tone === 'danger' ? 'danger' : tone === 'partial' ? 'warn' : ''}"><div class="slf-note-title">Anotações</div><ul>
      <li>Comprovante da venda #${String(receipt.sale_number || 0).padStart(4, '0')} emitido em ${escapeHtml(formatDateTime(receipt.created_at))}.</li>
      <li>Status: ${escapeHtml(status)}. Total do comprovante: ${formatCurrency(receipt.total)}.</li>
      ${bodyText ? `<li>${escapeHtml(bodyText)}</li>` : '<li>Registro salvo em Comprovantes para reimpressão e envio ao cliente.</li>'}
    </ul></section>`;
  return buildReceiptDocument(store, 'COMPROVANTE DE VENDA', 'Venda salva', receipt.created_at, status, tone, body, tone === 'paid' ? formatDateTime(receipt.created_at) : undefined);
}

function buildCreditGeneralReceiptHtml(store: ReceiptStoreInfo, credit: CreditSummary): string {
  const paid = creditPaidTotal(credit);
  const balance = Math.max(0, Number(credit.balance || 0));
  const paidCount = credit.installments.filter((installment) => installmentStatusLabel(installment) === 'Paga').length;
  const partialCount = credit.installments.filter((installment) => installmentStatusLabel(installment).toLowerCase().includes('parcial')).length;
  const overdueCount = credit.installments.filter(isOverdue).length;
  const statusDetails = creditNoteStatusDetails(credit);
  const status = statusDetails.tone === 'paid' ? 'Nota paga' : statusDetails.tone === 'overdue' ? 'Nota atrasada' : statusDetails.tone === 'partial' ? 'Com pagamento parcial' : 'Nota em aberto';
  const tone = statusDetails.tone;
  const noteTone = tone === 'paid' ? 'ok' : tone === 'overdue' ? 'danger' : tone === 'partial' ? 'warn' : '';
  const body = `
    ${buildCustomerBox(credit.customer_name || 'Cliente', credit.customer_whatsapp || credit.customer_phone || '-')}
    <table class="slf-table" aria-label="Parcelas do crediário"><thead><tr><th>Parcela</th><th>Vencimento</th><th class="num">Valor</th><th>Status</th></tr></thead><tbody>
      ${credit.installments.map((installment) => {
        const label = installmentStatusLabel(installment);
        const rowTone = receiptStatusTone(label);
        return `<tr><td>${installment.number}/${credit.installments.length}</td><td>${escapeHtml(dateOnly(installment.due_date))}</td><td class="num">${formatCurrency(installment.amount)}</td><td>${receiptStatusToken(label, rowTone)}</td></tr>`;
      }).join('')}
    </tbody></table>
    ${buildSummaryCards([
      { icon: '▤', label: 'Total da nota', value: formatCurrency(credit.total) },
      { icon: '◉', label: 'Total pago', value: formatCurrency(paid) },
      { icon: '$', label: 'Saldo em aberto', value: formatCurrency(balance) },
    ])}
    <section class="slf-note ${noteTone}"><div class="slf-note-title">Anotações</div><ul>
      <li>Extrato da nota #${String(credit.sale_number || 0).padStart(4, '0')} emitida em ${escapeHtml(formatDateTime(credit.created_at))}.</li>
      <li>Parcelas pagas: ${paidCount}/${credit.installments.length}. Total da nota: ${formatCurrency(credit.total)}. Total pago: ${formatCurrency(paid)}.</li>
      <li>Acompanhar saldo em aberto no crediário: ${formatCurrency(balance)}.</li>
      ${partialCount ? `<li>${formatNumber(partialCount)} parcela(s) com pagamento parcial.</li>` : ''}
      ${overdueCount ? `<li>${formatNumber(overdueCount)} parcela(s) atrasada(s), destacada(s) em vermelho.</li>` : ''}
    </ul></section>`;
  return buildReceiptDocument(store, 'EXTRATO DO CREDIÁRIO', 'Nota inteira', credit.created_at, status, tone, body, tone === 'paid' ? formatDateTime(credit.created_at) : undefined);
}

function installmentShareText(credit: CreditSummary, installment: CreditInstallment): string {
  return [
    `Comprovante da parcela ${installment.number}/${credit.installments.length}`,
    `Cliente: ${credit.customer_name || 'Cliente'}`,
    `Venda/nota: #${String(credit.sale_number || 0).padStart(4, '0')}`,
    `Status: ${installmentStatusLabel(installment)}`,
    `Valor original: ${formatCurrency(installment.amount)}`,
    `Pago: ${formatCurrency(paidOf(installment))}`,
    `Restante: ${formatCurrency(remainingOf(installment))}`,
    `Vencimento: ${dateOnly(installment.due_date)}`,
  ].join('\n');
}

function creditGeneralShareText(credit: CreditSummary): string {
  const paidCount = credit.installments.filter((installment) => installmentStatusLabel(installment) === 'Paga').length;
  const overdueCount = credit.installments.filter(isOverdue).length;
  return [
    `Extrato do crediário / nota #${String(credit.sale_number || 0).padStart(4, '0')}`,
    `Cliente: ${credit.customer_name || 'Cliente'}`,
    `Total: ${formatCurrency(credit.total)}`,
    `Pago: ${formatCurrency(creditPaidTotal(credit))}`,
    `Restante: ${formatCurrency(credit.balance)}`,
    `Parcelas pagas: ${paidCount}/${credit.installments.length}`,
    overdueCount ? `Atenção: ${overdueCount} parcela(s) vencida(s).` : 'Sem parcela vencida no momento.',
  ].join('\n');
}

function buildInstallmentReceiptViews(store: ReceiptStoreInfo, credits: CreditSummary[]): ReceiptView[] {
  return credits.flatMap((credit) => credit.installments.map((installment) => ({
    id: `credit-installment-${installment.id}`,
    sale_id: credit.sale_id,
    sale_number: credit.sale_number,
    customer_name: credit.customer_name,
    customer_whatsapp: credit.customer_whatsapp || credit.customer_phone || '',
    receipt_type: 'parcela-crediario-a4',
    total: Number(installment.amount || 0),
    status: installmentStatusLabel(installment),
    created_at: installment.paid_at || installment.due_date || credit.created_at,
    content: buildInstallmentReceiptHtml(store, credit, installment),
    source_kind: 'parcelas',
    installment_number: installment.number,
    installment_total: credit.installments.length,
    installment_due_date: installment.due_date,
    installment_paid_amount: paidOf(installment),
    installment_remaining: remainingOf(installment),
  } satisfies ReceiptView)));
}

export function ReceiptsScreen({ status, refreshToken, onNavigate }: ReceiptsScreenProps): JSX.Element {
  const [savedReceipts, setSavedReceipts] = useState<ReceiptView[]>([]);
  const [credits, setCredits] = useState<CreditSummary[]>([]);
  const [selected, setSelected] = useState<ReceiptPreview | null>(null);
  const [fullPreview, setFullPreview] = useState<ReceiptPreview | null>(null);
  const [filter, setFilter] = useState<ReceiptFilter>('todos');
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(30);
  const [expandedCustomers, setExpandedCustomers] = useState<Record<string, boolean>>({});
  const [expandedCredits, setExpandedCredits] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [focusHandled, setFocusHandled] = useState(false);
  const previewPanelRef = useRef<HTMLElement | null>(null);

  const receiptStore = useMemo(() => normalizeReceiptStore(status?.settings), [status?.settings]);

  const loadReceipts = async () => {
    setLoading(true);
    try {
      const [rows, creditRows] = await Promise.all([api.receipts(), api.credits().catch(() => [])]);
      const normalizedReceipts = (rows as ReceiptView[]).map((receipt) => ({ ...receipt, source_kind: receipt.source_kind || receiptCategory(receipt) }));
      setSavedReceipts(normalizedReceipts);
      setCredits(creditRows as CreditSummary[]);
      setSelected((current) => current ? current : null);
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
  }, [filter, query]);

  const installmentReceiptViews = useMemo(() => buildInstallmentReceiptViews(receiptStore, credits), [credits, receiptStore]);

  const filteredSavedReceipts = useMemo(() => savedReceipts.filter((receipt) => {
    const category = receiptCategory(receipt);
    if (filter === 'crediario' || filter === 'parcelas') return false;
    if (filter !== 'todos' && filter !== category) return false;
    const term = query.trim().toLowerCase();
    if (!term) return true;
    return [receiptTitle(receipt), receipt.customer_name, receipt.customer_whatsapp, receipt.receipt_type, receipt.status, String(receipt.sale_number)]
      .some((value) => String(value || '').toLowerCase().includes(term));
  }), [filter, query, savedReceipts]);

  const filteredCredits = useMemo(() => {
    if (!['todos', 'crediario', 'parcelas'].includes(filter)) return [];
    const term = query.trim().toLowerCase();
    return credits.filter((credit) => {
      const installmentText = credit.installments.map((item) => `parcela ${item.number} ${installmentStatusLabel(item)} ${dateOnly(item.due_date)}`).join(' ');
      return !term || [
        credit.customer_name,
        credit.customer_phone,
        credit.customer_whatsapp,
        String(credit.sale_number),
        `nota ${credit.sale_number}`,
        `venda ${credit.sale_number}`,
        credit.status,
        installmentText,
      ].some((value) => String(value || '').toLowerCase().includes(term));
    });
  }, [credits, filter, query]);

  const groupedCredits = useMemo<CreditCustomerGroup[]>(() => {
    const groups = new Map<string, CreditCustomerGroup>();
    for (const credit of filteredCredits) {
      const customerName = credit.customer_name?.trim() || 'Cliente sem nome';
      const contact = credit.customer_whatsapp || credit.customer_phone || '';
      const key = `${customerName.toLowerCase()}|${contact}`;
      const current = groups.get(key) ?? {
        customerKey: key,
        customerName,
        contact,
        credits: [],
        total: 0,
        paid: 0,
        balance: 0,
        notesCount: 0,
        openNotes: 0,
        overdueInstallments: 0,
        partialInstallments: 0,
      };
      current.credits.push(credit);
      current.total += Number(credit.total || 0);
      current.paid += creditPaidTotal(credit);
      current.balance += Math.max(0, Number(credit.balance || 0));
      current.notesCount += 1;
      const noteStatus = creditNoteStatusDetails(credit);
      if (credit.status !== 'quitado' && Number(credit.balance || 0) > 0.009) current.openNotes += 1;
      current.overdueInstallments += noteStatus.overdueCount;
      current.partialInstallments += noteStatus.partialCount;
      groups.set(key, current);
    }
    return Array.from(groups.values()).sort((a, b) => b.balance - a.balance || a.customerName.localeCompare(b.customerName));
  }, [filteredCredits]);

  const totalReceipts = savedReceipts.length + installmentReceiptViews.length + credits.length;
  const totalValue = useMemo(() => savedReceipts.reduce((sum, receipt) => sum + Number(receipt.total || 0), 0) + credits.reduce((sum, credit) => sum + Number(credit.total || 0), 0), [credits, savedReceipts]);
  const pendingCount = useMemo(() => credits.flatMap((credit) => credit.installments).filter((installment) => remainingOf(installment) > 0.009 && installment.status !== 'pago').length, [credits]);

  function toggleCustomer(customerKey: string): void {
    setExpandedCustomers((current) => ({ ...current, [customerKey]: !current[customerKey] }));
  }

  function toggleCredit(creditId: string): void {
    setExpandedCredits((current) => ({ ...current, [creditId]: !current[creditId] }));
  }

  function savedReceiptPreview(receipt: ReceiptView): ReceiptPreview {
    return {
      kind: 'salvo',
      id: receipt.id,
      title: receiptTitle(receipt),
      customer: receipt.customer_name || 'Consumidor',
      createdAt: receipt.created_at,
      total: Number(receipt.total || 0),
      status: receiptStatusLabel(receipt.status),
      html: buildSavedReceiptHtml(receiptStore, receipt),
      phone: receipt.customer_whatsapp || '',
      fileStem: `comprovante-${receipt.sale_number || receipt.id}`,
    };
  }

  function creditPreview(credit: CreditSummary): ReceiptPreview {
    return {
      kind: 'nota',
      id: `credit-${credit.id}`,
      title: `Extrato da nota #${String(credit.sale_number || 0).padStart(4, '0')}`,
      customer: credit.customer_name || 'Cliente',
      createdAt: credit.created_at,
      total: Number(credit.total || 0),
      status: creditNoteStatusDetails(credit).label,
      html: buildCreditGeneralReceiptHtml(receiptStore, credit),
      phone: credit.customer_whatsapp || credit.customer_phone || '',
      credit,
      fileStem: `comprovante-nota-${credit.sale_number || credit.id}`,
    };
  }

  function installmentPreview(credit: CreditSummary, installment: CreditInstallment): ReceiptPreview {
    return {
      kind: 'parcela',
      id: `credit-${credit.id}-installment-${installment.id}`,
      title: `Parcela ${installment.number}/${credit.installments.length} · Nota #${String(credit.sale_number || 0).padStart(4, '0')}`,
      customer: credit.customer_name || 'Cliente',
      createdAt: installment.paid_at || installment.due_date || credit.created_at,
      total: Number(installment.amount || 0),
      status: installmentStatusLabel(installment),
      html: buildInstallmentReceiptHtml(receiptStore, credit, installment),
      phone: credit.customer_whatsapp || credit.customer_phone || '',
      credit,
      installment,
      fileStem: `comprovante-nota-${credit.sale_number || credit.id}-parcela-${installment.number}`,
    };
  }

  useEffect(() => {
    if (focusHandled || !credits.length) return;
    const focus = readReceiptFocusPayload();
    if (!focus) {
      setFocusHandled(true);
      return;
    }

    const targetCredit = credits.find((credit) => (focus.credit_id && credit.id === focus.credit_id) || (focus.sale_number && Number(credit.sale_number) === Number(focus.sale_number)));
    if (!targetCredit) {
      setFocusHandled(true);
      window.localStorage.removeItem(RECEIPTS_FOCUS_SALE_KEY);
      setFeedback({ tone: 'info', text: 'Abri a aba Comprovantes, mas não encontrei essa nota. Use a busca pelo cliente ou número da venda.' });
      return;
    }

    setFilter('crediario');
    setQuery(String(targetCredit.sale_number || ''));
    const customerName = targetCredit.customer_name?.trim() || 'Cliente sem nome';
    const contact = targetCredit.customer_whatsapp || targetCredit.customer_phone || '';
    const customerKey = `${customerName.toLowerCase()}|${contact}`;
    setExpandedCustomers((current) => ({ ...current, [customerKey]: true }));
    setExpandedCredits((current) => ({ ...current, [targetCredit.id]: true }));
    selectPreview(creditPreview(targetCredit));
    setFeedback({ tone: 'success', text: `Extrato da venda #${String(targetCredit.sale_number || 0).padStart(4, '0')} aberto em Comprovantes. Toque em Visualizar ou Baixar PDF.` });
    window.localStorage.removeItem(RECEIPTS_FOCUS_SALE_KEY);
    setFocusHandled(true);
  }, [credits, focusHandled, receiptStore]);

  function scrollToPreviewPanel(): void {
    window.setTimeout(() => previewPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }

  function selectPreview(preview: ReceiptPreview): void {
    setSelected(preview);
    scrollToPreviewPanel();
  }

  function selectAndOpenPreview(preview: ReceiptPreview): void {
    selectPreview(preview);
    setFullPreview(preview);
    setFeedback({ tone: 'success', text: 'Recibo aberto dentro do app com o padrão Jaque.' });
    notifyMobileAction({ title: 'Recibo aberto', message: `${preview.title} pronto para conferir dentro do app.`, tone: 'success', page: 'receipts', actionLabel: 'Ver' });
  }

  useEffect(() => {
    if (selected) scrollToPreviewPanel();
  }, [selected?.id]);

  async function exportPreview(preview: ReceiptPreview, printFormat: ReceiptPrintFormat = 'a4'): Promise<void> {
    setSaving(true);
    try {
      selectPreview(preview);
      const fileName = downloadPreviewPdf(preview);
      setFullPreview(preview);
      setFeedback({ tone: 'success', text: `PDF real baixado como ${fileName}. A prévia interna continua aberta no app para conferir ou tirar print.` });
      notifyMobileAction({ title: 'PDF baixado', message: `${fileName} foi gerado como arquivo PDF real.`, tone: 'success', page: 'receipts', actionLabel: 'Abrir tela' });
    } catch (error) {
      setFeedback({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  }

  function openFullPreview(preview: ReceiptPreview): void {
    selectPreview(preview);
    setFullPreview(preview);
    setFeedback({ tone: 'success', text: 'Visualização aberta dentro do próprio app. Não abre HTML solto no celular.' });
    notifyMobileAction({ title: 'Visualização aberta', message: `${preview.title} aberto dentro do app, sem HTML solto.`, tone: 'success', page: 'receipts', actionLabel: 'Conferir' });
  }

  async function sharePreview(preview: ReceiptPreview): Promise<void> {
    const baseText = preview.kind === 'nota'
      ? creditGeneralShareText(preview.credit)
      : preview.kind === 'parcela'
        ? installmentShareText(preview.credit, preview.installment)
        : `${preview.title}
Status: ${preview.status}
Cliente: ${preview.customer}
Total: ${formatCurrency(preview.total)}`;
    const pdfFile = buildPdfReceiptFile(preview);
    const shareFile = new File([pdfFile.blob], pdfFile.fileName, { type: 'application/pdf' });
    const sharePayload = {
      title: preview.title,
      text: `${baseText}

Segue o comprovante em PDF.`,
      files: [shareFile],
    } as ShareData & { files: File[] };
    const mobileNavigator = navigator as Navigator & { canShare?: (data: ShareData & { files?: File[] }) => boolean };

    if (navigator.share && mobileNavigator.canShare?.(sharePayload)) {
      try {
        await navigator.share(sharePayload);
        setFeedback({ tone: 'success', text: 'PDF pronto aberto no compartilhamento do celular. Escolha WhatsApp e envie o arquivo.' });
        notifyMobileAction({ title: 'PDF pronto para enviar', message: 'Compartilhamento abriu com o arquivo PDF anexado.', tone: 'success', page: 'receipts', actionLabel: 'Ver' });
        return;
      } catch {
        // Quando o usuário cancela ou o navegador bloqueia, baixa o PDF como fallback.
      }
    }

    triggerPdfDownload(pdfFile);
    const phone = safeWhatsapp(preview.phone || '');
    const fallbackText = `${baseText}

O PDF ${pdfFile.fileName} foi baixado neste aparelho. Anexe esse arquivo no WhatsApp para enviar o comprovante pronto.`;
    if (phone) {
      await api.openExternalUrl(`https://wa.me/${phone}?text=${encodeURIComponent(fallbackText)}`);
      setFeedback({ tone: 'info', text: 'Este navegador não permitiu anexar PDF automaticamente. Baixei o PDF e abri o WhatsApp com orientação para anexar o arquivo.' });
      notifyMobileAction({ title: 'PDF baixado', message: 'Anexe o PDF baixado no WhatsApp. Alguns navegadores bloqueiam anexo automático.', tone: 'info', page: 'receipts', actionLabel: 'Ver' });
      return;
    }
    await navigator.clipboard?.writeText(fallbackText).catch(() => undefined);
    setFeedback({ tone: 'info', text: 'PDF baixado. Texto de apoio copiado para colar no WhatsApp ou em outro app.' });
    notifyMobileAction({ title: 'PDF baixado', message: 'Anexe o arquivo baixado ao compartilhar.', tone: 'info', page: 'receipts', actionLabel: 'Ver' });
  }

  const visibleSavedReceipts = filteredSavedReceipts.slice(0, visibleCount);
  const hasAnyVisible = Boolean(visibleSavedReceipts.length || groupedCredits.length);

  return (
    <div className="mapp-screen mapp-receipts-screen">
      <section className="mapp-mini-stat-grid">
        <StatCard label="Comprovantes" value={formatNumber(totalReceipts)} detail="salvos, notas e parcelas" icon="comprovantes" tone="sky" />
        <StatCard label="Valor somado" value={formatCurrency(totalValue)} detail="vendas + notas" icon="dinheiro" tone="green" />
        <StatCard label="Atenção" value={formatNumber(pendingCount)} detail="parcelas pendentes" icon="crediario" tone="orange" />
      </section>

      {loading ? <div className="mapp-inline-status">Carregando comprovantes...</div> : null}
      {feedback ? <div className={`mapp-form-feedback mapp-form-feedback-${feedback.tone}`}>{feedback.text}</div> : null}

      <section className="mapp-success-card">
        <strong>Comprovantes organizados por cliente, nota e parcela</strong>
        <span>Agora esta aba usa o recibo preto/branco padrão Jaque. Visualizar abre dentro do app, PDF baixa como arquivo .pdf e Enviar tenta compartilhar o PDF pronto; se o navegador bloquear, baixa o PDF e orienta anexar no WhatsApp.</span>
      </section>

      <section className="mapp-filters-card mapp-receipts-filter-card">
        <label className="mapp-search-field">
          <InlineIcon name="relatorios" size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente, nota, venda, parcela ou telefone" />
        </label>
        <div className="mapp-filter-pills" role="tablist" aria-label="Filtrar comprovantes">
          {receiptFilters.map((item) => (
            <button key={item.key} type="button" className={filter === item.key ? 'active' : ''} onClick={() => setFilter(item.key)}>
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {fullPreview ? (
        <section className="mapp-receipt-fullscreen" role="dialog" aria-modal="true" aria-label={`Visualização do ${fullPreview.title}`}>
          <div className="mapp-receipt-fullscreen-toolbar">
            <button type="button" className="mapp-secondary-button" onClick={() => setFullPreview(null)}>Voltar</button>
            <div>
              <strong>{fullPreview.title}</strong>
              <span>{fullPreview.customer} · {fullPreview.status}</span>
            </div>
            <button type="button" className="mapp-primary-button" onClick={() => void exportPreview(fullPreview, 'a4')} disabled={saving}>{saving ? 'Gerando...' : 'PDF'}</button>
          </div>
          <iframe
            title={`Recibo em tela cheia - ${fullPreview.title}`}
            className="mapp-receipt-fullscreen-frame"
            sandbox=""
            srcDoc={fullPreview.html || '<p>Comprovante sem prévia HTML salva.</p>'}
          />
        </section>
      ) : null}

      {selected ? (
        <section className="mapp-form-panel mapp-receipt-preview" ref={previewPanelRef}>
          <div className="mapp-form-head">
            <span className="mapp-form-icon tone-sky"><InlineIcon name="comprovantes" size={24} /></span>
            <div>
              <strong>{selected.title}</strong>
              <p>{selected.customer} · {formatDateTime(selected.createdAt)}</p>
            </div>
          </div>
          <div className="mapp-receipt-summary">
            <span>Total <strong>{formatCurrency(selected.total)}</strong></span>
            <span>Tipo <strong>{selected.kind === 'nota' ? 'Nota inteira' : selected.kind === 'parcela' ? 'Parcela' : 'Salvo'}</strong></span>
            <span className={`mapp-receipt-status-chip ${receiptStatusTone(selected.status)}`}>Status <strong>{selected.status}</strong></span>
          </div>
          <iframe
            title={`Prévia segura do ${selected.title}`}
            className="mapp-receipt-frame"
            sandbox=""
            srcDoc={selected.html || '<p>Comprovante sem prévia HTML salva.</p>'}
          />
          <div className="mapp-button-grid mapp-receipt-button-grid">
            <button type="button" className="mapp-primary-button" onClick={() => openFullPreview(selected)}>Visualizar</button>
            <button type="button" className="mapp-secondary-button" onClick={() => void exportPreview(selected, 'a4')} disabled={saving}>{saving ? 'Gerando...' : 'Baixar PDF'}</button>
            <button type="button" className="mapp-secondary-button" onClick={() => void sharePreview(selected)}>Enviar / compartilhar</button>
            <button type="button" className="mapp-secondary-button" onClick={() => setSelected(null)}>Fechar prévia</button>
          </div>
        </section>
      ) : null}

      {groupedCredits.length ? (
        <section className="mapp-credit-customer-list mapp-receipt-credit-list" aria-label="Comprovantes do crediário por cliente">
          {groupedCredits.map((group) => {
            const customerExpanded = expandedCustomers[group.customerKey] ?? true;
            return (
              <section key={group.customerKey} className="mapp-credit-customer-card mapp-receipt-customer-card">
                <button type="button" className="mapp-credit-customer-head mapp-receipt-customer-head" onClick={() => toggleCustomer(group.customerKey)} aria-expanded={customerExpanded}>
                  <div className="mapp-credit-customer-avatar" aria-hidden="true">{customerInitials(group.customerName)}</div>
                  <div>
                    <strong>{group.customerName}</strong>
                    <small>{group.notesCount} nota(s) · {group.openNotes} em aberto · {group.contact || 'sem telefone cadastrado'}</small>
                  </div>
                  <em className={group.balance <= 0.009 ? 'ok' : group.overdueInstallments > 0 ? 'danger' : 'warn'}>{group.balance <= 0.009 ? 'Sem saldo' : group.overdueInstallments > 0 ? `Atrasado · ${formatCurrency(group.balance)}` : `Aberto · ${formatCurrency(group.balance)}`}</em>
                </button>
                {customerExpanded ? (
                  <>
                    <div className="mapp-credit-customer-totals">
                      <span>Total <b>{formatCurrency(group.total)}</b></span>
                      <span>Pago <b>{formatCurrency(group.paid)}</b></span>
                      <span>Restante <b>{formatCurrency(group.balance)}</b></span>
                    </div>
                    {group.overdueInstallments > 0 || group.partialInstallments > 0 ? (
                      <div className={`mapp-receipt-customer-alert ${group.overdueInstallments > 0 ? 'danger' : 'warn'}`}>
                        {group.overdueInstallments > 0 ? `${formatNumber(group.overdueInstallments)} parcela(s) atrasada(s)` : `${formatNumber(group.partialInstallments)} parcela(s) com pagamento parcial`}
                      </div>
                    ) : null}
                    <div className="mapp-credit-list" aria-label={`Notas do cliente ${group.customerName}`}>
                      {group.credits.map((credit) => {
                        const expanded = expandedCredits[credit.id] ?? false;
                        const noteStatus = creditNoteStatusDetails(credit);
                        const paidCount = noteStatus.paidCount;
                        const creditReceipt = creditPreview(credit);
                        return (
                          <article key={credit.id} className={`mapp-credit-card mapp-receipt-note-card ${expanded ? 'expanded' : ''}`}>
                            <button type="button" className="mapp-credit-note-head" onClick={() => toggleCredit(credit.id)} aria-expanded={expanded}>
                              <span><InlineIcon name="comprovantes" size={24} /></span>
                              <div>
                                <strong>Nota/Venda #{String(credit.sale_number).padStart(4, '0')}</strong>
                                <small>{formatDateTime(credit.created_at)} · {paidCount}/{credit.installments.length} parcela(s) pagas</small>
                                <small className={`mapp-note-status-line ${noteStatus.tone}`}>{noteStatus.detail}</small>
                                <small>Toque para {expanded ? 'recolher' : 'abrir'} as parcelas desta nota</small>
                              </div>
                              <em className={noteStatus.tone}>{noteStatus.label}</em>
                            </button>
                            <div className="mapp-credit-totals">
                              <div><span>Total da nota</span><strong>{formatCurrency(credit.total)}</strong></div>
                              <div><span>Pago</span><strong>{formatCurrency(creditPaidTotal(credit))}</strong></div>
                              <div><span>Restante</span><strong>{formatCurrency(credit.balance)}</strong></div>
                              <div><span>Parcelas</span><strong>{paidCount}/{credit.installments.length}</strong></div>
                            </div>
                            <div className="mapp-credit-note-actions" aria-label="Ações do comprovante geral da nota">
                              <button type="button" onClick={() => selectAndOpenPreview(creditReceipt)}>Visualizar</button>
                              <button type="button" onClick={() => void exportPreview(creditReceipt, 'a4')} disabled={saving}>{saving ? 'Gerando...' : 'PDF'}</button>
                              <button type="button" onClick={() => void sharePreview(creditReceipt)} disabled={saving}>Enviar extrato</button>
                            </div>
                            {expanded ? (
                              <div className="mapp-installment-list">
                                {credit.installments.map((installment) => {
                                  const statusLabel = installmentStatusLabel(installment);
                                  const tone = installmentStatusTone(installment);
                                  const parcelReceipt = installmentPreview(credit, installment);
                                  return (
                                    <div key={installment.id} className={`mapp-installment-row mapp-installment-row-${tone} ${isOverdue(installment) ? 'overdue' : ''}`}>
                                      <div className="mapp-installment-main">
                                        <strong>Parcela {formatNumber(installment.number)}/{formatNumber(credit.installments.length)}</strong>
                                        <small>{statusLabel} · vence {dateOnly(installment.due_date)}</small>
                                        <div className="mapp-installment-values">
                                          <span>Original <b>{formatCurrency(installment.amount)}</b></span>
                                          <span>Pago <b>{formatCurrency(paidOf(installment))}</b></span>
                                          <span>Restante <b>{formatCurrency(remainingOf(installment))}</b></span>
                                        </div>
                                      </div>
                                      <b className={`mapp-installment-status ${tone}`}>{statusLabel}</b>
                                      <div className="mapp-installment-actions mapp-installment-actions-slim">
                                        <button type="button" onClick={() => selectAndOpenPreview(parcelReceipt)}>Visualizar</button>
                                        <button type="button" onClick={() => void exportPreview(parcelReceipt, 'a4')} disabled={saving}>{saving ? 'Gerando...' : 'PDF'}</button>
                                        <button type="button" onClick={() => void sharePreview(parcelReceipt)} disabled={saving}>Enviar</button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  </>
                ) : null}
              </section>
            );
          })}
        </section>
      ) : null}

      {visibleSavedReceipts.length ? (
        <section className="mapp-crud-list mapp-receipt-saved-list" aria-label="Comprovantes salvos">
          <div className="mapp-section-title-row">
            <strong>Comprovantes salvos de vendas e caixa</strong>
            <small>{formatNumber(filteredSavedReceipts.length)} registro(s)</small>
          </div>
          {visibleSavedReceipts.map((receipt) => {
            const preview = savedReceiptPreview(receipt);
            return (
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
                    <button type="button" onClick={() => selectAndOpenPreview(preview)}>Ver</button>
                    <button type="button" onClick={() => void exportPreview(preview, 'a4')} disabled={saving}>{saving ? 'Gerando...' : 'PDF'}</button>
                    <button type="button" onClick={() => void sharePreview(preview)}>Enviar</button>
                  </div>
                </div>
              </article>
            );
          })}
          {filteredSavedReceipts.length > visibleCount ? (
            <button type="button" className="mapp-secondary-button mapp-load-more" onClick={() => setVisibleCount((count) => count + 30)}>
              Ver mais comprovantes ({filteredSavedReceipts.length - visibleCount} restantes)
            </button>
          ) : null}
        </section>
      ) : null}

      {!hasAnyVisible && !loading ? (
        <EmptyState icon="comprovantes" title="Nenhum comprovante neste filtro" detail="Use a busca por cliente/nota ou gere uma venda/recebimento. Extratos do crediário aparecem aqui por cliente e nota." actionLabel="Ir para vendas" actionPage="sales" onNavigate={onNavigate} />
      ) : null}
    </div>
  );
}
