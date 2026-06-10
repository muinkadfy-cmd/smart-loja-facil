import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { AppStatus, DashboardData, PageKey, PaymentMethod, ProductInsight, ReceiptSummary, SaleSummary } from '../../types';
import { ActionTile } from '../components/ActionTile';
import { InlineIcon } from '../components/InlineIcon';
import { ListCard } from '../components/ListCard';
import { StatCard } from '../components/StatCard';
import { formatCurrency, formatDateTime, formatNumber } from '../components/format';
import { findReceiptForSale, shareSaleReceipt, type ReceiptShareFormat } from '../components/receiptShare';

interface DashboardScreenProps {
  status: AppStatus | null;
  onNavigate: (page: PageKey) => void;
}

function emptyDashboard(): DashboardData {
  return {
    today_sales_total: 0,
    today_sales_count: 0,
    customers_total: 0,
    products_total: 0,
    orders_open: 0,
    credits_open_total: 0,
    credits_active_customers: 0,
    low_stock_count: 0,
    payment_today: [],
    recent_sales: [],
    product_insights: [],
  };
}

function paymentLabel(method: PaymentMethod): string {
  if (method === 'dinheiro') return 'Dinheiro';
  if (method === 'pix') return 'Pix';
  if (method === 'cartao') return 'Cartão';
  return 'Crediário';
}

function productInsightToneClass(tone: ProductInsight['tone']): string {
  if (tone === 'danger') return 'danger';
  if (tone === 'warning') return 'warning';
  if (tone === 'profit') return 'profit';
  if (tone === 'success') return 'success';
  return 'info';
}

function productInsightMetric(insight: ProductInsight): string {
  if (insight.kind === 'dormant') return `${formatNumber(insight.stock)} em estoque`;
  if (insight.kind === 'high_margin') return `Lucro ${formatCurrency(insight.profit_30d)}`;
  return `${formatNumber(insight.sold_7d)} un. em 7 dias`;
}

