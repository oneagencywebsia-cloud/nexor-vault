import { describe, expect, it } from 'vitest';
import { matchBrandIcon } from '@/lib/brand-icon';

describe('matchBrandIcon', () => {
  it('reconoce nombres de marca exactos', () => {
    expect(matchBrandIcon('Instagram')?.slug).toBe('instagram');
    expect(matchBrandIcon('Google')?.slug).toBe('google');
    expect(matchBrandIcon('Hostinger')?.slug).toBe('hostinger');
  });

  it('reconoce la marca dentro de un nombre de carpeta más largo', () => {
    expect(matchBrandIcon('Cuenta de Instagram personal')?.slug).toBe('instagram');
    expect(matchBrandIcon('Trabajo - GitHub')?.slug).toBe('github');
  });

  it('es insensible a mayúsculas, espacios y acentos', () => {
    expect(matchBrandIcon('gOOgle')?.slug).toBe('google');
    expect(matchBrandIcon('  Netflix  ')?.slug).toBe('netflix');
  });

  it('prioriza el match más largo (más específico)', () => {
    expect(matchBrandIcon('Google Drive')?.slug).toBe('googledrive');
  });

  it('devuelve null si no reconoce ninguna marca', () => {
    expect(matchBrandIcon('Facturas del banco')).toBeNull();
    expect(matchBrandIcon('')).toBeNull();
  });
});
