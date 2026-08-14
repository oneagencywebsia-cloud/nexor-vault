import { describe, expect, it } from 'vitest';
import {
  decryptSharedPackage,
  encryptForRecipient,
  encryptPrivateKey,
  generateKeyPair,
  unwrapRawKey,
  wrapRawKey,
} from '@/lib/sharing';

describe('generateKeyPair', () => {
  it('genera un par de claves RSA-OAEP distinto en cada llamada', async () => {
    const a = await generateKeyPair();
    const b = await generateKeyPair();
    expect(a.publicKeyB64).not.toEqual(b.publicKeyB64);
    expect(a.privateKeyB64).not.toEqual(b.privateKeyB64);
    expect(a.publicKeyB64.length).toBeGreaterThan(100);
  });
});

describe('wrapRawKey / unwrapRawKey', () => {
  it('desenvuelve exactamente la misma clave AES que se envolvió', async () => {
    const { publicKeyB64, privateKeyB64 } = await generateKeyPair();
    const aesKey = crypto.getRandomValues(new Uint8Array(32));
    const wrapped = await wrapRawKey(publicKeyB64, aesKey);

    // Simula el flujo real: la privada se guarda cifrada con la vault key.
    const vaultKey = crypto.getRandomValues(new Uint8Array(32));
    const encryptedPrivateKey = await encryptPrivateKey(vaultKey, privateKeyB64);
    const unwrapped = await unwrapRawKey(vaultKey, encryptedPrivateKey, wrapped);

    expect(Array.from(unwrapped)).toEqual(Array.from(aesKey));
  });

  it('no se puede desenvolver con la clave privada de otro usuario', async () => {
    const alice = await generateKeyPair();
    const mallory = await generateKeyPair();
    const aesKey = crypto.getRandomValues(new Uint8Array(32));
    const wrappedForAlice = await wrapRawKey(alice.publicKeyB64, aesKey);

    const vaultKey = crypto.getRandomValues(new Uint8Array(32));
    const malloryEncryptedPrivateKey = await encryptPrivateKey(vaultKey, mallory.privateKeyB64);

    await expect(unwrapRawKey(vaultKey, malloryEncryptedPrivateKey, wrappedForAlice)).rejects.toThrow();
  });
});

describe('encryptForRecipient / decryptSharedPackage (flujo completo de compartir)', () => {
  it('el receptor descifra exactamente el item que el emisor compartió', async () => {
    const recipient = await generateKeyPair();
    const recipientVaultKey = crypto.getRandomValues(new Uint8Array(32));
    const recipientEncryptedPrivateKey = await encryptPrivateKey(recipientVaultKey, recipient.privateKeyB64);

    const item = { title: 'AWS Root', username: 'team@nexor.io', password: 'TeamSecret456!' };
    const pkg = await encryptForRecipient(recipient.publicKeyB64, item);

    const decrypted = await decryptSharedPackage<typeof item>(recipientVaultKey, recipientEncryptedPrivateKey, pkg);
    expect(decrypted).toEqual(item);
  });

  it('un tercero sin la clave privada correcta no puede descifrar el paquete compartido', async () => {
    const recipient = await generateKeyPair();
    const outsider = await generateKeyPair();

    const pkg = await encryptForRecipient(recipient.publicKeyB64, { secret: 'nope' });

    const outsiderVaultKey = crypto.getRandomValues(new Uint8Array(32));
    const outsiderEncryptedPrivateKey = await encryptPrivateKey(outsiderVaultKey, outsider.privateKeyB64);

    await expect(decryptSharedPackage(outsiderVaultKey, outsiderEncryptedPrivateKey, pkg)).rejects.toThrow();
  });
});
