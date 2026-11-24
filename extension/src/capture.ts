// Content script de captura ("¿Guardar en Nexor?"). Solo existe si el usuario ACTIVA
// la función en el popup (permiso opcional de sitios web): se registra entonces de
// forma dinámica y desaparece al desactivarla.
//
// Qué hace: cuando el usuario envía un formulario con contraseña, anota usuario y
// contraseña y se los pasa al service worker. Después confirma que el inicio de
// sesión funcionó (el campo de contraseña desaparece o la página siguiente ya no
// lo tiene) y el service worker decide si ofrecer guardarlo.
//
// Qué NO hace (a propósito):
//  · No dibuja nada en la página: el aviso vive en el popup de la extensión, así
//    que una web no puede tapar, imitar ni pulsar el botón de guardar.
//  · No guarda nada: los datos van directo al service worker (memoria, caducan en
//    minutos) y nunca se quedan en la página ni se envían a ningún servidor.
//  · Solo el frame principal; ignora campos ocultos, deshabilitados o de solo lectura.

import { MAX_USERNAME_LENGTH, pickPassword } from '@/lib/capture-logic';
import { attrText, findUsernameField, inputs, isVisible, USERNAME_HINT } from './lib/form-fields';

declare global {
  interface Window {
    __nexorCaptureInstalled?: boolean;
  }
}

const SUBMIT_WORDS = /(log ?in|sign ?in|iniciar|entrar|acceder|acceso|continu|submit|enviar|siguiente|next|registr|sign ?up|crear|create|cambiar|change|guardar|save|update|actualizar)/i;

let lastSig = '';
let lastAt = 0;
let watcher: number | undefined;

function send(message: Record<string, unknown>): void {
  try {
    void chrome.runtime.sendMessage(message).catch(() => undefined);
  } catch {
    /* la extensión se recargó: se ignora */
  }
}

function passwordFields(scope: ParentNode): HTMLInputElement[] {
  return inputs('input[type="password"]', scope);
}

function snapshot(scope: ParentNode): void {
  const fields = passwordFields(scope);
  if (fields.length === 0) return stepSnapshot(scope);

  const picked = pickPassword(fields.map((f) => ({ value: f.value, autocomplete: f.autocomplete })));
  if (!picked) return;

  const userField = findUsernameField(fields[0], fields[0].form ?? document);
  const username = (userField?.value ?? '').trim().slice(0, MAX_USERNAME_LENGTH);

  // El mismo envío suele disparar varios eventos (clic + submit + Enter): se cuenta uno.
  const sig = `${username}\u0000${picked.password}`;
  if (sig === lastSig && Date.now() - lastAt < 1500) return;
  lastSig = sig;
  lastAt = Date.now();

  send({ type: 'nexor-capture', username, password: picked.password, kind: picked.kind });
  watchForSuccess(fields[0]);
}

// Primer paso de un login en dos pasos (Google, Microsoft…): solo hay usuario.
// Se recuerda unos minutos para unirlo a la contraseña de la pantalla siguiente.
function stepSnapshot(scope: ParentNode): void {
  const candidates = inputs('input[type="email"], input[type="text"], input:not([type])', scope);
  const field = candidates.find((el) => /^(username|email)$/i.test(el.autocomplete) || el.type === 'email' || USERNAME_HINT.test(attrText(el)));
  const value = field?.value.trim() ?? '';
  if (value && value.length <= MAX_USERNAME_LENGTH) send({ type: 'nexor-username-step', username: value });
}

// Login sin recarga (SPA): se da por bueno si el campo de contraseña desaparece.
function watchForSuccess(field: HTMLInputElement): void {
  window.clearInterval(watcher);
  const startedAt = Date.now();
  watcher = window.setInterval(() => {
    if (!field.isConnected || !isVisible(field)) {
      window.clearInterval(watcher);
      send({ type: 'nexor-login-ok' });
    } else if (Date.now() - startedAt > 12_000) {
      window.clearInterval(watcher);
    }
  }, 500);
}

function looksLikeSubmit(target: EventTarget | null): boolean {
  const el = (target as Element | null)?.closest?.('button, input[type="submit"], input[type="button"], [role="button"]');
  if (!el) return false;
  const type = (el.getAttribute('type') ?? '').toLowerCase();
  if (type === 'submit') return true;
  if (el.tagName === 'BUTTON' && !type && el.closest('form')) return true; // botón por defecto de un <form>
  const text = `${el.textContent ?? ''} ${el.getAttribute('aria-label') ?? ''} ${el.getAttribute('value') ?? ''}`;
  return SUBMIT_WORDS.test(text);
}

function install(): void {
  if (window.top !== window || window.__nexorCaptureInstalled) return;
  window.__nexorCaptureInstalled = true;

  // Fase de captura: se lee ANTES de que los manejadores de la web vacíen o cambien los campos.
  document.addEventListener('submit', (e) => snapshot((e.target as HTMLFormElement) ?? document), true);
  document.addEventListener(
    'click',
    (e) => {
      if (!e.isTrusted || !looksLikeSubmit(e.target)) return;
      const form = (e.target as Element).closest('form');
      snapshot(form ?? document);
    },
    true,
  );
  document.addEventListener(
    'keydown',
    (e) => {
      const t = e.target as HTMLInputElement | null;
      if (!e.isTrusted || e.key !== 'Enter' || t?.tagName !== 'INPUT') return;
      snapshot(t.form ?? document);
    },
    true,
  );

  // Página nueva tras enviar: si ya no tiene contraseña, el login funcionó.
  window.setTimeout(() => send({ type: 'nexor-page-state', hasPassword: passwordFields(document).length > 0 }), 800);
}

install();

export {};
