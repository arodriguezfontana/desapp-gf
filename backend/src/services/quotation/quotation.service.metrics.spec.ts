import { Logger } from '@nestjs/common';
import { Clock } from '../../adapters/runtime/clock';
import { FixedClock, SequentialIdGenerator } from '../../adapters/runtime/fake-runtime';
import { RecalculationInProgressError } from '../../domain/quotation/errors/recalculation-in-progress.error';
import { PlayerQuoteRepository } from '../../repositories/quotation/player-quote.repository';
import { PlayerRepository } from '../../repositories/player/player.repository';
import { ValuationStrategyRepository } from '../../repositories/quotation/valuation-strategy.repository';
import {
  BusinessMetricsDouble,
  createBusinessMetricsDouble,
  makeBusinessMetricsDoubleThrow,
} from '../../shared/observability/metrics/business-metrics.double';
import { QuotationService } from './quotation.service';
import { StrategyService } from './strategy.service';

class SteppingClock implements Clock {
  private current = Date.parse('2026-11-13T03:00:00.000Z');
  constructor(private readonly stepMs: number) {}
  now(): Date {
    const date = new Date(this.current);
    this.current += this.stepMs;
    return date;
  }
}

/** 031-US3: recálculos de cotización por origen (obligatorio) y resultado, con su duración. */
describe('QuotationService — métricas de negocio', () => {
  let strategyRepo: jest.Mocked<ValuationStrategyRepository>;
  let metrics: BusinessMetricsDouble;

  const build = (clock: Clock = new FixedClock()) => {
    const quoteRepo = { saveMany: jest.fn().mockResolvedValue(undefined) } as unknown as PlayerQuoteRepository;
    const playerRepo = { findAllActive: jest.fn().mockResolvedValue([]), findById: jest.fn() } as unknown as PlayerRepository;
    return new QuotationService(
      strategyRepo,
      quoteRepo,
      playerRepo,
      { emit: jest.fn(), emitAsync: jest.fn() } as never,
      clock,
      new SequentialIdGenerator('quote'),
      new StrategyService(strategyRepo),
      metrics,
    );
  };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    strategyRepo = {
      findByUserId: jest.fn().mockResolvedValue([]),
      findAllUserIds: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<ValuationStrategyRepository>;
    metrics = createBusinessMetricsDouble();
  });

  afterEach(() => jest.restoreAllMocks());

  it("recalculateAll('manual') cuenta manual/success", async () => {
    await build().recalculateAll('manual');

    expect(metrics.recordQuoteRecalculation).toHaveBeenCalledTimes(1);
    expect(metrics.recordQuoteRecalculation).toHaveBeenCalledWith('manual', 'success', 0);
  });

  it("recalculateAll('scheduled') cuenta scheduled/success", async () => {
    await build().recalculateAll('scheduled');

    expect(metrics.recordQuoteRecalculation).toHaveBeenCalledWith('scheduled', 'success', 0);
  });

  it('recalculateAll sin `trigger` NO compila: el origen es obligatorio y no tiene valor por defecto', () => {
    const service = build();
    // @ts-expect-error — si alguien le vuelve a dar un valor por defecto a `trigger`, esta línea deja de fallar y el spec no compila.
    const omitted: Promise<unknown> = service.recalculateAll();
    omitted.catch(() => undefined);
    expect(true).toBe(true);
  });

  it('el camino del cron (handleCron) llama a recalculateAll con scheduled e incrementa scheduled, nunca manual', async () => {
    const service = build();
    const spy = jest.spyOn(service, 'recalculateAll');

    await service.handleCron();

    expect(spy).toHaveBeenCalledWith('scheduled');
    expect(metrics.recordQuoteRecalculation).toHaveBeenCalledTimes(1);
    expect(metrics.recordQuoteRecalculation).toHaveBeenCalledWith('scheduled', 'success', 0);
    expect(metrics.recordQuoteRecalculation).not.toHaveBeenCalledWith('manual', expect.anything(), expect.anything());
  });

  it('un fallo interno cuenta failure y relanza el mismo error', async () => {
    const boom = new Error('base de datos caída');
    strategyRepo.findAllUserIds.mockRejectedValue(boom);

    await expect(build().recalculateAll('manual')).rejects.toBe(boom);

    expect(metrics.recordQuoteRecalculation).toHaveBeenCalledWith('manual', 'failure', 0);
  });

  it('un fallo del cron cuenta scheduled/failure y no se propaga al scheduler', async () => {
    strategyRepo.findAllUserIds.mockRejectedValue(new Error('base de datos caída'));

    await expect(build().handleCron()).resolves.toBeUndefined();

    expect(metrics.recordQuoteRecalculation).toHaveBeenCalledWith('scheduled', 'failure', 0);
  });

  it('un recálculo rechazado por lock (409) no cuenta como corrida', async () => {
    let release!: () => void;
    strategyRepo.findAllUserIds.mockReturnValue(new Promise<string[]>((resolve) => (release = () => resolve([]))));
    const service = build();

    const first = service.recalculateAll('manual');
    await expect(service.recalculateAll('manual')).rejects.toBeInstanceOf(RecalculationInProgressError);
    expect(metrics.recordQuoteRecalculation).not.toHaveBeenCalled();

    release();
    await first;
    expect(metrics.recordQuoteRecalculation).toHaveBeenCalledTimes(1);
  });

  it('el cron que se salta por lock tampoco cuenta corrida', async () => {
    let release!: () => void;
    strategyRepo.findAllUserIds.mockReturnValue(new Promise<string[]>((resolve) => (release = () => resolve([]))));
    const service = build();

    const manual = service.recalculateAll('manual');
    await service.handleCron();
    expect(metrics.recordQuoteRecalculation).not.toHaveBeenCalled();

    release();
    await manual;
    expect(metrics.recordQuoteRecalculation).toHaveBeenCalledTimes(1);
    expect(metrics.recordQuoteRecalculation).toHaveBeenCalledWith('manual', 'success', 0);
  });

  it('observa la duración con el Clock inyectado', async () => {
    await build(new SteppingClock(2_500)).recalculateAll('manual');

    const [, , duration] = metrics.recordQuoteRecalculation.mock.calls[0];
    expect(duration).toBeGreaterThan(0);
    expect(duration % 2.5).toBe(0);
  });

  it('un BusinessMetrics que lanza no altera el resultado ni el error del recálculo', async () => {
    makeBusinessMetricsDoubleThrow(metrics);
    await expect(build().recalculateAll('manual')).resolves.toEqual({ recalculated: [], skipped: [] });

    const boom = new Error('base de datos caída');
    strategyRepo.findAllUserIds.mockRejectedValue(boom);
    await expect(build().recalculateAll('manual')).rejects.toBe(boom);
  });
});
