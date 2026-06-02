import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const cssFiles = [
  'src/styles.css',
  'src/master-ui.css',
  'src/styles/lote77-design-system.css',
  'src/styles/lote78-css-cleanup.css',
  'src/styles/lote79-neo-family.css',
]
  .map((file) => path.join(root, file))
  .filter((file) => fs.existsSync(file));

function pruneEmptyRules(source) {
  let output = source;
  let removed = 0;
  let changed = true;
  const emptyRulePattern = /(^|\n)(\s*)([^{}@][^{}]*?)\{\s*(?:\/\*[\s\S]*?\*\/\s*)?\}\s*/g;
  while (changed) {
    changed = false;
    output = output.replace(emptyRulePattern, (match, prefix, indent, selector) => {
      const normalizedSelector = selector.trim();
      if (!normalizedSelector || normalizedSelector.includes('{') || normalizedSelector.includes('}')) return match;
      if (normalizedSelector.startsWith('@')) return match;
      removed += 1;
      changed = true;
      return prefix;
    });
  }
  output = output.replace(/\n{4,}/g, '\n\n\n');
  return { output, removed };
}

let totalRemoved = 0;
let totalBytes = 0;
for (const file of cssFiles) {
  const before = fs.readFileSync(file, 'utf8');
  const { output, removed } = pruneEmptyRules(before);
  const bytes = Buffer.byteLength(before) - Buffer.byteLength(output);
  if (removed > 0) fs.writeFileSync(file, output);
  totalRemoved += removed;
  totalBytes += bytes;
  process.stdout.write(`${path.relative(root, file).replace(/\\/g, '/')}: ${removed} regras vazias removidas, ${bytes} bytes economizados\n`);
}
process.stdout.write(`Total: ${totalRemoved} regras vazias, ${totalBytes} bytes economizados\n`);
