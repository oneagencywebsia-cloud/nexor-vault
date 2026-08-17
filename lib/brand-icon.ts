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
  { names: ['amazon web services', 'aws'], abbr: 'AWS', hex: '#232F3E' },
  { names: ['adobe photoshop', 'photoshop'], abbr: 'Ps', hex: '#31A8FF' },
  { names: ['adobe illustrator', 'illustrator'], abbr: 'Ai', hex: '#FF9A00' },
  { names: ['adobe premiere', 'premiere pro', 'premiere'], abbr: 'Pr', hex: '#9999FF' },
  { names: ['adobe acrobat', 'acrobat'], abbr: 'Ac', hex: '#EC1C24' },
  { names: ['adobe'], abbr: 'Ad', hex: '#FF0000' },
  { names: ['disney+', 'disney plus', 'disney'], abbr: 'D+', hex: '#113CCF' },
  { names: ['nintendo'], abbr: 'N', hex: '#E60012' },
  { names: ['heroku'], abbr: 'H', hex: '#430098' },
  { names: ['bing'], abbr: 'b', hex: '#008373' },
  { names: ['twilio'], abbr: 'Tw', hex: '#F22F46' },
  { names: ['sendgrid'], abbr: 'Sg', hex: '#1A82E2' },
  { names: ['myfitnesspal'], abbr: 'Mf', hex: '#0066CC' },
  { names: ['monday.com', 'monday'], abbr: 'M', hex: '#FF3D57' },

  // Streaming / gaming
  { names: ['peacock'], abbr: 'Pe', hex: '#7857FF' },
  { names: ['prime video', 'amazon prime video'], abbr: 'PV', hex: '#1FA8DC' },
  { names: ['blizzard', 'battle.net'], abbr: 'Bl', hex: '#00AEFF' },
  { names: ['epic games store', 'epic games'], abbr: 'EG', hex: '#313131' },

  // Banca España + internacional
  { names: ['santander'], abbr: 'Sa', hex: '#EC0000' },
  { names: ['bbva'], abbr: 'BBVA', hex: '#072146' },
  { names: ['bankinter'], abbr: 'Bk', hex: '#FF6600' },
  { names: ['sabadell', 'banco sabadell'], abbr: 'Sb', hex: '#0085CA' },
  { names: ['unicaja'], abbr: 'Un', hex: '#E30613' },
  { names: ['kutxabank'], abbr: 'Ku', hex: '#E2001A' },
  { names: ['abanca'], abbr: 'Ab', hex: '#00549F' },
  { names: ['openbank'], abbr: 'Op', hex: '#FF6D00' },
  { names: ['imaginbank', 'imagin'], abbr: 'im', hex: '#F6A100' },
  { names: ['chase'], abbr: 'Ch', hex: '#117ACA' },
  { names: ['wells fargo'], abbr: 'WF', hex: '#D71E28' },
  { names: ['bank of america'], abbr: 'BofA', hex: '#012169' },
  { names: ['citibank'], abbr: 'Ci', hex: '#003B70' },
  { names: ['hsbc'], abbr: 'HS', hex: '#DB0011' },
  { names: ['barclays'], abbr: 'Ba', hex: '#00AEEF' },
  { names: ['affirm'], abbr: 'Af', hex: '#4A4AF4' },
  { names: ['cetelem'], abbr: 'Ce', hex: '#E2001A' },
  { names: ['cofidis'], abbr: 'Cf', hex: '#6600CC' },

  // Cripto / wallets
  { names: ['metamask'], abbr: 'Mm', hex: '#F6851B' },
  { names: ['trust wallet'], abbr: 'TW', hex: '#3375BB' },

  // Paquetería / logística (España)
  { names: ['correos'], abbr: 'Co', hex: '#FFD200' },
  { names: ['seur'], abbr: 'Se', hex: '#E4032E' },
  { names: ['gls'], abbr: 'GLS', hex: '#4B0082' },

  // Telecom (España)
  { names: ['yoigo'], abbr: 'Yo', hex: '#6F2C91' },
  { names: ['t-mobile', 'tmobile'], abbr: 'TM', hex: '#E20074' },
  { names: ['pepephone'], abbr: 'Pp', hex: '#E30613' },
  { names: ['digimobil', 'digi mobil'], abbr: 'Di', hex: '#E4032E' },
  { names: ['lowi'], abbr: 'Lo', hex: '#00BFFF' },
  { names: ['simyo'], abbr: 'Si', hex: '#FF6600' },
  { names: ['jazztel'], abbr: 'Ja', hex: '#F39200' },
  { names: ['euskaltel'], abbr: 'Eu', hex: '#00A650' },

  // Inmobiliarias / marketplaces (España)
  { names: ['wallapop'], abbr: 'Wa', hex: '#00C298' },
  { names: ['idealista'], abbr: 'Id', hex: '#6ABF4B' },
  { names: ['fotocasa'], abbr: 'Fo', hex: '#7CB342' },
  { names: ['mercado libre', 'mercadolibre'], abbr: 'ML', hex: '#FFE600' },
  { names: ['vueling'], abbr: 'Vu', hex: '#FFD400' },

  // Energía (España)
  { names: ['endesa'], abbr: 'En', hex: '#00A9E0' },
  { names: ['iberdrola'], abbr: 'Ib', hex: '#00A03C' },
  { names: ['naturgy'], abbr: 'Na', hex: '#0077C8' },

  // Enterprise / dev tools
  { names: ['oracle'], abbr: 'Or', hex: '#F80000' },
  { names: ['ibm'], abbr: 'IBM', hex: '#052FAD' },
  { names: ['servicenow'], abbr: 'SN', hex: '#62D84E' },
  { names: ['workday'], abbr: 'Wo', hex: '#F79320' },
  { names: ['freshdesk'], abbr: 'Fr', hex: '#25C16F' },
  { names: ['docusign'], abbr: 'Ds', hex: '#FFCC22' },
  { names: ['invision'], abbr: 'Iv', hex: '#FF3366' },
  { names: ['linode'], abbr: 'Li', hex: '#00A95C' },
  { names: ['bluehost'], abbr: 'Bh', hex: '#2A9FD6' },
  { names: ['siteground'], abbr: 'St', hex: '#EE3A43' },

  // Salud / fitness
  { names: ['samsung health'], abbr: 'SH', hex: '#1428A0' },

  // VPN
  { names: ['tunnelbear'], abbr: 'Tb', hex: '#F4A93E' },

  // Vídeo / edición
  { names: ['capcut'], abbr: 'Cc', hex: '#00F5D4' },
  { names: ['final cut pro', 'final cut'], abbr: 'FC', hex: '#E30B5C' },
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
