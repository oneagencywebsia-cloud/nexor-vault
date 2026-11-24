import type { MatchKind } from '@/lib/domain-match';

/** Lo que se descifra de un acceso del vault (igual que en la web app). */
export interface VaultItem {
  id: string;
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  totpSecret?: string;
  updatedAt: string;
}

/** Lo que ve el popup: NUNCA incluye la contraseña ni el secreto TOTP. */
export interface ItemSummary {
  id: string;
  title: string;
  username: string;
  url: string;
  hasTotp: boolean;
  match: MatchKind | null;
}

export type Request =
  | { type: 'status' }
  | { type: 'unlock'; serverUrl: string; email: string; password: string }
  | { type: 'unlock-totp'; code: string }
  /** Desbloqueo local de una cuenta ya recordada: solo la master password. */
  | { type: 'unlock-local'; password: string }
  | { type: 'lock' }
  /** Cierra la sesión: olvida la cuenta, el token y el desbloqueo biométrico. */
  | { type: 'logout' }
  | { type: 'bio-info' }
  | { type: 'bio-enroll'; rpId: string; credId: string; prfSalt: string; prfOutput: string }
  | { type: 'bio-unlock'; prfOutput: string }
  | { type: 'bio-remove' }
  | { type: 'items'; pageUrl: string }
  | { type: 'secret'; id: string; field: 'username' | 'password' | 'totp' }
  | { type: 'fill'; id: string; tabId: number; allowRelated?: boolean };

export type Response =
  | { ok: true; [key: string]: unknown }
  | { ok: false; error: string };

export interface Status {
  unlocked: boolean;
  /** Hay una cuenta recordada en este navegador (no hace falta volver a iniciar sesión). */
  hasAccount: boolean;
  /** El desbloqueo con huella/Face ID/llave está activado. */
  bioEnrolled: boolean;
  email: string | null;
  serverUrl: string;
  pendingTotp: boolean;
}

// Se sustituye en la compilación con `--server=<url>` (para instalaciones propias).
declare const __DEFAULT_SERVER__: string | undefined;
export const DEFAULT_SERVER: string =
  typeof __DEFAULT_SERVER__ !== 'undefined' ? __DEFAULT_SERVER__ : 'https://software-nexor.p08ks6.easypanel.host';
/** Inactividad tras la que la extensión vuelve a bloquearse. */
export const AUTO_LOCK_MS = 10 * 60 * 1000;
