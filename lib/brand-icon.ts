import brandIconsData from './generated/brand-icons-data.json';

interface BrandEntry {
  slug: string;
  title: string;
  hex: string;
}

// 'svg' = logo real (de simple-icons, vía BrandIcon). 'mono' = insignia de
// iniciales + color de marca, para marcas grandes que simple-icons ya no
// distribuye (Microsoft, LinkedIn, Amazon, Adobe… las retiraron de su
// paquete CC0 por sus propias normas de marca) — en vez de replicar el
// logo exacto por nuestra cuenta (el mismo motivo por el que las quitaron),
// se muestra una insignia de color reconocible con sus iniciales.
export type BrandMatch = { kind: 'svg'; slug: string; hex: string } | { kind: 'mono'; abbr: string; hex: string };

const MIN_LEN = 3;

const DIACRITICS = /[̀-ͯ]/g;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .replace(/[^a-z0-9]/g, '');
}

// Marcas grandes/comunes ausentes de simple-icons en esta versión.
const EXTRA_BRANDS: { names: string[]; abbr: string; hex: string }[] = [
  { names: ['outlook', 'microsoft outlook', 'hotmail'], abbr: 'Ou', hex: '#0078D4' },
  { names: ['office 365', 'microsoft 365', 'office'], abbr: 'O', hex: '#D83B01' },
  { names: ['word', 'microsoft word'], abbr: 'W', hex: '#2B579A' },
  { names: ['excel', 'microsoft excel'], abbr: 'X', hex: '#217346' },
  { names: ['powerpoint', 'microsoft powerpoint'], abbr: 'P', hex: '#B7472A' },
  { names: ['onedrive', 'microsoft onedrive'], abbr: 'Od', hex: '#0364B8' },
  { names: ['onenote', 'microsoft onenote'], abbr: 'On', hex: '#7719AA' },
  { names: ['microsoft teams'], abbr: 'Te', hex: '#6264A7' },
  { names: ['azure', 'microsoft azure'], abbr: 'Az', hex: '#0089D6' },
  { names: ['windows', 'microsoft windows'], abbr: 'Wi', hex: '#00A4EF' },
  { names: ['xbox'], abbr: 'Xb', hex: '#107C10' },
  { names: ['microsoft'], abbr: 'Ms', hex: '#5E5E5E' },
  { names: ['linkedin'], abbr: 'in', hex: '#0A66C2' },
  { names: ['amazon web services', 'aws'], abbr: 'AWS', hex: '#232F3E' },
  { names: ['amazon'], abbr: 'a', hex: '#FF9900' },
  { names: ['adobe photoshop', 'photoshop'], abbr: 'Ps', hex: '#31A8FF' },
  { names: ['adobe illustrator', 'illustrator'], abbr: 'Ai', hex: '#FF9A00' },
  { names: ['adobe premiere', 'premiere pro', 'premiere'], abbr: 'Pr', hex: '#9999FF' },
  { names: ['adobe acrobat', 'acrobat'], abbr: 'Ac', hex: '#EC1C24' },
  { names: ['adobe'], abbr: 'Ad', hex: '#FF0000' },
  { names: ['slack'], abbr: '#', hex: '#4A154B' },
  { names: ['yahoo'], abbr: 'Y!', hex: '#6001D2' },
  { names: ['disney+', 'disney plus', 'disney'], abbr: 'D+', hex: '#113CCF' },
  { names: ['nintendo'], abbr: 'N', hex: '#E60012' },
  { names: ['heroku'], abbr: 'H', hex: '#430098' },
  { names: ['chatgpt', 'openai'], abbr: 'AI', hex: '#10A37F' },
  { names: ['bing'], abbr: 'b', hex: '#008373' },
  { names: ['salesforce'], abbr: 'sf', hex: '#00A1E0' },
  { names: ['twilio'], abbr: 'Tw', hex: '#F22F46' },
  { names: ['sendgrid'], abbr: 'Sg', hex: '#1A82E2' },
  { names: ['cash app', 'cashapp'], abbr: '$', hex: '#00D632' },
  { names: ['myfitnesspal'], abbr: 'Mf', hex: '#0066CC' },
  { names: ['monday.com', 'monday'], abbr: 'M', hex: '#FF3D57' },
];

interface Entry {
  kind: 'svg' | 'mono';
  needle: string;
  slug?: string;
  abbr?: string;
  hex: string;
}

// Ordenado por longitud de nombre descendente: "Google Drive" debe ganarle
// a "Google" si ambos calzan como substring del nombre de la carpeta.
const entries: Entry[] = [
  ...(brandIconsData as BrandEntry[]).map(
    (d): Entry => ({ kind: 'svg', slug: d.slug, hex: `#${d.hex}`, needle: normalize(d.title) }),
  ),
  ...EXTRA_BRANDS.flatMap((b) =>
    b.names.map((name): Entry => ({ kind: 'mono', abbr: b.abbr, hex: b.hex, needle: normalize(name) })),
  ),
]
  .filter((e) => e.needle.length >= MIN_LEN)
  .sort((a, b) => b.needle.length - a.needle.length);

const cache = new Map<string, BrandMatch | null>();

// Busca si el nombre de una carpeta/item menciona una marca conocida (logo
// real de simple-icons, o insignia de color para las que ya no distribuye)
// para poder mostrarla en vez del icono/inicial genérico. Cachea por
// nombre exacto (case-insensitive).
export function matchBrandIcon(name: string): BrandMatch | null {
  const key = name.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key) ?? null;

  const normalized = normalize(key);
  let found: BrandMatch | null = null;
  if (normalized.length >= MIN_LEN) {
    for (const e of entries) {
      if (normalized.includes(e.needle)) {
        found = e.kind === 'svg' ? { kind: 'svg', slug: e.slug!, hex: e.hex } : { kind: 'mono', abbr: e.abbr!, hex: e.hex };
        break;
      }
    }
  }
  cache.set(key, found);
  return found;
}
