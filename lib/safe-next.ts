// Redirección tras login/desbloqueo (?next=/ruta). Solo se aceptan rutas
// internas: así nadie puede construir un enlace que, tras desbloquear, lleve a
// una web externa (open redirect).

export function safeNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return null;
  }
  // debe ser una ruta absoluta del propio sitio
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;
  if (/[\u0000-\u001f\\]/.test(value)) return null;
  // sin esquema escondido (p. ej. "/\t/evil.com" o "/%2F/evil.com" ya decodificado)
  if (/^\/+[a-z][a-z0-9+.-]*:/i.test(value)) return null;
  return value;
}
