import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const releaseNumber = String(packageJson.version ?? '').split('.').at(-1);
const currentVersion = `pwa-supabase-v${releaseNumber}-iphone-mobile-polimento`;
const currentCache = `smart-loja-pwa-supabase-v${releaseNumber}-iphone-mobile-polimento`;

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
  'src/mobile-app/screens/CouponScreen.tsx',
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

if (!/^0\.1\.\d+$/.test(String(packageJson.version ?? ''))) fail('package.json precisa usar versão 0.1.<lote>.');
if (!releaseNumber) fail('Não foi possível derivar o lote atual da versão de package.json.');
for (const script of ['type-check', 'build', 'release:check', 'lint', 'qa:commercial', 'qa:load', 'release:commercial:check']) {
  if (!packageJson.scripts?.[script]) fail(`Script npm essencial ausente: ${script}`);
}
if (!String(packageJson.scripts?.preview ?? '').includes('--outDir dist-codex-build')) {
  fail('npm run preview precisa servir explicitamente dist-codex-build para não abrir um build antigo.');
}

function parseEnvContent(content) {
  const values = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    values[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return values;
}

function isPlaceholderEnv(value) {
  return !value || /SEU-|EXEMPLO|example|localhost|127\.0\.0\.1|undefined|null/i.test(value);
}

if (!exists('.env.production')) {
  fail('Build de produção bloqueado: .env.production ausente. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY antes de publicar.');
} else {
  const env = parseEnvContent(read('.env.production'));
  const supabaseUrl = env.VITE_SUPABASE_URL || '';
  const anonKey = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
  if (isPlaceholderEnv(supabaseUrl) || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl)) {
    fail('Build de produção bloqueado: VITE_SUPABASE_URL precisa ser uma URL real https://*.supabase.co em .env.production.');
  }
  if (isPlaceholderEnv(anonKey) || anonKey.length < 40) {
    fail('Build de produção bloqueado: VITE_SUPABASE_ANON_KEY pública ausente ou inválida em .env.production.');
  }
  if (env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SERVICE_ROLE_KEY) {
    fail('Build de produção bloqueado: service_role nunca pode existir em .env.production do PWA.');
  }
}

const mainSource = read('src/main.tsx');
if (!mainSource.includes("'./mobile-app/styles/mobile-app.css'") && !mainSource.includes('"./mobile-app/styles/mobile-app.css"')) fail('main.tsx precisa carregar somente a base nova mobile-app.css.');
for (const rule of forbiddenLoadedCss) {
  if (rule.test(mainSource)) fail(`main.tsx ainda carrega CSS antigo/herdado: ${rule}`);
}
if (!mainSource.includes('smart-mobile-rebuild-v175')) fail('main.tsx precisa aplicar a classe smart-mobile-rebuild-v175.');

const appSource = read('src/App.tsx');
if (!appSource.includes('MobileApp')) fail('App.tsx precisa renderizar a nova interface MobileApp.');
if (!appSource.includes('onLogout')) fail('App.tsx precisa passar logout seguro para o app mobile.');
if (appSource.includes("./components/Shell") || appSource.includes("./pages/Dashboard")) fail('App.tsx não deve usar Shell/páginas antigas como base visual do rebuild.');

