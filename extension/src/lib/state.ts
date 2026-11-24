// Estado de la extensión.
//  · chrome.storage.session: SOLO en memoria (se borra al cerrar el navegador y NO
//    se escribe en disco). Aquí vive la clave de la bóveda mientras está
//    desbloqueada. Solo la leen contextos de confianza (service worker y popup),
//    nunca un content script ni una página web.
//  · chrome.storage.local: lo que permite NO volver a iniciar sesión tras cerrar el
//    navegador: la cuenta (email, servidor, salt, token de sesión de larga
//    duración) y, si el usuario lo activa, la clave de la bóveda CIFRADA con su
//    huella/Face ID/llave (BioRecord). La clave de la bóveda en claro nunca se
//    guarda en disco.

import type { BioRecord } from '@/lib/biometric';
import { DEFAULT_SERVER } from './types';

export interface Account {
  email: string;
  serverUrl: string;
  salt: string;
  token: string;
}

export interface PendingLogin {
  pendingToken: string;
  vaultKey: string; // base64
  email: string;
  salt: string;
  serverUrl: string;
}

export interface SessionState {
  vaultKey?: string; // base64
  lockAt?: number;
  pending?: PendingLogin;
}

const SESSION_KEYS = ['vaultKey', 'lockAt', 'pending'] as const;

export async function getSession(): Promise<SessionState> {
  return (await chrome.storage.session.get([...SESSION_KEYS])) as SessionState;
}

export async function setSession(patch: Partial<SessionState>): Promise<void> {
  await chrome.storage.session.set(patch);
}

export async function clearSession(): Promise<void> {
  await chrome.storage.session.remove([...SESSION_KEYS]);
}

// ───────────── cuenta recordada (disco) ─────────────

export async function getAccount(): Promise<Account | null> {
  const { account } = (await chrome.storage.local.get('account')) as { account?: Account };
  return account?.token && account.email ? account : null;
}

export async function setAccount(account: Account): Promise<void> {
  await chrome.storage.local.set({ account });
}

export async function clearAccount(): Promise<void> {
  await chrome.storage.local.remove('account');
}

// ───────────── desbloqueo biométrico (disco, ya cifrado) ─────────────

export async function getBio(): Promise<BioRecord | null> {
  const { bio } = (await chrome.storage.local.get('bio')) as { bio?: BioRecord };
  return bio?.v === 1 ? bio : null;
}

export async function setBio(bio: BioRecord): Promise<void> {
  await chrome.storage.local.set({ bio });
}

export async function clearBio(): Promise<void> {
  await chrome.storage.local.remove('bio');
}

// ───────────── capturas pendientes (SOLO memoria) ─────────────
// Lo que el usuario acaba de enviar en un formulario, a la espera de confirmar que
// el login funcionó. Vive en storage.session (no toca el disco) y caduca en minutos.

export interface PendingCapture {
  url: string;
  host: string;
  username: string;
  password: string;
  kind: 'login' | 'register' | 'change';
  at: number;
}

export interface Offer extends PendingCapture {
  decision: 'new' | 'update' | 'same' | 'unknown';
  itemId?: string;
}

export interface UsernameStep {
  host: string;
  username: string;
  at: number;
}

type Bucket = 'captures' | 'offers' | 'steps';

async function readBucket<T>(name: Bucket): Promise<Record<string, T>> {
  const r = (await chrome.storage.session.get(name)) as Record<string, Record<string, T> | undefined>;
  return r[name] ?? {};
}

export async function getEntry<T>(name: Bucket, tabId: number): Promise<T | undefined> {
  return (await readBucket<T>(name))[String(tabId)];
}

export async function setEntry<T>(name: Bucket, tabId: number, value: T): Promise<void> {
  const b = await readBucket<T>(name);
  b[String(tabId)] = value;
  await chrome.storage.session.set({ [name]: b });
}

export async function deleteEntry(name: Bucket, tabId: number): Promise<void> {
  const b = await readBucket<unknown>(name);
  if (!(String(tabId) in b)) return;
  delete b[String(tabId)];
  await chrome.storage.session.set({ [name]: b });
}

/** Olvida todo lo capturado (al bloquear o cerrar sesión). */
export async function clearCaptures(): Promise<void> {
  await chrome.storage.session.remove(['captures', 'offers', 'steps']);
}

// ───────────── webs donde no ofrecer guardar (disco) ─────────────

export async function getNeverSave(): Promise<string[]> {
  const { neverSave } = (await chrome.storage.local.get('neverSave')) as { neverSave?: string[] };
  return Array.isArray(neverSave) ? neverSave : [];
}

export async function addNeverSave(host: string): Promise<void> {
  const list = await getNeverSave();
  if (!list.includes(host)) await chrome.storage.local.set({ neverSave: [...list, host].slice(-500) });
}

// ───────────── ajustes ─────────────

export async function getServerUrl(): Promise<string> {
  const account = await getAccount();
  if (account) return account.serverUrl;
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
