// Service worker (MV3). Es el único sitio que toca la vault key y la sesión.
// El popup pide cosas por mensajes y solo recibe lo mínimo; el content script
// (fill.js) se inyecta únicamente cuando el usuario lo pide y nunca guarda nada.

import { decryptJson, deriveAuthKey, deriveMasterKey, deriveVaultKey, hashAuthKey, type EncryptedBlob } from '@/lib/crypto';
import { generateTotpCode } from '@/lib/totp-client';
import { api, ApiError } from './lib/api';
import { hostOf, matchKind } from '@/lib/domain-match';
import { clearSession, fromBase64, getServerUrl, getSession, normalizeServerUrl, setServerUrl, setSession, toBase64 } from './lib/state';
import { AUTO_LOCK_MS, type ItemSummary, type Request, type Response, type Status, type VaultItem } from './lib/types';

const ALARM = 'nexor-autolock';
const CACHE_TTL_MS = 60_000;

let cache: { items: VaultItem[]; at: number } | null = null;

// ───────────── sesión ─────────────

async function isUnlocked(): Promise<boolean> {
  const s = await getSession();
  if (!s.token || !s.vaultKey) return false;
  if (s.lockAt && Date.now() > s.lockAt) {
    await lock();
    return false;
  }
  return true;
}

async function touch(): Promise<void> {
  await setSession({ lockAt: Date.now() + AUTO_LOCK_MS });
}

async function lock(): Promise<void> {
  cache = null;
  await clearSession();
  await chrome.alarms.clear(ALARM);
}

async function status(): Promise<Status> {
  const s = await getSession();
  return {
    unlocked: await isUnlocked(),
    email: s.email ?? s.pending?.email ?? null,
    serverUrl: await getServerUrl(),
    pendingTotp: !!s.pending,
  };
}

async function finishLogin(email: string, token: string, vaultKey: string): Promise<void> {
  cache = null;
  await setSession({ token, email, vaultKey, lockAt: Date.now() + AUTO_LOCK_MS, pending: undefined });
  await chrome.alarms.create(ALARM, { periodInMinutes: 1 });
}

async function unlock(serverUrlRaw: string, emailRaw: string, password: string): Promise<{ needsTotp: boolean }> {
  const serverUrl = normalizeServerUrl(serverUrlRaw);
  await setServerUrl(serverUrl);
  const email = emailRaw.toLowerCase().trim();
  if (!email || !password) throw new Error('Introduce tu email y tu master password');

  // Mismo protocolo que la web: salt → Argon2id → HKDF → hash de la authKey.
  const { salt } = await api<{ salt: string }>(serverUrl, `/api/auth/salt?email=${encodeURIComponent(email)}`);
  const masterKey = await deriveMasterKey(password, salt);
  const authKey = await deriveAuthKey(masterKey);
  const vaultKey = await deriveVaultKey(masterKey);
  const authHash = await hashAuthKey(authKey);
  masterKey.fill(0);
  authKey.fill(0);

  try {
    const data = await api<{ token?: string; requiresTotp?: boolean; pendingToken?: string }>(serverUrl, '/api/auth/login', {
      method: 'POST',
      body: { email, authHash },
    });
    if (data.requiresTotp && data.pendingToken) {
      await setSession({ pending: { pendingToken: data.pendingToken, vaultKey: toBase64(vaultKey), email } });
      return { needsTotp: true };
    }
    if (!data.token) throw new Error('Respuesta de login inesperada');
    await finishLogin(email, data.token, toBase64(vaultKey));
    return { needsTotp: false };
  } finally {
    vaultKey.fill(0);
  }
}

async function unlockTotp(code: string): Promise<void> {
  const s = await getSession();
  if (!s.pending) throw new Error('La sesión de verificación ha caducado. Vuelve a empezar.');
  const serverUrl = await getServerUrl();
  const data = await api<{ token?: string }>(serverUrl, '/api/auth/totp/verify-login', {
    method: 'POST',
    body: { pendingToken: s.pending.pendingToken, code: code.trim() },
  });
  if (!data.token) throw new Error('Respuesta de login inesperada');
  await finishLogin(s.pending.email, data.token, s.pending.vaultKey);
}

// ───────────── vault ─────────────

async function loadItems(force = false): Promise<VaultItem[]> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.items;
  const s = await getSession();
  if (!s.token || !s.vaultKey) throw new Error('Bloqueado');
  const serverUrl = await getServerUrl();
  const vaultKey = fromBase64(s.vaultKey);

  let raw: { id: string; encrypted_blob: string; updated_at: string }[];
  try {
    ({ items: raw } = await api<{ items: typeof raw }>(serverUrl, '/api/vault/items', { token: s.token }));
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      await lock();
      throw new Error('La sesión ha caducado. Vuelve a desbloquear.');
    }
    throw err;
  }

  const items: VaultItem[] = [];
  for (const r of raw) {
    try {
      const d = await decryptJson<Partial<VaultItem>>(vaultKey, JSON.parse(r.encrypted_blob) as EncryptedBlob);
      items.push({
        id: r.id,
        title: d.title || '(sin título)',
        username: d.username ?? '',
        password: d.password ?? '',
        url: d.url ?? '',
        notes: d.notes ?? '',
        totpSecret: d.totpSecret || undefined,
        updatedAt: r.updated_at,
      });
    } catch {
      /* no descifrable: se omite */
    }
  }
  vaultKey.fill(0);
  cache = { items, at: Date.now() };
  return items;
}

