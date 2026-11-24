import { describe, expect, it } from 'vitest';
import { safeNext } from '@/lib/safe-next';

describe('safeNext', () => {
  it('acepta rutas internas, con query', () => {
    expect(safeNext('/open?url=https%3A%2F%2Fexample.com')).toBe('/open?url=https://example.com');
    expect(safeNext(encodeURIComponent('/open?url=https://example.com'))).toBe('/open?url=https://example.com');
    expect(safeNext('/vault')).toBe('/vault');
  });

  it('rechaza todo lo que pueda salir del sitio', () => {
    expect(safeNext('https://evil.com')).toBeNull();
    expect(safeNext('//evil.com')).toBeNull();
    expect(safeNext('/\\evil.com')).toBeNull();
    expect(safeNext('%2F%2Fevil.com')).toBeNull();
    expect(safeNext('javascript:alert(1)')).toBeNull();
    expect(safeNext('/\t/evil.com')).toBeNull();
    expect(safeNext('evil.com')).toBeNull();
  });

  it('rechaza vacío o malformado', () => {
    expect(safeNext(null)).toBeNull();
    expect(safeNext('')).toBeNull();
    expect(safeNext('%E0%A4%A')).toBeNull();
  });
});
