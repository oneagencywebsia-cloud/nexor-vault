// Copia los iconos de simple-icons (paquete instalado en node_modules) a
// public/brand-icons/ y genera un JSON recortado (slug/title/hex) para el
// matching por nombre de carpeta. Se ejecuta antes de dev/build (ver
// package.json) — nada de esto se commitea, se regenera siempre desde el
// paquete instalado, así que siempre está sincronizado con su versión.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const siRoot = path.resolve(root, 'node_modules/simple-icons');
const outIconsDir = path.resolve(root, 'public/brand-icons');
const outDataDir = path.resolve(root, 'lib/generated');

mkdirSync(outIconsDir, { recursive: true });
mkdirSync(outDataDir, { recursive: true });

// SVGs: se sirven como archivos estáticos e inline (fetch + dangerouslySetInnerHTML)
// para poder teñirlos con CSS `color`. simple-icons no trae fill por defecto,
// así que se inyecta fill="currentColor" en la raíz para que el <path> lo herede.
const iconsDir = path.join(siRoot, 'icons');
const files = readdirSync(iconsDir).filter((f) => f.endsWith('.svg'));
for (const file of files) {
  const raw = readFileSync(path.join(iconsDir, file), 'utf8');
  const patched = raw.includes('fill=') ? raw : raw.replace('<svg ', '<svg fill="currentColor" ');
  writeFileSync(path.join(outIconsDir, file), patched);
}

// Metadata recortada para hacer match por nombre de carpeta sin cargar los
// ~450KB completos de simple-icons.json (solo lo que hace falta en runtime).
const data = JSON.parse(readFileSync(path.join(siRoot, 'data/simple-icons.json'), 'utf8'));
const trimmed = data.map((d) => ({ slug: d.slug, title: d.title, hex: d.hex }));

// Marcas grandes que simple-icons ya no distribuye (Microsoft, LinkedIn,
// Amazon…) pero que sí siguen en Font Awesome Free Brands — se usa su logo
// real en vez de la insignia de iniciales. Se genera el SVG a partir de su
// definición JS (path + viewBox), igual que con simple-icons.
const faBrandsDir = path.resolve(root, 'node_modules/@fortawesome/free-brands-svg-icons');
const FA_EXTRAS = [
  { icon: 'faMicrosoft', slug: 'fa-microsoft', title: 'Microsoft', hex: '5E5E5E' },
  { icon: 'faLinkedin', slug: 'fa-linkedin', title: 'LinkedIn', hex: '0A66C2' },
  { icon: 'faAmazon', slug: 'fa-amazon', title: 'Amazon', hex: 'FF9900' },
  { icon: 'faSlack', slug: 'fa-slack', title: 'Slack', hex: '4A154B' },
  { icon: 'faWindows', slug: 'fa-windows', title: 'Windows', hex: '00A4EF' },
  { icon: 'faXbox', slug: 'fa-xbox', title: 'Xbox', hex: '107C10' },
  { icon: 'faYahoo', slug: 'fa-yahoo', title: 'Yahoo', hex: '6001D2' },
  { icon: 'faSalesforce', slug: 'fa-salesforce', title: 'Salesforce', hex: '00A1E0' },
  { icon: 'faOpenai', slug: 'fa-chatgpt', title: 'ChatGPT', hex: '10A37F' },
  { icon: 'faCashApp', slug: 'fa-cashapp', title: 'Cash App', hex: '00D632' },
];

let faCount = 0;
for (const { icon, slug, title, hex } of FA_EXTRAS) {
  try {
    const mod = await import(pathToFileURL(path.join(faBrandsDir, `${icon}.js`)).href);
    const [width, height, , , pathData] = mod.definition.icon;
    const paths = Array.isArray(pathData) ? pathData : [pathData];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" fill="currentColor">${paths.map((d) => `<path d="${d}"/>`).join('')}</svg>`;
    writeFileSync(path.join(outIconsDir, `${slug}.svg`), svg);
    trimmed.push({ slug, title, hex });
    faCount++;
  } catch {
    // icono no encontrado en esta versión de font-awesome — se omite, cae
    // al fallback de insignia de iniciales en lib/brand-icon.ts
  }
}

writeFileSync(path.join(outDataDir, 'brand-icons-data.json'), JSON.stringify(trimmed));

console.log(
  `brand-icons: ${files.length} SVGs de simple-icons + ${faCount} de Font Awesome copiados, ${trimmed.length} entradas de metadata generadas`,
);
