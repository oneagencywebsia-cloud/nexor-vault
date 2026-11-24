import { describe, expect, it } from 'vitest';
import {
  collectFolderPaths,
  dedupeKey,
  detectSource,
  extractTotpSecret,
  markDuplicates,
  normalizeDomain,
  parseCsv,
  parseImport,
} from '@/lib/import-csv';

describe('parseCsv', () => {
  it('lee comillas, comillas escapadas y saltos de línea dentro de un campo', () => {
    const rows = parseCsv('a,b,c\n"hola, mundo","di ""hola""","línea1\nlínea2"\n');
    expect(rows).toEqual([
      ['a', 'b', 'c'],
      ['hola, mundo', 'di "hola"', 'línea1\nlínea2'],
    ]);
  });

  it('acepta \\r\\n, BOM y descarta líneas vacías', () => {
    const rows = parseCsv('﻿x,y\r\n1,2\r\n\r\n');
    expect(rows).toEqual([
      ['x', 'y'],
      ['1', '2'],
    ]);
  });
});

describe('detectSource', () => {
  it('reconoce cada gestor por sus cabeceras', () => {
    expect(detectSource(['folder', 'favorite', 'type', 'name', 'login_uri', 'login_username', 'login_password'])).toBe('bitwarden');
    expect(detectSource(['url', 'username', 'password', 'totp', 'extra', 'name', 'grouping', 'fav'])).toBe('lastpass');
    expect(detectSource(['url', 'username', 'password', 'httpRealm', 'formActionOrigin'])).toBe('firefox');
    expect(detectSource(['Title', 'Url', 'Username', 'Password', 'Notes', 'Type'])).toBe('1password');
    expect(detectSource(['Group', 'Title', 'Username', 'Password', 'URL', 'Notes'])).toBe('keepass');
    expect(detectSource(['name', 'url', 'username', 'password'])).toBe('chrome');
    expect(detectSource(['sitio', 'clave'])).toBe('generic');
  });
});

describe('normalizeDomain / dedupeKey', () => {
  it('quita esquema, www y ruta', () => {
    expect(normalizeDomain('https://www.Example.com/login?x=1')).toBe('example.com');
    expect(normalizeDomain('example.com')).toBe('example.com');
    expect(normalizeDomain('')).toBe('');
  });

  it('la clave ignora mayúsculas y www', () => {
    const a = dedupeKey({ url: 'https://www.github.com', username: 'Ana@Mail.com', title: 'GitHub' });
    const b = dedupeKey({ url: 'github.com/login', username: 'ana@mail.com', title: 'Otro' });
    expect(a).toBe(b);
  });
});

describe('extractTotpSecret', () => {
  it('extrae el secreto de un otpauth:// y acepta base32 suelto', () => {
    expect(extractTotpSecret('otpauth://totp/GitHub:ana?secret=jbsw y3dp ehpk3pxp&issuer=GitHub')).toBe('JBSWY3DPEHPK3PXP');
    expect(extractTotpSecret('JBSWY3DPEHPK3PXP')).toBe('JBSWY3DPEHPK3PXP');
  });
  it('descarta valores no válidos', () => {
    expect(extractTotpSecret('')).toBeUndefined();
    expect(extractTotpSecret('no es base32 !!')).toBeUndefined();
    expect(extractTotpSecret('otpauth://totp/x')).toBeUndefined();
  });
});

describe('parseImport', () => {
  it('importa un CSV de Bitwarden, con carpeta, 2FA y tipos no soportados saltados', () => {
    const csv = [
      'folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp',
      'Clientes/Acme,,login,Instagram Acme,nota 1,,0,https://instagram.com,acme,Sup3r-secreta!,otpauth://totp/x?secret=JBSWY3DPEHPK3PXP',
      ',,note,Nota suelta,solo nota,,0,,,,',
      ',,login,,,,0,https://www.shopify.com,tienda@acme.com,otra-clave-1,',
    ].join('\n');
    const r = parseImport(csv);
    expect(r.source).toBe('bitwarden');
    expect(r.items).toHaveLength(2);
    expect(r.items[0]).toMatchObject({
      title: 'Instagram Acme',
      username: 'acme',
      url: 'https://instagram.com',
      folder: 'Clientes/Acme',
      totpSecret: 'JBSWY3DPEHPK3PXP',
    });
    // sin título: usa el dominio
    expect(r.items[1].title).toBe('shopify.com');
    expect(r.skipped).toEqual([{ line: 3, reason: 'Tipo "note" no soportado (solo inicios de sesión)' }]);
  });

  it('importa un CSV de Chrome y salta filas vacías', () => {
    // la 3.ª fila solo tiene título (sin usuario, contraseña ni 2FA) y la 4.ª está vacía del todo
    const csv = 'name,url,username,password,note\nGitHub,https://github.com,ana,pw12345678,\nSolo título,,,,\n,,,,';
    const r = parseImport(csv);
    expect(r.source).toBe('chrome');
    expect(r.items).toHaveLength(1);
    expect(r.skipped).toEqual([{ line: 3, reason: 'Fila sin usuario, contraseña ni 2FA' }]);
  });

  it('LastPass: las carpetas usan "\\" como separador', () => {
    const csv = 'url,username,password,totp,extra,name,grouping,fav\nhttps://a.com,u,p,,,A,Trabajo\\Web,0';
    const r = parseImport(csv);
    expect(r.items[0].folder).toBe('Trabajo/Web');
  });

  it('avisa si no reconoce las columnas', () => {
    const r = parseImport('foo,bar\n1,2');
    expect(r.items).toHaveLength(0);
    expect(r.warnings[0]).toMatch(/No reconozco las columnas/);
  });

  it('avisa de 2FA con formato no válido', () => {
    const r = parseImport('name,url,username,password,totp\nA,a.com,u,p,%%%');
    expect(r.items).toHaveLength(1);
    expect(r.items[0].totpSecret).toBeUndefined();
    expect(r.warnings.join(' ')).toMatch(/2FA/);
  });
});

describe('markDuplicates', () => {
  const incoming = [
    { title: 'GitHub', username: 'ana', password: 'x1', url: 'https://github.com', notes: '', folder: null },
    { title: 'GitHub bis', username: 'ana', password: 'x2', url: 'github.com', notes: '', folder: null },
    { title: 'Shopify', username: 'tienda', password: 'y1', url: 'https://shopify.com', notes: '', folder: null },
  ];

  it('detecta duplicados contra la bóveda y dentro del archivo', () => {
    const existing = [{ title: 'Shopify', username: 'tienda', password: 'y1', url: 'https://www.shopify.com' }];
    const r = markDuplicates(incoming, existing);
    expect(r.map((x) => x.duplicate)).toEqual([null, 'file', 'existing']);
    expect(r[2].samePassword).toBe(true);
  });

  it('distingue duplicado con contraseña distinta', () => {
    const r = markDuplicates([incoming[2]], [{ title: 'Shopify', username: 'tienda', password: 'otra', url: 'shopify.com' }]);
    expect(r[0]).toMatchObject({ duplicate: 'existing', samePassword: false });
  });
});

describe('collectFolderPaths', () => {
  it('devuelve padres antes que hijos y sin repetir', () => {
    const items = [
      { folder: 'A/B/C' },
      { folder: 'A' },
      { folder: 'Z' },
      { folder: null },
    ].map((x) => ({ title: 't', username: '', password: '', url: '', notes: '', ...x }));
    expect(collectFolderPaths(items)).toEqual(['A', 'Z', 'A/B', 'A/B/C']);
  });
});
