import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const scanDirs = ['src', 'src-tauri', 'scripts'];
const ignoredDirFragments = [
  'src-tauri/target/',
  'src-tauri/.cargo-check/',
  'src-tauri/gen/',
  'dist/',
  'node_modules/',
  'tools/QaWorkflow/bin/',
  'tools/QaWorkflow/obj/',
];
const textExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.html', '.md', '.rs', '.toml', '.svg', '.webmanifest']);
const ignoredFiles = new Set([
  'scripts/lint.js',
  'scripts/release_check.js',
]);
const rules = [
  { pattern: /\bdebugger\b/, label: 'debugger encontrado' },
  { pattern: /console\.(log|debug)\(/, label: 'console de debug encontrado' },
  { pattern: /TODO|FIXME/, label: 'pendência explícita encontrada' },
];

let failed = false;

function fail(message) {
  console.error(`LINT: ${message}`);
  failed = true;
}

function shouldSkip(relPath) {
  return ignoredFiles.has(relPath) || ignoredDirFragments.some((fragment) => relPath.startsWith(fragment));
}

function scanDir(baseDir) {
  const stack = [baseDir];
  while (stack.length) {
    const current = stack.pop();
    for (const item of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, item.name);
      const rel = path.relative(root, full).replace(/\\/g, '/');
      if (shouldSkip(rel) || shouldSkip(`${rel}/`)) continue;
      if (item.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!textExtensions.has(path.extname(full).toLowerCase())) continue;
      const content = fs.readFileSync(full, 'utf8');
      for (const rule of rules) {
        if (rule.pattern.test(content)) fail(`${rule.label}: ${rel}`);
      }
    }
  }
}

for (const dir of scanDirs) {
  const abs = path.join(root, dir);
  if (fs.existsSync(abs)) scanDir(abs);
}

if (failed) process.exit(1);
console.log('OK: lint local passou sem achados críticos.');
