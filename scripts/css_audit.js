import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function getActiveCssFiles() {
  const files = ['src/styles.css'];
  const mainPath = path.join(root, 'src', 'main.tsx');
  if (fs.existsSync(mainPath)) {
    const mainSource = fs.readFileSync(mainPath, 'utf8');
    const imports = Array.from(mainSource.matchAll(/import ['"]\.\/(styles\/[^'"]+\.css)['"];?/g), (match) => `src/${match[1]}`);
    files.push(...imports);
  }
  return files.filter((file, index, all) => all.indexOf(file) === index && fs.existsSync(path.join(root, file)));
}

const cssFiles = getActiveCssFiles();

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function extractSelectors(css) {
  const withoutComments = stripComments(css);
  const matches = [];
  const regex = /([^{}@][^{}]*?)\{/g;
  let match;
  while ((match = regex.exec(withoutComments))) {
    const selector = match[1].trim().split('\n').pop().trim();
    if (selector && !selector.startsWith('@')) matches.push(selector.replace(/\s+/g, ' '));
  }
  return matches;
}

function countDuplicateDeclarations(css) {
  const withoutComments = stripComments(css);
  const seen = new Map();
  const regex = /([^{}@][^{}]*?)\{([^{}]*)\}/g;
  let match;
  let duplicates = 0;
  while ((match = regex.exec(withoutComments))) {
    const selector = match[1].trim().replace(/\s+/g, ' ');
    if (!selector || selector.startsWith('@')) continue;
    const declarations = match[2].split(';');
    for (const declaration of declarations) {
      if (!declaration.includes(':')) continue;
      const [propPart, ...valueParts] = declaration.split(':');
      const prop = propPart.trim().toLowerCase();
      const value = valueParts.join(':').trim().replace(/\s+/g, ' ');
      if (!prop || prop.startsWith('--') || !value) continue;
      const key = `${selector}\u0000${prop}\u0000${value}`;
      const count = seen.get(key) || 0;
      if (count > 0) duplicates += 1;
      seen.set(key, count + 1);
    }
  }
  return duplicates;
}

function countEmptyRules(css) {
  const withoutComments = stripComments(css);
  const regex = /([^{}@][^{}]*?)\{\s*\}/g;
  let count = 0;
  while (regex.exec(withoutComments)) count += 1;
  return count;
}

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

const totals = {
  bytes: 0,
  important: 0,
  selectors: 0,
  media: 0,
  duplicateDeclarations: 0,
  emptyRules: 0,
};
const selectorCount = new Map();
const fileRows = [];

for (const file of cssFiles) {
  const full = path.join(root, file);
  const css = fs.readFileSync(full, 'utf8');
  const bytes = Buffer.byteLength(css);
  const selectors = extractSelectors(css);
  const important = (css.match(/!important/g) || []).length;
  const media = (css.match(/@media/g) || []).length;
  const duplicateDeclarations = countDuplicateDeclarations(css);
  const emptyRules = countEmptyRules(css);
  totals.bytes += bytes;
  totals.important += important;
  totals.selectors += selectors.length;
  totals.media += media;
  totals.duplicateDeclarations += duplicateDeclarations;
  totals.emptyRules += emptyRules;
  selectors.forEach((selector) => selectorCount.set(selector, (selectorCount.get(selector) || 0) + 1));
  fileRows.push({ file, bytes, selectors: selectors.length, important, media, duplicateDeclarations, emptyRules });
}

const duplicatedSelectors = Array.from(selectorCount.entries())
  .filter(([, count]) => count > 1)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 16);

const largestFiles = [...fileRows].sort((a, b) => b.bytes - a.bytes).slice(0, 8);
const importantHotspots = [...fileRows].sort((a, b) => b.important - a.important).slice(0, 8);

process.stdout.write('CSS audit v122 — Smart Loja Fácil\n');
process.stdout.write(`Arquivos medidos: ${cssFiles.length}\n`);
for (const row of fileRows) {
  process.stdout.write(`- ${row.file}: ${formatKb(row.bytes)}, ${row.selectors} seletores, ${row.important} !important, ${row.media} media queries, ${row.duplicateDeclarations} declarações idênticas repetidas, ${row.emptyRules} regras vazias\n`);
}

process.stdout.write(`Total real: ${formatKb(totals.bytes)}, ${totals.selectors} seletores, ${totals.important} !important, ${totals.media} media queries, ${totals.duplicateDeclarations} declarações idênticas repetidas, ${totals.emptyRules} regras vazias\n`);
process.stdout.write('Maiores arquivos CSS:\n');
for (const row of largestFiles) process.stdout.write(`- ${row.file}: ${formatKb(row.bytes)}\n`);
process.stdout.write('Maiores focos de !important:\n');
for (const row of importantHotspots) process.stdout.write(`- ${row.file}: ${row.important}\n`);
process.stdout.write('Seletores mais repetidos:\n');
for (const [selector, count] of duplicatedSelectors) process.stdout.write(`- ${selector}: ${count}x\n`);

const report = { generatedAt: new Date().toISOString(), files: fileRows, totals, duplicatedSelectors };
const outDir = path.join(root, 'docs/generated');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'css-audit-v122.json'), `${JSON.stringify(report, null, 2)}\n`);

if (totals.bytes > 700 * 1024) process.stdout.write('Aviso: CSS ativo acima de 700 KB. Próximo lote técnico deve consolidar por família visual.\n');
if (totals.important > 7000) process.stdout.write('Aviso: uso de !important ainda alto. Reduzir primeiro os CSS ativos com validação visual.\n');
if (totals.emptyRules > 0) process.stdout.write('Aviso: existem regras vazias. Rode prune_empty_rules antes de release comercial final.\n');
