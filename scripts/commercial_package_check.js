import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const strict = process.argv.includes('--strict');
const warnings = [];
const errors = [];
const forbiddenExtensions = new Set(['.sqlite3', '.sqlite', '.db']);
const forbiddenFragments = ['node_modules/', 'dist/', 'src-tauri/target/', '.DS_Store', '.git/', 'release-commercial/'];
const allowedDatabaseFragments = ['docs/', 'supabase/migrations/'];

function walk(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    const rel = path.relative(root, full).replace(/\\/g, '/');
    if (forbiddenFragments.some((fragment) => rel.startsWith(fragment))) continue;
    if (item.isDirectory()) walk(full, results);
    else results.push(rel);
  }
  return results;
}

const files = walk(root);
const dbFiles = files.filter((rel) => forbiddenExtensions.has(path.extname(rel).toLowerCase()) && !allowedDatabaseFragments.some((fragment) => rel.startsWith(fragment)));
const envFiles = files.filter((rel) => /(^|\/)\.env($|\.)/.test(rel) && path.basename(rel) !== '.env.example');
const largeFiles = files
  .map((rel) => ({ rel, size: fs.statSync(path.join(root, rel)).size }))
  .filter((row) => row.size > 3 * 1024 * 1024 && !row.rel.endsWith('.zip'))
  .sort((a, b) => b.size - a.size);

if (dbFiles.length) {
  const message = `Arquivos de banco encontrados fora de docs/migrations: ${dbFiles.join(', ')}`;
  if (strict) errors.push(message); else warnings.push(message);
}
if (envFiles.length) {
  const message = `Arquivos .env reais encontrados: ${envFiles.join(', ')}`;
  if (strict) errors.push(message); else warnings.push(message);
}
if (largeFiles.length) warnings.push(`Arquivos grandes para revisar: ${largeFiles.map((row) => `${row.rel} ${(row.size / 1024 / 1024).toFixed(1)} MB`).join(', ')}`);

process.stdout.write('Commercial package check v96 — Smart Loja Fácil\n');
process.stdout.write(`Modo: ${strict ? 'strict' : 'relatório'}\n`);
if (!warnings.length && !errors.length) process.stdout.write('OK: nenhum risco de pacote comercial encontrado.\n');
for (const warning of warnings) process.stdout.write(`AVISO: ${warning}\n`);
for (const error of errors) process.stderr.write(`ERRO: ${error}\n`);
if (errors.length) {
  process.stderr.write('Falhou em modo strict. Remova os arquivos antes de empacotar para cliente.\n');
  process.exit(1);
}
