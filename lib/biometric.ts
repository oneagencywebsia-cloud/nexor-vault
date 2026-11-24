// Desbloqueo con huella / Face ID / Touch ID / Windows Hello / llave FIDO2 mediante
// WebAuthn + extensión PRF. Lo usan la web (PWA) y la extensión de navegador.
//
// Cómo funciona (el mismo patrón que usan los gestores serios):
//  1. Se crea una credencial WebAuthn en el dispositivo con la extensión PRF. El
//     autenticador guarda un secreto que NUNCA sale de él y que solo puede
//     calcular tras verificar al usuario (huella, Face ID, PIN o toque de llave).
//  2. Con ese secreto (salida PRF) se deriva una clave AES-GCM que cifra la clave
//     de la bóveda. Lo único que se guarda en el dispositivo es esa clave de
//     bóveda YA CIFRADA ("BioRecord"): sin el autenticador no vale para nada, ni
//     siquiera con acceso total al disco.
//  3. Para desbloquear: el usuario se verifica, el autenticador devuelve la salida
//     PRF, se descifra la clave de la bóveda y se usa en memoria.
//
// La master password sigue funcionando siempre como alternativa. No todos los
// navegadores/sistemas/autenticadores admiten PRF: se detecta y se avisa.

export interface BioRecord {
  v: 1;
  /** Dominio al que está ligada la credencial (rpId). */
  rpId: string;
  /** Identificador de la credencial (base64url). */
  credId: string;
  /** Entrada aleatoria de la función PRF (base64). */
  prfSalt: string;
  /** Vector de inicialización AES-GCM (base64). */
  iv: string;
  /** Clave de la bóveda cifrada (base64). */
  wrapped: string;
  createdAt: number;
}

export type BioErrorCode = 'unsupported' | 'no-prf' | 'cancelled' | 'failed' | 'wrong-site';

export class BioError extends Error {
  constructor(
    public code: BioErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const BIO_MESSAGES: Record<BioErrorCode, string> = {
  unsupported: 'Este dispositivo o navegador no admite desbloqueo con huella, Face ID o llave.',
  'no-prf': 'Tu autenticador no admite el desbloqueo seguro (PRF). Prueba con otro método o usa la master password.',
  cancelled: 'Verificación cancelada.',
  failed: 'No se pudo verificar. Inténtalo de nuevo o usa la master password.',
  'wrong-site': 'Este desbloqueo se configuró para otro servidor. Vuelve a activarlo.',
};

// ───────────── utilidades base64 ─────────────

export function toB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
export function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export function toB64Url(bytes: Uint8Array): string {
  return toB64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
export function fromB64Url(b64url: string): Uint8Array {
  const pad = b64url.length % 4 === 0 ? '' : '='.repeat(4 - (b64url.length % 4));
  return fromB64(b64url.replace(/-/g, '+').replace(/_/g, '/') + pad);
}

const enc = new TextEncoder();
const buf = (u: Uint8Array) => u as BufferSource;

// ───────────── cifrado de la clave de la bóveda (puro, testeable) ─────────────

async function deriveKek(prfOutput: Uint8Array): Promise<CryptoKey> {
  const ikm = await crypto.subtle.importKey('raw', buf(prfOutput), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: buf(enc.encode('nexor-bio-kek/v1')), info: buf(enc.encode('wrap-vault-key')) },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// Los datos de contexto (dominio y credencial) van como datos autenticados: si
// alguien cambia el registro para usarlo con otra credencial o sitio, falla.
function aad(rpId: string, credId: string): Uint8Array {
  return enc.encode(`nexor-bio/v1|${rpId}|${credId}`);
}

export async function wrapVaultKey(
  prfOutput: Uint8Array,
  vaultKey: Uint8Array,
  meta: { rpId: string; credId: string; prfSalt: string },
): Promise<BioRecord> {
  const kek = await deriveKek(prfOutput);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrapped = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buf(iv), additionalData: buf(aad(meta.rpId, meta.credId)) }, kek, buf(vaultKey));
  return { v: 1, rpId: meta.rpId, credId: meta.credId, prfSalt: meta.prfSalt, iv: toB64(iv), wrapped: toB64(new Uint8Array(wrapped)), createdAt: Date.now() };
}

export async function unwrapVaultKey(prfOutput: Uint8Array, record: BioRecord): Promise<Uint8Array> {
  try {
    const kek = await deriveKek(prfOutput);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: buf(fromB64(record.iv)), additionalData: buf(aad(record.rpId, record.credId)) },
      kek,
      buf(fromB64(record.wrapped)),
    );
    return new Uint8Array(plain);
  } catch {
    throw new BioError('failed', BIO_MESSAGES.failed);
  }
}

