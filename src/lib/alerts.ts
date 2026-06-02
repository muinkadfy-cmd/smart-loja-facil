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

function pushUnique(alerts: AppAlert[], alert: AppAlert): void {
  if (alerts.some((item) => item.id === alert.id)) return;
  alerts.push(alert);
}

export function buildAppAlerts(status: AppStatus | null, products: Product[], credits: CreditSummary[]): AppAlert[] {
  const limit = status?.settings.low_stock_limit ?? 3;
  const today = todayOnly(new Date());
  const soonLimit = new Date(today);
  soonLimit.setDate(soonLimit.getDate() + 3);

  const lowStock = products.filter((product) => product.status === 'ativo' && product.stock <= limit);
  const inactiveProducts = products.filter((product) => product.status === 'inativo');
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

  if (!status) {
    pushUnique(alerts, {
      id: 'status-loading',
      level: 'info',
      title: 'Carregando loja',
      detail: 'Aguarde a leitura inicial dos dados.',
      page: 'dashboard',
    });
  } else {
    if (!status.sqlite_ok) {
      pushUnique(alerts, {
        id: 'cloud-not-ready',
        level: 'warning',
        title: 'Conexão pendente',
        detail: 'Verifique login e internet para sincronizar.',
        page: 'diagnostics',
      });
    }

    if (!status.offline_ready) {
      pushUnique(alerts, {
        id: 'pwa-cache-check',
        level: 'info',
        title: 'Preparando PWA',
        detail: 'Abra novamente se o celular ainda mostrar cache antigo.',
        page: 'diagnostics',
      });
    }

    if ((status.dashboard.today_sales_count ?? 0) === 0) {
      pushUnique(alerts, {
        id: 'sales-empty-today',
        level: 'info',
        title: 'Nenhuma venda hoje',
        detail: 'Abra o PDV para registrar a primeira venda.',
        page: 'sales',
      });
    }

    if ((status.dashboard.credits_open_total ?? 0) > 0) {
      pushUnique(alerts, {
        id: 'credits-open-total',
        level: 'info',
        title: 'Crediário ativo',
        detail: `Há parcelas em aberto para acompanhar.`,
        page: 'credits',
      });
    }
  }

  if (overdue.length > 0) {
    const first = overdue[0];
    pushUnique(alerts, {
      id: 'credit-overdue',
      level: 'danger',
      title: `${overdue.length} vencida(s)`,
      detail: `${first.credit.customer_name} · ${dateLabel(first.item.due_date)}`,
      page: 'credits',
    });
  }

  if (dueSoon.length > 0) {
    const first = dueSoon[0];
    pushUnique(alerts, {
      id: 'credit-due-soon',
      level: 'warning',
      title: `${dueSoon.length} próxima(s)`,
      detail: `${first.credit.customer_name} · até 3 dias`,
      page: 'credits',
    });
  }

  if (lowStock.length > 0) {
    const first = lowStock[0];
    pushUnique(alerts, {
      id: 'low-stock',
      level: 'warning',
      title: `${lowStock.length} estoque baixo`,
      detail: `${first.name} · saldo ${first.stock}`,
      page: 'products',
    });
  }

  if (inactiveProducts.length > 0 && products.length <= 10) {
    pushUnique(alerts, {
      id: 'inactive-products-small-base',
      level: 'info',
      title: 'Produtos inativos',
      detail: 'Revise o catálogo para manter a loja limpa.',
      page: 'products',
    });
  }

  if ((status?.dashboard.orders_open ?? 0) > 0) {
    pushUnique(alerts, {
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
      detail: 'Loja pronta para operar.',
      page: 'dashboard',
    });
  }

  return alerts;
}
