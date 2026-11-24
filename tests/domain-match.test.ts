import { describe, expect, it } from 'vitest';
import { hostOf, isFillablePage, matchKind, registrableDomain } from '@/lib/domain-match';

describe('hostOf', () => {
  it('normaliza: minúsculas, sin esquema, sin www ni punto final', () => {
    expect(hostOf('https://WWW.Example.com/login?x=1')).toBe('example.com');
    expect(hostOf('example.com/path')).toBe('example.com');
    expect(hostOf('https://example.com.')).toBe('example.com');
  });
  it('devuelve vacío si no hay URL válida', () => {
    expect(hostOf('')).toBe('');
    expect(hostOf('   ')).toBe('');
    expect(hostOf('http://')).toBe('');
  });
});

describe('isFillablePage', () => {
  it('solo https, o http en localhost', () => {
    expect(isFillablePage('https://example.com')).toBe(true);
    expect(isFillablePage('http://localhost:3000/login')).toBe(true);
    expect(isFillablePage('http://127.0.0.1:8080')).toBe(true);
    expect(isFillablePage('http://example.com')).toBe(false);
    expect(isFillablePage('chrome://extensions')).toBe(false);
    expect(isFillablePage('file:///C:/x.html')).toBe(false);
    expect(isFillablePage('nonsense')).toBe(false);
  });
});

describe('registrableDomain', () => {
  it('reduce a dominio + TLD, con sufijos de segundo nivel', () => {
    expect(registrableDomain('login.acme.com')).toBe('acme.com');
    expect(registrableDomain('acme.com')).toBe('acme.com');
    expect(registrableDomain('a.b.acme.co.uk')).toBe('acme.co.uk');
    expect(registrableDomain('tienda.empresa.com.es')).toBe('empresa.com.es');
    expect(registrableDomain('192.168.0.1')).toBe('192.168.0.1');
  });
});

describe('matchKind (qué se puede rellenar)', () => {
  it('exacto: mismo host, ignorando www', () => {
    expect(matchKind('instagram.com', 'https://www.instagram.com/accounts/login')).toBe('exact');
    expect(matchKind('https://mail.google.com', 'https://mail.google.com/')).toBe('exact');
  });

  it('relacionado: mismo dominio registrable, distinto host (requiere confirmar)', () => {
    expect(matchKind('https://acme.com', 'https://login.acme.com/signin')).toBe('related');
    expect(matchKind('https://accounts.acme.com', 'https://acme.com')).toBe('related');
  });

  it('rechaza dominios parecidos pero distintos (phishing)', () => {
    expect(matchKind('https://example.com', 'https://evil-example.com')).toBeNull();
    expect(matchKind('https://example.com', 'https://example.com.evil.net')).toBeNull();
    expect(matchKind('https://example.com', 'https://examp1e.com')).toBeNull();
    expect(matchKind('https://example.com', 'https://notexample.com')).toBeNull();
  });

  it('no coincide si la página no es segura o el acceso no tiene URL', () => {
    expect(matchKind('example.com', 'http://example.com')).toBeNull();
    expect(matchKind('', 'https://example.com')).toBeNull();
    expect(matchKind('example.com', 'chrome://newtab')).toBeNull();
  });

  it('funciona en localhost para desarrollo', () => {
    expect(matchKind('http://localhost:3000', 'http://localhost:3000/login')).toBe('exact');
  });
});
