import { describe, expect, it } from 'vitest';
import { findReusedPasswordIds, scoreStrength } from '@/lib/audit';

describe('scoreStrength', () => {
  it('marca como débil una contraseña corta', () => {
    expect(scoreStrength('abc123')).toBe('weak');
  });

  it('marca como débil una contraseña larga pero de una sola clase de carácter', () => {
    expect(scoreStrength('aaaaaaaaaaaaaaaaaaaa')).toBe('weak');
  });

  it('marca como débil contraseñas comunes famosas aunque cumplan longitud/variedad', () => {
    expect(scoreStrength('password123')).toBe('weak');
  });

  it('marca como aceptable una contraseña de longitud media con variedad moderada', () => {
    expect(scoreStrength('Correcto7Cab')).toBe('fair');
  });

  it('marca como fuerte una contraseña larga con las 4 clases de carácter', () => {
    expect(scoreStrength('F&hJvQw2*FNg(d^G&RRS')).toBe('strong');
  });

  it('trata la contraseña vacía como débil', () => {
    expect(scoreStrength('')).toBe('weak');
  });
});

describe('findReusedPasswordIds', () => {
  it('no marca nada si todas las contraseñas son distintas', () => {
    const reused = findReusedPasswordIds([
      { id: 'a', password: 'one' },
      { id: 'b', password: 'two' },
    ]);
    expect(reused.size).toBe(0);
  });

  it('marca todos los ids que comparten la misma contraseña', () => {
    const reused = findReusedPasswordIds([
      { id: 'a', password: 'shared' },
      { id: 'b', password: 'unique' },
      { id: 'c', password: 'shared' },
    ]);
    expect(reused.has('a')).toBe(true);
    expect(reused.has('c')).toBe(true);
    expect(reused.has('b')).toBe(false);
  });

  it('ignora entradas sin contraseña', () => {
    const reused = findReusedPasswordIds([
      { id: 'a', password: '' },
      { id: 'b', password: '' },
    ]);
    expect(reused.size).toBe(0);
  });

  it('detecta reutilización entre más de dos items', () => {
    const reused = findReusedPasswordIds([
      { id: 'a', password: 'x' },
      { id: 'b', password: 'x' },
      { id: 'c', password: 'x' },
    ]);
    expect(reused.size).toBe(3);
  });
});
