import { Logger } from '@nestjs/common';
import { SyncLastSuccessRepository } from '../../repositories/sync/sync-last-success.repository';
import {
  BusinessMetricsDouble,
  createBusinessMetricsDouble,
} from '../../shared/observability/metrics/business-metrics.double';
import { SyncLastSuccessService } from './sync-last-success.service';

describe('SyncLastSuccessService', () => {
  let repository: { findAll: jest.Mock; upsert: jest.Mock };
  let metrics: BusinessMetricsDouble;
  let service: SyncLastSuccessService;
  let logError: jest.SpyInstance;

  beforeEach(() => {
    logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    repository = { findAll: jest.fn().mockResolvedValue([]), upsert: jest.fn().mockResolvedValue(undefined) };
    metrics = createBusinessMetricsDouble();
    service = new SyncLastSuccessService(repository as unknown as SyncLastSuccessRepository, metrics);
  });

  afterEach(() => jest.restoreAllMocks());

  it('record fija el gauge y hace upsert de la fuente', async () => {
    const at = new Date('2026-11-13T10:00:00.000Z');

    await service.record('whoscored', at);

    expect(metrics.setSyncLastSuccess).toHaveBeenCalledWith('whoscored', at);
    expect(repository.upsert).toHaveBeenCalledWith('whoscored', at);
  });

  it('onApplicationBootstrap siembra el gauge desde la base, una vez por fuente', async () => {
    const whoscoredAt = new Date('2026-11-10T00:00:00.000Z');
    const footballAt = new Date('2026-11-12T00:00:00.000Z');
    repository.findAll.mockResolvedValue([
      { source: 'whoscored', succeededAt: whoscoredAt },
      { source: 'football_data', succeededAt: footballAt },
    ]);

    await service.onApplicationBootstrap();

    expect(metrics.setSyncLastSuccess).toHaveBeenCalledTimes(2);
    expect(metrics.setSyncLastSuccess).toHaveBeenCalledWith('whoscored', whoscoredAt);
    expect(metrics.setSyncLastSuccess).toHaveBeenCalledWith('football_data', footballAt);
  });

  it('sin filas el gauge queda ausente (no se fija ningún valor)', async () => {
    await service.onApplicationBootstrap();

    expect(metrics.setSyncLastSuccess).not.toHaveBeenCalled();
  });

  it('un fallo al leer la base se registra en el log y no lanza', async () => {
    repository.findAll.mockRejectedValue(new Error('base caída'));

    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();

    expect(logError).toHaveBeenCalled();
    expect(metrics.setSyncLastSuccess).not.toHaveBeenCalled();
  });

  it('un fallo al escribir en la base se registra en el log y no lanza', async () => {
    repository.upsert.mockRejectedValue(new Error('base caída'));

    await expect(service.record('football_data', new Date())).resolves.toBeUndefined();

    expect(logError).toHaveBeenCalled();
  });

  it('un BusinessMetrics que lanza no hace lanzar a record ni al arranque', async () => {
    metrics.setSyncLastSuccess.mockImplementation(() => {
      throw new Error('métricas rotas');
    });
    repository.findAll.mockResolvedValue([{ source: 'whoscored', succeededAt: new Date() }]);

    await expect(service.record('whoscored', new Date())).resolves.toBeUndefined();
    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
  });
});
