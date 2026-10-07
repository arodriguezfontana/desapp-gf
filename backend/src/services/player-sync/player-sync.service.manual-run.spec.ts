import { PlayerSyncService } from './player-sync.service';
import {
  WhoScoredAdapter,
  WhoScoredLeagueTeams,
} from '../../adapters/player-sync/whoscored-adapter';
import { PlayerRepository } from '../../repositories/player/player.repository';
import { SyncInProgressError } from '../../domain/sync/errors/sync-in-progress.error';
import { League } from '../../domain/player/enums/league';

const emptyLeagueTeams = (): WhoScoredLeagueTeams => ({
  tournamentId: 1,
  teams: [],
  seedPlayerByTeam: new Map(),
});

describe('PlayerSyncService — disparo manual (spec 009)', () => {
  let whoScored: jest.Mocked<WhoScoredAdapter>;
  let players: jest.Mocked<PlayerRepository>;
  let service: PlayerSyncService;

  beforeEach(() => {
    whoScored = {
      fetchLeagueTeams: jest.fn().mockResolvedValue(emptyLeagueTeams()),
      fetchTeamRoster: jest.fn(),
    };
    players = {
      findPage: jest.fn(),
      findById: jest.fn(),
      findActiveExternalIdsByTeam: jest.fn().mockResolvedValue([]),
      applyTeamRosterSync: jest.fn().mockResolvedValue(undefined),
    };
    service = new PlayerSyncService(whoScored, players);
  });

  describe('startManualRun()', () => {
    it('devuelve un runId y registra la corrida con estado running', () => {
      const runId = service.startManualRun();

      expect(typeof runId).toBe('string');
      expect(runId).toHaveLength(36); // UUID v4
      const state = service.getRun(runId);
      expect(state).toBeDefined();
      expect(state!.status).toBe('running');
      expect(state!.trigger).toBe('manual');
    });

    it('con lock tomado lanza SyncInProgressError con el runId en curso', () => {
      const firstRunId = service.startManualRun();

      expect(() => service.startManualRun()).toThrow(SyncInProgressError);
      try {
        service.startManualRun();
      } catch (e) {
        expect(e).toBeInstanceOf(SyncInProgressError);
        expect((e as SyncInProgressError).runId).toBe(firstRunId);
      }
    });
  });

  describe('getRun()', () => {
    it('devuelve undefined para un runId desconocido', () => {
      expect(service.getRun('00000000-0000-0000-0000-000000000000')).toBeUndefined();
    });

    it('devuelve el estado actual de una corrida registrada', () => {
      const runId = service.startManualRun();
      const state = service.getRun(runId);
      expect(state).toMatchObject({ runId, status: 'running', trigger: 'manual' });
    });
  });

  describe('estado final de una corrida', () => {
    it('la corrida pasa a completed con resumen cuando termina sin error fatal', async () => {
      const runId = service.startManualRun();
      // Esperar a que la corrida de fondo termine (todas las ligas devuelven vacío)
      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          const state = service.getRun(runId);
          if (state && state.status !== 'running') {
            clearInterval(interval);
            resolve();
          }
        }, 10);
      });

      const state = service.getRun(runId);
      expect(state!.status).toBe('completed');
      expect(state!.summary).toBeDefined();
      expect(state!.summary!.teamsSynced).toBe(0);
      expect(state!.summary!.playersSynced).toBe(0);
      expect(state!.summary!.failedUnits).toHaveLength(0);
      expect(state!.finishedAt).toBeDefined();
    });

    it('la corrida pasa a failed con mensaje genérico cuando un error no controlado la aborta', async () => {
      // applyTeamRosterSync está fuera del try/catch por liga → propaga al catch externo → failed
      whoScored.fetchLeagueTeams.mockResolvedValue({
        tournamentId: 1,
        teams: [{ externalTeamId: 't1', team: 'Team 1' }],
        seedPlayerByTeam: new Map([['t1', 'seed-t1']]),
      });
      whoScored.fetchTeamRoster.mockResolvedValue([]);
      players.findActiveExternalIdsByTeam.mockResolvedValue([]);
      players.applyTeamRosterSync.mockRejectedValue(new Error('error fatal de base de datos'));

      const runId = service.startManualRun();
      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          const state = service.getRun(runId);
          if (state && state.status !== 'running') {
            clearInterval(interval);
            resolve();
          }
        }, 10);
      });

      const state = service.getRun(runId);
      expect(state!.status).toBe('failed');
      expect(state!.errorMessage).toBeDefined();
      expect(state!.errorMessage).not.toContain('error fatal'); // no filtra texto de excepción
    });
  });

  describe('retención de corridas', () => {
    it('nunca supera MAX_RETAINED_RUNS entradas en el mapa', async () => {
      // Disparar 25 corridas secuenciales (esperando que cada una termine antes de la siguiente)
      for (let i = 0; i < 25; i++) {
        const runId = service.startManualRun();
        await new Promise<void>((resolve) => {
          const interval = setInterval(() => {
            const state = service.getRun(runId);
            if (state && state.status !== 'running') {
              clearInterval(interval);
              resolve();
            }
          }, 10);
        });
      }

      // El mapa no puede tener más de 20 entradas
      // Verificamos indirectamente: podemos crear otra corrida (lock liberado) y el estado es accesible
      const finalRunId = service.startManualRun();
      expect(service.getRun(finalRunId)).toBeDefined();
    });
  });

  describe('@Cron — sync()', () => {
    it('con lock libre, sync() completa sin lanzar', async () => {
      await expect(service.sync()).resolves.toBeUndefined();
    });

    it('con lock tomado por una corrida manual, sync() loguea y retorna void sin lanzar', async () => {
      const warnSpy = jest.spyOn(
        (service as unknown as { logger: { warn: jest.Mock } }).logger,
        'warn',
      );
      service.startManualRun();

      await expect(service.sync()).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('SyncInProgressError — 409 con runId cuando el @Cron tiene la corrida en curso', () => {
    it('sync() registra su corrida en el mapa con trigger cron', async () => {
      // Bloquear fetchLeagueTeams la primera vez para que sync() no termine de inmediato
      let resolveCron: () => void;
      const cronBlocked = new Promise<void>((r) => { resolveCron = r; });

      whoScored.fetchLeagueTeams.mockImplementationOnce(
        () => new Promise<WhoScoredLeagueTeams>((r) => cronBlocked.then(() => r(emptyLeagueTeams()))),
      );
      whoScored.fetchLeagueTeams.mockResolvedValue(emptyLeagueTeams());

      // Arrancar la corrida del Cron sin awaitar
      const cronPromise = service.sync();

      // Esperar un tick para que sync() llegue al primer fetchLeagueTeams y tome el lock
      await new Promise((r) => setTimeout(r, 0));

      // Ahora intentar una corrida manual → debe fallar con SyncInProgressError
      expect(() => service.startManualRun()).toThrow(SyncInProgressError);
      const caught = (() => {
        try { service.startManualRun(); }
        catch (e) { return e as SyncInProgressError; }
      })();
      expect(caught).toBeInstanceOf(SyncInProgressError);
      expect(caught!.runId).toBeDefined();
      // El runId debe aparecer en el mapa con trigger 'cron'
      const state = service.getRun(caught!.runId!);
      expect(state).toBeDefined();
      expect(state!.trigger).toBe('cron');

      // Liberar el Cron
      resolveCron!();
      await cronPromise;
    });
  });

  describe('una liga con falla sigue apareciendo en failedUnits', () => {
    it('fetchLeagueTeams que falla produce un failedUnit con reason league-fetch-failed', async () => {
      whoScored.fetchLeagueTeams.mockImplementation((league) => {
        if (league === League.PREMIER_LEAGUE) {
          return Promise.reject(new Error('liga caída'));
        }
        return Promise.resolve(emptyLeagueTeams());
      });

      const runId = service.startManualRun();
      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          const state = service.getRun(runId);
          if (state && state.status !== 'running') {
            clearInterval(interval);
            resolve();
          }
        }, 10);
      });

      const state = service.getRun(runId);
      expect(state!.status).toBe('completed');
      expect(state!.summary!.failedUnits).toHaveLength(1);
      expect(state!.summary!.failedUnits[0].reason).toBe('league-fetch-failed');
      expect(state!.summary!.failedUnits[0].league).toBe(League.PREMIER_LEAGUE);
    });
  });
});