const webApiSource = read('src/lib/webApi.ts');
const serviceWorkerSource = read('public/sw.js');
if (!webApiSource.includes(`WEB_APP_VERSION = '${currentVersion}'`)) fail(`WEB_APP_VERSION precisa estar em ${currentVersion}.`);
if (!webApiSource.includes(`WEB_CACHE_VERSION = '${currentCache}'`)) fail(`WEB_CACHE_VERSION precisa estar no cache v${releaseNumber} atual.`);
if (!serviceWorkerSource.includes(`CACHE_NAME = '${currentCache}'`)) fail(`Service worker precisa usar cache v${releaseNumber} atual.`);
if (!webApiSource.includes('day-two-follow-up-v142')) fail('webApi precisa verificar acompanhamento Dia 2 v142.');
if (!webApiSource.includes('first-client-closeout-v144')) fail('webApi precisa verificar encerramento do primeiro cliente v144.');
const apiSource = read('src/lib/api.ts');
const creditsSource = read('src/mobile-app/screens/CreditsScreen.tsx');
const productsCustomersSource = read('src/mobile-app/screens/ProductsCustomersScreens.tsx');
const receiptsSource = read('src/mobile-app/screens/ReceiptsScreen.tsx');
const safeCancelMigration = 'supabase/migrations/202607302245_mega_lote_241_cancel_credit_delete_product_safe.sql';
if (!webApiSource.includes('webCancelCredit') || !webApiSource.includes('webDeleteProductSafe')) fail('webApi precisa conter cancelamento seguro de crediário e exclusão segura de produto do lote 241.');
if (!apiSource.includes('cancelCredit:') || !apiSource.includes('deleteProductSafe:')) fail('api.ts precisa expor cancelCredit e deleteProductSafe.');
if (!creditsSource.includes('Cancelar crediário') || !creditsSource.includes('Digite CANCELAR')) fail('Crediário mobile precisa oferecer cancelamento com confirmação forte.');
if (!productsCustomersSource.includes('Excluir cadastro') || !productsCustomersSource.includes('Digite EXCLUIR')) fail('Produtos mobile precisa oferecer exclusão segura somente após confirmação.');
if (!receiptsSource.includes("credit.status === 'cancelado'") && !receiptsSource.includes("credit.status === 'cancelada'")) fail('Comprovantes precisam reconhecer crediário cancelado.');
if (!exists(safeCancelMigration)) fail(`Migration segura ausente: ${safeCancelMigration}`);
else {
  const migrationSource = read(safeCancelMigration);
  for (const rpcName of ['web_cancel_credit_safe', 'web_delete_product_safe']) {
    if (!migrationSource.includes(rpcName)) fail(`Migration do lote 241 precisa conter ${rpcName}.`);
  }
  if (!migrationSource.includes("product_row.status <> 'inactive'")) fail('Exclusão segura precisa exigir produto inativo.');
  if (!migrationSource.includes('payments_changed') || !migrationSource.includes('cash_movements_changed')) fail('Cancelamento seguro precisa auditar preservação de pagamentos e caixa.');
}
const mobileAppSource = read('src/mobile-app/MobileApp.tsx');
const mobileHeaderSource = read('src/mobile-app/layout/MobileHeader.tsx');
if (!mobileAppSource.includes('Central de avisos')) fail('MobileApp precisa renderizar Central de avisos leigos.');
if (!mobileAppSource.includes('Sair da conta')) fail('MobileApp precisa oferecer saída de sessão na central de avisos.');
if (!mobileHeaderSource.includes('mapp-logout-top-button')) fail('MobileHeader precisa ter botão visível de logout.');
const diagnosticsSource = read('src/mobile-app/screens/DiagnosticsScreen.tsx');
if (!diagnosticsSource.includes('Correção pós-implantação / Dia 2')) fail('Diagnóstico precisa renderizar a seção Correção pós-implantação / Dia 2.');

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
for (const token of ['mapp-root', 'mapp-bottom-nav', 'mapp-sidebar', 'mapp-page', 'mapp-stat-card', 'mapp-alert-card', 'mapp-context-subnav', 'mapp-side-group', 'mapp-guided-test-panel', 'mapp-assisted-execution-panel', 'mapp-triage-panel', 'mapp-final-release-panel', 'mapp-demo-panel', 'mapp-tour-panel', 'mapp-proposal-panel', 'mapp-client-feedback-panel', 'mapp-regression-audit-panel', 'mapp-day-one-panel', 'mapp-alert-icon', 'mapp-sidebar-logout']) {
  if (!css.includes(token)) fail(`mobile-app.css precisa conter ${token}.`);
}
if (!css.includes('html.smart-mobile-rebuild-v245 .mapp-report-toolbar .mapp-button-grid')) {
  fail('mobile-app.css precisa impedir overflow horizontal das ações de relatório no mobile.');
}

