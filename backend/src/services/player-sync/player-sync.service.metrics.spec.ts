import { Logger } from '@nestjs/common';
import { Clock } from '../../adapters/runtime/clock';
import { FixedClock, SequentialIdGenerator } from '../../adapters/runtime/fake-runtime';
import {
  WhoScoredAdapter,
  WhoScoredLeagueTeams,
  WhoScoredRawPlayer,
  WhoScoredTeamRef,
} from '../../adapters/player-sync/whoscored-adapter';
import { League } from '../../domain/player/enums/league';
import { SyncInProgressError } from '../../domain/sync/errors/sync-in-progress.error';
import { PlayerRepository } from '../../repositories/player/player.repository';
import {
  BusinessMetricsDouble,
  createBusinessMetricsDouble,
  makeBusinessMetricsDoubleThrow,
} from '../../shared/observability/metrics/business-metrics.double';
import { SyncLastSuccessService } from '../observability/sync-last-success.service';
import { PlayerSyncService } from './player-sync.service';

/** Reloj que avanza `stepMs` en cada lectura: la duración de una corrida es (lecturas - 1) × stepMs. */
class SteppingClock implements Clock {
  private current = Date.parse('2026-11-13T10:00:00.000Z');
  constructor(private readonly stepMs: number) {}
  now(): Date {
    const date = new Date(this.current);
    this.current += this.stepMs;
    return date;
  }
}

const rawPlayer = (externalId: string): WhoScoredRawPlayer => ({
  externalId,
  name: 'Jugador',
  rawPosition: 'GK',
  metrics: {
    matchesPlayed: 20,
    passesCompleted: 10,
    shots: 1,
    interceptions: 0.5,
    rating: 7,
    goals: 1,
    assists: 2,
    keyPasses: 3,
    dribbles: 4,
    totalTackles: 5,
    yellowCards: 6,
    redCards: 7,
  },
  metricsFetchFailed: false,
});

const leagueTeams = (teams: WhoScoredTeamRef[]): WhoScoredLeagueTeams => ({
  tournamentId: 2,
  teams,
  seedPlayerByTeam: new Map(teams.map((t) => [t.externalTeamId, `seed-${t.externalTeamId}`])),
});

const T1: WhoScoredTeamRef = { externalTeamId: 't1', team: 'Equipo Uno' };
const T2: WhoScoredTeamRef = { externalTeamId: 't2', team: 'Equipo Dos' };

