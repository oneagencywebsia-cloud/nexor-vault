import { describe, expect, it } from 'vitest';
import {
  deriveAuthKey,
  deriveMasterKey,
  deriveVaultKey,
  decryptJson,
  encryptJson,
  generatePassword,
  generateSalt,
  hashAuthKey,
} from '@/lib/crypto';

describe('generateSalt', () => {
  it('produce salts distintos en cada llamada', () => {
    const a = generateSalt();
    const b = generateSalt();
    expect(a).not.toEqual(b);
  });
});

describe('derivación de claves (Argon2id + HKDF)', () => {
  it('la misma password+salt siempre deriva la misma masterKey (determinista)', async () => {
    const salt = generateSalt();
    const a = await deriveMasterKey('CorrectHorseBattery99!', salt);
    const b = await deriveMasterKey('CorrectHorseBattery99!', salt);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('una password distinta deriva una masterKey distinta', async () => {
    const salt = generateSalt();
    const a = await deriveMasterKey('CorrectHorseBattery99!', salt);
    const b = await deriveMasterKey('WrongPassword123!', salt);
    expect(Array.from(a)).not.toEqual(Array.from(b));
  }, 15000);

  it('authKey y vaultKey son subclaves HKDF distintas entre sí', async () => {
    const salt = generateSalt();
    const masterKey = await deriveMasterKey('CorrectHorseBattery99!', salt);
    const authKey = await deriveAuthKey(masterKey);
    const vaultKey = await deriveVaultKey(masterKey);
    expect(Array.from(authKey)).not.toEqual(Array.from(vaultKey));
    expect(authKey.length).toBe(32);
    expect(vaultKey.length).toBe(32);
  }, 15000);

  it('hashAuthKey es determinista para la misma authKey', async () => {
    const salt = generateSalt();
    const masterKey = await deriveMasterKey('CorrectHorseBattery99!', salt);
    const authKey = await deriveAuthKey(masterKey);
    const h1 = await hashAuthKey(authKey);
    const h2 = await hashAuthKey(authKey);
    expect(h1).toEqual(h2);
  }, 15000);
}, 20000);

describe('encryptJson / decryptJson (AES-256-GCM)', () => {
  it('descifra exactamente lo que se cifró (round-trip)', async () => {
    const key = crypto.getRandomValues(new Uint8Array(32));
    const data = { title: 'GitHub', password: 'F&hJvQw2*FNg(d^G&RRS', notes: 'ñáé€' };
    const blob = await encryptJson(key, data);
    const decrypted = await decryptJson<typeof data>(key, blob);
    expect(decrypted).toEqual(data);
  });

  it('cada cifrado usa un IV distinto (el mismo dato no produce el mismo ciphertext)', async () => {
    const key = crypto.getRandomValues(new Uint8Array(32));
    const blob1 = await encryptJson(key, { a: 1 });
    const blob2 = await encryptJson(key, { a: 1 });
    expect(blob1.iv).not.toEqual(blob2.iv);
    expect(blob1.ciphertext).not.toEqual(blob2.ciphertext);
  });

  it('descifrar con la key equivocada falla en vez de devolver basura silenciosamente', async () => {
    const key = crypto.getRandomValues(new Uint8Array(32));
    const wrongKey = crypto.getRandomValues(new Uint8Array(32));
    const blob = await encryptJson(key, { secret: true });
    await expect(decryptJson(wrongKey, blob)).rejects.toThrow();
  });
});

describe('generatePassword', () => {
  it('respeta la longitud pedida', () => {
    const pwd = generatePassword({
      length: 24,
      uppercase: true,
      lowercase: true,
      digits: true,
      symbols: true,
      excludeAmbiguous: false,
    });
    expect(pwd.length).toBe(24);
  });

  it('con solo dígitos activados, no genera letras ni símbolos', () => {
    const pwd = generatePassword({
      length: 40,
      uppercase: false,
      lowercase: false,
      digits: true,
      symbols: false,
      excludeAmbiguous: false,
    });
    expect(pwd).toMatch(/^[0-9]+$/);
  });

  it('excludeAmbiguous elimina caracteres confundibles (l, I, 1, O, 0)', () => {
    const pwd = generatePassword({
      length: 500,
      uppercase: true,
      lowercase: true,
      digits: true,
      symbols: false,
      excludeAmbiguous: true,
    });
    expect(pwd).not.toMatch(/[lI1O0o]/);
  });

  it('lanza si no se selecciona ningún tipo de carácter', () => {
    expect(() =>
      generatePassword({
        length: 10,
        uppercase: false,
        lowercase: false,
        digits: false,
        symbols: false,
        excludeAmbiguous: false,
      }),
    ).toThrow();
  });

  it('dos generaciones consecutivas no son iguales (aleatoriedad real)', () => {
    const opts = { length: 20, uppercase: true, lowercase: true, digits: true, symbols: true, excludeAmbiguous: true };
    const a = generatePassword(opts);
    const b = generatePassword(opts);
    expect(a).not.toEqual(b);
  });
});