const creditsMobileSource = read('src/mobile-app/screens/CreditsScreen.tsx');
const productsMobileSource = read('src/mobile-app/screens/ProductsCustomersScreens.tsx');
const dialogAccessibilitySource = read('src/mobile-app/hooks/useDialogAccessibility.ts');
const dialogConsumerSources = [
  'src/mobile-app/layout/MobileShell.tsx',
  'src/mobile-app/components/NotificationCenter.tsx',
  'src/mobile-app/screens/CreditsScreen.tsx',
  'src/mobile-app/screens/ProductsCustomersScreens.tsx',
  'src/mobile-app/screens/SalesScreen.tsx',
  'src/mobile-app/screens/ReceiptsScreen.tsx',
].map(read);
const dialogAccessibilityBundle = [dialogAccessibilitySource, ...dialogConsumerSources].join('\n');
if (!dialogAccessibilitySource.includes('useRef<HTMLElement | null>(null)')) fail('useDialogAccessibility precisa controlar internamente um ref mutável de HTMLElement.');
if (!dialogAccessibilitySource.includes('const setActiveDialogNode = useCallback')) fail('useDialogAccessibility precisa expor um callback ref estável.');
if (!dialogAccessibilitySource.includes('return setActiveDialogNode')) fail('useDialogAccessibility precisa retornar o callback ref controlado pelo hook.');
if (dialogConsumerSources.some((source) => source.includes('dialogRef:'))) fail('Consumidores de useDialogAccessibility não devem receber nem alterar RefObject diretamente.');
if (dialogConsumerSources.some((source) => /activeDialogRef\.current\s*=/.test(source))) fail('Consumidor está alterando activeDialogRef.current diretamente.');
for (const [pattern, label] of [
  [/\bas\s+any\b/, 'cast as any'],
  [/@ts-ignore\b/, '@ts-ignore'],
  [/@ts-nocheck\b/, '@ts-nocheck'],
  [/@ts-expect-error\b/, '@ts-expect-error'],
]) {
  if (pattern.test(dialogAccessibilityBundle)) fail(`Acessibilidade de diálogos não pode usar supressão TypeScript: ${label}.`);
}
if (!creditsMobileSource.includes('ref={setActiveDialogNode}')) fail('Crediário precisa usar o callback ref do hook nos diálogos.');
if (!productsMobileSource.includes('ref={setActiveDialogNode}')) fail('Produtos precisa usar o callback ref do hook nos diálogos.');
for (const token of ['mapp-critical-dialog', 'mapp-critical-dialog-actions', 'enterKeyHint="done"', 'type="submit"']) {
  if (!creditsMobileSource.includes(token)) fail(`Crediário mobile precisa conter ${token} no modal crítico.`);
  if (!productsMobileSource.includes(token)) fail(`Produtos mobile precisa conter ${token} no modal crítico.`);
}
for (const token of ['Mega Lote 242 — modais críticos acessíveis', 'height: 100dvh', 'bottom: 0', 'env(safe-area-inset-bottom)', 'touch-action: manipulation']) {
  if (!css.includes(token)) fail(`mobile-app.css do lote 242 precisa conter ${token}.`);
}
for (const token of ['Hotfix 243 — botões críticos', 'mapp-critical-inline-feedback', 'pointer-events: auto']) {
  if (!css.includes(token)) fail(`mobile-app.css do hotfix 243 precisa conter ${token}.`);
}
if (!creditsSource.includes('cancelCreditFeedback')) fail('CreditsScreen precisa mostrar feedback dentro do modal de cancelamento.');
if (!creditsSource.includes('disabled={saving}>{saving ? \'Cancelando...\' : \'Cancelar crediário\'}')) fail('Botão Cancelar crediário não pode ficar desabilitado silenciosamente por confirmação incompleta.');
if (!productsCustomersSource.includes('deleteProductFeedback')) fail('Produtos precisa mostrar feedback dentro do modal de exclusão.');
if (!productsCustomersSource.includes("const [deleteProductFeedback, setDeleteProductFeedback] = useState")) fail('ProductsScreen precisa declarar o estado deleteProductFeedback e seu setter.');
if (!productsCustomersSource.includes('disabled={saving}>{saving ? \'Excluindo...\' : \'Excluir cadastro\'}')) fail('Botão Excluir cadastro não pode ficar desabilitado silenciosamente por confirmação incompleta.');

const routeSource = read('src/mobile-app/mobileAppRoutes.ts');
for (const label of ['Vendas / PDV', 'Produtos', 'Clientes', 'Pedidos', 'Caixa', 'Crediário', 'Relatórios', 'Comprovantes', 'Backup', 'Configurações', 'Logs / Diagnóstico', 'Diagnóstico Web', 'Cupom']) {
  if (!routeSource.includes(label)) fail(`Rota nova ausente: ${label}`);
}
for (const groupLabel of ['Operação', 'Gestão', 'Controle']) {
  if (!routeSource.includes(groupLabel)) fail(`Grupo de sub-abas/menu ausente: ${groupLabel}`);
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
console.log(`OK: release_check v${releaseNumber} PWA passou. Hook de acessibilidade e versão do lote validados.`);
