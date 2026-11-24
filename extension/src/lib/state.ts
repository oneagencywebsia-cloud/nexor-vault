// Estado de la extensión.
//  · chrome.storage.session: solo en memoria (se borra al cerrar el navegador y
//    NO se escribe en disco). Aquí viven el token de sesión y la vault key.
//    Por defecto solo lo leen contextos de confianza (service worker y popup),
//    nunca un content script ni una página web.
//  · chrome.storage.local: solo ajustes no secretos (URL del servidor).

import { DEFAULT_SERVER } from './types';

export interface PendingLogin {
  pendingToken: string;
  vaultKey: string; // base64
  email: string;
}

export interface SessionState {
  token?: string;
  email?: string;
  vaultKey?: string; // base64
  lockAt?: number;
  pending?: PendingLogin;
}

const SESSION_KEYS = ['token', 'email', 'vaultKey', 'lockAt', 'pending'] as const;

export async function getSession(): Promise<SessionState> {
  return (await chrome.storage.session.get([...SESSION_KEYS])) as SessionState;
}

export async function setSession(patch: Partial<SessionState>): Promise<void> {
  await chrome.storage.session.set(patch);
}

export async function clearSession(): Promise<void> {
  await chrome.storage.session.remove([...SESSION_KEYS]);
}

export async function getServerUrl(): Promise<string> {
  const { serverUrl } = (await chrome.storage.local.get('serverUrl')) as { serverUrl?: string };
  return serverUrl || DEFAULT_SERVER;
}

export async function setServerUrl(url: string): Promise<void> {
  await chrome.storage.local.set({ serverUrl: url });
}

/** Acepta solo https (o http en localhost) y devuelve el origen sin barra final. */
export function normalizeServerUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new Error('La URL del servidor no es válida');
  }
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) {
    throw new Error('El servidor debe usar https://');
  }
  return u.origin;
}

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
