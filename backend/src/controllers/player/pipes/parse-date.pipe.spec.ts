import { BadRequestException } from '@nestjs/common';
import { ParseDatePipe } from './parse-date.pipe';

describe('ParseDatePipe', () => {
  let pipe: ParseDatePipe;

  beforeEach(() => {
    pipe = new ParseDatePipe();
  });

  describe('cuando el valor es nulo o vacío', () => {
    it('retorna undefined si el valor es undefined', () => {
      expect(pipe.transform(undefined)).toBeUndefined();
    });

    it('retorna undefined si el valor es null', () => {
      expect(pipe.transform(null as unknown as undefined)).toBeUndefined();
    });

    it('retorna undefined si el valor es string vacío', () => {
      expect(pipe.transform('')).toBeUndefined();
    });
  });

  describe('cuando el formato es válido YYYY-MM-DD', () => {
    it('convierte "2026-09-15" al final del día UTC', () => {
      const result = pipe.transform('2026-09-15');
      expect(result).toBeInstanceOf(Date);
      expect(result!.toISOString()).toBe('2026-09-15T23:59:59.999Z');
    });

    it('convierte "2026-01-01" al final del día UTC', () => {
      const result = pipe.transform('2026-01-01');
      expect(result!.toISOString()).toBe('2026-01-01T23:59:59.999Z');
    });

    it('convierte "2026-12-31" al final del día UTC', () => {
      const result = pipe.transform('2026-12-31');
      expect(result!.toISOString()).toBe('2026-12-31T23:59:59.999Z');
    });

    it('convierte "2024-02-29" (año bisiesto) correctamente', () => {
      const result = pipe.transform('2024-02-29');
      expect(result!.toISOString()).toBe('2024-02-29T23:59:59.999Z');
    });
  });

  describe('cuando el formato es inválido', () => {
    it('lanza BadRequestException con "hola"', () => {
      expect(() => pipe.transform('hola')).toThrow(BadRequestException);
    });

    it('lanza BadRequestException con "2026-9-5" (dígitos sin cero)', () => {
      expect(() => pipe.transform('2026-9-5')).toThrow(BadRequestException);
    });

    it('lanza BadRequestException con "15-09-2026" (orden incorrecto)', () => {
      expect(() => pipe.transform('15-09-2026')).toThrow(BadRequestException);
    });

    it('lanza BadRequestException con "2026/09/15" (separador incorrecto)', () => {
      expect(() => pipe.transform('2026/09/15')).toThrow(BadRequestException);
    });

    it('lanza BadRequestException con "2026-02-30" (día inexistente en febrero)', () => {
      expect(() => pipe.transform('2026-02-30')).toThrow(BadRequestException);
    });

    it('lanza BadRequestException con "2026-13-01" (mes inexistente)', () => {
      expect(() => pipe.transform('2026-13-01')).toThrow(BadRequestException);
    });

    it('lanza BadRequestException con "2026-00-01" (mes cero)', () => {
      expect(() => pipe.transform('2026-00-01')).toThrow(BadRequestException);
    });

    it('lanza BadRequestException con "2023-02-29" (no es año bisiesto)', () => {
      expect(() => pipe.transform('2023-02-29')).toThrow(BadRequestException);
    });
  });
});
