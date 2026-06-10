import type { PageKey } from '../types';
import type { DelphiIconName } from '../lib/icons';

export type MobileRouteTone = 'blue' | 'purple' | 'green' | 'orange' | 'mint' | 'sky' | 'slate';

export interface MobileRoute {
  key: PageKey;
  label: string;
  shortLabel: string;
  subtitle: string;
  icon: DelphiIconName;
  tone: MobileRouteTone;
  primaryAction: string;
}

export interface MobileRouteGroup {
  id: 'home' | 'operation' | 'management' | 'control';
  label: string;
  helper: string;
  routes: PageKey[];
}

export const MOBILE_ROUTES: MobileRoute[] = [
  { key: 'dashboard', label: 'Painel', shortLabel: 'Início', subtitle: 'Visão geral da sua loja.', icon: 'painel_da_loja', tone: 'blue', primaryAction: 'Ver resumo' },
  { key: 'sales', label: 'Vendas / PDV', shortLabel: 'Vendas', subtitle: 'Venda rápida e atendimento no balcão.', icon: 'vendas_pdv', tone: 'blue', primaryAction: 'Nova venda' },
  { key: 'products', label: 'Produtos', shortLabel: 'Produtos', subtitle: 'Cadastre produtos e acompanhe estoque.', icon: 'produtos', tone: 'sky', primaryAction: 'Novo produto' },
  { key: 'customers', label: 'Clientes', shortLabel: 'Clientes', subtitle: 'Clientes, contatos e histórico.', icon: 'clientes', tone: 'purple', primaryAction: 'Novo cliente' },
  { key: 'orders', label: 'Pedidos', shortLabel: 'Pedidos', subtitle: 'Pedidos abertos e entregas.', icon: 'pedidos', tone: 'orange', primaryAction: 'Novo pedido' },
  { key: 'cash', label: 'Caixa', shortLabel: 'Caixa', subtitle: 'Abertura, entradas, saídas e fechamento.', icon: 'caixa', tone: 'green', primaryAction: 'Abrir caixa' },
  { key: 'credits', label: 'Crediário', shortLabel: 'Crediário', subtitle: 'Contas a receber e parcelas.', icon: 'crediario', tone: 'purple', primaryAction: 'Ver parcelas' },
  { key: 'reports', label: 'Relatórios', shortLabel: 'Relatórios', subtitle: 'Indicadores simples para decisão.', icon: 'relatorios', tone: 'blue', primaryAction: 'Ver relatório' },
  { key: 'receipts', label: 'Comprovantes', shortLabel: 'Comprovantes', subtitle: 'Comprovantes gerados e reimpressão.', icon: 'comprovantes', tone: 'sky', primaryAction: 'Ver comprovantes' },
  { key: 'backup', label: 'Backup', shortLabel: 'Backup', subtitle: 'Cópias de segurança e restauração.', icon: 'backup', tone: 'mint', primaryAction: 'Criar backup' },
  { key: 'settings', label: 'Configurações', shortLabel: 'Config.', subtitle: 'Dados da loja e preferências.', icon: 'configuracoes', tone: 'slate', primaryAction: 'Editar loja' },
  { key: 'audit', label: 'Logs / Diagnóstico', shortLabel: 'Logs', subtitle: 'Acompanhe ações e segurança.', icon: 'auditoria_logs', tone: 'slate', primaryAction: 'Copiar logs' },
  { key: 'diagnostics', label: 'Diagnóstico Web', shortLabel: 'Diagnóstico', subtitle: 'Conexão, cache e sincronização.', icon: 'bloqueio_seguro', tone: 'green', primaryAction: 'Testar conexão' },
  { key: 'coupons', label: 'Cupom', shortLabel: 'Cupom', subtitle: 'Cupom PNG fiel para promoção e compartilhamento.', icon: 'etiquetas', tone: 'purple', primaryAction: 'Gerar cupom' },
];


export const MOBILE_ROUTE_GROUPS: MobileRouteGroup[] = [
  {
    id: 'home',
    label: 'Início',
    helper: 'Resumo rápido e caminho principal.',
    routes: ['dashboard'],
  },
  {
    id: 'operation',
    label: 'Operação',
    helper: 'Venda, caixa, pedidos e recebimentos do dia.',
    routes: ['sales', 'cash', 'orders', 'credits', 'receipts', 'coupons'],
  },
  {
    id: 'management',
    label: 'Gestão',
    helper: 'Cadastro, estoque, clientes e resultados.',
    routes: ['products', 'customers', 'reports', 'backup'],
  },
  {
    id: 'control',
    label: 'Controle',
    helper: 'Configuração, logs, diagnóstico e liberação comercial.',
    routes: ['settings', 'audit', 'diagnostics'],
  },
];

export function getMobileRouteGroup(key: PageKey): MobileRouteGroup {
  return MOBILE_ROUTE_GROUPS.find((group) => group.routes.includes(key)) ?? MOBILE_ROUTE_GROUPS[0];
}

export function getMobileRoutesByGroup(group: MobileRouteGroup): MobileRoute[] {
  return group.routes.map(getMobileRoute).filter(Boolean);
}

export const BOTTOM_ROUTES: PageKey[] = ['dashboard', 'sales', 'products', 'customers'];

export function getMobileRoute(key: PageKey): MobileRoute {
  return MOBILE_ROUTES.find((route) => route.key === key) ?? MOBILE_ROUTES[0];
}
