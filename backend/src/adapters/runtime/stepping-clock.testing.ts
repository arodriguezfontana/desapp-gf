import { Clock } from './clock';

/** Doble de test: `Clock` que avanza `stepMs` en cada lectura, para medir duraciones (lecturas - 1) × stepMs. */
export class SteppingClock implements Clock {
  private current: number;

  constructor(
    private readonly stepMs: number,
    start = '2026-11-13T10:00:00.000Z',
  ) {
    this.current = Date.parse(start);
  }

  now(): Date {
    const date = new Date(this.current);
    this.current += this.stepMs;
    return date;
  }
}
