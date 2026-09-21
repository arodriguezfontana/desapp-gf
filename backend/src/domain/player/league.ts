import { InvalidLeagueError } from './errors/invalid-league.error';

/**
 * Enum de dominio (constitución, Principio II): las 5 ligas soportadas por el
 * catálogo de prueba. Sin decoradores de TypeORM ni conocimiento de HTTP.
 */
export enum League {
  PREMIER_LEAGUE = 'Premier League',
  BUNDESLIGA = 'Bundesliga',
  LA_LIGA = 'La Liga',
  SERIE_A = 'Serie A',
  LIGUE_1 = 'Ligue 1',
}

/** @throws InvalidLeagueError si `value` no es una de las 5 ligas soportadas */
export function parseLeague(value: string): League {
  if (!Object.values(League).includes(value as League)) {
    throw new InvalidLeagueError(value);
  }
  return value as League;
}
