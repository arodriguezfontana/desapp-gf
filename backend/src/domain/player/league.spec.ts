import { League, parseLeague } from './league';
import { InvalidLeagueError } from './errors/invalid-league.error';

describe('parseLeague', () => {
  it.each([
    ['Premier League', League.PREMIER_LEAGUE],
    ['Bundesliga', League.BUNDESLIGA],
    ['La Liga', League.LA_LIGA],
    ['Serie A', League.SERIE_A],
    ['Ligue 1', League.LIGUE_1],
  ])('acepta "%s" como liga válida', (value, expected) => {
    expect(parseLeague(value)).toBe(expected);
  });

  it('lanza InvalidLeagueError si el valor no es una de las 5 ligas soportadas', () => {
    expect(() => parseLeague('Eredivisie')).toThrow(InvalidLeagueError);
  });

  it('es sensible a mayúsculas/minúsculas (no matchea variantes)', () => {
    expect(() => parseLeague('premier league')).toThrow(InvalidLeagueError);
  });
});
