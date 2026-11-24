// Popup de la extensión. Toda la interfaz se construye con DOM + textContent
// (nunca innerHTML con datos), y solo recibe del service worker datos que no son
// secretos: la contraseña y el 2FA se piden uno a uno, por acción del usuario.

import { BIO_MESSAGES, BioError, bioSupported, createBioCredential, getBioPrf, toB64 } from '@/lib/biometric';
import { CAPTURE_ORIGINS, DEFAULT_SERVER, type CaptureOffer, type ItemSummary, type Request, type Response, type Status } from '../lib/types';
import { normalizeServerUrl } from '../lib/state';

const app = document.getElementById('app') as HTMLElement;

// ───────────── utilidades ─────────────

type Child = Node | string | null | undefined | false;

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { class?: string; [k: string]: unknown } = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (k in el) (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, String(v));
  }
  for (const c of children) if (c) el.append(c);
  return el;
}

async function send<T extends Record<string, unknown> = Record<string, unknown>>(req: Request): Promise<{ ok: true } & T> {
  const res = (await chrome.runtime.sendMessage(req)) as Response | undefined;
  if (!res) throw new Error('La extensión no responde. Vuelve a abrir el popup.');
  if (!res.ok) throw new Error(res.error);
  return res as { ok: true } & T;
}

