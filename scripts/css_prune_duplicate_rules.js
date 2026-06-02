import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const cssFiles = ['src/styles.css', 'src/master-ui.css'].filter((file) => fs.existsSync(path.join(root, file)));

function normalize(value) {
  return value.trim().replace(/\s+/g, ' ');
}

function findMatchingBrace(source, openIndex) {
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let i = openIndex; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function parseRules(source, start = 0, end = source.length, context = []) {
  const rules = [];
  let index = start;
  while (index < end) {
    while (index < end && /\s/.test(source[index])) index += 1;
    if (index >= end) break;
    if (source.startsWith('/*', index)) {
      const closeComment = source.indexOf('*/', index + 2);
      index = closeComment >= 0 ? closeComment + 2 : end;
      continue;
    }
    const headerStart = index;
    const brace = source.indexOf('{', index);
    if (brace < 0 || brace >= end) break;
    const header = source.slice(headerStart, brace).trim();
    const close = findMatchingBrace(source, brace);
    if (close < 0 || close >= end) break;

    if (header.startsWith('@')) {
      rules.push(...parseRules(source, brace + 1, close, [...context, normalize(header)]));
    } else {
      const body = source.slice(brace + 1, close);
      rules.push({
        start: headerStart,
        end: close + 1,
        key: `${context.join('\u0001')}\u0002${normalize(header)}\u0003${normalize(body)}`,
        selector: normalize(header),
      });
    }
    index = close + 1;
  }
  return rules;
}

function pruneFile(file) {
  const full = path.join(root, file);
  const source = fs.readFileSync(full, 'utf8');
  const rules = parseRules(source);
  const lastByKey = new Map();
  rules.forEach((rule, index) => lastByKey.set(rule.key, index));
  const ranges = [];
  rules.forEach((rule, index) => {
    if (lastByKey.get(rule.key) !== index) ranges.push(rule);
  });
  if (ranges.length === 0) {
    process.stdout.write(`${file}: 0 regra duplicada removida\n`);
    return { removed: 0, bytes: 0 };
  }
  let output = source;
  let removedBytes = 0;
  for (const range of ranges.sort((a, b) => b.start - a.start)) {
    let start = range.start;
    while (start > 0 && source[start - 1] !== '\n' && /\s/.test(source[start - 1])) start -= 1;
    let end = range.end;
    while (end < source.length && /[ \t]/.test(source[end])) end += 1;
    if (source[end] === '\n') end += 1;
    removedBytes += end - start;
    output = output.slice(0, start) + output.slice(end);
  }
  fs.writeFileSync(full, output);
  process.stdout.write(`${file}: ${ranges.length} regra(s) duplicada(s) removida(s), ${removedBytes} bytes economizados\n`);
  return { removed: ranges.length, bytes: removedBytes };
}

let totalRemoved = 0;
let totalBytes = 0;
for (const file of cssFiles) {
  const result = pruneFile(file);
  totalRemoved += result.removed;
  totalBytes += result.bytes;
}
process.stdout.write(`Total: ${totalRemoved} regra(s), ${totalBytes} bytes\n`);
