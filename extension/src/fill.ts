// Content script de relleno. Se inyecta SOLO cuando el usuario lo pide (popup o
// atajo de teclado, vía activeTab) y solo en el frame principal. No muestra
// ninguna interfaz dentro de la página (evita el "clickjacking de extensión"),
// no lee ni envía datos de la página y no guarda las credenciales: las recibe,
// las escribe en los campos y las descarta. Nunca envía el formulario.

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

function normalizedHost(): string {
  return location.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
}

function isVisible(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) return false;
  const style = getComputedStyle(el);
  if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return false;
  return true;
}

function usable(el: HTMLInputElement): boolean {
  return !el.disabled && !el.readOnly && isVisible(el);
}

function inputs(selector: string, root: ParentNode = document): HTMLInputElement[] {
  return Array.from(root.querySelectorAll<HTMLInputElement>(selector)).filter(usable);
}

const USERNAME_HINT = /(user|usuario|login|email|e-mail|correo|mail|account|cuenta|identifier|alias|nick|phone|tel)/i;
const OTP_HINT = /(otp|totp|2fa|mfa|two.?factor|verification|verific|security.?code|c[oó]digo|auth.?code|token|pin)/i;

function attrText(el: HTMLInputElement): string {
  return [el.name, el.id, el.placeholder, el.getAttribute('aria-label'), el.autocomplete].filter(Boolean).join(' ');
}

function findPasswordField(): HTMLInputElement | null {
  const fields = inputs('input[type="password"]');
  // Si hay varios (cambio de contraseña), se usa el primero: es el actual/único.
  return fields[0] ?? null;
}

function findUsernameField(password: HTMLInputElement | null): HTMLInputElement | null {
  const root: ParentNode = password?.form ?? document;
  const candidates = inputs('input[type="email"], input[type="text"], input[type="tel"], input:not([type])', root).filter(
    (el) => !OTP_HINT.test(attrText(el)) || /user|email|mail|login/i.test(attrText(el)),
  );
  if (candidates.length === 0) return null;

  // 1) autocomplete explícito
  const explicit = candidates.find((el) => /^(username|email)$/i.test(el.autocomplete));
  if (explicit) return explicit;

  // 2) con contraseña: el campo de texto que la precede en el documento
  if (password) {
    const before = candidates.filter((el) => el.compareDocumentPosition(password) & Node.DOCUMENT_POSITION_FOLLOWING);
    const hinted = before.filter((el) => USERNAME_HINT.test(attrText(el)));
    if (hinted.length) return hinted[hinted.length - 1];
    if (before.length) return before[before.length - 1];
  }

  // 3) sin contraseña (paso 1 de un login en dos pasos): por pistas en el nombre
  return candidates.find((el) => USERNAME_HINT.test(attrText(el))) ?? null;
}

function findTotpField(exclude: Set<HTMLInputElement>): HTMLInputElement | null {
  const fields = inputs('input').filter((el) => !exclude.has(el) && el.type !== 'password' && el.type !== 'hidden');
  const explicit = fields.find((el) => el.autocomplete === 'one-time-code');
  if (explicit) return explicit;
  return (
    fields.find((el) => {
      const short = (el.maxLength > 0 && el.maxLength <= 8) || el.inputMode === 'numeric' || el.pattern === '[0-9]*';
      return OTP_HINT.test(attrText(el)) && short;
    }) ?? null
  );
}

// Escribe como lo haría un usuario: usa el setter nativo (React/Vue ignoran
// asignar .value directamente) y lanza los eventos que esperan los frameworks.
function setValue(el: HTMLInputElement, value: string): void {
  el.focus();
  const proto = Object.getPrototypeOf(el) as object;
  const setter =
    Object.getOwnPropertyDescriptor(proto, 'value')?.set ?? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
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
