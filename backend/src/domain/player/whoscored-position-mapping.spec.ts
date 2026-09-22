import { mapWhoScoredPosition } from './whoscored-position-mapping';
import { Position } from './position';

describe('mapWhoScoredPosition', () => {
  it('mapea un código de arquero (GK) a Position.GK', () => {
    expect(mapWhoScoredPosition('GK')).toBe(Position.GK);
  });

  it.each(['DR', 'DC', 'DL'])(
    'mapea un código de defensor/lateral (%s) a Position.DF',
    (code) => {
      expect(mapWhoScoredPosition(code)).toBe(Position.DF);
    },
  );

  it.each(['DMC', 'DM', 'MC', 'ML', 'MR', 'AMC', 'AML', 'AMR'])(
    'mapea un código de mediocampo (%s) a Position.MF',
    (code) => {
      expect(mapWhoScoredPosition(code)).toBe(Position.MF);
    },
  );

  it.each(['FWR', 'FW', 'FWL'])(
    'mapea un código de delantero/extremo (%s) a Position.FW',
    (code) => {
      expect(mapWhoScoredPosition(code)).toBe(Position.FW);
    },
  );

  it('devuelve undefined para un código que no matchea ninguna categoría', () => {
    expect(mapWhoScoredPosition('SUB')).toBeUndefined();
  });

  it('devuelve undefined para un string vacío', () => {
    expect(mapWhoScoredPosition('')).toBeUndefined();
  });
});
