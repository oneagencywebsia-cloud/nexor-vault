import { describe, expect, it } from 'vitest';
import { classifyCapture, pickPassword, titleFromHost } from '@/lib/capture-logic';

const f = (value: string, autocomplete = '') => ({ value, autocomplete });

describe('pickPassword', () => {
  it('un campo → inicio de sesión', () => {
    expect(pickPassword([f('abc')])).toEqual({ password: 'abc', kind: 'login' });
  });
  it('dos iguales → registro', () => {
    expect(pickPassword([f('abc'), f('abc')])).toEqual({ password: 'abc', kind: 'register' });
  });
  it('dos distintas → ambiguo, se ignora', () => {
    expect(pickPassword([f('abc'), f('xyz')])).toBeNull();
  });
  it('tres (actual, nueva, confirmar) → cambio con la nueva', () => {
    expect(pickPassword([f('vieja'), f('nueva'), f('nueva')])).toEqual({ password: 'nueva', kind: 'change' });
  });
  it('autocomplete=new-password manda sobre la posición', () => {
    expect(pickPassword([f('vieja', 'current-password'), f('nueva', 'new-password')])).toEqual({ password: 'nueva', kind: 'change' });
    expect(pickPassword([f('nueva', 'new-password')])).toEqual({ password: 'nueva', kind: 'register' });
  });
  it('ignora campos vacíos y contraseñas demasiado largas', () => {
    expect(pickPassword([f('')])).toBeNull();
    expect(pickPassword([f('a'.repeat(300))])).toBeNull();
    expect(pickPassword([f(''), f('abc')])).toEqual({ password: 'abc', kind: 'login' });
  });
});

describe('classifyCapture', () => {
  const items = [
    { id: '1', url: 'https://github.com', username: 'Ana', password: 'p1' },
    { id: '2', url: 'https://github.com', username: 'bob', password: 'p2' },
    { id: '3', url: 'https://otra.com', username: 'ana', password: 'p3' },
  ];
  const page = 'https://github.com/login';

  it('mismo usuario y contraseña → same', () => {
    expect(classifyCapture(items, { pageUrl: page, username: 'ana', password: 'p1' })).toEqual({ decision: 'same', itemId: '1' });
  });
  it('mismo usuario, otra contraseña → update', () => {
    expect(classifyCapture(items, { pageUrl: page, username: 'ANA', password: 'nueva' })).toEqual({ decision: 'update', itemId: '1' });
  });
  it('usuario distinto → new', () => {
    expect(classifyCapture(items, { pageUrl: page, username: 'carla', password: 'x' })).toEqual({ decision: 'new' });
  });
  it('web sin acceso guardado → new', () => {
    expect(classifyCapture(items, { pageUrl: 'https://nueva.com/login', username: 'ana', password: 'p1' })).toEqual({ decision: 'new' });
  });
  it('un dominio relacionado NO cuenta como el mismo acceso', () => {
    expect(classifyCapture(items, { pageUrl: 'https://gist.github.com/', username: 'ana', password: 'x' })).toEqual({ decision: 'new' });
  });
  it('sin usuario: solo se asume si hay un único acceso en esa web', () => {
    expect(classifyCapture(items, { pageUrl: page, username: '', password: 'x' })).toEqual({ decision: 'new' }); // hay 2
    expect(classifyCapture([items[2]], { pageUrl: 'https://otra.com/', username: '', password: 'nueva' })).toEqual({ decision: 'update', itemId: '3' });
  });
});

describe('titleFromHost', () => {
  it('quita www.', () => {
    expect(titleFromHost('www.github.com')).toBe('github.com');
    expect(titleFromHost('')).toBe('Nuevo acceso');
  });
});
