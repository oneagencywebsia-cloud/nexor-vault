'use client';

// Compartir zero-knowledge: cada usuario tiene un par RSA-OAEP-2048.
// public_key vive en claro en el server (es pública por definición).
// La privada se cifra con la propia vault key del usuario y solo se
// descifra en el navegador — el server nunca la ve en claro.
//
// Para compartir un item: se genera una AES key efímera, se cifra el item
// con ella (AES-GCM), y esa AES key se "envuelve" (RSA-OAEP encrypt) con la
// clave pública del receptor. Solo su clave privada puede desenvolverla.

import { decryptJson, encryptJson, type EncryptedBlob } from './crypto';

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const RSA_PARAMS = { name: 'RSA-OAEP', hash: 'SHA-256' } as const;

export interface KeyPairExport {
  publicKeyB64: string; // spki
  privateKeyB64: string; // pkcs8, en claro — solo existe en memoria un instante antes de cifrarse
}

export async function generateKeyPair(): Promise<KeyPairExport> {
  const keyPair = await crypto.subtle.generateKey(
    { ...RSA_PARAMS, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) },
    true,
    ['encrypt', 'decrypt'],
  );
  const [publicKeyRaw, privateKeyRaw] = await Promise.all([
    crypto.subtle.exportKey('spki', keyPair.publicKey),
    crypto.subtle.exportKey('pkcs8', keyPair.privateKey),
  ]);
  return { publicKeyB64: toBase64(publicKeyRaw), privateKeyB64: toBase64(privateKeyRaw) };
}

/** Cifra la clave privada (pkcs8) con la vault key del usuario para guardarla en el server. */
export async function encryptPrivateKey(vaultKey: Uint8Array, privateKeyB64: string): Promise<EncryptedBlob> {
  return encryptJson(vaultKey, { privateKeyB64 });
}

async function importPrivateKey(vaultKey: Uint8Array, blob: EncryptedBlob): Promise<CryptoKey> {
  const { privateKeyB64 } = await decryptJson<{ privateKeyB64: string }>(vaultKey, blob);
  return crypto.subtle.importKey('pkcs8', fromBase64(privateKeyB64) as BufferSource, RSA_PARAMS, false, ['decrypt']);
}

async function importPublicKey(publicKeyB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('spki', fromBase64(publicKeyB64) as BufferSource, RSA_PARAMS, false, ['encrypt']);
}

/** Envuelve una clave AES cruda (p.ej. la team key) con la clave pública RSA de un destinatario. */
export async function wrapRawKey(recipientPublicKeyB64: string, rawKey: Uint8Array): Promise<string> {
  const publicKey = await importPublicKey(recipientPublicKeyB64);
  const wrapped = await crypto.subtle.encrypt(RSA_PARAMS, publicKey, rawKey as BufferSource);
  return toBase64(wrapped);
}

/** Desenvuelve una clave AES cruda con la clave privada propia (descifrada con la vault key). */
export async function unwrapRawKey(
  vaultKey: Uint8Array,
  encryptedPrivateKey: EncryptedBlob,
  wrappedKeyB64: string,
): Promise<Uint8Array> {
  const privateKey = await importPrivateKey(vaultKey, encryptedPrivateKey);
  return new Uint8Array(await crypto.subtle.decrypt(RSA_PARAMS, privateKey, fromBase64(wrappedKeyB64) as BufferSource));
}

export interface SharedPackage {
  blob: EncryptedBlob;
  wrappedKey: string; // base64
}

/** Cifra `data` con una AES key efímera y envuelve esa key con la clave pública RSA del receptor. */
export async function encryptForRecipient(recipientPublicKeyB64: string, data: unknown): Promise<SharedPackage> {
  const aesKeyRaw = crypto.getRandomValues(new Uint8Array(32));
  const blob = await encryptJson(aesKeyRaw, data);
  const wrappedKey = await wrapRawKey(recipientPublicKeyB64, aesKeyRaw);
  return { blob, wrappedKey };
}

/** Desenvuelve la AES key con la clave privada propia y descifra el item compartido. */
export async function decryptSharedPackage<T>(
  vaultKey: Uint8Array,
  encryptedPrivateKey: EncryptedBlob,
  pkg: SharedPackage,
): Promise<T> {
  const aesKeyRaw = await unwrapRawKey(vaultKey, encryptedPrivateKey, pkg.wrappedKey);
  return decryptJson<T>(aesKeyRaw, pkg.blob);
}