/** 031-US2: corridas de WhoScored por origen y resultado; sólo `success` avanza la última sync exitosa. */
describe('PlayerSyncService — métricas de negocio', () => {
  let whoScored: jest.Mocked<WhoScoredAdapter>;
  let players: jest.Mocked<PlayerRepository>;
  let metrics: BusinessMetricsDouble;
  let lastSuccess: { record: jest.Mock };

  const build = (clock: Clock = new FixedClock()) =>
    new PlayerSyncService(
      whoScored,
      players,
      clock,
      new SequentialIdGenerator('run'),
      metrics,
      lastSuccess as unknown as SyncLastSuccessService,
    );

  /** Sólo la Premier League tiene equipos; el resto de las ligas viene vacío. */
  const onlyPremierLeague = (teams: WhoScoredTeamRef[]) =>
    whoScored.fetchLeagueTeams.mockImplementation((league) =>
      Promise.resolve(leagueTeams(league === League.PREMIER_LEAGUE ? teams : [])),
    );

  const waitForRun = async (service: PlayerSyncService, runId: string) => {
    for (let i = 0; i < 200 && service.getRun(runId)?.status === 'running'; i++) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    return service.getRun(runId)!;
  };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    whoScored = { fetchLeagueTeams: jest.fn(), fetchTeamRoster: jest.fn() };
    players = {
      findActiveExternalIdsByTeam: jest.fn().mockResolvedValue([]),
      applyTeamRosterSync: jest.fn().mockResolvedValue(undefined),
    } as unknown as typeof players;
    metrics = createBusinessMetricsDouble();
    lastSuccess = { record: jest.fn().mockResolvedValue(undefined) };
  });

  afterEach(() => jest.restoreAllMocks());

  it('el cron con todas las unidades bien cuenta scheduled/success y avanza la última sync', async () => {
    onlyPremierLeague([T1, T2]);
    whoScored.fetchTeamRoster.mockResolvedValue([rawPlayer('ws-1')]);

    await build().sync();

    expect(metrics.recordSyncRun).toHaveBeenCalledTimes(1);
    expect(metrics.recordSyncRun).toHaveBeenCalledWith('whoscored', 'scheduled', 'success', 0);
    expect(lastSuccess.record).toHaveBeenCalledWith('whoscored', new Date('2026-10-26T12:00:00.000Z'));
  });

  it('el disparo manual cuenta manual (no se deduce: lo fija el punto de entrada)', async () => {
    onlyPremierLeague([T1]);
    whoScored.fetchTeamRoster.mockResolvedValue([rawPlayer('ws-1')]);
    const service = build();

    const runId = service.startManualRun();
    await waitForRun(service, runId);

    expect(metrics.recordSyncRun).toHaveBeenCalledWith('whoscored', 'manual', 'success', 0);
  });

  it('PARTIAL: algunas unidades fallaron y otras no -> sube sólo partial y NO avanza la última sync', async () => {
    onlyPremierLeague([T1, T2]);
    whoScored.fetchTeamRoster.mockImplementation((team) =>
      team.externalTeamId === 't2' ? Promise.reject(new Error('plantel caído')) : Promise.resolve([rawPlayer('ws-1')]),
    );

    await build().sync();

    expect(metrics.recordSyncRun).toHaveBeenCalledTimes(1);
    expect(metrics.recordSyncRun).toHaveBeenCalledWith('whoscored', 'scheduled', 'partial', 0);
    expect(lastSuccess.record).not.toHaveBeenCalled();
  });

  it('FAILURE: ninguna unidad terminó bien -> failure y no avanza la última sync', async () => {
    whoScored.fetchLeagueTeams.mockRejectedValue(new Error('proveedor caído'));

    await build().sync();

    expect(metrics.recordSyncRun).toHaveBeenCalledWith('whoscored', 'scheduled', 'failure', 0);
    expect(lastSuccess.record).not.toHaveBeenCalled();
  });

  it('FAILURE: la corrida se abortó con una excepción inesperada', async () => {
    onlyPremierLeague([T1]);
    whoScored.fetchTeamRoster.mockResolvedValue([rawPlayer('ws-1')]);
    players.findActiveExternalIdsByTeam.mockRejectedValue(new Error('base caída'));
    const service = build();

    const runId = service.startManualRun();
    const run = await waitForRun(service, runId);

    expect(run.status).toBe('failed');
    expect(metrics.recordSyncRun).toHaveBeenCalledWith('whoscored', 'manual', 'failure', 0);
    expect(lastSuccess.record).not.toHaveBeenCalled();
  });

  it('observa la duración con el Clock inyectado, de inicio a fin de la corrida', async () => {
    onlyPremierLeague([T1]);
    whoScored.fetchTeamRoster.mockResolvedValue([rawPlayer('ws-1')]);

    await build(new SteppingClock(30_000)).sync();

    const [, , , duration] = metrics.recordSyncRun.mock.calls[0];
    expect(duration).toBeGreaterThan(0);
    expect(duration % 30).toBe(0);
  });

  it('un disparo rechazado por lock (409) no cuenta como corrida', async () => {
    let release!: () => void;
    const block = new Promise<void>((resolve) => (release = resolve));
    whoScored.fetchLeagueTeams.mockImplementation(() => block.then(() => leagueTeams([])));
    const service = build();

    const runId = service.startManualRun();
    expect(() => service.startManualRun()).toThrow(SyncInProgressError);
    expect(metrics.recordSyncRun).not.toHaveBeenCalled();

    release();
    await waitForRun(service, runId);
    expect(metrics.recordSyncRun).toHaveBeenCalledTimes(1);
  });

  it('el cron que se salta por lock tampoco cuenta corrida', async () => {
    let release!: () => void;
    const block = new Promise<void>((resolve) => (release = resolve));
    whoScored.fetchLeagueTeams.mockImplementation(() => block.then(() => leagueTeams([])));
    const service = build();

    const runId = service.startManualRun();
    await service.sync();
    expect(metrics.recordSyncRun).not.toHaveBeenCalled();

    release();
    await waitForRun(service, runId);
    expect(metrics.recordSyncRun).toHaveBeenCalledTimes(1);
    expect(metrics.recordSyncRun).toHaveBeenCalledWith('whoscored', 'manual', 'success', 0);
  });

  it('un BusinessMetrics o un SyncLastSuccessService que lanzan no alteran la corrida', async () => {
    makeBusinessMetricsDoubleThrow(metrics);
    lastSuccess.record.mockRejectedValue(new Error('base caída'));
    onlyPremierLeague([T1]);
    whoScored.fetchTeamRoster.mockResolvedValue([rawPlayer('ws-1')]);
    const service = build();

    const runId = service.startManualRun();
    const run = await waitForRun(service, runId);

    expect(run.status).toBe('completed');
    expect(run.summary?.teamsSynced).toBe(1);
  });

  it('sin BusinessMetrics inyectado funciona igual', async () => {
    onlyPremierLeague([T1]);
    whoScored.fetchTeamRoster.mockResolvedValue([rawPlayer('ws-1')]);
    const service = new PlayerSyncService(whoScored, players, new FixedClock(), new SequentialIdGenerator('run'));

    const runId = service.startManualRun();

    expect((await waitForRun(service, runId)).status).toBe('completed');
  });
});
