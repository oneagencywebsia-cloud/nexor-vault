import { describe, expect, it } from 'vitest';
import { hashAuthHash, isHashedAuth, verifyAuthHash } from '@/lib/auth-hash';
import { isAllowedPushEndpoint } from '@/lib/push-endpoint';

describe('auth-hash (scrypt en servidor)', () => {
  it('guarda un hash distinto del authHash y con sal propia', async () => {
    const a = await hashAuthHash('abc123');
    const b = await hashAuthHash('abc123');
    expect(isHashedAuth(a)).toBe(true);
    expect(a).not.toContain('abc123');
    expect(a).not.toBe(b);
  });

  it('acepta el authHash correcto y rechaza el incorrecto', async () => {
    const stored = await hashAuthHash('correcto');
    expect((await verifyAuthHash(stored, 'correcto')).ok).toBe(true);
    expect((await verifyAuthHash(stored, 'incorrecto')).ok).toBe(false);
  });

  it('el valor guardado no sirve para iniciar sesión (pass-the-hash)', async () => {
    const stored = await hashAuthHash('secreto');
    expect((await verifyAuthHash(stored, stored)).ok).toBe(false);
  });

  it('cuentas antiguas (hash en claro) siguen entrando y piden migración', async () => {
    const ok = await verifyAuthHash('legacy-hash', 'legacy-hash');
    expect(ok).toEqual({ ok: true, needsUpgrade: true });
    expect((await verifyAuthHash('legacy-hash', 'otro')).ok).toBe(false);
  });

  it('usuario inexistente o registro corrupto: rechaza sin lanzar', async () => {
    expect((await verifyAuthHash(null, 'x')).ok).toBe(false);
    expect((await verifyAuthHash('scrypt$basura', 'x')).ok).toBe(false);
    expect((await verifyAuthHash('scrypt$99999999$8$1$AAAA$AAAA', 'x')).ok).toBe(false);
  });
});

describe('endpoints push permitidos (anti SSRF)', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/abc',
    'https://wns2-par02p.notify.windows.com/?token=abc',
  ])('admite %s', (u) => expect(isAllowedPushEndpoint(u)).toBe(true));

  it.each([
    'http://fcm.googleapis.com/x',
    'https://169.254.169.254/latest/meta-data',
    'https://localhost:3000/api',
    'https://fcm.googleapis.com.evil.com/x',
    'https://evilfcm.googleapis.com@evil.com/x',
    'https://user:pw@fcm.googleapis.com/x',
    'https://fcm.googleapis.com:8443/x',
    'file:///etc/passwd',
    'no-es-url',
    '',
  ])('rechaza %s', (u) => expect(isAllowedPushEndpoint(u)).toBe(false));

  it('rechaza lo que no es texto', () => {
    expect(isAllowedPushEndpoint(undefined)).toBe(false);
    expect(isAllowedPushEndpoint({})).toBe(false);
  });
});
