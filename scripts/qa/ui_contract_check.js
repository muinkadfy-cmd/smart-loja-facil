import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));
let failed = false;
const fail = (message) => { failed = true; process.stderr.write(`ERRO: ${message}\n`); };

const packageJson = JSON.parse(read('package.json'));
const release = String(packageJson.version || '').split('.').at(-1);
const routes = read('src/mobile-app/mobileAppRoutes.ts');
const icons = read('src/lib/icons.ts');
const app = read('src/mobile-app/MobileApp.tsx');
const shell = read('src/mobile-app/layout/MobileShell.tsx');
const header = read('src/mobile-app/layout/MobileHeader.tsx');
const generic = read('src/mobile-app/screens/GenericDataScreen.tsx');
const dashboard = read('src/mobile-app/screens/DashboardScreen.tsx');
const dialogs = read('src/mobile-app/styles/dialog-hotfix.css');
const polish = read('src/mobile-app/styles/ui-premium-polish.css');

if (!read('src/main.tsx').includes('ui-premium-polish.css')) fail('main.tsx precisa carregar ui-premium-polish.css por último.');
if (!read('src/main.tsx').includes(`smart-mobile-rebuild-v${release}`)) fail(`Classe v${release} ausente no root.`);

for (const token of ['dashboard','sales','products','customers','orders','cash','credits','reports','receipts','backup','settings','audit','diagnostics','coupons']) {
  if (!routes.includes(`key: '${token}'`)) fail(`Rota ausente: ${token}`);
}

const iconNames = [...icons.matchAll(/\| '([^']+)'/g)].map((match) => match[1]);
for (const name of iconNames) {
  for (const size of ['16x16','24x24','32x32','48x48','64x64']) {
    if (!exists(`public/icons/delphi/png/${size}/${name}.png`)) fail(`Ícone ${name} ausente em ${size}.`);
  }
}

for (const forbidden of ['sale-finished-12346', 'Cliente aguardando comprovante', 'Seu último backup foi há 3 dias', "time: '09:20'", "time: '10:05'"]) {
  if (app.includes(forbidden)) fail(`Notificação fictícia de produção encontrada: ${forbidden}`);
}
if (!app.includes('runtime-alert-')) fail('Central de avisos precisa ser alimentada por alertas reais de runtime.');
if (!header.includes('mapp-header-action-label')) fail('Cabeçalho precisa diferenciar Sincronizar de Recarregar no desktop.');
if (!shell.includes('aria-current={item.key === activePage')) fail('Sidebar precisa identificar rota atual para acessibilidade.');
if (!shell.includes('<InlineIcon name="atualizar"')) fail('Card de loja precisa usar ícone real para sincronização.');
if (generic.includes("v135 proposta") || generic.includes("pwa-supabase-v135-proposta-comercial")) fail('Tela genérica ainda mostra versão/cache v135 obsoletos.');
if (dashboard.includes('⚠️') || dashboard.includes('💡') || dashboard.includes('🔥')) fail('Dashboard precisa usar iconografia real em vez de emoji decorativo.');
if (!dashboard.includes('Receber parcela')) fail('Atalhos do Painel precisam evitar duplicidade Abrir PDV/Nova venda.');


const dialogFiles = [
  'src/mobile-app/components/NotificationCenter.tsx',
  'src/mobile-app/screens/CreditsScreen.tsx',
  'src/mobile-app/screens/ProductsCustomersScreens.tsx',
  'src/mobile-app/screens/ReceiptsScreen.tsx',
  'src/mobile-app/screens/SalesScreen.tsx',
];
let dialogCount = 0;
for (const rel of dialogFiles) {
  const source = read(rel);
  const tags = source.match(/<[^>]*role="dialog"[^>]*>/gs) || [];
  dialogCount += tags.length;
  for (const tag of tags) {
    const protectedDialog = /mapp-dialog-frame|mapp-notification-modal|mapp-photo-modal|mapp-receipt-fullscreen/.test(tag);
    if (!protectedDialog) fail(`Diálogo sem contrato visual conhecido em ${rel}: ${tag.slice(0, 120)}`);
    if (!/aria-modal="true"/.test(tag)) fail(`Diálogo sem aria-modal em ${rel}.`);
  }
}
if (dialogCount < 10) fail(`Inventário de diálogos incompleto: somente ${dialogCount} encontrado(s).`);

for (const token of ['safe-area-inset-bottom', 'pointer-events: auto', 'mapp-dialog-footer', 'mapp-receive-primary-action']) {
  if (!dialogs.includes(token)) fail(`Proteção de modal iPhone ausente: ${token}`);
}
for (const token of ['Mega Lote 250', '@media (max-width: 1023px)', '@media (min-width: 1024px)', 'prefers-reduced-motion', '.mapp-context-subnav', '.mapp-report-toolbar', '.mapp-audit-list']) {
  if (!polish.includes(token)) fail(`Camada premium precisa conter: ${token}`);
}

if (failed) process.exit(1);
process.stdout.write(`OK: qa:ui v${release} passou. 14 rotas, ${dialogCount} diálogos, ícones, avisos reais e contratos web/mobile conferidos.\n`);
