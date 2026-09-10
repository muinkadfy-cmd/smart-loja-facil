import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const inputDir = path.resolve(option('--input', 'qa-screenshots/desktop-premium/final-desktop/1366'));
const outputFile = path.resolve(option('--output', 'qa-screenshots/desktop-premium/contact-sheet.png'));
const title = option('--title', path.basename(inputDir));
const columns = Math.max(1, Number(option('--columns', '3')) || 3);
const tileWidth = Math.max(240, Number(option('--tile-width', '420')) || 420);
const gap = 18;
const headerHeight = 72;
const labelHeight = 32;

const files = fs.readdirSync(inputDir)
  .filter((file) => file.toLowerCase().endsWith('.png'))
  .sort((a, b) => a.localeCompare(b, 'pt-BR'));

if (!files.length) throw new Error(`Nenhuma captura PNG em ${inputDir}`);

const first = await sharp(path.join(inputDir, files[0])).metadata();
const tileImageHeight = Math.round(tileWidth * (first.height / first.width));
const tileHeight = tileImageHeight + labelHeight;
const rows = Math.ceil(files.length / columns);
const width = gap + (columns * (tileWidth + gap));
const height = headerHeight + gap + (rows * (tileHeight + gap));
const escapeXml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
}[char]));

const composites = [];
for (const [index, file] of files.entries()) {
  const left = gap + ((index % columns) * (tileWidth + gap));
  const top = headerHeight + gap + (Math.floor(index / columns) * (tileHeight + gap));
  const image = await sharp(path.join(inputDir, file))
    .resize({ width: tileWidth, height: tileImageHeight, fit: 'fill' })
    .png()
    .toBuffer();
  const label = Buffer.from(`<svg width="${tileWidth}" height="${labelHeight}">
    <rect width="100%" height="100%" fill="#10243a"/>
    <text x="12" y="21" font-family="Segoe UI,Arial,sans-serif" font-size="15" font-weight="700" fill="#ffffff">${escapeXml(path.parse(file).name)}</text>
  </svg>`);
  composites.push({ input: image, left, top });
  composites.push({ input: label, left, top: top + tileImageHeight });
}

const header = Buffer.from(`<svg width="${width}" height="${headerHeight}">
  <rect width="100%" height="100%" fill="#071a2f"/>
  <text x="${gap}" y="44" font-family="Segoe UI,Arial,sans-serif" font-size="27" font-weight="800" fill="#ffffff">${escapeXml(title)}</text>
</svg>`);

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
await sharp({ create: { width, height, channels: 3, background: '#dbe7f3' } })
  .composite([{ input: header, left: 0, top: 0 }, ...composites])
  .png()
  .toFile(outputFile);

process.stdout.write(`${outputFile}\n`);
