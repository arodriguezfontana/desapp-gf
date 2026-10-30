import { FixedClock, SequentialIdGenerator } from './fake-runtime';
import { SystemClock } from './system-clock';
import { UuidIdGenerator } from './uuid-id-generator';

describe('SystemClock', () => {
  it('devuelve la hora actual', () => {
    const before = Date.now();
    const now = new SystemClock().now().getTime();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });
});

describe('UuidIdGenerator', () => {
  it('genera UUID v4 validos', () => {
    expect(new UuidIdGenerator().generate()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('genera un id distinto en cada llamada', () => {
    const generator = new UuidIdGenerator();
    expect(generator.generate()).not.toBe(generator.generate());
  });
});

describe('dobles de test', () => {
  it('FixedClock devuelve siempre el mismo instante, sin compartir la instancia', () => {
    const clock = new FixedClock(new Date('2026-01-02T03:04:05.000Z'));
    expect(clock.now().toISOString()).toBe('2026-01-02T03:04:05.000Z');
    expect(clock.now()).not.toBe(clock.now());
  });

  it('SequentialIdGenerator genera ids predecibles y consecutivos', () => {
    const ids = new SequentialIdGenerator('order');
    expect([ids.generate(), ids.generate(), ids.generate()]).toEqual(['order-1', 'order-2', 'order-3']);
  });
});
