import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'package.json',
  'index.html',
  'src/main.tsx',
  'src/App.tsx',
  'src/lib/api.ts',
  'src/styles.css',
  'src-tauri/Cargo.toml',
  'src-tauri/src/main.rs',
  'src-tauri/tauri.conf.json',
  'src-tauri/capabilities/default.json',
  'docs/MANUAL_USO.md',
  'docs/RELATORIO_TECNICO.md',
  'docs/CHECKLIST_TESTE_OFFLINE.md',
];

const forbiddenPatterns = [
  { pattern: /https?:\/\//i, label: 'URL externa direta' },
  { pattern: /cdn\.|unpkg|jsdelivr|googleapis|gstatic/i, label: 'CDN ou fonte online' },
  { pattern: /indexedDB|indexeddb/i, label: 'IndexedDB como banco principal' },
  { pattern: /fetch\(['"]https?:/i, label: 'fetch externo' },
];

const webModeAllowedFiles = new Set([
  'src/App.tsx',
  'src/components/Shell.tsx',
  'src/components/WebAuthPanel.tsx',
  'src/lib/env.ts',
  'src/lib/runtime.ts',
  'src/lib/supabaseClient.ts',
  'src/pages/WebDiagnostics.tsx',
  'src/pages/WebMigration.tsx',
]);

const onlineServicePattern = /supabase|cloudflare/i;

const scanDirs = ['src', 'src-tauri', 'public', 'scripts'];
const ignoredFiles = new Set([
  'src-tauri/Cargo.lock',
  'src-tauri/tauri.conf.json',
  'scripts/release_check.js',
  'public/logo.svg',
]);
const ignoredDirFragments = ['src-tauri/target/', 'src-tauri/gen/', 'src-tauri/icons/'];
const textExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.html', '.md', '.rs', '.toml', '.svg', '.webmanifest']);

function fail(message) {
  console.error(`ERRO: ${message}`);
  process.exitCode = 1;
}

function shouldSkip(relPath) {
  return ignoredFiles.has(relPath) || ignoredDirFragments.some((fragment) => relPath.startsWith(fragment));
}

function isTextFile(filePath) {
  return textExtensions.has(path.extname(filePath).toLowerCase());
}

for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) fail(`Arquivo obrigatório ausente: ${file}`);
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
for (const script of ['type-check', 'build', 'tauri:dev', 'tauri:build', 'release:check']) {
  if (!packageJson.scripts?.[script]) fail(`Script npm ausente: ${script}`);
}

const tauriConfig = JSON.parse(fs.readFileSync(path.join(root, 'src-tauri/tauri.conf.json'), 'utf8'));
if (!tauriConfig.identifier || !tauriConfig.build?.devUrl || !tauriConfig.bundle?.active) {
  fail('tauri.conf.json incompleto para build/dev/bundle');
}

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

  if (!webModeAllowedFiles.has(rel) && onlineServicePattern.test(content)) {
    fail(`Servico online fora da camada web segura encontrado em ${rel}`);
  }
}

const rust = fs.readFileSync(path.join(root, 'src-tauri/src/main.rs'), 'utf8');
for (const table of ['settings', 'customers', 'products', 'sales', 'sale_items', 'cash_movements', 'credits', 'credit_installments', 'payments', 'orders', 'order_items', 'receipts', 'stock_movements', 'backups_log', 'audit_log', 'cash_closings']) {
  if (!rust.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) fail(`Tabela SQLite ausente no schema: ${table}`);
}

if (process.exitCode) {
  console.error('Release check encontrou problemas. Corrija antes de testar em cliente real.');
  process.exit(process.exitCode);
}
console.log('OK: release_check passou. Estrutura offline/Tauri/SQLite validada em análise estática.');
