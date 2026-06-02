import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const currentVersion = 'pwa-supabase-v107-dashboard-mobile-pixel';
const currentCache = 'smart-loja-pwa-supabase-v107-dashboard-mobile-pixel';
const currentOutbox = 'smart-loja:web-outbox-v107';

const requiredCore = [
  'package.json',
  'index.html',
  'src/main.tsx',
  'src/App.tsx',
  'src/lib/api.ts',
  'src/lib/webApi.ts',
  'src/lib/env.ts',
  'src/lib/supabaseClient.ts',
  'public/sw.js',
  'public/manifest.webmanifest',
  'README.md',
];

const optionalPwaCommercialFiles = [
  'src/lib/productPhotoStorage.ts',
  'src/lib/designSystemReadiness.ts',
  'src/lib/cssInventoryReadiness.ts',
  'src/lib/moduleVisualChecklist.ts',
  'src/lib/neoFamilyReadiness.ts',
  'src/lib/neoShellSidebarReadiness.ts',
  'src/lib/neoImportantReadiness.ts',
  'src/lib/productionChecklist.ts',
  'src/lib/useWebPermissions.ts',
  'src/styles.css',
  'src/master-ui.css',
  'docs/MANUAL_USO.md',
  'docs/RELATORIO_TECNICO.md',
  'docs/CHECKLIST_TESTE_OFFLINE.md',
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

const forbiddenPatterns = [
  { pattern: /cdn\.|unpkg|jsdelivr|googleapis|gstatic/i, label: 'CDN ou fonte online' },
  { pattern: /indexedDB|indexeddb/i, label: 'IndexedDB como banco principal' },
  { pattern: /fetch\(['"]https?:/i, label: 'fetch externo direto' },
];

const allowedUrlPatternFiles = new Set([
  'src/lib/supabaseClient.ts',
  'src/lib/env.ts',
  'src/lib/productPhotoStorage.ts',
  'src/lib/webApi.ts',
]);

const onlineServicePattern = /supabase|cloudflare/i;
const hugeInlineAssetPattern = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]{12000,}/;
const scanDirs = ['src', 'public', 'scripts'];
const ignoredFiles = new Set([
  'scripts/release_check.js',
  'public/logo.svg',
]);
const ignoredDirFragments = [
  'dist/',
  'node_modules/',
  '.git/',
  'release-commercial/',
  'tools/QaWorkflow/bin/',
  'tools/QaWorkflow/obj/',
];
const textExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.html', '.md', '.svg', '.webmanifest']);

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
  if (!exists(file)) fail(`Arquivo essencial PWA ausente: ${file}`);
}

for (const file of optionalPwaCommercialFiles) {
  if (!exists(file)) warn(`Arquivo comercial/auditoria ausente: ${file}. Não bloqueia deploy PWA, mas pode entrar no próximo lote comercial.`);
}

if (exists('src-tauri')) {
  warn('Pasta src-tauri encontrada como legado do projeto. Este release_check v107 é PWA web/mobile e não exige Tauri. Não suba bancos SQLite nem target/ no GitHub.');
}

if (process.exitCode) {
  console.error('Release check encontrou arquivos PWA essenciais ausentes. Corrija antes do deploy.');
  process.exit(process.exitCode);
}

const packageJson = JSON.parse(read('package.json'));
for (const script of ['type-check', 'build', 'release:check']) {
  if (!packageJson.scripts?.[script]) fail(`Script npm essencial ausente: ${script}`);
}
for (const script of ['lint', 'release:commercial:check', 'release:commercial:prepare']) {
  if (!packageJson.scripts?.[script]) warn(`Script npm opcional ausente: ${script}.`);
}

const webApiSource = read('src/lib/webApi.ts');
const serviceWorkerSource = read('public/sw.js');
if (!webApiSource.includes(`WEB_APP_VERSION = '${currentVersion}'`)) fail(`WEB_APP_VERSION precisa estar em ${currentVersion}.`);
if (!webApiSource.includes(currentCache)) fail('WEB_CACHE_VERSION precisa estar no cache v107 dashboard mobile pixel PWA/mobile.');
if (!webApiSource.includes(currentOutbox)) fail('Fila local web precisa estar em smart-loja:web-outbox-v107.');
if (!serviceWorkerSource.includes(currentCache)) fail('Service worker precisa usar cache v107 dashboard mobile pixel PWA/mobile.');

function publicAssetExists(url) {
  if (!url || !url.startsWith('/')) return true;
  if (url === '/' || url === '/index.html') return true;
  return exists(`public/${url.slice(1)}`);
}

try {
  const manifest = JSON.parse(read('public/manifest.webmanifest'));
  for (const icon of manifest.icons ?? []) {
    if (!publicAssetExists(icon.src)) fail(`Manifest referencia icon ausente: ${icon.src}`);
  }
  for (const shortcut of manifest.shortcuts ?? []) {
    for (const icon of shortcut.icons ?? []) {
      if (!publicAssetExists(icon.src)) fail(`Manifest shortcut referencia icon ausente: ${icon.src}`);
    }
  }
} catch (error) {
  fail(`Manifest web invalido: ${error instanceof Error ? error.message : String(error)}`);
}

const appShellMatch = serviceWorkerSource.match(/const APP_SHELL = \[([\s\S]*?)\];/);
if (!appShellMatch) fail('Service worker precisa declarar APP_SHELL.');
else {
  const appShellAssets = Array.from(appShellMatch[1].matchAll(/'([^']+)'/g), (match) => match[1]);
  for (const asset of appShellAssets) {
    if (!publicAssetExists(asset)) fail(`Service worker tenta cachear asset ausente: ${asset}`);
  }
}

const requiredCssModules = exists('src/styles')
  ? fs.readdirSync(path.join(root, 'src/styles')).filter((name) => name.endsWith('.css')).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })).map((name) => `src/styles/${name}`)
  : [];
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

