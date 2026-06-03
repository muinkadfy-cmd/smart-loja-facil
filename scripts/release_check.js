import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const currentVersion = 'pwa-supabase-v127-teste-guiado-comercial';
const currentCache = 'smart-loja-pwa-supabase-v127-teste-guiado-comercial';

const requiredCore = [
  'package.json',
  'index.html',
  'src/main.tsx',
  'src/App.tsx',
  'src/mobile-app/MobileApp.tsx',
  'src/mobile-app/mobileAppRoutes.ts',
  'src/mobile-app/layout/MobileShell.tsx',
  'src/mobile-app/layout/MobileHeader.tsx',
  'src/mobile-app/layout/MobileBottomNav.tsx',
  'src/mobile-app/screens/DashboardScreen.tsx',
  'src/mobile-app/screens/GenericDataScreen.tsx',
  'src/mobile-app/screens/ProductsCustomersScreens.tsx',
  'src/mobile-app/screens/CashScreen.tsx',
  'src/mobile-app/screens/OrdersScreen.tsx',
  'src/mobile-app/screens/ReceiptsScreen.tsx',
  'src/mobile-app/screens/BackupScreen.tsx',
  'src/mobile-app/screens/DiagnosticsScreen.tsx',
  'src/mobile-app/styles/mobile-app.css',
  'src/lib/api.ts',
  'src/lib/webApi.ts',
  'src/lib/env.ts',
  'src/lib/supabaseClient.ts',
  'public/sw.js',
  'public/manifest.webmanifest',
  'README.md',
];

const forbiddenLoadedCss = [/lote(77|78|79|8\d|9\d|10\d|11\d|120|121|123|124|125|126|127)-/i, /styles\.css/i, /master-ui\.css/i];
const forbiddenSecretPattern = /service_role|SERVICE_ROLE|VITE_SERVICE_ROLE_KEY|VITE_SUPABASE_SERVICE_ROLE_KEY/;

function fail(message) {
  console.error(`ERRO: ${message}`);
  process.exitCode = 1;
}

function warn(message) {
  console.warn(`AVISO: ${message}`);
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function readIf(rel) {
  return exists(rel) ? read(rel) : '';
}

for (const file of requiredCore) {
  if (!exists(file)) fail(`Arquivo essencial do rebuild mobile ausente: ${file}`);
}

if (exists('src-tauri')) warn('Pasta src-tauri encontrada como legado. Este lote é PWA web/mobile e não exige Tauri. Não incluir target/ nem bancos no GitHub.');

const packageJson = JSON.parse(read('package.json'));
for (const script of ['type-check', 'build', 'release:check', 'lint', 'release:commercial:check']) {
  if (!packageJson.scripts?.[script]) fail(`Script npm essencial ausente: ${script}`);
}

const mainSource = read('src/main.tsx');
if (!mainSource.includes("'./mobile-app/styles/mobile-app.css'") && !mainSource.includes('"./mobile-app/styles/mobile-app.css"')) fail('main.tsx precisa carregar somente a base nova mobile-app.css.');
for (const rule of forbiddenLoadedCss) {
  if (rule.test(mainSource)) fail(`main.tsx ainda carrega CSS antigo/herdado: ${rule}`);
}
if (!mainSource.includes('smart-mobile-rebuild-v127')) fail('main.tsx precisa aplicar a classe smart-mobile-rebuild-v127.');

const appSource = read('src/App.tsx');
if (!appSource.includes('MobileApp')) fail('App.tsx precisa renderizar a nova interface MobileApp.');
if (appSource.includes("./components/Shell") || appSource.includes("./pages/Dashboard")) fail('App.tsx não deve usar Shell/páginas antigas como base visual do rebuild.');

const webApiSource = read('src/lib/webApi.ts');
const serviceWorkerSource = read('public/sw.js');
if (!webApiSource.includes(`WEB_APP_VERSION = '${currentVersion}'`)) fail(`WEB_APP_VERSION precisa estar em ${currentVersion}.`);
if (!webApiSource.includes(currentCache)) fail('WEB_CACHE_VERSION precisa estar no cache v127 teste guiado.');
if (!serviceWorkerSource.includes(currentCache)) fail('Service worker precisa usar cache v127 teste guiado.');

try {
  const manifest = JSON.parse(read('public/manifest.webmanifest'));
  for (const icon of manifest.icons ?? []) {
    const src = String(icon.src ?? '');
    if (src.startsWith('/') && src !== '/' && !exists(`public/${src.slice(1)}`)) fail(`Manifest referencia ícone ausente: ${src}`);
  }
} catch (error) {
  fail(`Manifest web inválido: ${error instanceof Error ? error.message : String(error)}`);
}

const css = read('src/mobile-app/styles/mobile-app.css');
for (const token of ['mapp-root', 'mapp-bottom-nav', 'mapp-sidebar', 'mapp-page', 'mapp-stat-card', 'mapp-alert-card', 'mapp-guided-test-panel']) {
  if (!css.includes(token)) fail(`mobile-app.css precisa conter ${token}.`);
}

const routeSource = read('src/mobile-app/mobileAppRoutes.ts');
for (const label of ['Vendas / PDV', 'Produtos', 'Clientes', 'Pedidos', 'Caixa', 'Crediário', 'Relatórios', 'Comprovantes', 'Backup', 'Configurações', 'Logs / Diagnóstico', 'Diagnóstico Web']) {
  if (!routeSource.includes(label)) fail(`Rota nova ausente: ${label}`);
}

const gitignore = readIf('.gitignore');
for (const protectedEntry of ['.env', '.env.local', '.env.production', '.env.*.local', '.wrangler/']) {
  if (!gitignore.includes(protectedEntry)) fail(`.gitignore precisa proteger ${protectedEntry}.`);
}
if (/SERVICE_ROLE_KEY\s*=\s*['\"]/.test(webApiSource)) {
  fail('Chave service_role real encontrada na camada web. Remova secrets do frontend.');
}

if (exists('.env.production')) warn('.env.production existe no workspace local para build, mas não deve entrar no ZIP/commit.');
const sqliteFiles = [];
for (const rel of fs.readdirSync(root)) {
  if (/\.(sqlite3|sqlite|db)$/i.test(rel)) sqliteFiles.push(rel);
}
if (sqliteFiles.length) warn(`Bancos locais encontrados no workspace: ${sqliteFiles.join(', ')}. Não incluir no pacote.`);

if (process.exitCode) {
  console.error('Release check encontrou problemas. Corrija antes de testar em cliente real.');
  process.exit(process.exitCode);
}
console.log('OK: release_check v127 PWA passou. Teste guiado multiaparelho, permissões por papel e Supabase preservado.');