export function DashboardScreen({ status, onNavigate }: DashboardScreenProps): JSX.Element {
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<ReceiptSummary[]>([]);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const dashboard = status?.dashboard ?? emptyDashboard();
  const lowStock = dashboard.low_stock_count ?? 0;
  const activities = dashboard.recent_sales.slice(0, 4);
  const averageTicket = dashboard.today_sales_count > 0 ? dashboard.today_sales_total / dashboard.today_sales_count : 0;

  function navigateToLowStock() {
    window.location.hash = 'baixo-estoque';
    onNavigate('products');
  }

  useEffect(() => {
    let active = true;
    api.receipts()
      .then((rows) => { if (active) setReceipts(rows); })
      .catch(() => { if (active) setReceipts([]); });
    return () => { active = false; };
  }, []);

  async function shareActivityReceipt(sale: SaleSummary, format: ReceiptShareFormat = 'pdf'): Promise<void> {
    const receipt = findReceiptForSale(receipts, sale);
    const message = await shareSaleReceipt(sale, receipt, format);
    setShareFeedback(message);
  }

  return (
    <div className="mapp-screen mapp-dashboard-screen">
      <section className="mapp-stat-grid mapp-dashboard-stats">
        <StatCard label="Vendas hoje" value={formatCurrency(dashboard.today_sales_total)} detail={`${formatNumber(dashboard.today_sales_count)} venda(s)`} icon="vendas_pdv" tone="blue" />
        <StatCard label="Ticket médio" value={formatCurrency(averageTicket)} detail="por venda" icon="caixa" tone="green" />
        <StatCard label="Pedidos" value={formatNumber(dashboard.orders_open)} detail="em aberto" icon="pedidos" tone="orange" />
        <StatCard label="Clientes" value={formatNumber(dashboard.customers_total)} detail="base ativa" icon="clientes" tone="purple" />
      </section>

      {lowStock > 0 ? (
        <section className="mapp-warning-card mapp-dashboard-stock-alert">
          <span className="mapp-dashboard-alert-icon" aria-hidden="true">⚠️</span>
          <div>
            <strong>Atenção: estoque baixo</strong>
            <p>{lowStock} produtos precisam de reposição.</p>
          </div>
          <button type="button" onClick={navigateToLowStock}>Ver produtos</button>
        </section>
      ) : (
        <section className="mapp-success-card mapp-dashboard-stock-alert">
          <span className="mapp-dashboard-alert-icon ok" aria-hidden="true">✓</span>
          <div>
            <strong>Tudo certo: estoque sem alertas críticos</strong>
            <p>Continue acompanhando produtos e vendas.</p>
          </div>
          <button type="button" onClick={() => onNavigate('products')}>Ver produtos</button>
        </section>
      )}

      <section className="mapp-section-block mapp-dashboard-actions-block">
        <div className="mapp-section-title">
          <h2>O que fazer agora?</h2>
          <button type="button" onClick={() => onNavigate('diagnostics')}>Ajuda rápida</button>
        </div>
        <div className="mapp-actions-grid mapp-dashboard-actions-grid">
          <ActionTile label="Abrir PDV" icon="vendas_pdv" page="sales" tone="blue" onNavigate={onNavigate} />
          <ActionTile label="Nova venda" icon="vendas_pdv" page="sales" tone="blue" onNavigate={onNavigate} />
          <ActionTile label="Novo pedido" icon="pedidos" page="orders" tone="orange" intent="novo-pedido" onNavigate={onNavigate} />
          <ActionTile label="Novo cliente" icon="clientes" page="customers" tone="purple" intent="novo-cliente" onNavigate={onNavigate} />
        </div>
      </section>

      {(dashboard.product_insights ?? []).length ? (
        <section className="mapp-section-block mapp-product-intel-block mapp-dashboard-product-intel">
          <div className="mapp-section-title">
            <h2>Produtos em destaque</h2>
            <button type="button" onClick={() => onNavigate('products')}>Ver produtos</button>
          </div>
          <div className="mapp-product-intel-list">
            {(dashboard.product_insights ?? []).slice(0, 1).map((insight) => (
              <button
                type="button"
                key={insight.id}
                className={`mapp-product-intel-card ${productInsightToneClass(insight.tone)}`}
                onClick={() => { window.location.hash = `produto-${insight.product_id}`; onNavigate('products'); }}
              >
                <span className="mapp-product-intel-icon">
                  <span aria-hidden="true">{insight.kind === 'low_stock_hot' ? '⚠️' : insight.kind === 'dormant' ? '💡' : '🔥'}</span>
                </span>
                <span className="mapp-product-intel-copy">
                  <strong>{insight.title}</strong>
                  <em>{insight.product_name}</em>
                  <small>{insight.detail}</small>
                </span>
                <b>{productInsightMetric(insight)}</b>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mapp-section-block mapp-dashboard-activities-block">
        <div className="mapp-section-title">
          <h2>Atividades recentes</h2>
          <button type="button" onClick={() => onNavigate('sales')}>Ver todas</button>
        </div>
        {activities.length ? (
          <div className="mapp-list-stack">
            {shareFeedback ? <div className="mapp-form-feedback mapp-form-feedback-info">{shareFeedback}</div> : null}
            {activities.map((sale) => (
              <ListCard
                key={sale.id}
                icon="vendas_pdv"
                title={`Venda #${String(sale.number).padStart(4, '0')}`}
                subtitle={`${sale.first_product_name || sale.customer_name || 'Consumidor'} · ${formatDateTime(sale.created_at)}`}
                value={formatCurrency(sale.total)}
                tone="blue"
                thumbnailSrc={sale.thumbnail_url}
                thumbnailAlt={sale.first_product_name || `Venda #${sale.number}`}
                expanded={expandedSaleId === sale.id}
                onClick={() => setExpandedSaleId((current) => current === sale.id ? null : sale.id)}
              >
                <div className="mapp-sale-detail-grid">
                  <span>Cliente <b>{sale.customer_name || 'Consumidor'}</b></span>
                  <span>Forma <b>{paymentLabel(sale.payment_method)}</b></span>
                  <span>Itens <b>{formatNumber(sale.item_count || 1)}</b></span>
                  <span>Data <b>{formatDateTime(sale.created_at)}</b></span>
                </div>
                <div className="mapp-sale-detail-actions">
                  <button type="button" onClick={() => void shareActivityReceipt(sale, 'pdf')}>PDF</button>
                  <button type="button" onClick={() => void shareActivityReceipt(sale, 'png')}>Extrato PNG</button>
                  <button type="button" onClick={() => void shareActivityReceipt(sale, 'share')}>Compartilhar</button>
                  <button type="button" onClick={() => onNavigate('sales')}>Abrir vendas</button>
                </div>
              </ListCard>
            ))}
          </div>
        ) : (
          <button type="button" className="mapp-dashboard-empty-activity" onClick={() => onNavigate('sales')}>
            <span><InlineIcon name="vendas_pdv" size={24} /></span>
            <div>
              <strong>Nenhuma venda hoje</strong>
              <small>Abra o PDV para registrar a primeira venda.</small>
            </div>
            <b aria-hidden="true">›</b>
          </button>
        )}
      </section>
    </div>
  );
}
