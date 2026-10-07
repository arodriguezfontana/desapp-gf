import { resolveTeam } from './resolve-team';
import { Standing } from './standing';
import { TeamNameException } from './team-name-exception';

const makeStanding = (externalTeamId: number, teamName: string): Standing =>
  Standing.restore('uuid-' + externalTeamId, {
    externalTeamId,
    teamName,
    leagueCode: 'PL',
    season: 2026,
    position: 1,
    playedGames: 10,
    won: 7,
    draw: 2,
    lost: 1,
    points: 23,
    goalsFor: 20,
    goalsAgainst: 8,
    goalDifference: 12,
    form: 'WWDWW',
    crestUrl: null,
  });

const makeException = (
  whoScoredRawName: string,
  footballDataTeamId: number,
): TeamNameException =>
  TeamNameException.restore('exc-uuid', {
    whoScoredRawName,
    footballDataTeamId,
    footballDataTeamName: 'Irrelevant',
    leagueCode: 'FL1',
  });

describe('resolveTeam', () => {
  const standings = [
    makeStanding(1, 'Manchester City FC'),
    makeStanding(2, 'FC Bayern München'),
    makeStanding(3, 'Paris Saint-Germain FC'),
    makeStanding(4, 'Olympique Lyonnais'),
  ];

  it('resuelve por normalización cuando los nombres difieren solo en prefijo FC', () => {
    const result = resolveTeam('Manchester City', standings, []);
    expect(result?.externalTeamId).toBe(1);
  });

  it('resuelve por normalización cuando hay prefijo FC y diéresis', () => {
    // 'Bayern München' → normaliza a 'bayern munchen'
    // 'FC Bayern München' → normaliza a 'bayern munchen' (prefijo FC eliminado + diéresis)
    const result = resolveTeam('Bayern München', standings, []);
    expect(result?.externalTeamId).toBe(2);
  });

  it('resuelve por normalización cuando sufijo FC y nombre idéntico', () => {
    const result = resolveTeam('Paris Saint-Germain', standings, []);
    expect(result?.externalTeamId).toBe(3);
  });

  it('devuelve null cuando la normalización no encuentra match y no hay excepción', () => {
    const result = resolveTeam('Lyon', standings, []);
    expect(result).toBeNull();
  });

  it('resuelve por excepción manual cuando la normalización falla', () => {
    const exceptions = [makeException('Lyon', 4)];
    const result = resolveTeam('Lyon', standings, exceptions);
    expect(result?.externalTeamId).toBe(4);
  });

  it('la normalización tiene prioridad sobre la excepción', () => {
    const exceptions = [makeException('Manchester City', 99)];
    const result = resolveTeam('Manchester City', standings, exceptions);
    expect(result?.externalTeamId).toBe(1);
  });

  it('devuelve null con nombre vacío', () => {
    expect(resolveTeam('', standings, [])).toBeNull();
  });

  it('devuelve null con standings vacíos', () => {
    const exceptions = [makeException('Lyon', 4)];
    expect(resolveTeam('Lyon', [], exceptions)).toBeNull();
  });

  it('devuelve null si la excepción apunta a un teamId que no está en standings', () => {
    const exceptions = [makeException('Lyon', 999)];
    const result = resolveTeam('Lyon', standings, exceptions);
    expect(result).toBeNull();
  });
});
