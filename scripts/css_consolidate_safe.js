import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = ['src/styles.css', 'src/master-ui.css'];
const targetSelectorPattern = /\b(neo-page-shell|neo-sidebar|neo-topbar|neo-mobile-dock|neo-main|neo-layout|neo-header-grid|neo-action-ribbon|neo-action-tile|dash-|classic-|mobile-data-|table-|empty-state)/;
const safeImportantProps = new Set([
  'box-sizing',
  'min-width',
  'max-width',
  'overflow-x',
  'overflow-y',
  'overscroll-behavior',
  'overscroll-behavior-x',
  'overscroll-behavior-y',
  'scrollbar-gutter',
  'content-visibility',
  'contain-intrinsic-size',
  'touch-action',
  '-webkit-tap-highlight-color',
  'overflow-wrap',
  'word-break',
]);

function normalizeDeclaration(declaration) {
  return declaration.trim().replace(/\s+/g, ' ').replace(/\s*:\s*/g, ':').replace(/\s*!important/i, ' !important');
}

function processBlock(selector, body, stats) {
  const declarations = body.split(';');
  const output = [];
  const seenExact = new Set();
  const selectorText = selector.trim();
  const targetSelector = targetSelectorPattern.test(selectorText);

  for (let raw of declarations) {
    const original = raw;
    let declaration = raw.trim();
    if (!declaration) continue;
    if (!declaration.includes(':')) {
      output.push(original.trim());
      continue;
    }

    const [propPart, ...valueParts] = declaration.split(':');
    const prop = propPart.trim().toLowerCase();
    let value = valueParts.join(':').trim();

    if (targetSelector && safeImportantProps.has(prop) && /!important/i.test(value)) {
      value = value.replace(/\s*!important/i, '').trim();
      declaration = `${propPart.trim()}: ${value}`;
      stats.safeImportantRemoved += 1;
    }

    const normalized = normalizeDeclaration(declaration);
    if (seenExact.has(normalized)) {
      stats.duplicateDeclarationsRemoved += 1;
      continue;
    }
    seenExact.add(normalized);
    output.push(declaration.replace(/\s+/g, ' '));
  }

  if (output.length === 0) {
    stats.emptyRulesRemoved += 1;
    return '';
  }

  return `${selector.trim()} {\n  ${output.join(';\n  ')};\n}`;
}

function consolidate(css, stats) {
  return css.replace(/([^{}@][^{}]*?)\{([^{}]*)\}/g, (match, selector, body) => {
    if (!selector.trim()) return match;
    return processBlock(selector, body, stats) || '';
  })
  .replace(/\n{3,}/g, '\n\n')
  .trimEnd() + '\n';
}

const report = [];
for (const rel of files) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) continue;
  const before = fs.readFileSync(full, 'utf8');
  const beforeImportant = (before.match(/!important/g) || []).length;
  const beforeBytes = Buffer.byteLength(before);
  const stats = { file: rel, safeImportantRemoved: 0, duplicateDeclarationsRemoved: 0, emptyRulesRemoved: 0 };
  const after = consolidate(before, stats);
  fs.writeFileSync(full, after);
  const afterImportant = (after.match(/!important/g) || []).length;
  const afterBytes = Buffer.byteLength(after);
  report.push({ ...stats, beforeBytes, afterBytes, bytesDelta: afterBytes - beforeBytes, beforeImportant, afterImportant, importantDelta: afterImportant - beforeImportant });
}

const outDir = path.join(root, 'docs/generated');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'css-consolidation-v95.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), report }, null, 2)}\n`);
for (const row of report) {
  process.stdout.write(`${row.file}: ${row.safeImportantRemoved} !important seguros removidos, ${row.duplicateDeclarationsRemoved} declarações duplicadas removidas, ${row.emptyRulesRemoved} regras vazias removidas, ${(row.bytesDelta / 1024).toFixed(1)} KB\n`);
}
