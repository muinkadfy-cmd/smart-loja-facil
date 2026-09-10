import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const baselineDir = path.resolve(option('--baseline', 'qa-screenshots/desktop-premium/baseline-mobile/390'));
const currentDir = path.resolve(option('--current', 'qa-screenshots/desktop-premium/final-mobile/390'));
const outputFile = path.resolve(option('--output', 'qa-screenshots/desktop-premium/mobile-regression.json'));
const threshold = Math.max(0, Math.min(255, Number(option('--threshold', '24')) || 24));

const files = fs.readdirSync(baselineDir)
  .filter((file) => file.toLowerCase().endsWith('.png') && fs.existsSync(path.join(currentDir, file)))
  .sort((a, b) => a.localeCompare(b, 'pt-BR'));

if (!files.length) throw new Error('Nenhum par PNG foi encontrado para comparação.');

const comparisons = [];
for (const file of files) {
  const baseline = await sharp(path.join(baselineDir, file)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const current = await sharp(path.join(currentDir, file)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (baseline.info.width !== current.info.width || baseline.info.height !== current.info.height) {
    comparisons.push({ file, comparable: false, baseline: baseline.info, current: current.info });
    continue;
  }
  let changedPixels = 0;
  let absoluteDifference = 0;
  const pixels = baseline.info.width * baseline.info.height;
  for (let index = 0; index < baseline.data.length; index += 3) {
    const difference = Math.max(
      Math.abs(baseline.data[index] - current.data[index]),
      Math.abs(baseline.data[index + 1] - current.data[index + 1]),
      Math.abs(baseline.data[index + 2] - current.data[index + 2]),
    );
    absoluteDifference += difference;
    if (difference > threshold) changedPixels += 1;
  }
  comparisons.push({
    file,
    comparable: true,
    width: baseline.info.width,
    height: baseline.info.height,
    threshold,
    changedPixels,
    changedPercent: Number(((changedPixels / pixels) * 100).toFixed(4)),
    meanMaxChannelDifference: Number((absoluteDifference / pixels).toFixed(4)),
  });
}

const report = { baselineDir, currentDir, generatedAt: new Date().toISOString(), comparisons };
fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${outputFile}\n`);
