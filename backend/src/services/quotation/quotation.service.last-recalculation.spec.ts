import { Logger } from '@nestjs/common';
import { Clock } from '../../adapters/runtime/clock';
import { SequentialIdGenerator } from '../../adapters/runtime/fake-runtime';
import { RecalculationInProgressError } from '../../domain/quotation/errors/recalculation-in-progress.error';
import { PlayerRepository } from '../../repositories/player/player.repository';
import { PlayerQuoteRepository } from '../../repositories/quotation/player-quote.repository';
import { ValuationStrategyRepository } from '../../repositories/quotation/valuation-strategy.repository';
import {
  BusinessMetricsDouble,
  createBusinessMetricsDouble,
  makeBusinessMetricsDoubleThrow,
} from '../../shared/observability/metrics/business-metrics.double';
import { QuotationService } from './quotation.service';
import { StrategyService } from './strategy.service';

class FixedNow implements Clock {
  constructor(private readonly instant: Date) {}
  now(): Date {
    return new Date(this.instant);
  }
}

/** 031: el momento del último recálculo exitoso se fija tras cada recálculo y se siembra al arrancar desde la base. */
describe('QuotationService — último recálculo de cotizaciones', () => {
  const NOW = new Date('2026-11-15T03:00:00.000Z');
  let strategyRepo: jest.Mocked<ValuationStrategyRepository>;
  let quoteRepo: { saveMany: jest.Mock; findLatestCalculatedAt: jest.Mock };
  let metrics: BusinessMetricsDouble;
  let logError: jest.SpyInstance;

  const build = () =>
    new QuotationService(
      strategyRepo,
      quoteRepo as unknown as PlayerQuoteRepository,
      { findAllActive: jest.fn().mockResolvedValue([]), findById: jest.fn() } as unknown as PlayerRepository,
      { emit: jest.fn(), emitAsync: jest.fn() } as never,
      new FixedNow(NOW),
      new SequentialIdGenerator('quote'),
      new StrategyService(strategyRepo),
      metrics,
    );

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    strategyRepo = {
      findByUserId: jest.fn().mockResolvedValue([]),
      findAllUserIds: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<ValuationStrategyRepository>;
    quoteRepo = { saveMany: jest.fn().mockResolvedValue(undefined), findLatestCalculatedAt: jest.fn().mockResolvedValue(null) };
    metrics = createBusinessMetricsDouble();
  });

  afterEach(() => jest.restoreAllMocks());

  describe('tras un recálculo', () => {
    it('exitoso fija el último recálculo con la hora del Clock (manual y programado)', async () => {
      await build().recalculateAll('manual');
      await build().recalculateAll('scheduled');

      expect(metrics.setQuoteLastRecalculation).toHaveBeenCalledTimes(2);
      expect(metrics.setQuoteLastRecalculation).toHaveBeenCalledWith(NOW);
    });

    it('fallido NO lo modifica', async () => {
      strategyRepo.findAllUserIds.mockRejectedValue(new Error('base caída'));

      await expect(build().recalculateAll('manual')).rejects.toThrow('base caída');

      expect(metrics.setQuoteLastRecalculation).not.toHaveBeenCalled();
    });

    it('rechazado por lock (409) NO lo modifica', async () => {
      let release!: () => void;
      strategyRepo.findAllUserIds.mockReturnValue(new Promise<string[]>((resolve) => (release = () => resolve([]))));
      const service = build();

      const first = service.recalculateAll('manual');
      await expect(service.recalculateAll('manual')).rejects.toBeInstanceOf(RecalculationInProgressError);
      expect(metrics.setQuoteLastRecalculation).not.toHaveBeenCalled();

      release();
      await first;
      expect(metrics.setQuoteLastRecalculation).toHaveBeenCalledTimes(1);
    });

    it('un BusinessMetrics que lanza no altera el resultado del recálculo', async () => {
      makeBusinessMetricsDoubleThrow(metrics);

      await expect(build().recalculateAll('manual')).resolves.toEqual({ recalculated: [], skipped: [] });
    });
  });

  describe('al arrancar', () => {
    it('siembra el último recálculo desde la cotización más reciente guardada', async () => {
      const latest = new Date('2026-11-08T03:00:00.000Z');
      quoteRepo.findLatestCalculatedAt.mockResolvedValue(latest);

      await build().onApplicationBootstrap();

      expect(metrics.setQuoteLastRecalculation).toHaveBeenCalledTimes(1);
      expect(metrics.setQuoteLastRecalculation).toHaveBeenCalledWith(latest);
    });

    it('sin cotizaciones guardadas no fija ningún valor', async () => {
      await build().onApplicationBootstrap();

      expect(metrics.setQuoteLastRecalculation).not.toHaveBeenCalled();
    });

    it('un fallo de la base se registra en el log y no impide el arranque', async () => {
      quoteRepo.findLatestCalculatedAt.mockRejectedValue(new Error('base caída'));

      await expect(build().onApplicationBootstrap()).resolves.toBeUndefined();

      expect(logError).toHaveBeenCalled();
      expect(metrics.setQuoteLastRecalculation).not.toHaveBeenCalled();
    });

    it('un BusinessMetrics que lanza no impide el arranque', async () => {
      makeBusinessMetricsDoubleThrow(metrics);
      quoteRepo.findLatestCalculatedAt.mockResolvedValue(new Date());

      await expect(build().onApplicationBootstrap()).resolves.toBeUndefined();
    });
  });
});
