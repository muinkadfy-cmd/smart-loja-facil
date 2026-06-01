import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const currentVersion = 'pwa-supabase-v96';
const currentCache = 'smart-loja-pwa-supabase-v96-commercial-validation';
const currentOutbox = 'smart-loja:web-outbox-v96';
const required = [
  'package.json',
  'index.html',
  'src/main.tsx',
  'src/App.tsx',
  'src/lib/api.ts',
  'src/lib/webApi.ts',
  'src/lib/productPhotoStorage.ts',
  'src/lib/designSystemReadiness.ts',
  'src/lib/cssInventoryReadiness.ts',
  'src/lib/moduleVisualChecklist.ts',
  'src/lib/neoFamilyReadiness.ts',
  'src/lib/neoShellSidebarReadiness.ts',
  'src/lib/neoImportantReadiness.ts',
  'src/styles.css',
  'src/master-ui.css',
  'src-tauri/Cargo.toml',
  'src-tauri/src/main.rs',
  'src-tauri/assets/jaque-logo-premium.base64',
  'src-tauri/tauri.conf.json',
  'src-tauri/capabilities/default.json',
  'docs/MANUAL_USO.md',
  'docs/RELATORIO_TECNICO.md',
  'docs/CHECKLIST_TESTE_OFFLINE.md',
  'README.md',
  'scripts/css_audit.js',
  'scripts/css_dedupe_safe.js',
  'scripts/css_neo_family_audit.js',
  'scripts/css_prune_empty_rules.js',
  'scripts/css_prune_duplicate_rules.js',
  'scripts/css_shell_sidebar_audit.js',
  'scripts/css_reduce_neo_important_safe.js',
  'scripts/css_important_audit.js',
  'scripts/commercial_package_check.js',
  'scripts/commercial_release_package.js',
];

const requiredCssModules = fs.existsSync(path.join(root, 'src/styles'))
  ? fs.readdirSync(path.join(root, 'src/styles')).filter((name) => name.endsWith('.css')).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })).map((name) => `src/styles/${name}`)
  : [];
required.push(...requiredCssModules);

