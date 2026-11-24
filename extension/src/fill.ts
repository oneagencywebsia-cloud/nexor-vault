// Content script de relleno. Se inyecta SOLO cuando el usuario lo pide (popup o
// atajo de teclado, vía activeTab) y solo en el frame principal. No muestra
// ninguna interfaz dentro de la página (evita el "clickjacking de extensión"),
// no lee ni envía datos de la página y no guarda las credenciales: las recibe,
// las escribe en los campos y las descarta. Nunca envía el formulario.

import { findPasswordField, findTotpField, findUsernameField, normalizedHost, setValue } from './lib/form-fields';

interface FillMessage {
  type: 'nexor-fill';
  expectedHost: string;
  username: string;
  password: string;
  totp?: string;
}

interface FillResult {
  username: boolean;
  password: boolean;
  totp: boolean;
  needsNextStep: boolean;
}

declare global {
  interface Window {
    __nexorFillInstalled?: boolean;
  }
}

function fill(msg: FillMessage): FillResult | null {
  // Defensa en profundidad: aunque el service worker ya comprobó el dominio,
  // se vuelve a comprobar aquí por si la pestaña navegó entre medias.
  if (window.top !== window) return null;
  if (normalizedHost() !== msg.expectedHost) return null;

  const result: FillResult = { username: false, password: false, totp: false, needsNextStep: false };
  const password = findPasswordField();
  const username = findUsernameField(password);
  const used = new Set<HTMLInputElement>();

  if (username && msg.username) {
    setValue(username, msg.username);
    used.add(username);
    result.username = true;
  }
  if (password && msg.password) {
    setValue(password, msg.password);
    used.add(password);
    result.password = true;
  }
  if (msg.totp) {
    const totp = findTotpField(used);
    if (totp) {
      setValue(totp, msg.totp);
      result.totp = true;
    }
  }
  // Login en dos pasos: solo había usuario; la contraseña se rellena en la siguiente pantalla.
  if (result.username && !result.password) result.needsNextStep = true;

  return result.username || result.password || result.totp ? result : null;
}

if (!window.__nexorFillInstalled) {
  window.__nexorFillInstalled = true;
  chrome.runtime.onMessage.addListener((message: FillMessage, sender, sendResponse) => {
    // Solo mensajes de nuestra extensión (las páginas no pueden enviarlos).
    if (sender.id !== chrome.runtime.id || message?.type !== 'nexor-fill') return false;
    try {
      sendResponse(fill(message));
    } catch {
      sendResponse(null);
    }
    return false;
  });
}

export {};
