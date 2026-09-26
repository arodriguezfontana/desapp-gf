import { AxiosInstance } from 'axios';
import { HttpFootballDataAdapter } from './http-football-data-adapter';
import * as fs from 'fs';
import * as path from 'path';

interface MockAxiosInstance {
  get: jest.Mock;
}

describe('HttpFootballDataAdapter', () => {
  let adapter: HttpFootballDataAdapter;
  let mockAxiosInstance: MockAxiosInstance;

  const matchesFixture = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '../../test/fixtures/football-data/matches-sample.json'),
      'utf-8',
    ),
  );

  const standingsFixture = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '../../test/fixtures/football-data/standings-sample.json'),
      'utf-8',
    ),
  );

  beforeEach(() => {
    mockAxiosInstance = {
      get: jest.fn(),
    };
    adapter = new HttpFootballDataAdapter(mockAxiosInstance as unknown as AxiosInstance);
  });

  describe('fetchStandings', () => {
    it('should parse standings response correctly and handle crest nullability', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: standingsFixture });

      const standings = await adapter.fetchStandings('PL');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/competitions/PL/standings',
        expect.any(Object),
      );
      expect(standings).toHaveLength(3);

      // Man City (has crest)
      expect(standings[0]).toEqual({
        position: 1,
        teamId: 65,
        teamName: 'Manchester City FC',
        crestUrl: 'https://crests.football-data.org/65.png',
        playedGames: 5,
        form: 'W,W,W,D,W',
        won: 4,
        draw: 1,
        lost: 0,
        points: 13,
        goalsFor: 12,
        goalsAgainst: 3,
        goalDifference: 9,
      });

      // Man United (crest is null in fixture)
      expect(standings[2].teamName).toBe('Manchester United FC');
      expect(standings[2].crestUrl).toBeNull();
    });
  });

  describe('fetchMatches', () => {
    it('should parse matches response correctly', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: matchesFixture });

      const matches = await adapter.fetchMatches('PL');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/competitions/PL/matches',
        expect.any(Object),
      );
      expect(matches).toHaveLength(5);
      expect(matches[0]).toEqual({
        id: 497521,
        utcDate: '2025-08-15T19:00:00Z',
        status: 'FINISHED',
        matchday: 1,
        competitionCode: 'PL',
        seasonYear: 2025,
        homeTeamId: 65,
        homeTeamName: 'Manchester City FC',
        awayTeamId: 62,
        awayTeamName: 'Everton FC',
        homeScore: 3,
        awayScore: 0,
      });

      // Scheduled match with null score
      expect(matches[1].status).toBe('SCHEDULED');
      expect(matches[1].homeScore).toBeNull();
      expect(matches[1].awayScore).toBeNull();
    });
  });
});

