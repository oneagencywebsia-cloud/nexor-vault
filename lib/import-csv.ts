// Importación de contraseñas desde CSV de otros gestores.
// Todo corre en el navegador: el archivo nunca se envía al servidor en claro;
// cada item se cifra con la vault key antes de subirse (ver app/import).

export type ImportSource = 'bitwarden' | 'chrome' | 'firefox' | '1password' | 'lastpass' | 'keepass' | 'generic';

export const SOURCE_LABELS: Record<ImportSource, string> = {
  bitwarden: 'Bitwarden',
  chrome: 'Chrome / Edge / Brave',
  firefox: 'Firefox',
  '1password': '1Password',
  lastpass: 'LastPass',
  keepass: 'KeePass / KeePassXC',
  generic: 'CSV genérico',
};

export interface ImportedItem {
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  totpSecret?: string;
  /** Ruta de carpeta ("Trabajo/Clientes") o null si va sin carpeta. */
  folder: string | null;
}

export interface SkippedRow {
  line: number; // nº de fila en el archivo (cabecera = 1)
  reason: string;
}

export interface ParseResult {
  source: ImportSource;
  items: ImportedItem[];
  skipped: SkippedRow[];
  totalRows: number;
  warnings: string[];
}

export const MAX_ROWS = 5000;
export const MAX_BYTES = 5 * 1024 * 1024;