function avatarColor(seed: string): string {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360} 55% 48%)`;
}

let toastTimer: number | undefined;
function toast(message: string, bad = false): void {
  document.querySelector('.toast')?.remove();
  const el = h('div', { class: `toast ${bad ? 'bad' : ''}`, role: 'status' }, message);
  document.body.append(el);
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.remove(), 2200);
}

const ICONS = {
  lock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
};

function icon(name: keyof typeof ICONS): HTMLElement {
  const span = document.createElement('span');
  span.innerHTML = ICONS[name]; // SVG estático propio, sin datos de usuario
  return span;
}

function header(status?: Status): HTMLElement {
  const logo = h('img', { src: 'icons/icon-48.png', alt: '' });
  const right = status?.unlocked
    ? h(
        'button',
        {
          class: 'icon-btn',
          title: 'Bloquear',
          'aria-label': 'Bloquear',
          onclick: async () => {
            await send({ type: 'lock' });
            await render();
          },
        },
        icon('lock'),
      )
    : null;
  return h('header', {}, logo, h('span', { class: 'brand' }, 'NEXOR'), right);
}

// ───────────── biometría: ventana propia ─────────────
// La verificación (huella, Face ID, llave) se hace en una ventana aparte y no en el
// popup: en varios navegadores el popup se cierra cuando aparece el aviso del sistema
// (Windows Hello, Touch ID…) y se perdería la verificación a medias.

async function openBioWindow(mode: 'enroll' | 'unlock'): Promise<void> {
  await chrome.windows.create({ url: chrome.runtime.getURL(`popup.html?bio=${mode}`), type: 'popup', width: 420, height: 500, focused: true });
  window.close();
}

function bioButton(): HTMLElement {
  return h(
    'button',
    { class: 'btn secondary', type: 'button', onclick: () => openBioWindow('unlock') },
    'Desbloquear con huella, Face ID o llave',
  );
}

// ───────────── vista: iniciar sesión (primera vez) ─────────────

function loginView(status: Status): HTMLElement {
  const email = h('input', { type: 'email', required: true, autocomplete: 'username', placeholder: 'tu@email.com', value: status.email ?? '' });
  const password = h('input', { type: 'password', required: true, autocomplete: 'current-password', placeholder: 'Master password' });
  const server = h('input', { type: 'url', value: status.serverUrl || DEFAULT_SERVER, placeholder: DEFAULT_SERVER });
  const error = h('p', { class: 'error', hidden: true });
  const submit = h('button', { class: 'btn', type: 'submit' }, 'Iniciar sesión');
  // Solo las compilaciones para instalaciones propias (--custom-server) permiten otro servidor.
  const canCustomServer = !!chrome.runtime.getManifest().optional_host_permissions?.length;

  const form = h(
    'form',
    {
      onsubmit: async (e: Event) => {
        e.preventDefault();
        error.hidden = true;
        submit.disabled = true;
        submit.textContent = 'Iniciando sesión…';
        try {
          // El permiso para un servidor propio debe pedirse dentro del gesto del usuario.
          const origin = normalizeServerUrl(server.value);
          if (origin !== normalizeServerUrl(DEFAULT_SERVER) && chrome.permissions) {
            const granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
            if (!granted) throw new Error('Necesito permiso para conectar con ese servidor.');
          }
          const res = await send<{ needsTotp: boolean }>({ type: 'unlock', serverUrl: origin, email: email.value, password: password.value });
          password.value = '';
          await render(res.needsTotp);
        } catch (err) {
          error.textContent = err instanceof Error ? err.message : 'Error inesperado';
          error.hidden = false;
          submit.disabled = false;
          submit.textContent = 'Iniciar sesión';
        }
      },
    },
    h('label', { for: 'email' }, 'Email'),
    Object.assign(email, { id: 'email' }),
    h('label', { for: 'pw' }, 'Master password'),
    Object.assign(password, { id: 'pw' }),
    canCustomServer ? h('details', {}, h('summary', {}, 'Servidor (avanzado)'), server) : null,
    error,
    submit,
  );

  return h(
    'main',
    {},
    h('h1', {}, 'Inicia sesión'),
    h('p', { class: 'sub' }, 'Solo la primera vez: después basta con desbloquear. Tu master password se usa solo en este navegador; nunca se envía.'),
    form,
  );
}

// ───────────── vista: bloqueado (cuenta recordada) ─────────────

function lockedView(status: Status): HTMLElement {
  const password = h('input', { type: 'password', required: true, autocomplete: 'current-password', placeholder: 'Master password' });
  const error = h('p', { class: 'error', hidden: true });
  const submit = h('button', { class: 'btn', type: 'submit' }, 'Desbloquear');

  const form = h(
    'form',
    {
      onsubmit: async (e: Event) => {
        e.preventDefault();
        error.hidden = true;
        submit.disabled = true;
        submit.textContent = 'Desbloqueando…';
        try {
          const res = await send<{ needsTotp: boolean }>({ type: 'unlock-local', password: password.value });
          password.value = '';
          await render(res.needsTotp);
        } catch (err) {
          error.textContent = err instanceof Error ? err.message : 'Error inesperado';
          error.hidden = false;
          submit.disabled = false;
          submit.textContent = 'Desbloquear';
        }
      },
    },
    h('label', { for: 'pw' }, 'Master password'),
    Object.assign(password, { id: 'pw' }),
    error,
    submit,
  );

  const useOther = h(
    'button',
    {
      class: 'link-btn',
      type: 'button',
      onclick: async () => {
        await send({ type: 'logout' });
        await render();
      },
    },
    'Usar otra cuenta',
  );

  queueMicrotask(() => password.focus());
  return h(
    'main',
    {},
    h('h1', {}, 'Bóveda bloqueada'),
    h('p', { class: 'sub' }, h('span', { class: 'email-chip' }, status.email ?? '')),
    status.bioEnrolled && bioSupported() ? bioButton() : null,
    status.bioEnrolled && bioSupported() ? h('p', { class: 'or' }, 'o con tu master password') : null,
    form,
    h('div', { class: 'foot' }, useOther),
  );
}

// ───────────── ventana de verificación biométrica ─────────────

function bioView(mode: 'enroll' | 'unlock', status: Status): HTMLElement {
  const info = h('p', { class: 'sub' });
  const error = h('p', { class: 'error', hidden: true });
  const action = h('button', { class: 'btn', type: 'button' }, mode === 'unlock' ? 'Verificar' : 'Activar');
  const fallback = h('button', { class: 'link-btn', type: 'button', onclick: () => window.close() }, mode === 'unlock' ? 'Usar la master password' : 'Cancelar');

  function fail(err: unknown): void {
    const msg = err instanceof BioError ? err.message : err instanceof Error ? err.message : BIO_MESSAGES.failed;
    error.textContent = msg;
    error.hidden = false;
    action.disabled = false;
    action.textContent = 'Reintentar';
  }

  function done(text: string): void {
    action.hidden = true;
    fallback.hidden = true;
    error.hidden = true;
    info.textContent = text;
    info.classList.add('ok');
    window.setTimeout(() => window.close(), 1100);
  }

  async function run(): Promise<void> {
    error.hidden = true;
    action.disabled = true;
    action.textContent = 'Esperando verificación…';
    try {
      if (!bioSupported()) throw new BioError('unsupported', BIO_MESSAGES.unsupported);
      if (mode === 'unlock') {
        const bio = await send<{ enrolled: boolean; rpId: string; credId: string; prfSalt: string }>({ type: 'bio-info' });
        if (!bio.enrolled) throw new Error('El desbloqueo rápido no está activado.');
        const prf = await getBioPrf({ rpId: bio.rpId, credId: bio.credId, prfSalt: bio.prfSalt });
        await send({ type: 'bio-unlock', prfOutput: toB64(prf) });
        done('Desbloqueado ✔ Pulsa el icono de Nexor para usarlo.');
      } else {
        const userId = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(status.email ?? 'nexor')));
        // Primero el dominio del servidor (Chrome ≥122 y Firefox ≥150 lo permiten a las extensiones con permiso de host);
        // si el navegador lo rechaza, el propio origen de la extensión.
        const candidates = [new URL(status.serverUrl).hostname, location.hostname];
        let lastErr: unknown;
        let enrolled = false;
        for (const rpId of candidates) {
          try {
            const cred = await createBioCredential({ rpId, rpName: 'Nexor Vault', userName: status.email ?? 'Nexor', userId });
            await send({ type: 'bio-enroll', rpId, credId: cred.credId, prfSalt: cred.prfSalt, prfOutput: toB64(cred.prfOutput) });
            enrolled = true;
            break;
          } catch (err) {
            lastErr = err;
            if (!(err instanceof BioError && err.code === 'wrong-site')) throw err; // solo se reintenta si fue por el dominio
          }
        }
        if (!enrolled) throw lastErr;
        done('Desbloqueo rápido activado ✔');
      }
    } catch (err) {
      fail(err);
    }
  }

  action.addEventListener('click', () => void run());
  info.textContent =
    mode === 'unlock'
      ? 'Usa tu huella, Face ID, el PIN de tu dispositivo o tu llave de seguridad.'
      : 'En vez de escribir la master password, usarás tu huella, Face ID, el PIN del dispositivo o una llave de seguridad. La master password seguirá funcionando siempre.';
  // Al desbloquear se lanza solo; al activar, el usuario debe pulsar (algunos navegadores lo exigen).
  if (mode === 'unlock') queueMicrotask(() => void run());
  return h('main', {}, h('h1', {}, mode === 'unlock' ? 'Verifica que eres tú' : 'Activar desbloqueo rápido'), info, error, action, h('div', { class: 'foot' }, fallback));
}

// ───────────── vista: código 2FA de la cuenta ─────────────

function totpView(): HTMLElement {
  const code = h('input', { type: 'text', inputMode: 'numeric', maxLength: 6, required: true, autocomplete: 'one-time-code', placeholder: '123456' });
  const error = h('p', { class: 'error', hidden: true });
  const submit = h('button', { class: 'btn', type: 'submit' }, 'Verificar');
  const form = h(
    'form',
    {
      onsubmit: async (e: Event) => {
        e.preventDefault();
        error.hidden = true;
        submit.disabled = true;
        try {
          await send({ type: 'unlock-totp', code: code.value });
          await render();
        } catch (err) {
          error.textContent = err instanceof Error ? err.message : 'Código incorrecto';
          error.hidden = false;
          submit.disabled = false;
        }
      },
    },
    h('label', { for: 'code' }, 'Código de 6 dígitos'),
    Object.assign(code, { id: 'code' }),
    error,
    submit,
  );
  queueMicrotask(() => code.focus());
  return h('main', {}, h('h1', {}, 'Verificación en dos pasos'), h('p', { class: 'sub' }, 'Introduce el código de tu app de autenticación.'), form);
}

// ───────────── vista: desbloqueado ─────────────

async function activeTab(): Promise<{ id?: number; url: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return { id: tab?.id, url: tab?.url ?? '' };
}

async function copyField(id: string, field: 'username' | 'password' | 'totp'): Promise<void> {
  try {
    const { value } = await send<{ value: string }>({ type: 'secret', id, field });
    await navigator.clipboard.writeText(value);
    toast(field === 'username' ? 'Usuario copiado' : field === 'password' ? 'Contraseña copiada' : `Código 2FA copiado: ${value}`);
  } catch (err) {
    toast(err instanceof Error ? err.message : 'No se pudo copiar', true);
  }
}

function avatarEl(title: string): HTMLElement {
  const el = h('div', { class: 'avatar' }, (title.trim()[0] ?? '?').toUpperCase());
  el.style.background = avatarColor(title);
  return el;
}

function itemRow(item: ItemSummary, tabId: number | undefined): HTMLElement {
  const fillBtn =
    item.match && tabId !== undefined
      ? h(
          'button',
          {
            class: `chip ${item.match === 'exact' ? 'primary' : 'warn'}`,
            title: item.match === 'exact' ? 'Rellenar en esta página' : 'El dominio no coincide exactamente: pulsa dos veces para confirmar',
            'data-confirm': '0',
            onclick: async (e: Event) => {
              const btn = e.currentTarget as HTMLButtonElement;
              if (item.match === 'related' && btn.dataset.confirm !== '1') {
                btn.dataset.confirm = '1';
                btn.textContent = '¿Seguro?';
                return;
              }
              btn.disabled = true;
              try {
                const { result } = await send<{ result: { username: boolean; password: boolean; totp: boolean; needsNextStep: boolean } }>({
                  type: 'fill',
                  id: item.id,
                  tabId,
                  allowRelated: item.match === 'related',
                });
                if (result.needsNextStep) toast('Usuario rellenado. Vuelve a pulsar en el siguiente paso.');
                else toast('Rellenado ✔');
                window.setTimeout(() => window.close(), 700);
              } catch (err) {
                toast(err instanceof Error ? err.message : 'No se pudo rellenar', true);
                btn.disabled = false;
                btn.textContent = 'Rellenar';
                btn.dataset.confirm = '0';
              }
            },
          },
          'Rellenar',
        )
      : null;

  return h(
    'div',
    { class: `item ${item.match === 'exact' ? 'match' : ''}` },
    avatarEl(item.title),
    h('div', { class: 'meta' }, h('b', {}, item.title), h('span', {}, item.username || item.url || '—')),
    h(
      'div',
      { class: 'actions' },
      fillBtn,
      h('button', { class: 'chip', title: 'Copiar usuario', onclick: () => copyField(item.id, 'username') }, 'Usr'),
      h('button', { class: 'chip', title: 'Copiar contraseña', onclick: () => copyField(item.id, 'password') }, 'Pass'),
      item.hasTotp ? h('button', { class: 'chip', title: 'Copiar código 2FA', onclick: () => copyField(item.id, 'totp') }, '2FA') : null,
    ),
  );
}

// Aviso "¿Guardar en Nexor?": vive aquí (no en la página) para que ninguna web pueda tapar ni imitar el botón.
function offerBanner(offer: CaptureOffer, tabId: number): HTMLElement {
  const who = offer.username || 'esta cuenta';
  const question =
    offer.decision === 'update'
      ? `¿Actualizar la contraseña de ${who} en ${offer.host}?`
      : `¿Guardar el acceso de ${who} en ${offer.host}?`;

  const act = (fn: () => Promise<void>) => async (e: Event) => {
    const btn = e.currentTarget as HTMLButtonElement;
    btn.disabled = true;
    try {
      await fn();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo completar', true);
      btn.disabled = false;
    }
  };

  return h(
    'div',
    { class: 'offer', role: 'group', 'aria-label': 'Guardar contraseña' },
    h('div', { class: 'offer-text' }, question),
    h(
      'div',
      { class: 'offer-actions' },
      h(
        'button',
        {
          class: 'btn',
          type: 'button',
          onclick: act(async () => {
            await send({ type: 'capture-save', tabId });
            toast(offer.decision === 'update' ? 'Contraseña actualizada' : 'Guardado en Nexor');
            await render();
          }),
        },
        offer.decision === 'update' ? 'Actualizar' : 'Guardar',
      ),
      h(
        'button',
        {
          class: 'btn secondary',
          type: 'button',
          onclick: act(async () => {
            await send({ type: 'capture-dismiss', tabId });
            await render();
          }),
        },
        'Ahora no',
      ),
    ),
    h(
      'button',
      {
        class: 'link-btn',
        type: 'button',
        onclick: act(async () => {
          await send({ type: 'capture-dismiss', tabId, never: true });
          toast('No volveré a preguntar en esta web');
          await render();
        }),
      },
      'Nunca en esta web',
    ),
  );
}

async function unlockedView(): Promise<HTMLElement> {
  const tab = await activeTab();
  const { items } = await send<{ items: ItemSummary[] }>({ type: 'items', pageUrl: tab.url });

  const offerBox = h('div', {});
  if (tab.id !== undefined) {
    try {
      const { offer } = await send<{ offer: CaptureOffer | null }>({ type: 'capture-get', tabId: tab.id });
      if (offer) offerBox.append(offerBanner(offer, tab.id));
    } catch {
      /* sin aviso */
    }
  }

  const list = h('div', {});
  const search = h('input', { type: 'search', class: 'search', placeholder: 'Buscar por nombre, usuario o web…', autofocus: true });

  function paint(): void {
    list.replaceChildren();
    const q = search.value.trim().toLowerCase();
    const filtered = q
      ? items.filter((i) => `${i.title} ${i.username} ${i.url}`.toLowerCase().includes(q))
      : items;
    if (filtered.length === 0) {
      list.append(h('div', { class: 'empty' }, items.length === 0 ? 'Tu bóveda está vacía. Crea accesos desde la web de Nexor.' : 'Sin resultados.'));
      return;
    }
    const exact = filtered.filter((i) => i.match === 'exact');
    const related = filtered.filter((i) => i.match === 'related');
    const rest = filtered.filter((i) => !i.match);

    if (exact.length) {
      list.append(h('div', { class: 'section-title' }, 'Para esta web'));
      exact.forEach((i) => list.append(itemRow(i, tab.id)));
    }
    if (related.length) {
      list.append(h('div', { class: 'section-title' }, 'Dominio relacionado (confirmar)'));
      related.forEach((i) => list.append(itemRow(i, tab.id)));
    }
    if (rest.length) {
      list.append(h('div', { class: 'section-title' }, q ? 'Resultados' : 'Todos los accesos'));
      rest.slice(0, 60).forEach((i) => list.append(itemRow(i, tab.id)));
      if (rest.length > 60) list.append(h('div', { class: 'empty' }, `…y ${rest.length - 60} más. Usa el buscador.`));
    }
  }

  search.addEventListener('input', paint);
  paint();
  queueMicrotask(() => search.focus());

  const { status } = await send<{ status: Status }>({ type: 'status' });
  const foot = h('div', { class: 'foot' });
  if (bioSupported()) {
    foot.append(
      status.bioEnrolled
        ? h(
            'button',
            {
              class: 'link-btn',
              type: 'button',
              onclick: async () => {
                await send({ type: 'bio-remove' });
                toast('Desbloqueo rápido desactivado');
                await render();
              },
            },
            'Desactivar desbloqueo rápido',
          )
        : h('button', { class: 'link-btn', type: 'button', onclick: () => openBioWindow('enroll') }, 'Activar huella / Face ID / llave'),
    );
  }
  foot.append(
    h(
      'button',
      {
        class: 'link-btn',
        type: 'button',
        title: 'Pide permiso para ver las webs; solo se usa para detectar cuando inicias sesión.',
        onclick: async () => {
          try {
            if (status.captureEnabled) {
              await chrome.permissions.remove({ origins: CAPTURE_ORIGINS });
              toast('Aviso de guardado desactivado');
            } else {
              const ok = await chrome.permissions.request({ origins: CAPTURE_ORIGINS });
              toast(ok ? 'Activado: te avisaré al iniciar sesión en una web nueva' : 'No se concedió el permiso', !ok);
            }
          } catch {
            toast('Este navegador no permite cambiarlo desde aquí', true);
          }
          await render();
        },
      },
      status.captureEnabled ? 'Desactivar aviso "¿Guardar contraseña?"' : 'Activar aviso "¿Guardar contraseña?"',
    ),
  );
  let armed = false;
  foot.append(
    h(
      'button',
      {
        class: 'link-btn',
        type: 'button',
        onclick: async (e: Event) => {
          const btn = e.currentTarget as HTMLButtonElement;
          if (!armed) {
            armed = true;
            btn.textContent = '¿Seguro? Pulsa otra vez';
            return;
          }
          await send({ type: 'logout' });
          await render();
        },
      },
      'Cerrar sesión',
    ),
  );
  return h('main', {}, offerBox, search, list, foot);
}

// ───────────── arranque ─────────────

async function render(forceTotp = false): Promise<void> {
  let status: Status;
  try {
    ({ status } = await send<{ status: Status }>({ type: 'status' }));
  } catch (err) {
    app.replaceChildren(header(), h('main', {}, h('p', { class: 'error' }, err instanceof Error ? err.message : 'Error')));
    return;
  }

  // Ventana de verificación biométrica (se abre aparte desde el popup).
  const bioMode = new URLSearchParams(location.search).get('bio');
  if (bioMode === 'unlock' || bioMode === 'enroll') {
    if (bioMode === 'enroll' && !status.unlocked) {
      app.replaceChildren(header(), h('main', {}, h('p', { class: 'error' }, 'Desbloquea la bóveda en el popup antes de activar el desbloqueo rápido.')));
      return;
    }
    app.replaceChildren(header(), bioView(bioMode, status));
    return;
  }

  if (status.pendingTotp || forceTotp) {
    app.replaceChildren(header(status), totpView());
    return;
  }
  if (!status.unlocked) {
    app.replaceChildren(header(status), status.hasAccount ? lockedView(status) : loginView(status));
    return;
  }
  try {
    app.replaceChildren(header(status), await unlockedView());
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error';
    if (msg === 'locked') {
      await render();
      return;
    }
    app.replaceChildren(header(status), h('main', {}, h('p', { class: 'error' }, msg)));
  }
}

void render();
