import { Position, parsePosition } from './position';
import { InvalidPositionError } from './errors/invalid-position.error';

describe('parsePosition', () => {
  it.each([
    ['GK', Position.GK],
    ['DF', Position.DF],
    ['MF', Position.MF],
    ['FW', Position.FW],
  ])('acepta "%s" como posición válida', (value, expected) => {
    expect(parsePosition(value)).toBe(expected);
  });

  it('lanza InvalidPositionError si el valor no es una de las 4 posiciones soportadas', () => {
    expect(() => parsePosition('XX')).toThrow(InvalidPositionError);
  });

  it('es sensible a mayúsculas/minúsculas (no matchea variantes)', () => {
    expect(() => parsePosition('gk')).toThrow(InvalidPositionError);
  });
});
