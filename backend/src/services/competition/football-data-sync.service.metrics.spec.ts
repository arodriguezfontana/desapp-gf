import { Logger } from '@nestjs/common';
import { Clock } from '../../adapters/runtime/clock';
import { FixedClock } from '../../adapters/runtime/fake-runtime';
import { FootballDataAdapter } from '../../adapters/competition/football-data-adapter';
import { SyncInProgressError } from '../../domain/sync/errors/sync-in-progress.error';
import { MatchRepository } from '../../repositories/competition/match.repository';
import { StandingRepository } from '../../repositories/competition/standing.repository';
import {
  BusinessMetricsDouble,
  createBusinessMetricsDouble,
  makeBusinessMetricsDoubleThrow,
} from '../../shared/observability/metrics/business-metrics.double';
import { SyncLastSuccessService } from '../observability/sync-last-success.service';
import { FootballDataSyncService, TARGET_LEAGUES } from './football-data-sync.service';

class SteppingClock implements Clock {
  private current = Date.parse('2026-11-13T10:00:00.000Z');
  constructor(private readonly stepMs: number) {}
  now(): Date {
    const date = new Date(this.current);
    this.current += this.stepMs;
    return date;
  }
}

/** 031-US2: corridas de Football-Data por origen y resultado; sólo `success` avanza la última sync exitosa. */
describe('FootballDataSyncService — métricas de negocio', () => {
  let adapter: jest.Mocked<FootballDataAdapter>;
  let metrics: BusinessMetricsDouble;
  let lastSuccess: { record: jest.Mock };

  const build = (clock: Clock = new FixedClock()) => {
    const service = new FootballDataSyncService(
      adapter,
      { upsertMatches: jest.fn().mockResolvedValue(undefined) } as unknown as MatchRepository,
      { upsertStandings: jest.fn().mockResolvedValue(undefined) } as unknown as StandingRepository,
      metrics,
      lastSuccess as unknown as SyncLastSuccessService,
      clock,
    );
    service.setRequestDelay(0);
    return service;
  };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    adapter = {
      fetchStandings: jest.fn().mockResolvedValue([]),
      fetchMatches: jest.fn().mockResolvedValue([]),
    };
    metrics = createBusinessMetricsDouble();
    lastSuccess = { record: jest.fn().mockResolvedValue(undefined) };
  });

  afterEach(() => jest.restoreAllMocks());

  it('el disparo manual con todas las ligas bien cuenta manual/success y avanza la última sync', async () => {
    await build().triggerManualRun();

    expect(metrics.recordSyncRun).toHaveBeenCalledTimes(1);
    expect(metrics.recordSyncRun).toHaveBeenCalledWith('football_data', 'manual', 'success', 0);
    expect(lastSuccess.record).toHaveBeenCalledWith('football_data', new Date('2026-10-26T12:00:00.000Z'));
  });

  it('handleCron cuenta scheduled', async () => {
    await build().handleCron();

    expect(metrics.recordSyncRun).toHaveBeenCalledWith('football_data', 'scheduled', 'success', 0);
    expect(metrics.recordSyncRun).not.toHaveBeenCalledWith('football_data', 'manual', expect.anything(), expect.anything());
  });

  it('PARTIAL: una liga falla y las demás no -> sube sólo partial y NO avanza la última sync', async () => {
    adapter.fetchStandings.mockImplementation((code) =>
      code === 'PD' ? Promise.reject(new Error('proveedor caído')) : Promise.resolve([]),
    );

    const summary = await build().triggerManualRun();

    expect(summary.failedLeagues).toEqual(['PD']);
    expect(metrics.recordSyncRun).toHaveBeenCalledWith('football_data', 'manual', 'partial', 0);
    expect(lastSuccess.record).not.toHaveBeenCalled();
  });

  it('FAILURE: todas las ligas fallaron -> failure y no avanza la última sync', async () => {
    adapter.fetchStandings.mockRejectedValue(new Error('proveedor caído'));
    adapter.fetchMatches.mockRejectedValue(new Error('proveedor caído'));

    const summary = await build().triggerManualRun();

    expect(summary.failedLeagues).toHaveLength(TARGET_LEAGUES.length);
    expect(metrics.recordSyncRun).toHaveBeenCalledWith('football_data', 'manual', 'failure', 0);
    expect(lastSuccess.record).not.toHaveBeenCalled();
  });

  it('FAILURE: un error inesperado en el cron (la corrida se abortó) cuenta failure', async () => {
    const service = build();
    jest.spyOn(service, 'syncAllLeagues').mockRejectedValue(new Error('inesperado'));

    await service.handleCron();

    expect(metrics.recordSyncRun).toHaveBeenCalledWith('football_data', 'scheduled', 'failure', 0);
    expect(lastSuccess.record).not.toHaveBeenCalled();
  });

  it('observa la duración con el Clock inyectado', async () => {
    await build(new SteppingClock(70_000)).triggerManualRun();

    const [, , , duration] = metrics.recordSyncRun.mock.calls[0];
    expect(duration).toBeGreaterThan(0);
    expect(duration % 70).toBe(0);
  });

  it('un disparo rechazado por lock (409) no cuenta como corrida', async () => {
    let release!: () => void;
    const block = new Promise<void>((resolve) => (release = resolve));
    adapter.fetchStandings.mockImplementationOnce(() => block.then(() => []));
    const service = build();

    const running = service.triggerManualRun();
    await expect(service.triggerManualRun()).rejects.toThrow(SyncInProgressError);
    expect(metrics.recordSyncRun).not.toHaveBeenCalled();

    release();
    await running;
    expect(metrics.recordSyncRun).toHaveBeenCalledTimes(1);
  });

  it('el cron que se salta por lock tampoco cuenta corrida', async () => {
    let release!: () => void;
    const block = new Promise<void>((resolve) => (release = resolve));
    adapter.fetchStandings.mockImplementationOnce(() => block.then(() => []));
    const service = build();

    const running = service.triggerManualRun();
    await service.handleCron();
    expect(metrics.recordSyncRun).not.toHaveBeenCalled();

    release();
    await running;
    expect(metrics.recordSyncRun).toHaveBeenCalledTimes(1);
    expect(metrics.recordSyncRun).toHaveBeenCalledWith('football_data', 'manual', 'success', 0);
  });

  it('un BusinessMetrics o un SyncLastSuccessService que lanzan no alteran el resumen de la corrida', async () => {
    makeBusinessMetricsDoubleThrow(metrics);
    lastSuccess.record.mockRejectedValue(new Error('base caída'));

    const summary = await build().triggerManualRun();

    expect(summary.leagues).toHaveLength(TARGET_LEAGUES.length);
    expect(summary.failedLeagues).toEqual([]);
  });
});
