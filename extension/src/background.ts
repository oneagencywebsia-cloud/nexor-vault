// Service worker (MV3). Es el único sitio que toca la clave de la bóveda y la sesión.
// El popup pide cosas por mensajes y solo recibe lo mínimo; el content script
// (fill.js) se inyecta únicamente cuando el usuario lo pide y nunca guarda nada.
//
// Persistencia entre reinicios del navegador:
//  · Se recuerda la CUENTA (email, servidor, salt, token de sesión de larga duración).
//    Tras reiniciar solo hay que DESBLOQUEAR (master password o huella/Face ID/llave),
//    no volver a iniciar sesión.
//  · La clave de la bóveda nunca se guarda en claro: vive en memoria (storage.session)
//    o, si el usuario activa el desbloqueo biométrico, cifrada con la salida PRF de su
//    autenticador (ver lib/biometric.ts).

import { decryptJson, deriveAuthKey, deriveMasterKey, deriveVaultKey, encryptJson, hashAuthKey, type EncryptedBlob } from '@/lib/crypto';
import { classifyCapture, MAX_PASSWORD_LENGTH, MAX_USERNAME_LENGTH, titleFromHost, type CaptureKind } from '@/lib/capture-logic';
import { fromB64 as bioFromB64, unwrapVaultKey, wrapVaultKey } from '@/lib/biometric';
import { generateTotpCode } from '@/lib/totp-client';
import { hostOf, isFillablePage, matchKind, registrableDomain } from '@/lib/domain-match';
import { api, ApiError } from './lib/api';
import {
  addNeverSave,
  clearAccount,
  clearBio,
  clearCaptures,
  clearSession,
  deleteEntry,
  fromBase64,
  getEntry,
  getNeverSave,
  setEntry,
  type Offer,
  type PendingCapture,
  type UsernameStep,
  getAccount,
  getBio,
  getServerUrl,
  getSession,
  normalizeServerUrl,
  setAccount,
  setBio,
  setServerUrl,
  setSession,
  toBase64,
  type Account,
} from './lib/state';
import { AUTO_LOCK_MS, CAPTURE_ORIGINS, type CaptureOffer, type ItemSummary, type Request, type Response, type Status, type VaultItem } from './lib/types';

const ALARM = 'nexor-autolock';
const CACHE_TTL_MS = 60_000;

let cache: { items: VaultItem[]; at: number } | null = null;

// ───────────── sesión ─────────────

async function isUnlocked(): Promise<boolean> {
  const [account, s] = await Promise.all([getAccount(), getSession()]);
  if (!account || !s.vaultKey) return false;
  if (s.lockAt && Date.now() > s.lockAt) {
    await lock();
    return false;
  }
  return true;
}

async function touch(): Promise<void> {
  await setSession({ lockAt: Date.now() + AUTO_LOCK_MS });
}

/** Bloquea: olvida la clave de la bóveda, pero RECUERDA la cuenta (para desbloquear sin volver a iniciar sesión). */
async function lock(): Promise<void> {
  cache = null;
  await clearSession();
  await clearCaptures();
  await chrome.alarms.clear(ALARM);
}

/** Cierra la sesión del todo: olvida cuenta, token y desbloqueo biométrico. */
async function logout(): Promise<void> {
  await lock();
  await clearAccount();
  await clearBio();
}

async function status(): Promise<Status> {
  const [account, s, bio] = await Promise.all([getAccount(), getSession(), getBio()]);
  return {
    unlocked: await isUnlocked(),
    hasAccount: !!account,
    bioEnrolled: !!bio && !!account,
    email: account?.email ?? s.pending?.email ?? null,
    serverUrl: await getServerUrl(),
    pendingTotp: !!s.pending,
    captureEnabled: await captureEnabled(),
  };
}

async function startUnlockedSession(vaultKeyB64: string): Promise<void> {
  cache = null;
  await setSession({ vaultKey: vaultKeyB64, lockAt: Date.now() + AUTO_LOCK_MS, pending: undefined });
  await chrome.alarms.create(ALARM, { periodInMinutes: 1 });
}

