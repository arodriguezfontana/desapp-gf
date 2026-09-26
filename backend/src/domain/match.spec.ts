import { Match } from './match';

describe('Match', () => {
  const baseProps = {
    externalId: 101,
    leagueCode: 'PL',
    season: 2025,
    matchday: 1,
    utcDate: new Date('2025-08-15T19:00:00Z'),
    status: 'FINISHED',
    classification: 'RESULT' as const,
    homeTeamId: 65,
    homeTeamName: 'Manchester City FC',
    awayTeamId: 62,
    awayTeamName: 'Everton FC',
    homeScore: 3,
    awayScore: 0,
  };

  describe('create', () => {
    it('expone los valores recibidos sin id de persistencia', () => {
      const match = Match.create(baseProps);

      expect(match.id).toBeNull();
      expect(match.externalId).toBe(101);
      expect(match.leagueCode).toBe('PL');
      expect(match.classification).toBe('RESULT');
      expect(match.homeScore).toBe(3);
      expect(match.awayScore).toBe(0);
    });

    it('expone el score en null para una fixture sin jugar', () => {
      const match = Match.create({
        ...baseProps,
        status: 'SCHEDULED',
        classification: 'FIXTURE',
        homeScore: null,
        awayScore: null,
      });

      expect(match.classification).toBe('FIXTURE');
      expect(match.homeScore).toBeNull();
      expect(match.awayScore).toBeNull();
    });
  });

  describe('restore', () => {
    it('expone exactamente los valores con los que se reconstruyó, incluido el id', () => {
      const match = Match.restore('match-id-1', baseProps);

      expect(match.id).toBe('match-id-1');
      expect(match.externalId).toBe(101);
      expect(match.homeTeamName).toBe('Manchester City FC');
      expect(match.awayTeamName).toBe('Everton FC');
    });
  });
});
