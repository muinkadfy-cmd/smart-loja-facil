import type { AppStatus, CreditSummary, PageKey, Product } from '../types';

export type AlertLevel = 'danger' | 'warning' | 'info' | 'ok';

export interface AppAlert {
  id: string;
  level: AlertLevel;
  title: string;
  detail: string;
  page: PageKey;
}

function todayOnly(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function dateLabel(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('pt-BR');
}

export function buildAppAlerts(status: AppStatus | null, products: Product[], credits: CreditSummary[]): AppAlert[] {
  const limit = status?.settings.low_stock_limit ?? 3;
  const today = todayOnly(new Date());
  const soonLimit = new Date(today);
  soonLimit.setDate(soonLimit.getDate() + 3);

  const lowStock = products.filter((product) => product.status === 'ativo' && product.stock <= limit);
  const overdue = credits.flatMap((credit) =>
    credit.installments
      .filter((item) => item.status !== 'pago' && todayOnly(new Date(`${item.due_date}T00:00:00`)) < today)
      .map((item) => ({ credit, item })),
  );
  const dueSoon = credits.flatMap((credit) =>
    credit.installments
      .filter((item) => {
        if (item.status === 'pago') return false;
        const due = todayOnly(new Date(`${item.due_date}T00:00:00`));
        return due >= today && due <= soonLimit;
      })
      .map((item) => ({ credit, item })),
  );

  const alerts: AppAlert[] = [];

  if (overdue.length > 0) {
    const first = overdue[0];
    alerts.push({
      id: 'credit-overdue',
      level: 'danger',
      title: `${overdue.length} vencida(s)`,
      detail: `${first.credit.customer_name} · ${dateLabel(first.item.due_date)}`,
      page: 'credits',
    });
  }

  if (dueSoon.length > 0) {
    const first = dueSoon[0];
    alerts.push({
      id: 'credit-due-soon',
      level: 'warning',
      title: `${dueSoon.length} próxima(s)`,
      detail: `${first.credit.customer_name} · até 3 dias`,
      page: 'credits',
    });
  }

  if (lowStock.length > 0) {
    const first = lowStock[0];
    alerts.push({
      id: 'low-stock',
      level: 'warning',
      title: `${lowStock.length} estoque baixo`,
      detail: `${first.name} · saldo ${first.stock}`,
      page: 'products',
    });
  }

  if ((status?.dashboard.orders_open ?? 0) > 0) {
    alerts.push({
      id: 'open-orders',
      level: 'info',
      title: `${status?.dashboard.orders_open ?? 0} pedido(s)`,
      detail: 'em aberto',
      page: 'orders',
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: 'all-ok',
      level: 'ok',
      title: 'Tudo certo',
      detail: 'Sem pendências',
      page: 'dashboard',
    });
  }

  return alerts;
}
