import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import type { AppStatus, DashboardData, PageKey, ProductInsight, ReceiptSummary, SaleSummary } from '../../types';
import { ActionTile } from '../components/ActionTile';
import { InlineIcon } from '../components/InlineIcon';
import { RecentSaleCard } from '../components/RecentSaleCard';
import { StatCard } from '../components/StatCard';
import { formatCurrency, formatNumber } from '../components/format';
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
    credit_overdue_installments: 0,
    low_stock_count: 0,
    zero_stock_count: 0,
    payment_today: [],
    recent_sales: [],
    product_insights: [],
  };
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
  const [shareError, setShareError] = useState(false);
  const [sharingSaleId, setSharingSaleId] = useState<string | null>(null);
  const sharingRef = useRef(false);
  const [activityLimit, setActivityLimit] = useState(4);
  const dashboard = status?.dashboard ?? emptyDashboard();
  const lowStock = dashboard.low_stock_count ?? 0;
  const activities = dashboard.recent_sales.slice(0, activityLimit);
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
  }, [status?.dashboard]);

  async function shareActivityReceipt(sale: SaleSummary, format: ReceiptShareFormat = 'pdf'): Promise<void> {
    if (sharingRef.current) return;
    sharingRef.current = true;
    setSharingSaleId(sale.id);
    setShareError(false);
    setShareFeedback('Preparando comprovante…');
    try {
      const receipt = findReceiptForSale(receipts, sale);
      setShareFeedback(await shareSaleReceipt(sale, receipt, format));
    } catch (error) {
      setShareError(true);
      setShareFeedback(error instanceof Error ? error.message : 'Não foi possível preparar o comprovante. Tente novamente.');
    } finally {
      sharingRef.current = false;
      setSharingSaleId(null);
    }
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

      <section className="mapp-section-block mapp-dashboard-activities-block mapp-recent-list" aria-labelledby="recent-activities-title" aria-busy={!status}>
        <div className="mapp-recent-list-heading">
          <div>
            <h2 id="recent-activities-title">Atividades recentes</h2>
            <p>Últimas vendas com acesso rápido aos detalhes e comprovantes.</p>
          </div>
          <button type="button" aria-label="Abrir todas as vendas" onClick={() => onNavigate('sales')}>Ver vendas</button>
        </div>
        {shareFeedback ? <p className={`mapp-recent-list-message ${shareError ? 'is-error' : ''}`} role={shareError ? 'alert' : 'status'}>{shareFeedback}</p> : null}
        {!status ? <p className="mapp-recent-list-message" role="status">Carregando atividades…</p> : activities.length ? (
          <ul className="mapp-recent-list-items">
            {activities.map((sale) => (
              <li key={sale.id}><RecentSaleCard
                sale={sale}
                expanded={expandedSaleId === sale.id}
                onToggle={() => setExpandedSaleId((current) => current === sale.id ? null : sale.id)}
              >
                  <button type="button" disabled={sharingSaleId !== null} onClick={() => void shareActivityReceipt(sale, 'pdf')}>{sharingSaleId === sale.id ? 'Preparando…' : 'Comprovante PDF'}</button>
                  <button type="button" disabled={sharingSaleId !== null} onClick={() => void shareActivityReceipt(sale, 'png')}>Extrato PNG</button>
                  <button type="button" disabled={sharingSaleId !== null} onClick={() => void shareActivityReceipt(sale, 'share')}>Compartilhar</button>
                  <button type="button" onClick={() => onNavigate('sales')}>Abrir vendas</button>
              </RecentSaleCard></li>
            ))}
          </ul>
        ) : (
          <button type="button" className="mapp-dashboard-empty-activity" onClick={() => onNavigate('sales')}>
            <span><InlineIcon name="vendas_pdv" size={24} /></span>
            <div>
              <strong>Nenhuma atividade recente</strong>
              <small>Abra o PDV para registrar a primeira venda.</small>
            </div>
            <b aria-hidden="true">›</b>
          </button>
        )}
        {activities.length < dashboard.recent_sales.length ? (
          <button type="button" className="mapp-recent-list-more" onClick={() => setActivityLimit((limit) => limit + 4)}>Mostrar mais atividades ({dashboard.recent_sales.length - activities.length})</button>
        ) : null}
      </section>
    </div>
  );
}