const forbiddenPatterns = [
  { pattern: /cdn\.|unpkg|jsdelivr|googleapis|gstatic/i, label: 'CDN ou fonte online' },
  { pattern: /indexedDB|indexeddb/i, label: 'IndexedDB como banco principal' },
  { pattern: /fetch\(['"]https?:/i, label: 'fetch externo direto' },
];
const allowedUrlPatternFiles = new Set(['src/lib/supabaseClient.ts', 'src/lib/env.ts', 'src/lib/productPhotoStorage.ts', 'src/lib/webApi.ts']);
const onlineServicePattern = /supabase|cloudflare/i;
const hugeInlineAssetPattern = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]{12000,}/;
const scanDirs = ['src', 'src-tauri', 'public', 'scripts'];
const ignoredFiles = new Set(['src-tauri/Cargo.lock', 'src-tauri/tauri.conf.json', 'scripts/release_check.js', 'public/logo.svg']);
const ignoredDirFragments = ['src-tauri/target/', 'src-tauri/.cargo-check/', 'src-tauri/gen/', 'src-tauri/icons/', 'tools/QaWorkflow/bin/', 'tools/QaWorkflow/obj/', 'dist/', 'node_modules/'];
const textExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.html', '.md', '.rs', '.toml', '.svg', '.webmanifest']);

function fail(message) {
  console.error(`ERRO: ${message}`);
  process.exitCode = 1;
}

function warn(message) {
  console.warn(`AVISO: ${message}`);
}

function shouldSkip(relPath) {
  return ignoredFiles.has(relPath) || ignoredDirFragments.some((fragment) => relPath.startsWith(fragment));
}

function isTextFile(filePath) {
  return textExtensions.has(path.extname(filePath).toLowerCase());
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

for (const file of Array.from(new Set(required))) {
  if (!fs.existsSync(path.join(root, file))) fail(`Arquivo obrigatório ausente: ${file}`);
}

const packageJson = JSON.parse(read('package.json'));
for (const script of ['type-check', 'build', 'tauri:dev', 'tauri:build', 'release:check']) {
  if (!packageJson.scripts?.[script]) fail(`Script npm ausente: ${script}`);
}

const webApiSource = read('src/lib/webApi.ts');
const serviceWorkerSource = read('public/sw.js');
if (!webApiSource.includes(`WEB_APP_VERSION = '${currentVersion}'`)) fail(`WEB_APP_VERSION precisa estar em ${currentVersion}.`);
if (!webApiSource.includes(currentCache)) fail('WEB_CACHE_VERSION precisa estar no cache v96 de validação comercial.');
if (!webApiSource.includes(currentOutbox)) fail('Fila local web precisa estar em smart-loja:web-outbox-v96.');
if (!serviceWorkerSource.includes(currentCache)) fail('Service worker precisa usar cache v96 de validação comercial.');

const mainSource = read('src/main.tsx');
for (const cssFile of requiredCssModules) {
  const importPath = `./${cssFile.replace('src/', '')}`;
  if (!mainSource.includes(importPath)) fail(`main.tsx precisa importar ${importPath}.`);
  const cssSource = read(cssFile);
  const loteMatch = cssFile.match(/lote(\d+)-([a-z0-9-]+)\.css$/i);
  if (loteMatch) {
    const tokenPattern = new RegExp(`--lote${loteMatch[1]}-[a-z0-9-]+\\s*:\\s*active`, 'i');
    if (!tokenPattern.test(cssSource)) fail(`${cssFile} precisa expor token ativo do lote ${loteMatch[1]}.`);
  }
}

const productPhotoStorageSource = read('src/lib/productPhotoStorage.ts');
if (!productPhotoStorageSource.includes('PRODUCT_PHOTO_BUCKET')) fail('Utilitário de Storage de fotos precisa declarar PRODUCT_PHOTO_BUCKET.');
if (!read('src/lib/neoShellSidebarReadiness.ts').includes('getNeoShellSidebarReport')) fail('Diagnóstico shell/sidebar v80 precisa existir.');
if (!read('src/lib/neoImportantReadiness.ts').includes('getNeoImportantReport')) fail('Diagnóstico redução important v81 precisa existir.');
if (!read('scripts/css_audit.js').includes('CSS audit v95')) fail('css_audit.js precisa estar atualizado para auditoria real v95.');
if (!read('scripts/commercial_package_check.js').includes('Commercial package check v96')) fail('commercial_package_check.js precisa existir e estar em v96.');
if (!read('scripts/commercial_release_package.js').includes('Commercial release package v96')) fail('commercial_release_package.js precisa existir e estar em v96.');

const readme = read('README.md');
if (!/Supabase/i.test(readme) || !/Cloudflare/i.test(readme) || !/PWA/i.test(readme)) fail('README precisa refletir PWA/Supabase/Cloudflare atual.');
if (/sem Supabase, sem Cloudflare/i.test(readme)) fail('README ainda contém texto antigo dizendo sem Supabase/sem Cloudflare.');

const tauriConfig = JSON.parse(read('src-tauri/tauri.conf.json'));
if (!tauriConfig.identifier || !tauriConfig.build?.devUrl || !tauriConfig.bundle?.active) fail('tauri.conf.json incompleto para build/dev/bundle');

const files = [];
for (const dir of scanDirs) {
  const base = path.join(root, dir);
  if (!fs.existsSync(base)) continue;
  const stack = [base];
  while (stack.length) {
    const current = stack.pop();
    const relCurrent = path.relative(root, current).replace(/\\/g, '/');
    if (relCurrent && shouldSkip(`${relCurrent}/`)) continue;
    for (const item of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, item.name);
      const rel = path.relative(root, full).replace(/\\/g, '/');
      if (shouldSkip(rel) || shouldSkip(`${rel}/`)) continue;
      if (item.isDirectory()) stack.push(full);
      else if (isTextFile(full)) files.push(full);
    }
  }
}

for (const file of files) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  if (shouldSkip(rel)) continue;
  const content = fs.readFileSync(file, 'utf8');
  for (const rule of forbiddenPatterns) {
    if (rule.pattern.test(content)) fail(`${rule.label} encontrado em ${rel}`);
  }
  if (!allowedUrlPatternFiles.has(rel) && /https?:\/\//i.test(content)) fail(`URL externa direta encontrada fora das camadas permitidas em ${rel}`);
  if (hugeInlineAssetPattern.test(content)) fail(`Imagem base64 gigante embutida no código em ${rel}. Mova para public/brand ou src-tauri/assets.`);
  if (!rel.endsWith('.css') && !rel.startsWith('scripts/') && !rel.startsWith('src/styles/') && !['src/App.tsx', 'src/components/Shell.tsx', 'src/components/WebAuthPanel.tsx', 'src/components/PwaUpdateNotice.tsx', 'src/pages/Dashboard.tsx', 'src/pages/Settings.tsx', 'src/pages/Welcome.tsx', 'src/pages/WebDiagnostics.tsx', 'src/pages/WebMigration.tsx', 'src/lib/env.ts', 'src/lib/runtime.ts', 'src/lib/supabaseClient.ts', 'src/lib/productPhotoStorage.ts', 'src/lib/webApi.ts', 'src/lib/useWebPermissions.ts', 'src/lib/productionChecklist.ts', 'src/lib/designSystemReadiness.ts', 'src/lib/cssInventoryReadiness.ts', 'src/lib/moduleVisualChecklist.ts', 'src/lib/neoFamilyReadiness.ts', 'src/lib/neoShellSidebarReadiness.ts', 'src/lib/neoImportantReadiness.ts', 'public/manifest.webmanifest', 'public/sw.js'].includes(rel) && onlineServicePattern.test(content)) {
    fail(`Serviço online fora da camada web segura encontrado em ${rel}`);
  }
}

const rust = read('src-tauri/src/main.rs');
for (const table of ['settings', 'customers', 'products', 'sales', 'sale_items', 'cash_movements', 'credits', 'credit_installments', 'payments', 'orders', 'order_items', 'receipts', 'stock_movements', 'backups_log', 'audit_log', 'cash_closings']) {
  if (!rust.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) fail(`Tabela SQLite ausente no schema: ${table}`);
}

const sqliteFiles = [];
for (const rel of fs.readdirSync(root)) {
  if (/\.(sqlite3|sqlite|db)$/i.test(rel)) sqliteFiles.push(rel);
}
if (fs.existsSync(path.join(root, 'src-tauri'))) {
  for (const rel of fs.readdirSync(path.join(root, 'src-tauri'))) {
    if (/\.(sqlite3|sqlite|db)$/i.test(rel)) sqliteFiles.push(`src-tauri/${rel}`);
  }
}
if (sqliteFiles.length) warn(`Bancos SQLite de teste encontrados no workspace: ${sqliteFiles.join(', ')}. Não incluir no ZIP comercial final.`);

if (process.exitCode) {
  console.error('Release check encontrou problemas. Corrija antes de testar em cliente real.');
  process.exit(process.exitCode);
}
console.log('OK: release_check v96 passou. Estrutura offline preservada, PWA/Supabase atualizados, pacote comercial limpo preparado e auditoria técnica ativa.');
