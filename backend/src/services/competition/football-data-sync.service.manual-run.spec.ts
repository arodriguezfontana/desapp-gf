import { FootballDataSyncService } from './football-data-sync.service';
import { FootballDataAdapter } from '../../adapters/competition/football-data-adapter';
import { MatchRepository } from '../../repositories/competition/match.repository';
import { StandingRepository } from '../../repositories/competition/standing.repository';
import { SyncInProgressError } from '../../domain/sync/errors/sync-in-progress.error';

const emptyStandings = () => Promise.resolve([]);
const emptyMatches = () => Promise.resolve([]);

describe('FootballDataSyncService — disparo manual (spec 009)', () => {
  let adapter: jest.Mocked<FootballDataAdapter>;
  let matchRepo: jest.Mocked<MatchRepository>;
  let standingRepo: jest.Mocked<StandingRepository>;
  let service: FootballDataSyncService;

  beforeEach(() => {
    adapter = {
      fetchStandings: jest.fn().mockImplementation(emptyStandings),
      fetchMatches: jest.fn().mockImplementation(emptyMatches),
    };
    matchRepo = {
      upsertMatches: jest.fn().mockResolvedValue(undefined),
      findByLeagueCode: jest.fn(),
      findByExternalId: jest.fn(),
    };
    standingRepo = {
      upsertStandings: jest.fn().mockResolvedValue(undefined),
      findByLeagueCode: jest.fn(),
      findByTeamAndLeague: jest.fn(),
    };
    service = new FootballDataSyncService(adapter, matchRepo, standingRepo);
    service.setRequestDelay(0);
  });

  describe('triggerManualRun()', () => {
    it('devuelve un resumen con leagues y failedLeagues', async () => {
      const summary = await service.triggerManualRun();

      expect(summary).toHaveProperty('leagues');
      expect(summary).toHaveProperty('failedLeagues');
      expect(Array.isArray(summary.leagues)).toBe(true);
      expect(Array.isArray(summary.failedLeagues)).toBe(true);
    });

    it('con lock tomado lanza SyncInProgressError sin runId', async () => {
      // Tomar el lock manteniendo la corrida bloqueada
      let releaseBlock: () => void;
      const block = new Promise<void>((r) => { releaseBlock = r; });
      adapter.fetchStandings.mockImplementationOnce(() => block.then(() => []));

      const runningPromise = service.triggerManualRun();

      // Segundo intento con lock tomado
      await expect(service.triggerManualRun()).rejects.toThrow(SyncInProgressError);
      const caught = await service.triggerManualRun().catch((e: SyncInProgressError) => e);
      expect(caught).toBeInstanceOf(SyncInProgressError);
      expect((caught as SyncInProgressError).runId).toBeUndefined();

      releaseBlock!();
      await runningPromise;
    });

    it('una liga con falla en standings aparece en failedLeagues', async () => {
      adapter.fetchStandings.mockImplementation((leagueCode) => {
        if (leagueCode === 'PD') return Promise.reject(new Error('proveedor caído'));
        return emptyStandings();
      });

      const summary = await service.triggerManualRun();

      expect(summary.failedLeagues).toContain('PD');
      const pdResult = summary.leagues.find((l) => l.leagueCode === 'PD');
      expect(pdResult).toBeDefined();
      expect(pdResult!.failedSteps).toContain('standings');
    });

    it('ligas exitosas no aparecen en failedLeagues', async () => {
      const summary = await service.triggerManualRun();
      expect(summary.failedLeagues).toHaveLength(0);
    });
  });

  describe('handleCron()', () => {
    it('con lock libre completa sin lanzar', async () => {
      await expect(service.handleCron()).resolves.toBeUndefined();
    });

    it('con lock tomado loguea warn y retorna void sin lanzar', async () => {
      let releaseBlock: () => void;
      const block = new Promise<void>((r) => { releaseBlock = r; });
      adapter.fetchStandings.mockImplementationOnce(() => block.then(() => []));

      const runningPromise = service.triggerManualRun();

      // Cron llega con lock tomado
      await expect(service.handleCron()).resolves.toBeUndefined();

      releaseBlock!();
      await runningPromise;
    });
  });

  describe('syncAllLeagues()', () => {
    it('devuelve FootballDataSyncSummary con una entrada por liga', async () => {
      const summary = await service.syncAllLeagues();

      expect(summary.leagues).toHaveLength(5); // PL, BL1, PD, SA, FL1
      for (const result of summary.leagues) {
        expect(result).toHaveProperty('leagueCode');
        expect(result).toHaveProperty('standingsSynced');
        expect(result).toHaveProperty('matchesSynced');
        expect(result).toHaveProperty('failedSteps');
      }
    });
  });
});