async function finishLogin(account: Account, vaultKeyB64: string): Promise<void> {
  const previous = await getAccount();
  // Otra cuenta: el desbloqueo biométrico anterior ya no corresponde.
  if (previous && previous.email !== account.email) await clearBio();
  await setAccount(account);
  await startUnlockedSession(vaultKeyB64);
  void syncCaptureScript();
}

// ───────────── login completo (primera vez, o sesión caducada) ─────────────

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
      // client: 'extension' → el servidor emite un token de larga duración (14 días).
      body: { email, authHash, client: 'extension' },
    });
    if (data.requiresTotp && data.pendingToken) {
      await setSession({ pending: { pendingToken: data.pendingToken, vaultKey: toBase64(vaultKey), email, salt, serverUrl } });
      return { needsTotp: true };
    }
    if (!data.token) throw new Error('Respuesta de login inesperada');
    await finishLogin({ email, serverUrl, salt, token: data.token }, toBase64(vaultKey));
    return { needsTotp: false };
  } finally {
    vaultKey.fill(0);
  }
}

async function unlockTotp(code: string): Promise<void> {
  const s = await getSession();
  if (!s.pending) throw new Error('La sesión de verificación ha caducado. Vuelve a empezar.');
  const { pending } = s;
  const data = await api<{ token?: string }>(pending.serverUrl, '/api/auth/totp/verify-login', {
    method: 'POST',
    body: { pendingToken: pending.pendingToken, code: code.trim(), client: 'extension' },
  });
  if (!data.token) throw new Error('Respuesta de login inesperada');
  await finishLogin({ email: pending.email, serverUrl: pending.serverUrl, salt: pending.salt, token: data.token }, pending.vaultKey);
}

// ───────────── desbloqueo local (cuenta ya recordada) ─────────────

async function unlockLocal(password: string): Promise<{ needsTotp: boolean }> {
  const account = await getAccount();
  if (!account) throw new Error('No hay ninguna cuenta guardada. Inicia sesión.');
  if (!password) throw new Error('Introduce tu master password');

  const masterKey = await deriveMasterKey(password, account.salt);
  const authKey = await deriveAuthKey(masterKey);
  const vaultKey = await deriveVaultKey(masterKey);
  const authHash = await hashAuthKey(authKey);
  masterKey.fill(0);
  authKey.fill(0);

  try {
    // El servidor confirma que la master password es la correcta (sin pedir 2FA otra vez: la sesión ya está autenticada).
    await api(account.serverUrl, '/api/auth/verify', { method: 'POST', body: { authHash }, token: account.token });
  } catch (err) {
    vaultKey.fill(0);
    if (err instanceof ApiError && err.status === 401) {
      // "Master password incorrecto" → contraseña mala; cualquier otro 401 → el token de sesión caducó.
      if (/master password/i.test(err.message)) throw new Error('Master password incorrecta');
      return unlock(account.serverUrl, account.email, password); // login completo transparente (puede pedir 2FA)
    }
    throw err;
  }

  await startUnlockedSession(toBase64(vaultKey));
  vaultKey.fill(0);
  return { needsTotp: false };
}

// ───────────── desbloqueo biométrico ─────────────

async function bioInfo(): Promise<{ enrolled: boolean; rpId?: string; credId?: string; prfSalt?: string }> {
  const [bio, account] = await Promise.all([getBio(), getAccount()]);
  if (!bio || !account) return { enrolled: false };
  return { enrolled: true, rpId: bio.rpId, credId: bio.credId, prfSalt: bio.prfSalt };
}

async function bioEnroll(req: { rpId: string; credId: string; prfSalt: string; prfOutput: string }): Promise<void> {
  const s = await getSession();
  if (!s.vaultKey) throw new Error('locked');
  const vaultKey = fromBase64(s.vaultKey);
  const record = await wrapVaultKey(bioFromB64(req.prfOutput), vaultKey, { rpId: req.rpId, credId: req.credId, prfSalt: req.prfSalt });
  vaultKey.fill(0);
  await setBio(record);
}