// ───────────── ceremonias WebAuthn (solo devuelven la salida PRF) ─────────────

interface PrfOutputs {
  prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } };
}

export function bioSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined' && !!navigator.credentials?.create && !!navigator.credentials?.get;
}

function mapError(err: unknown): BioError {
  if (err instanceof BioError) return err;
  const name = (err as { name?: string } | null)?.name;
  if (name === 'NotAllowedError' || name === 'AbortError') return new BioError('cancelled', BIO_MESSAGES.cancelled);
  if (name === 'NotSupportedError') return new BioError('unsupported', BIO_MESSAGES.unsupported);
  if (name === 'SecurityError') return new BioError('wrong-site', BIO_MESSAGES['wrong-site']);
  return new BioError('failed', BIO_MESSAGES.failed);
}

const rand = (n: number) => crypto.getRandomValues(new Uint8Array(n));

/** Pide la salida PRF de una credencial ya creada. Exige verificación del usuario. */
export async function getBioPrf(rec: Pick<BioRecord, 'rpId' | 'credId' | 'prfSalt'>): Promise<Uint8Array> {
  if (!bioSupported()) throw new BioError('unsupported', BIO_MESSAGES.unsupported);
  try {
    const cred = (await navigator.credentials.get({
      publicKey: {
        rpId: rec.rpId,
        challenge: buf(rand(32)),
        allowCredentials: [{ type: 'public-key', id: buf(fromB64Url(rec.credId)) }],
        userVerification: 'required',
        timeout: 60_000,
        extensions: { prf: { eval: { first: buf(fromB64(rec.prfSalt)) } } } as AuthenticationExtensionsClientInputs,
      },
    })) as PublicKeyCredential | null;
    const first = (cred?.getClientExtensionResults() as PrfOutputs | undefined)?.prf?.results?.first;
    if (!first) throw new BioError('no-prf', BIO_MESSAGES['no-prf']);
    return new Uint8Array(first);
  } catch (err) {
    throw mapError(err);
  }
}

export interface NewBioCredential {
  credId: string;
  prfSalt: string;
  prfOutput: Uint8Array;
}

/** Crea una credencial con PRF y devuelve también su salida PRF (puede pedir una segunda verificación). */
export async function createBioCredential(opts: { rpId: string; rpName: string; userName: string; userId: Uint8Array }): Promise<NewBioCredential> {
  if (!bioSupported()) throw new BioError('unsupported', BIO_MESSAGES.unsupported);
  const salt = rand(32);
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        rp: { id: opts.rpId, name: opts.rpName },
        user: { id: buf(opts.userId), name: opts.userName, displayName: opts.userName },
        challenge: buf(rand(32)),
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
          { type: 'public-key', alg: -8 }, // EdDSA
        ],
        authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
        attestation: 'none',
        timeout: 60_000,
        extensions: { prf: { eval: { first: buf(salt) } } } as AuthenticationExtensionsClientInputs,
      },
    })) as PublicKeyCredential | null;
    if (!cred) throw new BioError('failed', BIO_MESSAGES.failed);

    const credId = toB64Url(new Uint8Array(cred.rawId));
    const prf = (cred.getClientExtensionResults() as PrfOutputs).prf;
    if (!prf?.enabled && !prf?.results?.first) throw new BioError('no-prf', BIO_MESSAGES['no-prf']);

    // Algunos autenticadores devuelven la salida al crear; otros hay que pedirla con una verificación más.
    const prfOutput = prf.results?.first ? new Uint8Array(prf.results.first) : await getBioPrf({ rpId: opts.rpId, credId, prfSalt: toB64(salt) });
    return { credId, prfSalt: toB64(salt), prfOutput };
  } catch (err) {
    throw mapError(err);
  }
}
