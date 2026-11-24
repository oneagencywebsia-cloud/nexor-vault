import { describe, expect, it } from 'vitest';
import { ageInDays, buildAlerts, humanAge, type AlertInput } from '@/lib/alerts';

const NOW = Date.parse('2026-11-24T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 86400000).toISOString();

function item(over: Partial<AlertInput> & { id: string }): AlertInput {
  return {
    title: over.id,
    password: 'Sup3r-larga-y-unica!',
    hasTotp: false,
    updatedAt: daysAgo(10),
    strength: 'strong',
    reusedWith: [],
    pwnedCount: 0,
    ...over,
  };
}
const titles = (items: AlertInput[]) => new Map(items.map((i) => [i.id, i.title]));

describe('buildAlerts', () => {
  it('no genera alertas para accesos sanos y recientes', () => {
    const items = [item({ id: 'a' }), item({ id: 'b' })];
    expect(buildAlerts(items, titles(items), NOW)).toEqual([]);
  });

  it('prioriza filtrada > reutilizada > débil > antigua', () => {
    const items = [
      item({ id: 'vieja', updatedAt: daysAgo(800) }),
      item({ id: 'debil', strength: 'weak' }),
      item({ id: 'repe', reusedWith: ['x'] }),
      item({ id: 'filtrada', pwnedCount: 5000 }),
    ];
    const order = buildAlerts(items, titles(items), NOW).map((a) => a.id);
    expect(order).toEqual(['filtrada', 'repe', 'debil', 'vieja']);
  });

  it('una filtrada es siempre crítica; combinar señales sube la prioridad', () => {
    const items = [item({ id: 'p', pwnedCount: 3 }), item({ id: 'combo', strength: 'weak', reusedWith: ['a', 'b'] })];
    const [first, second] = buildAlerts(items, titles(items), NOW);
    expect(first.id).toBe('p');
    expect(first.severity).toBe('critical');
    expect(second.kinds).toEqual(expect.arrayContaining(['weak', 'reused']));
    expect(second.headline).toMatch(/Débil y repetida/);
  });

  it('el 2FA reduce la urgencia', () => {
    const base = { strength: 'weak' as const };
    const items = [item({ id: 'sin', ...base }), item({ id: 'con', hasTotp: true, ...base })];
    const [a, b] = buildAlerts(items, titles(items), NOW);
    expect(a.id).toBe('sin');
    expect(b.priority).toBeLessThan(a.priority);
    expect(b.details.join(' ')).toMatch(/2FA/);
  });

  it('la antigüedad de 6-12 meses solo cuenta si ya hay otro riesgo', () => {
    const items = [item({ id: 'solo-media-edad', updatedAt: daysAgo(250) }), item({ id: 'debil-y-media-edad', updatedAt: daysAgo(250), strength: 'weak' })];
    const alerts = buildAlerts(items, titles(items), NOW);
    expect(alerts.map((a) => a.id)).toEqual(['debil-y-media-edad']);
    expect(alerts[0].kinds).toContain('old');
  });

  it('nombra con qué otros accesos se repite la contraseña', () => {
    const items = [item({ id: 'a', title: 'Gmail', reusedWith: ['b', 'c'] }), item({ id: 'b', title: 'Instagram' }), item({ id: 'c', title: 'Shopify' })];
    const a = buildAlerts(items, titles(items), NOW).find((x) => x.id === 'a')!;
    expect(a.details.join(' ')).toContain('Instagram, Shopify');
  });

  it('ignora la antigüedad si el item no tiene contraseña', () => {
    const items = [item({ id: 'n', password: '', updatedAt: daysAgo(900) })];
    expect(buildAlerts(items, titles(items), NOW)).toEqual([]);
  });
});

describe('ageInDays / humanAge', () => {
  it('calcula días y los muestra en lenguaje natural', () => {
    expect(ageInDays(daysAgo(30), NOW)).toBe(30);
    expect(ageInDays('fecha-rota', NOW)).toBe(0);
    expect(humanAge(20)).toBe('20 días');
    expect(humanAge(90)).toBe('3 meses');
    expect(humanAge(400)).toBe('1 año');
    expect(humanAge(800)).toBe('2 años');
  });
});