async function bioUnlock(prfOutput: string): Promise<void> {
  const [bio, account] = await Promise.all([getBio(), getAccount()]);
  if (!bio || !account) throw new Error('El desbloqueo biométrico no está activado.');
  const vaultKey = await unwrapVaultKey(bioFromB64(prfOutput), bio);
  await startUnlockedSession(toBase64(vaultKey));
  vaultKey.fill(0);
}

// ───────────── vault ─────────────

async function loadItems(force = false): Promise<VaultItem[]> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.items;
  const [account, s] = await Promise.all([getAccount(), getSession()]);
  if (!account || !s.vaultKey) throw new Error('Bloqueado');
  const vaultKey = fromBase64(s.vaultKey);

  let raw: { id: string; encrypted_blob: string; folder_id: string | null; updated_at: string }[];
  try {
    ({ items: raw } = await api<{ items: typeof raw }>(account.serverUrl, '/api/vault/items', { token: account.token }));
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      // El token de sesión caducó (14 días): se bloquea y la próxima vez que se desbloquee
      // con la master password se hace un login completo de forma transparente.
      await lock();
      throw new Error('La sesión ha caducado. Desbloquea con tu master password para continuar.');
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
        folderId: r.folder_id ?? null,
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

// ───────────── captura: "¿Guardar en Nexor?" ─────────────
// Opt-in: solo funciona si el usuario concede el permiso opcional de sitios web.
// El aviso NO se dibuja en la página: se muestra en el popup (y un "+" en el icono),
// de modo que ninguna web puede tapar, imitar ni pulsar el botón de guardar.

const CAPTURE_SCRIPT_ID = 'nexor-capture';
const CAPTURE_TTL_MS = 60_000; // desde el envío hasta confirmar que el login funcionó
const STEP_TTL_MS = 5 * 60_000; // usuario del primer paso de un login en dos pasos
const OFFER_TTL_MS = 10 * 60_000; // cuánto tiempo sigue disponible el aviso

async function captureEnabled(): Promise<boolean> {
  try {
    return await chrome.permissions.contains({ origins: CAPTURE_ORIGINS });
  } catch {
    return false;
  }
}

/** Registra (o retira) el script de captura según el permiso concedido. Nunca se ejecuta en el propio servidor de Nexor. */
async function syncCaptureScript(): Promise<void> {
  try {
    const enabled = await captureEnabled();
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [CAPTURE_SCRIPT_ID] });
    if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: [CAPTURE_SCRIPT_ID] });
    if (!enabled) return;
    const server = new URL(await getServerUrl());
    await chrome.scripting.registerContentScripts([
      {
        id: CAPTURE_SCRIPT_ID,
        js: ['capture.js'],
        matches: CAPTURE_ORIGINS,
        // Los patrones no admiten puerto: se excluye el host del servidor de Nexor (no capturar la master password).
        excludeMatches: [`${server.protocol}//${server.hostname}/*`],
        runAt: 'document_idle',
        allFrames: false,
        persistAcrossSessions: true,
      },
    ]);
  } catch {
    /* sin permiso o navegador sin soporte: la función queda desactivada */
  }
}

function clearBadge(tabId: number): void {
  void chrome.action.setBadgeText({ tabId, text: '' }).catch(() => undefined);
}

async function resolveOffer(offer: Offer): Promise<Offer | null> {
  if (offer.decision !== 'unknown') return offer;
  const items = await loadItems();
  const r = classifyCapture(items, { pageUrl: offer.url, username: offer.username, password: offer.password });
  if (r.decision === 'same') return null;
  return { ...offer, decision: r.decision, itemId: r.itemId };
}

async function makeOffer(tabId: number, cap: PendingCapture): Promise<void> {
  await deleteEntry('captures', tabId);
  let offer: Offer = { ...cap, decision: 'unknown', at: Date.now() };
  if (await isUnlocked()) {
    try {
      const resolved = await resolveOffer(offer);
      if (!resolved) return; // ya estaba guardado tal cual: no se avisa
      offer = resolved;
    } catch {
      /* sin red: se decide al abrir el popup */
    }
  }
  await setEntry('offers', tabId, offer);
  await chrome.action.setBadgeBackgroundColor({ tabId, color: '#6c5ce7' }).catch(() => undefined);
  await chrome.action.setBadgeText({ tabId, text: '+' }).catch(() => undefined);
  try {
    await chrome.action.openPopup(); // mejor esfuerzo: algunos navegadores no lo permiten
  } catch {
    /* el "+" del icono avisa igualmente */
  }
}

