import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const strict = process.argv.includes('--strict');
const warnings = [];
const errors = [];
const forbiddenExtensions = new Set(['.sqlite3', '.sqlite', '.db']);
const buildOrVendorFragments = [
  'node_modules/',
  'dist/',
  'dist-codex-build/',
  'src-tauri/target/',
  '.git/',
  '.wrangler/',
  'release-commercial/',
];
const allowedDatabaseFragments = ['docs/', 'supabase/migrations/'];
const localSecretFilePattern = /(^|\/)\.env($|\.)/;
const logFilePattern = /(^|\/)(?:npm-debug|yarn-debug|yarn-error|.*\.log)$/i;
const zipFilePattern = /\.zip$/i;

function walk(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    const rel = path.relative(root, full).replace(/\\/g, '/');
    if (!rel) continue;
    if (buildOrVendorFragments.some((fragment) => rel === fragment.slice(0, -1) || rel.startsWith(fragment))) continue;
    if (item.isDirectory()) walk(full, results);
    else results.push(rel);
  }
  return results;
}

function readGitignore() {
  const file = path.join(root, '.gitignore');
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
}

function isProtectedByGitignore(rel, rules) {
  const base = path.basename(rel);
  if (rules.includes(rel) || rules.includes(base)) return true;
  if (base.startsWith('.env') && (rules.includes('.env.*') || rules.includes('.env') || rules.includes('*.env'))) return true;
  if (rel.startsWith('.wrangler/') && rules.includes('.wrangler/')) return true;
  if (logFilePattern.test(rel) && rules.includes('*.log')) return true;
  if (zipFilePattern.test(rel) && rules.includes('*.zip')) return true;
  return false;
}

const files = walk(root);
const gitignoreRules = readGitignore();
const dbFiles = files.filter((rel) => forbiddenExtensions.has(path.extname(rel).toLowerCase()) && !allowedDatabaseFragments.some((fragment) => rel.startsWith(fragment)));
const envFiles = files.filter((rel) => localSecretFilePattern.test(rel) && path.basename(rel) !== '.env.example');
const unprotectedEnvFiles = envFiles.filter((rel) => !isProtectedByGitignore(rel, gitignoreRules));
const protectedEnvFiles = envFiles.filter((rel) => isProtectedByGitignore(rel, gitignoreRules));
const logFiles = files.filter((rel) => logFilePattern.test(rel));
const unprotectedLogFiles = logFiles.filter((rel) => !isProtectedByGitignore(rel, gitignoreRules));
const zipFiles = files.filter((rel) => zipFilePattern.test(rel));
const unprotectedZipFiles = zipFiles.filter((rel) => !isProtectedByGitignore(rel, gitignoreRules));
const largeFiles = files
  .map((rel) => ({ rel, size: fs.statSync(path.join(root, rel)).size }))
  .filter((row) => row.size > 3 * 1024 * 1024 && !zipFilePattern.test(row.rel))
  .sort((a, b) => b.size - a.size);

if (dbFiles.length) {
  const message = `Arquivos de banco encontrados fora de docs/migrations: ${dbFiles.join(', ')}`;
  if (strict) errors.push(message); else warnings.push(message);
}
if (unprotectedEnvFiles.length) {
  const message = `Arquivos .env reais sem proteção de .gitignore: ${unprotectedEnvFiles.join(', ')}`;
  if (strict) errors.push(message); else warnings.push(message);
}
if (protectedEnvFiles.length) warnings.push(`Arquivos .env locais protegidos e ignorados no pacote: ${protectedEnvFiles.join(', ')}`);
if (unprotectedLogFiles.length) warnings.push(`Logs locais sem regra clara de ignore: ${unprotectedLogFiles.join(', ')}`);
if (logFiles.length && !unprotectedLogFiles.length) warnings.push(`Logs locais detectados, protegidos por .gitignore e fora do pacote: ${logFiles.length} arquivo(s).`);
if (unprotectedZipFiles.length) warnings.push(`ZIPs locais sem regra clara de ignore: ${unprotectedZipFiles.join(', ')}`);
if (largeFiles.length) warnings.push(`Arquivos grandes para revisar: ${largeFiles.map((row) => `${row.rel} ${(row.size / 1024 / 1024).toFixed(1)} MB`).join(', ')}`);
if (!gitignoreRules.includes('.env.production')) warnings.push('Recomendado manter .env.production listado explicitamente no .gitignore.');
if (!gitignoreRules.includes('.wrangler/')) warnings.push('Recomendado manter .wrangler/ listado explicitamente no .gitignore.');

process.stdout.write('Commercial package check v130 — Smart Loja Fácil\n');
process.stdout.write(`Modo: ${strict ? 'strict' : 'relatório'}\n`);
if (!warnings.length && !errors.length) process.stdout.write('OK: nenhum risco de pacote comercial encontrado.\n');
for (const warning of warnings) process.stdout.write(`AVISO: ${warning}\n`);
for (const error of errors) process.stderr.write(`ERRO: ${error}\n`);
if (errors.length) {
  process.stderr.write('Falhou em modo strict. Remova ou proteja os arquivos antes de empacotar para cliente.\n');
  process.exit(1);
}
