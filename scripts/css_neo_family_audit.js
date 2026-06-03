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

const families = [
  'neo-page-shell',
  'neo-header-grid',
  'neo-action-ribbon',
  'neo-sidebar',
  'neo-topbar',
  'neo-mobile-dock',
  'neo-shell',
  'neo-main',
  'neo-action-tile',
  'neo-header-status-row',
];

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function extractSelectors(css) {
  const clean = stripComments(css);
  const selectors = [];
  const regex = /([^{}@][^{}]*?)\{/g;
  let match;
  while ((match = regex.exec(clean))) {
    const selector = match[1].trim().split('\n').pop()?.trim() || '';
    if (selector && !selector.startsWith('@')) selectors.push(selector.replace(/\s+/g, ' '));
  }
  return selectors;
}

function countEmptyRules(css) {
  const matches = stripComments(css).match(/(^|\n)\s*[^{}@][^{}]*?\{\s*\}/g);
  return matches ? matches.length : 0;
}

const totals = new Map(families.map((family) => [family, 0]));
let emptyRules = 0;
let totalImportant = 0;
let totalBytes = 0;

process.stdout.write('Neo family audit — Smart Loja Fácil\n');
for (const file of cssFiles) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const selectors = extractSelectors(source);
  const important = (source.match(/!important/g) || []).length;
  const bytes = Buffer.byteLength(source);
  totalImportant += important;
  totalBytes += bytes;
  emptyRules += countEmptyRules(source);
  const fileCounts = new Map(families.map((family) => [family, 0]));
  for (const selector of selectors) {
    for (const family of families) {
      if (selector.includes(`.${family}`)) {
        fileCounts.set(family, (fileCounts.get(family) || 0) + 1);
        totals.set(family, (totals.get(family) || 0) + 1);
      }
    }
  }
  const highlights = Array.from(fileCounts.entries()).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]).slice(0, 6);
  process.stdout.write(`- ${file}: ${(bytes / 1024).toFixed(1)} KB, ${important} !important, ${countEmptyRules(source)} regras vazias`);
  if (highlights.length > 0) process.stdout.write(` · ${highlights.map(([family, count]) => `${family}:${count}`).join(', ')}`);
  process.stdout.write('\n');
}

const repeated = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
process.stdout.write(`Total CSS auditado: ${(totalBytes / 1024).toFixed(1)} KB · ${totalImportant} !important · ${emptyRules} regras vazias\n`);
process.stdout.write('Famílias neo-* mais presentes:\n');
for (const [family, count] of repeated) {
  process.stdout.write(`- .${family}: ${count} ocorrências de seletor\n`);
}

if (emptyRules > 0) {
  process.stdout.write('Aviso: existem regras vazias. Rode node scripts/css_prune_empty_rules.js antes do build.\n');
}
if ((totals.get('neo-page-shell') || 0) > 35) {
  process.stdout.write('Aviso: .neo-page-shell ainda aparece muitas vezes; próximo lote deve consolidar por tela com revisão visual real.\n');
}
