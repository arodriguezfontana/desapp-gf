import { Logger } from '@nestjs/common';
import { FootballDataSyncService } from './football-data-sync.service';
import { FootballDataAdapter } from '../../adapters/competition/football-data-adapter';
import { MatchRepository } from '../../repositories/competition/match.repository';
import { StandingRepository } from '../../repositories/competition/standing.repository';

describe('FootballDataSyncService — manejo de errores del @Cron', () => {
  let service: FootballDataSyncService;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    const adapter: jest.Mocked<FootballDataAdapter> = {
      fetchStandings: jest.fn().mockResolvedValue([]),
      fetchMatches: jest.fn().mockResolvedValue([]),
    };
    const matchRepo: jest.Mocked<MatchRepository> = {
      upsertMatches: jest.fn().mockResolvedValue(undefined),
      findByLeagueCode: jest.fn(),
      findByExternalId: jest.fn(),
    };
    const standingRepo: jest.Mocked<StandingRepository> = {
      upsertStandings: jest.fn().mockResolvedValue(undefined),
      findByLeagueCode: jest.fn(),
      findByTeamAndLeague: jest.fn(),
    };
    service = new FootballDataSyncService(adapter, matchRepo, standingRepo);
    service.setRequestDelay(0);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ante un error inesperado lo registra y no lo propaga al scheduler', async () => {
    jest.spyOn(service, 'syncAllLeagues').mockRejectedValue(new Error('error fatal'));

    await expect(service.handleCron()).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('error inesperado'), expect.any(String));
  });

  it('tras un error libera el lock y el siguiente cron puede correr', async () => {
    const sync = jest.spyOn(service, 'syncAllLeagues').mockRejectedValueOnce(new Error('error fatal'));

    await service.handleCron();
    sync.mockResolvedValue({ leagues: [], failedLeagues: [] });
    await service.handleCron();

    expect(sync).toHaveBeenCalledTimes(2);
  });
});
