import { describe, expect, it } from 'vitest';
import { generateTotpCode } from '@/lib/totp-client';

describe('generateTotpCode', () => {
  it('produce un código de 6 dígitos', async () => {
    const { code } = await generateTotpCode('JBSWY3DPEHPK3PXP');
    expect(code).toMatch(/^\d{6}$/);
  });

  it('es determinista para el mismo secreto y el mismo instante', async () => {
    const t = 1_700_000_000_000;
    const a = await generateTotpCode('JBSWY3DPEHPK3PXP', t);
    const b = await generateTotpCode('JBSWY3DPEHPK3PXP', t);
    expect(a.code).toBe(b.code);
    expect(a.secondsRemaining).toBe(b.secondsRemaining);
  });

  it('cambia de código al cruzar una ventana de 30s', async () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const t = 1_700_000_000_000;
    const before = await generateTotpCode(secret, t);
    const after = await generateTotpCode(secret, t + 30_000);
    expect(before.code).not.toBe(after.code);
  });

  it('secretos distintos producen códigos distintos en el mismo instante', async () => {
    const t = 1_700_000_000_000;
    const a = await generateTotpCode('JBSWY3DPEHPK3PXP', t);
    const b = await generateTotpCode('KRSXG5CTMVRXEZLU', t);
    expect(a.code).not.toBe(b.code);
  });

  it('secondsRemaining siempre está en (0, 30]', async () => {
    const { secondsRemaining } = await generateTotpCode('JBSWY3DPEHPK3PXP');
    expect(secondsRemaining).toBeGreaterThan(0);
    expect(secondsRemaining).toBeLessThanOrEqual(30);
  });
});
