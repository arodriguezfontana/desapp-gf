import { InvalidPositionError } from './errors/invalid-position.error';

/**
 * Enum de dominio (constitución, Principio II): las 4 posiciones soportadas por el
 * catálogo de prueba. Sin decoradores de TypeORM ni conocimiento de HTTP.
 */
export enum Position {
  GK = 'GK',
  DF = 'DF',
  MF = 'MF',
  FW = 'FW',
}

/** @throws InvalidPositionError si `value` no es una de las 4 posiciones soportadas */
export function parsePosition(value: string): Position {
  if (!Object.values(Position).includes(value as Position)) {
    throw new InvalidPositionError(value);
  }
  return value as Position;
}
