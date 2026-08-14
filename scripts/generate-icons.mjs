import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
mkdirSync(publicDir, { recursive: true });

// markScale: 0-1, fracción del canvas que ocupa la marca N (deja margen para
// el "safe zone" de iconos maskable de Android/PWA).
function iconSvg(size, { markScale = 0.62, rounded = true } = {}) {
  const r = rounded ? size * 0.22 : 0;
  const cx = size / 2;
  const mark = size * markScale;
  const off = (size - mark) / 2;
  const sw = mark * 0.145; // grosor de trazo proporcional
  const dotR = mark * 0.082;

  const x1 = off + mark * 0.14;
  const x2 = off + mark * 0.86;
  const yTop = off + mark * 0.14;
  const yBot = off + mark * 0.86;

  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${size}" y2="${size}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#12131c"/>
      <stop offset="1" stop-color="#0b0d10"/>
    </linearGradient>
    <radialGradient id="glow" cx="${cx}" cy="${cx}" r="${size * 0.55}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#6c5ce7" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#6c5ce7" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="mark" x1="${x1}" y1="${yTop}" x2="${x2}" y2="${yBot}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#8b7cf6"/>
      <stop offset="1" stop-color="#6c5ce7"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#bg)"/>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#glow)"/>
  <path d="M ${x1} ${yTop} L ${x1} ${yBot} M ${x1} ${yTop} L ${x2} ${yBot} M ${x2} ${yTop} L ${x2} ${yBot}"
        stroke="url(#mark)" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <circle cx="${x1}" cy="${yTop}" r="${dotR}" fill="#b8b3ff"/>
  <circle cx="${x2}" cy="${yBot}" r="${dotR}" fill="#b8b3ff"/>
</svg>`;
}

const targets = [
  { file: 'icon-192.png', size: 192, opts: { markScale: 0.62 } },
  { file: 'icon-512.png', size: 512, opts: { markScale: 0.62 } },
  { file: 'icon-512-maskable.png', size: 512, opts: { markScale: 0.44 } }, // más margen: safe zone maskable
  { file: 'apple-touch-icon.png', size: 180, opts: { markScale: 0.62, rounded: false } }, // iOS aplica su propio squircle
  { file: 'favicon-32.png', size: 32, opts: { markScale: 0.68 } },
];

for (const { file, size, opts } of targets) {
  const svg = iconSvg(size, opts);
  await sharp(Buffer.from(svg)).png().toFile(join(publicDir, file));
  console.log('generated', file);
}
