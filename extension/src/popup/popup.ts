// Popup de la extensión. Toda la interfaz se construye con DOM + textContent
// (nunca innerHTML con datos), y solo recibe del service worker datos que no son
// secretos: la contraseña y el 2FA se piden uno a uno, por acción del usuario.

import { DEFAULT_SERVER, type ItemSummary, type Request, type Response, type Status } from '../lib/types';
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

// ───────────── vista: bloqueado ─────────────

function lockedView(status: Status): HTMLElement {
  const email = h('input', { type: 'email', required: true, autocomplete: 'username', placeholder: 'tu@email.com', value: status.email ?? '' });
  const password = h('input', { type: 'password', required: true, autocomplete: 'current-password', placeholder: 'Master password' });
  const server = h('input', { type: 'url', value: status.serverUrl || DEFAULT_SERVER, placeholder: DEFAULT_SERVER });
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
          submit.textContent = 'Desbloquear';
        }
      },
    },
    h('label', { for: 'email' }, 'Email'),
    Object.assign(email, { id: 'email' }),
    h('label', { for: 'pw' }, 'Master password'),
    Object.assign(password, { id: 'pw' }),
    h('details', {}, h('summary', {}, 'Servidor (avanzado)'), server),
    error,
    submit,
  );

  return h(
    'main',
    {},
    h('h1', {}, 'Desbloquea tu bóveda'),
    h('p', { class: 'sub' }, 'Tu master password se usa solo en este navegador; nunca se envía.'),
    form,
  );
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

async function unlockedView(): Promise<HTMLElement> {
  const tab = await activeTab();
  const { items } = await send<{ items: ItemSummary[] }>({ type: 'items', pageUrl: tab.url });

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
  return h('main', {}, search, list);
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

  if (status.pendingTotp || forceTotp) {
    app.replaceChildren(header(status), totpView());
    return;
  }
  if (!status.unlocked) {
    app.replaceChildren(header(status), lockedView(status));
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
