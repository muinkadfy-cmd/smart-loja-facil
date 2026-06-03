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
const targets = ['neo-page-shell', 'neo-sidebar'];

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function normalize(value) {
  return value.trim().replace(/\s+/g, ' ');
}

function extractRules(css) {
  const clean = stripComments(css);
  const regex = /([^{}@][^{}]*?)\{([^{}]*)\}/g;
  const rules = [];
  let match;
  while ((match = regex.exec(clean))) {
    const selector = normalize(match[1]);
    if (!selector || selector.startsWith('@')) continue;
    const body = match[2];
    rules.push({ selector, body });
  }
  return rules;
}

function declarationStats(rules, target) {
  const seen = new Map();
  let selectors = 0;
  let declarations = 0;
  let important = 0;
  let duplicates = 0;
  for (const rule of rules) {
    if (!rule.selector.includes(`.${target}`)) continue;
    selectors += 1;
    for (const raw of rule.body.split(';')) {
      if (!raw.includes(':')) continue;
      const [propPart, ...valueParts] = raw.split(':');
      const prop = propPart.trim().toLowerCase();
      const value = normalize(valueParts.join(':'));
      if (!prop || !value) continue;
      declarations += 1;
      if (value.includes('!important')) important += 1;
      const key = `${target}\u0000${rule.selector}\u0000${prop}\u0000${value}`;
      if (seen.has(key)) duplicates += 1;
      seen.set(key, true);
    }
  }
  return { selectors, declarations, important, duplicates };
}

process.stdout.write('Shell/sidebar CSS audit — Smart Loja Fácil\n');
const totals = Object.fromEntries(targets.map((target) => [target, { selectors: 0, declarations: 0, important: 0, duplicates: 0 }]));
let totalBytes = 0;
for (const file of cssFiles) {
  const css = fs.readFileSync(path.join(root, file), 'utf8');
  totalBytes += Buffer.byteLength(css);
  const rules = extractRules(css);
  process.stdout.write(`- ${file}: ${(Buffer.byteLength(css) / 1024).toFixed(1)} KB`);
  for (const target of targets) {
    const stats = declarationStats(rules, target);
    totals[target].selectors += stats.selectors;
    totals[target].declarations += stats.declarations;
    totals[target].important += stats.important;
    totals[target].duplicates += stats.duplicates;
    if (stats.selectors > 0) process.stdout.write(` · .${target}: ${stats.selectors} seletores/${stats.important} !important`);
  }
  process.stdout.write('\n');
}
process.stdout.write(`Total CSS: ${(totalBytes / 1024).toFixed(1)} KB\n`);
for (const target of targets) {
  const stats = totals[target];
  process.stdout.write(`.${target}: ${stats.selectors} seletores, ${stats.declarations} declarações, ${stats.important} !important, ${stats.duplicates} declarações repetidas no mesmo alvo\n`);
}
if (totals['neo-page-shell'].selectors > 45 || totals['neo-sidebar'].selectors > 80) {
  process.stdout.write('Aviso: ainda há legado alto; consolidar por bloco visual depois de teste real em Dashboard, Produtos, Vendas, Caixa e Crediário.\n');
}