const KINDS: CaptureKind[] = ['login', 'register', 'change'];

/** Mensajes de los content scripts (la página nunca puede enviarlos). Solo se confía en la URL que da el navegador. */
async function handleContent(msg: Record<string, unknown>, sender: chrome.runtime.MessageSender): Promise<void> {
  const tabId = sender.tab?.id;
  const url = sender.url ?? sender.tab?.url ?? '';
  if (tabId === undefined || sender.frameId !== 0 || !isFillablePage(url)) return;
  if (!(await captureEnabled())) return;

  const host = hostOf(url);
  if (!host || host === hostOf(await getServerUrl())) return;
  if ((await getNeverSave()).includes(host)) return;
  const now = Date.now();

  switch (msg.type) {
    case 'nexor-username-step': {
      const username = String(msg.username ?? '').slice(0, MAX_USERNAME_LENGTH);
      if (username) await setEntry<UsernameStep>('steps', tabId, { host, username, at: now });
      return;
    }
    case 'nexor-capture': {
      const password = typeof msg.password === 'string' ? msg.password : '';
      if (!password || password.length > MAX_PASSWORD_LENGTH) return;
      let username = typeof msg.username === 'string' ? msg.username.trim().slice(0, MAX_USERNAME_LENGTH) : '';
      if (!username) {
        const step = await getEntry<UsernameStep>('steps', tabId);
        if (step && now - step.at < STEP_TTL_MS && registrableDomain(step.host) === registrableDomain(host)) username = step.username;
      }
      const kind = KINDS.includes(msg.kind as CaptureKind) ? (msg.kind as CaptureKind) : 'login';
      await setEntry<PendingCapture>('captures', tabId, { url, host, username, password, kind, at: now });
      return;
    }
    case 'nexor-login-ok': {
      const cap = await getEntry<PendingCapture>('captures', tabId);
      if (cap && cap.host === host && now - cap.at < CAPTURE_TTL_MS) await makeOffer(tabId, cap);
      return;
    }
    case 'nexor-page-state': {
      const cap = await getEntry<PendingCapture>('captures', tabId);
      if (!cap) return;
      if (now - cap.at > CAPTURE_TTL_MS) return void (await deleteEntry('captures', tabId));
      if (registrableDomain(cap.host) !== registrableDomain(host)) return; // redirección intermedia (SSO)
      // Sigue habiendo campo de contraseña: el login falló (o falta otro paso) → no se ofrece nada.
      if (msg.hasPassword) return void (await deleteEntry('captures', tabId));
      await makeOffer(tabId, cap);
      return;
    }
  }
}

async function liveOffer(tabId: number): Promise<Offer | null> {
  const offer = await getEntry<Offer>('offers', tabId);
  if (!offer) return null;
  if (Date.now() - offer.at > OFFER_TTL_MS) {
    await deleteEntry('offers', tabId);
    clearBadge(tabId);
    return null;
  }
  const resolved = await resolveOffer(offer);
  if (!resolved) {
    await deleteEntry('offers', tabId);
    clearBadge(tabId);
    return null;
  }
  return resolved;
}

async function captureGet(tabId: number): Promise<CaptureOffer | null> {
  const offer = await liveOffer(tabId);
  if (!offer || offer.decision === 'same' || offer.decision === 'unknown') return null;
  const existing = offer.itemId ? (await loadItems()).find((i) => i.id === offer.itemId) : undefined;
  return {
    host: offer.host,
    username: offer.username,
    decision: offer.decision,
    title: existing?.title ?? titleFromHost(offer.host),
  };
}

