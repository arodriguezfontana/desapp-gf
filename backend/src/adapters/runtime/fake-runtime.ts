import { Clock } from './clock';
import { IdGenerator } from './id-generator';

/** Doble de test: `Clock` que siempre devuelve la misma hora (cada llamada, una copia). */
export class FixedClock implements Clock {
  constructor(private readonly instant: Date = new Date('2026-10-26T12:00:00.000Z')) {}

  now(): Date {
    return new Date(this.instant.getTime());
  }
}

/** Doble de test: `IdGenerator` con ids predecibles (`<prefix>-1`, `<prefix>-2`, ...). */
export class SequentialIdGenerator implements IdGenerator {
  private counter = 0;

  constructor(private readonly prefix: string = 'id') {}

  generate(): string {
    this.counter += 1;
    return `${this.prefix}-${this.counter}`;
  }
}