/** Analizador CSV (RFC 4180): comillas, comillas escapadas, saltos de línea dentro de campos, BOM, \r\n. */
export function parseCsv(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // descarta filas totalmente vacías (p. ej. salto de línea final)
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

const ALIASES = {
  title: ['name', 'title', 'account', 'account name', 'site', 'label'],
  url: ['url', 'login_uri', 'uri', 'website', 'web site', 'login url', 'hostname', 'address'],
  username: ['username', 'login_username', 'user', 'login', 'user name', 'email', 'login name'],
  password: ['password', 'login_password', 'pass', 'pwd'],
  notes: ['notes', 'note', 'extra', 'comments', 'comment', 'notesplain'],
  totp: ['totp', 'login_totp', 'otpauth', 'otp', 'one-time password', 'one time password', 'authenticator'],
  folder: ['folder', 'grouping', 'group', 'category', 'collection', 'vault'],
  type: ['type', 'item type'],
} as const;

type Field = keyof typeof ALIASES;

function buildColumnMap(headers: string[]): Partial<Record<Field, number>> {
  const lower = headers.map((h) => h.trim().toLowerCase());
  const map: Partial<Record<Field, number>> = {};
  (Object.keys(ALIASES) as Field[]).forEach((field) => {
    for (const alias of ALIASES[field]) {
      const idx = lower.indexOf(alias);
      if (idx !== -1) {
        map[field] = idx;
        break;
      }
    }
  });
  return map;
}

export function detectSource(headers: string[]): ImportSource {
  const h = new Set(headers.map((x) => x.trim().toLowerCase()));
  if (h.has('login_uri') && h.has('login_username')) return 'bitwarden';
  if (h.has('grouping') && h.has('extra')) return 'lastpass';
  if (h.has('httprealm') || h.has('formactionorigin')) return 'firefox';
  if (h.has('otpauth') || (h.has('title') && h.has('url') && h.has('type'))) return '1password';
  if (h.has('group') && h.has('title') && (h.has('url') || h.has('username'))) return 'keepass';
  if (h.has('name') && h.has('url') && h.has('username') && h.has('password')) return 'chrome';
  return 'generic';
}

/** Dominio normalizado (sin esquema ni "www."), o '' si no hay URL válida. */
export function normalizeDomain(raw: string): string {
  const value = raw.trim().split(/\s+/)[0] ?? '';
  if (!value) return '';
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`);
    return url.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return value.toLowerCase();
  }
}

/** Clave para detectar duplicados: dominio + usuario (sin distinguir mayúsculas). */
export function dedupeKey(item: Pick<ImportedItem, 'url' | 'username' | 'title'>): string {
  const domain = normalizeDomain(item.url) || item.title.trim().toLowerCase();
  return `${domain}|${item.username.trim().toLowerCase()}`;
}

/** Extrae el secreto base32 de un otpauth:// o de un valor ya en base32. Devuelve undefined si no es válido. */
export function extractTotpSecret(value: string): string | undefined {
  const v = value.trim();
  if (!v) return undefined;
  let secret = v;
  if (/^otpauth:\/\//i.test(v)) {
    try {
      secret = new URL(v).searchParams.get('secret') ?? '';
    } catch {
      return undefined;
    }
  }
  secret = secret.replace(/[\s-]/g, '').toUpperCase();
  return /^[A-Z2-7]{8,}=*$/.test(secret) ? secret : undefined;
}

function clean(value: string | undefined): string {
  return (value ?? '').replace(/\r/g, '').trim();
}

/** Convierte "A/B\\C" en "A/B/C" (como máximo 4 niveles). */
function normalizeFolder(raw: string): string | null {
  const parts = raw
    .split(/[\\/]/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 4);
  return parts.length ? parts.join('/') : null;
}

export function parseImport(text: string): ParseResult {
  const warnings: string[] = [];
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return { source: 'generic', items: [], skipped: [], totalRows: 0, warnings: ['El archivo está vacío o solo tiene la cabecera.'] };
  }

  const [headers, ...body] = rows;
  const source = detectSource(headers);
  const col = buildColumnMap(headers);

  if (col.password === undefined && col.username === undefined && col.totp === undefined) {
    return {
      source,
      items: [],
      skipped: [],
      totalRows: body.length,
      warnings: ['No reconozco las columnas. Necesito al menos una de: password, username o totp.'],
    };
  }

  let truncated = false;
  const dataRows = body.length > MAX_ROWS ? ((truncated = true), body.slice(0, MAX_ROWS)) : body;
  if (truncated) warnings.push(`Solo se leen las primeras ${MAX_ROWS} filas.`);

  const items: ImportedItem[] = [];
  const skipped: SkippedRow[] = [];
  let badTotp = 0;

  dataRows.forEach((r, i) => {
    const line = i + 2;
    const get = (f: Field) => (col[f] === undefined ? '' : clean(r[col[f] as number]));

    const type = get('type').toLowerCase();
    if (type && !['login', 'password', 'logins', 'website', 'web', ''].includes(type)) {
      skipped.push({ line, reason: `Tipo "${type}" no soportado (solo inicios de sesión)` });
      return;
    }

    const url = get('url').split('\n')[0].trim();
    const username = get('username');
    const password = get('password');
    const totpRaw = get('totp');
    const totpSecret = extractTotpSecret(totpRaw);
    if (totpRaw && !totpSecret) badTotp++;

    if (!password && !username && !totpSecret) {
      skipped.push({ line, reason: 'Fila sin usuario, contraseña ni 2FA' });
      return;
    }

    const title = get('title') || normalizeDomain(url) || username || '(sin título)';
    const item: ImportedItem = {
      title: title.slice(0, 200),
      username,
      password,
      url: url.slice(0, 2000),
      notes: get('notes').slice(0, 10000),
      folder: normalizeFolder(get('folder')),
    };
    if (totpSecret) item.totpSecret = totpSecret;
    items.push(item);
  });

  if (badTotp > 0) warnings.push(`${badTotp} código(s) 2FA con formato no válido se han ignorado.`);
  return { source, items, skipped, totalRows: body.length, warnings };
}

export type DuplicateKind = 'existing' | 'file' | null;

/**
 * Marca duplicados: contra lo que ya hay en la bóveda ("existing") y dentro
 * del propio archivo ("file", se conserva la primera aparición). Un duplicado
 * "exacto" (misma contraseña) se distingue de uno con contraseña distinta.
 */
export function markDuplicates(
  incoming: ImportedItem[],
  existing: Pick<ImportedItem, 'url' | 'username' | 'title' | 'password'>[],
): { item: ImportedItem; duplicate: DuplicateKind; samePassword: boolean }[] {
  const existingByKey = new Map<string, Set<string>>();
  for (const e of existing) {
    const key = dedupeKey(e);
    const set = existingByKey.get(key) ?? new Set<string>();
    set.add(e.password);
    existingByKey.set(key, set);
  }
  const seenInFile = new Set<string>();

  return incoming.map((item) => {
    const key = dedupeKey(item);
    const inVault = existingByKey.get(key);
    if (inVault) return { item, duplicate: 'existing' as const, samePassword: inVault.has(item.password) };
    if (seenInFile.has(key)) return { item, duplicate: 'file' as const, samePassword: false };
    seenInFile.add(key);
    return { item, duplicate: null, samePassword: false };
  });
}

/** Rutas de carpeta únicas, ordenadas para crear primero los padres ("A" antes que "A/B"). */
export function collectFolderPaths(items: ImportedItem[]): string[] {
  const paths = new Set<string>();
  for (const item of items) {
    if (!item.folder) continue;
    const parts = item.folder.split('/');
    for (let i = 1; i <= parts.length; i++) paths.add(parts.slice(0, i).join('/'));
  }
  return [...paths].sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));
}
