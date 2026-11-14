import { Clock } from '../../adapters/runtime/clock';
import { BuildInfo } from '../../shared/observability/info/build-info';
import { InfoService } from './info.service';

/** Reloj de test que se puede adelantar a mano. */
class ManualClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return new Date(this.current);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

describe('InfoService', () => {
  const build: BuildInfo = {
    name: 'backend',
    version: '1.0.0',
    commit: 'abc1234',
    environment: 'test',
    node: 'v22.0.0',
  };
  const start = new Date('2026-11-11T12:00:00.000Z');

  it('devuelve los datos del build, el arranque y uptime 0 recién creado', () => {
    const service = new InfoService(build, new ManualClock(start));

    expect(service.getInfo()).toEqual({
      ...build,
      startedAt: '2026-11-11T12:00:00.000Z',
      uptimeSeconds: 0,
    });
  });

  it('el uptime avanza con el reloj, en segundos enteros, y el arranque no cambia', () => {
    const clock = new ManualClock(start);
    const service = new InfoService(build, clock);

    clock.advance(90_999);

    expect(service.getInfo()).toMatchObject({
      startedAt: '2026-11-11T12:00:00.000Z',
      uptimeSeconds: 90,
    });
  });

  it('si el reloj retrocede el uptime no queda negativo', () => {
    const clock = new ManualClock(start);
    const service = new InfoService(build, clock);

    clock.advance(-5_000);

    expect(service.getInfo().uptimeSeconds).toBe(0);
  });
});
