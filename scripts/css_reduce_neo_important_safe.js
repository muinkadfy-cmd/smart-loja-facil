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

const files = getActiveCssFiles();
const targetSelectors = ['.neo-page-shell', '.neo-sidebar'];
const safeProperties = new Set([
  'min-width',
  'max-width',
  'overflow-x',
  'overflow-y',
  'overscroll-behavior',
  'scrollbar-gutter',
  'box-sizing',
  'padding-bottom',
  'overflow-wrap',
]);

function selectorTargets(selector) {
  return targetSelectors.some((target) => selector.includes(target));
}

function reduceImportant(css) {
  let changed = 0;
  const next = css.replace(/([^{}]*?(?:\.neo-page-shell|\.neo-sidebar)[^{}]*?)\{([^{}]*)\}/g, (full, selector, body) => {
    if (!selectorTargets(selector)) return full;
    const newBody = body.replace(/([\n\r\t ]*)([a-zA-Z-]+)(\s*:\s*[^;{}]*?)\s*!important(\s*;)/g, (decl, prefix, prop, value, suffix) => {
      if (!safeProperties.has(prop.toLowerCase())) return decl;
      changed += 1;
      return `${prefix}${prop}${value}${suffix}`;
    });
    return `${selector}{${newBody}}`;
  });
  return { css: next, changed };
}

let total = 0;
for (const file of files) {
  const filePath = path.join(root, file);
  if (!fs.existsSync(filePath)) continue;
  const current = fs.readFileSync(filePath, 'utf8');
  const { css, changed } = reduceImportant(current);
  if (changed > 0) fs.writeFileSync(filePath, css);
  total += changed;
  process.stdout.write(`${file}: ${changed} !important seguros removidos\n`);
}
process.stdout.write(`Total: ${total} !important seguros removidos\n`);