function summarize(items: VaultItem[], pageUrl: string): ItemSummary[] {
  const rank = { exact: 0, related: 1 } as const;
  return items
    .map<ItemSummary>((i) => ({
      id: i.id,
      title: i.title,
      username: i.username,
      url: i.url,
      hasTotp: !!i.totpSecret,
      match: pageUrl ? matchKind(i.url, pageUrl) : null,
    }))
    .sort((a, b) => {
      const ra = a.match ? rank[a.match] : 2;
      const rb = b.match ? rank[b.match] : 2;
      return ra - rb || a.title.localeCompare(b.title, 'es');
    });
}

async function secret(id: string, field: 'username' | 'password' | 'totp'): Promise<string> {
  const items = await loadItems();
  const item = items.find((i) => i.id === id);
  if (!item) throw new Error('Acceso no encontrado');
  if (field === 'username') return item.username;
  if (field === 'password') return item.password;
  if (!item.totpSecret) throw new Error('Este acceso no tiene 2FA');
  return (await generateTotpCode(item.totpSecret)).code;
}

// ───────────── relleno ─────────────

interface FillResult {
  username: boolean;
  password: boolean;
  totp: boolean;
  needsNextStep: boolean;
}

async function fillTab(id: string, tabId: number, allowRelated: boolean): Promise<FillResult> {
  const items = await loadItems();
  const item = items.find((i) => i.id === id);
  if (!item) throw new Error('Acceso no encontrado');

  // La URL de la pestaña la da el navegador (activeTab), no la página.
  const tab = await chrome.tabs.get(tabId);
  const pageUrl = tab.url ?? '';
  const kind = matchKind(item.url, pageUrl);
  if (!kind) throw new Error('Este acceso no corresponde a esta web. Por seguridad no se rellena.');
  if (kind === 'related' && !allowRelated) throw new Error('El dominio no es exactamente el guardado; confirma para rellenar.');

  let totp: string | undefined;
  if (item.totpSecret) {
    try {
      totp = (await generateTotpCode(item.totpSecret)).code;
    } catch {
      /* secreto inválido: se rellena sin 2FA */
    }
  }

  await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, files: ['fill.js'] });
  const result = (await chrome.tabs.sendMessage(
    tabId,
    {
      type: 'nexor-fill',
      expectedHost: hostOf(pageUrl),
      username: item.username,
      password: item.password,
      totp,
    },
    { frameId: 0 },
  )) as FillResult | undefined;
  await touch();
  if (!result) throw new Error('No se encontró ningún campo de inicio de sesión en esta página.');
  return result;
}

// ───────────── mensajes (solo desde páginas de la propia extensión) ─────────────

async function handle(req: Request): Promise<Response> {
  switch (req.type) {
    case 'status':
      return { ok: true, status: await status() };
    case 'unlock':
      return { ok: true, ...(await unlock(req.serverUrl, req.email, req.password)) };
    case 'unlock-totp':
      await unlockTotp(req.code);
      return { ok: true };
    case 'lock':
      await lock();
      return { ok: true };
  }

  // Todo lo demás exige sesión desbloqueada.
  if (!(await isUnlocked())) return { ok: false, error: 'locked' };
  await touch();

  switch (req.type) {
    case 'items':
      return { ok: true, items: summarize(await loadItems(), req.pageUrl) };
    case 'secret':
      return { ok: true, value: await secret(req.id, req.field) };
    case 'fill':
      return { ok: true, result: await fillTab(req.id, req.tabId, !!req.allowRelated) };
  }
}

chrome.runtime.onMessage.addListener((message: Request, sender, sendResponse) => {
  // Solo mensajes de páginas de la propia extensión (popup). Se rechaza
  // cualquier otro origen: un content script o una web tienen como sender.url
  // la de la página, nunca la de la extensión.
  const own = chrome.runtime.getURL('');
  if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(own)) {
    sendResponse({ ok: false, error: 'forbidden' } satisfies Response);
    return false;
  }
  handle(message)
    .then(sendResponse)
    .catch((err: unknown) => sendResponse({ ok: false, error: err instanceof Error ? err.message : 'Error inesperado' } satisfies Response));
  return true; // respuesta asíncrona
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM) return;
  const s = await getSession();
  if (!s.lockAt || Date.now() > s.lockAt) await lock();
});

// Atajo de teclado: rellena si hay exactamente un acceso que coincide con la web.
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'fill-login') return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) return;
    if (!(await isUnlocked())) throw new Error('locked');
    const exact = summarize(await loadItems(), tab.url).filter((i) => i.match === 'exact');
    if (exact.length === 1) {
      await fillTab(exact[0].id, tab.id, false);
      await chrome.action.setBadgeText({ tabId: tab.id, text: '' });
      return;
    }
    throw new Error('ambiguous');
  } catch {
    // 0 o varios candidatos, o bloqueado: que elija el usuario en el popup.
    try {
      await chrome.action.openPopup();
    } catch {
      /* algunos navegadores no permiten abrirlo desde un atajo */
    }
  }
});
