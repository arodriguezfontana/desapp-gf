import { FootballDataSyncService, TARGET_LEAGUES } from './football-data-sync.service';
import { FootballDataAdapter, FootballDataMatchDTO, FootballDataStandingRowDTO } from '../adapters/football-data-adapter';
import { MatchRepository } from '../repositories/match.repository';
import { StandingRepository } from '../repositories/standing.repository';

describe('FootballDataSyncService', () => {
  let service: FootballDataSyncService;
  let mockAdapter: jest.Mocked<FootballDataAdapter>;
  let mockMatchRepository: jest.Mocked<MatchRepository>;
  let mockStandingRepository: jest.Mocked<StandingRepository>;

  beforeEach(() => {
    mockAdapter = {
      fetchMatches: jest.fn(),
      fetchStandings: jest.fn(),
    };

    mockMatchRepository = {
      upsertMatches: jest.fn().mockResolvedValue(undefined),
      findByExternalId: jest.fn(),
      findByLeagueCode: jest.fn(),
    };

    mockStandingRepository = {
      upsertStandings: jest.fn().mockResolvedValue(undefined),
      findByTeamAndLeague: jest.fn(),
      findByLeagueCode: jest.fn(),
    };

    service = new FootballDataSyncService(
      mockAdapter,
      mockMatchRepository,
      mockStandingRepository,
    );

    // Disable delay during unit tests
    service.setRequestDelay(0);
  });

  describe('syncStandingsForLeague', () => {
    it('should fetch and upsert standings for a league', async () => {
      const mockStandings: FootballDataStandingRowDTO[] = [
        {
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
        },
      ];

      mockAdapter.fetchStandings.mockResolvedValue(mockStandings);

      await service.syncStandingsForLeague('PL');

      expect(mockAdapter.fetchStandings).toHaveBeenCalledWith('PL');
      expect(mockStandingRepository.upsertStandings).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            externalTeamId: 65,
            teamName: 'Manchester City FC',
            leagueCode: 'PL',
            crestUrl: 'https://crests.football-data.org/65.png',
            position: 1,
            points: 13,
          }),
        ]),
      );
    });

    it('should handle errors gracefully without throwing', async () => {
      mockAdapter.fetchStandings.mockRejectedValue(new Error('Network error'));

      await expect(service.syncStandingsForLeague('PL')).resolves.not.toThrow();
      expect(mockStandingRepository.upsertStandings).not.toHaveBeenCalled();
    });
  });

  describe('syncMatchesForLeague', () => {
    it('should filter matches by status and upsert valid matches', async () => {
      const mockMatches: FootballDataMatchDTO[] = [
        {
          id: 101,
          utcDate: '2025-08-15T19:00:00Z',
          status: 'FINISHED',
          matchday: 1,
          competitionCode: 'PL',
          seasonYear: 2025,
          homeTeamId: 65,
          homeTeamName: 'Man City',
          awayTeamId: 62,
          awayTeamName: 'Everton',
          homeScore: 3,
          awayScore: 0,
        },
        {
          id: 102,
          utcDate: '2025-09-20T14:00:00Z',
          status: 'SCHEDULED',
          matchday: 5,
          competitionCode: 'PL',
          seasonYear: 2025,
          homeTeamId: 57,
          homeTeamName: 'Arsenal',
          awayTeamId: 61,
          awayTeamName: 'Chelsea',
          homeScore: null,
          awayScore: null,
        },
        {
          id: 103,
          utcDate: '2025-10-01T15:00:00Z',
          status: 'POSTPONED',
          matchday: 6,
          competitionCode: 'PL',
          seasonYear: 2025,
          homeTeamId: 64,
          homeTeamName: 'Liverpool',
          awayTeamId: 66,
          awayTeamName: 'Man United',
          homeScore: null,
          awayScore: null,
        },
        {
          id: 104,
          utcDate: '2025-11-01T15:00:00Z',
          status: 'CANCELLED',
          matchday: 10,
          competitionCode: 'PL',
          seasonYear: 2025,
          homeTeamId: 73,
          homeTeamName: 'Tottenham',
          awayTeamId: 397,
          awayTeamName: 'Brighton',
          homeScore: null,
          awayScore: null,
        },
      ];

      mockAdapter.fetchMatches.mockResolvedValue(mockMatches);

      await service.syncMatchesForLeague('PL');

      expect(mockAdapter.fetchMatches).toHaveBeenCalledWith('PL');
      expect(mockMatchRepository.upsertMatches).toHaveBeenCalledWith(
        expect.arrayContaining([
          // Finished result with score
          expect.objectContaining({
            externalId: 101,
            classification: 'RESULT',
            homeScore: 3,
            awayScore: 0,
          }),
          // Scheduled fixture without score
          expect.objectContaining({
            externalId: 102,
            classification: 'FIXTURE',
            homeScore: null,
            awayScore: null,
          }),
        ]),
      );

      // Verify POSTPONED and CANCELLED were filtered out
      const upsertedCall = mockMatchRepository.upsertMatches.mock.calls[0][0];
      expect(upsertedCall).toHaveLength(2);
    });
  });

  describe('syncAllLeagues', () => {
    it('should iterate over all 5 target leagues', async () => {
      mockAdapter.fetchStandings.mockResolvedValue([]);
      mockAdapter.fetchMatches.mockResolvedValue([]);

      await service.syncAllLeagues();

      expect(mockAdapter.fetchStandings).toHaveBeenCalledTimes(5);
      expect(mockAdapter.fetchMatches).toHaveBeenCalledTimes(5);

      TARGET_LEAGUES.forEach((leagueCode) => {
        expect(mockAdapter.fetchStandings).toHaveBeenCalledWith(leagueCode);
        expect(mockAdapter.fetchMatches).toHaveBeenCalledWith(leagueCode);
      });
    });
  });
});

