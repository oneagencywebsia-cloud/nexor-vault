import { describe, expect, it } from 'vitest';
import { buildOtpauthUri, generateTotpSecret, verifyTotp } from '@/lib/totp';
import { createHmac } from 'crypto';

// Reimplementa HOTP/base32 de forma independiente (RFC 4226/6238) para no
// depender de la implementación interna que estamos probando.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const idx = ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

describe('totp', () => {
  it('generateTotpSecret produce un secreto base32 válido y distinto cada vez', () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(a).not.toEqual(b);
    expect(a).toMatch(/^[A-Z2-7]+$/);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });

  it('buildOtpauthUri incluye el secreto, el email y los parámetros estándar', () => {
    const uri = buildOtpauthUri('JBSWY3DPEHPK3PXP', 'user@example.com', 'Nexor');
    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP');
    expect(uri).toContain('issuer=Nexor');
    expect(uri).toContain('digits=6');
    expect(uri).toContain('period=30');
  });

  it('verifyTotp acepta el código correcto calculado independientemente (RFC 4226)', () => {
    const secretB32 = generateTotpSecret();
    const counter = Math.floor(Date.now() / 1000 / 30);
    const expected = hotp(base32Decode(secretB32), counter);
    expect(verifyTotp(secretB32, expected)).toBe(true);
  });

  it('verifyTotp rechaza un código incorrecto', () => {
    const secretB32 = generateTotpSecret();
    const counter = Math.floor(Date.now() / 1000 / 30);
    const real = hotp(base32Decode(secretB32), counter);
    const wrong = String((Number(real) + 1) % 1_000_000).padStart(6, '0');
    expect(verifyTotp(secretB32, wrong)).toBe(false);
  });

  it('verifyTotp rechaza entradas que no son 6 dígitos', () => {
    const secretB32 = generateTotpSecret();
    expect(verifyTotp(secretB32, '12345')).toBe(false);
    expect(verifyTotp(secretB32, 'abcdef')).toBe(false);
    expect(verifyTotp(secretB32, '')).toBe(false);
  });

  it('verifyTotp tolera ±1 ventana de 30s (desfase de reloj)', () => {
    const secretB32 = generateTotpSecret();
    const counter = Math.floor(Date.now() / 1000 / 30);
    const previousWindowCode = hotp(base32Decode(secretB32), counter - 1);
    expect(verifyTotp(secretB32, previousWindowCode)).toBe(true);
  });

  it('verifyTotp rechaza un código de una ventana lejana (fuera de ±1)', () => {
    const secretB32 = generateTotpSecret();
    const counter = Math.floor(Date.now() / 1000 / 30);
    const farCode = hotp(base32Decode(secretB32), counter - 5);
    expect(verifyTotp(secretB32, farCode)).toBe(false);
  });
});
