'use client';

// Todo el análisis corre en el cliente: es la única forma de auditar
// contraseñas en un vault zero-knowledge sin que el servidor las vea nunca.

export type Strength = 'weak' | 'fair' | 'strong';

// Top contraseñas más filtradas/comunes (muestra reducida) — pasan los
// checks de longitud/variedad de caracteres pero son triviales de adivinar,
// así que se fuerzan a "weak" independientemente del resto del score.
const COMMON_PASSWORDS = new Set([
  'password123',
  'password1234',
  'password1!',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty123',
  'qwertyuiop',
  'letmein123',
  'welcome123',
  'admin1234',
  'iloveyou1',
  'abc123456',
  'p@ssw0rd',
  'passw0rd!',
]);

export function scoreStrength(password: string): Strength {
  if (!password) return 'weak';
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return 'weak';
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) => re.test(password)).length;
  if (password.length < 10 || classes < 2) return 'weak';
  if (password.length < 16 || classes < 3) return 'fair';
  return 'strong';
}

export function findReusedPasswordIds(items: { id: string; password: string }[]): Set<string> {
  const byPassword = new Map<string, string[]>();
  for (const item of items) {
    if (!item.password) continue;
    const ids = byPassword.get(item.password) ?? [];
    ids.push(item.id);
    byPassword.set(item.password, ids);
  }
  const reused = new Set<string>();
  for (const ids of byPassword.values()) {
    if (ids.length > 1) ids.forEach((id) => reused.add(id));
  }
  return reused;
}

async function sha1Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/**
 * Consulta Have I Been Pwned (Pwned Passwords) con k-anonimato: solo se
 * envían los primeros 5 caracteres del hash SHA-1, nunca la contraseña ni
 * el hash completo. Devuelve el nº de veces vista en filtraciones (0 = no
 * encontrada).
 */
export async function checkPwned(password: string): Promise<number> {
  const hash = await sha1Hex(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
  if (!res.ok) throw new Error('No se pudo consultar Have I Been Pwned');
  const text = await res.text();

  for (const line of text.split('\n')) {
    const [lineSuffix, count] = line.trim().split(':');
    if (lineSuffix === suffix) return Number(count) || 0;
  }
  return 0;
}
