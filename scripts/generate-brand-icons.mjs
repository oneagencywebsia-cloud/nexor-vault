// Copia los iconos de simple-icons (paquete instalado en node_modules) a
// public/brand-icons/ y genera un JSON recortado (slug/title/hex) para el
// matching por nombre de carpeta. Se ejecuta antes de dev/build (ver
// package.json) — nada de esto se commitea, se regenera siempre desde el
// paquete instalado, así que siempre está sincronizado con su versión.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
writeFileSync(path.join(outDataDir, 'brand-icons-data.json'), JSON.stringify(trimmed));

console.log(`brand-icons: ${files.length} SVGs copiados, ${trimmed.length} entradas de metadata generadas`);
