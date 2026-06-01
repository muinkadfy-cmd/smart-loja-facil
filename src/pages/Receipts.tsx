import React, { useEffect, useMemo, useState } from 'react';
import { AppIcon } from '../components/AppIcon';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { TableFilters } from '../components/TableFilters';
import { api } from '../lib/api';
import { matchesFilterQuery } from '../lib/filter';
import { dateTime, money } from '../lib/format';
import { whatsappChatUrl } from '../lib/links';
import { getPreferredPdfFolder, setPreferredPdfFolder } from '../lib/preferences';
import type { ReceiptSummary } from '../types';

interface PageProps { refreshToken: number; onChanged: () => void; }

type ReceiptPrintFormat = '58mm' | '80mm' | 'a4';

const printFormatOptions: Array<{ value: ReceiptPrintFormat; label: string; detail: string }> = [
  { value: '58mm', label: '58mm', detail: 'bobina compacta' },
  { value: '80mm', label: '80mm', detail: 'bobina padrão' },
  { value: 'a4', label: 'A4', detail: 'folha / PDF' },
];

function normalizeWhatsapp(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55')) return digits;
  return `55${digits}`;
}

function receiptStatusLabel(status: string): string {
  if (status === 'quitado') return 'Quitada';
  if (status === 'aberto') return 'Em aberto';
  if (status === 'cancelada') return 'Cancelada';
  if (status === 'finalizada') return 'Finalizada';
  return status;
}

function receiptStatusClass(status: string): string {
  if (status === 'quitado') return 'pill pill-success';
  if (status === 'aberto') return 'pill pill-warning';
  if (status === 'cancelada') return 'pill pill-danger';
  return 'pill';
}

function buildWhatsappText(receipt: ReceiptSummary): string {
  return [
    `Comprovante da venda #${receipt.sale_number || receipt.sale_id.slice(0, 8)}`,
    `Cliente: ${receipt.customer_name || 'Balcão'}`,
    `Total: ${money(receipt.total)}`,
    `Status: ${receiptStatusLabel(receipt.status)}`,
    `Data: ${dateTime(receipt.created_at)}`,
    '',
    'Obrigado pela compra.',
  ].join('\n');
}

