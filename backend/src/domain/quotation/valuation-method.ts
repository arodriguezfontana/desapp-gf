import { InvalidValuationMethodError } from './errors/invalid-valuation-method.error';

/**
 * Método de cálculo con el que una estrategia convierte las métricas de un
 * jugador en un valor (Strategy pattern, constitución Principio II). Cada
 * método tiene su implementación de `PlayerValuator`.
 *
 * - `WEIGHTED`: normaliza cada métrica contra su techo de temporada (el método
 *   original de 012-valuation-strategies).
 * - `PER_MATCH`: las métricas acumuladas se dividen antes por los partidos
 *   jugados, así que no penaliza a quien jugó menos (spec 027).
 */
export enum ValuationMethod {
  WEIGHTED = 'WEIGHTED',
  PER_MATCH = 'PER_MATCH',
}

/** @throws InvalidValuationMethodError si `value` no es un método soportado. */
export function parseValuationMethod(value: string): ValuationMethod {
  if (!Object.values(ValuationMethod).includes(value as ValuationMethod)) {
    throw new InvalidValuationMethodError(value);
  }
  return value as ValuationMethod;
}
