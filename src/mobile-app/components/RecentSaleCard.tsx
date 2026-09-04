import { useId, type ReactNode } from 'react';
import type { SaleSummary } from '../../types';
import { InlineIcon } from './InlineIcon';
import { formatCurrency, formatNumber } from './format';
import '../styles/recent-sales.css';

interface RecentSaleCardProps {
  sale: SaleSummary;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}

function paymentLabel(method: SaleSummary['payment_method']): string {
  return { dinheiro: 'Dinheiro', pix: 'Pix', cartao: 'Cartão', crediario: 'Crediário' }[method] || 'Não informada';
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    finalizada: 'Finalizada', cancelada: 'Cancelada', quitada: 'Quitada', aberto: 'Em aberto',
  };
  return labels[status] || status || 'Status não informado';
}

function statusToneClass(status: string): string {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('cancel')) return 'is-cancelled';
  if (normalized === 'aberto' || normalized.includes('pend')) return 'is-open';
  if (normalized === 'finalizada' || normalized === 'quitada' || normalized.includes('pago')) return 'is-complete';
  return 'is-neutral';
}

function saleDate(value: string): { label: string; iso?: string } {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { label: 'Data não informada' };
  return {
    label: date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    iso: date.toISOString(),
  };
}

/** Sale presentation only: status, payment method and total remain the API values. */
export function RecentSaleCard({ sale, expanded, onToggle, children }: RecentSaleCardProps): JSX.Element {
  const detailId = useId();
  const titleId = useId();
  const date = saleDate(sale.created_at);
  const title = `Venda #${String(sale.number).padStart(4, '0')}`;

  return (
    <article className={`mapp-recent-sale ${expanded ? 'is-expanded' : ''}`}>
      <button
        type="button"
        className="mapp-recent-sale-trigger"
        aria-expanded={expanded}
        aria-controls={detailId}
        aria-label={`${title}, ${sale.customer_name || 'Consumidor'}, ${formatCurrency(sale.total)}, ${date.label}. ${expanded ? 'Recolher' : 'Abrir'} detalhes da venda.`}
        onClick={onToggle}
      >
        <span className="mapp-recent-sale-image" aria-hidden="true">
          {sale.thumbnail_url ? <img src={sale.thumbnail_url} alt="" loading="lazy" /> : <InlineIcon name="vendas_pdv" size={24} />}
        </span>
        <span className="mapp-recent-sale-identity">
          <strong id={titleId}>{title}</strong>
          <span className="mapp-recent-sale-customer">{sale.customer_name || 'Consumidor'}</span>
        </span>
        <span className="mapp-recent-sale-chevron" aria-hidden="true">{expanded ? '−' : '+'}</span>
        <span className="mapp-recent-sale-amount-row">
          <strong className="mapp-recent-sale-amount">{formatCurrency(sale.total)}</strong>
          <span className={`mapp-recent-sale-status ${statusToneClass(sale.status)}`}>{statusLabel(sale.status)}</span>
        </span>
        <span className="mapp-recent-sale-meta">
          <time dateTime={date.iso}>{date.label}</time>
          <span>{paymentLabel(sale.payment_method)}</span>
        </span>
      </button>
      <div id={detailId} className="mapp-recent-sale-details" aria-labelledby={titleId} hidden={!expanded}>
        {expanded ? (
          <>
            <dl className="mapp-recent-sale-facts">
              <div><dt>Cliente</dt><dd>{sale.customer_name || 'Consumidor'}</dd></div>
              <div><dt>Itens</dt><dd>{typeof sale.item_count === 'number' ? formatNumber(sale.item_count) : 'Não informado'}</dd></div>
              {sale.first_product_name ? <div className="mapp-recent-sale-product"><dt>Primeiro produto</dt><dd>{sale.first_product_name}</dd></div> : null}
            </dl>
            <div className="mapp-recent-sale-actions">{children}</div>
          </>
        ) : null}
      </div>
    </article>
  );
}
