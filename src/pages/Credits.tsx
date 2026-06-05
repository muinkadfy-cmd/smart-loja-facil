import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { TableFilters } from '../components/TableFilters';
import { api } from '../lib/api';
import { matchesFilterQuery } from '../lib/filter';
import { dateTime, makeRequestId, money } from '../lib/format';
import {
  COMPACT_CREDIT_LIMIT,
  FRIENDLY_LIST_MESSAGES,
  LOAD_MORE_STEP,
  SEARCH_RESULT_LIMIT,
  canRunListSearch,
  limitForQuery,
  resetLimitForQuery,
  useDebouncedValue,
} from '../lib/listLimits';
import { whatsappChatUrl } from '../lib/links';
import { getPreferredPdfFolder, setPreferredPdfFolder } from '../lib/preferences';
import type { CreditInstallment, CreditSummary, PaymentMethod, Settings } from '../types';

interface PageProps { refreshToken: number; onChanged: () => void; }

interface ReceiveState {
  credit: CreditSummary;
  installment: CreditInstallment;
}

interface PreviewState {
  credit: CreditSummary;
  installment: CreditInstallment;
}

function dateOnly(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('pt-BR');
}

function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function isInstallmentOverdue(installment: CreditInstallment): boolean {
  if (installment.status === 'pago') return false;
  const dueDate = new Date(`${installment.due_date}T00:00:00`);
  if (Number.isNaN(dueDate.getTime())) return false;
  return dueDate < startOfToday();
}

function normalizeWhatsapp(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55')) return digits;
  return `55${digits}`;
}

function installmentStatusLabel(installment: CreditInstallment): string {
  if (installment.status === 'pago') return 'Paga';
  if (installment.status === 'parcial') return 'Parcial';
  return 'Em aberto';
}

function creditStatusLabel(status: string): string {
  if (status === 'quitado') return 'Quitada';
  return 'Em aberto';
}

function creditStatusClass(status: string): string {
  if (status === 'quitado') return 'pill pill-success';
  return 'pill';
}

function installmentStatusClass(installment: CreditInstallment): string {
  if (installment.status === 'pago') return 'pill pill-success';
  if (isInstallmentOverdue(installment)) return 'pill pill-danger';
  if (installment.status === 'parcial') return 'pill pill-warning';
  return 'pill';
}

function installmentDueClass(installment: CreditInstallment): string {
  if (installment.status === 'pago') return 'due-text due-text-success';
  if (isInstallmentOverdue(installment)) return 'due-text due-text-danger';
  return 'due-text';
}

function paymentLabel(installment: CreditInstallment): string {
  return installment.status === 'pago' ? 'Recebida' : installment.status === 'parcial' ? 'Parcial' : 'Em aberto';
}

function normalizePaymentMethod(value?: PaymentMethod | string | null): string {
  return (value || '').toString().trim().toLowerCase();
}

function isPaidWith(installment: CreditInstallment, method: 'pix' | 'dinheiro' | 'cartao'): boolean {
  if (installment.status !== 'pago') return false;
  const current = normalizePaymentMethod(installment.payment_method);
  if (!current) return false;
  if (method === 'cartao') {
    return current === 'cartao' || current === 'cartão' || current === 'credito' || current === 'crédito' || current === 'debito' || current === 'débito';
  }
  return current === method;
}

function paymentOptionClass(installment: CreditInstallment, method: 'pix' | 'dinheiro' | 'cartao'): string {
  return isPaidWith(installment, method) ? 'payment-option selected' : 'payment-option';
}

const JAQUE_LOGO_PREMIUM_URL = '/brand/jaque-logo-premium.png';

