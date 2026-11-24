// Lógica pura (sin DOM ni APIs del navegador) del aviso "¿Guardar en Nexor?".
// Está aparte para poder testearla: decide QUÉ contraseña se captura de un
// formulario y si es un acceso nuevo, una actualización o uno ya guardado.

import { matchKind } from './domain-match';

export type CaptureKind = 'login' | 'register' | 'change';
export type CaptureDecision = 'new' | 'update' | 'same';

export interface PasswordFieldValue {
  value: string;
  autocomplete: string;
}

export const MAX_PASSWORD_LENGTH = 256;
export const MAX_USERNAME_LENGTH = 320;

/**
 * Elige la contraseña que el usuario acaba de enviar entre los campos de
 * contraseña visibles del formulario:
 *  · 1 campo                       → inicio de sesión
 *  · 2 iguales                     → registro (contraseña + confirmación)
 *  · 3 (actual, nueva, confirmar)  → cambio: se guarda la NUEVA
 *  · autocomplete="new-password"   → siempre manda sobre la posición
 */
export function pickPassword(fields: PasswordFieldValue[]): { password: string; kind: CaptureKind } | null {
  const filled = fields.filter((f) => f.value.length > 0);
  if (filled.length === 0) return null;

  const fresh = filled.filter((f) => /new-password/i.test(f.autocomplete));
  if (fresh.length > 0) {
    const kind: CaptureKind = filled.some((f) => /current-password/i.test(f.autocomplete)) ? 'change' : 'register';
    return valid(fresh[0].value, kind);
  }
  if (filled.length === 1) return valid(filled[0].value, 'login');
  if (filled.length === 2) {
    // Dos iguales: registro con confirmación. Distintas: la 1ª es la actual y la 2ª la nueva sin confirmar (raro) → se ignora por ambiguo.
    return filled[0].value === filled[1].value ? valid(filled[0].value, 'register') : null;
  }
  if (filled.length === 3 && filled[1].value === filled[2].value) return valid(filled[1].value, 'change');
  return null;
}

function valid(password: string, kind: CaptureKind): { password: string; kind: CaptureKind } | null {
  return password.length >= 1 && password.length <= MAX_PASSWORD_LENGTH ? { password, kind } : null;
}

export interface StoredLogin {
  id: string;
  url: string;
  username: string;
  password: string;
}

export interface CaptureInput {
  pageUrl: string;
  username: string;
  password: string;
}

/**
 * Compara lo capturado con los accesos guardados. Solo cuentan los del MISMO
 * host (coincidencia "exact"): un dominio relacionado no se considera el mismo acceso.
 *  · mismo usuario y misma contraseña → "same" (no se avisa)
 *  · mismo usuario, otra contraseña   → "update"
 *  · si no                            → "new"
 * Si el formulario no tiene usuario (p. ej. cambio de contraseña) y hay un único
 * acceso para esa web, se asume que es ese.
 */
export function classifyCapture(
  items: StoredLogin[],
  input: CaptureInput,
): { decision: CaptureDecision; itemId?: string } {
  const sameSite = items.filter((i) => matchKind(i.url, input.pageUrl) === 'exact');
  const user = input.username.trim().toLowerCase();

  let candidates = user ? sameSite.filter((i) => i.username.trim().toLowerCase() === user) : sameSite;
  if (!user && candidates.length !== 1) candidates = [];

  if (candidates.some((i) => i.password === input.password)) {
    return { decision: 'same', itemId: candidates.find((i) => i.password === input.password)!.id };
  }
  if (candidates.length > 0) return { decision: 'update', itemId: candidates[0].id };
  return { decision: 'new' };
}

/** Título legible a partir del host: "www.github.com" → "github.com". */
export function titleFromHost(host: string): string {
  return host.replace(/^www\./, '') || 'Nuevo acceso';
}
