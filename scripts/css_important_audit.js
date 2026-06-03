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

const targets = ['.neo-page-shell', '.neo-sidebar'];

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
    rules.push({ selector, body: match[2] });
  }
  return rules;
}

function countImportantDeclarations(rule, target) {
  if (!rule.selector.includes(target)) return [];
  return rule.body.split(';')
    .map((raw) => raw.trim())
    .filter((raw) => raw.includes(':') && raw.includes('!important'))
    .map((raw) => {
      const [propPart, ...valueParts] = raw.split(':');
      return {
        selector: rule.selector,
        prop: propPart.trim().toLowerCase(),
        value: normalize(valueParts.join(':')),
      };
    });
}

const totals = Object.fromEntries(targets.map((target) => [target, { important: 0, selectors: 0, props: new Map() }]));
let totalImportant = 0;

process.stdout.write('Important CSS audit — Smart Loja Fácil\n');
for (const file of cssFiles) {
  const css = fs.readFileSync(path.join(root, file), 'utf8');
  const rules = extractRules(css);
  const fileTotals = Object.fromEntries(targets.map((target) => [target, { important: 0, selectors: 0 }]));
  for (const rule of rules) {
    for (const target of targets) {
      if (!rule.selector.includes(target)) continue;
      fileTotals[target].selectors += 1;
      totals[target].selectors += 1;
      const declarations = countImportantDeclarations(rule, target);
      fileTotals[target].important += declarations.length;
      totals[target].important += declarations.length;
      totalImportant += declarations.length;
      for (const declaration of declarations) {
        const map = totals[target].props;
        map.set(declaration.prop, (map.get(declaration.prop) || 0) + 1);
      }
    }
  }
  process.stdout.write(`- ${file}`);
  for (const target of targets) {
    const info = fileTotals[target];
    if (info.selectors > 0) process.stdout.write(` · ${target}: ${info.important} !important/${info.selectors} seletores`);
  }
  process.stdout.write('\n');
}

for (const target of targets) {
  const info = totals[target];
  const topProps = Array.from(info.props.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([prop, count]) => `${prop}=${count}`)
    .join(', ');
  process.stdout.write(`${target}: ${info.important} !important em ${info.selectors} seletores${topProps ? ` · top: ${topProps}` : ''}\n`);
}
process.stdout.write(`Total alvo shell/sidebar: ${totalImportant} !important\n`);
if (totalImportant > 420) {
  process.stdout.write('Aviso: ainda há prioridade CSS ativo alta. Reduzir por tela com validação visual real.\n');
}