function buildInstallmentHtml(settings: Settings | null, credit: CreditSummary, installment: CreditInstallment): string {
  const isPaid = installment.status === 'pago';
  const remaining = Math.max(0, installment.amount - installment.paid_amount);
  const storePhone = settings?.phone || '';
  const storeWhatsapp = settings?.whatsapp || '';
  const contact = credit.customer_whatsapp || credit.customer_phone || '-';
  const blankRows = Array.from({ length: 8 }, () => '<tr class="blank"><td>&nbsp;</td><td></td><td></td><td></td></tr>').join('');
  const notes = installment.status === 'pago'
    ? `Recebida em ${installment.paid_at ? dateTime(installment.paid_at) : 'data local'}.`
    : installment.status === 'parcial'
      ? `Pagamento parcial registrado. Restante: ${money(remaining)}.`
      : `Parcela pendente com vencimento em ${dateOnly(installment.due_date)}.`;
  const cleanPhone = storePhone || storeWhatsapp || '(43) 99607-9372';
  const cleanInstagram = storeWhatsapp ? storeWhatsapp.replace(/^@/, '') : 'jaqueconfeccoes';
  const printedValue = money(installment.amount);
  const paidStampOverlay = installment.status === 'pago' && installment.paid_at
    ? `<div class="paid-stamp-overlay" aria-label="Parcela paga"><div class="paid-stamp-overlay-title">PAGO</div><div class="paid-stamp-overlay-date">Em, ${dateOnly(installment.paid_at.slice(0, 10))}</div></div>`
    : '';
  const accentPrimary = '#c44d7f';
  const accentSoft = '#e3a5c0';
  const accentSoftStrong = '#d48ead';
  const accentText = '#bf4d80';
  const accentBorder = 'rgba(196,78,128,0.16)';
  const stampBorder = 'rgba(21,16,20,0.92)';
  const stampInset = 'rgba(21,16,20,0.16)';
  const stampInner = 'rgba(21,16,20,0.55)';
  const stampBg = 'rgba(255,255,255,0.62)';
  const stampText = '#151014';

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Comprovante parcela ${installment.number}</title>
      <style>
        @page { size: 104mm 144mm; margin: 0; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        html,
        body {
          width: 104mm;
          height: 144mm;
          margin: 0;
          padding: 0;
          overflow: hidden;
          background: #ffffff;
          color: #171217;
          font-family: Arial, Helvetica, sans-serif;
        }
        body { display: block; }
        .sheet {
          position: relative;
          width: 104mm;
          height: 144mm;
          margin: 0;
          padding: 3.6mm 6.6mm 3.6mm;
          background:
            linear-gradient(90deg, rgba(196,78,128,0.05), rgba(255,255,255,0) 16mm, rgba(255,255,255,0) calc(100% - 16mm), rgba(196,78,128,0.05)),
            #fff;
          overflow: hidden;
          page-break-after: avoid;
          page-break-before: avoid;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .sheet::after {
          content: '';
          position: absolute;
          inset: 1.4mm 1.6mm;
          border: 0.16mm solid ${accentBorder};
          pointer-events: none;
        }
        .cut-line {
          position: absolute;
          left: 6.6mm;
          right: 6.6mm;
          top: 1.45mm;
          height: 0.78mm;
          background: ${accentPrimary};
          border-radius: 999px;
        }
        .top {
          height: 23.8mm;
          display: grid;
          grid-template-columns: 1fr 35.5mm;
          align-items: start;
          column-gap: 3.6mm;
          margin: 1.45mm 0 2.25mm;
          position: relative;
          z-index: 1;
        }
        .brand {
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-left: 15.4mm;
          padding-top: 0.2mm;
          min-width: 0;
        }
        .brand-logo {
          display: block;
          width: 40.8mm;
          max-height: 21.0mm;
          object-fit: contain;
          object-position: center top;
          filter: drop-shadow(0 0.22mm 0.2mm rgba(112,46,76,0.17));
        }
        .contact {
          color: ${accentText};
          font-size: 6.05pt;
          line-height: 1.55;
          font-weight: 800;
          font-style: normal;
          padding-top: 8.2mm;
          white-space: nowrap;
        }
        .contact div {
          display: flex;
          align-items: center;
          gap: 1.25mm;
          min-height: 3.1mm;
        }
        .contact div::before {
          display: inline-flex;
          width: 3.1mm;
          height: 3.1mm;
          align-items: center;
          justify-content: center;
          border: 0.18mm solid rgba(196,78,128,0.58);
          border-radius: 50%;
          color: ${accentText};
          font-size: 5.4pt;
          font-weight: 900;
          line-height: 1;
        }
        .contact .phone::before { content: '☎'; }
        .contact .insta::before { content: '◎'; }
        .meta {
          position: relative;
          z-index: 1;
          display: grid;
          gap: 1.6mm;
          margin-bottom: 2.15mm;
          padding: 0 0.7mm;
        }
        .meta-row {
          display: grid;
          grid-template-columns: 18.8mm 1fr;
          align-items: end;
          gap: 2.1mm;
          min-height: 4.55mm;
          font-size: 9.25pt;
          line-height: 1;
        }
        .meta-row strong {
          font-size: 9.75pt;
          font-weight: 850;
          letter-spacing: -0.1pt;
        }
        .line {
          min-height: 4.45mm;
          border-bottom: 0.30mm solid #211d21;
          padding: 0 1.7mm 0.75mm;
          font-size: 6.7pt;
          font-weight: 750;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }
        .double-line {
          position: relative;
          z-index: 1;
          height: 2.25mm;
          border-top: 0.26mm solid #211d21;
          border-bottom: 0.26mm solid #211d21;
          margin: 0.15mm 0 1.15mm;
        }
        table.items {
          position: relative;
          z-index: 1;
          width: 100%;
          table-layout: fixed;
          border-collapse: collapse;
          border: 0.32mm solid #201c20;
          font-size: 5.75pt;
          line-height: 1.05;
          margin: 0;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .items th,
        .items td {
          border: 0.22mm solid #201c20;
          padding: 0.38mm 0.85mm;
          height: 4.33mm;
          vertical-align: middle;
          overflow: hidden;
        }
        .items th {
          height: 6.05mm;
          background: linear-gradient(180deg, ${accentSoft} 0%, ${accentSoftStrong} 100%);
          color: #241c23;
          text-align: center;
          font-weight: 600;
        }
        .items th.product-head {
          font-size: 11.2pt;
          font-weight: 500;
          letter-spacing: 0;
        }
        .items th.qty-head { width: 10.7mm; font-size: 7.6pt; }
        .items th.unit-head { width: 14.4mm; font-size: 6.9pt; }
        .items th.total-head { width: 14.5mm; font-size: 7.1pt; }
        .items td.qty { text-align: center; font-weight: 850; }
        .items td.product {
          font-size: 5.35pt;
          font-weight: 850;
          white-space: nowrap;
          text-overflow: ellipsis;
        }
        .items td.money {
          text-align: right;
          white-space: nowrap;
          font-weight: 850;
          font-size: 5.15pt;
        }
        .items tr.blank td { color: transparent; }
        .payment-block {
          position: relative;
          z-index: 1;
          width: 100%;
          display: grid;
          grid-template-columns: 1fr 26.0mm;
          border-left: 0.32mm solid #201c20;
          border-right: 0.32mm solid #201c20;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .payment-title,
        .total-title {
          height: 7.15mm;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(180deg, ${accentSoft} 0%, ${accentSoftStrong} 100%);
          border-bottom: 0.32mm solid #201c20;
          color: #241c23;
          font-size: 11.6pt;
          line-height: 1;
          font-weight: 500;
          letter-spacing: -0.15pt;
        }
        .payment-title { border-right: 0.32mm solid #201c20; }
        .payment-options,
        .payment-total {
          min-height: 6.45mm;
          border-bottom: 0.36mm solid #201c20;
        }
        .payment-options {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1.0mm;
          padding: 0 2.2mm;
          border-right: 0.32mm solid #201c20;
          font-size: 6.35pt;
          font-weight: 780;
          white-space: nowrap;
        }
        .payment-option {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 0.35mm;
          min-height: 4.6mm;
          padding: 0.35mm 0.9mm 0.25mm;
          border: 0.22mm solid transparent;
          border-radius: 999px;
        }
        .payment-option.selected {
          border-color: #1e171d;
          background: rgba(255,255,255,0.42);
          box-shadow: 0 0 0 0.12mm rgba(30,23,29,0.18) inset;
        }
        .payment-option.selected::after {
          content: '';
          position: absolute;
          inset: -0.45mm;
          border: 0.22mm solid rgba(30,23,29,0.55);
          border-radius: 999px;
          transform: rotate(-3deg);
          pointer-events: none;
        }
        .heart {
          color: #d98fb1;
          font-size: 12.2pt;
          line-height: 1;
          vertical-align: -1.3pt;
          margin-right: 0.20mm;
          text-shadow: 0 0.15mm 0 rgba(160,72,112,0.12);
        }
        .payment-total {
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          font-size: 7.05pt;
          font-weight: 900;
          line-height: 1.05;
        }
        .notes {
          position: relative;
          z-index: 1;
          height: 18.3mm;
          border-left: 0.32mm solid #201c20;
          border-right: 0.32mm solid #201c20;
          border-bottom: 0.36mm solid #201c20;
          padding: 1.45mm 3.2mm 1.5mm;
          text-align: center;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .notes strong {
          display: block;
          margin: 0 0 1.25mm;
          font-size: 10.0pt;
          font-weight: 550;
          letter-spacing: -0.1pt;
        }
        .notes p {
          margin: 0.55mm 0 0;
          color: #50464f;
          text-align: left;
          font-size: 5.45pt;
          line-height: 1.16;
        }
        .doc-body {
          position: relative;
          z-index: 1;
        }
        .paid-stamp-overlay {
          position: absolute;
          left: 4.1mm;
          top: 29.6mm;
          width: 31.8mm;
          min-height: 13.8mm;
          padding: 1.2mm 1.8mm 1.25mm;
          border: 0.28mm solid ${stampBorder};
          border-radius: 0.65mm;
          background: ${stampBg};
          color: ${stampText};
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-start;
          gap: 0.4mm;
          transform: rotate(-7deg);
          opacity: 0.94;
          pointer-events: none;
          box-shadow: 0 0 0 0.14mm ${stampInset} inset;
        }
        .paid-stamp-overlay::after {
          content: '';
          position: absolute;
          inset: 0.65mm;
          border: 0.14mm solid ${stampInner};
          border-radius: 0.3mm;
        }
        .paid-stamp-overlay-title {
          position: relative;
          z-index: 1;
          font-size: 17.2pt;
          line-height: 0.92;
          font-weight: 900;
          letter-spacing: 0.22mm;
        }
        .paid-stamp-overlay-date {
          position: relative;
          z-index: 1;
          font-size: 8.6pt;
          line-height: 1;
          font-weight: 800;
          white-space: nowrap;
        }
        @media screen {
          body { background: #f2f2f2; padding: 8px; }
          .sheet { box-shadow: 0 0 0 1px #ddd, 0 16px 38px rgba(0,0,0,.18); }
        }
        @media print {
          html, body, .sheet { width: 104mm; height: 144mm; }
          body { background: #fff; }
          .sheet { box-shadow: none; }
        }
      </style>
    </head>
    <body>
      <main class="sheet">
        <div class="cut-line"></div>
        <header class="top">
          <div class="brand">
            <img class="brand-logo" src="${JAQUE_LOGO_PREMIUM_URL}" alt="Jaque Confecções e Presentes" loading="eager" width="154" height="79" />
          </div>
          <address class="contact">
            <div class="phone">${cleanPhone}</div>
            <div class="insta">@${cleanInstagram}</div>
          </address>
        </header>

        <section class="meta">
          <div class="meta-row"><strong>Cliente:</strong><div class="line">${credit.customer_name}</div></div>
          <div class="meta-row"><strong>Data:</strong><div class="line">${dateOnly(installment.due_date)}</div></div>
          <div class="meta-row"><strong>Contato:</strong><div class="line">${contact}</div></div>
        </section>

        <div class="doc-body">
          <div class="double-line"></div>

          <table class="items" aria-label="Produtos do comprovante">
            <thead>
              <tr>
                <th class="qty-head">Qtd.</th>
                <th class="product-head">Produto</th>
                <th class="unit-head">R$ un.</th>
                <th class="total-head">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="qty">1</td>
                <td class="product">Parcela #${installment.number} - crediário</td>
                <td class="money">${printedValue}</td>
                <td class="money">${printedValue}</td>
              </tr>
              ${blankRows}
            </tbody>
          </table>

          ${paidStampOverlay}

          <section class="payment-block" aria-label="Pagamento e total">
            <div class="payment-title">Pagamento</div>
            <div class="total-title">Total</div>
            <div class="payment-options">
            <span class="${paymentOptionClass(installment, 'pix')}"><b class="heart">♥</b>Pix</span>
            <span class="${paymentOptionClass(installment, 'dinheiro')}"><b class="heart">♥</b>Dinheiro</span>
            <span class="${paymentOptionClass(installment, 'cartao')}"><b class="heart">♥</b>Crédito</span>
            <span class="payment-option"><b class="heart">♥</b>Débito</span>
          </div>
            <div class="payment-total">R$<br>${printedValue.replace('R$ ', '')}</div>
          </section>

          <section class="notes">
            <strong>Anotações:</strong>
            <p>${notes}</p>
            <p>Valor original: ${money(installment.amount)} · Pago: ${money(installment.paid_amount)} · Restante: ${money(remaining)} · Status: ${installmentStatusLabel(installment)}</p>
            <p>Saldo total do crediário: ${money(credit.balance)}</p>
          </section>
        </div>
      </main>
    </body>
  </html>`;
}

function buildInstallmentWhatsapp(credit: CreditSummary, installment: CreditInstallment, pdfPath: string): string {
  return [
    `Parcela #${installment.number} do crediário`,
    `Cliente: ${credit.customer_name}`,
    `Venda: #${credit.sale_number || '-'}`,
    `Status: ${installmentStatusLabel(installment)}`,
    `Valor: ${money(installment.amount)}`,
    `Pago: ${money(installment.paid_amount)}`,
    `Restante: ${money(Math.max(0, installment.amount - installment.paid_amount))}`,
    `Vencimento: ${dateOnly(installment.due_date)}`,
    `PDF salvo em: ${pdfPath}`,
    'Anexe o PDF que foi aberto na pasta.',
  ].join('\n');
}

export function CreditsPage({ refreshToken, onChanged }: PageProps): JSX.Element {
  const [rows, setRows] = useState<CreditSummary[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query);
  const [visibleLimit, setVisibleLimit] = useState(COMPACT_CREDIT_LIMIT);
  const [statusFilter, setStatusFilter] = useState('todos');
  const [expandedCredits, setExpandedCredits] = useState<Record<string, boolean>>({});
  const [receiving, setReceiving] = useState<ReceiveState | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pdfFolder, setPdfFolder] = useState<string | null>(getPreferredPdfFolder());
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<Exclude<PaymentMethod, 'crediario'>>('dinheiro');

  useEffect(() => {
    Promise.all([api.credits(), api.settings()])
      .then(([credits, appSettings]) => {
        setRows(credits);
        setSettings(appSettings);
      })
      .catch(() => undefined);
  }, [refreshToken]);

  async function reload() {
    const [credits, appSettings] = await Promise.all([api.credits(), api.settings()]);
    setRows(credits);
    setSettings(appSettings);
    onChanged();
  }

  function openReceiveModal(credit: CreditSummary, installment: CreditInstallment) {
    setError('');
    setMessage('');
    setReceiving({ credit, installment });
    setAmount(Math.max(0, installment.amount - installment.paid_amount));
    setMethod('dinheiro');
  }

  async function submitReceive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!receiving || saving) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.receiveInstallment({
        request_id: makeRequestId('pay'),
        credit_id: receiving.credit.id,
        installment_id: receiving.installment.id,
        amount,
        method,
        settle_with_redistribution: false,
      });
      await reload();
      setReceiving(null);
      setMessage('Recebimento lançado no crediário mantendo o valor original da parcela.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function openPdfPreview(credit: CreditSummary, installment: CreditInstallment) {
    setPreview({ credit, installment });
  }

  async function exportPreviewPdf(credit: CreditSummary, installment: CreditInstallment, openAfter = true): Promise<string> {
    const html = buildInstallmentHtml(settings, credit, installment);
    const fileStem = `crediario-${credit.customer_name}-parcela-${installment.number}-${installment.status}`;
    return await api.exportHtmlPdf(html, fileStem, openAfter, pdfFolder);
  }

  async function choosePdfFolder() {
    setError('');
    try {
      const folder = await api.pickExportFolder();
      if (!folder) return;
      setPreferredPdfFolder(folder);
      setPdfFolder(folder);
      setMessage(`Pasta de PDFs atualizada para ${folder}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function downloadPdf() {
    if (!preview) return;
    setError('');
    try {
      const path = await exportPreviewPdf(preview.credit, preview.installment, true);
      setMessage(`PDF gerado em ${path}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function sendWhatsapp(credit: CreditSummary, installment: CreditInstallment) {
    const whatsapp = normalizeWhatsapp(credit.customer_whatsapp);
    if (!whatsapp) {
      setError('Esse cliente não tem WhatsApp cadastrado.');
      return;
    }
    setError('');
    try {
      const pdfPath = await exportPreviewPdf(credit, installment, false);
      await api.openExternalUrl(whatsappChatUrl(whatsapp, buildInstallmentWhatsapp(credit, installment, pdfPath)));
      await api.revealFile(pdfPath);
      setMessage('WhatsApp aberto e PDF gerado. A pasta do arquivo foi aberta para anexar.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const summary = useMemo(() => {
    const openCredits = rows.filter((row) => row.status === 'aberto');
    const overdue = rows.flatMap((credit) => credit.installments.filter((item) => isInstallmentOverdue(item)));
    return {
      customers: openCredits.length,
      balance: openCredits.reduce((sum, row) => sum + row.balance, 0),
      overdue: overdue.length,
    };
  }, [rows]);

  useEffect(() => {
    setVisibleLimit(resetLimitForQuery(debouncedQuery, COMPACT_CREDIT_LIMIT));
  }, [debouncedQuery, statusFilter]);

  const filteredCredits = useMemo(() => rows.filter((row) => {
    const matchesStatus = statusFilter === 'todos' || row.status === statusFilter;
    const matchesQuery = !canRunListSearch(debouncedQuery) ? true : matchesFilterQuery(debouncedQuery, [
      row.customer_name,
      row.customer_phone,
      row.customer_whatsapp,
      row.sale_number,
      row.total,
      row.balance,
      row.status,
      row.created_at,
    ]);
    return matchesStatus && matchesQuery;
  }), [debouncedQuery, rows, statusFilter]);

  const visibleCredits = useMemo(() => filteredCredits.slice(0, limitForQuery(debouncedQuery, visibleLimit)), [debouncedQuery, filteredCredits, visibleLimit]);
  const canLoadMoreCredits = visibleCredits.length < filteredCredits.length && !debouncedQuery.trim();
  const manyCreditResults = debouncedQuery.trim() && filteredCredits.length > SEARCH_RESULT_LIMIT;

  function nextImportantInstallment(credit: CreditSummary): CreditInstallment | null {
    return [...credit.installments]
      .filter((item) => item.status !== 'pago')
      .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.number - b.number)[0]
      ?? credit.installments[0]
      ?? null;
  }

  return (
    <div className="stack classic-legacy-page">
      <div className="page-title classic-legacy-title">
        <div>
          <h1>Crediário</h1>
          <p>Parcelas, cobrança, PDF por parcela e redistribuição inteligente.</p>
        </div>
      </div>

      <section className="stats-grid classic-stats-grid classic-credit-summary-grid">
        <article className="stat-card">
          <div className="stat-copy"><small>Clientes em aberto</small><strong>{summary.customers}</strong></div>
        </article>
        <article className="stat-card">
          <div className="stat-copy"><small>Saldo total</small><strong>{money(summary.balance)}</strong></div>
        </article>
        <article className="stat-card">
          <div className="stat-copy"><small>Parcelas vencidas</small><strong>{summary.overdue}</strong></div>
        </article>
      </section>

      {error && <div className="error-box">{error}</div>}
      {message && <div className="notice">{message}</div>}

      <section className="panel classic-panel classic-legacy-table-panel">
        <div className="panel-head panel-head-tight">
          <div>
            <h2>Resumo do crediário</h2>
          </div>
        </div>
        <TableFilters
          query={query}
          onQueryChange={setQuery}
          queryPlaceholder="Buscar por cliente, venda, contato, saldo ou status"
          summary={`${visibleCredits.length} de ${filteredCredits.length} crediários visíveis`}
          selects={[
            {
              label: 'Status',
              value: statusFilter,
              onChange: setStatusFilter,
              options: [
                { value: 'todos', label: 'Todos' },
                { value: 'aberto', label: 'Abertos' },
                { value: 'quitado', label: 'Quitados' },
              ],
            },
          ]}
        />
        <DataTable<CreditSummary>
          rows={visibleCredits}
          empty="Nenhum crediário em aberto. Venda no crediário para gerar parcelas."
          columns={[
            { key: 'customer', label: 'Cliente', render: (row) => row.customer_name },
            { key: 'sale', label: 'Venda', render: (row) => row.sale_number ? `#${row.sale_number}` : '-' },
            { key: 'total', label: 'Total', align: 'right', render: (row) => money(row.total) },
            { key: 'balance', label: 'Saldo', align: 'right', render: (row) => money(row.balance) },
            { key: 'status', label: 'Status', render: (row) => <span className={creditStatusClass(row.status)}>{creditStatusLabel(row.status)}</span> },
          ]}
        />
        <div className="classic-table-footer">
          <span>{manyCreditResults ? FRIENDLY_LIST_MESSAGES.tooMany : FRIENDLY_LIST_MESSAGES.firstResults}</span>
          {canLoadMoreCredits ? <button type="button" className="secondary-btn small" onClick={() => setVisibleLimit((count) => count + LOAD_MORE_STEP)}>Carregar mais crediários</button> : null}
        </div>
      </section>

      {visibleCredits.map((credit) => {
        const expanded = Boolean(expandedCredits[credit.id]);
        const nextInstallment = nextImportantInstallment(credit);
        const visibleInstallments = expanded ? credit.installments : (nextInstallment ? [nextInstallment] : []);
        return (
        <section className="panel classic-panel classic-legacy-table-panel" key={credit.id}>
          <div className="panel-head">
            <h2>{credit.customer_name}</h2>
            <div className="table-actions">
              <span className={creditStatusClass(credit.status)}>Saldo {money(credit.balance)}</span>
              <span className="pill">{credit.customer_whatsapp || credit.customer_phone || 'Sem contato'}</span>
              <button type="button" className="ghost-btn small" onClick={() => setExpandedCredits((current) => ({ ...current, [credit.id]: !expanded }))}>
                {expanded ? 'Recolher parcelas' : 'Ver todas as parcelas'}
              </button>
            </div>
          </div>
          {nextInstallment ? (
            <div className="notice">
              Próxima parcela importante: #{nextInstallment.number} · {dateOnly(nextInstallment.due_date)} · {money(Math.max(0, nextInstallment.amount - nextInstallment.paid_amount))} · {installmentStatusLabel(nextInstallment)}
            </div>
          ) : null}
          <DataTable<CreditInstallment>
            rows={visibleInstallments}
            empty="Sem parcelas."
            columns={[
              { key: 'num', label: '#', render: (row) => row.number },
              { key: 'due', label: 'Vencimento', render: (row) => <span className={installmentDueClass(row)}>{dateOnly(row.due_date)}</span> },
              { key: 'amount', label: 'Valor', align: 'right', render: (row) => money(row.amount) },
              { key: 'paid', label: 'Pago', align: 'right', render: (row) => money(row.paid_amount) },
              { key: 'remaining', label: 'Restante', align: 'right', render: (row) => money(Math.max(0, row.amount - row.paid_amount)) },
              { key: 'status', label: 'Status', render: (row) => <span className={installmentStatusClass(row)}>{installmentStatusLabel(row)}</span> },
              {
                key: 'action',
                label: 'Ação',
                align: 'right',
                render: (row) => (
                  <div className="table-actions">
                    <button type="button" className="ghost-btn small" onClick={() => openPdfPreview(credit, row)}>PDF</button>
                    <button type="button" className="ghost-btn small" onClick={() => sendWhatsapp(credit, row)}>WhatsApp</button>
                    {row.status === 'pago'
                      ? <span className="muted">Recebida</span>
                      : <button type="button" className="secondary-btn small" onClick={() => openReceiveModal(credit, row)}>Receber</button>}
                  </div>
                ),
              },
            ]}
          />
        </section>
        );
      })}

      <Modal open={Boolean(receiving)} title="Receber parcela" onClose={() => !saving && setReceiving(null)}>
        {receiving && (
          <form className="form-grid compact" onSubmit={submitReceive}>
            <label>Cliente<input value={receiving.credit.customer_name} readOnly /></label>
            <label>Parcela<input value={`#${receiving.installment.number} · vence ${dateOnly(receiving.installment.due_date)}`} readOnly /></label>
            <label>Valor recebido<input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></label>
            <label>Forma<select value={method} onChange={(e) => setMethod(e.target.value as Exclude<PaymentMethod, 'crediario'>)}><option value="dinheiro">Dinheiro</option><option value="pix">Pix</option><option value="cartao">Cartão</option></select></label>
            <div className="notice span-2">
              O valor original continua preservado. Pagamento menor fica parcial e mostra o restante.
            </div>
            <div className="table-actions span-2">
              <button className="primary-btn" disabled={saving}>{saving ? 'Lançando...' : 'Confirmar recebimento'}</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={Boolean(preview)} title="Comprovante da parcela" onClose={() => setPreview(null)}>
        {preview && (
          <>
            <div className="receipt-preview" dangerouslySetInnerHTML={{ __html: buildInstallmentHtml(settings, preview.credit, preview.installment) }} />
            {pdfFolder && <div className="notice">Salvando PDFs em: {pdfFolder}</div>}
            <div className="table-actions">
              <button type="button" className="primary-btn" onClick={downloadPdf}>Gerar / Abrir PDF</button>
              <button type="button" className="secondary-btn" onClick={choosePdfFolder}>Escolher pasta do PDF</button>
              <button type="button" className="ghost-btn" onClick={() => sendWhatsapp(preview.credit, preview.installment)}>WhatsApp com PDF</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