export function ReceiptsPage({ refreshToken }: PageProps): JSX.Element {
  const [rows, setRows] = useState<ReceiptSummary[]>([]);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('todos');
  const [selected, setSelected] = useState<ReceiptSummary | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pdfFolder, setPdfFolder] = useState<string | null>(getPreferredPdfFolder());
  const [printFormat, setPrintFormat] = useState<ReceiptPrintFormat>('80mm');

  useEffect(() => {
    api.receipts().then(setRows).catch(() => undefined);
  }, [refreshToken]);

  const receiptTypes = useMemo(() => (
    ['todos', ...Array.from(new Set(rows.map((row) => row.receipt_type).filter(Boolean))).sort((a, b) => a.localeCompare(b))]
  ), [rows]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    const matchesType = typeFilter === 'todos' || row.receipt_type === typeFilter;
    const matchesQuery = matchesFilterQuery(query, [
      row.receipt_type,
      row.sale_number,
      row.sale_id,
      row.customer_name,
      row.customer_whatsapp,
      row.total,
      row.status,
      row.created_at,
    ]);
    return matchesType && matchesQuery;
  }), [query, rows, typeFilter]);

  async function printSelected() {
    if (!selected) return;
    try {
      const path = await api.exportHtmlPdf(selected.content, `comprovante-venda-${selected.sale_number || selected.sale_id}`, true, pdfFolder, printFormat);
      setError('');
      setMessage(path.includes('Prévia') || path.includes('baixei') ? path : `PDF gerado em ${path}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function choosePdfFolder() {
    try {
      const folder = await api.pickExportFolder();
      if (!folder) return;
      setPreferredPdfFolder(folder);
      setPdfFolder(folder);
      setError('');
      setMessage(`Pasta de PDFs atualizada para ${folder}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function sendWhatsapp(receipt: ReceiptSummary) {
    const whatsapp = normalizeWhatsapp(receipt.customer_whatsapp);
    if (!whatsapp) {
      setMessage('');
      setError('Esse cliente não tem WhatsApp cadastrado.');
      return;
    }
    try {
      await api.openExternalUrl(whatsappChatUrl(whatsapp, buildWhatsappText(receipt)));
      setError('');
      setMessage('WhatsApp aberto com os dados do comprovante.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="stack receipts-light-v65">
      <div className="page-title"><h1>Comprovantes</h1><p>Abra, imprima e reenvie comprovantes salvos com visual limpo e seguro.</p></div>
      {error && <div className="error-box">{error}</div>}
      {message && <div className="notice">{message}</div>}
      <section className="panel">
        <TableFilters
          query={query}
          onQueryChange={setQuery}
          queryPlaceholder="Buscar por cliente, venda, tipo ou data"
          summary={`${filteredRows.length} de ${rows.length} comprovantes visíveis`}
          selects={[
            {
              label: 'Tipo',
              value: typeFilter,
              onChange: setTypeFilter,
              options: receiptTypes.map((option) => ({ value: option, label: option === 'todos' ? 'Todos' : option })),
            },
          ]}
        />
        <DataTable<ReceiptSummary>
          rows={filteredRows}
          empty="Nenhum comprovante gerado."
          columns={[
            { key: 'type', label: 'Tipo', render: (row) => row.receipt_type },
            { key: 'sale', label: 'Venda', render: (row) => row.sale_number ? `#${row.sale_number}` : row.sale_id.slice(0, 8) },
            { key: 'customer', label: 'Cliente', render: (row) => row.customer_name || 'Balcão' },
            { key: 'total', label: 'Total', align: 'right', render: (row) => money(row.total) },
            { key: 'status', label: 'Status', render: (row) => <span className={receiptStatusClass(row.status)}>{receiptStatusLabel(row.status)}</span> },
            { key: 'date', label: 'Data', render: (row) => dateTime(row.created_at) },
            {
              key: 'action',
              label: 'Ação',
              align: 'right',
              render: (row) => (
                <div className="table-actions">
                  <button type="button" className="secondary-btn small" onClick={() => setSelected(row)}><AppIcon name="comprovantes" size={16} className="app-icon-button-inline" />Abrir</button>
                  <button type="button" className="ghost-btn small" onClick={() => sendWhatsapp(row)}><AppIcon name="whatsapp" size={16} className="app-icon-button-inline" />WhatsApp</button>
                </div>
              ),
            },
          ]}
        />
      </section>
      <Modal open={Boolean(selected)} title="Comprovante" onClose={() => setSelected(null)}>
        <div className="receipt-modal-toolbar">
          <div>
            <strong>Prévia premium</strong>
            <span>Escolha o formato antes de imprimir ou salvar em PDF.</span>
          </div>
          <div className="receipt-format-pills" role="radiogroup" aria-label="Formato de impressão">
            {printFormatOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={printFormat === option.value ? 'receipt-format-pill active' : 'receipt-format-pill'}
                onClick={() => setPrintFormat(option.value)}
                aria-pressed={printFormat === option.value}
              >
                <strong>{option.label}</strong>
                <span>{option.detail}</span>
              </button>
            ))}
          </div>
        </div>
        <div className={`receipt-preview receipt-preview-${printFormat}`} dangerouslySetInnerHTML={{ __html: selected?.content ?? '' }} />
        {pdfFolder && <div className="notice">Salvando PDFs em: {pdfFolder}</div>}
        <div className="table-actions">
          <button type="button" className="primary-btn" onClick={printSelected}><AppIcon name="exportar_pdf" size={16} className="app-icon-button-inline" />Imprimir / Salvar PDF</button>
          <button type="button" className="secondary-btn" onClick={choosePdfFolder}><AppIcon name="backup" size={16} className="app-icon-button-inline" />Escolher pasta do PDF</button>
          {selected && <button type="button" className="ghost-btn" onClick={() => sendWhatsapp(selected)}><AppIcon name="whatsapp" size={16} className="app-icon-button-inline" />Enviar por WhatsApp</button>}
        </div>
      </Modal>
    </div>
  );
}
