import { Standing } from './standing';

describe('Standing', () => {
  const baseProps = {
    externalTeamId: 65,
    teamName: 'Manchester City FC',
    leagueCode: 'PL',
    season: 2025,
    position: 1,
    playedGames: 5,
    won: 4,
    draw: 1,
    lost: 0,
    points: 13,
    goalsFor: 12,
    goalsAgainst: 3,
    goalDifference: 9,
    form: 'W,W,W,D,W',
    crestUrl: 'https://crests.football-data.org/65.png',
  };

  describe('create', () => {
    it('expone los valores recibidos sin id de persistencia', () => {
      const standing = Standing.create(baseProps);

      expect(standing.id).toBeNull();
      expect(standing.externalTeamId).toBe(65);
      expect(standing.points).toBe(13);
      expect(standing.form).toBe('W,W,W,D,W');
      expect(standing.crestUrl).toBe('https://crests.football-data.org/65.png');
    });

    it('expone crestUrl y form en null cuando la API no los provee', () => {
      const standing = Standing.create({
        ...baseProps,
        form: null,
        crestUrl: null,
      });

      expect(standing.form).toBeNull();
      expect(standing.crestUrl).toBeNull();
    });
  });

  describe('restore', () => {
    it('expone exactamente los valores con los que se reconstruyó, incluido el id', () => {
      const standing = Standing.restore('standing-id-1', baseProps);

      expect(standing.id).toBe('standing-id-1');
      expect(standing.teamName).toBe('Manchester City FC');
      expect(standing.leagueCode).toBe('PL');
    });
  });
});