const productPhotoStorageSource = readIf('src/lib/productPhotoStorage.ts');
if (productPhotoStorageSource && !productPhotoStorageSource.includes('PRODUCT_PHOTO_BUCKET')) fail('Utilitário de Storage de fotos precisa declarar PRODUCT_PHOTO_BUCKET.');
if (exists('src/lib/neoShellSidebarReadiness.ts') && !read('src/lib/neoShellSidebarReadiness.ts').includes('getNeoShellSidebarReport')) fail('Diagnóstico shell/sidebar precisa existir.');
if (exists('src/lib/neoImportantReadiness.ts') && !read('src/lib/neoImportantReadiness.ts').includes('getNeoImportantReport')) fail('Diagnóstico important precisa existir.');
if (exists('scripts/css_audit.js') && !read('scripts/css_audit.js').includes('CSS audit v95')) fail('css_audit.js precisa estar atualizado para auditoria real v95.');
if (exists('scripts/commercial_package_check.js') && !read('scripts/commercial_package_check.js').includes('Commercial package check v97')) fail('commercial_package_check.js precisa estar em v97.');
if (exists('scripts/commercial_release_package.js') && !read('scripts/commercial_release_package.js').includes('Commercial release package v97')) fail('commercial_release_package.js precisa estar em v97.');

const readme = read('README.md');
if (!/Supabase/i.test(readme) || !/Cloudflare/i.test(readme) || !/PWA/i.test(readme)) warn('README ainda não descreve claramente PWA/Supabase/Cloudflare.');
if (/sem Supabase, sem Cloudflare/i.test(readme)) fail('README ainda contém texto antigo dizendo sem Supabase/sem Cloudflare.');

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

const allowedOnlineServiceFiles = new Set([
  'src/App.tsx',
  'src/components/Shell.tsx',
  'src/components/WebAuthPanel.tsx',
  'src/components/PwaUpdateNotice.tsx',
  'src/pages/Dashboard.tsx',
  'src/pages/Settings.tsx',
  'src/pages/Welcome.tsx',
  'src/pages/WebDiagnostics.tsx',
  'src/pages/WebMigration.tsx',
  'src/lib/env.ts',
  'src/lib/runtime.ts',
  'src/lib/supabaseClient.ts',
  'src/lib/productPhotoStorage.ts',
  'src/lib/webApi.ts',
  'src/lib/useWebPermissions.ts',
  'src/lib/productionChecklist.ts',
  'src/lib/designSystemReadiness.ts',
  'src/lib/cssInventoryReadiness.ts',
  'src/lib/moduleVisualChecklist.ts',
  'src/lib/neoFamilyReadiness.ts',
  'src/lib/neoShellSidebarReadiness.ts',
  'src/lib/neoImportantReadiness.ts',
  'public/manifest.webmanifest',
  'public/sw.js',
]);

for (const file of files) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  if (shouldSkip(rel)) continue;
  const content = fs.readFileSync(file, 'utf8');
  for (const rule of forbiddenPatterns) {
    if (rule.pattern.test(content)) fail(`${rule.label} encontrado em ${rel}`);
  }
  if (!allowedUrlPatternFiles.has(rel) && /https?:\/\//i.test(content)) fail(`URL externa direta encontrada fora das camadas permitidas em ${rel}`);
  if (hugeInlineAssetPattern.test(content)) warn(`Imagem base64 gigante embutida no código em ${rel}. Não bloqueia deploy PWA, mas o próximo lote deve mover para public/brand para melhorar performance/cache.`);
  const isAllowedDiagnosticOrScript = rel.endsWith('.css') || rel.startsWith('scripts/') || rel.startsWith('src/styles/');
  if (!isAllowedDiagnosticOrScript && !allowedOnlineServiceFiles.has(rel) && onlineServicePattern.test(content)) {
    fail(`Serviço online fora da camada web segura encontrado em ${rel}`);
  }
}

const sqliteFiles = [];
for (const rel of fs.readdirSync(root)) {
  if (/\.(sqlite3|sqlite|db)$/i.test(rel)) sqliteFiles.push(rel);
}
if (exists('src-tauri')) {
  const stack = [path.join(root, 'src-tauri')];
  while (stack.length) {
    const current = stack.pop();
    for (const item of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, item.name);
      const rel = path.relative(root, full).replace(/\\/g, '/');
      if (item.isDirectory()) stack.push(full);
      else if (/\.(sqlite3|sqlite|db)$/i.test(rel)) sqliteFiles.push(rel);
    }
  }
}
if (sqliteFiles.length) warn(`Bancos SQLite de teste encontrados no workspace: ${sqliteFiles.join(', ')}. Não incluir no ZIP comercial final nem no GitHub.`);

if (process.exitCode) {
  console.error('Release check encontrou problemas. Corrija antes de testar em cliente real.');
  process.exit(process.exitCode);
}
console.log('OK: release_check v107 PWA passou. Build web/mobile pronto para deploy Cloudflare; avisos comerciais não bloqueiam deploy.');
