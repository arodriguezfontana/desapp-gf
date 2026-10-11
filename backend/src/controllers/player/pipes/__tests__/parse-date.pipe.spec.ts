import { BadRequestException } from '@nestjs/common';
import { ParseDatePipe } from '../parse-date.pipe';

describe('ParseDatePipe', () => {
  let pipe: ParseDatePipe;

  beforeEach(() => {
    pipe = new ParseDatePipe();
  });

  it('retorna undefined si el valor es undefined, null o vacío', () => {
    expect(pipe.transform(undefined)).toBeUndefined();
    expect(pipe.transform(null as unknown as string)).toBeUndefined();
    expect(pipe.transform('')).toBeUndefined();
  });

  it('parsea fecha YYYY-MM-DD al final del día en UTC (23:59:59.999Z)', () => {
    const result = pipe.transform('2026-09-15');
    expect(result).toBeInstanceOf(Date);
    expect(result?.toISOString()).toBe('2026-09-15T23:59:59.999Z');
  });

  it('parsea fecha completa ISO 8601 al final del día en UTC (23:59:59.999Z)', () => {
    const result = pipe.transform('2026-09-15T14:30:00.000Z');
    expect(result).toBeInstanceOf(Date);
    expect(result?.toISOString()).toBe('2026-09-15T23:59:59.999Z');
  });

  it('lanza BadRequestException si el texto no es una fecha válida', () => {
    expect(() => pipe.transform('invalido')).toThrow(BadRequestException);
    expect(() => pipe.transform('2026-09')).toThrow(BadRequestException);
    expect(() => pipe.transform('15-09-2026')).toThrow(BadRequestException);
  });

  it('lanza BadRequestException si la fecha es de calendario imposible (ej. 2026-02-31)', () => {
    expect(() => pipe.transform('2026-02-31')).toThrow(BadRequestException);
    expect(() => pipe.transform('2026-04-31')).toThrow(BadRequestException);
    expect(() => pipe.transform('2026-13-01')).toThrow(BadRequestException);
  });
});

