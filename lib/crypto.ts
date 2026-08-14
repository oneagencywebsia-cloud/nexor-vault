'use client';

import { argon2id } from 'hash-wasm';

// Parámetros Argon2id (recomendación OWASP para uso interactivo en browser).
export const KDF_PARAMS = {
  algorithm: 'argon2id',
  iterations: 3,
  memory: 19456, // KiB (~19 MB)
  parallelism: 1,
  hashLength: 32,
} as const;

export type KdfParams = typeof KDF_PARAMS;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function generateSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return toBase64(bytes);
}

/** Deriva la masterKey (32 bytes) del master password. Nunca sale del cliente. */
export async function deriveMasterKey(password: string, saltB64: string): Promise<Uint8Array> {
  const salt = fromBase64(saltB64);
  const hex = await argon2id({
    password,
    salt,
    iterations: KDF_PARAMS.iterations,
    memorySize: KDF_PARAMS.memory,
    parallelism: KDF_PARAMS.parallelism,
    hashLength: KDF_PARAMS.hashLength,
    outputType: 'hex',
  });
  return fromBase64(hexToBase64(hex));
}

function hexToBase64(hex: string): string {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return toBase64(bytes);
}

/**
 * Deriva dos subclaves independientes de la masterKey vía HKDF:
 * - authKey: se hashea y se envía al server para autenticar (nunca cifra nada)
 * - vaultKey: cifra/descifra los items del vault, JAMÁS sale del cliente
 * Al ser subclaves HKDF independientes, el server (que solo ve el hash de authKey)
 * no puede derivar vaultKey aunque comprometa la base de datos.
 */
async function deriveSubkey(masterKey: Uint8Array, info: string): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey('raw', masterKey as BufferSource, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0) as BufferSource,
      info: new TextEncoder().encode(info) as BufferSource,
    },
    keyMaterial,
    256,
  );
  return new Uint8Array(bits);
}

export async function deriveAuthKey(masterKey: Uint8Array): Promise<Uint8Array> {
  return deriveSubkey(masterKey, 'keeper-clone/auth-key/v1');
}

export async function deriveVaultKey(masterKey: Uint8Array): Promise<Uint8Array> {
  return deriveSubkey(masterKey, 'keeper-clone/vault-key/v1');
}

/** Hash del authKey que se envía al servidor para login (no reversible a la vault key). */
export async function hashAuthKey(authKey: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', authKey as BufferSource);
  return toBase64(new Uint8Array(digest));
}

export interface EncryptedBlob {
  iv: string; // base64
  ciphertext: string; // base64
}

async function importVaultKey(vaultKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', vaultKey as BufferSource, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptJson(vaultKey: Uint8Array, data: unknown): Promise<EncryptedBlob> {
  const key = await importVaultKey(vaultKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, plaintext as BufferSource);
  return { iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)) };
}

export async function decryptJson<T>(vaultKey: Uint8Array, blob: EncryptedBlob): Promise<T> {
  const key = await importVaultKey(vaultKey);
  const iv = fromBase64(blob.iv);
  const ciphertext = fromBase64(blob.ciphertext);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, ciphertext as BufferSource);
  return JSON.parse(new TextDecoder().decode(plaintext));
}

export interface PasswordGenOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  digits: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}

const AMBIGUOUS = new Set(['l', 'I', '1', 'O', '0', 'o']);

export function generatePassword(opts: PasswordGenOptions): string {
  let charset = '';
  if (opts.uppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (opts.lowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
  if (opts.digits) charset += '0123456789';
  if (opts.symbols) charset += '!@#$%^&*()-_=+[]{}?';
  if (opts.excludeAmbiguous) {
    charset = charset
      .split('')
      .filter((c) => !AMBIGUOUS.has(c))
      .join('');
  }
  if (!charset) throw new Error('Selecciona al menos un tipo de carácter');

  const values = crypto.getRandomValues(new Uint32Array(opts.length));
  let result = '';
  for (let i = 0; i < opts.length; i++) {
    result += charset[values[i] % charset.length];
  }
  return result;
}