async function captureSave(tabId: number): Promise<void> {
  const offer = await liveOffer(tabId);
  if (!offer || offer.decision === 'same' || offer.decision === 'unknown') throw new Error('Ya no hay nada que guardar.');
  const [account, s] = await Promise.all([getAccount(), getSession()]);
  if (!account || !s.vaultKey) throw new Error('Bloqueado');
  const vaultKey = fromBase64(s.vaultKey);

  try {
    if (offer.decision === 'update' && offer.itemId) {
      const item = (await loadItems()).find((i) => i.id === offer.itemId);
      if (!item) throw new Error('El acceso ya no existe.');
      const encryptedBlob = await encryptJson(vaultKey, {
        title: item.title,
        username: item.username,
        password: offer.password,
        url: item.url,
        notes: item.notes,
        totpSecret: item.totpSecret ?? '',
      });
      await api(account.serverUrl, `/api/vault/items/${item.id}`, {
        method: 'PUT',
        body: { encryptedBlob, folderId: item.folderId, itemType: 'login' },
        token: account.token,
      });
    } else {
      const encryptedBlob = await encryptJson(vaultKey, {
        title: titleFromHost(offer.host),
        username: offer.username,
        password: offer.password,
        url: new URL(offer.url).origin,
        notes: '',
        totpSecret: '',
      });
      await api(account.serverUrl, '/api/vault/items', { method: 'POST', body: { itemType: 'login', encryptedBlob }, token: account.token });
    }
  } finally {
    vaultKey.fill(0);
  }
  cache = null;
  await deleteEntry('offers', tabId);
  clearBadge(tabId);
}

async function captureDismiss(tabId: number, never: boolean): Promise<void> {
  const offer = await getEntry<Offer>('offers', tabId);
  if (offer && never) await addNeverSave(offer.host);
  await deleteEntry('offers', tabId);
  clearBadge(tabId);
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
    case 'unlock-local':
      return { ok: true, ...(await unlockLocal(req.password)) };
    case 'bio-info':
      return { ok: true, ...(await bioInfo()) };
    case 'bio-unlock':
      await bioUnlock(req.prfOutput);
      return { ok: true };
    case 'lock':
      await lock();
      return { ok: true };
    case 'logout':
      await logout();
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
    case 'bio-enroll':
      await bioEnroll(req);
      return { ok: true };
    case 'bio-remove':
      await clearBio();
      return { ok: true };
    case 'capture-get':
      return { ok: true, offer: await captureGet(req.tabId) };
    case 'capture-save':
      await captureSave(req.tabId);
      return { ok: true };
    case 'capture-dismiss':
      await captureDismiss(req.tabId, !!req.never);
      return { ok: true };
  }
}

chrome.runtime.onMessage.addListener((message: Request, sender, sendResponse) => {
  // Solo mensajes de páginas de la propia extensión (popup o ventana de verificación).
  // Se rechaza cualquier otro origen: un content script o una web tienen como
  // sender.url la de la página, nunca la de la extensión.
  const own = chrome.runtime.getURL('');
  if (sender.id !== chrome.runtime.id) {
    sendResponse({ ok: false, error: 'forbidden' } satisfies Response);
    return false;
  }
  if (!sender.url?.startsWith(own)) {
    // Content script de captura (solo mensajes "nexor-*", solo con pestaña): nunca recibe datos de vuelta.
    const type = (message as { type?: unknown })?.type;
    if (sender.tab && typeof type === 'string' && type.startsWith('nexor-')) {
      void handleContent(message as unknown as Record<string, unknown>, sender).catch(() => undefined);
      sendResponse({ ok: true } satisfies Response);
    } else {
      sendResponse({ ok: false, error: 'forbidden' } satisfies Response);
    }
    return false;
  }
  handle(message)
    .then(sendResponse)
    .catch((err: unknown) => sendResponse({ ok: false, error: err instanceof Error ? err.message : 'Error inesperado' } satisfies Response));
  return true; // respuesta asíncrona
});

chrome.runtime.onInstalled.addListener(() => void syncCaptureScript());
chrome.runtime.onStartup.addListener(() => void syncCaptureScript());
chrome.permissions.onAdded.addListener(() => void syncCaptureScript());
chrome.permissions.onRemoved.addListener(() => void syncCaptureScript());
chrome.tabs.onRemoved.addListener((tabId) => {
  for (const bucket of ['captures', 'offers', 'steps'] as const) void deleteEntry(bucket, tabId);
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
