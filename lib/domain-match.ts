// Coincidencia entre la URL guardada en un acceso y la página abierta.
// Es la pieza más sensible de seguridad de la extensión (decide DÓNDE se puede
// rellenar una contraseña), así que es una función pura y está testeada.
//
// Decisiones (ver el ataque de "DOM-based extension clickjacking", 2025, en el
// que casi todos los gestores rellenaban también en subdominios):
//  · "exact": mismo host (ignorando "www."). Es lo único que se rellena sin
//    confirmación.
//  · "related": mismo dominio registrable pero distinto host (login.acme.com
//    frente a acme.com). Solo se ofrece, con confirmación explícita.
//  · Nada más. Nunca se rellena en http (salvo localhost) ni en iframes.

/** Hostname normalizado (minúsculas, sin "www."), o '' si la URL no es válida. */
export function hostOf(raw: string): string {
  const value = (raw ?? '').trim().split(/\s+/)[0] ?? '';
  if (!value) return '';
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`);
    return url.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  } catch {
    return '';
  }
}

/** Solo https (o http en localhost/127.0.0.1 para desarrollo). */
export function isFillablePage(pageUrl: string): boolean {
  try {
    const u = new URL(pageUrl);
    if (u.protocol === 'https:') return true;
    return u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

// Sufijos de segundo nivel frecuentes (co.uk, com.es…). No sustituye a la
// Public Suffix List completa; por eso "related" nunca rellena sin confirmar.
const SECOND_LEVEL = new Set(['co', 'com', 'org', 'net', 'gov', 'edu', 'ac', 'nom']);

/** Aproximación del dominio registrable (eTLD+1). */
export function registrableDomain(host: string): string {
  if (!host || /^\d+(\.\d+){3}$/.test(host) || host.includes(':')) return host; // IP
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  const tld = parts[parts.length - 1];
  const sld = parts[parts.length - 2];
  if (tld.length === 2 && SECOND_LEVEL.has(sld) && parts.length >= 3) return parts.slice(-3).join('.');
  return parts.slice(-2).join('.');
}

export type MatchKind = 'exact' | 'related';

export function matchKind(entryUrl: string, pageUrl: string): MatchKind | null {
  if (!isFillablePage(pageUrl)) return null;
  const entry = hostOf(entryUrl);
  const page = hostOf(pageUrl);
  if (!entry || !page) return null;
  if (entry === page) return 'exact';
  if (registrableDomain(entry) === registrableDomain(page)) return 'related';
  return null;
}
