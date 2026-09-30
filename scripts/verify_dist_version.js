import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const release = String(pkg.version || '').split('.').at(-1);
const dist = path.join(root, 'dist-codex-build');
const fail = (message) => { process.stderr.write(`ERRO: ${message}\n`); process.exitCode = 1; };
const read = (rel) => fs.readFileSync(path.join(dist, rel), 'utf8');

if (!fs.existsSync(dist)) {
  fail('dist-codex-build não existe. Rode npm run build antes do deploy.');
} else {
  const manifestPath = path.join(dist, 'manifest.webmanifest');
  const swPath = path.join(dist, 'sw.js');
  if (!fs.existsSync(manifestPath)) fail('manifest.webmanifest não existe no build.');
  if (!fs.existsSync(swPath)) fail('sw.js não existe no build.');
  if (fs.existsSync(manifestPath) && !read('manifest.webmanifest').includes(`v${release}`)) fail(`Manifest do build não é v${release}.`);
  if (fs.existsSync(swPath) && !read('sw.js').includes(`smart-loja-pwa-supabase-v${release}-`)) fail(`Service worker do build não é v${release}.`);

  const assetDir = path.join(dist, 'assets');
  const js = fs.existsSync(assetDir)
    ? fs.readdirSync(assetDir).filter((name) => name.endsWith('.js')).map((name) => fs.readFileSync(path.join(assetDir, name), 'utf8')).join('\n')
    : '';
  if (!js.includes(`pwa-supabase-v${release}-`)) fail(`Bundle JS não contém a versão v${release}. O dist pode estar antigo.`);
  for (const legacy of ['Salvar senha neste aparelho confiável', 'entrar automaticamente ao abrir']) {
    if (js.includes(legacy)) fail(`Bundle ainda contém UI legada insegura: ${legacy}`);
  }
  if (!js.includes('Salvar somente o e-mail neste aparelho')) fail('Bundle não contém a UI segura atual de lembrar somente e-mail.');
}

if (!process.exitCode) process.stdout.write(`OK: dist-codex-build confirmado na versão v${release}, sem login legado.\n`);
