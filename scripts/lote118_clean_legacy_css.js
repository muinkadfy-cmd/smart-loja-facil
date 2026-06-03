import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const stylesDir = path.join(root, 'src', 'styles');
const keep = new Set(['lote118-foundation-final.css', 'lote119-icon-login-rescue.css', 'lote120-commercial-components.css', 'lote121-clean-interface.css', 'lote122-clean-alerts.css', 'lote123-dashboard-supreme.css']);
const legacyPattern = /^lote(7[7-9]|8\d|9\d|10\d|11[0-7])-.*\.css$/;

if (!fs.existsSync(stylesDir)) {
  process.stdout.write('src/styles não encontrado. Nada para limpar.\n');
  process.exit(0);
}


const masterUi = path.join(root, 'src', 'master-ui.css');
if (fs.existsSync(masterUi)) {
  fs.writeFileSync(masterUi, `/*
  master-ui aposentado pela fundação limpa.
  Mantido vazio para sobrescrever com segurança instalações antigas.
*/
`);
}

const removed = [];
for (const file of fs.readdirSync(stylesDir)) {
  if (!file.endsWith('.css')) continue;
  if (keep.has(file)) continue;
  if (!legacyPattern.test(file)) continue;
  const target = path.join(stylesDir, file);
  fs.rmSync(target, { force: true });
  removed.push(file);
}

process.stdout.write(`Limpeza CSS fundação limpa concluída. Arquivos antigos removidos: ${removed.length}\n`);
for (const file of removed) process.stdout.write(`- ${file}\n`);
