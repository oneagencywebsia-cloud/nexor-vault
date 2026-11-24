'use client';

// Desbloqueo con huella / Face ID / llave en la web (PWA): une el módulo WebAuthn PRF
// (lib/biometric.ts) con el almacenamiento del dispositivo. En el dispositivo solo se
// guarda la clave de la bóveda YA CIFRADA con el secreto del autenticador.

import {
  BioError,
  bioSupported,
  createBioCredential,
  getBioPrf,
  unwrapVaultKey,
  wrapVaultKey,
  type BioRecord,
} from '@/lib/biometric';

const KEY_PREFIX = 'nexor:bio:v1:';

function storageKey(email: string): string {
  return KEY_PREFIX + email.toLowerCase().trim();
}

export function webBioSupported(): boolean {
  return bioSupported();
}

export function getWebBio(email: string): BioRecord | null {
  try {
    const raw = localStorage.getItem(storageKey(email));
    if (!raw) return null;
    const rec = JSON.parse(raw) as BioRecord;
    // El registro solo vale para el dominio actual (las credenciales están ligadas al sitio).
    return rec?.v === 1 && rec.rpId === location.hostname ? rec : null;
  } catch {
    return null;
  }
}

export function removeWebBio(email: string): void {
  try {
    localStorage.removeItem(storageKey(email));
  } catch {
    /* almacenamiento no disponible */
  }
}

/** Activa el desbloqueo rápido en este dispositivo (requiere la bóveda desbloqueada). */
export async function enrollWebBio(email: string, vaultKey: Uint8Array): Promise<void> {
  const userId = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email.toLowerCase().trim())));
  const rpId = location.hostname;
  const cred = await createBioCredential({ rpId, rpName: 'Nexor Vault', userName: email, userId });
  const record = await wrapVaultKey(cred.prfOutput, vaultKey, { rpId, credId: cred.credId, prfSalt: cred.prfSalt });
  localStorage.setItem(storageKey(email), JSON.stringify(record));
}

/** Pide huella / Face ID / llave y devuelve la clave de la bóveda. */
export async function unlockWebBio(email: string): Promise<Uint8Array> {
  const record = getWebBio(email);
  if (!record) throw new BioError('failed', 'El desbloqueo rápido no está activado en este dispositivo.');
  const prf = await getBioPrf(record);
  return unwrapVaultKey(prf, record);
}

export { BioError, BIO_MESSAGES } from '@/lib/biometric';
