// Detección de campos de inicio de sesión. Compartido por el relleno (fill.ts) y
// la captura al enviar (capture.ts) para que ambos entiendan los formularios igual.

export function normalizedHost(): string {
  return location.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
}

export function isVisible(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) return false;
  const style = getComputedStyle(el);
  if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return false;
  return true;
}

export function usable(el: HTMLInputElement): boolean {
  return !el.disabled && !el.readOnly && isVisible(el);
}

export function inputs(selector: string, root: ParentNode = document): HTMLInputElement[] {
  return Array.from(root.querySelectorAll<HTMLInputElement>(selector)).filter(usable);
}

export const USERNAME_HINT = /(user|usuario|login|email|e-mail|correo|mail|account|cuenta|identifier|alias|nick|phone|tel)/i;
export const OTP_HINT = /(otp|totp|2fa|mfa|two.?factor|verification|verific|security.?code|c[oó]digo|auth.?code|token|pin)/i;

export function attrText(el: HTMLInputElement): string {
  return [el.name, el.id, el.placeholder, el.getAttribute('aria-label'), el.autocomplete].filter(Boolean).join(' ');
}

export function findPasswordField(): HTMLInputElement | null {
  const fields = inputs('input[type="password"]');
  // Si hay varios (cambio de contraseña), se usa el primero: es el actual/único.
  return fields[0] ?? null;
}

export function findUsernameField(password: HTMLInputElement | null, scope?: ParentNode): HTMLInputElement | null {
  const root: ParentNode = scope ?? password?.form ?? document;
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

export function findTotpField(exclude: Set<HTMLInputElement>): HTMLInputElement | null {
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
export function setValue(el: HTMLInputElement, value: string): void {
  el.focus();
  const proto = Object.getPrototypeOf(el) as object;
  const setter =
    Object.getOwnPropertyDescriptor(proto, 'value')?.set ?? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
