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

const cssFiles = getActiveCssFiles().map((file) => path.join(root, file));

function findMatchingBrace(source, openIndex) {
  let depth = 1;
  let inString = '';
  let inComment = false;
  for (let i = openIndex + 1; i < source.length; i += 1) {
    const pair = source.slice(i, i + 2);
    if (inComment) {
      if (pair === '*/') {
        inComment = false;
        i += 1;
      }
      continue;
    }
    if (inString) {
      if (source[i] === '\\') {
        i += 1;
        continue;
      }
      if (source[i] === inString) inString = '';
      continue;
    }
    if (pair === '/*') {
      inComment = true;
      i += 1;
      continue;
    }
    if (source[i] === '"' || source[i] === "'") {
      inString = source[i];
      continue;
    }
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function normalizeSelector(value) {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeValue(value) {
  return value.replace(/\/\*[\s\S]*?\*\//g, '').trim().replace(/\s+/g, ' ');
}

function parseRegions(source, start, end, context, rules) {
  let pos = start;
  while (pos < end) {
    const open = source.indexOf('{', pos);
    if (open === -1 || open >= end) break;
    const selector = source.slice(pos, open).split('}').pop()?.trim() || '';
    const close = findMatchingBrace(source, open);
    if (close === -1 || close > end) break;
    const normalized = normalizeSelector(selector);
    if (/^@(media|supports|container)\b/.test(normalized)) {
      parseRegions(source, open + 1, close, `${context}${normalized}|`, rules);
    } else if (!normalized.startsWith('@')) {
      rules.push({ context, selector: normalized, bodyStart: open + 1, bodyEnd: close });
    }
    pos = close + 1;
  }
}

function parseDeclarations(source, bodyStart, bodyEnd) {
  const body = source.slice(bodyStart, bodyEnd);
  if (body.includes('{') || body.includes('}')) return [];
  const declarations = [];
  let start = 0;
  let depth = 0;
  let inString = '';
  let inComment = false;
  for (let i = 0; i <= body.length; i += 1) {
    const ch = i === body.length ? ';' : body[i];
    const pair = body.slice(i, i + 2);
    if (inComment) {
      if (pair === '*/') {
        inComment = false;
        i += 1;
      }
      continue;
    }
    if (inString) {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === inString) inString = '';
      continue;
    }
    if (pair === '/*') {
      inComment = true;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") inString = ch;
    else if (ch === '(') depth += 1;
    else if (ch === ')' && depth > 0) depth -= 1;
    else if (ch === ';' && depth === 0) {
      const raw = body.slice(start, i).trim();
      const end = i < body.length ? i + 1 : i;
      if (raw.includes(':') && !raw.startsWith('@')) {
        const [propPart, ...valueParts] = raw.split(':');
        const prop = propPart.trim().toLowerCase();
        if (!prop.startsWith('--') && /^-?[a-z][a-z0-9-]*$/.test(prop)) {
          declarations.push({
            prop,
            value: normalizeValue(valueParts.join(':')),
            start: bodyStart + start,
            end: bodyStart + end,
            text: source.slice(bodyStart + start, bodyStart + end),
          });
        }
      }
      start = i + 1;
    }
  }
  return declarations;
}

function dedupeFile(file) {
  const source = fs.readFileSync(file, 'utf8');
  const rules = [];
  parseRegions(source, 0, source.length, '', rules);
  const occurrences = [];
  rules.forEach((rule, ruleIndex) => {
    parseDeclarations(source, rule.bodyStart, rule.bodyEnd).forEach((declaration) => {
      const key = `${rule.context}\u0000${rule.selector}\u0000${declaration.prop}\u0000${declaration.value}`;
      occurrences.push({ ...declaration, key, ruleIndex });
    });
  });
  const lastIndexByKey = new Map();
  occurrences.forEach((item, index) => lastIndexByKey.set(item.key, index));
  const removals = [];
  let removedImportant = 0;
  occurrences.forEach((item, index) => {
    if (lastIndexByKey.get(item.key) !== index) {
      removals.push([item.start, item.end]);
      removedImportant += (item.text.match(/!important/g) || []).length;
    }
  });
  if (removals.length === 0) {
    return { file: path.relative(root, file).replace(/\\/g, '/'), removed: 0, bytes: 0, important: 0 };
  }
  removals.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [start, end] of removals) {
    const previous = merged.at(-1);
    if (previous && start <= previous[1]) previous[1] = Math.max(previous[1], end);
    else merged.push([start, end]);
  }
  let output = '';
  let cursor = 0;
  for (const [start, end] of merged) {
    output += source.slice(cursor, start);
    if (start > 0 && end < source.length && source[start - 1] !== '\n') output += '\n';
    cursor = end;
  }
  output += source.slice(cursor);
  output = output.replace(/\n{4,}/g, '\n\n\n');
  fs.writeFileSync(file, output);
  return {
    file: path.relative(root, file).replace(/\\/g, '/'),
    removed: merged.length,
    bytes: Buffer.byteLength(source) - Buffer.byteLength(output),
    important: removedImportant,
  };
}

const reports = cssFiles.map(dedupeFile);
for (const report of reports) {
  process.stdout.write(`${report.file}: ${report.removed} declarações repetidas removidas, ${report.bytes} bytes economizados, ${report.important} !important removidos\n`);
}
process.stdout.write(`Total: ${reports.reduce((sum, item) => sum + item.removed, 0)} declarações, ${reports.reduce((sum, item) => sum + item.bytes, 0)} bytes\n`);
