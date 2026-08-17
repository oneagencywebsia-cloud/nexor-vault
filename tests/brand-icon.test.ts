import { describe, expect, it } from 'vitest';
import { matchBrandIcon } from '@/lib/brand-icon';

function slugOf(name: string) {
  const m = matchBrandIcon(name);
  return m?.kind === 'svg' ? m.slug : undefined;
}

function abbrOf(name: string) {
  const m = matchBrandIcon(name);
  return m?.kind === 'mono' ? m.abbr : undefined;
}

describe('matchBrandIcon', () => {
  it('reconoce nombres de marca exactos', () => {
    expect(slugOf('Instagram')).toBe('instagram');
    expect(slugOf('Google')).toBe('google');
    expect(slugOf('Hostinger')).toBe('hostinger');
  });

  it('reconoce la marca dentro de un nombre de carpeta más largo', () => {
    expect(slugOf('Cuenta de Instagram personal')).toBe('instagram');
    expect(slugOf('Trabajo - GitHub')).toBe('github');
  });

  it('es insensible a mayúsculas, espacios y acentos', () => {
    expect(slugOf('gOOgle')).toBe('google');
    expect(slugOf('  Netflix  ')).toBe('netflix');
  });

  it('prioriza el match más largo (más específico)', () => {
    expect(slugOf('Google Drive')).toBe('googledrive');
  });

  it('devuelve null si no reconoce ninguna marca', () => {
    expect(matchBrandIcon('Facturas del banco')).toBeNull();
    expect(matchBrandIcon('')).toBeNull();
  });

  it('reconoce marcas grandes ausentes de simple-icons con logo real (Font Awesome) o insignia', () => {
    expect(abbrOf('Outlook')).toBe('Ou');
    expect(abbrOf('Adobe')).toBe('Ad');
    expect(slugOf('Microsoft')).toBe('fa-microsoft');
    expect(slugOf('LinkedIn')).toBe('fa-linkedin');
    expect(slugOf('Cuenta de Amazon')).toBe('fa-amazon');
  });
});
