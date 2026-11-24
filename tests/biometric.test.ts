import { describe, expect, it } from 'vitest';
import { BioError, fromB64, fromB64Url, toB64, toB64Url, unwrapVaultKey, wrapVaultKey } from '@/lib/biometric';

const META = { rpId: 'nexor.example.com', credId: 'Y3JlZC1pZC0x', prfSalt: toB64(new Uint8Array(32).fill(7)) };
const vaultKey = () => crypto.getRandomValues(new Uint8Array(32));
const prf = () => crypto.getRandomValues(new Uint8Array(32));

describe('base64', () => {
  it('ida y vuelta, también en base64url', () => {
    const bytes = new Uint8Array([0, 250, 251, 252, 253, 254, 255, 62, 63]);
    expect(Array.from(fromB64(toB64(bytes)))).toEqual(Array.from(bytes));
    const url = toB64Url(bytes);
    expect(url).not.toMatch(/[+/=]/);
    expect(Array.from(fromB64Url(url))).toEqual(Array.from(bytes));
  });
});

describe('wrapVaultKey / unwrapVaultKey', () => {
  it('descifra la clave original con la misma salida PRF', async () => {
    const key = vaultKey();
    const p = prf();
    const rec = await wrapVaultKey(p, key, META);
    expect(rec.v).toBe(1);
    expect(rec.rpId).toBe(META.rpId);
    expect(Array.from(await unwrapVaultKey(p, rec))).toEqual(Array.from(key));
  });

  it('el registro guardado no contiene la clave en claro', async () => {
    const key = vaultKey();
    const rec = await wrapVaultKey(prf(), key, META);
    expect(JSON.stringify(rec)).not.toContain(toB64(key));
  });

  it('una salida PRF distinta (otro autenticador o usuario no verificado) no sirve', async () => {
    const rec = await wrapVaultKey(prf(), vaultKey(), META);
    await expect(unwrapVaultKey(prf(), rec)).rejects.toBeInstanceOf(BioError);
  });

  it('el registro está ligado a su sitio y a su credencial', async () => {
    const p = prf();
    const rec = await wrapVaultKey(p, vaultKey(), META);
    await expect(unwrapVaultKey(p, { ...rec, rpId: 'otro-sitio.com' })).rejects.toBeInstanceOf(BioError);
    await expect(unwrapVaultKey(p, { ...rec, credId: 'b3Rhcg' })).rejects.toBeInstanceOf(BioError);
  });

  it('detecta manipulación del texto cifrado', async () => {
    const p = prf();
    const rec = await wrapVaultKey(p, vaultKey(), META);
    const tampered = fromB64(rec.wrapped);
    tampered[0] ^= 0xff;
    await expect(unwrapVaultKey(p, { ...rec, wrapped: toB64(tampered) })).rejects.toBeInstanceOf(BioError);
  });

  it('cada cifrado usa un IV nuevo', async () => {
    const p = prf();
    const key = vaultKey();
    const a = await wrapVaultKey(p, key, META);
    const b = await wrapVaultKey(p, key, META);
    expect(a.iv).not.toBe(b.iv);
    expect(a.wrapped).not.toBe(b.wrapped);
  });
});
