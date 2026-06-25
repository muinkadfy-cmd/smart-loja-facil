import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outRoot = path.join(root, 'release-commercial');
const packageDir = path.join(outRoot, 'smart-loja-facil-commercial-clean');
const manifestPath = path.join(outRoot, 'commercial-release-manifest-v237.json');

const excludedDirs = new Set(['node_modules', 'dist', 'dist-codex-build', '.git', '.turbo', '.cache', '.wrangler', 'release-commercial']);
const excludedDirFragments = ['src-tauri/target', 'src-tauri/.cargo-check', 'tools/QaWorkflow/bin', 'tools/QaWorkflow/obj'];
const excludedExtensions = new Set(['.sqlite3', '.sqlite', '.db', '.zip', '.log']);
const excludedFileNames = new Set(['.env', '.env.local', '.env.production', '.DS_Store', 'wrangler.toml']);

function relOf(full) {
  return path.relative(root, full).replace(/\\/g, '/');
}

function isEnvFile(full) {
  return /^\.env(?:\..+)?$/.test(path.basename(full));
}

function shouldSkip(full, dirent) {
  const rel = relOf(full);
  if (!rel) return false;
  if (excludedDirFragments.some((fragment) => rel === fragment || rel.startsWith(`${fragment}/`))) return true;
  if (dirent?.isDirectory() && excludedDirs.has(path.basename(full))) return true;
  if (dirent?.isFile()) {
    if (isEnvFile(full) && path.basename(full) !== '.env.example') return true;
    if (excludedFileNames.has(path.basename(full))) return true;
    if (excludedExtensions.has(path.extname(full).toLowerCase())) return true;
  }
  return false;
}

function copyDir(src, dest, copied = [], skipped = []) {
  if (!fs.existsSync(src)) return { copied, skipped };
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const rel = relOf(from);
    if (shouldSkip(from, entry)) {
      skipped.push(rel);
      continue;
    }
    const to = path.join(dest, path.relative(root, from));
    if (entry.isDirectory()) copyDir(from, dest, copied, skipped);
    else if (entry.isFile()) {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
      copied.push(rel);
    }
  }
  return { copied, skipped };
}

fs.rmSync(outRoot, { recursive: true, force: true });
fs.mkdirSync(packageDir, { recursive: true });
const { copied, skipped } = copyDir(root, packageDir);

const riskyCopied = copied.filter((rel) => {
  if (/\.(sqlite3|sqlite|db)$/i.test(rel)) return true;
  if (rel === '.env.example') return false;
  if (/(^|\/)\.env($|\.)/.test(rel)) return true;
  if (/\.log$/i.test(rel)) return true;
  if (/\.zip$/i.test(rel)) return true;
  return false;
});
const manifest = {
  name: 'Jaque Confecções e Presentes - pacote comercial limpo',
  version: 'v237',
  generated_at: new Date().toISOString(),
  package_dir: path.relative(root, packageDir).replace(/\\/g, '/'),
  copied_files: copied.length,
  skipped_files_or_dirs: skipped.sort(),
  risky_copied: riskyCopied,
  required_checks: [
    'npm ci',
    'npm run type-check',
    'npm run lint',
    'npm run qa:commercial',
    'npm run qa:load',
    'npm run build',
    'npm run release:check',
    'npm run release:commercial:check',
    'Aplicar migrations da nuvem e conferir armazenamento de fotos de produtos',
    'Testar encerramento do primeiro cliente v144, Dia 1/Dia 2, auditoria final, roteiro guiado, execução real assistida, aceite final e onboarding em dois aparelhos e papéis owner/admin/operator/viewer',
  ],
};
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

process.stdout.write('Commercial release package v237 - Jaque Confeccoes e Presentes\n');
process.stdout.write(`Pacote limpo gerado em: ${manifest.package_dir}\n`);
process.stdout.write(`Arquivos copiados: ${copied.length}\n`);
process.stdout.write(`Itens ignorados: ${skipped.length}\n`);
if (riskyCopied.length) {
  process.stderr.write(`ERRO: itens de risco ainda foram copiados: ${riskyCopied.join(', ')}\n`);
  process.exit(1);
}
process.stdout.write(`Manifest: ${path.relative(root, manifestPath).replace(/\\/g, '/')}\n`);
process.stdout.write('OK: pacote comercial preparado sem bancos de teste, ZIPs antigos, node_modules, dist, logs ou .env real.\n');
