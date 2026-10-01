import { computePlayersToRemove } from './team-roster-sync';

describe('computePlayersToRemove', () => {
  it('devuelve [] cuando no hay cambios (mismos ids activos y entrantes)', () => {
    expect(computePlayersToRemove(['a', 'b'], ['a', 'b'])).toEqual([]);
  });

  it('devuelve [] cuando sólo hay altas (todos los activos siguen viniendo)', () => {
    expect(computePlayersToRemove(['a'], ['a', 'b', 'c'])).toEqual([]);
  });

  it('devuelve los ids activos que ya no vienen en el plantel entrante (bajas)', () => {
    expect(computePlayersToRemove(['a', 'b', 'c'], ['a'])).toEqual(['b', 'c']);
  });

  it('combina altas y bajas: sólo reporta los que faltan, ignora los nuevos', () => {
    expect(computePlayersToRemove(['a', 'b'], ['b', 'c'])).toEqual(['a']);
  });

  it('devuelve [] cuando no había nadie activo antes', () => {
    expect(computePlayersToRemove([], ['a', 'b'])).toEqual([]);
  });

  it('devuelve todos los activos cuando el plantel entrante viene vacío', () => {
    expect(computePlayersToRemove(['a', 'b'], [])).toEqual(['a', 'b']);
  });
});
