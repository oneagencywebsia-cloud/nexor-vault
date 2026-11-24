import 'server-only';
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'crypto';

/**
 * El cliente envía authHash = SHA-256(authKey), derivado de la master password
 * con Argon2id. Guardarlo tal cual en la base de datos significaría que quien
 * obtenga una copia de la BD podría iniciar sesión directamente con él
 * ("pass-the-hash"). Por eso el servidor guarda además un scrypt con sal propia
 * del authHash recibido: una filtración de la BD ya no sirve para entrar.
 *
 * Formato guardado: `scrypt$N$r$p$<saltB64>$<hashB64>`.
 * Los registros antiguos (authHash en claro) se siguen aceptando y se migran al
 * formato nuevo en el siguiente login correcto.
 */

const PREFIX = 'scrypt$';
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 32;

function scrypt(secret: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(secret, salt, KEYLEN, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

export function isHashedAuth(stored: string): boolean {
  return stored.startsWith(PREFIX);
}

export async function hashAuthHash(authHash: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(authHash, salt, N, R, P);
  return `${PREFIX}${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

// Hash de relleno para que "usuario inexistente" tarde lo mismo que "contraseña mala".
let dummy: Promise<string> | null = null;

export interface AuthCheck {
  ok: boolean;
  /** true si el valor guardado está en formato antiguo y conviene reescribirlo. */
  needsUpgrade: boolean;
}

export async function verifyAuthHash(stored: string | null | undefined, authHash: string): Promise<AuthCheck> {
  if (!stored) {
    dummy ??= hashAuthHash('nexor-dummy');
    await verifyAuthHash(await dummy, authHash);
    return { ok: false, needsUpgrade: false };
  }

  if (!isHashedAuth(stored)) {
    // Formato antiguo: comparación directa en tiempo constante.
    const ok = safeEqual(Buffer.from(stored), Buffer.from(authHash));
    return { ok, needsUpgrade: ok };
  }

  const parts = stored.slice(PREFIX.length).split('$');
  if (parts.length !== 5) return { ok: false, needsUpgrade: false };
  const [n, r, p] = parts.slice(0, 3).map(Number);
  if (![n, r, p].every((v) => Number.isInteger(v) && v > 0) || n > 1 << 20) {
    return { ok: false, needsUpgrade: false };
  }
  const salt = Buffer.from(parts[3], 'base64');
  const expected = Buffer.from(parts[4], 'base64');
  const actual = await scrypt(authHash, salt, n, r, p);
  return { ok: safeEqual(actual, expected), needsUpgrade: false };
}
