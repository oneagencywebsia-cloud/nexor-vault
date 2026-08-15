import brandIconsData from './generated/brand-icons-data.json';

interface BrandEntry {
  slug: string;
  title: string;
  hex: string;
}

interface BrandMatch {
  slug: string;
  hex: string;
}

const MIN_LEN = 3;

const DIACRITICS = /[̀-ͯ]/g;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .replace(/[^a-z0-9]/g, '');
}

// Ordenado por longitud de nombre descendente: "Google Drive" debe ganarle
// a "Google" si ambos calzan como substring del nombre de la carpeta.
const entries = (brandIconsData as BrandEntry[])
  .map((d) => ({ slug: d.slug, hex: `#${d.hex}`, needle: normalize(d.title) }))
  .filter((e) => e.needle.length >= MIN_LEN)
  .sort((a, b) => b.needle.length - a.needle.length);

const cache = new Map<string, BrandMatch | null>();

// Busca si el nombre de una carpeta menciona una marca conocida (de las
// ~3450 de simple-icons) para poder mostrar su logo real en vez del icono
// genérico de carpeta. Cachea por nombre exacto (case-insensitive).
export function matchBrandIcon(folderName: string): BrandMatch | null {
  const key = folderName.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key) ?? null;

  const normalized = normalize(key);
  let found: BrandMatch | null = null;
  if (normalized.length >= MIN_LEN) {
    for (const e of entries) {
      if (normalized.includes(e.needle)) {
        found = { slug: e.slug, hex: e.hex };
        break;
      }
    }
  }
  cache.set(key, found);
  return found;
}
